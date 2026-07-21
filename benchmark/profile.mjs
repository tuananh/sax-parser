// Layered timing + optional CPU profile for bottleneck analysis.
// Usage: node benchmark/profile.mjs [--cpu-prof] [--iterations=N]

import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import SaxParser from '../index.js'
import { createSaxParser as createEksmlSaxParser } from '@eksml/xml/sax'
import { generateXml } from './generate-xml.mjs'

const TARGET_BYTES = 10 * 1024
const DEFAULT_ITERATIONS = 3000
const WARMUP = 200

const xml = generateXml(TARGET_BYTES)
const itemCount = (xml.match(/<item /g) || []).length

const noopStart = function (name, attributes) {}
const noopEnd = function (name) {}
const noopText = function (text) {}

function parseArgs(argv) {
    let iterations = DEFAULT_ITERATIONS
    let cpuProf = false
    for (const arg of argv) {
        if (arg === '--cpu-prof') cpuProf = true
        else if (arg.startsWith('--iterations=')) {
            iterations = Number(arg.slice('--iterations='.length))
        }
    }
    return { iterations, cpuProf }
}

function bench(name, iterations, fn) {
    for (let i = 0; i < WARMUP; i++) fn()
    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn()
    const ms = performance.now() - start
    const ops = (iterations / ms) * 1000
    return { name, ms, ops, perDocUs: (ms * 1000) / iterations }
}

function makeSaxParser() {
    const parser = new SaxParser()
    parser.on('startElement', noopStart)
    parser.on('endElement', noopEnd)
    parser.on('text', noopText)
    return parser
}

function makeEksmlParser() {
    const parser = createEksmlSaxParser()
    parser.on('openTag', noopStart)
    parser.on('closeTag', noopEnd)
    parser.on('text', noopText)
    return parser
}

function makeNativeNoListeners() {
    const parser = new SaxParser()
    return parser
}

function makeZeroArityListeners() {
    const parser = new SaxParser()
    parser.on('startElement', function () {})
    parser.on('endElement', function () {})
    parser.on('text', function () {})
    return parser
}

async function main() {
    const { iterations, cpuProf } = parseArgs(process.argv.slice(2))

    console.log(`XML: ${(Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1)} KB, ${itemCount} items`)
    console.log(`Iterations: ${iterations} (warmup ${WARMUP})\n`)

    const results = []

    // 1) Native parse, no listeners — upper bound for C++ tokenization + collection skip
    {
        const parser = makeNativeNoListeners()
        results.push(
            bench('native only (no listeners)', iterations, () => {
                parser.parse(xml)
            }),
        )
    }

    // 2) Zero-arity listeners — compact record path, no string materialization
    {
        const parser = makeZeroArityListeners()
        results.push(
            bench('zero-arity listeners (compact dispatch)', iterations, () => {
                parser.parse(xml)
            }),
        )
    }

    // 3) Benchmark-realistic: listeners declare args (name, attrs, text)
    {
        const parser = makeSaxParser()
        results.push(
            bench('@tuananh/sax-parser (with args)', iterations, () => {
                parser.parse(xml)
            }),
        )
    }

    // 4) eksml reference
    {
        const parser = makeEksmlParser()
        results.push(
            bench('@eksml/xml (with args)', iterations, () => {
                parser.write(xml)
                parser.close()
            }),
        )
    }

    // 5) Streaming path: coalesced write/end (JS wrapper)
    {
        const parser = makeSaxParser()
        const chunkSize = 256
        const chunks = []
        for (let i = 0; i < xml.length; i += chunkSize) {
            chunks.push(xml.slice(i, i + chunkSize))
        }
        results.push(
            bench(`streaming write/end ${chunkSize}B chunks`, iterations, () => {
                for (const chunk of chunks) parser.write(chunk)
                parser.end()
            }),
        )
    }

    // 6) Direct writev flush (bypasses JS chunk coalescing)
    {
        const parser = makeSaxParser()
        const chunkSize = 256
        const chunks = []
        for (let i = 0; i < xml.length; i += chunkSize) {
            chunks.push(xml.slice(i, i + chunkSize))
        }
        results.push(
            bench(`writev ${chunkSize}B chunks (single flush)`, iterations, () => {
                parser.writev(chunks, true)
            }),
        )
    }

    console.log('--- Layer breakdown (ops/sec, µs/doc) ---')
    for (const r of results) {
        console.log(
            `${r.name.padEnd(44)} ${r.ops.toFixed(0).padStart(8)} ops/s  ${r.perDocUs.toFixed(1).padStart(7)} µs/doc`,
        )
    }

    const native = results[0]
    const withArgs = results[2]
    const overheadPct =
        native.ops > 0 ? (((native.ops - withArgs.ops) / native.ops) * 100).toFixed(1) : '?'
    console.log(
        `\nListener + dispatch overhead vs native-only: ~${overheadPct}% throughput loss`,
    )
    console.log(
        `Gap vs eksml (with args): ${(withArgs.ops / results[3].ops).toFixed(2)}× (${withArgs.ops > results[3].ops ? 'faster' : 'slower'})`,
    )

    if (cpuProf) {
        const { Session } = await import('node:inspector/promises')
        const session = new Session()
        session.connect()
        await session.post('Profiler.enable')
        await session.post('Profiler.start')

        const parser = makeSaxParser()
        const profIterations = Math.max(iterations, 5000)
        for (let i = 0; i < profIterations; i++) parser.parse(xml)

        const { profile } = await session.post('Profiler.stop')
        const out = 'benchmark/profile.cpuprofile'
        writeFileSync(out, JSON.stringify(profile))
        console.log(`\nWrote ${out} — open in Chrome DevTools > Performance > Load profile`)

        const nodes = profile.nodes
        const samples = profile.samples || []
        const hit = new Map()
        for (const id of samples) {
            hit.set(id, (hit.get(id) || 0) + 1)
        }
        const ranked = [...hit.entries()]
            .map(([id, count]) => ({
                count,
                name: nodes[id]?.callFrame?.functionName || '(anonymous)',
                url: nodes[id]?.callFrame?.url || '',
                line: nodes[id]?.callFrame?.lineNumber,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)

        console.log('\nTop self-time samples (V8 profiler):')
        for (const row of ranked) {
            const loc = row.url ? `${row.url.split('/').pop()}:${row.line}` : ''
            console.log(`  ${row.count.toString().padStart(5)}  ${row.name}  ${loc}`)
        }
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
