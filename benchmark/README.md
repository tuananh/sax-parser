benchmark
=========

`ltx` package is fastest, win by almost 2 (~1.8) order of magnitude compare with the second fastest (`@tuananh/sax-parser`). However, `ltx` is not fully compliant with XML spec. I still include `ltx` here for reference. If `ltx` works for you, use it.

```sh
node benchmark

sax x 14,277 ops/sec ±0.73% (87 runs sampled)
@tuananh/sax-parser x 45,779 ops/sec ±0.85% (85 runs sampled)
node-xml x 4,335 ops/sec ±0.51% (86 runs sampled)
node-expat x 13,028 ops/sec ±0.39% (88 runs sampled)
ltx x 81,722 ops/sec ±0.73% (89 runs sampled)
libxmljs x 8,927 ops/sec ±1.02% (88 runs sampled)
Fastest is ltx
```