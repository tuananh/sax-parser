'use strict'

const fs = require('fs')
const path = require('path')
const { getBinaryFileName } = require('./prebuild-targets')

const targetId = process.argv[2]
if (!targetId) {
    console.error('Usage: node scripts/rename-artifact.js <target-id>')
    process.exit(1)
}

const rootDir = path.join(__dirname, '..')
const built = path.join(rootDir, 'build/Release/sax_parser.node')
const dest = path.join(rootDir, getBinaryFileName(targetId))

if (!fs.existsSync(built)) {
    console.error(`Built binary not found: ${built}`)
    process.exit(1)
}

fs.copyFileSync(built, dest)
console.log(`Renamed artifact to ${path.basename(dest)}`)
