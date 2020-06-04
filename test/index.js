const SaxParser = require('..')

/**
 * test helper
 * @param {*} xml
 * @returns {*} array of events
 */
function parse(xml) {
    const parser = new SaxParser()
    return new Promise((resolve) => {
        var evsReceived = []
        parser.on('startElement', function (name, attrs) {
            evsReceived.push(['startElement', name, attrs])
        })
        parser.on('endElement', function (name) {
            evsReceived.push(['endElement', name])
        })
        parser.on('text', function (text) {
            evsReceived.push(['text', text])
        })
        parser.on('comment', function (comment) {
            evsReceived.push(['comment', comment])
        })
        parser.on('doctype', function (doctype) {
            evsReceived.push(['doctype', doctype])
        })
        parser.on('xmlDecl', function (decl) {
            evsReceived.push(['xmlDecl', decl])
        })
        parser.on('cdata', function (cdata) {
            evsReceived.push(['cdata', cdata])
        })
        parser.on('endDocument', () => {
            resolve(evsReceived)
        })

        parser.parse(xml)
    })
}

module.exports = parse
