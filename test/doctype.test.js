const parse = require('.')

describe('doctype test', () => {
    test('simple doctype', async () => {
        const xml = '<xml><!DOCTYPE note SYSTEM "Note.dtd"></xml>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'xml', {}],
            ['doctype', 'note SYSTEM "Note.dtd"'],
            ['endElement', 'xml'],
        ])
    })

    test('does not emit DOCTYPE as startElement', async () => {
        const events = await parse('<!DOCTYPE html><html></html>')
        expect(events.filter((e) => e[0] === 'startElement')).toEqual([
            ['startElement', 'html', {}],
        ])
        expect(events.find((e) => e[0] === 'doctype')).toEqual([
            'doctype',
            'html',
        ])
    })

    test('DOCTYPE with internal subset', async () => {
        expect(
            await parse(
                '<!DOCTYPE root [<!ELEMENT root (#PCDATA)>]><root>text</root>',
            ),
        ).toEqual([
            ['doctype', 'root [<!ELEMENT root (#PCDATA)>]'],
            ['startElement', 'root', {}],
            ['text', 'text'],
            ['endElement', 'root'],
        ])
    })

    test('DOCTYPE with PUBLIC and SYSTEM identifiers', async () => {
        expect(
            await parse(
                '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html/>',
            ),
        ).toEqual([
            [
                'doctype',
                'html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"',
            ],
            ['startElement', 'html', {}],
            ['endElement', 'html'],
        ])
    })

    test('doctype welform => should not throw', async () => {
        const xmls = [
            `<!DOCTYPE doc>`,
            `<!DOCTYPE doc SYSTEM 'foo'>`,
            `<!DOCTYPE doc SYSTEM \"foo\">`,
            `<!DOCTYPE doc PUBLIC \"foo\" 'bar'>`,
            `<!DOCTYPE doc PUBLIC \"foo'\">`,
            `<!DOCTYPE doc SYSTEM 'foo' [<!ELEMENT foo 'ANY'>]>`,
        ]
        xmls.forEach((xml) => {
            expect(async () => {
                await parse(xml)
            }).not.toThrow()
        })
    })

    test('doctype not welformed => should emit error', async () => {
        const xmls = [
            `<!DOCTYPE`,
            `<!DOCTYPE doc`,
            `<!DOCTYPE doc SYSTEM 'foo`,
            `<!DOCTYPE doc SYSTEM \"foo`,
            `<!DOCTYPE doc PUBLIC \"foo\" 'bar`,
            `<!DOCTYPE doc PUBLIC \"foo'\"`,
            `<!DOCTYPE doc SYSTEM 'foo' [<!ELEMENT foo 'ANY`,
            `<!DOCTYPE doc SYSTEM 'foo' [<!ELEMENT foo 'ANY'>`,
            `<!DOCTYPE doc SYSTEM 'foo' [<!ELEMENT foo 'ANY'>]`,
            `<!DOCTYPE doc SYSTEM 'foo' [<!ELEMENT foo 'ANY'>] `,
        ]

        for (const xml of xmls) {
            const events = await parse(xml)
            expect(events[0]).toEqual([
                'error',
                expect.objectContaining({ code: 'ERR_BAD_DOCTYPE' }),
            ])
        }
    })
})
