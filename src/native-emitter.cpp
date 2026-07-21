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
         InstanceMethod("writev", &SaxParser::Writev),
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
      _collectingDelegator(&_collector),
      _xmlDispatchBase(nullptr),
      _xmlDispatchLength(0),
      _feedSessionActive(false)
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
    setListenerFlag(listeners, "startAttribute", _flags.startAttribute,
                    _flags.startAttributeNeedsArgs);
    setListenerFlag(listeners, "error", _flags.error, _flags.errorNeedsArgs);
    setListenerFlag(listeners, "startXmlDeclAttr", _flags.startXmlDeclAttr,
                    _flags.startXmlDeclAttrNeedsArgs);

    _flags.endAttribute = listeners.Has("endAttribute");
    _flags.startDocument = listeners.Has("startDocument");
    _flags.endDocument = listeners.Has("endDocument");
    _flags.end = listeners.Has("end");
    _flags.finish = listeners.Has("finish");
    _flags.done = listeners.Has("done");
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

void SaxParser::beginEventCollection(const char *xmlBase, size_t xmlLength)
{
    _collector.clear();
    _collector.reserve(8192, 16384);
    _collector.setCompactRecords(_registry->compactRecords());
    _collector.setXmlBase(xmlBase);
    _xmlDispatchBase = xmlBase;
    _xmlDispatchLength = xmlLength;
    _collectingDelegator.beginParse(_parser.get());
    _collector.setBatchCallback([this]() { flushEventBatch(); });
}

void SaxParser::flushEventBatch()
{
    if (!_registry->hasAnyListeners())
        return;

    size_t eventCount = _collector.eventCount();
    if (eventCount == 0 && !_collector.hasError())
        return;

    _collector.releaseInto(_dispatchRecords, _dispatchAux, eventCount);
    dispatchCollected(_jsThis.Env(), _xmlDispatchBase, _xmlDispatchLength, eventCount);
}

void SaxParser::finishEventCollection(Napi::Env env)
{
    flushEventBatch();
    _collector.clearBatchCallback();
    _xmlBufferRef.Reset();
}

void SaxParser::ensureDispatchFns()
{
    if (_dispatchHotFn.IsEmpty())
    {
        Napi::Value hot = _jsThis.Get("_dispatchHot");
        if (hot.IsFunction())
            _dispatchHotFn = Napi::Persistent(hot.As<Napi::Function>());
    }
    if (_dispatchCompactFn.IsEmpty())
    {
        Napi::Value compact = _jsThis.Get("_dispatchCompact");
        if (compact.IsFunction())
            _dispatchCompactFn = Napi::Persistent(compact.As<Napi::Function>());
    }
    if (_dispatchEventsFn.IsEmpty())
    {
        Napi::Value events = _jsThis.Get("_dispatchEvents");
        if (events.IsFunction())
            _dispatchEventsFn = Napi::Persistent(events.As<Napi::Function>());
    }
}

void SaxParser::dispatchCollected(Napi::Env env, const char *xmlData, size_t xmlLength,
                                  size_t eventCount)
{
    if (!_registry->hasAnyListeners())
        return;

    if (eventCount == 0 && !_collector.hasError())
        return;

    ensureDispatchFns();

    auto noopFinalizer = [](Napi::Env, void *) {};

    Napi::Buffer<uint8_t> recordBuffer;
    if (_dispatchRecords.empty())
        recordBuffer = Napi::Buffer<uint8_t>::New(env, 0);
    else
        recordBuffer = Napi::Buffer<uint8_t>::New(env, _dispatchRecords.data(),
                                                  _dispatchRecords.size(), noopFinalizer);

    // Compact records: one uint32 type per event — no aux, no xml marshalling.
    if (_registry->compactRecords() && !_dispatchCompactFn.IsEmpty())
    {
        _dispatchCompactFn.Call(_jsThis.Value(), {recordBuffer});
        return;
    }

    Napi::Buffer<uint8_t> auxBuffer;
    if (_dispatchAux.empty())
        auxBuffer = Napi::Buffer<uint8_t>::New(env, 0);
    else
        auxBuffer = Napi::Buffer<uint8_t>::New(env, _dispatchAux.data(), _dispatchAux.size(),
                                               noopFinalizer);

    // Lean path: JS already holds the xml string on `this._xmlSource`. Pass only
    // the two buffers; eventCount is derived from recordBuffer.byteLength / 20.
    // Avoids property lookup for the dispatch method, xml Buffer construction,
    // and Number/Boolean arg marshalling.
    if (!_registry->compactRecords() && !_dispatchHotFn.IsEmpty())
    {
        Napi::Value xmlSource = _jsThis.Get("_xmlSource");
        if (!xmlSource.IsUndefined() && !xmlSource.IsNull())
        {
            _dispatchHotFn.Call(_jsThis.Value(), {recordBuffer, auxBuffer});
            return;
        }
    }

    if (_dispatchEventsFn.IsEmpty())
        return;

    Napi::Value xmlSource = _jsThis.Get("_xmlSource");
    if (xmlSource.IsUndefined() || xmlSource.IsNull())
    {
        if (!_xmlBufferRef.IsEmpty())
        {
            xmlSource = _xmlBufferRef.Value();
        }
        else if (xmlData != nullptr && xmlLength > 0)
        {
            xmlSource = Napi::Buffer<char>::New(env, const_cast<char *>(xmlData), xmlLength,
                                               noopFinalizer);
        }
        else
        {
            xmlSource = env.Null();
        }
    }

    _dispatchEventsFn.Call(
        _jsThis.Value(),
        {xmlSource, recordBuffer, auxBuffer, Napi::Number::New(env, static_cast<double>(eventCount)),
         Napi::Boolean::New(env, _registry->compactRecords())});
}

