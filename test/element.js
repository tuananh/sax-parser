const test = require('ava')
const SaxParser = require('..')

test(`.on('startElement') event test`, (t) => {
    const xml = '<hello>world</hello>'
    const parser = new SaxParser()

    let eleName
    parser.on('startElement', (name) => {
        eleName = name
    })

    parser.on('endDocument', () => {
        t.is(eleName, 'hello', 'element name is `hello`')
        t.pass()
    })

    parser.parse(xml)
})