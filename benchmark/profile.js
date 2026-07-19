'use strict'

const SaxParser = require('..')

const TARGET_BYTES = 10 * 1024

function generateXml(targetBytes) {
    const parts = ['<root>']
    let size = Buffer.byteLength(parts[0], 'utf8')
    let i = 0

    while (size < targetBytes - Buffer.byteLength('</root>', 'utf8')) {
        const item = `<item id="${i}"><name>item-${i}</name><value>value-${i}</value></item>`
        parts.push(item)
        size += Buffer.byteLength(item, 'utf8')
        i++
    }

    parts.push('</root>')
    return parts.join('')
}

const xml = generateXml(TARGET_BYTES)
const ITERATIONS = 5000

function time(label, fn) {
    // warmup
    for (let i = 0; i < 100; i++) fn()

    const start = process.hrtime.bigint()
    for (let i = 0; i < ITERATIONS; i++) fn()
    const end = process.hrtime.bigint()
    const ms = Number(end - start) / 1e6
    const ops = (ITERATIONS / ms) * 1000
    console.log(`${label}: ${ops.toFixed(0)} ops/sec (${ms.toFixed(1)} ms total)`)
}

console.log(`Profile: ${(Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1)} KB XML, ${ITERATIONS} iterations\n`)

// 1. No listeners — native parse only, events suppressed
time('no listeners', () => {
    const parser = new SaxParser()
    parser.parse(xml)
})

// 2. Zero-arity noop listeners (benchmark scenario)
time('noop listeners (0 arity)', () => {
    const parser = new SaxParser()
    const noop = function () {}
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    parser.parse(xml)
})

// 3. Reused parser + listeners (amortize setup)
{
    const parser = new SaxParser()
    const noop = function () {}
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    time('reused parser + noop listeners', () => {
        parser.parse(xml)
    })
}

// 4. Listeners that accept args (forces string decoding)
time('noop listeners (with arity)', () => {
    const parser = new SaxParser()
    const noop = function (_a, _b) {}
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    parser.parse(xml)
})

// 5. Buffer input vs string input
time('buffer input + noop listeners', () => {
    const parser = new SaxParser()
    const noop = function () {}
    parser.on('startElement', noop)
    parser.on('endElement', noop)
    parser.on('text', noop)
    parser.parse(Buffer.from(xml))
})
