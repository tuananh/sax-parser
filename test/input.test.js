const SaxParser = require('..')
const parse = require('.')

describe('validate argument passed to parse()', () => {
    test('no argument => throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse()
        }).toThrow()
    })

    test('argument not string or buffer => throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse(1)
        }).toThrow()
    })

    test('valid string => not throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse('<hello>world</hello>')
        }).not.toThrow()
    })

    test('valid buffer => not throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse(Buffer.from('<hello>world</hello>'))
        }).not.toThrow()
    })

    test('parse Buffer', async () => {
        const xml = '<hello>world</hello>'
        expect(await parse(Buffer.from(xml))).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })
})
