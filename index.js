'use strict'

const EventEmitter = require('events').EventEmitter
const Stream = require('stream').Stream
const SaxParser = require('bindings')('sax_parser').SaxParser
const inherits = require('util').inherits

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
