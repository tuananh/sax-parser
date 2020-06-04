const parse = require('.')

test('attribute test', async () => {
    const xml = '<hello attr1="val1" attr2="val2">world</hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', { attr1: 'val1', attr2: 'val2' }],
        ['text', 'world'],
        ['endElement', 'hello'],
    ])
})
