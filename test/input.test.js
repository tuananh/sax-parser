const SaxParser = require('..')
const parse = require('.')

describe('validate argument passed to parse()', () => {
    test('input: no argument => throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse()
        }).toThrow()
    })

    test('input: argument not string or buffer => throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse(1)
        }).toThrow()
    })

    test('input: valid string => not throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse('<hello>world</hello>')
        }).not.toThrow()
    })

    test('input: valid buffer => not throw', async () => {
        const parser = new SaxParser()
        expect(() => {
            parser.parse(Buffer.from('<hello>world</hello>'))
        }).not.toThrow()
    })

    test('input: Buffer', async () => {
        const xml = '<hello>world</hello>'
        expect(await parse(Buffer.from(xml))).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })

    test('input: mix string and Buffer', async () => {
        expect(
            await parse('<hello>', Buffer.from('<child />'), '</hello>')
        ).toEqual([
            ['startElement', 'hello', {}],
            ['startElement', 'child', {}],
            ['endElement', 'child'],
            ['endElement', 'hello'],
        ])
    })
})
