const test = require('ava')
const SaxParser = require('..')

test(`.on('cdata') event test`, (t) => {
    const xml = `<xml><![CDATA[They're saying "x < y" & that "z > y" so I guess that means that z > x]]></xml>`
    const parser = new SaxParser()

    let cdatas = []
    parser.on('cdata', (cdata) => {
        cdatas.push(cdata)
    })

    parser.on('endDocument', () => {
        t.deepEqual(cdatas, [
            `They're saying "x < y" & that "z > y" so I guess that means that z > x`,
        ])
        t.pass()
    })

    parser.parse(xml)
})

test('text inside CDATA should not be parsed', (t) => {
    const xml = `<family><![CDATA[<mother>mom</mother><father>dad</father>]]></family>`
    const parser = new SaxParser()

    let cdatas = []
    let startElementEvCount = 0
    parser.on('cdata', (cdata) => {
        cdatas.push(cdata)
    })
    parser.on('startElement', () => {
        startElementEvCount++
    })

    parser.on('endDocument', () => {
        t.deepEqual(cdatas, ['<mother>mom</mother><father>dad</father>'])
        t.is(startElementEvCount, 1, 'startElement emitted once')
        t.pass()
    })

    parser.parse(xml)
})
