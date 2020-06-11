const parse = require('.')

describe('stream test', () => {
    test('stream test: 1 root node with 10_000 children elements', async () => {
        const expected = [['startElement', 'hello', {}]]
        const NUM_CHILDREN = 10_000
        for (let i = 0; i < NUM_CHILDREN; i++) {
            expected.push(
                ['startElement', 'child', {}],
                ['endElement', 'child']
            )
        }

        expected.push(['endElement', 'hello'])
        const fn = () => {
            let args = ['<hello>']
            for (let i = 0; i < NUM_CHILDREN; i++) {
                args.push('<child></child>')
            }
            args.push('</hello>')

            return parse(...args)
        }

        expect(await fn()).toEqual(expected)
    })
})
