const { Readable } = require('stream')
const parse = require('.')
const SaxParser = require('..')

describe('stream test', () => {
    // ref: see https://github.com/tuananh/sax-parser/issues/10
    test.skip('should be able to parse incomplete stanza in each chunk but complete XML overall', async () => {
        expect(() => {
            const parser = new SaxParser()
            const s = new Readable()

            s._read = () => {}

            s.push('<foo')
            s.push('>world')
            s.push('></foo')
            s.push('>')
            s.push(null)

            s.pipe(parser)
        }).not.toThrow()
    })

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

    test('number of `startElement` and `endElement` ev called should be correct', async () => {
        const parser = new SaxParser()
        const s = new Readable()
        const COUNT = 1_000_000

        s._read = () => {}

        s.push('<foo>')
        for (let i = 0; i < COUNT; i += 1) {
            s.push('<bar />')
        }
        s.push('</foo>')
        s.push(null)

        let startEleCnt = 0
        let endEleCnt = 0
        parser.on('startElement', () => {
            startEleCnt += 1
        })

        parser.on('endElement', () => {
            endEleCnt += 1
        })
        parser.on('endDocument', () => {
            expect(startEleCnt).toEqual(COUNT + 2)
            expect(endEleCnt).toEqual(COUNT + 2)
        })
    })
})
