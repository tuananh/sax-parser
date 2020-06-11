#include "sax-parser.h"

#include <vector>

#include "../vendor/xsxml/xsxml/no-recursive/xsxml.hpp"
// #include "../vendor/xsxml/xsxml/xsxml.hpp"

namespace saxparser
{
typedef unsigned char XML_CHAR;

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

SAXParser::SAXParser() { _delegator = nullptr; }

SAXParser::~SAXParser() {}

bool SAXParser::init(const char * /*encoding*/)
{
    // nothing to do
    return true;
}

bool SAXParser::parse(const char *xmlData, size_t dataLength)
{
    if (xmlData != nullptr && dataLength > 0)
    {
        std::string mutableData(xmlData, dataLength);
        return this->parseIntrusive(&mutableData.front(), dataLength);
    }
    return false;
}

bool SAXParser::parseIntrusive(char *xmlData, size_t dataLength)
{
    SAX2Hander handler;
    handler.setSAXParserImp(this);

    xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength), handler, xsxml::parse_full);
    return true;

    // TODO(anh): introduce parse_error in no-recursive implementation as well

    // try
    // {
    //     xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength),
    //     handler); return true;
    // }
    // catch (xsxml::parse_error &e)
    // {
    //     // TODO(anh): replace this with sth else
    //     // CCLOG("cocos2d: SAXParser: Error parsing xml: %s at %s", e.what(),
    //     e.where<char>()); return false;
    // }

    // return false;
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
    ((SAXParser *)(ctx))->_delegator->startDocument(ctx);
}
void SAXParser::endDocument(void *ctx)
{
    ((SAXParser *)(ctx))->_delegator->endDocument(ctx);
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
