const parse = require('.')

describe('error test', () => {
    test('error event test: invalid xml', async () => {
        const xml = '<xml'
        expect(await parse(xml)).toEqual([
            ['startElement', 'xm', {}],
            ['error', { code: 'ERR_BAD_START_ELEMENT', offset: 3 }],
        ])
    })
})
