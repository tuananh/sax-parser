#include "event-collector.h"

#include <cstring>

namespace saxparser
{

void EventCollector::releaseInto(std::vector<uint8_t> &records, std::vector<uint8_t> &aux,
                                 size_t &eventCount)
{
    eventCount = _eventCount;
    // Swap keeps capacity on the collector for the next parse (the previous
    // dispatch buffers come back empty-but-reserved after clear).
    records.swap(_records);
    aux.swap(_aux);
    _records.clear();
    _aux.clear();
    _eventCount = 0;
}

void EventCollector::clear()
{
    _records.clear();
    _aux.clear();
    _eventCount = 0;
    _xmlBase = nullptr;
    _errorCode = 0;
    _errorOffset = 0;
    _compactRecords = false;
    // Keep _batchCallback installed — rebinding std::function every parse
    // allocates on the cold path.
    _batchSize = kDefaultBatchSize;
}

void EventCollector::setBatchCallback(BatchCallback callback, size_t batchSize)
{
    _batchCallback = std::move(callback);
    _batchSize = batchSize > 0 ? batchSize : kDefaultBatchSize;
}

void EventCollector::clearBatchCallback()
{
    _batchCallback = nullptr;
}

void EventCollector::reserve(size_t recordBytes, size_t auxBytes)
{
    _records.reserve(recordBytes);
    _aux.reserve(auxBytes);
}

void EventCollector::maybeFlushBatch()
{
    if (_batchCallback && _eventCount >= _batchSize)
        _batchCallback();
}

void EventCollector::writeU32(std::vector<uint8_t> &buf, uint32_t value)
{
    const size_t offset = buf.size();
    buf.resize(offset + sizeof(uint32_t));
    std::memcpy(buf.data() + offset, &value, sizeof(value));
}

uint32_t EventCollector::xmlOffset(const char *ptr) const
{
    if (_xmlBase == nullptr || ptr == nullptr)
        return 0;
    return static_cast<uint32_t>(ptr - _xmlBase);
}

void EventCollector::setError(uint32_t code, uint32_t offset)
{
    _errorCode = code;
    _errorOffset = offset;
}

void EventCollector::pushEvent(uint32_t type, uint32_t arg0, uint32_t arg1, uint32_t arg2,
                               uint32_t arg3)
{
    if (_compactRecords)
    {
        writeU32(_records, type);
    }
    else
    {
        const size_t bytes = sizeof(uint32_t) * 5;
        const size_t base = _records.size();
        _records.resize(base + bytes);
        uint8_t *p = _records.data() + base;
        auto putU32 = [&p](uint32_t value) {
            std::memcpy(p, &value, sizeof(value));
            p += sizeof(value);
        };
        putU32(type);
        putU32(arg0);
        putU32(arg1);
        putU32(arg2);
        putU32(arg3);
    }
    _eventCount++;
    maybeFlushBatch();
}

uint32_t EventCollector::pushBytes(const void *data, size_t len)
{
    if (data == nullptr || len == 0)
        return 0;

    const uint32_t offset = static_cast<uint32_t>(_aux.size());
    const size_t end = _aux.size() + len;
    _aux.resize(end);
    std::memcpy(_aux.data() + offset, data, len);
    return offset;
}

uint32_t EventCollector::pushAttributes(const char **attrs, const uint32_t *lens)
{
    uint32_t count = 0;
    if (attrs != nullptr)
    {
        for (const char **cursor = attrs; *cursor != nullptr; cursor += 2)
            count++;
    }

    // Sentinel so JS can skip the aux walk for the common empty-attrs case
    // without reading a zero count word.
    if (count == 0)
        return 0xffffffffu;

    const uint32_t blockOffset = static_cast<uint32_t>(_aux.size());
    const size_t bytes = sizeof(uint32_t) * (1u + count * 4u);
    const size_t base = _aux.size();
    _aux.resize(base + bytes);

    uint8_t *p = _aux.data() + base;
    auto putU32 = [&p](uint32_t value) {
        std::memcpy(p, &value, sizeof(value));
        p += sizeof(value);
    };

    putU32(count);
    for (uint32_t i = 0; i < count; i++)
    {
        const char *name = attrs[i * 2];
        const char *value = attrs[i * 2 + 1];
        const uint32_t nameLen =
            lens != nullptr ? lens[i * 2] : static_cast<uint32_t>(std::strlen(name));
        const uint32_t valueLen =
            lens != nullptr ? lens[i * 2 + 1] : static_cast<uint32_t>(std::strlen(value));

        putU32(nameLen);
        putU32(valueLen);
        putU32(xmlOffset(name));
        putU32(xmlOffset(value));
    }

    return blockOffset;
}

SAXEventNeeds eventNeedsFromFlags(const ListenerFlags &flags)
{
    SAXEventNeeds needs;
    needs.startElement = flags.startElement;
    needs.startElementAttributes = flags.startElement && flags.startElementNeedsAttrs;
    needs.endElement = flags.endElement;
    needs.startAttribute = flags.startAttribute;
    needs.endAttribute = flags.endAttribute;
    needs.text = flags.text;
    needs.cdata = flags.cdata;
    needs.comment = flags.comment;
    needs.startDocument = flags.startDocument;
    needs.endDocument = flags.endDocument || flags.end || flags.finish || flags.done;
    needs.doctype = flags.doctype;
    needs.error = flags.error;
    needs.startXmlDeclAttr = flags.startXmlDeclAttr;
    needs.endXmlDeclAttr = flags.endXmlDeclAttr;
    needs.xmlDecl = flags.xmlDecl;
    needs.xmlDeclAttributes = flags.xmlDecl && flags.xmlDeclNeedsArgs;
    needs.processingInstruction = flags.processingInstruction;
    return needs;
}

bool useCompactRecords(const ListenerFlags &flags)
{
    return !flags.startElementNeedsArgs && !flags.endElementNeedsArgs && !flags.textNeedsArgs &&
           !flags.cdataNeedsArgs && !flags.commentNeedsArgs && !flags.doctypeNeedsArgs &&
           !flags.xmlDeclNeedsArgs && !flags.processingInstructionNeedsArgs &&
           !flags.startAttributeNeedsArgs && !flags.errorNeedsArgs &&
           !flags.startXmlDeclAttrNeedsArgs;
}

CollectingSAXDelegator::CollectingSAXDelegator(EventCollector *collector)
    : _collector(collector), _compactRecords(false), _collectStartElementAttrs(false),
      _collectXmlDeclAttrs(false)
{
}

void CollectingSAXDelegator::beginParse(SAXParser *parser)
{
    parser->setEmitEvents(true);
    parser->setEmitPerAttributeEvents(false, false);
    _compactRecords = _collector != nullptr && _collector->compactRecords();
    _collectStartElementAttrs = !_compactRecords && parser->eventNeeds().startElementAttributes;
    _collectXmlDeclAttrs = !_compactRecords && parser->eventNeeds().xmlDeclAttributes;
}

void CollectingSAXDelegator::pushSlice(uint32_t type, const char *data, size_t len)
{
    if (_collector == nullptr || data == nullptr)
        return;

    if (_compactRecords)
    {
        _collector->pushEvent(type, 0, 0);
        return;
    }

    size_t sliceLen = len;
    // xsxml null-terminates comment content but the reported length can be short by 1–2 bytes.
    if (type == kCollectedComment)
    {
        const size_t terminated = std::strlen(data);
        if (terminated > sliceLen)
            sliceLen = terminated;
    }

    _collector->pushEvent(type, _collector->xmlOffset(data), static_cast<uint32_t>(sliceLen));
}

void CollectingSAXDelegator::startDocument(void *ctx)
{
    if (_collector != nullptr)
        _collector->pushEvent(kCollectedStartDocument, 0, 0);
}

void CollectingSAXDelegator::endDocument(void *ctx)
{
    if (_collector != nullptr)
        _collector->pushEvent(kCollectedEndDocument, 0, 0);
}

void CollectingSAXDelegator::startElement(void *ctx, const char *name, size_t nameLen,
                                          const char **attrs)
{
    if (_collector == nullptr)
        return;

    if (_compactRecords)
    {
        _collector->pushEvent(kCollectedStartElement, 0, 0);
        return;
    }

    const uint32_t *lens = nullptr;
    if (_collectStartElementAttrs && ctx != nullptr)
        lens = static_cast<SAXParser *>(ctx)->attrLensData();

    const uint32_t attrOffset =
        _collectStartElementAttrs ? _collector->pushAttributes(attrs, lens) : 0;
    _collector->pushEvent(kCollectedStartElement, _collector->xmlOffset(name),
                          static_cast<uint32_t>(nameLen), attrOffset, 0);
}

void CollectingSAXDelegator::endElement(void *ctx, const char *name, size_t len)
{
    pushSlice(kCollectedEndElement, name, len);
}

void CollectingSAXDelegator::startAttribute(void *ctx, const char *name, size_t nameLen,
                                          const char *value, size_t valueLen)
{
    if (_collector == nullptr)
        return;

    if (_compactRecords)
    {
        _collector->pushEvent(kCollectedStartAttribute, 0, 0);
        return;
    }

    const uint32_t nameOffset = _collector->pushBytes(name, nameLen);
    const uint32_t valueOffset = _collector->pushBytes(value, valueLen);
    _collector->pushEvent(kCollectedStartAttribute, nameOffset, static_cast<uint32_t>(nameLen),
                          valueOffset, static_cast<uint32_t>(valueLen));
}

void CollectingSAXDelegator::endAttribute(void *ctx)
{
    if (_collector != nullptr)
        _collector->pushEvent(kCollectedEndAttribute, 0, 0);
}

void CollectingSAXDelegator::textHandler(void *ctx, const char *s, size_t len)
{
    pushSlice(kCollectedText, s, len);
}

void CollectingSAXDelegator::cdataHandler(void *ctx, const char *s, size_t len)
{
    pushSlice(kCollectedCdata, s, len);
}

void CollectingSAXDelegator::commentHandler(void *ctx, const char *s, size_t len)
{
    pushSlice(kCollectedComment, s, len);
}

void CollectingSAXDelegator::doctypeHandler(void *ctx, const char *s, size_t len)
{
    pushSlice(kCollectedDoctype, s, len);
}

void CollectingSAXDelegator::errorHandler(void *ctx, xsxml::xml_parse_status status, size_t offset)
{
    if (_collector == nullptr)
        return;

    _collector->setError(static_cast<uint32_t>(status), static_cast<uint32_t>(offset));
    if (_compactRecords)
    {
        _collector->pushEvent(kCollectedError, 0, 0);
        return;
    }

    _collector->pushEvent(kCollectedError, static_cast<uint32_t>(status),
                          static_cast<uint32_t>(offset));
}

void CollectingSAXDelegator::startDeclAttr(void *ctx, const char *name, size_t nameLen,
                                         const char *value, size_t valueLen)
{
    startAttribute(ctx, name, nameLen, value, valueLen);
}

void CollectingSAXDelegator::endDeclAttr(void *ctx)
{
    endAttribute(ctx);
}

void CollectingSAXDelegator::xmlDeclarationHandler(void *ctx, const char **attrs)
{
    if (_collector == nullptr)
        return;

    if (_compactRecords)
    {
        _collector->pushEvent(kCollectedXmlDecl, 0, 0);
        return;
    }

    const uint32_t *lens = nullptr;
    if (_collectXmlDeclAttrs && ctx != nullptr)
        lens = static_cast<SAXParser *>(ctx)->attrLensData();

    const uint32_t attrOffset =
        _collectXmlDeclAttrs ? _collector->pushAttributes(attrs, lens) : 0;
    _collector->pushEvent(kCollectedXmlDecl, 0, 0, attrOffset, 0);
}

void CollectingSAXDelegator::piHandler(void *ctx, const char *target, size_t targetLen,
                                     const char *instruction, size_t instructionLen)
{
    if (_collector == nullptr)
        return;

    if (_compactRecords)
    {
        _collector->pushEvent(kCollectedProcessingInstruction, 0, 0);
        return;
    }

    const uint32_t targetOffset = _collector->pushBytes(target, targetLen);
    const uint32_t instructionOffset = _collector->pushBytes(instruction, instructionLen);
    _collector->pushEvent(kCollectedProcessingInstruction, targetOffset,
                          static_cast<uint32_t>(targetLen), instructionOffset,
                          static_cast<uint32_t>(instructionLen));
}

} // namespace saxparser
