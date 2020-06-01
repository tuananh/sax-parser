const { readFileSync } = require('fs')
const SaxParser = require('.')

const parser = new SaxParser()

let depth = 0
parser.on('startElement', (name, attribs) => {        
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    process.stdout.write(str + '\n')
    depth++
})

parser.on('text', (text) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += text
    process.stdout.write(str + '\n')
})

parser.on('endElement', (name) => {
    depth--
    let str = ''
    for (let i = 0; i < depth; ++i) str += '  ' // indentation
    str += `<${name}>`
    process.stdout.write(str + '\n')
})

parser.on('startAttribute', (name, value) => {
    // console.log('startAttribute', name, value)
})

parser.on('endAttribute', () => {
    // console.log('endAttribute')
})

parser.on('cdata', (cdata) => {
    let str = ''
    for (let i = 0; i < depth + 1; ++i) str += '  ' // indentation
    str += `<![CDATA[${cdata}]]>`
    process.stdout.write(str)
    process.stdout.write('\n')
})

parser.on('comment', (comment) => {
    process.stdout.write(`<!--${comment}-->\n`)
})

parser.on('doctype', (doctype) => {
    process.stdout.write(`<!DOCTYPE ${doctype}>\n`)
})

parser.on('startDocument', () => {
    process.stdout.write(`<!--=== START ===-->\n`)
})

parser.on('endDocument', () => {
    process.stdout.write(`<!--=== END ===-->`)
})

const xml = readFileSync(__dirname + '/benchmark/test.xml', 'utf-8')
parser.parse(xml)
