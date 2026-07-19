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
         InstanceMethod("feed", &SaxParser::Feed),
         InstanceMethod("_markListenersDirty", &SaxParser::MarkListenersDirty)});

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
      _hasProcessingInstruction(false),
      _needsStartElementAttrs(false),
      _needsStartElementName(false),
      _needsEndElementName(false),
      _needsTextValue(false),
      _listenersDirty(true)
{
}

MySAXDelegator::~MySAXDelegator() {}

void MySAXDelegator::markListenersDirty()
{
    _listenersDirty = true;
}

Napi::Object MySAXDelegator::emptyAttribs(Napi::Env env)
{
    if (!_emptyAttribs)
    {
        Napi::Object obj = Napi::Object::New(env);
        obj.Freeze();
        _emptyAttribs = Napi::Persistent(obj);
    }

    return _emptyAttribs.Value();
}

void MySAXDelegator::refreshListeners()
{
    _startElementListeners.reset();
    _endElementListeners.reset();
    _startAttributeListeners.reset();
    _endAttributeListeners.reset();
    _textListeners.reset();
    _cdataListeners.reset();
    _commentListeners.reset();
    _startDocumentListeners.reset();
    _endDocumentListeners.reset();
    _endListeners.reset();
    _finishListeners.reset();
    _doneListeners.reset();
    _doctypeListeners.reset();
    _errorListeners.reset();
    _startXmlDeclAttrListeners.reset();
    _endXmlDeclAttrListeners.reset();
    _xmlDeclListeners.reset();
    _processingInstructionListeners.reset();

    _hasAnyListeners = false;
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

    Napi::Value events = _jsThis.Get("_events");
    if (events.IsUndefined() || events.IsNull() || !events.IsObject())
        return;

    Napi::Object listeners = events.As<Napi::Object>();
    _hasAnyListeners = true;

    _hasStartElement = listeners.Has("startElement");
    if (_hasStartElement)
        _startElementListeners.load(listeners, "startElement");

    _hasEndElement = listeners.Has("endElement");
    if (_hasEndElement)
        _endElementListeners.load(listeners, "endElement");

    _hasStartAttribute = listeners.Has("startAttribute");
    if (_hasStartAttribute)
        _startAttributeListeners.load(listeners, "startAttribute");

    _hasEndAttribute = listeners.Has("endAttribute");
    if (_hasEndAttribute)
        _endAttributeListeners.load(listeners, "endAttribute");

    _hasText = listeners.Has("text");
    if (_hasText)
        _textListeners.load(listeners, "text");
    _needsTextValue = _hasText && _textListeners.needsArg(0);

    _hasCdata = listeners.Has("cdata");
    if (_hasCdata)
        _cdataListeners.load(listeners, "cdata");

    _hasComment = listeners.Has("comment");
    if (_hasComment)
        _commentListeners.load(listeners, "comment");

    _hasStartDocument = listeners.Has("startDocument");
    if (_hasStartDocument)
        _startDocumentListeners.load(listeners, "startDocument");

    _hasEndDocument = listeners.Has("endDocument");
    if (_hasEndDocument)
        _endDocumentListeners.load(listeners, "endDocument");

    _hasEnd = listeners.Has("end");
    if (_hasEnd)
        _endListeners.load(listeners, "end");

    _hasFinish = listeners.Has("finish");
    if (_hasFinish)
        _finishListeners.load(listeners, "finish");

    _hasDone = listeners.Has("done");
    if (_hasDone)
        _doneListeners.load(listeners, "done");

    _hasDoctype = listeners.Has("doctype");
    if (_hasDoctype)
        _doctypeListeners.load(listeners, "doctype");

    _hasError = listeners.Has("error");
    if (_hasError)
        _errorListeners.load(listeners, "error");

    _hasStartXmlDeclAttr = listeners.Has("startXmlDeclAttr");
    if (_hasStartXmlDeclAttr)
        _startXmlDeclAttrListeners.load(listeners, "startXmlDeclAttr");

    _hasEndXmlDeclAttr = listeners.Has("endXmlDeclAttr");
    if (_hasEndXmlDeclAttr)
        _endXmlDeclAttrListeners.load(listeners, "endXmlDeclAttr");

    _hasXmlDecl = listeners.Has("xmlDecl");
    if (_hasXmlDecl)
        _xmlDeclListeners.load(listeners, "xmlDecl");

    _hasProcessingInstruction = listeners.Has("processingInstruction");
    if (_hasProcessingInstruction)
        _processingInstructionListeners.load(listeners, "processingInstruction");

    _cachedEventNeeds.startElement = _hasStartElement;
    _needsStartElementAttrs = _hasStartElement && _startElementListeners.needsArg(1);
    _needsStartElementName = _hasStartElement && _startElementListeners.needsArg(0);
    _cachedEventNeeds.startElementAttributes = _needsStartElementAttrs;
    _cachedEventNeeds.endElement = _hasEndElement;
    _needsEndElementName = _hasEndElement && _endElementListeners.needsArg(0);
    _cachedEventNeeds.startAttribute = _hasStartAttribute;
    _cachedEventNeeds.endAttribute = _hasEndAttribute;
    _cachedEventNeeds.text = _hasText;
    _cachedEventNeeds.cdata = _hasCdata;
    _cachedEventNeeds.comment = _hasComment;
    _cachedEventNeeds.startDocument = _hasStartDocument;
    _cachedEventNeeds.endDocument = _hasEndDocument || _hasEnd || _hasFinish || _hasDone;
    _cachedEventNeeds.doctype = _hasDoctype;
    _cachedEventNeeds.error = _hasError;
    _cachedEventNeeds.startXmlDeclAttr = _hasStartXmlDeclAttr;
    _cachedEventNeeds.endXmlDeclAttr = _hasEndXmlDeclAttr;
    _cachedEventNeeds.xmlDecl = _hasXmlDecl;
    _cachedEventNeeds.processingInstruction = _hasProcessingInstruction;
}

