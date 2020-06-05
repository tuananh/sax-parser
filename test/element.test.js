const parse = require('.')

test('element test: simple self close element', async () => {
    const xml = '<hello />'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['endElement', 'hello'],
    ])
})

test('element test: single element with text', async () => {
    const xml = '<hello>world</hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['text', 'world'],
        ['endElement', 'hello'],
    ])
})

test('element test: single element with text and line break', async () => {
    const xml = '<hello>foo\nbar</hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['text', 'foo\nbar'],
        ['endElement', 'hello'],
    ])
})

test('element test: single element with CDATA content', async () => {
    const xml = '<hello><![CDATA[<greeting>Hello, world!</greeting>]]></hello>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['cdata', '<greeting>Hello, world!</greeting>'],
        ['endElement', 'hello'],
    ])
})

test('element test: single element with umlaut text', async () => {
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
        ['startElement', 'hello', { foo: 'bar', baz: 'quux', test: 'test' }],
        ['endElement', 'hello'],
    ])
})

test('element test: iwth namespaces', async () => {
    const xml = `<hello xmlns=\'http://localhost/\' xmlns:x="http://example.com/"></hello>`
    expect(await parse(xml)).toEqual([
        [
            'startElement',
            'hello',
            { xmlns: 'http://localhost/', 'xmlns:x': 'http://example.com/' },
        ],
        ['endElement', 'hello'],
    ])
})
