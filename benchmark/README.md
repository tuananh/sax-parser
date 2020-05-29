benchmark
=========

`ltx` package is fastest, win by 2 order of magnitude compare with the second fastest (`@tuananh/sax-parser`). However, it's not fully compliant with XML spec.

```sh
node benchmark

sax x 13,565 ops/sec ±0.86% (86 runs sampled)
@tuananh/sax-parser x 43,895 ops/sec ±0.97% (88 runs sampled)
node-xml x 4,142 ops/sec ±0.97% (87 runs sampled)
node-expat x 12,428 ops/sec ±0.80% (90 runs sampled)
libxmljs x 8,381 ops/sec ±1.51% (86 runs sampled)
Fastest is @tuananh/sax-parser
```