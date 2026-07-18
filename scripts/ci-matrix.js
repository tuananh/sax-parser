'use strict'

const { targets } = require('./prebuild-targets')

const matrix = {
    include: targets.map((target) => ({
        target: target.id,
        os: target.os_runner,
        ...(target.arch ? { arch: target.arch } : {}),
        ...(target.docker ? { docker: target.docker } : {}),
        ...(target.install_deps ? { install_deps: target.install_deps } : {}),
    })),
}

process.stdout.write(JSON.stringify(matrix))
