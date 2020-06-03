API
===

Inspired by `node-expat`. Will implement the missing ones.

* `#parse(xml)` string or buffer
* `#on('startDocument', function () {})`
* `#on('endDocument', function () {})`
* `#on('startElement' function (name, attrs) {})`
* `#on('endElement' function (name) {})`
* `#on('startAttribute' function (attr) {})`
* `#on('endAttribute' function () {})`
* `#on('text' function (text) {})`
* `#on('processingInstruction', function (target, data) {})` **to be implemented**
* `#on('comment', function (comment) {})`
* `#on('xmlDecl', function ({version, encoding, standalone}) {})`
* `#on('cdata', function (cdata) {})`
* `#on('entityDecl', function (entityName, isParameterEntity, value, base, systemId, publicId, notationName) {})` **to be implemented**
* `#on('error', function ({code, offset}) {})`