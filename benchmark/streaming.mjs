// Chunked streaming benchmark.
//
// index.mjs hands each parser the whole document in a single call, which
// measures batch parsing. Real streaming consumers (network reads, file
// streams) deliver input in small chunks, so this suite feeds the same
// document through many write() calls instead.
//
// Focused on @tuananh/sax-parser vs @eksml/xml. Other parsers are kept
// commented for easy re-enable.
//
// A fresh parser is constructed per iteration for every library so that
// libraries with unknown reuse semantics are treated identically.
import benchmark from 'benchmark'
// import sax from 'sax'
// import nodeXml from 'node-xml'
// import expat from 'node-expat'
// import Saxophone from 'saxophone'
// import EasySAXParser from 'easysax'
// import LtxSaxParser from 'ltx/lib/parsers/ltx.js'
import MySaxParser from '../index.js'
import { createSaxParser as createEksmlSaxParser } from '@eksml/xml/sax'
import { generateXml, chunkString } from './generate-xml.mjs'

const TARGET_BYTES = 10 * 1024
const CHUNK_SIZES = [256, 64]

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

const runners = {
    // sax: function (chunks) {
    //     const parser = sax.parser()
    //     parser.onopentag = noopStart
    //     parser.onclosetag = noopEnd
    //     parser.ontext = noopText
    //     for (const chunk of chunks) parser.write(chunk)
    //     parser.close()
    // },
    '@tuananh/sax-parser': function (chunks) {
        const parser = new MySaxParser()
        parser.on('startElement', noopStart)
        parser.on('endElement', noopEnd)
        parser.on('text', noopText)
        for (const chunk of chunks) parser.write(chunk)
        parser.end()
    },
    // 'node-xml': function (chunks) {
    //     const parser = new nodeXml.SaxParser(function (cb) {
    //         cb.onStartElementNS(noopStart)
    //         cb.onEndElementNS(noopEnd)
    //         cb.onCharacters(noopText)
    //     })
    //     // parseString keeps parser state across calls (continueParsing)
    //     for (const chunk of chunks) parser.parseString(chunk)
    // },
    // 'node-expat': function (chunks) {
    //     const parser = new expat.Parser()
    //     parser.on('startElement', noopStart)
    //     parser.on('endElement', noopEnd)
    //     parser.on('text', noopText)
    //     for (const chunk of chunks) parser.parse(chunk, false)
    //     parser.parse('', true)
    // },
    // ltx: function (chunks) {
    //     const parser = new LtxSaxParser()
    //     parser.on('startElement', noopStart)
    //     parser.on('endElement', noopEnd)
    //     parser.on('text', noopText)
    //     for (const chunk of chunks) parser.write(chunk)
    // },
    // saxophone: function (chunks) {
    //     const parser = new Saxophone()
    //     // attributes arrive as a raw string; parse them like the others do
    //     parser.on('tagopen', function (tag) {
    //         Saxophone.parseAttrs(tag.attrs)
    //     })
    //     parser.on('tagclose', noopEnd)
    //     parser.on('text', noopText)
    //     // saxophone validates document completeness at stream end and emits
    //     // 'error'; without a listener the stream throws
    //     parser.on('error', noopError)
    //     for (const chunk of chunks) parser.write(chunk)
    //     parser.end()
    // },
    // easysax: function (chunks) {
    //     const parser = new EasySAXParser()
    //     // attributes are parsed lazily via getAttr(); call it so easysax
    //     // materializes attributes like the other parsers do
    //     parser.on('startNode', function (name, getAttr) {
    //         getAttr()
    //     })
    //     parser.on('endNode', noopEnd)
    //     parser.on('textNode', noopText)
    //     for (const chunk of chunks) parser.write(chunk)
    //     parser.end()
    // },
    '@eksml/xml': function (chunks) {
        const parser = createEksmlSaxParser()
        parser.on('openTag', noopStart)
        parser.on('closeTag', noopEnd)
        parser.on('text', noopText)
        for (const chunk of chunks) parser.write(chunk)
        parser.close()
    },
}

function runSuite(chunkSize) {
    return new Promise(function (resolve) {
        const chunks = chunkString(xml, chunkSize)
        console.log(
            `\n--- ${chunkSize} B chunks (${chunks.length} writes per document) ---`
        )
        const suite = new benchmark.Suite()
        for (const [name, run] of Object.entries(runners)) {
            run(['<r>', '</r>'])
            suite.add(name, function () {
                run(chunks)
            })
        }
        suite
            .on('cycle', function (event) {
                console.log(event.target.toString())
            })
            .on('complete', function () {
                console.log('Fastest is ' + this.filter('fastest').map('name'))
                resolve()
            })
            .run({ async: true })
    })
}

for (const chunkSize of CHUNK_SIZES) {
    await runSuite(chunkSize)
}
