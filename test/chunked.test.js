const parse = require('.')

/** Split a string into chunks of a given size. */
function chunkString(str, size) {
    const chunks = []
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size))
    }
    return chunks
}

describe('chunked input (adapted from eksml saxEngine)', () => {
    test('handles elements split across chunks', async () => {
        expect(await parse('<a>hel', 'lo</a>')).toEqual([
            ['startElement', 'a', {}],
            ['text', 'hello'],
            ['endElement', 'a'],
        ])
    })

    test('handles tag split mid-name', async () => {
        expect(await parse('<lon', 'gname>text</longname>')).toEqual([
            ['startElement', 'longname', {}],
            ['text', 'text'],
            ['endElement', 'longname'],
        ])
    })

    test('handles attribute split across chunks', async () => {
        expect(await parse('<a id="te', 'st">x</a>')).toEqual([
            ['startElement', 'a', { id: 'test' }],
            ['text', 'x'],
            ['endElement', 'a'],
        ])
    })

    test('handles single-quoted attribute value split across chunks', async () => {
        expect(await parse("<a id='te", "st'>x</a>")).toEqual([
            ['startElement', 'a', { id: 'test' }],
            ['text', 'x'],
            ['endElement', 'a'],
        ])
    })

    test('handles close tag split across chunks', async () => {
        expect(await parse('<a>text</', 'a>')).toEqual([
            ['startElement', 'a', {}],
            ['text', 'text'],
            ['endElement', 'a'],
        ])
    })

    test('handles comment split across chunks', async () => {
        expect(await parse('<!-- com', 'ment --><a/>')).toEqual([
            ['comment', ' comment '],
            ['startElement', 'a', {}],
            ['endElement', 'a'],
        ])
    })

    test('handles CDATA split across chunks', async () => {
        expect(await parse('<a><![CDA', 'TA[raw]]></a>')).toEqual([
            ['startElement', 'a', {}],
            ['cdata', 'raw'],
            ['endElement', 'a'],
        ])
    })

    test('handles XML declaration split across chunks', async () => {
        expect(await parse('<?xm', 'l version="1.0"?><a/>')).toEqual([
            ['xmlDecl', { version: '1.0' }],
            ['startElement', 'a', {}],
            ['endElement', 'a'],
        ])
    })

    test('handles DOCTYPE split across chunks', async () => {
        expect(
            await parse(
                '<!DOCT',
                'YPE html PUBLIC "-//W3C',
                '//DTD XHTML 1.0 Strict//EN">',
                '<html/>',
            ),
        ).toEqual([
            [
                'doctype',
                'html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"',
            ],
            ['startElement', 'html', {}],
            ['endElement', 'html'],
        ])
    })

    test('handles many small chunks (byte-at-a-time)', async () => {
        const xml = '<root><item id="1">hello</item></root>'
        expect(await parse(...chunkString(xml, 1))).toEqual([
            ['startElement', 'root', {}],
            ['startElement', 'item', { id: '1' }],
            ['text', 'hello'],
            ['endElement', 'item'],
            ['endElement', 'root'],
        ])
    })

    test('handles empty chunks interspersed', async () => {
        expect(await parse('', '<a>', '', 'text', '', '</a>', '')).toEqual([
            ['startElement', 'a', {}],
            ['text', 'text'],
            ['endElement', 'a'],
        ])
    })

    test('produces identical events across chunk sizes', async () => {
        const xml =
            '<?xml version="1.0"?><!DOCTYPE root SYSTEM "x.dtd"><root id="a"><item>text<!--c--><![CDATA[raw]]><?pi body?></item></root>'
        const expected = await parse(xml)
        for (const size of [1, 2, 3, 7, 16, 64, xml.length]) {
            expect(await parse(...chunkString(xml, size))).toEqual(expected)
        }
    })
})
