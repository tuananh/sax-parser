const parse = require('.')

describe('bom test', () => {
    test('1 bom (beginning) should be ignore', async () => {
        const xml = '\uFEFF<hello>world</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })

    test('bom (beginning+end) should be ignore', async () => {
        const xml = '\uFEFF<hello>world</hello>\uFEFF'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })
})
