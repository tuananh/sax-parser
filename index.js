'use strict'

const EventEmitter = require('events').EventEmitter
const Stream = require('stream').Stream
const inherits = require('util').inherits

function loadBinding() {
    let name = `@tuananh/sax-parser-${process.platform}-${process.arch}`
    if (process.platform === 'linux') {
        const { MUSL, familySync } = require('detect-libc')
        if (familySync() === MUSL) {
            name += '-musl'
        } else {
            name += '-gnu'
        }
    }

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

inherits(SaxParser, EventEmitter)
inherits(SaxParser, Stream)

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
