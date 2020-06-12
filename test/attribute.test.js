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

    test('attribute value contains equal sign => should parse correctly', async () => {
        const valids = [
            '<foo baz="baz=quux"></foo>',
            "<foo baz='baz=quux'></foo>",
        ]
        valids.forEach(async (xml) => {
            expect(await parse(xml)).toEqual([
                ['startElement', 'foo', { baz: 'baz=quux' }],
                ['endElement', 'foo'],
            ])
        })
    })

    test('attribute key contains special chars => should parse correctly', async () => {
        const valids = [
            '<foo _baz="baz=baz" :quux="quux=quux"></foo>',
            '<foo _baz=\'baz=baz\' :quux="quux=quux"></foo>',
        ]
        valids.forEach(async (xml) => {
            expect(await parse(xml)).toEqual([
                [
                    'startElement',
                    'foo',
                    { _baz: 'baz=baz', ':quux': 'quux=quux' },
                ],
                ['endElement', 'foo'],
            ])
        })
    })

    test('tab \\t should be ignore between attribs', async () => {
        const xml = '<foo baz="baz"\t quux="quux"/>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'foo', { baz: 'baz', quux: 'quux' }],
            ['endElement', 'foo'],
        ])
    })
})
