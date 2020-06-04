const parse = require('.')

test('comment test', async () => {
    const xml = `<hello>
    <!--This is example of comment in XML1-->
    <!--This is example of comment in XML2-->
    </hello>`
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['comment', 'This is example of comment in XML1'],
        ['comment', 'This is example of comment in XML2'],
        ['endElement', 'hello'],
    ])
})
