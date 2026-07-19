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
    std::unique_ptr<saxparser::SAXParser> _parser;
    std::unique_ptr<ListenerRegistry> _registry;
    saxparser::EventCollector _collector;
    saxparser::CollectingSAXDelegator _collectingDelegator;
    std::string _parseInput;
    std::vector<char> _feedXml;
    std::vector<uint8_t> _dispatchRecords;
    std::vector<uint8_t> _dispatchAux;

    void Parse(const Napi::CallbackInfo &info);
    void Feed(const Napi::CallbackInfo &info);
    void MarkListenersDirty(const Napi::CallbackInfo &info);

    void runParse(char *xmlData, size_t xmlLength);
    void runFeed(const char *xmlData, size_t xmlLength, bool flush);
    void dispatchCollected(Napi::Env env, const char *xmlData, size_t xmlLength);
};
