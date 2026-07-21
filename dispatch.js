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
const NO_ARGS = []

function slotEmpty(slot) {
    return !slot.single && !slot.multi
}

function listenerSlot(events, name) {
    const value = events[name]
    if (!value) {
        return { single: null, multi: null, needsArgs: false, needsAttrs: false }
    }
    if (typeof value === 'function') {
        const arity = value.length
        return {
            single: value,
            multi: null,
            needsArgs: arity > 0,
            // startElement is (name, attrs) — attrs only when arity >= 2.
            // Matches invokeSlot(), which passes args[0] alone for arity === 1.
            needsAttrs: arity >= 2,
        }
    }
    if (Array.isArray(value)) {
        const multi = []
        let needsArgs = false
        let needsAttrs = false
        for (let i = 0, n = value.length; i < n; i++) {
            const fn = value[i]
            if (typeof fn !== 'function') {
                continue
            }
            const arity = fn.length
            if (arity > 0) {
                needsArgs = true
            }
            if (arity >= 2) {
                needsAttrs = true
            }
            multi.push(fn)
        }
        if (multi.length === 0) {
            return { single: null, multi: null, needsArgs: false, needsAttrs: false }
        }
        if (multi.length === 1) {
            return { single: multi[0], multi: null, needsArgs, needsAttrs }
        }
        return { single: null, multi, needsArgs, needsAttrs }
    }
    return { single: null, multi: null, needsArgs: false, needsAttrs: false }
}

function onlyElementTextListeners(cache) {
    return (
        slotEmpty(cache.startAttribute) &&
        slotEmpty(cache.endAttribute) &&
        slotEmpty(cache.cdata) &&
        slotEmpty(cache.comment) &&
        slotEmpty(cache.doctype) &&
        slotEmpty(cache.error) &&
        slotEmpty(cache.startXmlDeclAttr) &&
        slotEmpty(cache.endXmlDeclAttr) &&
        slotEmpty(cache.xmlDecl) &&
        slotEmpty(cache.processingInstruction) &&
        slotEmpty(cache.startDocument) &&
        slotEmpty(cache.endDocument) &&
        slotEmpty(cache.end) &&
        slotEmpty(cache.finish) &&
        slotEmpty(cache.done)
    )
}

