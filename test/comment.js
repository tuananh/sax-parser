const test = require('ava')
const SaxParser = require('..')

test(`.on('comment') event test`, (t) => {
    const xml = `
    <xml>
    <!--This is example of comment in XML1-->
    <!--This is example of comment in XML2-->
    </xml>`
    const parser = new SaxParser()

    let comments = []
    parser.on('comment', (comment) => {
        comments.push(comment)
    })

    parser.on('endDocument', () => {
        t.deepEqual(comments, ['This is example of comment in XML1', 'This is example of comment in XML2'])
        t.pass()
    })

    parser.parse(xml)
})