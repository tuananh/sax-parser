const { Readable } = require('stream')
const SaxParser = require('..')

const parser = new SaxParser()

const xml =
    '<hello>' + '<item id="1"><name>foo</name></item>'.repeat(3) + '</hello>'
const readStream = new Readable()
readStream._read = () => {}

for (let i = 0; i < xml.length; i += 64) {
    readStream.push(xml.slice(i, i + 64))
}
readStream.push(null)

readStream
    .pipe(parser)
    .on('startElement', (name, attrs) => {
        console.log('startElement', name)
    })
    .on('endElement', (name, attrs) => {
        console.log('endElement', name)
    })
    .on('startAttribute', (attr) => {
        console.log('startAttribute', attr)
    })
    .on('text', (text) => {
        console.log('text', text)
    })
    .on('end', () => {
        console.log('done')
    })
