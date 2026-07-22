const SaxParser = require('..')
const parse = require('.')

describe('other test (uncategorized)', () => {
    // TODO(anh): categorize these tests into their own test suite
    test('parse twice should be fine', async () => {
        const xml = '<hello attr1="val1" attr2="val2">world</hello>'
        expect(async () => {
            await parse(xml)
            await parse(xml)
        }).not.toThrow()
    })

    test('multiple instances do not share state', () => {
        const tags1 = []
        const tags2 = []
        const sax1 = new SaxParser()
        const sax2 = new SaxParser()

        sax1.on('startElement', (name) => tags1.push(name))
        sax2.on('startElement', (name) => tags2.push(name))

        sax1.parse('<root><a/></root>')
        sax2.parse('<doc><b/><c/></doc>')

        expect(tags1).toEqual(['root', 'a'])
        expect(tags2).toEqual(['doc', 'b', 'c'])
    })

    test('multiple instances have independent event listeners', () => {
        const texts1 = []
        const texts2 = []
        const sax1 = new SaxParser()
        const sax2 = new SaxParser()

        sax1.on('text', (t) => texts1.push(t))
        sax2.on('text', (t) => texts2.push(t))

        sax1.parse('<a>one</a>')
        sax2.parse('<b>two</b>')

        expect(texts1).toEqual(['one'])
        expect(texts2).toEqual(['two'])
    })

    test('supports multiple handlers for the same event', () => {
        const log1 = []
        const log2 = []
        const sax = new SaxParser()

        sax.on('startElement', (name) => log1.push(name))
        sax.on('startElement', (name) => log2.push(name))
        sax.parse('<root/>')

        expect(log1).toEqual(['root'])
        expect(log2).toEqual(['root'])
    })

    test('preserves entity references in text and attributes (no decode)', async () => {
        expect(await parse('<a x="&amp;ok">&lt;hi&gt;</a>')).toEqual([
            ['startElement', 'a', { x: '&amp;ok' }],
            ['text', '&lt;hi&gt;'],
            ['endElement', 'a'],
        ])
    })
})
