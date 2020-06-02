#include <vector> // because its based on windows 8 build :P
#include "sax-parser.h"
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

            _sax3Handler.xml_start_element_cb = [=](char *name, size_t size) {
                _curEleName = xsxml::string_view(name, size);
            };
            _sax3Handler.xml_attr_cb = [=](const char *name, size_t nameLen,
                                           const char *value, size_t valueLen) {
                _curEleAttrs.push_back(name);
                _curEleAttrs.push_back(value);
                SAXParser::startAttribute(_saxParserImpl, (const XML_CHAR *)name, nameLen, (const XML_CHAR *)value, valueLen);
            };
            _sax3Handler.xml_end_attr_cb = [=]() {
                SAXParser::endAttribute(_saxParserImpl);
            };
            _sax3Handler.xml_end_attr_cb = [=]() {
                if (!_curEleAttrs.empty())
                {
                    _curEleAttrs.push_back(nullptr);
                    SAXParser::startElement(_saxParserImpl, (const XML_CHAR *)_curEleName.c_str(), (const XML_CHAR **)&_curEleAttrs[0]);
                    _curEleAttrs.clear();
                }
                else
                {
                    const char *attr = nullptr;
                    const char **attrs = &attr;
                    SAXParser::startElement(_saxParserImpl, (const XML_CHAR *)_curEleName.c_str(), (const XML_CHAR **)attrs);
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
        };

        void setSAXParserImp(SAXParser *parser)
        {
            _saxParserImpl = parser;
        }

        operator xsxml::xml_sax3_parse_cb *()
        {
            return &_sax3Handler;
        }

    private:
        SAXParser *_saxParserImpl;
        xsxml::string_view _curEleName;
        std::vector<const char *> _curEleAttrs;
        xsxml::xml_sax3_parse_cb _sax3Handler;
    };

    SAXParser::SAXParser()
    {
        _delegator = nullptr;
    }

    SAXParser::~SAXParser()
    {
    }

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

        xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength), handler);
        return true;

        // TODO(anh): introduce parse_error in no-recursive implementation as well
        
        // try
        // {
        //     xsxml::xml_sax3_parser::parse(xmlData, static_cast<int>(dataLength), handler);
        //     return true;
        // }
        // catch (xsxml::parse_error &e)
        // {
        //     // TODO(anh): replace this with sth else
        //     // CCLOG("cocos2d: SAXParser: Error parsing xml: %s at %s", e.what(), e.where<char>());
        //     return false;
        // }

        // return false;
    }

    void SAXParser::startElement(void *ctx, const XML_CHAR *name, const XML_CHAR **atts)
    {
        ((SAXParser *)(ctx))->_delegator->startElement(ctx, (char *)name, (const char **)atts);
    }
    void SAXParser::endElement(void *ctx, const XML_CHAR *name, size_t len)
    {
        ((SAXParser *)(ctx))->_delegator->endElement(ctx, (char *)name, len);
    }
    void SAXParser::textHandler(void *ctx, const XML_CHAR *text, size_t len)
    {
        ((SAXParser *)(ctx))->_delegator->textHandler(ctx, (char *)text, len);
    }
    void SAXParser::startAttribute(void *ctx, const XML_CHAR *name, size_t nameLen, const XML_CHAR *value, size_t valueLen)
    {
        ((SAXParser *)(ctx))->_delegator->startAttribute(ctx, (char *)name, nameLen, (char *) value, valueLen);
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
    void SAXParser::setDelegator(SAXDelegator *delegator)
    {
        _delegator = delegator;
    }

} // namespace saxparser
