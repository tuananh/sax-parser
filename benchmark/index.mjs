import benchmark from 'benchmark'
// import nodeXml from 'node-xml'
// import expat from 'node-expat'
// import sax from 'sax'
// import Saxophone from 'saxophone'
// import EasySAXParser from 'easysax'
// import LtxSaxParser from 'ltx/lib/parsers/ltx.js'
import MySaxParser from '../index.js'
import { createSaxParser as createEksmlSaxParser } from '@eksml/xml/sax'
import { generateXml } from './generate-xml.mjs'

const TARGET_BYTES = 10 * 1024

const xml = generateXml(TARGET_BYTES)
const xmlSizeKb = (Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1)
console.log(
    `Generated XML: ${xmlSizeKb} KB (${xml.match(/<item /g).length} items)`
)
console.log(
    'All parsers register noop startElement/endElement/text handlers ' +
        '(parameters declared so zero-arity fast paths cannot skip ' +
        'argument decoding)'
)

// The noop handlers declare the parameters their events normally pass.
// @tuananh/sax-parser checks listener arity natively (functionNeedsArgs in
// src/native-emitter.cpp) and skips materializing event arguments — tag
// names, text, attribute objects — when every listener is zero-arity.
// Real consumers need those arguments, so the benchmark must not let any
// parser skip producing them.
/* eslint-disable no-unused-vars */
const noopStart = function (name, attributes) {}
const noopEnd = function (name) {}
const noopText = function (text) {}
// const noopError = function (error) {}
/* eslint-enable no-unused-vars */

// function NodeXmlParser() {
//     const parser = new nodeXml.SaxParser(function (cb) {
//         cb.onStartElementNS(noopStart)
//         cb.onEndElementNS(noopEnd)
//         cb.onCharacters(noopText)
//     })
//     this.parse = function (s) {
//         parser.parseString(s)
//     }
//     this.name = 'node-xml'
// }

// function SaxParser() {
//     const parser = sax.parser()
//     parser.onopentag = noopStart
//     parser.onclosetag = noopEnd
//     parser.ontext = noopText
//     this.parse = function (s) {
//         parser.write(s).close()
//     }
//     this.name = 'sax'
// }

function ThisSaxParser() {
    const parser = new MySaxParser()
    parser.on('startElement', noopStart)
    parser.on('endElement', noopEnd)
    parser.on('text', noopText)
    this.parse = function (s) {
        parser.parse(s)
    }
    this.name = '@tuananh/sax-parser'
}

// function ExpatParser() {
//     const parser = new expat.Parser()
//     parser.on('startElement', noopStart)
//     parser.on('endElement', noopEnd)
//     parser.on('text', noopText)
//     this.parse = function (s) {
//         parser.parse(s, false)
//     }
//     this.name = 'node-expat'
// }

// function LtxParser() {
//     var parser = new LtxSaxParser()
//     parser.on('startElement', noopStart)
//     parser.on('endElement', noopEnd)
//     parser.on('text', noopText)
//     this.parse = function (s) {
//         parser.write(s)
//     }
//     this.name = 'ltx'
// }

// // saxophone (0.8) passes attributes as a raw string and parses them lazily
// // via Saxophone.parseAttrs. Call it so saxophone materializes attributes
// // like the other parsers do.
// function saxophoneTagOpen(tag) {
//     Saxophone.parseAttrs(tag.attrs)
// }

// function SaxophoneParser() {
//     // saxophone is a writable stream and streams are single-use ("write
//     // after end"), so unlike the other parsers it must be constructed per
//     // parse. Constructor cost is included in its numbers by necessity.
//     this.parse = function (s) {
//         const parser = new Saxophone()
//         parser.on('tagopen', saxophoneTagOpen)
//         parser.on('tagclose', noopEnd)
//         parser.on('text', noopText)
//         // saxophone validates document completeness at stream end and emits
//         // 'error'; without a listener the stream throws
//         parser.on('error', noopError)
//         parser.parse(s)
//     }
//     this.name = 'saxophone'
// }

// function EasysaxParser() {
//     const parser = new EasySAXParser()
//     // easysax parses attributes lazily: the startNode handler receives a
//     // getAttr() function and only tokenizes attributes if it is called. The
//     // other parsers materialize attributes eagerly for every open tag, so
//     // call getAttr() here to make easysax do the same work.
//     parser.on('startNode', function (name, getAttr) {
//         getAttr()
//     })
//     parser.on('endNode', noopEnd)
//     parser.on('textNode', noopText)
//     this.parse = function (s) {
//         parser.parse(s)
//     }
//     this.name = 'easysax'
// }

function EksmlParser() {
    const parser = createEksmlSaxParser()
    parser.on('openTag', noopStart)
    parser.on('closeTag', noopEnd)
    parser.on('text', noopText)
    this.parse = function (s) {
        parser.write(s)
        parser.close()
    }
    this.name = '@eksml/xml'
}

const parsers = [
    // SaxParser,
    ThisSaxParser,
    // NodeXmlParser,
    // ExpatParser,
    // LtxParser,
    // SaxophoneParser,
    // EasysaxParser,
    EksmlParser,
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
