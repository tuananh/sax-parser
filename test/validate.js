const test = require('ava')
const SaxParser = require('..')

test('parse() no argument => should throw', (t) => {
    const error = t.throws(
        () => {
            const parser = new SaxParser()
            parser.parse()
        },
        { instanceOf: Error },
        'no argument => should throw'
    )

    t.is(error.message, 'Expecting 1 argument.')
})

test('parse() argument not string => should throw', (t) => {
    const error = t.throws(
        () => {
            const parser = new SaxParser()
            parser.parse(1)
        },
        { instanceOf: Error },
        'argument not string => should throw'
    )

    t.is(error.message, 'The parameter must be a string or buffer.')
})

test('parse() valid argument => should not throw', (t) => {
    const xml = '<xml><hello attr="testattr">world</hello></xml>'
    const parser = new SaxParser()
    parser.parse(xml)
    t.pass()
})