#include <memory>
#include <napi.h>

#include "event-collector.h"
#include "sax-parser.h"

using saxparser::ListenerFlags;

class ListenerRegistry
{
public:
    explicit ListenerRegistry(Napi::ObjectReference jsThis);

    void markListenersDirty();
    void beginParse(saxparser::SAXParser *parser);
    bool hasAnyListeners() const { return _flags.hasAnyListeners; }
    bool compactRecords() const { return saxparser::useCompactRecords(_flags); }
    const ListenerFlags &flags() const { return _flags; }

private:
    Napi::ObjectReference _jsThis;
    ListenerFlags _flags;
    bool _listenersDirty;

    void refreshFlags();
};

class SaxParser : public Napi::ObjectWrap<SaxParser>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    SaxParser(const Napi::CallbackInfo &info);
    ~SaxParser();

private:
    static Napi::FunctionReference constructor;

    Napi::ObjectReference _jsThis;
    Napi::FunctionReference _dispatchHotFn;
    Napi::FunctionReference _dispatchEventsFn;
    std::unique_ptr<saxparser::SAXParser> _parser;
    std::unique_ptr<ListenerRegistry> _registry;
    saxparser::EventCollector _collector;
    saxparser::CollectingSAXDelegator _collectingDelegator;
    std::string _parseInput;
    std::vector<char> _feedXml;
    std::vector<uint8_t> _dispatchRecords;
    std::vector<uint8_t> _dispatchAux;
    Napi::Reference<Napi::Buffer<char>> _xmlBufferRef;
    const char *_xmlDispatchBase;
    size_t _xmlDispatchLength;
    bool _feedSessionActive;

    void Parse(const Napi::CallbackInfo &info);
    void Feed(const Napi::CallbackInfo &info);
    void Writev(const Napi::CallbackInfo &info);
    void MarkListenersDirty(const Napi::CallbackInfo &info);

    void appendFeedChunk(const Napi::Value &chunk, Napi::Env env);
    void runParse(char *xmlData, size_t xmlLength);
    void runFeed(const char *xmlData, size_t xmlLength, bool flush);
    void runWritev(const Napi::Array &chunks, bool flush);
    void beginEventCollection(const char *xmlBase, size_t xmlLength);
    void flushEventBatch();
    void finishEventCollection(Napi::Env env);
    void flushFeedSession(Napi::Env env);
    void ensureDispatchFns();
    void dispatchCollected(Napi::Env env, const char *xmlData, size_t xmlLength, size_t eventCount);
};
