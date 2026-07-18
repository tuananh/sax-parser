const SaxParser = require('..')

const ITERATIONS = 2000
const WARMUP = 100
const SAMPLE_EVERY = 100
// Allow small V8 heap drift; fail on steady linear growth from leaks.
const MAX_HEAP_DRIFT_MB = 12

function runGc() {
    if (typeof global.gc === 'function') {
        global.gc()
    }
}

function heapUsedMb() {
    return process.memoryUsage().heapUsed / (1024 * 1024)
}

function sampleHeapWhileRunning(iterations, fn) {
    runGc()
    runGc()

    for (let i = 0; i < WARMUP; i++) {
        fn()
    }

    runGc()

    const samples = [heapUsedMb()]

    for (let i = 0; i < iterations; i++) {
        fn()
        if ((i + 1) % SAMPLE_EVERY === 0) {
            runGc()
            samples.push(heapUsedMb())
        }
    }

    runGc()
    samples.push(heapUsedMb())

    return samples
}

function expectStableHeap(samples) {
    const min = Math.min(...samples)
    const max = Math.max(...samples)
    const drift = max - min

    expect(drift).toBeLessThanOrEqual(MAX_HEAP_DRIFT_MB)
}

const xml =
    '<root>' +
    '<item id="0"><name>item-0</name><value>value-0</value></item>'.repeat(
        200
    ) +
    '</root>'

describe('memory test', () => {
    beforeAll(() => {
        if (typeof global.gc !== 'function') {
            console.warn(
                'Run tests with --expose-gc for reliable memory measurements (see package.json test script).'
            )
        }
    })

    test('heap stays stable across repeated parse() without listeners', () => {
        const parser = new SaxParser()
        const samples = sampleHeapWhileRunning(ITERATIONS, () => {
            parser.parse(xml)
        })

        expectStableHeap(samples)
    })

    test('heap stays stable across repeated parse() with listeners', () => {
        const parser = new SaxParser()
        parser.on('startElement', () => {})
        parser.on('endElement', () => {})
        parser.on('text', () => {})

        const samples = sampleHeapWhileRunning(ITERATIONS, () => {
            parser.parse(xml)
        })

        expectStableHeap(samples)
    })

    test('heap stays stable across repeated streaming write/end cycles', () => {
        const parser = new SaxParser()
        const item =
            '<item id="0"><name>item-0</name><value>value-0</value></item>'

        const samples = sampleHeapWhileRunning(ITERATIONS, () => {
            parser.write('<root>')
            for (let i = 0; i < 20; i++) {
                parser.write(item)
            }
            parser.write('</root>')
            parser.end()
        })

        expectStableHeap(samples)
    })
})
