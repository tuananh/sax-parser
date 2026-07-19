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
const COMPACT_RECORD_BYTES = 4

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

function gatherListeners(events, name) {
    const value = events[name]
    if (!value) {
        return []
    }
    if (typeof value === 'function') {
        return [value]
    }
    if (Array.isArray(value)) {
        return value.filter((fn) => typeof fn === 'function')
    }
    return []
}

function refreshListenerCache(parser) {
    const events = parser._events || {}
    parser._listenerCache = {
        startElement: gatherListeners(events, 'startElement'),
        endElement: gatherListeners(events, 'endElement'),
        startAttribute: gatherListeners(events, 'startAttribute'),
        endAttribute: gatherListeners(events, 'endAttribute'),
        text: gatherListeners(events, 'text'),
        cdata: gatherListeners(events, 'cdata'),
        comment: gatherListeners(events, 'comment'),
        startDocument: gatherListeners(events, 'startDocument'),
        endDocument: gatherListeners(events, 'endDocument'),
        end: gatherListeners(events, 'end'),
        finish: gatherListeners(events, 'finish'),
        done: gatherListeners(events, 'done'),
        doctype: gatherListeners(events, 'doctype'),
        error: gatherListeners(events, 'error'),
        startXmlDeclAttr: gatherListeners(events, 'startXmlDeclAttr'),
        endXmlDeclAttr: gatherListeners(events, 'endXmlDeclAttr'),
        xmlDecl: gatherListeners(events, 'xmlDecl'),
        processingInstruction: gatherListeners(events, 'processingInstruction'),
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

function createStringSliceDecoder(str) {
    if (str.length === 0) {
        return {
            decode() {
                return ''
            },
        }
    }

    let ascii = true
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) >= 0x80) {
            ascii = false
            break
        }
    }

    if (ascii) {
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
    return createBufferSliceDecoder(source)
}


function readAttributes(xmlDecoder, auxBuffer, offset) {
    const count = auxBuffer.readUInt32LE(offset)
    if (count === 0) {
        return EMPTY_ATTRS
    }

    let cursor = offset + 4
    const attrs = Object.create(null)

    for (let i = 0; i < count; i++) {
        const nameLen = auxBuffer.readUInt32LE(cursor)
        cursor += 4
        const valueLen = auxBuffer.readUInt32LE(cursor)
        cursor += 4
        const nameOffset = auxBuffer.readUInt32LE(cursor)
        cursor += 4
        const valueOffset = auxBuffer.readUInt32LE(cursor)
        cursor += 4
        attrs[xmlDecoder.decode(nameOffset, nameLen)] = xmlDecoder.decode(
            valueOffset,
            valueLen,
        )
    }

    return attrs
}

