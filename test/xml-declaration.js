const test = require('ava')
const SaxParser = require('..')

test('XML declaration with version and encoding', (t) => {
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

test('XML declaration with version, encoding and standalone', (t) => {
    const xml = "<?xml version='1.0' encoding='UTF-8' standalone='no'?>"
    const parser = new SaxParser()

    let xmlDecls = []
    parser.on('xmlDecl', (xmlDecl) => {
        xmlDecls.push(xmlDecl)
    })

    parser.on('endDocument', () => {
        t.deepEqual(xmlDecls, [
            { version: '1.0', encoding: 'UTF-8', standalone: 'no' },
        ])
        t.pass()
    })

    parser.parse(xml)
})
