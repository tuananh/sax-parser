#include <string>
#include <iostream>

#include "native-emitter.h"
#include "sax-parser.h"

using namespace saxparser;

Napi::FunctionReference SaxParser::constructor;

Napi::Object SaxParser::Init(Napi::Env env, Napi::Object exports)
{
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "SaxParser", {InstanceMethod("parse", &SaxParser::Parse)});

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

class MySAXDelegator : public SAXDelegator
{
public:
  MySAXDelegator(const Napi::CallbackInfo *info)
  {
    _cbInfo = info;
    _env = info->Env();
    _emit = info->This().As<Napi::Object>().Get("emit").As<Napi::Function>();
  }
  
  ~MySAXDelegator() {
    _cbInfo = nullptr;
    _env = nullptr;
  }

  void startElement(void *ctx, const char *name, const char **atts)
  {
    Napi::Object attribs = Napi::Object::New(_env);
    while (*atts != nullptr) {
      attribs.Set(*atts++, *atts++);
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
  void startAttribute(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen)
  {
    Napi::Object attrib = Napi::Object::New(_env);
    attrib.Set(std::string(name, nameLen), std::string(value, valueLen));
    this->emitEvent("startAttribute", attrib);
  }
  void endAttribute(void *ctx)
  {
    this->emitEvent("endAttribute");
  }
  void cdataHandler(void *ctx, const char *s, size_t len)
  {
    this->emitEvent("cdata", std::string(s, len));
  }
  void commentHandler(void *ctx, const char *s, size_t len)
  {
    this->emitEvent("comment", std::string(s, len));
  }
  void startDocument(void *ctx)
  {
    this->emitEvent("startDocument");
  }
  void endDocument(void *ctx)
  {
    this->emitEvent("endDocument");
  }
  void doctypeHandler(void *ctx, const char *doctype, size_t len)
  {
    this->emitEvent("doctype", std::string(doctype, len));
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
    _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName), Napi::String::New(_env, data)});
  }
  void emitEvent(std::string eventName, Napi::Object obj)
  {
    _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName), obj});
  }
  void emitEvent(std::string eventName, std::string name, Napi::Object obj) {
    _emit.Call(_cbInfo->This(), {Napi::String::New(_env, eventName), Napi::String::New(_env, name), obj});
  }
};

void SaxParser::Parse(const Napi::CallbackInfo &info)
{
  if (info.Length() < 1)
  {
    throw Napi::Error::New(info.Env(), "Expecting 1 argument.");
  }
  if (!info[0].IsString())
  {
    throw Napi::Error::New(info.Env(), "The parameter must be a string.");
  }

  const char *xml = info[0].As<Napi::String>().Utf8Value().c_str();
  SAXParser *parser = new SAXParser();
  MySAXDelegator *delegator = new MySAXDelegator(&info);

  parser->init("UTF-8");
  parser->setDelegator(delegator);

  parser->parse(xml, std::strlen(xml));
}