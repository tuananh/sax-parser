const parse = require('.')

describe('error test', () => {
    // TODO(anh): check this again. offset should be number?
    test.skip('error event test: invalid xml', async () => {
        const xml = '<xml'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'world'],
            ['endElement', 'hello'],
        ])
    })
})
