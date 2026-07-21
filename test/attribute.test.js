const SaxParser = require('..')
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

    test('attrs object is null-prototype (no __proto__ pollution)', async () => {
        const xml = '<hello __proto__="polluted" other="ok"/>'
        const events = await parse(xml)
        const attrs = events[0][2]
        expect(Object.getPrototypeOf(attrs)).toBe(null)
        expect(attrs.__proto__).toBe('polluted')
        expect(attrs.other).toBe('ok')
        expect({}.polluted).toBeUndefined()
    })

    test('arity-1 startElement receives name only (consistent with invokeSlot)', () => {
        const xml = '<item id="1"><name>x</name></item>'
        const parser = new SaxParser()
        const starts = []
        parser.on('startElement', function (name) {
            starts.push({
                name,
                argc: arguments.length,
                second: arguments[1],
            })
        })
        parser.on('endElement', function (name) {})
        parser.on('text', function (text) {})
        parser.parse(xml)
        expect(starts).toEqual([
            { name: 'item', argc: 1, second: undefined },
            { name: 'name', argc: 1, second: undefined },
        ])
    })

    test('arity-2 startElement still receives fresh attrs each time', () => {
        const xml = '<a id="1"/><a id="2"/>'
        const parser = new SaxParser()
        const attrsList = []
        parser.on('startElement', function (name, attrs) {
            attrsList.push(attrs)
        })
        parser.on('endElement', function (name) {})
        parser.on('text', function (text) {})
        parser.parse(xml)
        expect(attrsList).toHaveLength(2)
        expect(attrsList[0]).toEqual({ id: '1' })
        expect(attrsList[1]).toEqual({ id: '2' })
        expect(attrsList[0]).not.toBe(attrsList[1])
        expect(Object.getPrototypeOf(attrsList[0])).toBe(null)
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
        expect(await parse(xml)).toEqual([
            ['error', { code: 'ERR_BAD_ATTRIBUTE', offset: 12 }],
        ])
    })

    test('unquoted attribute should throw', async () => {
        const xml = '<xml hello=world />'
        expect(await parse(xml)).toEqual([
            ['error', { code: 'ERR_BAD_ATTRIBUTE', offset: 11 }],
        ])
    })

    test('attribute value contains special char => should parse correctly', async () => {
        const valids = [
            '<foo baz="baz=/>quux"></foo>',
            "<foo baz='baz=/>quux'></foo>",
        ]
        valids.forEach(async (xml) => {
            expect(await parse(xml)).toEqual([
                ['startElement', 'foo', { baz: 'baz=/>quux' }],
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
