const parse = require('.')

test('comment test', async () => {
    const xml = '<xml><!DOCTYPE note SYSTEM "Note.dtd"></xml>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'xml', {}],
        ['doctype', 'note SYSTEM "Note.dtd"'],
        ['endElement', 'xml'],
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

test('doctype not welformed => should throw', async () => {
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

    xmls.forEach(async (xml) => {
        expect(async () => {
            await parse(xml)
        }).rejects.toThrow()
    })
})
