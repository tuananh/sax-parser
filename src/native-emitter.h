#include <memory>
#include <napi.h>

#include "sax-parser.h"

class MySAXDelegator : public saxparser::SAXDelegator
{
public:
    explicit MySAXDelegator(Napi::ObjectReference jsThis);
    ~MySAXDelegator();

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
    void errorHandler(void *ctx, xsxml::xml_parse_status, char *) override;
    void startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen) override;
    void endDeclAttr(void *ctx) override;
    void xmlDeclarationHandler(void *ctx, const char **attrs) override;
    void piHandler(void *ctx, const char *target, size_t, const char *instruction, size_t) override;

private:
    Napi::ObjectReference _jsThis;

    Napi::Function getEmit();
    void emitEvent(std::string eventName);
    void emitEvent(std::string eventName, std::string data);
    void emitEvent(std::string eventName, Napi::Object obj);
    void emitEvent(std::string eventName, std::string name, Napi::Object obj);
};

class SaxParser : public Napi::ObjectWrap<SaxParser>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    SaxParser(const Napi::CallbackInfo &info);
    ~SaxParser();

private:
    static Napi::FunctionReference constructor;

    std::unique_ptr<saxparser::SAXParser> _parser;
    std::unique_ptr<MySAXDelegator> _delegator;

    void Parse(const Napi::CallbackInfo &info);
    void Feed(const Napi::CallbackInfo &info);
};
