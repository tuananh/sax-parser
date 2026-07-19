#include "native-emitter.h"

#include <utility>

#include "sax-parser.h"

using namespace saxparser;

namespace
{

bool functionNeedsArgs(const Napi::Function &fn)
{
    Napi::Value length = fn.Get("length");
    return length.IsNumber() && length.As<Napi::Number>().Int32Value() > 0;
}

bool listenersNeedArgs(const Napi::Value &value)
{
    if (value.IsUndefined() || value.IsNull())
        return false;

    if (value.IsFunction())
        return functionNeedsArgs(value.As<Napi::Function>());

    if (value.IsArray())
    {
        Napi::Array arr = value.As<Napi::Array>();
        const uint32_t length = arr.Length();
        for (uint32_t i = 0; i < length; i++)
        {
            Napi::Value item = arr[i];
            if (item.IsFunction() && functionNeedsArgs(item.As<Napi::Function>()))
                return true;
        }
    }

    return false;
}

void setListenerFlag(Napi::Object &listeners, const char *name, bool &registered, bool &needsArgs)
{
    Napi::Value value = listeners.Get(name);
    registered = !value.IsUndefined() && !value.IsNull();
    needsArgs = registered && listenersNeedArgs(value);
}

} // namespace

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
      _jsThis(Napi::Persistent(info.This().As<Napi::Object>())),
      _parser(new SAXParser()),
      _registry(new ListenerRegistry(Napi::Persistent(info.This().As<Napi::Object>()))),
      _collectingDelegator(&_collector)
{
    _parser->init("UTF-8");
    _parser->setDelegator(&_collectingDelegator);
}

SaxParser::~SaxParser() {}

ListenerRegistry::ListenerRegistry(Napi::ObjectReference jsThis)
    : _jsThis(std::move(jsThis)), _listenersDirty(true)
{
    refreshFlags();
}

void ListenerRegistry::markListenersDirty()
{
    _listenersDirty = true;
}

void ListenerRegistry::refreshFlags()
{
    _flags = ListenerFlags{};

    Napi::Value events = _jsThis.Get("_events");
    if (events.IsUndefined() || events.IsNull() || !events.IsObject())
        return;

    Napi::Object listeners = events.As<Napi::Object>();
    _flags.hasAnyListeners = true;
    setListenerFlag(listeners, "startElement", _flags.startElement,
                    _flags.startElementNeedsArgs);
    setListenerFlag(listeners, "endElement", _flags.endElement, _flags.endElementNeedsArgs);
    setListenerFlag(listeners, "text", _flags.text, _flags.textNeedsArgs);
    setListenerFlag(listeners, "cdata", _flags.cdata, _flags.cdataNeedsArgs);
    setListenerFlag(listeners, "comment", _flags.comment, _flags.commentNeedsArgs);
    setListenerFlag(listeners, "doctype", _flags.doctype, _flags.doctypeNeedsArgs);
    setListenerFlag(listeners, "xmlDecl", _flags.xmlDecl, _flags.xmlDeclNeedsArgs);
    setListenerFlag(listeners, "processingInstruction", _flags.processingInstruction,
                    _flags.processingInstructionNeedsArgs);

    _flags.startAttribute = listeners.Has("startAttribute");
    _flags.endAttribute = listeners.Has("endAttribute");
    _flags.startDocument = listeners.Has("startDocument");
    _flags.endDocument = listeners.Has("endDocument");
    _flags.end = listeners.Has("end");
    _flags.finish = listeners.Has("finish");
    _flags.done = listeners.Has("done");
    _flags.error = listeners.Has("error");
    _flags.startXmlDeclAttr = listeners.Has("startXmlDeclAttr");
    _flags.endXmlDeclAttr = listeners.Has("endXmlDeclAttr");
}

void ListenerRegistry::beginParse(SAXParser *parser)
{
    if (_listenersDirty)
    {
        refreshFlags();
        _listenersDirty = false;
    }

    if (!_flags.hasAnyListeners)
    {
        parser->setEmitEvents(false);
        return;
    }

    parser->setEmitEvents(true);
    parser->setEmitPerAttributeEvents(_flags.startAttribute, _flags.endAttribute);
    parser->setEventNeeds(eventNeedsFromFlags(_flags));
}

