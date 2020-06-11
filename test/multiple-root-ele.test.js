const parse = require('.')

describe('multiple root elements (empty)', () => {
    test('multiple root elements', async () => {
        const xml = '<hello></hello><hello2></hello2>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['endElement', 'hello'],
            ['startElement', 'hello2', {}],
            ['endElement', 'hello2'],
        ])
    })

    test('multiple root elements with text', async () => {
        const xml = '<hello>world</hello><hello2>world2</hello2>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
            ['startElement', 'hello2', {}],
            ['text', 'world2'],
            ['endElement', 'hello2'],
        ])
    })
})
