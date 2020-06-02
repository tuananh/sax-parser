const test = require('ava')
const SaxParser = require('..')

test(`error test`, (t) => {
    const xml = `<xml`
    const parser = new SaxParser()

    // TODO(anh): should we stop parsing?
    parser.on('error', (err) => {
        t.is(err.code, 'ERR_BAD_START_ELEMENT')
        t.pass()
    })

    parser.parse(xml)
})
