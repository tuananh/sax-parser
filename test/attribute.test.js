const parse = require('.')

test('attribute test: simple element with text', async () => {
    const xml = '<hello attr1="val1" attr2="val2">world</hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', { attr1: 'val1', attr2: 'val2' }],
        ['text', 'world'],
        ['endElement', 'hello'],
    ])
})

test('attribute test: element with self closing tag', async () => {
    const xml = '<w:pStyle w:val="Hangingindent"/>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'w:pStyle', { 'w:val': 'Hangingindent' }],
        ['endElement', 'w:pStyle'],
    ])
})
