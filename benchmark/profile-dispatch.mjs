// Micro-profile: isolate JS dispatch cost without re-parsing XML each time.
// Replays one captured batch through dispatch paths.

import { performance } from 'node:perf_hooks'
import SaxParser from '../index.js'
import { dispatchEvents, refreshListenerCache } from '../dispatch.js'
import { generateXml } from './generate-xml.mjs'

const xml = generateXml(10 * 1024)
const ITERATIONS = 50000

const noopStart = function (name, attributes) {}
const noopEnd = function (name) {}
const noopText = function (text) {}

function captureBatch() {
    let captured = null
    const parser = new SaxParser()
    parser.on('startElement', noopStart)
    parser.on('endElement', noopEnd)
    parser.on('text', noopText)

    const orig = parser._dispatchEvents.bind(parser)
    parser._dispatchEvents = function (
        xmlSource,
        recordBuffer,
        auxBuffer,
        eventCount,
        compactRecords,
    ) {
        captured = {
            xmlSource: parser._xmlSource ?? xmlSource,
            recordBuffer: Buffer.from(recordBuffer),
            auxBuffer: Buffer.from(auxBuffer),
            eventCount,
            compactRecords,
        }
        return orig(xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords)
    }

    parser.parse(xml)
    if (!captured) throw new Error('no batch captured')
    return { parser, ...captured }
}

function bench(name, iterations, fn) {
    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn()
    const ms = performance.now() - start
    return { name, ops: (iterations / ms) * 1000, us: (ms * 1000) / iterations }
}

const { parser, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords } =
    captureBatch()

console.log(`Captured batch: ${eventCount} events, records ${recordBuffer.length}B, aux ${auxBuffer.length}B`)
console.log(`compactRecords=${compactRecords}\n`)

refreshListenerCache(parser)

const results = [
    bench('full dispatchEvents (hot path)', ITERATIONS, () => {
        dispatchEvents(parser, xmlSource, recordBuffer, auxBuffer, eventCount, compactRecords)
    }),
    bench('string slice only (475 events worth)', ITERATIONS, () => {
        for (let i = 0; i < 475; i++) {
            xmlSource.slice(100, 104)
        }
    }),
    bench('readAttributes simulation', ITERATIONS / 10, () => {
        let cursor = 0
        while (cursor + 4 <= auxBuffer.length) {
            const count = auxBuffer.readUInt32LE(cursor)
            cursor += 4
            for (let j = 0; j < count; j++) {
                const nameLen = auxBuffer.readUInt32LE(cursor)
                cursor += 4
                const valueLen = auxBuffer.readUInt32LE(cursor)
                cursor += 4
                const nameOff = auxBuffer.readUInt32LE(cursor)
                cursor += 4
                const valueOff = auxBuffer.readUInt32LE(cursor)
                cursor += 4
                xmlSource.slice(nameOff, nameOff + nameLen)
                xmlSource.slice(valueOff, valueOff + valueLen)
            }
            if (count === 0) break
        }
    }),
    bench('listener call overhead (475 fn.call)', ITERATIONS, () => {
        for (let i = 0; i < 475; i++) {
            noopStart.call(parser, 'item', { id: '0' })
        }
    }),
]

for (const r of results) {
    console.log(`${r.name.padEnd(42)} ${r.ops.toFixed(0).padStart(10)} ops/s  ${r.us.toFixed(2).padStart(8)} µs/op`)
}

// Full parse for comparison
{
    const p = new SaxParser()
    p.on('startElement', noopStart)
    p.on('endElement', noopEnd)
    p.on('text', noopText)
    const r = bench('full parse (reference)', 3000, () => p.parse(xml))
    console.log(`${r.name.padEnd(42)} ${r.ops.toFixed(0).padStart(10)} ops/s  ${r.us.toFixed(2).padStart(8)} µs/op`)
}
