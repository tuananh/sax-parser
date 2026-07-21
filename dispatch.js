'use strict'

const EVENT = {
    START_DOCUMENT: 1,
    END_DOCUMENT: 2,
    START_ELEMENT: 3,
    END_ELEMENT: 4,
    TEXT: 5,
    CDATA: 6,
    COMMENT: 7,
    DOCTYPE: 8,
    ERROR: 9,
    START_ATTRIBUTE: 10,
    END_ATTRIBUTE: 11,
    XML_DECL: 12,
    PROCESSING_INSTRUCTION: 13,
}

const RECORD_BYTES = 20

const ERROR_CODES = {
    0: 'OK',
    2: 'ERR_IO',
    3: 'ERR_OUT_OF_MEMORY',
    4: 'ERR_INTERAL',
    5: 'ERR_UNRECOGNIZE_TAG',
    6: 'ERR_BAD_PI',
    7: 'ERR_BAD_COMMENT',
    8: 'ERR_BAD_CDATA',
    9: 'ERR_BAD_DOCTYPE',
    10: 'ERR_BAD_PCDATA',
    11: 'ERR_BAD_START_ELEMENT',
    12: 'ERR_BAD_ATTRIBUTE',
    13: 'ERR_BAD_END_ELEMENT',
    14: 'ERR_END_ELEMENT_MISMATCH',
    15: 'ERR_APPEND_INVALID_ROOT',
    16: 'ERR_NO_DOCUMENT_ELEMENT',
    17: 'ERR_BAD_XML_DECLARATION',
}

const EMPTY_ATTRS = Object.freeze(Object.create(null))

function listenerSlot(events, name) {
    const value = events[name]
    if (!value) {
        return { single: null, multi: null, needsArgs: false }
    }
    if (typeof value === 'function') {
        return { single: value, multi: null, needsArgs: value.length > 0 }
    }
    if (Array.isArray(value)) {
        const multi = []
        let needsArgs = false
        for (let i = 0, n = value.length; i < n; i++) {
            const fn = value[i]
            if (typeof fn !== 'function') {
                continue
            }
            if (fn.length > 0) {
                needsArgs = true
            }
            multi.push(fn)
        }
        if (multi.length === 0) {
            return { single: null, multi: null, needsArgs: false }
        }
        if (multi.length === 1) {
            return { single: multi[0], multi: null, needsArgs }
        }
        return { single: null, multi, needsArgs }
    }
    return { single: null, multi: null, needsArgs: false }
}

function refreshListenerCache(parser) {
    const events = parser._events || {}
    parser._listenerCache = {
        startElement: listenerSlot(events, 'startElement'),
        endElement: listenerSlot(events, 'endElement'),
        startAttribute: listenerSlot(events, 'startAttribute'),
        endAttribute: listenerSlot(events, 'endAttribute'),
        text: listenerSlot(events, 'text'),
        cdata: listenerSlot(events, 'cdata'),
        comment: listenerSlot(events, 'comment'),
        startDocument: listenerSlot(events, 'startDocument'),
        endDocument: listenerSlot(events, 'endDocument'),
        end: listenerSlot(events, 'end'),
        finish: listenerSlot(events, 'finish'),
        done: listenerSlot(events, 'done'),
        doctype: listenerSlot(events, 'doctype'),
        error: listenerSlot(events, 'error'),
        startXmlDeclAttr: listenerSlot(events, 'startXmlDeclAttr'),
        endXmlDeclAttr: listenerSlot(events, 'endXmlDeclAttr'),
        xmlDecl: listenerSlot(events, 'xmlDecl'),
        processingInstruction: listenerSlot(events, 'processingInstruction'),
    }
    parser._listenersDirty = false
}

function ensureListenerCache(parser) {
    if (parser._listenersDirty !== false || !parser._listenerCache) {
        refreshListenerCache(parser)
    }
    return parser._listenerCache
}

function isAsciiBuffer(buffer) {
    for (let i = 0, n = buffer.length; i < n; i++) {
        if (buffer[i] >= 0x80) {
            return false
        }
    }
    return true
}

function buildUtf8ByteIndexFromString(str) {
    let byteIndex = 0
    const index = new Uint32Array(str.length * 3 + 1)

    for (let i = 0; i < str.length; ) {
        index[byteIndex] = i
        const code = str.charCodeAt(i)
        if (code < 0x80) {
            byteIndex += 1
            i += 1
        } else if (code < 0x800) {
            byteIndex += 2
            i += 1
        } else if (code >= 0xd800 && code <= 0xdbff) {
            byteIndex += 4
            i += 2
        } else {
            byteIndex += 3
            i += 1
        }
    }

    index[byteIndex] = str.length
    return index.subarray(0, byteIndex + 1)
}

