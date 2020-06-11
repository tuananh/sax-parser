const parse = require('.')

describe('XML declaration test', () => {
    test('XML declaration with version and encoding', async () => {
        const xml = "<?xml version='1.0' encoding='UTF-8'?>"
        expect(await parse(xml)).toEqual([
            ['xmlDecl', { version: '1.0', encoding: 'UTF-8' }],
        ])
    })

    test('XML declaration with standalone', async () => {
        const xml = "<?xml version='1.0' encoding='UTF-8' standalone='no'?>"
        expect(await parse(xml)).toEqual([
            [
                'xmlDecl',
                { version: '1.0', encoding: 'UTF-8', standalone: 'no' },
            ],
        ])
    })

    test('XML declaration with version only', async () => {
        const xml = "<?xml version='1.0'?>"
        expect(await parse(xml)).toEqual([['xmlDecl', { version: '1.0' }]])
    })
})
