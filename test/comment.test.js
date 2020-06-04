const parse = require('.')

// TODO(anh): figure out why this test is failing
test.skip('only comment', async () => {
    const xml = `<!--This is example of comment in XML1-->`
    expect(await parse(xml)).toEqual([
        ['comment', 'This is example of comment in XML1'],
    ])
})

test('single comment inside a node', async () => {
    const xml = `<hello>
    <!--This is example of comment in XML1-->
    </hello>`
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['comment', 'This is example of comment in XML1'],
        ['endElement', 'hello'],
    ])
})

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