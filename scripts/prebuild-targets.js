'use strict'

/**
 * Platform targets for prebuilt native binaries.
 * Package names follow @tuananh/sax-parser-<id>, e.g. @tuananh/sax-parser-linux-x64-gnu.
 *
 * @typedef {object} BuildTarget
 * @property {string} id
 * @property {string[]} os
 * @property {string[]} cpu
 * @property {string[] | undefined} libc
 * @property {string} os_runner
 * @property {string | undefined} arch setup-node architecture (darwin/win32 cross-builds)
 * @property {string | undefined} container Docker image for musl / cross builds
 * @property {string | undefined} install_deps Shell snippet run before build (musl toolchains)
 */

/** @type {BuildTarget[]} */
const targets = [
    {
        id: 'darwin-x64',
        os: ['darwin'],
        cpu: ['x64'],
        os_runner: 'macos-latest',
        arch: 'x64',
    },
    {
        id: 'darwin-arm64',
        os: ['darwin'],
        cpu: ['arm64'],
        os_runner: 'macos-latest',
        arch: 'arm64',
    },
    {
        id: 'win32-x64',
        os: ['win32'],
        cpu: ['x64'],
        os_runner: 'windows-latest',
        arch: 'x64',
    },
    {
        id: 'win32-arm64',
        os: ['win32'],
        cpu: ['arm64'],
        os_runner: 'windows-11-arm',
        arch: 'arm64',
    },
    {
        id: 'linux-x64-gnu',
        os: ['linux'],
        cpu: ['x64'],
        libc: ['glibc'],
        os_runner: 'ubuntu-latest',
    },
    {
        id: 'linux-x64-musl',
        os: ['linux'],
        cpu: ['x64'],
        libc: ['musl'],
        os_runner: 'ubuntu-latest',
        container: 'node:22-alpine',
        install_deps: 'apk add --no-cache python3 make g++',
    },
    {
        id: 'linux-arm64-gnu',
        os: ['linux'],
        cpu: ['arm64'],
        libc: ['glibc'],
        os_runner: 'ubuntu-24.04-arm',
    },
    {
        id: 'linux-arm64-musl',
        os: ['linux'],
        cpu: ['arm64'],
        libc: ['musl'],
        os_runner: 'ubuntu-24.04-arm',
        container: 'node:22-alpine',
        install_deps: 'apk add --no-cache python3 make g++',
    },
]

module.exports = { targets }
