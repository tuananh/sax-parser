const { readFileSync } = require('fs')
const sax = require('sax')

const parser = sax.parser(true) // strict

let done = 0
const ITERATION = 100000

console.log('Running %s iterations of parser.parse()', ITERATION.toLocaleString());

console.time('benchmark')

parser.onend = function () {
    done++
    if (done === ITERATION) {
        console.timeEnd('benchmark')
    }
}

const xml = readFileSync(__dirname + '/../test/fixtures/menu.xml', 'utf-8')

for (let i = 0; i < ITERATION; i++) {
    parser.write(xml).close()
}