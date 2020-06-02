const test = require('ava')
const SaxParser = require('..')

test(`.on('startAttribute') event test`, (t) => {
    const xml = '<xml><hello attr1="val1" attr2="val2">world</hello></xml>'
    const parser = new SaxParser()

    let attribs = []
    parser.on('startAttribute', (attr) => {
        attribs.push(attr)
    })

    parser.on('endDocument', () => {
        t.deepEqual(attribs, [{ attr1: 'val1' }, { attr2: 'val2' }])
        t.pass()
    })

    parser.parse(xml)
})
