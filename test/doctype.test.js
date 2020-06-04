const parse = require('.')

test('comment test', async () => {
    const xml = '<xml><!DOCTYPE note SYSTEM "Note.dtd"></xml>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'xml', {}],
        ['doctype', 'note SYSTEM "Note.dtd"'],
        ['endElement', 'xml'],
    ])
})
