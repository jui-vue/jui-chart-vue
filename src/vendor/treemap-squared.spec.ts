// Integration-level sanity check over the vendored `treemap-squared.js` (no logic reimplemented
// here - just proving the vendored file behaves as documented, following this project's
// `kinetic.js` precedent of "types + an integration-level sanity check", not a hand-traced unit
// test of logic this project didn't write). See PORT_STATUS.md's Phase F `useTreemap.ts` entry and
// `src/composables/useTreemap.ts`'s `squarifyRects()` doc comment for the full evidence/reasoning
// behind vendoring this file, and for the differential-test results (against the pre-vendoring
// hand-port) that verified this swap before it was made: byte-identical output on every fixture
// `useTreemap.spec.ts` already hand-traces, and sub-1e-9-relative-error on 400 random fuzz trials
// plus non-integer/real-world-shaped values (tiny floating-point rounding-order noise, not an
// algorithmic divergence - `Math.pow(x,2)` vs `x*x`/regrouped division order between the vendored
// library's own formulas and the prior hand-port's differently-ordered but algebraically identical
// ones).
import { describe, expect, it } from 'vitest'
import Treemap from './treemap-squared'

describe('vendored treemap-squared.js', () => {
  it('matches the hand-traced 4-value table from useTreemap.spec.ts exactly (same fixture, single squarify pass)', () => {
    // Same [4,3,2,1] @ 300x300 case useTreemap.spec.ts hand-derives box-by-box in its own comment.
    const coords = Treemap.generate([4, 3, 2, 1], 300, 300, 0, 0) as [number, number, number, number][]
    expect(coords).toEqual([
      [0, 0, 210, 1200 / 7],
      [0, 1200 / 7, 210, 1200 / 7 + 900 / 7],
      [210, 0, 300, 200],
      [210, 200, 300, 300],
    ])
  })

  it('a single value always fills the whole container exactly', () => {
    const coords = Treemap.generate([42], 80, 40, 5, 5) as [number, number, number, number][]
    expect(coords).toEqual([[5, 5, 85, 45]])
  })

  it('multidimensional (nested array) input squarifies group sums first, then each group\'s own values within its resulting rect - matching useTreemap.ts\'s 2-pass layoutTreemapForest() by construction', () => {
    // Same grouping useTreemap.spec.ts hand-traces for its 2-level tree: groups [[5,15],[10]] at a
    // 6x5 container (group sums 20 and 10).
    const result = Treemap.generate([[5, 15], [10]], 6, 5, 0, 0) as [number, number, number, number][][]
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([
      [0, 0, 4, 1.25],
      [0, 1.25, 4, 5],
    ])
    expect(result[1]).toEqual([[4, 0, 6, 5]])
  })

  it('KNOWN UPSTREAM BUG (documented, worked around in useTreemap.ts\'s squarifyRects): an empty values array throws instead of returning [] - squarify()\'s data.length===0 base case does a bare `return;` instead of `return stack;`, so flattenTreemap(undefined) crashes', () => {
    expect(() => Treemap.generate([], 100, 100)).toThrow()
  })
})
