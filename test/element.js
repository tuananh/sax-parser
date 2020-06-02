const test = require('ava')
const SaxParser = require('..')

test(`.on('startElement') event test`, (t) => {
    const xml = '<xml><hello>world</hello></xml>'
    const parser = new SaxParser()

    let startElementEv = []
    let endElementEv = []
    parser.on('startElement', (name) => {
        startElementEv.push(name)
    })

    parser.on('endElement', (name) => {
        endElementEv.push(name)
    })

    parser.on('endDocument', () => {
        t.deepEqual(startElementEv, ['xml', 'hello'], 'startElement test ok')
        t.deepEqual(endElementEv, ['hello', 'xml'], 'endElement test ok')
        t.pass()
    })

    parser.parse(xml)
})
