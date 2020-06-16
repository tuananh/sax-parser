const parse = require('.')

describe('multiple root elements (empty)', () => {
    test('multiple root elements: both empty', async () => {
        const xml = '<foo></foo><bar></bar>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'foo', {}],
            ['endElement', 'foo'],
            ['startElement', 'bar', {}],
            ['endElement', 'bar'],
        ])
    })

    test('multiple root elements: one has text', async () => {
        const xml = '<foo></foo><bar>baz</bar>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'foo', {}],
            ['endElement', 'foo'],
            ['startElement', 'bar', {}],
            ['text', 'baz'],
            ['endElement', 'bar'],
        ])
    })

    test('multiple root elements: both with text', async () => {
        const xml = '<foo>bar</foo><baz>quux</baz>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'foo', {}],
            ['text', 'bar'],
            ['endElement', 'foo'],
            ['startElement', 'baz', {}],
            ['text', 'quux'],
            ['endElement', 'baz'],
        ])
    })
})