void SaxParser::MarkListenersDirty(const Napi::CallbackInfo &info)
{
    _registry->markListenersDirty();
}

void SaxParser::dispatchCollected(Napi::Env env, const char *xmlData, size_t xmlLength)
{
    if (!_registry->hasAnyListeners())
        return;

    size_t eventCount = _collector.eventCount();
    if (eventCount == 0 && !_collector.hasError())
        return;

    Napi::Value dispatchValue = _jsThis.Get("_dispatchEvents");
    if (!dispatchValue.IsFunction())
        return;

    const uint32_t errorCode = _collector.errorCode();
    const uint32_t errorOffset = _collector.errorOffset();
    _collector.releaseInto(_dispatchRecords, _dispatchAux, eventCount);

    auto noopFinalizer = [](Napi::Env, void *) {};

    Napi::Buffer<char> xmlBuffer =
        Napi::Buffer<char>::New(env, const_cast<char *>(xmlData), xmlLength, noopFinalizer);
    Napi::Buffer<uint8_t> recordBuffer = Napi::Buffer<uint8_t>::New(
        env, _dispatchRecords.data(), _dispatchRecords.size(), noopFinalizer);
    Napi::Buffer<uint8_t> auxBuffer = Napi::Buffer<uint8_t>::New(
        env, _dispatchAux.data(), _dispatchAux.size(), noopFinalizer);

    dispatchValue.As<Napi::Function>().Call(
        _jsThis.Value(),
        {xmlBuffer, recordBuffer, auxBuffer, Napi::Number::New(env, static_cast<double>(eventCount)),
         Napi::Number::New(env, errorCode), Napi::Number::New(env, errorOffset)});
}

void SaxParser::runParse(char *xmlData, size_t xmlLength)
{
    _registry->beginParse(_parser.get());

    if (!_registry->hasAnyListeners())
    {
        _parser->parseMutable(xmlData, xmlLength);
        return;
    }

    _collector.clear();
    _collector.setXmlBase(xmlData);
    _collectingDelegator.beginParse(_parser.get());
    _parser->parseMutable(xmlData, xmlLength);
    dispatchCollected(_jsThis.Env(), xmlData, xmlLength);
}

void SaxParser::runFeed(const char *xmlData, size_t xmlLength, bool flush)
{
    _registry->beginParse(_parser.get());

    if (!_registry->hasAnyListeners())
    {
        _parser->feed(xmlData, xmlLength, flush);
        return;
    }

    if (xmlData != nullptr && xmlLength > 0)
        _feedXml.insert(_feedXml.end(), xmlData, xmlData + xmlLength);

    if (!flush)
        return;

    _collectingDelegator.beginParse(_parser.get());

    if (_feedXml.empty())
    {
        _collector.clear();
        _collector.setXmlBase("");
        _parser->feed(nullptr, 0, true);
        dispatchCollected(_jsThis.Env(), "", 0);
        return;
    }

    _collector.clear();
    _collector.setXmlBase(_feedXml.data());
    _parser->parseMutable(_feedXml.data(), _feedXml.size());
    _parseInput.assign(_feedXml.begin(), _feedXml.end());
    _feedXml.clear();
    dispatchCollected(_jsThis.Env(), _parseInput.data(), _parseInput.size());
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

    if (info[0].IsString())
    {
        _parseInput = info[0].As<Napi::String>().Utf8Value();
        runParse(&_parseInput[0], _parseInput.size());
    }
    else
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        runParse(buffer.Data(), buffer.Length());
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

    Napi::HandleScope scope(info.Env());

    if (info.Length() < 1 || info[0].IsNull() || info[0].IsUndefined())
    {
        runFeed(nullptr, 0, flush);
        return;
    }

    if (!info[0].IsString() && !info[0].IsBuffer())
    {
        throw Napi::Error::New(info.Env(),
                               "The parameter must be a string or buffer.");
    }

    if (info[0].IsString())
    {
        _parseInput = info[0].As<Napi::String>().Utf8Value();
        runFeed(_parseInput.c_str(), _parseInput.size(), flush);
    }
    else
    {
        Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
        runFeed(buffer.Data(), buffer.Length(), flush);
    }
}
