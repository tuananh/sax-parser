const SaxParser = require('..')
const parse = require('.')

describe('element test', () => {
    test('simple self-close element with 0, 1 or more space', () => {
        const valids = ['<hello/>', '<hello />', '<hello    />']
        valids.forEach(async (xml) => {
            expect(await parse(xml)).toEqual([
                ['startElement', 'hello', {}],
                ['endElement', 'hello'],
            ])
        })
    })

    test('single element with text', async () => {
        const xml = '<hello>world</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })

    test('multiple elements with text', async () => {
        const xml = '<hello>world</hello>'.repeat(3)
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })

    test('empty element', async () => {
        const xml = '<hello></hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['endElement', 'hello'],
        ])
    })

    test('single element with text and line break', async () => {
        const xml = '<hello>foo\nbar</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'foo\nbar'],
            ['endElement', 'hello'],
        ])
    })

    test('single element with CDATA content', async () => {
        const xml =
            '<hello><![CDATA[<greeting>Hello, world!</greeting>]]></hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['cdata', '<greeting>Hello, world!</greeting>'],
            ['endElement', 'hello'],
        ])
    })

    test('single element with umlaut text', async () => {
        const xml = '<hello>ß</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'ß'],
            ['endElement', 'hello'],
        ])
    })

    test('element test with attribute', async () => {
        const xml = '<hello foo="bar" />'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', { foo: 'bar' }],
            ['endElement', 'hello'],
        ])
    })

    test('element test with different quote character', async () => {
        const xml = '<hello foo=\'bar\' baz="quux" test="test"/>'
        expect(await parse(xml)).toEqual([
            [
                'startElement',
                'hello',
                { foo: 'bar', baz: 'quux', test: 'test' },
            ],
            ['endElement', 'hello'],
        ])
    })

    test('with namespaces', async () => {
        const xml = `<hello xmlns=\'http://localhost/\' xmlns:x="http://example.com/"></hello>`
        expect(await parse(xml)).toEqual([
            [
                'startElement',
                'hello',
                {
                    xmlns: 'http://localhost/',
                    'xmlns:x': 'http://example.com/',
                },
            ],
            ['endElement', 'hello'],
        ])
    })

    test('element has a self closing child', async () => {
        const xml = '<hello><child /></hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['startElement', 'child', {}],
            ['endElement', 'child'],
            ['endElement', 'hello'],
        ])
    })

    test('tag name starts with ampersand => throw', async () => {
        expect(await parse('<&foo/>')).toEqual([
            ['error', { code: 'ERR_UNRECOGNIZE_TAG', offset: 1 }],
        ])
    })

    test('parses deeply nested structure', async () => {
        expect(await parse('<a><b><c><d>deep</d></c></b></a>')).toEqual([
            ['startElement', 'a', {}],
            ['startElement', 'b', {}],
            ['startElement', 'c', {}],
            ['startElement', 'd', {}],
            ['text', 'deep'],
            ['endElement', 'd'],
            ['endElement', 'c'],
            ['endElement', 'b'],
            ['endElement', 'a'],
        ])
    })

    test('handles multiple text nodes interleaved with elements', async () => {
        expect(await parse('<p>before<b>bold</b>after</p>')).toEqual([
            ['startElement', 'p', {}],
            ['text', 'before'],
            ['startElement', 'b', {}],
            ['text', 'bold'],
            ['endElement', 'b'],
            ['text', 'after'],
            ['endElement', 'p'],
        ])
    })

    test('parses sibling root elements', async () => {
        expect(await parse('<a>1</a><b>2</b><c>3</c>')).toEqual([
            ['startElement', 'a', {}],
            ['text', '1'],
            ['endElement', 'a'],
            ['startElement', 'b', {}],
            ['text', '2'],
            ['endElement', 'b'],
            ['startElement', 'c', {}],
            ['text', '3'],
            ['endElement', 'c'],
        ])
    })

    test('handles empty input', () => {
        const parser = new SaxParser()
        const events = []
        parser.on('startElement', (name, attrs) => {
            events.push(['startElement', name, attrs])
        })
        parser.on('endElement', (name) => {
            events.push(['endElement', name])
        })
        parser.on('text', (text) => {
            events.push(['text', text])
        })
        parser.on('error', (error) => {
            events.push(['error', error])
        })
        parser.parse('')
        expect(events).toEqual([])
    })

    test('preserves surrounding whitespace in text', async () => {
        expect(await parse('<a>  hello  </a>')).toEqual([
            ['startElement', 'a', {}],
            ['text', '  hello  '],
            ['endElement', 'a'],
        ])
    })

    test('skips whitespace-only text nodes', async () => {
        expect(await parse('<a>  \n\t  </a>')).toEqual([
            ['startElement', 'a', {}],
            ['endElement', 'a'],
        ])
    })
})
