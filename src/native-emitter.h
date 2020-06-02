#include <napi.h>
class SaxParser : public Napi::ObjectWrap<SaxParser>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    SaxParser(const Napi::CallbackInfo &info);

private:
    static Napi::FunctionReference constructor;

    void Parse(const Napi::CallbackInfo &info);
};