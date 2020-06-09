'use strict'

const fs = require('fs')
const path = require('path')
const SaxParser = require('..')

const parser = new SaxParser()

parser.on('startElement', (name, attrs) => {
    console.log('name', name)
})

parser.on('text', (text) => {
    console.log('text', text)
})

const inStream = fs.createReadStream(
    path.join(__dirname, '/../benchmark/test.xml')
)

inStream.pipe(parser)
