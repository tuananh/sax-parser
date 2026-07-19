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

const SaxParser = loadBinding().SaxParser
const { dispatchEvents } = require('./dispatch')

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
        return result
    }
})

SaxParser.prototype._dispatchEvents = function (
    xmlSource,
    recordBuffer,
    auxBuffer,
    eventCount,
    compactRecords,
) {
    dispatchEvents(this, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords)
}

SaxParser.prototype.write = function (data) {
    if (data == null) {
        return this.feed(null, true)
    }
    return this.feed(data, false)
}

SaxParser.prototype.end = function (data) {
    if (data != null) {
        this.feed(data, false)
    }
    return this.feed(null, true)
}

module.exports = SaxParser
