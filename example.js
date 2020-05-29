const { readFileSync } = require('fs')
const SaxParser = require('.')

const parser = new SaxParser()

let depth = 0
parser.on('startElement', (name) => {
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    console.log('', str)
    depth++
})

parser.on('text', (text) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += text
    console.log(str)
})

parser.on('endElement', (name) => {
    depth--
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    console.log('', str)
})

parser.on('startAttribute', (name, value) => {
    console.log('startAttribute', name, value)
})

parser.on('endAttribute', () => {
    console.log('endAttribute')
})

parser.on('cdata', (text) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += `<![CDATA[${text}]]>`
    console.log(str)
})

parser.on('comment', (comment) => {
    console.log(`<!--${comment}-->`)
})

parser.on('doctype', (doctype) => {
    console.log(`<!DOCTYPE ${doctype}>`);
})

parser.on('startDocument', () => {
    console.log('=== START ===')
})

parser.on('endDocument', () => {
    console.log('=== END ===')
})

const xml = readFileSync(__dirname + '/benchmark/test.xml', 'utf-8')
parser.parse(xml)