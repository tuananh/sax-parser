const { readFileSync } = require('fs')
const SaxParser = require('..')

const parser = new SaxParser()

const isEmptyObject = (obj) =>
    Object.keys(obj).length === 0 && obj.constructor === Object
const indent = (depth) => {
    for (let i = 0; i < depth; ++i) process.stdout.write('  ')
}

let depth = 0
parser.on('startElement', (name, attrs) => {
    indent(depth)
    process.stdout.write(`<${name}`)
    if (!isEmptyObject(attrs)) {
        process.stdout.write(' ')
        for (const key in attrs) {
            process.stdout.write(`${key}="${attrs[key]}" `)
        }
    }
    process.stdout.write('>\n')
    depth++
})

parser.on('text', (text) => {
    indent(depth + 1)
    process.stdout.write(text + '\n')
})

parser.on('endElement', (name) => {
    depth--
    indent(depth)
    process.stdout.write(`</${name}>\n`)
})

parser.on('startAttribute', (attr) => {
    // console.log('startAttribute', attr)
})

parser.on('endAttribute', () => {
    // console.log('endAttribute')
})

parser.on('cdata', (cdata) => {
    indent(depth + 1)
    process.stdout.write(`<![CDATA[${cdata}]]>\n`)
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

parser.on('error', ({ code, offset }) => {
    console.error('parse error: code=%s | offset=[%s]', code, offset)
})

parser.on('xmlDecl', (decl) => {
    process.stdout.write(`<?${JSON.stringify(decl)}?>\n`)
})

const xml = readFileSync(__dirname + '/../benchmark/test.xml', 'utf-8')
parser.parse(xml)
