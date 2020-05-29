const { readFileSync } = require('fs')
const SaxParser = require('..')

const parser = new SaxParser()

let done = 0
const ITERATION = 100000

console.log(
    'Running %s iterations of parser.parse()',
    ITERATION.toLocaleString()
)

const start = process.hrtime()
parser.on('endDocument', () => {
    done++
    if (done === ITERATION) {
        // end[0] is in seconds, end[1] is in nanoseconds
        const end = process.hrtime(start)
        const timeInMs = (end[0] * 1000000000 + end[1]) / 1000000
        console.log('Finished %s in %s ms', ITERATION.toLocaleString(), timeInMs.toFixed(2))
    }
})

const xml = readFileSync(__dirname + '/../test/fixtures/menu.xml', 'utf-8')
parser.parse(xml)

for (let i = 0; i < ITERATION; i++) {
    parser.parse(xml)
}

while (done < 1000) {}
