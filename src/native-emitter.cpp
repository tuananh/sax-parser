#include "native-emitter.h"

#include <iostream>
#include <string>

#include "sax-parser.h"

using namespace saxparser;

Napi::FunctionReference SaxParser::constructor;

Napi::Object SaxParser::Init(Napi::Env env, Napi::Object exports)
{
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(
        env, "SaxParser", {InstanceMethod("parse", &SaxParser::Parse)});

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("SaxParser", func);
    return exports;
}

SaxParser::SaxParser(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<SaxParser>(info)
{
    // NOOP
}

inline std::string ParseStatusToString(xsxml::xml_parse_status s)
{
    switch (s)
    {
    case xsxml::xml_parse_status::status_io_error:
        return "ERR_IO";
    case xsxml::xml_parse_status::status_out_of_memory:
        return "ERR_OUT_OF_MEMORY";
    case xsxml::xml_parse_status::status_internal_error:
        return "ERR_INTERAL";
    case xsxml::xml_parse_status::status_unrecognized_tag:
        return "ERR_UNRECOGNIZE_TAG";
    case xsxml::xml_parse_status::status_bad_pi:
        return "ERR_BAD_PI";
    case xsxml::xml_parse_status::status_bad_comment:
        return "ERR_BAD_COMMENT";
    case xsxml::xml_parse_status::status_bad_cdata:
        return "ERR_BAD_CDATA";
    case xsxml::xml_parse_status::status_bad_doctype:
        return "ERR_BAD_DOCTYPE";
    case xsxml::xml_parse_status::status_bad_pcdata:
        return "ERR_BAD_PCDATA";
    case xsxml::xml_parse_status::status_bad_start_element:
        return "ERR_BAD_START_ELEMENT";
    case xsxml::xml_parse_status::status_bad_attribute:
        return "ERR_BAD_ATTRIBUTE";
    case xsxml::xml_parse_status::status_bad_end_element:
        return "ERR_BAD_END_ELEMENT";
    case xsxml::xml_parse_status::status_end_element_mismatch:
        return "ERR_END_ELEMENT_MISMATCH";
    case xsxml::xml_parse_status::status_append_invalid_root:
        return "ERR_APPEND_INVALID_ROOT";
    case xsxml::xml_parse_status::status_no_document_element:
        return "ERR_NO_DOCUMENT_ELEMENT";
    case xsxml::xml_parse_status::status_bad_decl:
        return "ERR_BAD_XML_DECLARATION";
    case xsxml::xml_parse_status::status_ok:
        return "OK"; // should not get here
    default:
        return "ERR_UNKNOWN";
    }
}
class MySAXDelegator : public SAXDelegator
{
public:
    MySAXDelegator(const Napi::CallbackInfo *info)
    {
        _cbInfo = info;
        _env = info->Env();
        _emit = info->This().As<Napi::Object>().Get("emit").As<Napi::Function>();
    }

    ~MySAXDelegator()
    {
        _cbInfo = nullptr;
        _env = nullptr;
    }

    void startElement(void *ctx, const char *name, const char **atts)
    {
        Napi::Object attribs = Napi::Object::New(_env);
        while (*atts != nullptr)
        {
            const char *name = *atts++;
            const char *val = *atts++;
            attribs.Set(name, val);
        }

        this->emitEvent("startElement", std::string(name), attribs);
    }
    void endElement(void *ctx, const char *name, size_t len)
    {
        this->emitEvent("endElement", std::string(name, len));
    }
    void textHandler(void *ctx, const char *s, size_t len)
    {
        this->emitEvent("text", std::string(s, len));
    }
    void startAttribute(void *ctx, const char *name, size_t nameLen,
                        const char *value, size_t valueLen)
    {
        Napi::Object attrib = Napi::Object::New(_env);
        attrib.Set(std::string(name, nameLen), std::string(value, valueLen));
        this->emitEvent("startAttribute", attrib);
    }
    void endAttribute(void *ctx) { this->emitEvent("endAttribute"); }
    void cdataHandler(void *ctx, const char *s, size_t len)
    {
        this->emitEvent("cdata", std::string(s, len));
    }
    void commentHandler(void *ctx, const char *s, size_t len)
    {
        this->emitEvent("comment", std::string(s, len));
    }
    void startDocument(void *ctx) { this->emitEvent("startDocument"); }
    void endDocument(void *ctx)
    {
        this->emitEvent("endDocument");
        // alias. use whatever suits you.
        this->emitEvent("end");
        this->emitEvent("finish");
        this->emitEvent("done");
    }
    void doctypeHandler(void *ctx, const char *doctype, size_t len)
    {
        this->emitEvent("doctype", std::string(doctype, len));
    }
    void errorHandler(void *ctx, xsxml::xml_parse_status status, char *offset)
    {
        Napi::Object error = Napi::Object::New(_env);
        error.Set("code", ParseStatusToString(status));
        error.Set("offset", std::string(offset, 10)); // peak 10 chars
        this->emitEvent("error", error);
    }
    void startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen)
    {
        Napi::Object declAttr = Napi::Object::New(_env);
        declAttr.Set(std::string(name, nameLen), std::string(value, valueLen));
        this->emitEvent("startXmlDeclAttr", declAttr);
    }
    void endDeclAttr(void *ctx)
    {
        this->emitEvent("endXmlDeclAttr");
    }
    void xmlDeclarationHandler(void *ctx, const char **attrs)
    {
        Napi::Object attribs = Napi::Object::New(_env);
        while (*attrs != nullptr)
        {
            const char *name = *attrs++;
            const char *val = *attrs++;
            attribs.Set(name, val);
        }

        this->emitEvent("xmlDecl", attribs);
    }
    void piHandler(void *ctx, const char *target, size_t targetLen,
                   const char *instruction, size_t instructionLen)
    {
        Napi::Object pi = Napi::Object::New(_env);
        pi.Set("target", std::string(target, targetLen));
        pi.Set("instruction", std::string(instruction, instructionLen));
        this->emitEvent("processingInstruction", pi);
    }

private:
    const Napi::CallbackInfo *_cbInfo;
    Napi::Env _env = nullptr;
    Napi::Function _emit;

    void emitEvent(std::string eventName)
    {
        _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName)});
    }
    void emitEvent(std::string eventName, std::string data)
    {
        _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName),
                                     Napi::String::New(_env, data)});
    }
    void emitEvent(std::string eventName, Napi::Object obj)
    {
        _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName), obj});
    }
    void emitEvent(std::string eventName, std::string name, Napi::Object obj)
    {
        _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName),
                                     Napi::String::New(_env, name), obj});
    }
};

void SaxParser::Parse(const Napi::CallbackInfo &info)
{
    if (info.Length() < 1)
    {
        throw Napi::Error::New(info.Env(), "Expecting 1 argument.");
    }
    if (!info[0].IsString() && !info[0].IsBuffer())
    {
        throw Napi::Error::New(info.Env(),
                               "The parameter must be a string or buffer.");
    }

    SAXParser *parser = new SAXParser();
    MySAXDelegator *delegator = new MySAXDelegator(&info);

    parser->init("UTF-8");
    parser->setDelegator(delegator);

    if (info[0].IsString())
    {
        std::string input = info[0].As<Napi::String>().Utf8Value();
        const char *xml = input.c_str();

        parser->parse(xml, std::strlen(xml));
    }
    else if (info[0].IsBuffer())
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        parser->parse(buffer.Data(), buffer.Length());
    }
}