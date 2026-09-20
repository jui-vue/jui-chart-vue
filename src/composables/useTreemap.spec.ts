import { describe, expect, it } from 'vitest'
import {
  buildTreemapForest,
  flattenTreemapForest,
  isDrawableTreemapNode,
  layoutTreemapForest,
  squarifyRects,
  treemapTextX,
  treemapTextY,
  treemapTitleAnchor,
  type TreemapPositionedNode,
  type TreemapSourceRow,
} from './useTreemap'

describe('buildTreemapForest', () => {
  it('returns an empty forest for an empty array', () => {
    expect(buildTreemapForest([])).toEqual([])
  })

  it('supports MULTIPLE top-level siblings (unlike useFlame.ts\'s single-root assumption) - a real structural difference from flame.js, confirmed from chart.brush.treemap.nodemanager\'s synthetic, never-rendered root', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'Documents', value: 10 },
      { index: '1', text: 'Photos', value: 20 },
      { index: '2', text: 'Videos', value: 30 },
    ]
    const forest = buildTreemapForest(rows)
    expect(forest).toHaveLength(3)
    expect(forest.map((n) => n.index)).toEqual(['0', '1', '2'])
    expect(forest.map((n) => n.topAncestorIndex)).toEqual([0, 1, 2])
    expect(forest.map((n) => n.depth)).toEqual([1, 1, 1])
  })

  it('builds parent/child links and inherits topAncestorIndex down the tree', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'A', value: 10 },
      { index: '1', text: 'B', value: 0 },
      { index: '1.0', text: 'C', value: 5 },
      { index: '1.1', text: 'D', value: 15 },
    ]
    const forest = buildTreemapForest(rows)
    expect(forest).toHaveLength(2)
    const [a, b] = forest
    expect(a.children).toEqual([])
    expect(b.children.map((c) => c.index)).toEqual(['1.0', '1.1'])
    expect(b.children[0].parent).toBe(b)
    expect(b.children[0].depth).toBe(2)
    // topAncestorIndex inherited from the top-level ancestor (B is topAncestorIndex 1), not
    // re-derived from the child's own index string.
    expect(b.children[0].topAncestorIndex).toBe(1)
    expect(b.children[1].topAncestorIndex).toBe(1)
  })

  it('drops a row whose parent has not appeared yet (matches buildFlameTree\'s documented simplification of an upstream crash)', () => {
    const forest = buildTreemapForest([
      { index: '0', text: 'root', value: 10 },
      { index: '0.5.0', text: 'orphan', value: 1 }, // parent "0.5" never appears
    ])
    expect(forest[0].children).toEqual([])
  })
})

describe('flattenTreemapForest', () => {
  it('DFS pre-order across all top-level trees', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'A', value: 1 },
      { index: '0.0', text: 'A0', value: 1 },
      { index: '1', text: 'B', value: 1 },
    ]
    const forest = buildTreemapForest(rows)
    expect(flattenTreemapForest(forest).map((n) => n.index)).toEqual(['0', '0.0', '1'])
  })
})

