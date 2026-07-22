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

    test('handles CDATA with special characters', async () => {
        expect(await parse('<a><![CDATA[a && b < c > d]]></a>')).toEqual([
            ['startElement', 'a', {}],
            ['cdata', 'a && b < c > d'],
            ['endElement', 'a'],
        ])
    })

    test('does not decode entities inside CDATA', async () => {
        expect(await parse('<a><![CDATA[&amp;]]></a>')).toEqual([
            ['startElement', 'a', {}],
            ['cdata', '&amp;'],
            ['endElement', 'a'],
        ])
    })

    test('text before and after CDATA', async () => {
        expect(await parse('<a>before<![CDATA[mid]]>after</a>')).toEqual([
            ['startElement', 'a', {}],
            ['text', 'before'],
            ['cdata', 'mid'],
            ['text', 'after'],
            ['endElement', 'a'],
        ])
    })

    test('CDATA containing just 0', async () => {
        expect(await parse('<a><![CDATA[0]]></a>')).toEqual([
            ['startElement', 'a', {}],
            ['cdata', '0'],
            ['endElement', 'a'],
        ])
    })

    test('CDATA end sequence with extra ]', async () => {
        expect(await parse('<a><![CDATA[a]]]></a>')).toEqual([
            ['startElement', 'a', {}],
            ['cdata', 'a]'],
            ['endElement', 'a'],
        ])
    })
})