void SaxParser::appendFeedChunk(const Napi::Value &chunk, Napi::Env env)
{
    if (chunk.IsNull() || chunk.IsUndefined())
        return;

    if (chunk.IsString())
    {
        std::string utf8 = chunk.As<Napi::String>().Utf8Value();
        _feedXml.insert(_feedXml.end(), utf8.begin(), utf8.end());
        return;
    }

    if (chunk.IsBuffer())
    {
        Napi::Buffer<char> buffer = chunk.As<Napi::Buffer<char>>();
        const char *data = buffer.Data();
        _feedXml.insert(_feedXml.end(), data, data + buffer.Length());
        return;
    }

    throw Napi::Error::New(env, "Each chunk must be a string or buffer.");
}

void SaxParser::flushFeedSession(Napi::Env env)
{
    if (_feedXml.empty())
    {
        _collector.setXmlBase(nullptr);
        _xmlDispatchBase = nullptr;
        _xmlDispatchLength = 0;
        _collectingDelegator.beginParse(_parser.get());
        _parser->feed(nullptr, 0, true);
        finishEventCollection(env);
        _feedSessionActive = false;
        return;
    }

    _collector.setXmlBase(_feedXml.data());
    _xmlDispatchBase = _feedXml.data();
    _xmlDispatchLength = _feedXml.size();
    _collectingDelegator.beginParse(_parser.get());
    _parser->parseMutable(_feedXml.data(), _feedXml.size());
    _parseInput.assign(_feedXml.begin(), _feedXml.end());
    _xmlDispatchBase = _parseInput.data();
    _xmlDispatchLength = _parseInput.size();
    _feedXml.clear();
    finishEventCollection(env);
    _feedSessionActive = false;
}

void SaxParser::runParse(char *xmlData, size_t xmlLength)
{
    _registry->beginParse(_parser.get());

    if (!_registry->hasAnyListeners())
    {
        _parser->parseMutable(xmlData, xmlLength);
        return;
    }

    beginEventCollection(xmlData, xmlLength);
    _parser->parseMutable(xmlData, xmlLength);
    finishEventCollection(_jsThis.Env());
}

void SaxParser::runFeed(const char *xmlData, size_t xmlLength, bool flush)
{
    _registry->beginParse(_parser.get());

    if (!_registry->hasAnyListeners())
    {
        _parser->feed(xmlData, xmlLength, flush);
        return;
    }

    if (!_feedSessionActive)
    {
        _feedSessionActive = true;
        beginEventCollection(nullptr, 0);
    }

    if (xmlData != nullptr && xmlLength > 0)
        _feedXml.insert(_feedXml.end(), xmlData, xmlData + xmlLength);

    if (!flush)
        return;

    flushFeedSession(_jsThis.Env());
}

void SaxParser::runWritev(const Napi::Array &chunks, bool flush)
{
    _registry->beginParse(_parser.get());

    const uint32_t chunkCount = chunks.Length();

    if (!_registry->hasAnyListeners())
    {
        Napi::Env env = _jsThis.Env();
        for (uint32_t i = 0; i < chunkCount; i++)
        {
            Napi::Value chunk = chunks[i];
            if (chunk.IsNull() || chunk.IsUndefined())
                continue;

            if (chunk.IsString())
            {
                std::string utf8 = chunk.As<Napi::String>().Utf8Value();
                _parser->feed(utf8.c_str(), utf8.size(), false);
            }
            else if (chunk.IsBuffer())
            {
                Napi::Buffer<char> buffer = chunk.As<Napi::Buffer<char>>();
                _parser->feed(buffer.Data(), buffer.Length(), false);
            }
            else
            {
                throw Napi::Error::New(env, "Each chunk must be a string or buffer.");
            }
        }

        _parser->feed(nullptr, 0, flush);
        return;
    }

    if (!_feedSessionActive)
    {
        _feedSessionActive = true;
        beginEventCollection(nullptr, 0);
    }

    Napi::Env env = _jsThis.Env();
    for (uint32_t i = 0; i < chunkCount; i++)
        appendFeedChunk(chunks[i], env);

    if (!flush)
        return;

    flushFeedSession(env);
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
        _xmlBufferRef = Napi::Persistent(buffer);
        runParse(buffer.Data(), buffer.Length());
        _xmlBufferRef.Reset();
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

void SaxParser::Writev(const Napi::CallbackInfo &info)
{
    if (info.Length() < 1 || !info[0].IsArray())
    {
        throw Napi::Error::New(info.Env(), "Expecting an array of chunks.");
    }

    bool flush = false;
    if (info.Length() >= 2 && info[1].IsBoolean())
        flush = info[1].As<Napi::Boolean>().Value();

    Napi::HandleScope scope(info.Env());
    runWritev(info[0].As<Napi::Array>(), flush);
}
