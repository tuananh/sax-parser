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

function decodeSlice(buf, offset, length) {
    if (length === 0) {
        return ''
    }
    return buf.toString('utf8', offset, offset + length)
}

function readAttributes(auxBuffer, offset) {
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
        const name = decodeSlice(auxBuffer, cursor, nameLen)
        cursor += nameLen
        const value = decodeSlice(auxBuffer, cursor, valueLen)
        cursor += valueLen
        attrs[name] = value
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

function dispatchEvents(parser, xmlBuffer, recordBuffer, auxBuffer, eventCount) {
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

    for (let i = 0; i < eventCount; i++) {
        const offset = i * RECORD_BYTES
        const type = recordBuffer.readUInt32LE(offset)
        const arg0 = recordBuffer.readUInt32LE(offset + 4)
        const arg1 = recordBuffer.readUInt32LE(offset + 8)
        const arg2 = recordBuffer.readUInt32LE(offset + 12)
        const arg3 = recordBuffer.readUInt32LE(offset + 16)

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
                        decodeSlice(xmlBuffer, arg0, arg1),
                        readAttributes(auxBuffer, arg2),
                    ])
                } else {
                    callAll(startElement, parser, [])
                }
                break
            case EVENT.END_ELEMENT:
                if (endElementNeedsArgs) {
                    callAll(endElement, parser, [decodeSlice(xmlBuffer, arg0, arg1)])
                } else {
                    callAll(endElement, parser, [])
                }
                break
            case EVENT.TEXT:
                if (textNeedsArgs) {
                    callAll(text, parser, [decodeSlice(xmlBuffer, arg0, arg1)])
                } else {
                    callAll(text, parser, [])
                }
                break
            case EVENT.CDATA:
                if (cdataNeedsArgs) {
                    callAll(cdata, parser, [decodeSlice(xmlBuffer, arg0, arg1)])
                } else {
                    callAll(cdata, parser, [])
                }
                break
            case EVENT.COMMENT:
                if (commentNeedsArgs) {
                    callAll(comment, parser, [decodeSlice(xmlBuffer, arg0, arg1)])
                } else {
                    callAll(comment, parser, [])
                }
                break
            case EVENT.DOCTYPE:
                if (doctypeNeedsArgs) {
                    callAll(doctype, parser, [decodeSlice(xmlBuffer, arg0, arg1)])
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
                    attr[decodeSlice(auxBuffer, arg0, arg1)] = decodeSlice(auxBuffer, arg2, arg3)
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
                    callAll(xmlDecl, parser, [readAttributes(auxBuffer, arg2)])
                } else {
                    callAll(xmlDecl, parser, [])
                }
                break
            case EVENT.PROCESSING_INSTRUCTION:
                if (processingInstructionNeedsArgs) {
                    callAll(processingInstruction, parser, [
                        {
                            target: decodeSlice(auxBuffer, arg0, arg1),
                            instruction: decodeSlice(auxBuffer, arg2, arg3),
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
