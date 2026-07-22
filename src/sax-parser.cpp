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

/// xsxml SAX2 handler — function-pointer callbacks (no std::function / heap).
class SAX2Hander
{
    friend class SAXParser;

public:
    SAX2Hander() : _saxParserImpl(nullptr)
    {
        _curEleAttrs.reserve(64);
        _xmlDeclAttrs.reserve(8);

        _sax3Handler.user = this;
        _sax3Handler.xml_start_element_cb = &SAX2Hander::onStartElement;
        _sax3Handler.xml_attr_cb = &SAX2Hander::onAttr;
        _sax3Handler.xml_end_attr_cb = &SAX2Hander::onEndAttr;
        _sax3Handler.xml_end_element_cb = &SAX2Hander::onEndElement;
        _sax3Handler.xml_text_cb = &SAX2Hander::onText;
        _sax3Handler.xml_cdata_cb = &SAX2Hander::onCdata;
        _sax3Handler.xml_comment_cb = &SAX2Hander::onComment;
        _sax3Handler.xml_start_document_cb = &SAX2Hander::onStartDocument;
        _sax3Handler.xml_end_document_cb = &SAX2Hander::onEndDocument;
        _sax3Handler.xml_doctype_cb = &SAX2Hander::onDoctype;
        _sax3Handler.xml_error_cb = &SAX2Hander::onError;
        _sax3Handler.xml_decl_attr_cb = &SAX2Hander::onDeclAttr;
        _sax3Handler.xml_end_decl_attr_cb = &SAX2Hander::onEndDeclAttr;
        _sax3Handler.xml_pi_cb = &SAX2Hander::onPi;
    }

    void setSAXParserImp(SAXParser *parser) { _saxParserImpl = parser; }

    size_t currentElementNameLength() const { return _curEleName.length(); }

    operator xsxml::xml_sax3_parse_cb *() { return &_sax3Handler; }

private:
    static SAX2Hander *self(void *user) { return static_cast<SAX2Hander *>(user); }

