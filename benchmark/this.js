const { readFileSync } = require('fs')
const SaxParser = require('..')

const parser = new SaxParser()

let done = 0
const ITERATION = 100000

console.log('Running %s iterations of parser.parse()', ITERATION.toLocaleString());

console.time('benchmark')

parser.on('endDocument', () => {
    done++
    if (done === ITERATION) {
        console.timeEnd('benchmark')
    }
})

const xml = readFileSync(__dirname + '/../test/fixtures/menu.xml', 'utf-8')
parser.parse(xml)


for (let i = 0; i < ITERATION; i++) {
    parser.parse(xml)
}



while (done < 1000) {
    
}