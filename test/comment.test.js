const parse = require('.')

describe('comment test', () => {
    test('only comment', async () => {
        const xml = `<!--comment 1-->`
        expect(await parse(xml)).toEqual([['comment', 'comment 1']])
    })

    test('comment with a single dash in it', async () => {
        const xml = `<!--comment with a single dash- in it-->`
        expect(await parse(xml)).toEqual([
            ['comment', 'comment with a single dash- in it'],
        ])
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

    test('handles multi-line comments', async () => {
        expect(await parse('<!--\n  multi\n  line\n--><a/>')).toEqual([
            ['comment', '\n  multi\n  line\n'],
            ['startElement', 'a', {}],
            ['endElement', 'a'],
        ])
    })

    test('handles comments between sibling elements', async () => {
        expect(await parse('<a/><!-- mid --><b/>')).toEqual([
            ['startElement', 'a', {}],
            ['endElement', 'a'],
            ['comment', ' mid '],
            ['startElement', 'b', {}],
            ['endElement', 'b'],
        ])
    })

    test('handles extra dashes inside a comment', async () => {
        expect(await parse('<!-- -----><a/>')).toEqual([
            ['comment', ' ---'],
            ['startElement', 'a', {}],
            ['endElement', 'a'],
        ])
    })
})