describe('squarifyRects - hand-traced flat 4-value case', () => {
  // Hand-derived (see useTreemap.ts header comment) at a 10x10 container first, using values
  // [4,3,2,1] (sum 10, so normalize's multiplier is a clean 10): traced box-by-box through
  // squarify()/improvesRatio()/calculateRatio()/getCoordinates()/cutArea() by hand:
  //   v=4: x=0,y=0,        w=7, h=40/7  (~5.714286)
  //   v=3: x=0,y=40/7,     w=7, h=30/7  (~4.285714)
  //   v=2: x=7,y=0,        w=3, h=20/3  (~6.666667)
  //   v=1: x=7,y=20/3,     w=3, h=10/3  (~3.333333)
  // squarify()/calculateRatio() are scale-invariant under UNIFORM container scaling (proven in the
  // PR write-up: scaling container edges by m and values by m^2 leaves every ratio comparison
  // unchanged, and getRowCoordinates()'s x/y/width/height all scale by exactly m too) - so at a
  // 300x300 container (m=30 from the 10x10 trace above), the exact same row/column decisions apply,
  // just every coordinate scaled by 30:
  it('matches the by-hand table exactly, scaled x30 to a 300x300 container', () => {
    const rects = squarifyRects([4, 3, 2, 1], { x: 0, y: 0, width: 300, height: 300 })
    expect(rects).toHaveLength(4)

    expect(rects[0]).toEqual({ x: 0, y: 0, width: 210, height: (1200 / 7) })
    expect(rects[1].x).toBe(0)
    expect(rects[1].y).toBeCloseTo(1200 / 7, 9)
    expect(rects[1].width).toBe(210)
    expect(rects[1].height).toBeCloseTo(900 / 7, 9)
    expect(rects[2]).toEqual({ x: 210, y: 0, width: 90, height: 200 })
    expect(rects[3]).toEqual({ x: 210, y: 200, width: 90, height: 100 })

    // Areas must sum to exactly the container's area (a well-formed tiling, no gaps/overlaps for a
    // single-row-then-single-row squarify result covering the full container).
    const totalArea = rects.reduce((s, r) => s + r.width * r.height, 0)
    expect(totalArea).toBeCloseTo(300 * 300, 6)
  })

  it('returns [] for an empty values array (matches squarify()\'s own data.length===0 base case)', () => {
    expect(squarifyRects([], { x: 0, y: 0, width: 100, height: 100 })).toEqual([])
  })

  it('a single value always fills the whole container exactly', () => {
    const rects = squarifyRects([42], { x: 5, y: 5, width: 80, height: 40 })
    expect(rects).toEqual([{ x: 5, y: 5, width: 80, height: 40 }])
  })

  // Added when squarifyRects() was swapped to delegate to the vendored src/vendor/
  // treemap-squared.js (see this function's own doc comment and PORT_STATUS.md's Phase F
  // useTreemap.ts entry) - these two cases exercise behavior the small hand-traced fixtures above
  // don't: a larger (20-value) array, and a zero-value entry (which forces calculateRatio() to
  // divide by zero and produce a NaN-height degenerate box, per this port's own documented
  // "reproduced as-is, not fixed" convention).
  it('handles a larger (20-value) array without error, tiling the full container with no gaps/overlaps', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i % 5) * 7 + 3)
    const rect = { x: 10, y: 20, width: 500, height: 350 }
    const rects = squarifyRects(values, rect)
    expect(rects).toHaveLength(20)
    const totalArea = rects.reduce((s, r) => s + r.width * r.height, 0)
    expect(totalArea).toBeCloseTo(rect.width * rect.height, 6)
    for (const r of rects) {
      expect(r.width).toBeGreaterThan(0)
      expect(r.height).toBeGreaterThan(0)
    }
  })

  it('a zero-value entry produces a degenerate NaN-height box (reproduced as-is, matches calculateRatio()\'s divide-by-zero, not specially handled)', () => {
    const rects = squarifyRects([10, 0, 5], { x: 0, y: 0, width: 20, height: 10 })
    expect(rects).toHaveLength(3)
    expect(Number.isNaN(rects[1].height) || Number.isNaN(rects[1].width)).toBe(true)
  })
})

describe('layoutTreemapForest - hand-traced 2-level tree (mixed leaf + non-leaf top-level siblings)', () => {
  // Tree: topLevel = [A(leaf, value=10), B(non-leaf, children=[C(leaf,5), D(leaf,15)])].
  // Hand-derived (see useTreemap.ts header comment for the full collectTreemapGroups()
  // derivation): groups = [ {values:[5,15], leaves:[C,D]}, {values:[10], leaves:[A]} ] (B's group
  // is pushed FIRST since it's encountered before the trailing "leaf run" that collects A; note A
  // ends up in a group by itself despite being a plain leaf sibling - a real, confirmed source
  // quirk this port reproduces exactly, not "fixed" into per-leaf granularity).
  //
  // Container chosen as 6x5 (area 30 = 20+10, the two group sums) so normalize()'s multiplier is
  // exactly 1 - keeps the by-hand arithmetic in this comment traceable without an extra scaling
  // step, while still exercising the real squarify()/improvesRatio() decision logic non-trivially:
  //   group B (sum 20): squarify([20,10],[],container(0,0,6,5)) -> box for 20 = (0,0)-(4,5);
  //     then inner squarify([5,15], rect(0,0,4,5)) -> C=(0,0)-(4,1.25), D=(0,1.25)-(4,5)
  //   group A (sum 10): box = (4,0)-(6,5); inner squarify([10], rect(4,0,2,5)) -> A = the same box
  //
  // Scaled x40 to a nicer 240x200 pixel container for the demo/Playwright section (all coordinates
  // land on clean integers at that scale - see useTreemap.ts's scale-invariance argument):
  //   A: x=160,y=0,  w=80, h=200
  //   C: x=0,  y=0,  w=160,h=50
  //   D: x=0,  y=50, w=160,h=150
  it('matches the by-hand rectangle table at the 6x5 base container', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'A', value: 10 },
      { index: '1', text: 'B', value: 0 },
      { index: '1.0', text: 'C', value: 5 },
      { index: '1.1', text: 'D', value: 15 },
    ]
    const forest = buildTreemapForest(rows)
    const positioned = layoutTreemapForest(forest, { x: 0, y: 0, width: 6, height: 5 })
    const byIndex = Object.fromEntries(positioned.map((n) => [n.index, n]))

    expect(byIndex['0']).toMatchObject({ x: 4, y: 0, width: 2, height: 5 }) // A
    expect(byIndex['1.0']).toMatchObject({ x: 0, y: 0, width: 4, height: 1.25 }) // C
    expect(byIndex['1.1']).toMatchObject({ x: 0, y: 1.25, width: 4, height: 3.75 }) // D
    // B itself (non-leaf) never appears in the positioned output.
    expect(byIndex['1']).toBeUndefined()
    expect(positioned).toHaveLength(3)

    const totalArea = positioned.reduce((s, n) => s + n.width * n.height, 0)
    expect(totalArea).toBeCloseTo(30, 9)
  })

  it('matches the by-hand table scaled x40 to a 240x200 container', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'A', value: 10 },
      { index: '1', text: 'B', value: 0 },
      { index: '1.0', text: 'C', value: 5 },
      { index: '1.1', text: 'D', value: 15 },
    ]
    const forest = buildTreemapForest(rows)
    const positioned = layoutTreemapForest(forest, { x: 0, y: 0, width: 240, height: 200 })
    const byIndex = Object.fromEntries(positioned.map((n) => [n.index, n]))

    expect(byIndex['0']).toMatchObject({ x: 160, y: 0, width: 80, height: 200 })
    expect(byIndex['1.0']).toMatchObject({ x: 0, y: 0, width: 160, height: 50 })
    expect(byIndex['1.1']).toMatchObject({ x: 0, y: 50, width: 160, height: 150 })
  })
})

