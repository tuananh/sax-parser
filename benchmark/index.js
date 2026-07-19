'use strict'

const benchmark = require('benchmark')
const nodeXml = require('node-xml')
const expat = require('node-expat')
const sax = require('sax')
const Saxophone = require('saxophone')
const EasySAXParser = require('easysax')
const LtxSaxParser = require('ltx/lib/parsers/ltx.js')
const MySaxParser = require('..')

const TARGET_BYTES = 10 * 1024

function generateXml(targetBytes) {
    const parts = ['<root>']
    let size = Buffer.byteLength(parts[0], 'utf8')
    let i = 0

    while (size < targetBytes - Buffer.byteLength('</root>', 'utf8')) {
        const item = `<item id="${i}"><name>item-${i}</name><value>value-${i}</value></item>`
        parts.push(item)
        size += Buffer.byteLength(item, 'utf8')
        i++
    }

    parts.push('</root>')
    return parts.join('')
}

const xml = generateXml(TARGET_BYTES)
const xmlSizeKb = (Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1)
console.log(
    `Generated XML: ${xmlSizeKb} KB (${xml.match(/<item /g).length} items)`
)
console.log(
    'All parsers register noop startElement/endElement/text handlers'
)

const noop = function () {}

function NodeXmlParser() {
    const parser = new nodeXml.SaxParser(function (cb) {
        cb.onStartElementNS(noop)
        cb.onEndElementNS(noop)
        cb.onCharacters(noop)
    })
    this.parse = function (s) {
        parser.parseString(s)
    }
    this.name = 'node-xml'
}

function SaxParser() {
    const parser = sax.parser()
    parser.onopentag = noop
    parser.onclosetag = noop
    parser.ontext = noop
    this.parse = function (s) {
        parser.write(s).close()
    }
    this.name = 'sax'
}

function ThisSaxParser() {
    const parser = new MySaxParser()
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    this.parse = function (s) {
        parser.parse(s)
    }
    this.name = '@tuananh/sax-parser'
}

function ExpatParser() {
    const parser = new expat.Parser()
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    this.parse = function (s) {
        parser.parse(s, false)
    }
    this.name = 'node-expat'
}

function LtxParser() {
    var parser = new LtxSaxParser()
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    this.parse = function (s) {
        parser.write(s)
    }
    this.name = 'ltx'
}

function SaxophoneParser() {
    const parser = new Saxophone()
    parser.on('tagopen', noop)
    parser.on('tagclose', noop)
    parser.on('text', noop)
    this.parse = function (s) {
        parser.parse(s)
    }
    this.name = 'saxophone'
}

function EasysaxParser() {
    const parser = new EasySAXParser()
    parser.on('startNode', noop)
    parser.on('endNode', noop)
    parser.on('textNode', noop)
    this.parse = function (s) {
        parser.parse(s)
    }
    this.name = 'easysax'
}

const parsers = [
    SaxParser,
    ThisSaxParser,
    NodeXmlParser,
    ExpatParser,
    LtxParser,
    SaxophoneParser,
    EasysaxParser,
].map(function (Parser) {
    return new Parser()
})

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