function listenersNeedArgs(listeners) {
    for (let i = 0, n = listeners.length; i < n; i++) {
        if (listeners[i].length > 0) {
            return true
        }
    }
    return false
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

function recordWords(recordBuffer) {
    return new Uint32Array(
        recordBuffer.buffer,
        recordBuffer.byteOffset,
        recordBuffer.byteLength / 4,
    )
}

function dispatchCompactEvents(parser, recordWords, eventCount) {
    const cache = ensureListenerCache(parser)

    const startDocument = cache.startDocument
    const endDocument = cache.endDocument
    const end = cache.end
    const finish = cache.finish
    const done = cache.done
    const startElement = cache.startElement
    const endElement = cache.endElement
    const text = cache.text
    const cdata = cache.cdata
    const comment = cache.comment
    const doctype = cache.doctype
    const error = cache.error
    const startAttribute = cache.startAttribute
    const endAttribute = cache.endAttribute
    const xmlDecl = cache.xmlDecl
    const processingInstruction = cache.processingInstruction

    for (let i = 0; i < eventCount; i++) {
        const type = recordWords[i]

        switch (type) {
            case EVENT.START_DOCUMENT:
                callAll(startDocument, parser, [])
                break
            case EVENT.END_DOCUMENT:
                if (endDocument.length) callAll(endDocument, parser, [])
                if (end.length) callAll(end, parser, [])
                if (finish.length) callAll(finish, parser, [])
                if (done.length) callAll(done, parser, [])
                break
            case EVENT.START_ELEMENT:
                callAll(startElement, parser, [])
                break
            case EVENT.END_ELEMENT:
                callAll(endElement, parser, [])
                break
            case EVENT.TEXT:
                callAll(text, parser, [])
                break
            case EVENT.CDATA:
                callAll(cdata, parser, [])
                break
            case EVENT.COMMENT:
                callAll(comment, parser, [])
                break
            case EVENT.DOCTYPE:
                callAll(doctype, parser, [])
                break
            case EVENT.ERROR:
                callAll(error, parser, [])
                break
            case EVENT.START_ATTRIBUTE:
                callAll(startAttribute, parser, [])
                break
            case EVENT.END_ATTRIBUTE:
                callAll(endAttribute, parser, [])
                break
            case EVENT.XML_DECL:
                callAll(xmlDecl, parser, [])
                break
            case EVENT.PROCESSING_INSTRUCTION:
                callAll(processingInstruction, parser, [])
                break
            default:
                break
        }
    }
}

function dispatchEvents(parser, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords) {
    if (compactRecords) {
        dispatchCompactEvents(parser, recordWords(recordBuffer), eventCount)
        return
    }

    const cache = ensureListenerCache(parser)

    const startDocument = cache.startDocument
    const endDocument = cache.endDocument
    const end = cache.end
    const finish = cache.finish
    const done = cache.done
    const startElement = cache.startElement
    const endElement = cache.endElement
    const text = cache.text
    const cdata = cache.cdata
    const comment = cache.comment
    const doctype = cache.doctype
    const error = cache.error
    const startAttribute = cache.startAttribute
    const endAttribute = cache.endAttribute
    const xmlDecl = cache.xmlDecl
    const processingInstruction = cache.processingInstruction

    const startElementNeedsArgs = listenersNeedArgs(startElement)
    const endElementNeedsArgs = listenersNeedArgs(endElement)
    const textNeedsArgs = listenersNeedArgs(text)
    const cdataNeedsArgs = listenersNeedArgs(cdata)
    const commentNeedsArgs = listenersNeedArgs(comment)
    const doctypeNeedsArgs = listenersNeedArgs(doctype)
    const startAttributeNeedsArgs = listenersNeedArgs(startAttribute)
    const xmlDeclNeedsArgs = listenersNeedArgs(xmlDecl)
    const processingInstructionNeedsArgs = listenersNeedArgs(processingInstruction)

    const needsStringDecode =
        startElementNeedsArgs ||
        endElementNeedsArgs ||
        textNeedsArgs ||
        cdataNeedsArgs ||
        commentNeedsArgs ||
        doctypeNeedsArgs ||
        startAttributeNeedsArgs ||
        xmlDeclNeedsArgs ||
        processingInstructionNeedsArgs

    let xmlDecoder
    let auxDecoder
    if (needsStringDecode) {
        xmlDecoder = createSliceDecoder(xmlSource)
        auxDecoder = createBufferSliceDecoder(auxBuffer)
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
                callAll(startDocument, parser, [])
                break
            case EVENT.END_DOCUMENT:
                if (endDocument.length) callAll(endDocument, parser, [])
                if (end.length) callAll(end, parser, [])
                if (finish.length) callAll(finish, parser, [])
                if (done.length) callAll(done, parser, [])
                break
            case EVENT.START_ELEMENT:
                if (startElementNeedsArgs) {
                    callAll(startElement, parser, [
                        xmlDecoder.decode(arg0, arg1),
                        readAttributes(xmlDecoder, auxBuffer, arg2),
                    ])
                } else {
                    callAll(startElement, parser, [])
                }
                break
            case EVENT.END_ELEMENT:
                if (endElementNeedsArgs) {
                    callAll(endElement, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    callAll(endElement, parser, [])
                }
                break
            case EVENT.TEXT:
                if (textNeedsArgs) {
                    callAll(text, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    callAll(text, parser, [])
                }
                break
            case EVENT.CDATA:
                if (cdataNeedsArgs) {
                    callAll(cdata, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    callAll(cdata, parser, [])
                }
                break
            case EVENT.COMMENT:
                if (commentNeedsArgs) {
                    callAll(comment, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    callAll(comment, parser, [])
                }
                break
            case EVENT.DOCTYPE:
                if (doctypeNeedsArgs) {
                    callAll(doctype, parser, [xmlDecoder.decode(arg0, arg1)])
                } else {
                    callAll(doctype, parser, [])
                }
                break
            case EVENT.ERROR:
                callAll(error, parser, [
                    {
                        code: ERROR_CODES[arg0] || 'ERR_UNKNOWN',
                        offset: arg1,
                    },
                ])
                break
            case EVENT.START_ATTRIBUTE: {
                if (startAttributeNeedsArgs) {
                    const attr = Object.create(null)
                    attr[auxDecoder.decode(arg0, arg1)] = auxDecoder.decode(arg2, arg3)
                    callAll(startAttribute, parser, [attr])
                } else {
                    callAll(startAttribute, parser, [])
                }
                break
            }
            case EVENT.END_ATTRIBUTE:
                callAll(endAttribute, parser, [])
                break
            case EVENT.XML_DECL:
                if (xmlDeclNeedsArgs) {
                    callAll(xmlDecl, parser, [readAttributes(xmlDecoder, auxBuffer, arg2)])
                } else {
                    callAll(xmlDecl, parser, [])
                }
                break
            case EVENT.PROCESSING_INSTRUCTION:
                if (processingInstructionNeedsArgs) {
                    callAll(processingInstruction, parser, [
                        {
                            target: auxDecoder.decode(arg0, arg1),
                            instruction: auxDecoder.decode(arg2, arg3),
                        },
                    ])
                } else {
                    callAll(processingInstruction, parser, [])
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
}
