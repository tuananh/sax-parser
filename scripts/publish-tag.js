'use strict'

function getPublishTag(version) {
    return version.includes('-') ? 'next' : 'latest'
}

module.exports = { getPublishTag }
