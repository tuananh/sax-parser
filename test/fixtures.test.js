const fs = require('fs')
const path = require('path')
const parse = require('.')

const fixturesDir = path.join(__dirname, 'fixtures')

function readFixture(name) {
    return fs.readFileSync(path.join(fixturesDir, name), 'utf8')
}

function chunkString(str, size) {
    const chunks = []
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size))
    }
    return chunks
}

async function eventSignature(xml, chunkSize) {
    const events =
        chunkSize == null || chunkSize >= xml.length
            ? await parse(xml)
            : await parse(...chunkString(xml, chunkSize))
    return events.map((ev) => {
        if (ev[0] === 'startElement') {
            return ['startElement', ev[1], Object.keys(ev[2]).sort()]
        }
        return ev
    })
}

const FIXTURES = [
    'rss-feed.xml',
    'soap-envelope.xml',
    'atom-feed.xml',
    'pom.xml',
    'xmltv-epg.xml',
    'xhtml-page.xml',
    'wordpad.docx.document.xml',
    'attr-heavy-synthetic.xml',
    'commented.svg',
]

describe('real-world fixtures (adapted from eksml)', () => {
    for (const name of FIXTURES) {
        describe(name, () => {
            const xml = readFixture(name)

            test('parses without error as a single chunk', async () => {
                const events = await parse(xml)
                expect(events.some((e) => e[0] === 'error')).toBe(false)
                const starts = events.filter((e) => e[0] === 'startElement')
                const ends = events.filter((e) => e[0] === 'endElement')
                expect(starts.length).toBeGreaterThan(0)
                expect(starts.length).toBe(ends.length)
            })

            test('produces consistent events across chunk sizes', async () => {
                const sizes = [17, 64, 128, 256, 512, xml.length]
                const baseline = await eventSignature(xml, sizes[0])
                for (let i = 1; i < sizes.length; i++) {
                    expect(await eventSignature(xml, sizes[i])).toEqual(
                        baseline,
                    )
                }
            })
        })
    }

    test('rss-feed.xml exposes expected channel metadata', async () => {
        const events = await parse(readFixture('rss-feed.xml'))
        const rss = events.find(
            (e) => e[0] === 'startElement' && e[1] === 'rss',
        )
        expect(rss[2].version).toBe('2.0')
        expect(
            events.some((e) => e[0] === 'startElement' && e[1] === 'channel'),
        ).toBe(true)
    })

    test('soap-envelope.xml preserves namespaced elements', async () => {
        const events = await parse(readFixture('soap-envelope.xml'))
        const envelope = events.find(
            (e) => e[0] === 'startElement' && e[1] === 'soap:Envelope',
        )
        expect(envelope).toBeDefined()
        expect(envelope[2]['xmlns:soap']).toBe(
            'http://schemas.xmlsoap.org/soap/envelope/',
        )
        expect(
            events.some(
                (e) => e[0] === 'startElement' && e[1] === 'soap:Body',
            ),
        ).toBe(true)
    })

    test('atom-feed.xml parses feed with self-closing links', async () => {
        const events = await parse(readFixture('atom-feed.xml'))
        const links = events.filter(
            (e) => e[0] === 'startElement' && e[1] === 'link',
        )
        expect(links.length).toBeGreaterThan(0)
        expect(links.every((e) => typeof e[2].href === 'string')).toBe(true)
    })

    test('xmltv-epg.xml parses channels and programmes', async () => {
        const events = await parse(readFixture('xmltv-epg.xml'))
        const channels = events.filter(
            (e) => e[0] === 'startElement' && e[1] === 'channel',
        )
        const programmes = events.filter(
            (e) => e[0] === 'startElement' && e[1] === 'programme',
        )
        expect(channels.length).toBeGreaterThan(0)
        expect(programmes.length).toBeGreaterThan(0)
    })
})
