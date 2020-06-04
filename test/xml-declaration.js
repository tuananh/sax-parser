const test = require('ava')
const SaxParser = require('..')

test('XML declaration with encoding', (t) => {
    const xml = "<?xml version='1.0' encoding='UTF-8'?>"
    const parser = new SaxParser()

    let xmlDecls = []
    parser.on('xmlDecl', (xmlDecl) => {
        xmlDecls.push(xmlDecl)
    })

    parser.on('endDocument', () => {
        t.deepEqual(xmlDecls, [{ version: '1.0', encoding: 'UTF-8' }])
        t.pass()
    })

    parser.parse(xml)
})
