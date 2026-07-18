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
            if (_saxParserImpl->emitPerAttributeEvents())
            {
                SAXParser::startAttribute(_saxParserImpl, (const XML_CHAR *)name, nameLen,
                                          (const XML_CHAR *)value, valueLen);
            }
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

            if (_saxParserImpl->emitEndAttributeEvent())
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
      _documentStarted(false),
      _documentEnded(false),
      _suppressDocumentEvents(false),
      _emitPerAttributeEvents(false),
      _emitEndAttributeEvent(false),
      _emitEvents(true),
      _saxHandler(new SAX2Hander())
{
    _saxHandler->setSAXParserImp(this);
}

SAXParser::~SAXParser() { delete _saxHandler; }

bool SAXParser::init(const char * /*encoding*/)
{
    return true;
}

void SAXParser::resetStreamState()
{
    _buffer.clear();
    if (_buffer.capacity() < kDefaultBufferSize)
        _buffer.reserve(kDefaultBufferSize);

    _documentStarted = false;
    _documentEnded = false;
    _suppressDocumentEvents = false;
}

bool SAXParser::parse(const char *xmlData, size_t dataLength)
{
    if (xmlData == nullptr || dataLength == 0)
        return false;

    _parseBuffer.assign(xmlData, dataLength);
    return parseMutable(&_parseBuffer.front(), _parseBuffer.size());
}

bool SAXParser::parseMutable(char *xmlData, size_t dataLength)
{
    resetStreamState();

    if (xmlData == nullptr || dataLength == 0)
        return false;

    return parseIntrusive(xmlData, dataLength);
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

    if (!flush)
        return true;

    const bool ok = parseIntrusive(&_buffer.front(), _buffer.size());
    resetStreamState();
    return ok;
}

bool SAXParser::parseStanza(char *xmlData, size_t dataLength, bool isRoot)
{
    _suppressDocumentEvents = !isRoot;

    unsigned int options = xsxml::parse_full;
    if (!isRoot)
        options |= xsxml::parse_fragment;

    xsxml::xml_parse_result result =
        xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength), *_saxHandler, options);

    _suppressDocumentEvents = false;

    return static_cast<bool>(result);
}

bool SAXParser::parseIntrusive(char *xmlData, size_t dataLength)
{
    return parseStanza(xmlData, dataLength, true);
}

void SAXParser::startElement(void *ctx, const XML_CHAR *name,
                             const XML_CHAR **attrs)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->startElement(ctx, (char *)name, (const char **)attrs);
}
void SAXParser::endElement(void *ctx, const XML_CHAR *name, size_t len)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->endElement(ctx, (char *)name, len);
}
void SAXParser::textHandler(void *ctx, const XML_CHAR *text, size_t len)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->textHandler(ctx, (char *)text, len);
}
void SAXParser::startAttribute(void *ctx, const XML_CHAR *name, size_t nameLen,
                               const XML_CHAR *value, size_t valueLen)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->startAttribute(ctx, (char *)name, nameLen, (char *)value,
                                         valueLen);
}
void SAXParser::endAttribute(void *ctx)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->endAttribute(ctx);
}
void SAXParser::cdataHandler(void *ctx, const XML_CHAR *cdata, size_t len)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->cdataHandler(ctx, (char *)cdata, len);
}
void SAXParser::commentHandler(void *ctx, const XML_CHAR *comment, size_t len)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->commentHandler(ctx, (char *)comment, len);
}
void SAXParser::startDocument(void *ctx)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (parser->_suppressDocumentEvents || !parser->_emitEvents || parser->_delegator == nullptr)
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
    if (parser->_suppressDocumentEvents || parser->_documentEnded || !parser->_emitEvents ||
        parser->_delegator == nullptr)
        return;

    parser->_documentEnded = true;
    parser->_delegator->endDocument(ctx);
}
void SAXParser::doctypeHandler(void *ctx, const XML_CHAR *doctype, size_t len)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->doctypeHandler(ctx, (char *)doctype, len);
}
void SAXParser::errorHandler(void *ctx, xsxml::xml_parse_status s,
                             char *offset)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->errorHandler(ctx, s, offset);
}
void SAXParser::startDeclAttr(void *ctx, const XML_CHAR *name, size_t nameLen, const XML_CHAR *value, size_t valueLen)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->startDeclAttr(ctx, (char *)name, nameLen, (char *)value, valueLen);
}
void SAXParser::endDeclAttr(void *ctx)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->endDeclAttr(ctx);
}
void SAXParser::xmlDeclarationHandler(void *ctx, const XML_CHAR **attrs)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->xmlDeclarationHandler(ctx, (const char **)attrs);
}
void SAXParser::piHandler(void *ctx, const XML_CHAR *target, size_t targetLen, const XML_CHAR *instruction, size_t instructionLen)
{
    SAXParser *parser = (SAXParser *)ctx;
    if (!parser->_emitEvents || parser->_delegator == nullptr)
        return;

    parser->_delegator->piHandler(ctx, (char *)target, targetLen, (char *)instruction, instructionLen);
}
void SAXParser::setDelegator(SAXDelegator *delegator)
{
    _delegator = delegator;
}

void SAXParser::setEmitPerAttributeEvents(bool emitAttributes, bool emitEndAttribute)
{
    _emitPerAttributeEvents = emitAttributes;
    _emitEndAttributeEvent = emitEndAttribute;
}

void SAXParser::setEmitEvents(bool emitEvents)
{
    _emitEvents = emitEvents;
}

} // namespace saxparser
