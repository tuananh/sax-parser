'use strict'

const EventEmitter = require('events').EventEmitter
const SaxParser = require('bindings')('sax_parser').SaxParser
const inherits = require('util').inherits

inherits(SaxParser, EventEmitter)

module.exports = SaxParser