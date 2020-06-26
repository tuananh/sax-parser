#ifndef __SAXPARSER_MACROS_H__
#define __SAXPARSER_MACROS_H__

#define UNUSED(expr)  \
    do                \
    {                 \
        (void)(expr); \
    } while (0)

#define DISALLOW_ASSIGN(TypeName) void operator=(const TypeName &)
#define DISALLOW_COPY_AND_ASSIGN(TypeName) \
    TypeName(const TypeName &);            \
    DISALLOW_ASSIGN(TypeName)
#define DISALLOW_IMPLICIT_CONSTRUCTORS(TypeName) \
    TypeName();                                  \
    DISALLOW_COPY_AND_ASSIGN(TypeName)

#ifdef NDEBUG
#define ASSERT(x) UNUSED(x)
#else
#include <assert.h>
#define ASSERT(x) assert(x)
#endif

#endif
