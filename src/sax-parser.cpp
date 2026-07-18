#include "sax-parser.h"

#include <algorithm>
#include <cassert>
#include <vector>

#include "../vendor/xsxml/xsxml/no-recursive/xsxml.hpp"
// #include "../vendor/xsxml/xsxml/xsxml.hpp"

namespace saxparser
{
typedef unsigned char XML_CHAR;

namespace
{
const size_t kDefaultBufferSize = 1024;

const uint8_t kLookupWhitespace[256] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, // 0
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 1
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 2
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 3
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 4
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 5
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 6
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 7
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 8
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 9
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // A
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // B
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // C
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // D
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // E
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0  // F
};

// Do not increase nesting for ! ? and / before >
const uint8_t kLookupSkipTag[256] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 1
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, // 2
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, // 3
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 4
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 5
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 6
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 7
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 8
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 9
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // A
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // B
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // C
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // D
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // E
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0  // F
};
} // namespace

/// xsxml SAX2 handler
class SAX2Hander
{
    friend class SAXParser;

public:
    SAX2Hander() : _saxParserImpl(0)
    {
        _curEleAttrs.reserve(64);
        _xmlDeclAttrs.reserve(8);

        _sax3Handler.xml_start_element_cb = [=](char *name, size_t size) {
            _curEleName = xsxml::string_view(name, size);
        };
        _sax3Handler.xml_attr_cb = [=](const char *name, size_t nameLen,
                                       const char *value, size_t valueLen) {
            _curEleAttrs.push_back(name);
            _curEleAttrs.push_back(value);
            SAXParser::startAttribute(_saxParserImpl, (const XML_CHAR *)name, nameLen,
                                      (const XML_CHAR *)value, valueLen);
        };
        _sax3Handler.xml_end_attr_cb = [=]() {
            if (!_curEleAttrs.empty())
            {
                _curEleAttrs.push_back(nullptr);
                SAXParser::startElement(_saxParserImpl,
                                        (const XML_CHAR *)_curEleName.c_str(),
                                        (const XML_CHAR **)&_curEleAttrs[0]);
                _curEleAttrs.clear();
            }
            else
            {
                const char *attr = nullptr;
                const char **attrs = &attr;
                SAXParser::startElement(_saxParserImpl,
                                        (const XML_CHAR *)_curEleName.c_str(),
                                        (const XML_CHAR **)attrs);
            }

            SAXParser::endAttribute(_saxParserImpl);
        };
        _sax3Handler.xml_end_element_cb = [=](const char *name, size_t len) {
            SAXParser::endElement(_saxParserImpl, (const XML_CHAR *)name, len);
        };
        _sax3Handler.xml_text_cb = [=](const char *s, size_t len) {
            SAXParser::textHandler(_saxParserImpl, (const XML_CHAR *)s, len);
        };
        _sax3Handler.xml_cdata_cb = [=](const char *s, size_t len) {
            SAXParser::cdataHandler(_saxParserImpl, (const XML_CHAR *)s, len);
        };
        _sax3Handler.xml_comment_cb = [=](const char *s, size_t len) {
            SAXParser::commentHandler(_saxParserImpl, (const XML_CHAR *)s, len);
        };
        _sax3Handler.xml_start_document_cb = [=]() {
            SAXParser::startDocument(_saxParserImpl);
        };
        _sax3Handler.xml_end_document_cb = [=]() {
            SAXParser::endDocument(_saxParserImpl);
        };
        _sax3Handler.xml_doctype_cb = [=](const char *s, size_t len) {
            SAXParser::doctypeHandler(_saxParserImpl, (const XML_CHAR *)s, len);
        };
        _sax3Handler.xml_error_cb = [=](xsxml::xml_parse_status s, char *offset) {
            SAXParser::errorHandler(_saxParserImpl, s, offset);
        };
        _sax3Handler.xml_decl_attr_cb = [=](const char *name, size_t nameLen, const char *value, size_t valueLen) {
            _xmlDeclAttrs.push_back(name);
            _xmlDeclAttrs.push_back(value);
            SAXParser::startDeclAttr(_saxParserImpl, (const XML_CHAR *)name, nameLen, (const XML_CHAR *)value, valueLen);
        };
        _sax3Handler.xml_end_decl_attr_cb = [=]() {
            if (!_xmlDeclAttrs.empty())
            {
                _xmlDeclAttrs.push_back(nullptr);
                SAXParser::xmlDeclarationHandler(_saxParserImpl, (const XML_CHAR **)&_xmlDeclAttrs[0]);
                _xmlDeclAttrs.clear();
            }
            else
            {
                const char *attr = nullptr;
                const char **attrs = &attr;
                SAXParser::xmlDeclarationHandler(_saxParserImpl, (const XML_CHAR **)attrs);
            }

            SAXParser::endDeclAttr(_saxParserImpl);
        };
        _sax3Handler.xml_pi_cb = [=](const char *target, size_t targetLen, const char *instruction, size_t instructionLen) {
            SAXParser::piHandler(_saxParserImpl, (const XML_CHAR *)target, targetLen, (const XML_CHAR *)instruction, instructionLen);
        };
    };

