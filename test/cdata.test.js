const parse = require('.')

test('cdata test', async () => {
    const xml = `<xml><![CDATA[They're saying "x < y" & that "z > y" so I guess that means that z > x]]></xml>`
    expect(await parse(xml)).toEqual([
        ['startElement', 'xml', {}],
        [
            'cdata',
            'They\'re saying "x < y" & that "z > y" so I guess that means that z > x',
        ],
        ['endElement', 'xml'],
    ])
})

test('cdata test: should not parse inside CDATA', async () => {
    const xml = `<family><![CDATA[<mother>mom</mother><father>dad</father>]]></family>`
    expect(await parse(xml)).toEqual([
        ['startElement', 'family', {}],
        ['cdata', '<mother>mom</mother><father>dad</father>'],
        ['endElement', 'family'],
    ])
})