describe('layoutTreemapForest - 3-level single-child chain (confirmed harmless, but grouping-boundary-losing, quirk)', () => {
  // Tree: topLevel = [B(non-leaf, children=[C(non-leaf, children=[C1(leaf,5), C2(leaf,15)])])].
  // collectTreemapGroups() derivation: groups = [ {values:[5,15], leaves:[C1,C2]}, {values:[],
  // leaves:[]}, {values:[],leaves:[]} ] - B's own "leaf run" (empty, since its only child C is
  // non-leaf) and C's own "leaf run" (also empty, since its only child is non-leaf too) each
  // contribute a degenerate EMPTY group, pushed AFTER the real one. sums = [20, 0, 0].
  //
  // Fed through squarify(), a 0-value entry forces calculateRatio() to divide by zero (min=0),
  // producing Infinity - which always fails improvesRatio()'s comparison, so each 0 immediately
  // cuts its own (zero-area) row and consumes none of the real box's area. Net effect: the one real
  // group gets the FULL container (since it's the only nonzero contributor), so C1/C2 end up
  // positioned EXACTLY as if C's children were direct children of the container - i.e. this single-
  // child chain (B -> C -> [C1, C2]) is numerically harmless. This does NOT generalize to a chain
  // with real siblings at an intermediate level - see useTreemap.ts's header comment.
  it('C1/C2 land exactly where a flat squarify([5,15]) within the same container would put them', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'B', value: 0 },
      { index: '0.0', text: 'C', value: 0 },
      { index: '0.0.0', text: 'C1', value: 5 },
      { index: '0.0.1', text: 'C2', value: 15 },
    ]
    const forest = buildTreemapForest(rows)
    const positioned = layoutTreemapForest(forest, { x: 0, y: 0, width: 4, height: 5 })
    const byIndex = Object.fromEntries(positioned.map((n) => [n.index, n]))

    expect(positioned).toHaveLength(2) // B and C themselves never appear - only leaves C1/C2
    expect(byIndex['0.0.0']).toMatchObject({ x: 0, y: 0, width: 4, height: 1.25 })
    expect(byIndex['0.0.1']).toMatchObject({ x: 0, y: 1.25, width: 4, height: 3.75 })

    // Cross-check against the direct 2-node case from the previous describe block (C/D there used
    // the identical [5,15] pair inside the identical 4x5 rect) - same numbers, confirming the chain
    // really is a geometric no-op here.
    const direct = squarifyRects([5, 15], { x: 0, y: 0, width: 4, height: 5 })
    expect(byIndex['0.0.0']).toMatchObject(direct[0])
    expect(byIndex['0.0.1']).toMatchObject(direct[1])
  })
})

