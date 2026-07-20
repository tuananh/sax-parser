# benchmark

Generates ~10 KB of XML in `generate-xml.mjs` (no fixture file) and runs two suites against it:

- `index.mjs` — single-write parsing: each parser receives the whole document in one call.
- `streaming.mjs` — chunked streaming: the same document is delivered incrementally (256 B and 64 B chunks), the way network or file streams deliver input.

Both suites compare sax, `@tuananh/sax-parser`, `@eksml/xml`, node-xml, node-expat, ltx, saxophone, and easysax — every parser supports incremental input.

Chunked delivery costs every parser throughput, for different reasons: native addons pay a JS<->C++ round trip per write, and pure-JS parsers pay chunk-boundary buffering. With argument decoding made mandatory (see below), per-event costs dominate both suites and the rankings come out similar; the chunked suite mainly shows how much each parser's throughput degrades when input arrives incrementally.

Each parser registers noop handlers for its start/open element, end/close element, and text events. Handlers declare the parameters their events normally pass so parsers cannot skip argument decoding on a zero-arity fast path (`@tuananh/sax-parser` checks listener arity natively and skips materializing tag names, text, and attribute objects when every listener takes no arguments).

`ltx` is included for reference; it is fast but not fully XML spec compliant.

```sh
npm run benchmark
npm run benchmark:streaming
```
