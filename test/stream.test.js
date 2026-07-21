const { Readable } = require('stream')
const parse = require('.')
const SaxParser = require('..')

describe('stream test', () => {
    // ref: see https://github.com/tuananh/sax-parser/issues/10
    test('should be able to parse incomplete stanza in each chunk but complete XML overall', async () => {
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

    test('writev feeds multiple chunks in one native call', async () => {
        const parser = new SaxParser()
        const events = []

        parser.on('startElement', (name, attrs) => {
            events.push(['startElement', name, attrs])
        })
        parser.on('endElement', (name) => {
            events.push(['endElement', name])
        })
        parser.on('endDocument', () => {
            events.push(['endDocument'])
        })

        parser.writev(['<root>', '<item id="1"/>', '</root>'], true)

        expect(events).toEqual([
            ['startElement', 'root', {}],
            ['startElement', 'item', { id: '1' }],
            ['endElement', 'item'],
            ['endElement', 'root'],
            ['endDocument'],
        ])
    })

    test('writev accepts buffer chunks', async () => {
        const parser = new SaxParser()
        const events = []

        parser.on('startElement', (name) => {
            events.push(['startElement', name])
        })
        parser.on('endElement', (name) => {
            events.push(['endElement', name])
        })

        parser.writev(
            [Buffer.from('<a>'), Buffer.from('<b/>'), Buffer.from('</a>')],
            true,
        )

        expect(events).toEqual([
            ['startElement', 'a'],
            ['startElement', 'b'],
            ['endElement', 'b'],
            ['endElement', 'a'],
        ])
    })

    test('parse(Buffer) dispatches without copying xml into a string', () => {
        const parser = new SaxParser()
        let seen = null

        parser.on('startElement', (name) => {
            seen = name
        })

        const xml = Buffer.from('<hello/>')
        parser.parse(xml)

        expect(seen).toBe('hello')
    })
})
