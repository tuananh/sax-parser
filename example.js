const { readFileSync } = require('fs')
const SaxParser = require('.')

const parser = new SaxParser()

const isEmptyObject = (obj) => Object.keys(obj).length === 0 && obj.constructor === Object

let depth = 0
parser.on('startElement', (name, attribs) => {        
    for (let i = 0; i < depth; ++i) process.stdout.write('  ') // indentation    
    process.stdout.write(`<${name}`)
    if (!isEmptyObject(attribs)) {
        process.stdout.write(' ')
        for (const key in attribs) {
            process.stdout.write(`${key}="${attribs[key]}"`)
        }
    }
    process.stdout.write('>\n')
    depth++
})

parser.on('text', (text) => {
    for (let i = 0; i < depth + 1; ++i) process.stdout.write('  ') // indentation    
    process.stdout.write(text + '\n')
})

parser.on('endElement', (name) => {
    depth--
    for (let i = 0; i < depth; ++i) process.stdout.write('  ') // indentation    
    process.stdout.write(`<${name}>\n`)
})

parser.on('startAttribute', (attr) => {
    // console.log('startAttribute', attr)
})

parser.on('endAttribute', () => {
    // console.log('endAttribute')
})

parser.on('cdata', (cdata) => {
    for (let i = 0; i < depth + 1; ++i) process.stdout.write('  ') // indentation    
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

const xml = readFileSync(__dirname + '/benchmark/test.xml', 'utf-8')
parser.parse(xml)