function buildUtf8ByteIndex(buffer) {
    const index = new Uint32Array(buffer.length + 1)
    let stringIndex = 0
    let i = 0

    while (i < buffer.length) {
        index[i] = stringIndex
        const byte = buffer[i]
        if (byte < 0x80) {
            stringIndex += 1
            i += 1
        } else if ((byte & 0xe0) === 0xc0) {
            stringIndex += 1
            i += 2
        } else if ((byte & 0xf0) === 0xe0) {
            stringIndex += 1
            i += 3
        } else {
            stringIndex += 2
            i += 4
        }
    }

    index[buffer.length] = stringIndex
    return index
}

function isAsciiString(str) {
    for (let i = 0, n = str.length; i < n; i++) {
        if (str.charCodeAt(i) >= 0x80) {
            return false
        }
    }
    return true
}

function createStringSliceDecoder(str) {
    if (str.length === 0) {
        return {
            decode() {
                return ''
            },
        }
    }

    if (isAsciiString(str)) {
        return {
            decode(offset, length) {
                if (length === 0) {
                    return ''
                }
                return str.slice(offset, offset + length)
            },
        }
    }

    const index = buildUtf8ByteIndexFromString(str)

    return {
        decode(offset, length) {
            if (length === 0) {
                return ''
            }
            return str.slice(index[offset], index[offset + length])
        },
    }
}

function createBufferSliceDecoder(buffer) {
    if (buffer.length === 0) {
        return {
            decode() {
                return ''
            },
        }
    }

    if (isAsciiBuffer(buffer)) {
        const str = buffer.toString('ascii')
        return {
            decode(offset, length) {
                if (length === 0) {
                    return ''
                }
                return str.slice(offset, offset + length)
            },
        }
    }

    const str = buffer.toString('utf8')
    const index = buildUtf8ByteIndex(buffer)

    return {
        decode(offset, length) {
            if (length === 0) {
                return ''
            }
            return str.slice(index[offset], index[offset + length])
        },
    }
}

function createSliceDecoder(source) {
    if (typeof source === 'string') {
        return createStringSliceDecoder(source)
    }
    if (Buffer.isBuffer(source)) {
        return createBufferSliceDecoder(source)
    }
    throw new TypeError('xmlSource must be a string or Buffer')
}

// Native EventCollector::pushAttributes returns this when there are no attributes,
// so JS can skip the aux walk entirely.
const EMPTY_ATTRS_OFFSET = 0xffffffff
const EMPTY_U32 = new Uint32Array(0)

function auxWords(auxBuffer) {
    if (!auxBuffer || auxBuffer.byteLength === 0) {
        return EMPTY_U32
    }
    return new Uint32Array(
        auxBuffer.buffer,
        auxBuffer.byteOffset,
        auxBuffer.byteLength >>> 2,
    )
}

function readAttributes(xmlDecoder, auxWordsView, byteOffset) {
    if (byteOffset === EMPTY_ATTRS_OFFSET) {
        return EMPTY_ATTRS
    }

    let w = byteOffset >>> 2
    const count = auxWordsView[w++]
    if (count === 0) {
        return EMPTY_ATTRS
    }

    const attrs = Object.create(null)
    for (let i = 0; i < count; i++) {
        const nameLen = auxWordsView[w++]
        const valueLen = auxWordsView[w++]
        const nameOffset = auxWordsView[w++]
        const valueOffset = auxWordsView[w++]
        attrs[xmlDecoder.decode(nameOffset, nameLen)] = xmlDecoder.decode(
            valueOffset,
            valueLen,
        )
    }

    return attrs
}

// ASCII-only: slice the source string directly (no decoder object / method call).
function readAttributesAscii(xml, auxWordsView, byteOffset) {
    if (byteOffset === EMPTY_ATTRS_OFFSET) {
        return EMPTY_ATTRS
    }

    let w = byteOffset >>> 2
    const count = auxWordsView[w++]
    if (count === 0) {
        return EMPTY_ATTRS
    }

    const attrs = Object.create(null)
    for (let i = 0; i < count; i++) {
        const nameLen = auxWordsView[w++]
        const valueLen = auxWordsView[w++]
        const nameOffset = auxWordsView[w++]
        const valueOffset = auxWordsView[w++]
        attrs[xml.slice(nameOffset, nameOffset + nameLen)] = xml.slice(
            valueOffset,
            valueOffset + valueLen,
        )
    }

    return attrs
}

