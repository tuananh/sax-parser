sax-parser
[![npm version](https://badgen.net/npm/v/@tuananh/sax-parser)](https://npmjs.com/package/@tuananh/sax-parser)
[![github actions ci](https://github.com/tuananh/sax-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/tuananh/sax-parser/actions)
![license](https://badgen.net/npm/license/@tuananh/sax-parser)
==========

<p align="center">
  <img alt="need a logo, this is just sth i found on the web" src="logo.png" width="700">
</p>

## What this is

A very fast SAX parser for Node.js written in C++. Native module for performance reason.

## Installation

```sh
pnpm install @tuananh/sax-parser
# npm install @tuananh/sax-parser
```

## Benchmark

[`benchmark/index.mjs`](benchmark/index.mjs) and [`benchmark/streaming.mjs`](benchmark/streaming.mjs) compare SAX-style parsers on a ~10 KB XML document. Each parser registers noop handlers that accept the usual event arguments so the comparison includes string decoding and dispatch overhead.

```sh
npm run benchmark
npm run benchmark:streaming
```

Results on Node.js v26.5.0, Linux x64:

### Single-write (`npm run benchmark`)

| module              | ops/sec | native | XML compliant | stream |
| ------------------- | ------- | ------ | ------------- | ------ |
| @tuananh/sax-parser | 20,821  | ✅     | ✅            | ✅     |
| @eksml/xml          | 15,495  | ❌     | ✅            | ✅     |
| saxophone           | 5,951   | ❌     | ✅            | ✅     |
| easysax             | 5,131   | ❌     | ✅            | ✅     |
| ltx                 | 4,116   | ❌     | ❌            | ✅     |
| sax                 | 1,522   | ❌     | ✅            | ✅     |
| node-expat          | 1,224   | ✅     | ✅            | ✅     |
| node-xml            | 735     | ❌     | ✅            | ✅     |

### Streaming (`npm run benchmark:streaming`)

Same document delivered in small chunks (fresh parser per iteration):

| module              | 256 B chunks | 64 B chunks |
| ------------------- | ------------ | ----------- |
| @tuananh/sax-parser | 8,484        | 8,560       |
| @eksml/xml          | 9,237        | 8,045       |
| saxophone           | 4,784        | 3,970       |
| easysax             | 4,491        | 4,172       |
| ltx                 | 3,813        | 3,222       |
| sax                 | 1,597        | 1,579       |
| node-expat          | 1,191        | 1,076       |
| node-xml            | 679          | 587         |

ops/sec: higher is better.

`ltx` is included for reference — it is fast but not fully XML spec compliant. `@tuananh/sax-parser` is the fastest single-write parser in this comparison while remaining a native parser with streaming and full XML compliance. On chunked input it leads at 64 B chunks and stays close to `@eksml/xml` at 256 B.

## Usage

- See [`example/print.js`](example/print.js) for an example how to use this library to pretty print XML to `process.stdout`.
- Or [`example/stream.js`](example/stream.js) for an example of using this library with stream.
- For complete API documentation, see [API.md](API.md).

Sample usage

```js
const { Readable } = require('stream')
const SaxParser = require('@tuananh/sax-parser')

const parser = new SaxParser()
const xml = '<hello><item id="1"><name>foo</name></item></hello>'

const readStream = new Readable()
readStream._read = () => {}
readStream.push(xml)
readStream.push(null)

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
