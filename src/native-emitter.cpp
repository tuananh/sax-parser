#include "native-emitter.h"

#include <string>

#include "sax-parser.h"

using namespace saxparser;

Napi::FunctionReference SaxParser::constructor;

Napi::Object SaxParser::Init(Napi::Env env, Napi::Object exports)
{
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(
        env, "SaxParser",
        {InstanceMethod("parse", &SaxParser::Parse),
         InstanceMethod("feed", &SaxParser::Feed)});

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("SaxParser", func);
    return exports;
}

SaxParser::SaxParser(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<SaxParser>(info),
      _parser(new SAXParser()),
      _delegator(new MySAXDelegator(Napi::Persistent(info.This().As<Napi::Object>())))
{
    _parser->init("UTF-8");
    _parser->setDelegator(_delegator.get());
}

SaxParser::~SaxParser() {}

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
        return "OK";
    default:
        return "ERR_UNKNOWN";
    }
}

MySAXDelegator::MySAXDelegator(Napi::ObjectReference jsThis)
    : _jsThis(std::move(jsThis)),
      _hasAnyListeners(false),
      _hasStartElement(false),
      _hasEndElement(false),
      _hasStartAttribute(false),
      _hasEndAttribute(false),
      _hasText(false),
      _hasCdata(false),
      _hasComment(false),
      _hasStartDocument(false),
      _hasEndDocument(false),
      _hasEnd(false),
      _hasFinish(false),
      _hasDone(false),
      _hasDoctype(false),
      _hasError(false),
      _hasStartXmlDeclAttr(false),
      _hasEndXmlDeclAttr(false),
      _hasXmlDecl(false),
      _hasProcessingInstruction(false)
{
}

MySAXDelegator::~MySAXDelegator() {}

void MySAXDelegator::refreshListenerFlags()
{
    Napi::Value events = _jsThis.Get("_events");
    _hasAnyListeners = !(events.IsUndefined() || events.IsNull());

    _hasStartElement = false;
    _hasEndElement = false;
    _hasStartAttribute = false;
    _hasEndAttribute = false;
    _hasText = false;
    _hasCdata = false;
    _hasComment = false;
    _hasStartDocument = false;
    _hasEndDocument = false;
    _hasEnd = false;
    _hasFinish = false;
    _hasDone = false;
    _hasDoctype = false;
    _hasError = false;
    _hasStartXmlDeclAttr = false;
    _hasEndXmlDeclAttr = false;
    _hasXmlDecl = false;
    _hasProcessingInstruction = false;

    if (!_hasAnyListeners || !events.IsObject())
        return;

    Napi::Object listeners = events.As<Napi::Object>();
    _hasStartElement = listeners.Has("startElement");
    _hasEndElement = listeners.Has("endElement");
    _hasStartAttribute = listeners.Has("startAttribute");
    _hasEndAttribute = listeners.Has("endAttribute");
    _hasText = listeners.Has("text");
    _hasCdata = listeners.Has("cdata");
    _hasComment = listeners.Has("comment");
    _hasStartDocument = listeners.Has("startDocument");
    _hasEndDocument = listeners.Has("endDocument");
    _hasEnd = listeners.Has("end");
    _hasFinish = listeners.Has("finish");
    _hasDone = listeners.Has("done");
    _hasDoctype = listeners.Has("doctype");
    _hasError = listeners.Has("error");
    _hasStartXmlDeclAttr = listeners.Has("startXmlDeclAttr");
    _hasEndXmlDeclAttr = listeners.Has("endXmlDeclAttr");
    _hasXmlDecl = listeners.Has("xmlDecl");
    _hasProcessingInstruction = listeners.Has("processingInstruction");
}

void MySAXDelegator::beginParse(SAXParser *parser)
{
    refreshListenerFlags();
    parser->setEmitEvents(_hasAnyListeners);
    parser->setEmitPerAttributeEvents(_hasStartAttribute, _hasEndAttribute);

    if (_hasAnyListeners && !_emit)
    {
        _emit = Napi::Persistent(_jsThis.Get("emit").As<Napi::Function>());
    }
}

void MySAXDelegator::startElement(void *ctx, const char *name, const char **atts)
{
    if (!_hasStartElement)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object attribs = Napi::Object::New(env);
    while (*atts != nullptr)
    {
        const char *attrName = *atts++;
        const char *val = *atts++;
        attribs.Set(attrName, val);
    }

    this->emitEvent("startElement", name, attribs);
}

void MySAXDelegator::endElement(void *ctx, const char *name, size_t len)
{
    if (!_hasEndElement)
        return;

    this->emitEvent("endElement", name, len);
}

void MySAXDelegator::startAttribute(void *ctx, const char *name, size_t nameLen,
                                    const char *value, size_t valueLen)
{
    if (!_hasStartAttribute)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object attrib = Napi::Object::New(env);
    attrib.Set(Napi::String::New(env, name, nameLen), Napi::String::New(env, value, valueLen));
    this->emitEvent("startAttribute", attrib);
}

void MySAXDelegator::endAttribute(void *ctx)
{
    if (!_hasEndAttribute)
        return;

    this->emitEvent("endAttribute");
}

