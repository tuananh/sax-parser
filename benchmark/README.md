# benchmark

Generates ~10 KB of XML in `generate-xml.mjs` (no fixture file) and runs two suites against it:

- `index.mjs` — single-write parsing: each parser receives the whole document in one call.
- `streaming.mjs` — chunked streaming: the same document is delivered incrementally (256 B and 64 B chunks), the way network or file streams deliver input.

Both suites currently compare `@tuananh/sax-parser` vs `@eksml/xml` only. Other parsers (sax, node-xml, node-expat, ltx, saxophone, easysax) remain commented in the suite files for easy re-enable.

Chunked delivery costs throughput for different reasons: native addons pay a JS<->C++ round trip per write, and pure-JS parsers pay chunk-boundary buffering. With argument decoding made mandatory (see below), per-event costs dominate both suites; the chunked suite mainly shows how much each parser's throughput degrades when input arrives incrementally.

Each parser registers noop handlers for its start/open element, end/close element, and text events. Handlers declare the parameters their events normally pass so parsers cannot skip argument decoding on a zero-arity fast path (`@tuananh/sax-parser` checks listener arity natively and skips materializing tag names, text, and attribute objects when every listener takes no arguments).

```sh
npm run benchmark
npm run benchmark:streaming
```
