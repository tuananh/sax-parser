'use strict'

const { spawnSync } = require('child_process')

if (process.env.npm_config_build_from_source !== 'true') {
    process.exit(0)
}

const result = spawnSync('node-gyp', ['rebuild'], {
    stdio: 'inherit',
    shell: true,
})

process.exit(result.status ?? 1)
