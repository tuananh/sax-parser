const test = require('ava')
const SaxParser = require('..')

// TODO(anh): remove skip
test.skip('processingInstruction test with target & data', (t) => {
    const xml = '<?I like XML?>'
    const parser = new SaxParser()

    let processingInstructions = []
    parser.on('processingInstruction', (target, data) => {
        processingInstructions.push([target, data])
    })

    parser.on('endDocument', () => {
        t.deepEqual(processingInstructions, [['I', 'like XML']])
        t.pass()
    })

    parser.parse(xml)
})

test.skip('processingInstruction test only target (no', (t) => {
    const xml = '<?thistarget?>'
    const parser = new SaxParser()

    let processingInstructions = []
    parser.on('processingInstruction', (target, data) => {
        processingInstructions.push([target, data])
    })

    parser.on('endDocument', () => {
        t.deepEqual(processingInstructions, [['thistarget', '']])
        t.pass()
    })

    parser.parse(xml)
})
