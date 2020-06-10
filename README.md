sax-parser
[![npm version](https://badgen.net/npm/v/@tuananh/sax-parser)](https://npmjs.com/package/@tuananh/sax-parser)
[![github actions ci](https://github.com/tuananh/sax-parser/workflows/CI/badge.svg)](https://github.com/tuananh/sax-parser/actions)
[![travis ci](https://api.travis-ci.org/tuananh/sax-parser.svg?branch=develop)](https://travis-ci.org/github/tuananh/sax-parser)
![license](https://badgen.net/npm/license/@tuananh/sax-parser)
==========

<p align="center">
  <img alt="need a logo, this is just sth i found on the web" src="logo.png" width="700">
</p>

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

- See [`example/print.js`](example/print.js) for an example how to use this library to pretty print XML to `process.stdout`.
- Or [`example/stream.js`](example/stream.js) for an example of using this library with stream.
- For complete API documentation, see [API.md](API.md).

Sample usage

```js
const fs = require('fs')
const path = require('path')
const SaxParser = require('..')

const parser = new SaxParser()

const readStream = fs.createReadStream(
    path.join(__dirname, '/../benchmark/test.xml')
)

readStream
    .pipe(parser)
    .on('startElement', (name, attrs) => {
        console.log('name', name)
    })
    .on('text', (text) => {
        console.log('text', text)
    })
    .on('end', () => {
        console.log('done')
    })
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

- [engine-x](https://github.com/simdsoft/engine-x): a fork of cocos2d-x game engine
- [xsxml](https://github.com/simdsoft/xsxml): The embedded xml SAX parser, extract from pugixml/rapidxml DOM parsers
- [addon-event-emitter](https://github.com/NickNaso/addon-event-emitter): How to create and use event emitter interface on Node.js add-ons
- [addon-stream](https://github.com/NickNaso/addon-stream): How to use and create stream on Node.js native add-ons
- [napi-example-transformstream](https://github.com/dmooney65/napi-example-transformstream): Simple transform stream implementation using node-addon-api
- [Node.js C++ addon examples](https://github.com/nodejs/node-addon-examples): Official Node.js C++ addon examples from Node.js