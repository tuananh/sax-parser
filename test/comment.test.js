const parse = require('.')

test('only comment', async () => {
    const xml = `<!--comment 1-->`
    expect(await parse(xml)).toEqual([['comment', 'comment 1']])
})

test('single comment inside a node', async () => {
    const xml = `<hello>
    <!--comment 1-->
    </hello>`
    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['comment', 'comment 1'],
        ['endElement', 'hello'],
    ])
})

test('multiple comments test', async () => {
    const xml = `<hello>
    <!--comment 1-->
    <!--comment 2-->
    <!--comment 3-->
    </hello>`

    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['comment', 'comment 1'],
        ['comment', 'comment 2'],
        ['comment', 'comment 3'],
        ['endElement', 'hello'],
    ])
})

test('multiple comments test 2', async () => {
    const xml = `<hello><!--comment 1--><!--comment 2-->world</hello>`

    expect(await parse(xml)).toEqual([
        ['startElement', 'hello', {}],
        ['comment', 'comment 1'],
        ['comment', 'comment 2'],
        ['text', 'world'],
        ['endElement', 'hello'],
    ])
})
