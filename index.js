'use strict'

const EventEmitter = require('events').EventEmitter
const Stream = require('stream').Stream
const inherits = require('util').inherits

function resolvePlatformTarget() {
    const { platform, arch } = process
    if (platform === 'win32') {
        return `${platform}-${arch}-msvc`
    }
    if (platform === 'linux') {
        const { MUSL, familySync } = require('detect-libc')
        return `${platform}-${arch}-${familySync() === MUSL ? 'musl' : 'gnu'}`
    }
    return `${platform}-${arch}`
}

function loadBinding() {
    const target = resolvePlatformTarget()
    const name = `@tuananh/sax-parser-${target}`

    try {
        return require(name)
    } catch (err) {
        if (err?.code !== 'MODULE_NOT_FOUND') {
            throw err
        }
    }

    try {
        return require('bindings')('sax_parser')
    } catch (err) {
        if (err?.code !== 'MODULE_NOT_FOUND') {
            throw err
        }
    }

    throw new Error(
        `No prebuild or local build of @tuananh/sax-parser found. Tried ${name}. ` +
            `Please ensure it is installed (don't use --no-optional when installing with npm). ` +
            `Otherwise build from source with \`npm_config_build_from_source=true npm install\`.`,
    )
}

const NativeSaxParser = loadBinding().SaxParser
const { dispatchEvents, dispatchHot, dispatchCompact, refreshListenerCache } = require('./dispatch')
const nativeWritev = NativeSaxParser.prototype.writev
const nativeFeed = NativeSaxParser.prototype.feed
const nativeParse = NativeSaxParser.prototype.parse

class SaxParser extends NativeSaxParser {
    parse(data) {
        if (typeof data === 'string' || Buffer.isBuffer(data)) {
            this._xmlSource = data
        }
        try {
            return nativeParse.call(this, data)
        } finally {
            this._xmlSource = null
        }
    }

    feed(data, flush) {
        flush = !!flush

        if (data == null || data === undefined) {
            if (this._pendingChunks && this._pendingChunks.length > 0) {
                if (typeof this._pendingChunks[0] === 'string') {
                    this._xmlSource = this._pendingChunks.join('')
                }
                try {
                    return nativeWritev.call(this, this._pendingChunks, flush)
                } finally {
                    this._xmlSource = null
                    this._pendingChunks = null
                }
            }
            return nativeFeed.call(this, data, flush)
        }

        if (!flush) {
            if (!this._pendingChunks) {
                this._pendingChunks = [data]
            } else {
                this._pendingChunks.push(data)
            }
            return
        }

        if (this._pendingChunks) {
            this._pendingChunks.push(data)
            if (typeof this._pendingChunks[0] === 'string') {
                this._xmlSource = this._pendingChunks.join('')
            }
            try {
                return nativeWritev.call(this, this._pendingChunks, flush)
            } finally {
                this._xmlSource = null
                this._pendingChunks = null
            }
        }

        if (typeof data === 'string') {
            this._xmlSource = data
        }
        try {
            return nativeFeed.call(this, data, flush)
        } finally {
            this._xmlSource = null
        }
    }

    write(data) {
        if (data == null) {
            return this.feed(null, true)
        }
        return this.feed(data, false)
    }

    writev(chunks, flush) {
        if (flush === undefined) {
            flush = false
        }
        return nativeWritev.call(this, chunks, flush)
    }

    end(data) {
        if (data != null) {
            this.feed(data, false)
        }
        return this.feed(null, true)
    }

    _dispatchHot(recordBuffer, auxBuffer) {
        dispatchHot(this, this._xmlSource, recordBuffer, auxBuffer)
    }

    _dispatchCompact(recordBuffer) {
        dispatchCompact(this, recordBuffer)
    }

    _dispatchEvents(xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords) {
        if (this._xmlSource != null) {
            xmlSource = this._xmlSource
        }
        dispatchEvents(this, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords)
    }
}

// Alias native writev as feedv for symmetry with feed().
SaxParser.prototype.feedv = SaxParser.prototype.writev

inherits(SaxParser, EventEmitter)
inherits(SaxParser, Stream)

function markListenersDirty() {
    if (typeof this._markListenersDirty === 'function') {
        this._markListenersDirty()
    }
}

;[
    'on',
    'once',
    'off',
    'removeListener',
    'removeAllListeners',
    'prependListener',
    'prependOnceListener',
    'addListener',
].forEach(function (method) {
    const original = EventEmitter.prototype[method]
    SaxParser.prototype[method] = function () {
        const result = original.apply(this, arguments)
        markListenersDirty.call(this)
        this._listenersDirty = true
        refreshListenerCache(this)
        return result
    }
})

module.exports = SaxParser
