'use strict'

const EventEmitter = require('events').EventEmitter
const Stream = require('stream').Stream
const SaxParser = require('bindings')('sax_parser').SaxParser
const inherits = require('util').inherits

inherits(SaxParser, EventEmitter)
inherits(SaxParser, Stream)

SaxParser.prototype.write = function (data) {
    return this.parse(data)
}

SaxParser.prototype.end = function (data) {
    return this.parse(data || '')
}

module.exports = SaxParser