void MySAXDelegator::emitTo(const ListenerList &listeners,
                            const std::initializer_list<napi_value> &args)
{
    if (listeners.empty())
        return;

    listeners.call(_jsThis.Value(), args);
}

void MySAXDelegator::beginParse(SAXParser *parser)
{
    if (_listenersDirty)
    {
        refreshListeners();
        _listenersDirty = false;
    }

    parser->setEmitEvents(_hasAnyListeners);
    parser->setEmitPerAttributeEvents(_hasStartAttribute, _hasEndAttribute);
    parser->setEventNeeds(_cachedEventNeeds);
}

void MySAXDelegator::startElement(void *ctx, const char *name, const char **atts)
{
    if (!_hasStartElement)
        return;

    Napi::Env env = _jsThis.Env();

    if (!_needsStartElementName)
    {
        this->emitTo(_startElementListeners, {});
        return;
    }

    Napi::Value nameValue = Napi::String::New(env, name);

    if (!_needsStartElementAttrs)
    {
        this->emitTo(_startElementListeners, {nameValue});
        return;
    }

    Napi::Value attribsValue;
    if (atts == nullptr || *atts == nullptr)
    {
        attribsValue = emptyAttribs(env);
    }
    else
    {
        Napi::Object attribs = Napi::Object::New(env);
        while (*atts != nullptr)
        {
            const char *attrName = *atts++;
            const char *val = *atts++;
            attribs.Set(attrName, val);
        }
        attribsValue = attribs;
    }

    this->emitTo(_startElementListeners, {nameValue, attribsValue});
}

void MySAXDelegator::endElement(void *ctx, const char *name, size_t len)
{
    if (!_hasEndElement)
        return;

    if (!_needsEndElementName)
    {
        this->emitTo(_endElementListeners, {});
        return;
    }

    Napi::Env env = _jsThis.Env();
    this->emitTo(_endElementListeners, {Napi::String::New(env, name, len)});
}

void MySAXDelegator::startAttribute(void *ctx, const char *name, size_t nameLen,
                                    const char *value, size_t valueLen)
{
    if (!_hasStartAttribute)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::Object attrib = Napi::Object::New(env);
    attrib.Set(Napi::String::New(env, name, nameLen), Napi::String::New(env, value, valueLen));
    this->emitTo(_startAttributeListeners, {attrib});
}

void MySAXDelegator::endAttribute(void *ctx)
{
    if (!_hasEndAttribute)
        return;

    this->emitTo(_endAttributeListeners, {});
}

void MySAXDelegator::textHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasText)
        return;

    if (!_needsTextValue)
    {
        this->emitTo(_textListeners, {});
        return;
    }

    Napi::Env env = _jsThis.Env();
    this->emitTo(_textListeners, {Napi::String::New(env, s, len)});
}

