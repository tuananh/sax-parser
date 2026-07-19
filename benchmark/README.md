# benchmark

Generates ~10 KB of XML in `index.js` (no fixture file) and runs `benchmark` against sax, `@tuananh/sax-parser`, node-xml, node-expat, saxophone, and easysax.

Each parser registers noop handlers for its start/open element, end/close element, and text events so the comparison includes event dispatch overhead.

`ltx` was previously included for reference; it is much faster but not fully XML spec compliant.

```sh
npm run benchmark
```
