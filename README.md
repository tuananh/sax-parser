sax-parser
[![npm version](https://badgen.net/npm/v/@tuananh/sax-parser)](https://npmjs.com/package/@tuananh/sax-parser)
[![github actions ci](https://github.com/tuananh/sax-parser/workflows/CI/badge.svg)](https://github.com/tuananh/sax-parser/actions)
[![travis ci](https://api.travis-ci.org/tuananh/sax-parser.svg?branch=develop)](https://travis-ci.org/github/tuananh/sax-parser)
![license](https://badgen.net/npm/license/@tuananh/sax-parser)
==========

🚨 ALPHA STATE: This is a very much work-in-progress now.

## What this is

A very fast SAX parser for Node.js written in C++. Native module for performance reason.

## Installation

```sh
yarn add @tuananh/sax-parser
# npm install @tuananh/sax-parser
```

## Benchmark

I use the `benchmark.js` script from [node-expat repo](https://github.com/astro/node-expat/blob/master/benchmark.js) and add few more alternatives for comparison.

`ltx` package is fastest, win by almost 2 (~1.8) order of magnitude compare with the second fastest (`@tuananh/sax-parser`). However, `ltx` is not fully compliant with XML spec. I still include `ltx` here for reference. If `ltx` works for you, use it.

```sh
npm run benchmark

sax x 14,277 ops/sec ±0.73% (87 runs sampled)
@tuananh/sax-parser x 45,779 ops/sec ±0.85% (85 runs sampled)
node-xml x 4,335 ops/sec ±0.51% (86 runs sampled)
node-expat x 13,028 ops/sec ±0.39% (88 runs sampled)
ltx x 81,722 ops/sec ±0.73% (89 runs sampled)
libxmljs x 8,927 ops/sec ±1.02% (88 runs sampled)
Fastest is ltx
```

| module              | ops/sec | native | XML compliant | stream |
| ------------------- | ------- | ------ | ------------- | ------ |
| node-xml            | 4,335   | ☐      | ✘             | ✘      |
| libxmljs            | 8,927   | ✘      | ✘             | ☐      |
| node-expat          | 13,028  | ✘      | ✘             | ✘      |
| sax                 | 14,277  | ☐      | ✘             | ✘      |
| @tuananh/sax-parser | 45,779  | ✘      | ✘             | ✘      |
| ltx                 | 81,722  | ☐      | ☐             | ✘      |

ops/sec: higher is better.

## Usage

See [`example/print.js`](example/print.js) for an example how to use `@tuananh/sax-parser` to pretty print XML to `process.stdout`

```js
const { readFileSync } = require('fs')
const SaxParser = require('.')

const parser = new SaxParser()

let depth = 0
parser.on('startElement', (name) => {
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    process.stdout.write(str + '\n')
    depth++
})

parser.on('text', (text) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += text
    process.stdout.write(str + '\n')
})

parser.on('endElement', (name) => {
    depth--
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    process.stdout.write(str + '\n')
})

parser.on('startAttribute', (name, value) => {
    // console.log('startAttribute', name, value)
})

parser.on('endAttribute', () => {
    // console.log('endAttribute')
})

parser.on('cdata', (cdata) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += `<![CDATA[${cdata}]]>`
    process.stdout.write(str)
    process.stdout.write('\n')
})

parser.on('comment', (comment) => {
    process.stdout.write(`<!--${comment}-->\n`)
})

parser.on('doctype', (doctype) => {
    process.stdout.write(`<!DOCTYPE ${doctype}>\n`)
})

parser.on('startDocument', () => {
    process.stdout.write(`<!--=== START ===-->\n`)
})

parser.on('endDocument', () => {
    process.stdout.write(`<!--=== END ===-->`)
})

const xml = readFileSync(__dirname + '/benchmark/test.xml', 'utf-8')
parser.parse(xml)
```

output

```xml
<!--=== START ===-->
<breakfast_menu>
  <food>
    <name>
        Belgian Waffles
    <name>
    <sometext>
        <![CDATA[They're saying "x < y" & that "z > y" so I guess that means that z > x]]>
    <sometext>
<!--This is example of comment in XML-->
    <price>
        $5.95
    <price>
    <description>
        Two of our famous Belgian Waffles with plenty of real maple syrup
    <description>
    <calories>
        650
    <calories>
  <food>
  <food>
    <name>
        Strawberry Belgian Waffles
    <name>
    <price>
        $7.95
    <price>
    <description>
        Light Belgian waffles covered with strawberries and whipped cream
    <description>
    <calories>
        900
    <calories>
  <food>
  <food>
    <name>
        Berry-Berry Belgian Waffles
    <name>
    <price>
        $8.95
    <price>
    <description>
        Light Belgian waffles covered with an assortment of fresh berries and whipped cream
    <description>
    <calories>
        900
    <calories>
  <food>
  <food>
    <name>
        French Toast
    <name>
    <price>
        $4.50
    <price>
    <description>
        Thick slices made from our homemade sourdough bread
    <description>
    <calories>
        600
    <calories>
  <food>
  <food>
    <name>
        Homestyle Breakfast
    <name>
    <price>
        $6.95
    <price>
    <description>
        Two eggs, bacon or sausage, toast, and our ever-popular hash browns
    <description>
    <calories>
        950
    <calories>
  <food>
<breakfast_menu>
<!--=== END ===-->
```

## Development

You will need to have all `node-gyp`'s requirements installed.

```sh
git clone git@github.com:tuananh/sax-parser.git
cd sax-parser
git submodule init
npm install
npm run build
node example/print.js
npm run test
```

## Credits

-   [engine-x](https://github.com/simdsoft/engine-x): a fork of cocos2d-x game engine
-   [xsxml](https://github.com/simdsoft/xsxml): The embedded xml SAX parser, extract from pugixml/rapidxml DOM parsers
-   [addon-event-emitter](https://github.com/NickNaso/addon-event-emitter): How to create and use event emitter interface on Node.js add-ons
-   [addon-stream](https://github.com/NickNaso/addon-stream): How to use and create stream on Node.js native add-ons
