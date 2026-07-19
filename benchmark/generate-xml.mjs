// Shared ~10 KB synthetic document generator used by both benchmark suites
// (index.mjs measures single-write parsing, streaming.mjs measures chunked
// delivery of the same document).
export function generateXml(targetBytes) {
    const parts = ['<root>']
    let size = Buffer.byteLength(parts[0], 'utf8')
    let i = 0

    while (size < targetBytes - Buffer.byteLength('</root>', 'utf8')) {
        const item = `<item id="${i}"><name>item-${i}</name><value>value-${i}</value></item>`
        parts.push(item)
        size += Buffer.byteLength(item, 'utf8')
        i++
    }

    parts.push('</root>')
    return parts.join('')
}

export function chunkString(str, size) {
    const chunks = []
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size))
    }
    return chunks
}