    void setSAXParserImp(SAXParser *parser) { _saxParserImpl = parser; }

    operator xsxml::xml_sax3_parse_cb *() { return &_sax3Handler; }

private:
    SAXParser *_saxParserImpl;
    xsxml::string_view _curEleName;
    std::vector<const char *> _curEleAttrs;
    std::vector<const char *> _xmlDeclAttrs;
    xsxml::xml_sax3_parse_cb _sax3Handler;
};

SAXParser::SAXParser()
    : _delegator(nullptr),
      _processRoot(true),
      _documentStarted(false),
      _documentEnded(false),
      _suppressDocumentEvents(false),
      _nestedLevel(-1),
      _firstStartTagIndex(-1),
      _lastStartTagIndex(-1)
{
}

SAXParser::~SAXParser() {}

bool SAXParser::init(const char * /*encoding*/)
{
    return true;
}

void SAXParser::resetStreamState()
{
    _buffer.clear();
    _buffer.shrink_to_fit();
    if (_buffer.capacity() < kDefaultBufferSize)
        _buffer.reserve(kDefaultBufferSize);

    _processRoot = true;
    _documentStarted = false;
    _documentEnded = false;
    _suppressDocumentEvents = false;
    _nestedLevel = -1;
    _firstStartTagIndex = -1;
    _lastStartTagIndex = -1;
}

bool SAXParser::parse(const char *xmlData, size_t dataLength)
{
    resetStreamState();

    if (xmlData == nullptr || dataLength == 0)
        return false;

    std::string mutableData(xmlData, dataLength);
    return parseIntrusive(&mutableData.front(), dataLength);
}

bool SAXParser::feed(const char *xmlData, size_t dataLength, bool flush)
{
    if (xmlData != nullptr && dataLength > 0)
        _buffer.append(xmlData, dataLength);

    if (_buffer.empty())
    {
        if (flush && !_documentEnded && _delegator != nullptr)
        {
            if (!_documentStarted)
                startDocument(this);

            endDocument(this);
            _documentEnded = true;
            resetStreamState();
        }
        return true;
    }

    if (flush)
    {
        std::string parseBuf = _buffer;
        if (parseIntrusive(&parseBuf.front(), parseBuf.size()))
        {
            resetStreamState();
            return true;
        }
    }
    else if (!_processRoot)
    {
        FeedResult result = processBuffer(0, _buffer.size(), false);

        if (result == kFeedInvalidXml)
        {
            resetStreamState();
            return false;
        }

        if (_buffer.capacity() > kDefaultBufferSize && _buffer.size() < kDefaultBufferSize)
            _buffer.shrink_to_fit();

        return true;
    }

    if (flush)
    {
        FeedResult result = processBuffer(0, _buffer.size(), true);

        if (result == kFeedInvalidXml || !_buffer.empty())
        {
            resetStreamState();
            return false;
        }

        resetStreamState();
    }

    return true;
}