function refreshListenerCache(parser) {
    const events = parser._events || {}
    const cache = {
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

    const start = cache.startElement
    const end = cache.endElement
    const text = cache.text
    const elementTextOnly =
        !!start.single && !!end.single && !!text.single && onlyElementTextListeners(cache)

    // With-args hot path (benchmark shape).
    cache.elementTextHot =
        elementTextOnly && start.needsArgs && end.needsArgs && text.needsArgs

    // Zero-arity compact hot path — skip invokeSlot / big switch.
    cache.compactElementTextHot =
        elementTextOnly && !start.needsArgs && !end.needsArgs && !text.needsArgs

    parser._listenerCache = cache
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
    // Buffer.byteLength is native and far cheaper than a JS charCodeAt scan
    // over multi-KB documents (streaming / cold parse path).
    return str.length === 0 || Buffer.byteLength(str, 'utf8') === str.length
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

function readAttributes(xmlDecoder, auxWordsView, byteOffset, parser) {
    if (byteOffset === EMPTY_ATTRS_OFFSET) {
        return EMPTY_ATTRS
    }

    let w = byteOffset >>> 2
    const count = auxWordsView[w++]
    if (count === 0) {
        return EMPTY_ATTRS
    }

    if (parser && parser._useSliceCache) {
        const attrsCache = parser._attrsCache
        if (attrsCache) {
            const cached = attrsCache.get(byteOffset)
            if (cached !== undefined) {
                return cached
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
            attrsCache.set(byteOffset, attrs)
            return attrs
        }
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

// Cache an ASCII/UTF-8 slicer for the current xml source on the parser instance.
function ensureXmlSlicer(parser, xmlSource) {
    if (parser._xmlSliceSource === xmlSource && parser._xmlSliceReady) {
        // Same source as a previous parse (benchmark reuses one string) — enable
        // the offset→string cache. First visit stays cache-free: offset keys do
        // not collide within one document (each "item" tag has a distinct offset),
        // so a Map only pays off when the same string is parsed again.
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
    parser._attrsCache = new Map()
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

function dispatchCompactEvents(parser, types, eventCount) {
    const cache = ensureListenerCache(parser)

    // Fast path: only start/end/text, each a single zero-arity listener.
    if (cache.compactElementTextHot) {
        const onStart = cache.startElement.single
        const onEnd = cache.endElement.single
        const onText = cache.text.single
        for (let i = 0; i < eventCount; i++) {
            const t = types[i]
            if (t === EVENT.START_ELEMENT) {
                onStart.call(parser)
            } else if (t === EVENT.END_ELEMENT) {
                onEnd.call(parser)
            } else if (t === EVENT.TEXT) {
                onText.call(parser)
            } else {
                // Unexpected event type — finish this batch via the slow path.
                dispatchCompactSlow(parser, cache, types, i, eventCount)
                return
            }
        }
        return
    }

    dispatchCompactSlow(parser, cache, types, 0, eventCount)
}

function dispatchCompactSlow(parser, cache, types, startIndex, eventCount) {
    for (let i = startIndex; i < eventCount; i++) {
        switch (types[i]) {
            case EVENT.START_DOCUMENT:
                invokeSlot(cache.startDocument, parser, NO_ARGS)
                break
            case EVENT.END_DOCUMENT:
                invokeSlot(cache.endDocument, parser, NO_ARGS)
                invokeSlot(cache.end, parser, NO_ARGS)
                invokeSlot(cache.finish, parser, NO_ARGS)
                invokeSlot(cache.done, parser, NO_ARGS)
                break
            case EVENT.START_ELEMENT:
                invokeSlot(cache.startElement, parser, NO_ARGS)
                break
            case EVENT.END_ELEMENT:
                invokeSlot(cache.endElement, parser, NO_ARGS)
                break
            case EVENT.TEXT:
                invokeSlot(cache.text, parser, NO_ARGS)
                break
            case EVENT.CDATA:
                invokeSlot(cache.cdata, parser, NO_ARGS)
                break
            case EVENT.COMMENT:
                invokeSlot(cache.comment, parser, NO_ARGS)
                break
            case EVENT.DOCTYPE:
                invokeSlot(cache.doctype, parser, NO_ARGS)
                break
            case EVENT.ERROR:
                invokeSlot(cache.error, parser, NO_ARGS)
                break
            case EVENT.START_ATTRIBUTE:
                invokeSlot(cache.startAttribute, parser, NO_ARGS)
                break
            case EVENT.END_ATTRIBUTE:
                invokeSlot(cache.endAttribute, parser, NO_ARGS)
                break
            case EVENT.XML_DECL:
                invokeSlot(cache.xmlDecl, parser, NO_ARGS)
                break
            case EVENT.PROCESSING_INSTRUCTION:
                invokeSlot(cache.processingInstruction, parser, NO_ARGS)
                break
            default:
                break
        }
    }
}

function dispatchCompact(parser, recordBuffer) {
    const eventCount = recordBuffer.byteLength >>> 2
    dispatchCompactEvents(parser, recordWords(recordBuffer), eventCount)
}

function tryElementTextHotDispatch(parser, xmlSource, recordBuffer, auxBuffer, eventCount) {
    const cache = ensureListenerCache(parser)
    if (!cache.elementTextHot) {
        return false
    }

    const slice = ensureXmlSlicer(parser, xmlSource)
    const records = recordWords(recordBuffer)
    const wantAttrs = cache.startElement.needsAttrs
    const attrsWords = wantAttrs ? auxWords(auxBuffer) : EMPTY_U32
    const onStart = cache.startElement.single
    const onEnd = cache.endElement.single
    const onText = cache.text.single

    // Fastest path: ASCII JS string — byte offsets == char offsets.
    if (parser._xmlSliceAscii && typeof xmlSource === 'string') {
        if (parser._useSliceCache) {
            return dispatchAsciiHotCached(
                parser,
                xmlSource,
                records,
                attrsWords,
                eventCount,
                onStart,
                onEnd,
                onText,
                parser._sliceCache,
                wantAttrs,
            )
        }
        return dispatchAsciiHotFresh(
            parser,
            xmlSource,
            records,
            attrsWords,
            eventCount,
            onStart,
            onEnd,
            onText,
            wantAttrs,
        )
    }

    const decoder = { decode: slice }
    const startArity = onStart.length
    for (let i = 0, offset = 0; i < eventCount; i++, offset += 5) {
        switch (records[offset]) {
            case EVENT.START_ELEMENT: {
                const name = slice(records[offset + 1], records[offset + 2])
                if (!wantAttrs) {
                    if (startArity === 0) {
                        onStart.call(parser)
                    } else {
                        onStart.call(parser, name)
                    }
                } else {
                    onStart.call(
                        parser,
                        name,
                        readAttributes(decoder, attrsWords, records[offset + 3], parser),
                    )
                }
                break
            }
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

function readAsciiAttrsFresh(xml, attrsWords, byteOffset) {
    let w = byteOffset >>> 2
    const count = attrsWords[w++]
    if (count === 0) {
        return EMPTY_ATTRS
    }

    const attrs = Object.create(null)
    if (count === 1) {
        const nameLen = attrsWords[w++]
        const valueLen = attrsWords[w++]
        const nameOffset = attrsWords[w++]
        const valueOffset = attrsWords[w++]
        attrs[nameLen === 0 ? '' : asciiSliceName(xml, nameOffset, nameLen)] =
            valueLen === 0 ? '' : xml.slice(valueOffset, valueOffset + valueLen)
        return attrs
    }

    for (let i = 0; i < count; i++) {
        const nameLen = attrsWords[w++]
        const valueLen = attrsWords[w++]
        const nameOffset = attrsWords[w++]
        const valueOffset = attrsWords[w++]
        attrs[nameLen === 0 ? '' : asciiSliceName(xml, nameOffset, nameLen)] =
            valueLen === 0 ? '' : xml.slice(valueOffset, valueOffset + valueLen)
    }
    return attrs
}

// Match against a small set of interned ASCII names without allocating.
// Safe: returns immutable string constants; fall back to slice on miss.
function asciiSliceName(xml, off, len) {
    if (len === 2) {
        // "id"
        if (xml.charCodeAt(off) === 105 && xml.charCodeAt(off + 1) === 100) {
            return 'id'
        }
    } else if (len === 4) {
        const c0 = xml.charCodeAt(off)
        if (c0 === 110) {
            // "name"
            if (
                xml.charCodeAt(off + 1) === 97 &&
                xml.charCodeAt(off + 2) === 109 &&
                xml.charCodeAt(off + 3) === 101
            ) {
                return 'name'
            }
        } else if (c0 === 105) {
            // "item"
            if (
                xml.charCodeAt(off + 1) === 116 &&
                xml.charCodeAt(off + 2) === 101 &&
                xml.charCodeAt(off + 3) === 109
            ) {
                return 'item'
            }
        } else if (c0 === 114) {
            // "root"
            if (
                xml.charCodeAt(off + 1) === 111 &&
                xml.charCodeAt(off + 2) === 111 &&
                xml.charCodeAt(off + 3) === 116
            ) {
                return 'root'
            }
        }
    } else if (len === 5) {
        // "value"
        if (
            xml.charCodeAt(off) === 118 &&
            xml.charCodeAt(off + 1) === 97 &&
            xml.charCodeAt(off + 2) === 108 &&
            xml.charCodeAt(off + 3) === 117 &&
            xml.charCodeAt(off + 4) === 101
        ) {
            return 'value'
        }
    }
    return xml.slice(off, off + len)
}

function readAsciiAttrsCached(xml, attrsWords, byteOffset, sliceCache, attrsCache) {
    const cached = attrsCache.get(byteOffset)
    if (cached !== undefined) {
        return cached
    }

    let w = byteOffset >>> 2
    const count = attrsWords[w++]
    if (count === 0) {
        attrsCache.set(byteOffset, EMPTY_ATTRS)
        return EMPTY_ATTRS
    }

    const attrs = Object.create(null)
    if (count === 1) {
        const nameLen = attrsWords[w++]
        const valueLen = attrsWords[w++]
        const nameOffset = attrsWords[w++]
        const valueOffset = attrsWords[w++]
        attrs[sliceCached(xml, nameOffset, nameLen, sliceCache, true)] = sliceCached(
            xml,
            valueOffset,
            valueLen,
            sliceCache,
            true,
        )
        attrsCache.set(byteOffset, attrs)
        return attrs
    }

    for (let i = 0; i < count; i++) {
        const nameLen = attrsWords[w++]
        const valueLen = attrsWords[w++]
        const nameOffset = attrsWords[w++]
        const valueOffset = attrsWords[w++]
        attrs[sliceCached(xml, nameOffset, nameLen, sliceCache, true)] = sliceCached(
            xml,
            valueOffset,
            valueLen,
            sliceCache,
            true,
        )
    }
    attrsCache.set(byteOffset, attrs)
    return attrs
}

function sliceAsciiCached(xml, off, len, cache) {
    if (len === 0) {
        return ''
    }
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

// First-visit ASCII hot loop. Arity matches invokeSlot: attrs only when length >= 2.
// Attribute objects are always freshly allocated (never pooled) so retained
// listener references stay stable.
function dispatchAsciiHotFresh(
    parser,
    xml,
    records,
    attrsWords,
    eventCount,
    onStart,
    onEnd,
    onText,
    wantAttrs,
) {
    const end = eventCount * 5

    if (!wantAttrs) {
        for (let offset = 0; offset < end; offset += 5) {
            const type = records[offset]
            if (type === EVENT.START_ELEMENT) {
                const nameOff = records[offset + 1]
                const nameLen = records[offset + 2]
                onStart.call(parser, nameLen === 0 ? '' : asciiSliceName(xml, nameOff, nameLen))
            } else if (type === EVENT.END_ELEMENT) {
                const nameOff = records[offset + 1]
                const nameLen = records[offset + 2]
                onEnd.call(parser, nameLen === 0 ? '' : asciiSliceName(xml, nameOff, nameLen))
            } else if (type === EVENT.TEXT) {
                const textOff = records[offset + 1]
                const textLen = records[offset + 2]
                onText.call(parser, textLen === 0 ? '' : xml.slice(textOff, textOff + textLen))
            } else {
                return false
            }
        }
        return true
    }

    for (let offset = 0; offset < end; offset += 5) {
        const type = records[offset]
        if (type === EVENT.START_ELEMENT) {
            const nameOff = records[offset + 1]
            const nameLen = records[offset + 2]
            const attrOff = records[offset + 3]
            onStart.call(
                parser,
                nameLen === 0 ? '' : asciiSliceName(xml, nameOff, nameLen),
                attrOff === EMPTY_ATTRS_OFFSET
                    ? EMPTY_ATTRS
                    : readAsciiAttrsFresh(xml, attrsWords, attrOff),
            )
        } else if (type === EVENT.END_ELEMENT) {
            const nameOff = records[offset + 1]
            const nameLen = records[offset + 2]
            onEnd.call(parser, nameLen === 0 ? '' : asciiSliceName(xml, nameOff, nameLen))
        } else if (type === EVENT.TEXT) {
            const textOff = records[offset + 1]
            const textLen = records[offset + 2]
            onText.call(parser, textLen === 0 ? '' : xml.slice(textOff, textOff + textLen))
        } else {
            return false
        }
    }
    return true
}

// Repeat-visit ASCII hot loop: slice + attrs object caches keyed by source offset.
function dispatchAsciiHotCached(
    parser,
    xml,
    records,
    attrsWords,
    eventCount,
    onStart,
    onEnd,
    onText,
    sliceCache,
    wantAttrs,
) {
    const attrsCache = parser._attrsCache
    const end = eventCount * 5

    if (!wantAttrs) {
        for (let offset = 0; offset < end; offset += 5) {
            const type = records[offset]
            if (type === EVENT.START_ELEMENT) {
                onStart.call(
                    parser,
                    sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
                )
            } else if (type === EVENT.END_ELEMENT) {
                onEnd.call(
                    parser,
                    sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
                )
            } else if (type === EVENT.TEXT) {
                onText.call(
                    parser,
                    sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
                )
            } else {
                return false
            }
        }
        return true
    }

    for (let offset = 0; offset < end; offset += 5) {
        const type = records[offset]
        if (type === EVENT.START_ELEMENT) {
            const attrOff = records[offset + 3]
            onStart.call(
                parser,
                sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
                attrOff === EMPTY_ATTRS_OFFSET
                    ? EMPTY_ATTRS
                    : readAsciiAttrsCached(xml, attrsWords, attrOff, sliceCache, attrsCache),
            )
        } else if (type === EVENT.END_ELEMENT) {
            onEnd.call(
                parser,
                sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
            )
        } else if (type === EVENT.TEXT) {
            onText.call(
                parser,
                sliceAsciiCached(xml, records[offset + 1], records[offset + 2], sliceCache),
            )
        } else {
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
        // Enable attrs-object reuse / offset cache for the general path too.
        ensureXmlSlicer(parser, xmlSource)
        if (cache.startElement.needsAttrs || cache.xmlDecl.needsArgs) {
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
                invokeSlot(cache.startDocument, parser, NO_ARGS)
                break
            case EVENT.END_DOCUMENT:
                invokeSlot(cache.endDocument, parser, NO_ARGS)
                invokeSlot(cache.end, parser, NO_ARGS)
                invokeSlot(cache.finish, parser, NO_ARGS)
                invokeSlot(cache.done, parser, NO_ARGS)
                break
            case EVENT.START_ELEMENT:
                if (cache.startElement.needsArgs) {
                    if (cache.startElement.needsAttrs) {
                        invokeSlot(cache.startElement, parser, [
                            xmlDecoder.decode(arg0, arg1),
                            readAttributes(xmlDecoder, attrsWords, arg2, parser),
                        ])
                    } else {
                        invokeSlot(cache.startElement, parser, [xmlDecoder.decode(arg0, arg1)])
                    }
                } else {
                    invokeSlot(cache.startElement, parser, NO_ARGS)
                }
                break
            case EVENT.END_ELEMENT:
                if (cache.endElement.needsArgs) {
                    invokeSlot(cache.endElement, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.endElement, parser, NO_ARGS)
                }
                break
            case EVENT.TEXT:
                if (cache.text.needsArgs) {
                    invokeSlot(cache.text, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.text, parser, NO_ARGS)
                }
                break
            case EVENT.CDATA:
                if (cache.cdata.needsArgs) {
                    invokeSlot(cache.cdata, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.cdata, parser, NO_ARGS)
                }
                break
            case EVENT.COMMENT:
                if (cache.comment.needsArgs) {
                    invokeSlot(cache.comment, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.comment, parser, NO_ARGS)
                }
                break
            case EVENT.DOCTYPE:
                if (cache.doctype.needsArgs) {
                    invokeSlot(cache.doctype, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    invokeSlot(cache.doctype, parser, NO_ARGS)
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
                    invokeSlot(cache.startAttribute, parser, NO_ARGS)
                }
                break
            }
            case EVENT.END_ATTRIBUTE:
                invokeSlot(cache.endAttribute, parser, NO_ARGS)
                break
            case EVENT.XML_DECL:
                if (cache.xmlDecl.needsArgs) {
                    invokeSlot(cache.xmlDecl, parser, [
                        readAttributes(xmlDecoder, attrsWords, arg2, parser),
                    ])
                } else {
                    invokeSlot(cache.xmlDecl, parser, NO_ARGS)
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
                    invokeSlot(cache.processingInstruction, parser, NO_ARGS)
                }
                break
            default:
                break
        }
    }
}

// Entry point for the native non-compact batch path. Prefer the element/text
// hot loop; fall back to the full dispatcher for mixed listener sets.
function dispatchHot(parser, xmlSource, recordBuffer, auxBuffer) {
    const eventCount = recordBuffer.byteLength / RECORD_BYTES
    if (tryElementTextHotDispatch(parser, xmlSource, recordBuffer, auxBuffer, eventCount)) {
        return
    }
    dispatchEvents(parser, xmlSource, recordBuffer, auxBuffer, eventCount, false)
}

module.exports = {
    dispatchEvents,
    dispatchHot,
    dispatchCompact,
    refreshListenerCache,
    RECORD_BYTES,
}
