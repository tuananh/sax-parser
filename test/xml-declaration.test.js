const parse = require('.')

test('XML declaration test', async () => {
    const xml = "<?xml version='1.0' encoding='UTF-8'?>"
    expect(await parse(xml)).toEqual([
        ['xmlDecl', { version: '1.0', encoding: 'UTF-8' }],
    ])
})

test('XML declaration test with standalone', async () => {
    const xml = "<?xml version='1.0' encoding='UTF-8' standalone='no'?>"
    expect(await parse(xml)).toEqual([
        ['xmlDecl', { version: '1.0', encoding: 'UTF-8', standalone: 'no' }],
    ])
})
