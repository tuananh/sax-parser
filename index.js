'use strict'

const EventEmitter = require('events').EventEmitter
const Stream = require('stream').Stream
const SaxParser = require('node-gyp-build')(__dirname).SaxParser
const inherits = require('util').inherits

inherits(SaxParser, EventEmitter)
inherits(SaxParser, Stream)

SaxParser.prototype.write = function (data) {
    const result = this.parse(data)
    return result
}

SaxParser.prototype.end = function (data) {
    const result = this.parse(data || '', true)
}

module.exports = SaxParser
