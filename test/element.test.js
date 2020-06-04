const parse = require('.')

test('element test without attribute', async () => {
    const xml = '<hello>world</hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['text', 'world'],
        ['endElement', 'hello'],
    ])
})
