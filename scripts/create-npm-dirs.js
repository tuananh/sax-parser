'use strict'

const fs = require('fs')
const path = require('path')
const { targets } = require('./prebuild-targets')

const rootDir = path.join(__dirname, '..')
const npmDir = path.join(rootDir, 'npm')
const rootPkg = require('../package.json')

fs.mkdirSync(npmDir, { recursive: true })

for (const target of targets) {
    const pkgDir = path.join(npmDir, target.id)
    fs.mkdirSync(pkgDir, { recursive: true })

    const pkgName = `@tuananh/sax-parser-${target.id}`
    /** @type {Record<string, unknown>} */
    const pkg = {
        name: pkgName,
        version: rootPkg.version,
        description: `Prebuilt native binary for @tuananh/sax-parser on ${target.id}`,
        license: rootPkg.license,
        repository: rootPkg.repository,
        homepage: rootPkg.homepage,
        bugs: rootPkg.bugs,
        main: 'sax_parser.node',
        files: ['sax_parser.node', 'README.md', 'LICENSE'],
        os: target.os,
        cpu: target.cpu,
        engines: {
            node: '>= 18',
        },
        publishConfig: {
            access: 'public',
            registry: 'https://registry.npmjs.org/',
        },
    }

    if (target.libc) {
        pkg.libc = target.libc
    }

    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
    fs.writeFileSync(
        path.join(pkgDir, 'README.md'),
        `This is the ${target.id} build of @tuananh/sax-parser. See ${rootPkg.homepage} for details.\n`,
    )
    fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(pkgDir, 'LICENSE'))
}

console.log(`Created ${targets.length} platform package directories under npm/`)
