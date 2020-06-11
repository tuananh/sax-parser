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
