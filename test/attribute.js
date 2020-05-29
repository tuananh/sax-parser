const test = require('ava')
const SaxParser = require('..')

test('attribute test', (t) => {
    const xml = '<xml><hello attr1="val1" attr2="val2">world</hello></xml>'
    const parser = new SaxParser()

    let names = []
    let values = []
    parser.on('startAttribute', (name, value) => {
        names.push(name)
        values.push(value)
    })

    parser.on('endDocument', () => {
        t.deepEqual(names, ['attr1', 'attr2'])
        t.deepEqual(values, ['val1', 'val2'])
        t.pass()
    })

    parser.parse(xml)
})