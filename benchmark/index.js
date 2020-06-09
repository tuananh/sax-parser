'use strict'

const { readFileSync } = require('fs')
const benchmark = require('benchmark')
const nodeXml = require('node-xml')
let libxml = null
const expat = require('node-expat')
const sax = require('sax')
const LtxSaxParser = require('ltx/lib/parsers/ltx')
const MySaxParser = require('..')
const xml = readFileSync(__dirname + '/test.xml', 'utf-8')

try {
    libxml = require('libxmljs')
} catch (err) {
    console.error('Cannot load libxmljs, please install it manually:', err)
}

function NodeXmlParser() {
    const parser = new nodeXml.SaxParser(function (cb) {})
    this.parse = function (s) {
        parser.parseString(s)
    }
    this.name = 'node-xml'
}
function LibXmlJsParser() {
    const parser = new libxml.SaxPushParser(function (cb) {})
    this.parse = function (s) {
        parser.push(s, false)
    }
    this.name = 'libxmljs'
}
function SaxParser() {
    const parser = sax.parser()
    this.parse = function (s) {
        parser.write(s).close()
    }
    this.name = 'sax'
}

function ThisSaxParser() {
    const parser = new MySaxParser()
    this.parse = function (s) {
        parser.parse(s)
    }
    this.name = '@tuananh/sax-parser'
}

function ExpatParser() {
    const parser = new expat.Parser()
    this.parse = function (s) {
        parser.parse(s, false)
    }
    this.name = 'node-expat'
}

function LtxParser() {
    var parser = new LtxSaxParser()
    this.parse = function (s) {
        parser.write(s)
    }
    this.name = 'ltx'
}

const parsers = [
    SaxParser,
    ThisSaxParser,
    NodeXmlParser,
    ExpatParser,
    LtxParser,
].map(function (Parser) {
    return new Parser()
})

if (libxml) {
    parsers.push(new LibXmlJsParser())
}

const suite = new benchmark.Suite('parse')

parsers.forEach(function (parser) {
    parser.parse('<r>')
    suite.add(parser.name, function () {
        parser.parse(xml)
    })
})

suite
    .on('cycle', function (event) {
        console.log(event.target.toString())
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map('name'))
    })
    .run({ async: true })
