const parse = require('.')

test('processingInstruction test with target & instruction', async () => {
    const xml = '<?I like XML?>'
    expect(await parse(xml)).toEqual([
        ['processingInstruction', { target: 'I', instruction: 'like XML' }],
    ])
})

test('processingInstruction test with only target', async () => {
    const xml = '<?targetonly?>'
    expect(await parse(xml)).toEqual([
        ['processingInstruction', { target: 'targetonly', instruction: '' }],
    ])
})