ptrdiff_t SAXParser::findStanzaUpperLimit(const char *ptr, size_t start, size_t end)
{
    size_t index = start;

    if (_lastStartTagIndex == -1)
    {
        while (index < end && kLookupWhitespace[static_cast<uint8_t>(ptr[index])])
            index++;

        if (index < end && ptr[index] != '<')
            return -1;
    }

    for (; index < end; index++)
    {
        switch (ptr[index])
        {
        case '<':
            if (_firstStartTagIndex == -1)
                _firstStartTagIndex = static_cast<ptrdiff_t>(index);

            _lastStartTagIndex = static_cast<ptrdiff_t>(index);
            break;

        case '>':
            if (_lastStartTagIndex == -1)
                return -1;

            if (ptr[_lastStartTagIndex + 1] == '/')
            {
                _nestedLevel--;
            }
            else if (kLookupSkipTag[static_cast<uint8_t>(ptr[index - 1])] == 0)
            {
                _nestedLevel++;
            }

            if (_nestedLevel == 0)
                return static_cast<ptrdiff_t>(index);

            break;
        }
    }

    return static_cast<ptrdiff_t>(index);
}

bool SAXParser::parseStanza(char *xmlData, size_t dataLength, bool isRoot)
{
    SAX2Hander handler;
    handler.setSAXParserImp(this);

    _suppressDocumentEvents = !isRoot;

    unsigned int options = xsxml::parse_full;
    if (!isRoot)
        options |= xsxml::parse_fragment;

    xsxml::xml_parse_result result =
        xsxml::xml_sax3_parser::parse(xmlData, dataLength, handler, options);

    _suppressDocumentEvents = false;

    return static_cast<bool>(result);
}

bool SAXParser::processRootElement(char *buffer, size_t length)
{
    if (length == 0)
        return false;

    std::string rootStanza(buffer, buffer + length - 1);
    rootStanza.append("/>");

    if (!parseStanza(&rootStanza.front(), rootStanza.size(), true))
        return false;

    _processRoot = false;
    _lastStartTagIndex = -1;
    _firstStartTagIndex = -1;
    return true;
}

bool SAXParser::pushStanza(char *buffer, size_t length)
{
    if (_processRoot)
        return processRootElement(buffer, length);

    if (_firstStartTagIndex < 0 || length == 0)
        return false;

    const char tagKind = buffer[_firstStartTagIndex + 1];
    if (!kLookupSkipTag[static_cast<uint8_t>(tagKind)])
    {
        if (!parseStanza(buffer, length, false))
            return false;
    }
    else if (tagKind == '?')
    {
        if (!parseStanza(buffer, length, true))
            return false;
    }

    _lastStartTagIndex = -1;
    _firstStartTagIndex = -1;
    assert(_nestedLevel == 0);
    return true;
}

SAXParser::FeedResult SAXParser::processBuffer(size_t start, size_t end, bool flush)
{
    const char *ptr = _buffer.c_str();
    ptrdiff_t endStanzaIndex = findStanzaUpperLimit(ptr, start, end);

    if (endStanzaIndex == -1)
        return kFeedInvalidXml;

    size_t endStanzaPos = static_cast<size_t>(endStanzaIndex);

    if (endStanzaPos == end)
    {
        if (_nestedLevel == -1 && !_processRoot && flush)
        {
            if (!_documentEnded)
            {
                endDocument(this);
                _documentEnded = true;
            }
            return kFeedOk;
        }

        return kFeedOk;
    }

    endStanzaPos++;

    std::string stanza(_buffer, 0, endStanzaPos);
    if (!pushStanza(&stanza.front(), stanza.size()))
        return kFeedInvalidXml;

    _buffer.erase(0, endStanzaPos);

    if (!_buffer.empty())
        return processBuffer(0, _buffer.size(), flush);

    return kFeedOk;
}

