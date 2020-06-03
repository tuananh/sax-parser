const test = require('ava')
const SaxParser = require('..')

// TODO(anh): remove skip
test.skip('XML declaration with encoding', (t) => {
    const xml = "<?xml version='1.0' encoding='UTF-8'?>"
    const parser = new SaxParser()

    let xmlDecls = []
    parser.on('xmlDecl', ({ version, encoding, standalone }) => {
        xmlDecls.push({ version, encoding, standalone })
    })

    parser.on('endDocument', () => {
        t.deepEqual(xmlDecls, [
            { version: '1.0', encoding: 'UTF-8', standalone: true },
        ])
        t.pass()
    })

    parser.parse(xml)
})