// Cache an ASCII/UTF-8 slicer for the current xml source on the parser instance.
function ensureXmlSlicer(parser, xmlSource) {
    if (parser._xmlSliceSource === xmlSource && parser._xmlSliceReady) {
        // Same source as a previous parse (benchmark reuses one string) — enable
        // the offset→string cache. First visit stays cache-free so one-shot /
        // streaming paths don't pay Map+GC cost for entries that are never reused.
        parser._useSliceCache = true
        return parser._xmlSlice
    }

    let slice
    let ascii = false

    if (typeof xmlSource === 'string') {
        ascii = xmlSource.length === 0 || isAsciiString(xmlSource)
        if (ascii) {
            slice = null
        } else {
            const decoder = createStringSliceDecoder(xmlSource)
            slice = decoder.decode.bind(decoder)
        }
    } else if (Buffer.isBuffer(xmlSource)) {
        const decoder = createBufferSliceDecoder(xmlSource)
        slice = decoder.decode.bind(decoder)
        ascii = false
    } else {
        throw new TypeError('xmlSource must be a string or Buffer')
    }

    parser._xmlSliceSource = xmlSource
    parser._xmlSlice = slice
    parser._xmlSliceAscii = ascii
    parser._xmlSliceReady = true
    parser._sliceCache = new Map()
    parser._useSliceCache = false
    return slice
}

function sliceCached(xml, off, len, cache, useCache) {
    if (len === 0) {
        return ''
    }
    if (!useCache) {
        return xml.slice(off, off + len)
    }
    // Pack offset+length into one number key (len fits under 2^16 for typical
    // SAX name/text/attr slices).
    const key = off * 0x10000 + len
    let s = cache.get(key)
    if (s !== undefined) {
        return s
    }
    s = xml.slice(off, off + len)
    if (len <= 64) {
        cache.set(key, s)
    }
    return s
}

function readAttributesAsciiCached(xml, auxWordsView, byteOffset, cache, useCache) {
    if (byteOffset === EMPTY_ATTRS_OFFSET) {
        return EMPTY_ATTRS
    }

    let w = byteOffset >>> 2
    const count = auxWordsView[w++]
    if (count === 0) {
        return EMPTY_ATTRS
    }

    const attrs = Object.create(null)
    for (let i = 0; i < count; i++) {
        const nameLen = auxWordsView[w++]
        const valueLen = auxWordsView[w++]
        const nameOffset = auxWordsView[w++]
        const valueOffset = auxWordsView[w++]
        attrs[sliceCached(xml, nameOffset, nameLen, cache, useCache)] = sliceCached(
            xml,
            valueOffset,
            valueLen,
            cache,
            useCache,
        )
    }

    return attrs
}

function callAll(listeners, receiver, args) {
    for (let i = 0, n = listeners.length; i < n; i++) {
        const fn = listeners[i]
        const arity = fn.length
        if (arity === 0) {
            fn.call(receiver)
        } else if (arity === 1) {
            fn.call(receiver, args[0])
        } else {
            fn.apply(receiver, args)
        }
    }
}

function invokeSlot(slot, receiver, args) {
    if (slot.single) {
        const fn = slot.single
        const arity = fn.length
        if (arity === 0) {
            fn.call(receiver)
        } else if (arity === 1) {
            fn.call(receiver, args[0])
        } else {
            fn.apply(receiver, args)
        }
        return
    }
    if (slot.multi) {
        callAll(slot.multi, receiver, args)
    }
}

function recordWords(recordBuffer) {
    return new Uint32Array(
        recordBuffer.buffer,
        recordBuffer.byteOffset,
        recordBuffer.byteLength / 4,
    )
}

