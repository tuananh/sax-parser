const test = require('ava')
const SaxParser = require('..')

test(`.on('startAttribute') event test`, (t) => {
    const xml = '<xml><hello attr1="val1" attr2="val2">world</hello></xml>'
    const parser = new SaxParser()

    let attrs = []
    let endAttrCount = 0
    parser.on('startAttribute', (attr) => {
        attrs.push(attr)
    })

    parser.on('endAttribute', () => {
        endAttrCount++
    })

    parser.on('endDocument', () => {
        t.deepEqual(attrs, [{ attr1: 'val1' }, { attr2: 'val2' }])
        t.is(
            attrs.length,
            endAttrCount,
            'startAttribute counts equal to endAttribute'
        )
        t.pass()
    })

    parser.parse(xml)
})