// Added when squarifyRects() was swapped to delegate to the vendored src/vendor/treemap-squared.js
// (see PORT_STATUS.md's Phase F useTreemap.ts entry) - a larger, more realistic tree (multiple
// top-level nodes mixing leaves and multi-child non-leaves, one 3-level branch) than the small
// hand-traced fixtures above, checked for structural invariants rather than by-hand numbers.
describe('layoutTreemapForest - larger mixed tree (structural invariants, not hand-traced)', () => {
  it('positions every leaf, tiles the container with no gaps/overlaps, and never positions a non-leaf', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'lone-leaf', value: 40 },
      { index: '1', text: 'group-1', value: 0 },
      { index: '1.0', text: 'g1-a', value: 12 },
      { index: '1.1', text: 'g1-b', value: 8 },
      { index: '1.2', text: 'g1-c', value: 20 },
      { index: '2', text: 'group-2', value: 0 },
      { index: '2.0', text: 'g2-sub', value: 0 },
      { index: '2.0.0', text: 'g2-sub-a', value: 15 },
      { index: '2.0.1', text: 'g2-sub-b', value: 25 },
      { index: '2.1', text: 'g2-b', value: 30 },
    ]
    const forest = buildTreemapForest(rows)
    const allNodes = flattenTreemapForest(forest)
    const leafIndexes = new Set(allNodes.filter((n) => n.children.length === 0).map((n) => n.index))
    expect(leafIndexes).toEqual(new Set(['0', '1.0', '1.1', '1.2', '2.0.0', '2.0.1', '2.1']))

    const rect = { x: 0, y: 0, width: 800, height: 600 }
    const positioned = layoutTreemapForest(forest, rect)

    // Every leaf got a position, no non-leaf did.
    expect(new Set(positioned.map((n) => n.index))).toEqual(leafIndexes)

    // Full tiling: total leaf area equals the container's area (a well-formed squarify covers the
    // whole container with no gaps/overlaps regardless of the grouping structure above it).
    const totalArea = positioned.reduce((s, n) => s + n.width * n.height, 0)
    expect(totalArea).toBeCloseTo(rect.width * rect.height, 6)

    // Every rect stays within the container bounds.
    for (const n of positioned) {
      expect(n.x).toBeGreaterThanOrEqual(rect.x - 1e-6)
      expect(n.y).toBeGreaterThanOrEqual(rect.y - 1e-6)
      expect(n.x + n.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-6)
      expect(n.y + n.height).toBeLessThanOrEqual(rect.y + rect.height + 1e-6)
    }
  })
})

describe('isDrawableTreemapNode', () => {
  const base: TreemapPositionedNode = { index: '0', text: '', value: 0, depth: 1, topAncestorIndex: 0, x: 0, y: 0, width: 0, height: 0 }

  it('skips a node only when ALL FOUR of x/y/width/height are exactly zero', () => {
    expect(isDrawableTreemapNode(base)).toBe(false)
    expect(isDrawableTreemapNode({ ...base, width: 10 })).toBe(true)
    expect(isDrawableTreemapNode({ ...base, x: 5 })).toBe(true)
  })
})

describe('treemapTitleAnchor', () => {
  it('descends via the FIRST child only (not a true bounding-box minimum) until it hits a leaf, and returns that leaf\'s real position', () => {
    const rows: TreemapSourceRow[] = [
      { index: '0', text: 'A', value: 10 },
      { index: '1', text: 'B', value: 0 },
      { index: '1.0', text: 'C', value: 5 },
      { index: '1.1', text: 'D', value: 15 },
    ]
    const forest = buildTreemapForest(rows)
    const positioned = layoutTreemapForest(forest, { x: 0, y: 0, width: 6, height: 5 })
    const byIndex = new Map(positioned.map((n) => [n.index, n]))

    const b = forest[1]
    expect(treemapTitleAnchor(b, byIndex)).toEqual({ x: 0, y: 0 }) // C's own position (B's first child)
    // A leaf's own anchor is just its own position.
    expect(treemapTitleAnchor(forest[0], byIndex)).toEqual({ x: 4, y: 0 })
  })

  it('returns null when the resolved leaf has no recorded position (e.g. an empty positioned map)', () => {
    const forest = buildTreemapForest([{ index: '0', text: 'lone-leaf', value: 0 }])
    expect(treemapTitleAnchor(forest[0], new Map())).toEqual(null)
  })
})

describe('treemapTextX / treemapTextY', () => {
  it('textAlign: start/end use TEXT_MARGIN_LEFT=3, middle centers', () => {
    expect(treemapTextX(10, 100, 'start')).toBe(13)
    expect(treemapTextX(10, 100, 'end')).toBe(107)
    expect(treemapTextX(10, 100, 'middle')).toBe(60)
  })

  it('textOrient: top anchors at y+fontSize, bottom at y+height-fontSize/2, center at vertical middle', () => {
    expect(treemapTextY(100, 50, 12, 'top')).toBe(112)
    expect(treemapTextY(100, 50, 12, 'bottom')).toBe(144)
    expect(treemapTextY(100, 50, 12, 'center')).toBe(125)
  })
})