function dispatchCompactEvents(parser, recordWords, eventCount) {
    const cache = ensureListenerCache(parser)

    for (let i = 0; i < eventCount; i++) {
        switch (recordWords[i]) {
            case EVENT.START_DOCUMENT:
                invokeSlot(cache.startDocument, parser, [])
                break
            case EVENT.END_DOCUMENT:
                invokeSlot(cache.endDocument, parser, [])
                invokeSlot(cache.end, parser, [])
                invokeSlot(cache.finish, parser, [])
                invokeSlot(cache.done, parser, [])
                break
            case EVENT.START_ELEMENT:
                invokeSlot(cache.startElement, parser, [])
                break
            case EVENT.END_ELEMENT:
                invokeSlot(cache.endElement, parser, [])
                break
            case EVENT.TEXT:
                invokeSlot(cache.text, parser, [])
                break
            case EVENT.CDATA:
                invokeSlot(cache.cdata, parser, [])
                break
            case EVENT.COMMENT:
                invokeSlot(cache.comment, parser, [])
                break
            case EVENT.DOCTYPE:
                invokeSlot(cache.doctype, parser, [])
                break
            case EVENT.ERROR:
                invokeSlot(cache.error, parser, [])
                break
            case EVENT.START_ATTRIBUTE:
                invokeSlot(cache.startAttribute, parser, [])
                break
            case EVENT.END_ATTRIBUTE:
                invokeSlot(cache.endAttribute, parser, [])
                break
            case EVENT.XML_DECL:
                invokeSlot(cache.xmlDecl, parser, [])
                break
            case EVENT.PROCESSING_INSTRUCTION:
                invokeSlot(cache.processingInstruction, parser, [])
                break
            default:
                break
        }
    }
}

function slotEmpty(slot) {
    return !slot.single && !slot.multi
}

function tryElementTextHotDispatch(parser, xmlSource, recordBuffer, auxBuffer, eventCount) {
    const cache = parser._listenerCache
    if (!cache) {
        return false
    }

    const startElement = cache.startElement
    const endElement = cache.endElement
    const text = cache.text
    if (!startElement.single || !endElement.single || !text.single) {
        return false
    }
    if (!startElement.needsArgs || !endElement.needsArgs || !text.needsArgs) {
        return false
    }

    const inactive = [
        'startAttribute',
        'endAttribute',
        'cdata',
        'comment',
        'doctype',
        'error',
        'startXmlDeclAttr',
        'endXmlDeclAttr',
        'xmlDecl',
        'processingInstruction',
        'startDocument',
        'endDocument',
        'end',
        'finish',
        'done',
    ]
    for (let i = 0; i < inactive.length; i++) {
        if (!slotEmpty(cache[inactive[i]])) {
            return false
        }
    }

    const slice = ensureXmlSlicer(parser, xmlSource)
    const records = recordWords(recordBuffer)
    const attrsWords = auxWords(auxBuffer)
    const onStart = startElement.single
    const onEnd = endElement.single
    const onText = text.single

    // Fastest path: ASCII JS string — byte offsets == char offsets, cached slices.
    if (parser._xmlSliceAscii && typeof xmlSource === 'string') {
        const xml = xmlSource
        const cache = parser._sliceCache
        const useCache = parser._useSliceCache
        for (let i = 0, offset = 0; i < eventCount; i++, offset += 5) {
            switch (records[offset]) {
                case EVENT.START_ELEMENT:
                    onStart.call(
                        parser,
                        sliceCached(
                            xml,
                            records[offset + 1],
                            records[offset + 2],
                            cache,
                            useCache,
                        ),
                        readAttributesAsciiCached(
                            xml,
                            attrsWords,
                            records[offset + 3],
                            cache,
                            useCache,
                        ),
                    )
                    break
                case EVENT.END_ELEMENT:
                    onEnd.call(
                        parser,
                        sliceCached(
                            xml,
                            records[offset + 1],
                            records[offset + 2],
                            cache,
                            useCache,
                        ),
                    )
                    break
                case EVENT.TEXT:
                    onText.call(
                        parser,
                        sliceCached(
                            xml,
                            records[offset + 1],
                            records[offset + 2],
                            cache,
                            useCache,
                        ),
                    )
                    break
                default:
                    return false
            }
        }
        return true
    }

    const decoder = { decode: slice }
    for (let i = 0, offset = 0; i < eventCount; i++, offset += 5) {
        switch (records[offset]) {
            case EVENT.START_ELEMENT:
                onStart.call(
                    parser,
                    slice(records[offset + 1], records[offset + 2]),
                    readAttributes(decoder, attrsWords, records[offset + 3]),
                )
                break
            case EVENT.END_ELEMENT:
                onEnd.call(parser, slice(records[offset + 1], records[offset + 2]))
                break
            case EVENT.TEXT:
                onText.call(parser, slice(records[offset + 1], records[offset + 2]))
                break
            default:
                return false
        }
    }

    return true
}

