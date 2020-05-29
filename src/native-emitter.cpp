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

  virtual void startElement(void *ctx, const char *name, const char **atts)
  {
    this->emitEvent("startElement", std::string(name));
  }
  virtual void endElement(void *ctx, const char *name, size_t len)
  {
    this->emitEvent("endElement", std::string(name, len));
  }
  virtual void textHandler(void *ctx, const char *s, size_t len)
  {
    this->emitEvent("text", std::string(s, len));
  }
  virtual void startAttribute(void *ctx, const char *name, size_t nameLen, const char *value, size_t valueLen)
  {
    this->emitEvent("startAttribute", std::string(name, nameLen), std::string(value, valueLen));
  }
  virtual void endAttribute(void *ctx)
  {
    this->emitEvent("endAttribute");
  }
  virtual void cdataHandler(void *ctx, const char *s, size_t len)
  {
    this->emitEvent("cdata", std::string(s, len));
  }
  virtual void commentHandler(void *ctx, const char *s, size_t len)
  {
    this->emitEvent("comment", std::string(s, len));
  }
  virtual void startDocument(void *ctx)
  {
    this->emitEvent("startDocument");
  }
  virtual void endDocument(void *ctx)
  {
    this->emitEvent("endDocument");
  }

private:
  const Napi::CallbackInfo *_cbInfo;
  Napi::Env _env = nullptr;
  Napi::Function _emit;

  void emitEvent(std::string eventName)
  {
    _emit.Call(this->_cbInfo->This(), {Napi::String::New(this->_env, eventName)});
  }
  void emitEvent(std::string eventName, std::string data)
  {
    _emit.Call(this->_cbInfo->This(), {Napi::String::New(this->_env, eventName), Napi::String::New(this->_env, data)});
  }
  // TODO(anh): fix this
  void emitEvent(std::string eventName, std::string name, std::string value)
  {
    _emit.Call(this->_cbInfo->This(), {Napi::String::New(this->_env, eventName), Napi::String::New(this->_env, name), Napi::String::New(this->_env, value)});
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