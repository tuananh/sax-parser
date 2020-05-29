const test = require('ava')
const SaxParser = require('..')

test('cdata test', (t) => {
    const xml = `<xml><![CDATA[They're saying "x < y" & that "z > y" so I guess that means that z > x]]></xml>`
    const parser = new SaxParser()

    let cdatas = []
    parser.on('cdata', (cdata) => {
        cdatas.push(cdata)
    })

    parser.on('endDocument', () => {
        t.deepEqual(cdatas, [`They're saying "x < y" & that "z > y" so I guess that means that z > x`])
        t.pass()
    })

    parser.parse(xml)
})