void MySAXDelegator::cdataHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasCdata)
        return;

    Napi::Env env = _jsThis.Env();
    this->emitTo(_cdataListeners, {Napi::String::New(env, s, len)});
}

void MySAXDelegator::commentHandler(void *ctx, const char *s, size_t len)
{
    if (!_hasComment)
        return;

    Napi::Env env = _jsThis.Env();
    this->emitTo(_commentListeners, {Napi::String::New(env, s, len)});
}

void MySAXDelegator::startDocument(void *ctx)
{
    if (!_hasStartDocument)
        return;

    this->emitTo(_startDocumentListeners, {});
}

void MySAXDelegator::endDocument(void *ctx)
{
    if (_hasEndDocument)
        this->emitTo(_endDocumentListeners, {});
    if (_hasEnd)
        this->emitTo(_endListeners, {});
    if (_hasFinish)
        this->emitTo(_finishListeners, {});
    if (_hasDone)
        this->emitTo(_doneListeners, {});
}

void MySAXDelegator::doctypeHandler(void *ctx, const char *doctype, size_t len)
{
    if (!_hasDoctype)
        return;

    Napi::Env env = _jsThis.Env();
    this->emitTo(_doctypeListeners, {Napi::String::New(env, doctype, len)});
}

void MySAXDelegator::errorHandler(void *ctx, xsxml::xml_parse_status status, size_t offset)
{
    if (!_hasError)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::Object error = Napi::Object::New(env);
    error.Set("code", ParseStatusToString(status));
    error.Set("offset", Napi::Number::New(env, static_cast<double>(offset)));
    this->emitTo(_errorListeners, {error});
}

void MySAXDelegator::startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen)
{
    if (!_hasStartXmlDeclAttr)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::Object declAttr = Napi::Object::New(env);
    declAttr.Set(Napi::String::New(env, name, nameLen), Napi::String::New(env, value, valueLen));
    this->emitTo(_startXmlDeclAttrListeners, {declAttr});
}

void MySAXDelegator::endDeclAttr(void *ctx)
{
    if (!_hasEndXmlDeclAttr)
        return;

    this->emitTo(_endXmlDeclAttrListeners, {});
}

void MySAXDelegator::xmlDeclarationHandler(void *ctx, const char **attrs)
{
    if (!_hasXmlDecl)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::Object attribs = Napi::Object::New(env);
    while (*attrs != nullptr)
    {
        const char *name = *attrs++;
        const char *val = *attrs++;
        attribs.Set(name, val);
    }

    this->emitTo(_xmlDeclListeners, {attribs});
}

void MySAXDelegator::piHandler(void *ctx, const char *target, size_t targetLen,
                              const char *instruction, size_t instructionLen)
{
    if (!_hasProcessingInstruction)
        return;

    Napi::Env env = _jsThis.Env();
    Napi::Object pi = Napi::Object::New(env);
    pi.Set("target", Napi::String::New(env, target, targetLen));
    pi.Set("instruction", Napi::String::New(env, instruction, instructionLen));
    this->emitTo(_processingInstructionListeners, {pi});
}

void SaxParser::MarkListenersDirty(const Napi::CallbackInfo &info)
{
    _delegator->markListenersDirty();
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

    Napi::HandleScope scope(info.Env());
    _delegator->beginParse(_parser.get());

    if (info[0].IsString())
    {
        _parseInput = info[0].As<Napi::String>().Utf8Value();
        _parser->parseMutable(&_parseInput[0], _parseInput.size());
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
        Napi::HandleScope scope(info.Env());
        _delegator->beginParse(_parser.get());
        _parser->feed(nullptr, 0, flush);
        return;
    }

    if (!info[0].IsString() && !info[0].IsBuffer())
    {
        throw Napi::Error::New(info.Env(),
                               "The parameter must be a string or buffer.");
    }

    Napi::HandleScope scope(info.Env());
    _delegator->beginParse(_parser.get());

    if (info[0].IsString())
    {
        _parseInput = info[0].As<Napi::String>().Utf8Value();
        _parser->feed(_parseInput.c_str(), _parseInput.size(), flush);
    }
    else
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        _parser->feed(buffer.Data(), buffer.Length(), flush);
    }
}
