#include <memory>
#include <vector>
#include <napi.h>

#include "sax-parser.h"

class ListenerList
{
public:
    void reset()
    {
        _listeners.clear();
        _singleListener = Napi::FunctionReference();
    }

    void load(Napi::Object &events, const char *eventName)
    {
        reset();
        if (!events.Has(eventName))
            return;

        Napi::Value val = events.Get(eventName);
        if (val.IsFunction())
        {
            _singleListener = Napi::Persistent(val.As<Napi::Function>());
            return;
        }

        if (!val.IsArray())
            return;

        Napi::Array arr = val.As<Napi::Array>();
        for (uint32_t i = 0; i < arr.Length(); i++)
        {
            Napi::Value item = arr[i];
            if (item.IsFunction())
                _listeners.push_back(Napi::Persistent(item.As<Napi::Function>()));
        }
    }

    bool empty() const { return !_singleListener && _listeners.empty(); }

    bool needsArg(size_t index) const
    {
        if (_singleListener)
        {
            Napi::Value lengthValue = _singleListener.Value().Get("length");
            return lengthValue.IsNumber() &&
                   static_cast<size_t>(lengthValue.As<Napi::Number>().Uint32Value()) > index;
        }

        for (const auto &listener : _listeners)
        {
            Napi::Value lengthValue = listener.Value().Get("length");
            if (lengthValue.IsNumber() &&
                static_cast<size_t>(lengthValue.As<Napi::Number>().Uint32Value()) > index)
            {
                return true;
            }
        }
        return false;
    }

    void call(Napi::Object receiver, const std::initializer_list<napi_value> &args) const
    {
        if (_singleListener)
        {
            _singleListener.Call(receiver, args);
            return;
        }

        for (const auto &listener : _listeners)
            listener.Call(receiver, args);
    }

private:
    Napi::FunctionReference _singleListener;
    std::vector<Napi::FunctionReference> _listeners;
};

class MySAXDelegator : public saxparser::SAXDelegator
{
public:
    explicit MySAXDelegator(Napi::ObjectReference jsThis);
    ~MySAXDelegator();

    void markListenersDirty();
    void beginParse(saxparser::SAXParser *parser);

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
    void errorHandler(void *ctx, xsxml::xml_parse_status, size_t offset) override;
    void startDeclAttr(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen) override;
    void endDeclAttr(void *ctx) override;
    void xmlDeclarationHandler(void *ctx, const char **attrs) override;
    void piHandler(void *ctx, const char *target, size_t, const char *instruction, size_t) override;

private:
    Napi::ObjectReference _jsThis;
    ListenerList _startElementListeners;
    ListenerList _endElementListeners;
    ListenerList _startAttributeListeners;
    ListenerList _endAttributeListeners;
    ListenerList _textListeners;
    ListenerList _cdataListeners;
    ListenerList _commentListeners;
    ListenerList _startDocumentListeners;
    ListenerList _endDocumentListeners;
    ListenerList _endListeners;
    ListenerList _finishListeners;
    ListenerList _doneListeners;
    ListenerList _doctypeListeners;
    ListenerList _errorListeners;
    ListenerList _startXmlDeclAttrListeners;
    ListenerList _endXmlDeclAttrListeners;
    ListenerList _xmlDeclListeners;
    ListenerList _processingInstructionListeners;
    bool _hasAnyListeners;
    bool _hasStartElement;
    bool _hasEndElement;
    bool _hasStartAttribute;
    bool _hasEndAttribute;
    bool _hasText;
    bool _hasCdata;
    bool _hasComment;
    bool _hasStartDocument;
    bool _hasEndDocument;
    bool _hasEnd;
    bool _hasFinish;
    bool _hasDone;
    bool _hasDoctype;
    bool _hasError;
    bool _hasStartXmlDeclAttr;
    bool _hasEndXmlDeclAttr;
    bool _hasXmlDecl;
    bool _hasProcessingInstruction;
    bool _needsStartElementAttrs;
    bool _needsStartElementName;
    bool _needsEndElementName;
    bool _needsTextValue;
    bool _listenersDirty;
    saxparser::SAXEventNeeds _cachedEventNeeds;
    Napi::ObjectReference _emptyAttribs;

    void refreshListeners();
    Napi::Object emptyAttribs(Napi::Env env);

    void emitTo(const ListenerList &listeners, const std::initializer_list<napi_value> &args);
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
    std::string _parseInput;

    void Parse(const Napi::CallbackInfo &info);
    void Feed(const Napi::CallbackInfo &info);
    void MarkListenersDirty(const Napi::CallbackInfo &info);
};
