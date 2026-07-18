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
yarn add @tuananh/sax-parser
# npm install @tuananh/sax-parser
```

## Benchmark

[`benchmark/index.js`](benchmark/index.js) compares SAX-style parsers on a ~10 KB XML document. Each parser runs a full-document parse with **no event handlers** registered, measuring raw parse throughput only.

```sh
npm run benchmark
```

Results on Node.js v26.5.0, Linux x64:

| module              | ops/sec | native | XML compliant | stream |
| ------------------- | ------- | ------ | ------------- | ------ |
| @tuananh/sax-parser | 63,741  | ✘      | ✘             | ✘      |
| easysax             | 12,319  | ☐      | ✘             | ✘      |
| saxophone           | 9,311   | ☐      | ✘             | ✘      |
| ltx                 | 4,117   | ☐      | ☐             | ✘      |
| sax                 | 1,580   | ☐      | ✘             | ✘      |
| node-expat          | 1,357   | ✘      | ✘             | ✘      |
| node-xml            | 764     | ☐      | ✘             | ✘      |

ops/sec: higher is better.

`ltx` is included for reference — it is fast but not fully XML spec compliant. `@tuananh/sax-parser` leads this comparison by roughly **15×** over `ltx` and **40×** over `sax`, while also supporting streaming.

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