bool SAXParser::parseIntrusive(char *xmlData, size_t dataLength)
{
    return parseStanza(xmlData, dataLength, true);
}

void SAXParser::startElement(void *ctx, const XML_CHAR *name,
                             const XML_CHAR **attrs)
{
    ((SAXParser *)(ctx))
        ->_delegator->startElement(ctx, (char *)name, (const char **)attrs);
}
void SAXParser::endElement(void *ctx, const XML_CHAR *name, size_t len)
{
    ((SAXParser *)(ctx))->_delegator->endElement(ctx, (char *)name, len);
}
void SAXParser::textHandler(void *ctx, const XML_CHAR *text, size_t len)
{
    ((SAXParser *)(ctx))->_delegator->textHandler(ctx, (char *)text, len);
}
void SAXParser::startAttribute(void *ctx, const XML_CHAR *name, size_t nameLen,
                               const XML_CHAR *value, size_t valueLen)
{
    ((SAXParser *)(ctx))
        ->_delegator->startAttribute(ctx, (char *)name, nameLen, (char *)value,
                                     valueLen);
}
void SAXParser::endAttribute(void *ctx)
{
    ((SAXParser *)(ctx))->_delegator->endAttribute(ctx);
}
void SAXParser::cdataHandler(void *ctx, const XML_CHAR *cdata, size_t len)
{
    ((SAXParser *)(ctx))->_delegator->cdataHandler(ctx, (char *)cdata, len);
}
void SAXParser::commentHandler(void *ctx, const XML_CHAR *comment, size_t len)
{
    ((SAXParser *)(ctx))->_delegator->commentHandler(ctx, (char *)comment, len);
}
void SAXParser::startDocument(void *ctx)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (parser->_suppressDocumentEvents)
        return;

    if (!parser->_documentStarted)
    {
        parser->_documentStarted = true;
        parser->_delegator->startDocument(ctx);
    }
}
void SAXParser::endDocument(void *ctx)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (parser->_suppressDocumentEvents || parser->_documentEnded)
        return;

    parser->_documentEnded = true;
    parser->_delegator->endDocument(ctx);
}
void SAXParser::doctypeHandler(void *ctx, const XML_CHAR *doctype, size_t len)
{
    ((SAXParser *)(ctx))->_delegator->doctypeHandler(ctx, (char *)doctype, len);
}
void SAXParser::errorHandler(void *ctx, xsxml::xml_parse_status s,
                             char *offset)
{
    ((SAXParser *)(ctx))->_delegator->errorHandler(ctx, s, offset);
}
void SAXParser::startDeclAttr(void *ctx, const XML_CHAR *name, size_t nameLen, const XML_CHAR *value, size_t valueLen)
{
    ((SAXParser *)(ctx))->_delegator->startDeclAttr(ctx, (char *)name, nameLen, (char *)value, valueLen);
}
void SAXParser::endDeclAttr(void *ctx)
{
    ((SAXParser *)(ctx))->_delegator->endDeclAttr(ctx);
}
void SAXParser::xmlDeclarationHandler(void *ctx, const XML_CHAR **attrs)
{
    ((SAXParser *)(ctx))->_delegator->xmlDeclarationHandler(ctx, (const char **)attrs);
}
void SAXParser::piHandler(void *ctx, const XML_CHAR *target, size_t targetLen, const XML_CHAR *instruction, size_t instructionLen)
{
    ((SAXParser *)(ctx))->_delegator->piHandler(ctx, (char *)target, targetLen, (char *)instruction, instructionLen);
}
void SAXParser::setDelegator(SAXDelegator *delegator)
{
    _delegator = delegator;
}

} // namespace saxparser
