const parse = require('.')

test.skip('processingInstruction test with target & data', async () => {
    const xml = '<?I like XML?>'
    expect(await parse(xml)).toEqual([
        ['processingInstruction', ['I', 'like XML']],
    ])
})

test.skip('processingInstruction test with target & data', async () => {
    const xml = '<?onlytarget?>'
    expect(await parse(xml)).toEqual([
        ['processingInstruction', ['onlytarget', '']],
    ])
})