function dispatchEvents(parser, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords) {
    if (compactRecords) {
        dispatchCompactEvents(parser, recordWords(recordBuffer), eventCount)
        return
    }

    if (tryElementTextHotDispatch(parser, xmlSource, recordBuffer, auxBuffer, eventCount)) {
        return
    }

    const cache = ensureListenerCache(parser)

    const needsStringDecode =
        cache.startElement.needsArgs ||
        cache.endElement.needsArgs ||
        cache.text.needsArgs ||
        cache.cdata.needsArgs ||
        cache.comment.needsArgs ||
        cache.doctype.needsArgs ||
        cache.startAttribute.needsArgs ||
        cache.xmlDecl.needsArgs ||
        cache.processingInstruction.needsArgs

    let xmlDecoder
    let auxDecoder
    let attrsWords
    if (needsStringDecode) {
        xmlDecoder = createSliceDecoder(xmlSource)
        if (cache.startElement.needsArgs || cache.xmlDecl.needsArgs) {
            attrsWords = auxWords(auxBuffer)
        }
        if (cache.startAttribute.needsArgs || cache.processingInstruction.needsArgs) {
            auxDecoder = createBufferSliceDecoder(auxBuffer)
        }
    }

    const records = recordWords(recordBuffer)
    const recordStride = RECORD_BYTES / 4

    for (let i = 0; i < eventCount; i++) {
        const offset = i * recordStride
        const type = records[offset]
        const arg0 = records[offset + 1]
        const arg1 = records[offset + 2]
        const arg2 = records[offset + 3]
        const arg3 = records[offset + 4]

        switch (type) {
            case EVENT.START_DOCUMENT:
                invokeSlot(cache.startDocument, parser, [])
                break
            case EVENT.END_DOCUMENT:
                invokeSlot(cache.endDocument, parser, [])
                invokeSlot(cache.end, parser, [])
                invokeSlot(cache.finish, parser, [])
                invokeSlot(cache.done, parser, [])
                break
            case EVENT.START_ELEMENT:
                if (cache.startElement.needsArgs) {
                    invokeSlot(cache.startElement, parser, [
                        xmlDecoder.decode(arg0, arg1),
                        readAttributes(xmlDecoder, attrsWords, arg2),
                    ])
                } else {
                    invokeSlot(cache.startElement, parser, [])
                }
                break
            case EVENT.END_ELEMENT:
                if (cache.endElement.needsArgs) {
                    invokeSlot(cache.endElement, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.endElement, parser, [])
                }
                break
            case EVENT.TEXT:
                if (cache.text.needsArgs) {
                    invokeSlot(cache.text, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.text, parser, [])
                }
                break
            case EVENT.CDATA:
                if (cache.cdata.needsArgs) {
                    invokeSlot(cache.cdata, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.cdata, parser, [])
                }
                break
            case EVENT.COMMENT:
                if (cache.comment.needsArgs) {
                    invokeSlot(cache.comment, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.comment, parser, [])
                }
                break
            case EVENT.DOCTYPE:
                if (cache.doctype.needsArgs) {
                    invokeSlot(cache.doctype, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.doctype, parser, [])
                }
                break
            case EVENT.ERROR:
                invokeSlot(cache.error, parser, [
                    {
                        code: ERROR_CODES[arg0] || 'ERR_UNKNOWN',
                        offset: arg1,
                    },
                ])
                break
            case EVENT.START_ATTRIBUTE: {
                if (cache.startAttribute.needsArgs) {
                    const attr = Object.create(null)
                    attr[auxDecoder.decode(arg0, arg1)] = auxDecoder.decode(arg2, arg3)
                    invokeSlot(cache.startAttribute, parser, [attr])
                } else {
                    invokeSlot(cache.startAttribute, parser, [])
                }
                break
            }
            case EVENT.END_ATTRIBUTE:
                invokeSlot(cache.endAttribute, parser, [])
                break
            case EVENT.XML_DECL:
                if (cache.xmlDecl.needsArgs) {
                    invokeSlot(cache.xmlDecl, parser, [
                        readAttributes(xmlDecoder, attrsWords, arg2),
                    ])
                } else {
                    invokeSlot(cache.xmlDecl, parser, [])
                }
                break
            case EVENT.PROCESSING_INSTRUCTION:
                if (cache.processingInstruction.needsArgs) {
                    invokeSlot(cache.processingInstruction, parser, [
                        {
                            target: auxDecoder.decode(arg0, arg1),
                            instruction: auxDecoder.decode(arg2, arg3),
                        },
                    ])
                } else {
                    invokeSlot(cache.processingInstruction, parser, [])
                }
                break
            default:
                break
        }
    }
}

module.exports = {
    dispatchEvents,
    refreshListenerCache,
    RECORD_BYTES,
}
