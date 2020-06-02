const test = require('ava')
const SaxParser = require('..')

test(`.on('doctype') event test`, (t) => {
    const xml =
        '<xml><!DOCTYPE note SYSTEM "Note.dtd"><hello>world</world></xml>'
    const parser = new SaxParser()

    let doctypes = []
    parser.on('doctype', (doctype) => {
        doctypes.push(doctype)
    })

    parser.on('endDocument', () => {
        t.deepEqual(doctypes, ['note SYSTEM "Note.dtd"'])
        t.pass()
    })

    parser.parse(xml)
})
