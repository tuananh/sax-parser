const parse = require('.')

describe('other test (uncategorized)', () => {
    // TODO(anh): categorize these tests into their own test suite
    test('parse twice should be fine', async () => {
        const xml = '<hello attr1="val1" attr2="val2">world</hello>'
        expect(async () => {
            await parse(xml)
            await parse(xml)
        }).not.toThrow()
    })
})