void MySAXDelegator::textHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasText)
        return;

    this->emitEvent("text", s, len);
}

void MySAXDelegator::cdataHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasCdata)
        return;

    this->emitEvent("cdata", s, len);
}

void MySAXDelegator::commentHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasComment)
        return;

    this->emitEvent("comment", s, len);
}

void MySAXDelegator::startDocument(void *ctx)
{
    if (!_hasStartDocument)
        return;

    this->emitEvent("startDocument");
}

void MySAXDelegator::endDocument(void *ctx)
{
    if (_hasEndDocument)
        this->emitEvent("endDocument");
    if (_hasEnd)
        this->emitEvent("end");
    if (_hasFinish)
        this->emitEvent("finish");
    if (_hasDone)
        this->emitEvent("done");
}

void MySAXDelegator::doctypeHandler(void *ctx, const char *doctype, size_t len)
{
    if (!_hasDoctype)
        return;

    this->emitEvent("doctype", doctype, len);
}

void MySAXDelegator::errorHandler(void *ctx, xsxml::xml_parse_status status, char *offset)
{
    if (!_hasError)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object error = Napi::Object::New(env);
    error.Set("code", ParseStatusToString(status));
    error.Set("offset", std::string(offset, 10));
    this->emitEvent("error", error);
}

void MySAXDelegator::startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen)
{
    if (!_hasStartXmlDeclAttr)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object declAttr = Napi::Object::New(env);
    declAttr.Set(Napi::String::New(env, name, nameLen), Napi::String::New(env, value, valueLen));
    this->emitEvent("startXmlDeclAttr", declAttr);
}

void MySAXDelegator::endDeclAttr(void *ctx)
{
    if (!_hasEndXmlDeclAttr)
        return;

    this->emitEvent("endXmlDeclAttr");
}

void MySAXDelegator::xmlDeclarationHandler(void *ctx, const char **attrs)
{
    if (!_hasXmlDecl)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object attribs = Napi::Object::New(env);
    while (*attrs != nullptr)
    {
        const char *name = *attrs++;
        const char *val = *attrs++;
        attribs.Set(name, val);
    }

    this->emitEvent("xmlDecl", attribs);
}

void MySAXDelegator::piHandler(void *ctx, const char *target, size_t targetLen,
                              const char *instruction, size_t instructionLen)
{
    if (!_hasProcessingInstruction)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::HandleScope scope(env);

    Napi::Object pi = Napi::Object::New(env);
    pi.Set("target", Napi::String::New(env, target, targetLen));
    pi.Set("instruction", Napi::String::New(env, instruction, instructionLen));
    this->emitEvent("processingInstruction", pi);
}

void MySAXDelegator::emitEvent(const char *eventName)
{
    Napi::Env env = _jsThis.Env();
    _emit.Call(_jsThis.Value(), {Napi::String::New(env, eventName)});
}

void MySAXDelegator::emitEvent(const char *eventName, const char *data, size_t len)
{
    Napi::Env env = _jsThis.Env();
    _emit.Call(_jsThis.Value(), {Napi::String::New(env, eventName),
                                 Napi::String::New(env, data, len)});
}

void MySAXDelegator::emitEvent(const char *eventName, Napi::Object obj)
{
    Napi::Env env = _jsThis.Env();
    _emit.Call(_jsThis.Value(), {Napi::String::New(env, eventName), obj});
}

void MySAXDelegator::emitEvent(const char *eventName, const char *name, Napi::Object obj)
{
    Napi::Env env = _jsThis.Env();
    _emit.Call(_jsThis.Value(), {Napi::String::New(env, eventName),
                                 Napi::String::New(env, name), obj});
}

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

    _delegator->beginParse(_parser.get());

    if (info[0].IsString())
    {
        std::string utf8 = info[0].As<Napi::String>().Utf8Value();
        _parser->parseMutable(&utf8[0], utf8.size());
    }
    else
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        _parser->parseMutable(buffer.Data(), buffer.Length());
    }
}

void SaxParser::Feed(const Napi::CallbackInfo &info)
{
    bool flush = false;

    if (info.Length() >= 1 && info[0].IsBoolean())
    {
        flush = info[0].As<Napi::Boolean>().Value();
    }
    else if (info.Length() >= 2 && info[1].IsBoolean())
    {
        flush = info[1].As<Napi::Boolean>().Value();
    }

    if (info.Length() < 1 || info[0].IsNull() || info[0].IsUndefined())
    {
        _delegator->beginParse(_parser.get());
        _parser->feed(nullptr, 0, flush);
        return;
    }

    if (!info[0].IsString() && !info[0].IsBuffer())
    {
        throw Napi::Error::New(info.Env(),
                               "The parameter must be a string or buffer.");
    }

    _delegator->beginParse(_parser.get());

    if (info[0].IsString())
    {
        std::string utf8 = info[0].As<Napi::String>().Utf8Value();
        _parser->feed(utf8.c_str(), utf8.size(), flush);
    }
    else
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        _parser->feed(buffer.Data(), buffer.Length(), flush);
    }
}
