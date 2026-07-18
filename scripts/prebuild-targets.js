'use strict'

const rootPkg = require('../package.json')

if (!rootPkg.napi?.binaryName || !Array.isArray(rootPkg.napi?.targets)) {
    throw new Error('package.json must define napi.binaryName and napi.targets')
}

const binaryName = rootPkg.napi.binaryName
const targetIds = rootPkg.napi.targets

/**
 * CI runner metadata keyed by napi.targets entry.
 *
 * @typedef {object} TargetMeta
 * @property {string[]} os
 * @property {string[]} cpu
 * @property {string} os_runner
 * @property {string | undefined} arch
 * @property {string | undefined} docker
 * @property {string | undefined} install_deps
 */

/** @type {Record<string, TargetMeta>} */
const targetMeta = {
    'darwin-x64': {
        os: ['darwin'],
        cpu: ['x64'],
        os_runner: 'macos-latest',
        arch: 'x64',
    },
    'darwin-arm64': {
        os: ['darwin'],
        cpu: ['arm64'],
        os_runner: 'macos-latest',
        arch: 'arm64',
    },
    'win32-x64-msvc': {
        os: ['win32'],
        cpu: ['x64'],
        os_runner: 'windows-latest',
        arch: 'x64',
    },
    'win32-arm64-msvc': {
        os: ['win32'],
        cpu: ['arm64'],
        os_runner: 'windows-11-arm',
        arch: 'arm64',
    },
    'linux-x64-gnu': {
        os: ['linux'],
        cpu: ['x64'],
        libc: ['glibc'],
        os_runner: 'ubuntu-latest',
    },
    'linux-x64-musl': {
        os: ['linux'],
        cpu: ['x64'],
        libc: ['musl'],
        os_runner: 'ubuntu-latest',
        docker: 'node:26-alpine',
        install_deps: 'apk add --no-cache python3 make g++',
    },
    'linux-arm64-gnu': {
        os: ['linux'],
        cpu: ['arm64'],
        libc: ['glibc'],
        os_runner: 'ubuntu-24.04-arm',
    },
    'linux-arm64-musl': {
        os: ['linux'],
        cpu: ['arm64'],
        libc: ['musl'],
        os_runner: 'ubuntu-24.04-arm',
        docker: 'node:26-alpine',
        install_deps: 'apk add --no-cache python3 make g++',
    },
}

/** @typedef {TargetMeta & { id: string, libc?: string[] }} BuildTarget */

/** @type {BuildTarget[]} */
const targets = targetIds.map((id) => {
    const meta = targetMeta[id]
    if (!meta) {
        throw new Error(`Unknown napi.targets entry "${id}". Add CI metadata in scripts/prebuild-targets.js`)
    }
    return { id, ...meta }
})

function getBinaryFileName(targetId) {
    if (!targetIds.includes(targetId)) {
        throw new Error(`Unknown target "${targetId}"`)
    }
    return `${binaryName}.${targetId}.node`
}

module.exports = { binaryName, targetIds, targets, getBinaryFileName }
