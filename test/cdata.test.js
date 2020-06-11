const parse = require('.')

describe('CDATA test', () => {
    test('single CDATA', async () => {
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

    test('multiple CDATA', async () => {
        const xml = `<xml><![CDATA[hey there]]><![CDATA[hey there]]></xml>`
        expect(await parse(xml)).toEqual([
            ['startElement', 'xml', {}],
            ['cdata', 'hey there'],
            ['cdata', 'hey there'],
            ['endElement', 'xml'],
        ])
    })

    test('should not parse valid XML inside CDATA', async () => {
        const xml = `<family><![CDATA[<mother>mom</mother><father>dad</father>]]></family>`
        expect(await parse(xml)).toEqual([
            ['startElement', 'family', {}],
            ['cdata', '<mother>mom</mother><father>dad</father>'],
            ['endElement', 'family'],
        ])
    })
})
