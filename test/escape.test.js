const parse = require('.')

// TODO(anh): this should work?
// ref: https://github.com/isaacs/sax-js/issues/217
test.skip('escape attribute test', async () => {
    const xml = '<x value="evil is "inside"></x>'
    expect(await parse(xml)).toEqual([
        ['startElement', 'x', { value: 'evil is "inside' }],
        ['endElement', 'x'],
    ])
})
