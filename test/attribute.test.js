const parse = require('.')

describe('attribute test', () => {
    test('simple element with text', async () => {
        const xml = '<hello attr1="val1" attr2="val2">world</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', { attr1: 'val1', attr2: 'val2' }],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })

    test('element with self closing tag', async () => {
        const xml = '<w:pStyle w:val="Hangingindent"/>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'w:pStyle', { 'w:val': 'Hangingindent' }],
            ['endElement', 'w:pStyle'],
        ])
    })

    test('trailing attribute with no value should throw', async () => {
        const xml = '<hello key />'
        expect(async () => {
            await parse(xml)
        }).rejects.toThrow()
    })

    test('unquoted attribute should throw', async () => {
        const xml = '<xml hello=world />'
        expect(async () => {
            await parse(xml)
        }).rejects.toThrow()
    })
})
