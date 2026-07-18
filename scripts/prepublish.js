'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { targets, getBinaryFileName } = require('./prebuild-targets')

const rootDir = path.join(__dirname, '..')
const npmDir = path.join(rootDir, 'npm')
const rootPkgPath = path.join(rootDir, 'package.json')
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'))
const version = rootPkg.version
const optionalDependencies = {}

for (const target of targets) {
    const binaryFileName = getBinaryFileName(target.id)
    const pkgDir = path.join(npmDir, target.id)
    const binaryPath = path.join(pkgDir, binaryFileName)
    const pkgPath = path.join(pkgDir, 'package.json')

    if (!fs.existsSync(binaryPath)) {
        console.warn(`Skipping ${target.id}: ${binaryFileName} not found`)
        continue
    }

    if (!fs.existsSync(pkgPath)) {
        console.error(`Missing package.json for ${target.id}. Run npm run create-npm-dirs first.`)
        process.exit(1)
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.version = version
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    const pkgName = `@tuananh/sax-parser-${target.id}`
    optionalDependencies[pkgName] = version

    console.log(`Publishing ${pkgName}@${version}`)
    execSync('npm publish --access public', {
        cwd: pkgDir,
        stdio: 'inherit',
        env: {
            ...process.env,
            NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE || 'true',
        },
    })
}

if (Object.keys(optionalDependencies).length === 0) {
    console.error('No platform packages were published')
    process.exit(1)
}

rootPkg.optionalDependencies = optionalDependencies
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n')
console.log(`Updated optionalDependencies with ${Object.keys(optionalDependencies).length} platform packages`)