    static void onStartElement(void *user, char *name, size_t size)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().startElement)
            return;
        h->_curEleName = xsxml::string_view(name, size);
    }

    static void onAttr(void *user, const char *name, size_t nameLen, const char *value,
                       size_t valueLen)
    {
        SAX2Hander *h = self(user);
        SAXParser *parser = h->_saxParserImpl;
        if (parser->emitPerAttributeEvents())
        {
            SAXParser::startAttribute(parser, (const XML_CHAR *)name, nameLen,
                                      (const XML_CHAR *)value, valueLen);
        }
        if (!parser->needsElementAttributes())
            return;

        h->_curEleAttrs.push_back(name);
        h->_curEleAttrs.push_back(value);
        parser->pushAttrLens(static_cast<uint32_t>(nameLen), static_cast<uint32_t>(valueLen));
    }

    static void onEndAttr(void *user)
    {
        SAX2Hander *h = self(user);
        SAXParser *parser = h->_saxParserImpl;
        if (parser->eventNeeds().startElement)
        {
            if (!h->_curEleAttrs.empty())
            {
                h->_curEleAttrs.push_back(nullptr);
                SAXParser::startElement(parser, (const XML_CHAR *)h->_curEleName.c_str(),
                                        (const XML_CHAR **)&h->_curEleAttrs[0]);
                h->_curEleAttrs.clear();
            }
            else
            {
                const char *attr = nullptr;
                const char **attrs = &attr;
                SAXParser::startElement(parser, (const XML_CHAR *)h->_curEleName.c_str(),
                                        (const XML_CHAR **)attrs);
            }
            parser->clearAttrLens();
        }
        else
        {
            h->_curEleAttrs.clear();
            parser->clearAttrLens();
        }

        if (parser->emitEndAttributeEvent())
            SAXParser::endAttribute(parser);
    }

    static void onEndElement(void *user, const char *name, size_t len)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().endElement)
            return;
        SAXParser::endElement(h->_saxParserImpl, (const XML_CHAR *)name, len);
    }

    static void onText(void *user, const char *s, size_t len)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().text)
            return;
        SAXParser::textHandler(h->_saxParserImpl, (const XML_CHAR *)s, len);
    }

    static void onCdata(void *user, const char *s, size_t len)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().cdata)
            return;
        SAXParser::cdataHandler(h->_saxParserImpl, (const XML_CHAR *)s, len);
    }

    static void onComment(void *user, const char *s, size_t len)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().comment)
            return;
        SAXParser::commentHandler(h->_saxParserImpl, (const XML_CHAR *)s, len);
    }

    static void onStartDocument(void *user)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().startDocument)
            return;
        SAXParser::startDocument(h->_saxParserImpl);
    }

    static void onEndDocument(void *user)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().endDocument)
            return;
        SAXParser::endDocument(h->_saxParserImpl);
    }

    static void onDoctype(void *user, const char *s, size_t len)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().doctype)
            return;
        SAXParser::doctypeHandler(h->_saxParserImpl, (const XML_CHAR *)s, len);
    }

    static void onError(void *user, xsxml::xml_parse_status s, char *offset)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().error)
            return;
        SAXParser::errorHandler(h->_saxParserImpl, s, offset);
    }

    static void onDeclAttr(void *user, const char *name, size_t nameLen, const char *value,
                           size_t valueLen)
    {
        SAX2Hander *h = self(user);
        SAXParser *parser = h->_saxParserImpl;
        if (parser->eventNeeds().startXmlDeclAttr)
        {
            SAXParser::startDeclAttr(parser, (const XML_CHAR *)name, nameLen,
                                     (const XML_CHAR *)value, valueLen);
        }
        if (!parser->needsXmlDeclAttributes())
            return;

        h->_xmlDeclAttrs.push_back(name);
        h->_xmlDeclAttrs.push_back(value);
        parser->pushAttrLens(static_cast<uint32_t>(nameLen), static_cast<uint32_t>(valueLen));
    }

    static void onEndDeclAttr(void *user)
    {
        SAX2Hander *h = self(user);
        SAXParser *parser = h->_saxParserImpl;
        if (parser->eventNeeds().xmlDecl)
        {
            if (!h->_xmlDeclAttrs.empty())
            {
                h->_xmlDeclAttrs.push_back(nullptr);
                SAXParser::xmlDeclarationHandler(parser, (const XML_CHAR **)&h->_xmlDeclAttrs[0]);
                h->_xmlDeclAttrs.clear();
            }
            else
            {
                const char *attr = nullptr;
                const char **attrs = &attr;
                SAXParser::xmlDeclarationHandler(parser, (const XML_CHAR **)attrs);
            }
            parser->clearAttrLens();
        }
        else
        {
            h->_xmlDeclAttrs.clear();
            parser->clearAttrLens();
        }

        if (parser->eventNeeds().endXmlDeclAttr)
            SAXParser::endDeclAttr(parser);
    }

    static void onPi(void *user, const char *target, size_t targetLen, const char *instruction,
                     size_t instructionLen)
    {
        SAX2Hander *h = self(user);
        if (!h->_saxParserImpl->eventNeeds().processingInstruction)
            return;
        SAXParser::piHandler(h->_saxParserImpl, (const XML_CHAR *)target, targetLen,
                             (const XML_CHAR *)instruction, instructionLen);
    }

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
      _saxHandler(new SAX2Hander()),
      _parseBase(nullptr)
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
    _parseBase = xmlData;
    _suppressDocumentEvents = !isRoot;

    unsigned int options = xsxml::parse_full;
    if (!isRoot)
        options |= xsxml::parse_fragment;

    xsxml::xml_parse_result result =
        xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength), *_saxHandler, options);

    _parseBase = nullptr;
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

    const size_t nameLen = parser->_saxHandler->currentElementNameLength();
    parser->_delegator->startElement(ctx, (char *)name, nameLen, (const char **)attrs);
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

    size_t byteOffset = 0;
    if (parser->_parseBase != nullptr && offset != nullptr)
        byteOffset = static_cast<size_t>(offset - parser->_parseBase);

    parser->_delegator->errorHandler(ctx, s, byteOffset);
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

void SAXParser::setEventNeeds(const SAXEventNeeds &needs)
{
    _eventNeeds = needs;
}

} // namespace saxparser
