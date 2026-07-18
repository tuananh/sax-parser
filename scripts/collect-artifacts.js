'use strict'

const fs = require('fs')
const path = require('path')
const { targets } = require('./prebuild-targets')

const rootDir = path.join(__dirname, '..')
const artifactsDir = path.join(rootDir, process.env.ARTIFACTS_DIR || 'artifacts')
const npmDir = path.join(rootDir, 'npm')

let copied = 0

for (const target of targets) {
    const source = path.join(artifactsDir, `bindings-${target.id}`, 'sax_parser.node')
    const destDir = path.join(npmDir, target.id)
    const dest = path.join(destDir, 'sax_parser.node')

    if (!fs.existsSync(source)) {
        console.warn(`Missing artifact for ${target.id}: ${source}`)
        continue
    }

    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(source, dest)
    copied++
    console.log(`Collected ${target.id}`)
}

if (copied === 0) {
    console.error('No native artifacts were collected')
    process.exit(1)
}

console.log(`Collected ${copied}/${targets.length} native artifacts`)

if (process.env.STRICT === '1' && copied !== targets.length) {
    console.error(`Expected ${targets.length} artifacts but collected ${copied}`)
    process.exit(1)
}
