#ifndef SAX_PARSER_EVENT_COLLECTOR_H
#define SAX_PARSER_EVENT_COLLECTOR_H

#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

#include "sax-parser.h"

namespace saxparser
{

enum CollectedEventType : uint32_t
{
    kCollectedStartDocument = 1,
    kCollectedEndDocument = 2,
    kCollectedStartElement = 3,
    kCollectedEndElement = 4,
    kCollectedText = 5,
    kCollectedCdata = 6,
    kCollectedComment = 7,
    kCollectedDoctype = 8,
    kCollectedError = 9,
    kCollectedStartAttribute = 10,
    kCollectedEndAttribute = 11,
    kCollectedXmlDecl = 12,
    kCollectedProcessingInstruction = 13,
};

enum CollectedRecord
{
    kCollectedRecordBytes = 20,
    kCompactRecordBytes = 4,
};

class EventCollector
{
public:
    static constexpr size_t kDefaultBatchSize = 1000;

    using BatchCallback = std::function<void()>;

    void clear();
    void setXmlBase(const char *base) { _xmlBase = base; }
    void setCompactRecords(bool compact) { _compactRecords = compact; }
    bool compactRecords() const { return _compactRecords; }

    void setBatchCallback(BatchCallback callback, size_t batchSize = kDefaultBatchSize);
    void clearBatchCallback();

    void reserve(size_t recordBytes, size_t auxBytes);

    void pushEvent(uint32_t type, uint32_t arg0, uint32_t arg1, uint32_t arg2 = 0,
                   uint32_t arg3 = 0);
    uint32_t pushBytes(const void *data, size_t len);
    uint32_t pushAttributes(const char **attrs);

    uint32_t xmlOffset(const char *ptr) const;

    const std::vector<uint8_t> &records() const { return _records; }
    const std::vector<uint8_t> &aux() const { return _aux; }
    size_t eventCount() const { return _eventCount; }

    void releaseInto(std::vector<uint8_t> &records, std::vector<uint8_t> &aux, size_t &eventCount);

    void setError(uint32_t code, uint32_t offset);
    uint32_t errorCode() const { return _errorCode; }
    uint32_t errorOffset() const { return _errorOffset; }
    bool hasError() const { return _errorCode != 0; }

private:
    std::vector<uint8_t> _records;
    std::vector<uint8_t> _aux;
    size_t _eventCount;
    const char *_xmlBase;
    uint32_t _errorCode;
    uint32_t _errorOffset;
    bool _compactRecords;
    BatchCallback _batchCallback;
    size_t _batchSize;

    void writeU32(std::vector<uint8_t> &buf, uint32_t value);
    void maybeFlushBatch();
};

class CollectingSAXDelegator : public SAXDelegator
{
public:
    explicit CollectingSAXDelegator(EventCollector *collector);

    void beginParse(SAXParser *parser);

    void startElement(void *ctx, const char *name, const char **attrs) override;
    void endElement(void *ctx, const char *name, size_t len) override;
    void startAttribute(void *ctx, const char *name, size_t nameLen,
                        const char *value, size_t valueLen) override;
    void endAttribute(void *ctx) override;
    void textHandler(void *ctx, const char *s, size_t len) override;
    void cdataHandler(void *ctx, const char *s, size_t len) override;
    void commentHandler(void *ctx, const char *s, size_t len) override;
    void startDocument(void *ctx) override;
    void endDocument(void *ctx) override;
    void doctypeHandler(void *ctx, const char *s, size_t len) override;
    void errorHandler(void *ctx, xsxml::xml_parse_status, size_t offset) override;
    void startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen) override;
    void endDeclAttr(void *ctx) override;
    void xmlDeclarationHandler(void *ctx, const char **attrs) override;
    void piHandler(void *ctx, const char *target, size_t targetLen,
                   const char *instruction, size_t instructionLen) override;

private:
    EventCollector *_collector;
    bool _compactRecords;
    bool _collectStartElementAttrs;
    bool _collectXmlDeclAttrs;

    void pushSlice(uint32_t type, const char *data, size_t len);
};

struct ListenerFlags
{
    bool hasAnyListeners;
    bool startElement;
    bool startElementNeedsArgs;
    bool endElement;
    bool endElementNeedsArgs;
    bool startAttribute;
    bool startAttributeNeedsArgs;
    bool endAttribute;
    bool text;
    bool textNeedsArgs;
    bool cdata;
    bool cdataNeedsArgs;
    bool comment;
    bool commentNeedsArgs;
    bool startDocument;
    bool endDocument;
    bool end;
    bool finish;
    bool done;
    bool doctype;
    bool doctypeNeedsArgs;
    bool error;
    bool errorNeedsArgs;
    bool startXmlDeclAttr;
    bool startXmlDeclAttrNeedsArgs;
    bool endXmlDeclAttr;
    bool xmlDecl;
    bool xmlDeclNeedsArgs;
    bool processingInstruction;
    bool processingInstructionNeedsArgs;
};

SAXEventNeeds eventNeedsFromFlags(const ListenerFlags &flags);
bool useCompactRecords(const ListenerFlags &flags);

} // namespace saxparser

#endif
