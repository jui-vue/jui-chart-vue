import { describe, expect, it } from 'vitest'
import {
  buildFlameTree,
  filterFlameActive,
  findFlameNode,
  flameNodeOpacity,
  flameTextX,
  flameTextY,
  getFlameMaxDepth,
  layoutFlameNodes,
  type FlameSourceRow,
} from './useFlame'

// The tree used throughout this file, hand-traced once here and reused by every describe block
// below (tree structure, `buildFlameTree`'s parent-linking, `layoutFlameNodes`'s geometry, and the
// `activeIndex` zoom filter) - a 4-level call-stack-shaped tree with deliberately non-uniform
// (but evenly-dividing, to keep hand arithmetic exact) weights:
//
//           "0" main (100)
//          /              \
//   "0.0" processRequest(60)   "0.1" backgroundJob(40)
//      /            \                    |
// "0.0.0" parseInput(40)  "0.0.1" validate(20)   "0.1.0" flushQueue(40)
//    /          \
// "0.0.0.0" tokenize(25)  "0.0.0.1" normalize(15)
const ROWS: FlameSourceRow[] = [
  { index: '0', text: 'main', value: 100 },
  { index: '0.0', text: 'processRequest', value: 60 },
  { index: '0.0.0', text: 'parseInput', value: 40 },
  { index: '0.0.0.0', text: 'tokenize', value: 25 },
  { index: '0.0.0.1', text: 'normalize', value: 15 },
  { index: '0.0.1', text: 'validate', value: 20 },
  { index: '0.1', text: 'backgroundJob', value: 40 },
  { index: '0.1.0', text: 'flushQueue', value: 40 },
]

describe('buildFlameTree', () => {
  it('returns null for an empty array', () => {
    expect(buildFlameTree([])).toBeNull()
  })

  it('builds a tree with correct parent/child linking and depths (root depth = 1, matching Node.reload())', () => {
    const root = buildFlameTree(ROWS)
    expect(root).not.toBeNull()
    expect(root!.index).toBe('0')
    expect(root!.depth).toBe(1)
    expect(root!.children.map((c) => c.index)).toEqual(['0.0', '0.1'])

    const n00 = root!.children[0]
    expect(n00.depth).toBe(2)
    expect(n00.parent).toBe(root)
    expect(n00.children.map((c) => c.index)).toEqual(['0.0.0', '0.0.1'])

    const n000 = n00.children[0]
    expect(n000.depth).toBe(3)
    expect(n000.children.map((c) => c.index)).toEqual(['0.0.0.0', '0.0.0.1'])
    expect(n000.children[0].depth).toBe(4)
    expect(n000.children[0].parent).toBe(n000)
  })

  it('drops a row whose parent has not appeared yet (flagged deviation from an upstream crash)', () => {
    const root = buildFlameTree([
      { index: '0', text: 'root', value: 10 },
      { index: '0.5.0', text: 'orphan', value: 1 }, // parent "0.5" never appears
    ])
    expect(root!.children).toEqual([])
  })

  it('treats the first row as root regardless of its index string (deliberate simplification vs. insertNode\'s parseInt(index)==0 quirk)', () => {
    const root = buildFlameTree([{ index: 'weird', text: 'root', value: 5 }])
    expect(root!.index).toBe('weird')
    expect(root!.depth).toBe(1)
  })
})

describe('getFlameMaxDepth / findFlameNode', () => {
  const root = buildFlameTree(ROWS)!

  it('finds the deepest depth across the whole tree', () => {
    expect(getFlameMaxDepth(root)).toBe(4)
  })

  it('a single-node tree has maxDepth 1, never 0', () => {
    const single = buildFlameTree([{ index: '0', text: 'only', value: 1 }])!
    expect(getFlameMaxDepth(single)).toBe(1)
  })

  it('finds a node by exact index, or null when absent', () => {
    expect(findFlameNode(root, '0.0.1')?.text).toBe('validate')
    expect(findFlameNode(root, '0.9')).toBeNull()
  })
})

describe('layoutFlameNodes - hand-traced 4-level tree, area 300x200, maxDepth=4 -> rowHeight=50', () => {
  const root = buildFlameTree(ROWS)!
  const baseOpts = { areaX: 0, areaWidth: 300, areaHeight: 200, rowHeight: 50 } as const

  // Hand-computed expected geometry (nodeOrient: "bottom", the source default - root at the
  // BOTTOM row, y = areaHeight - rowHeight*depth):
  //   "0"       x=0,   y=150, w=300, depth=1  (rate n/a, spans full area)
  //   "0.0"     x=0,   y=100, w=180, depth=2  (180 = 300 * 60/100)
  //   "0.1"     x=180, y=100, w=120, depth=2  (120 = 300 * 40/100)
  //   "0.0.0"   x=0,   y=50,  w=120, depth=3  (120 = 180 * 40/60)
  //   "0.0.1"   x=120, y=50,  w=60,  depth=3  (60  = 180 * 20/60)
  //   "0.1.0"   x=180, y=50,  w=120, depth=3  (120 = 120 * 40/40, full-width single child)
  //   "0.0.0.0" x=0,   y=0,   w=75,  depth=4  (75  = 120 * 25/40)
  //   "0.0.0.1" x=75,  y=0,   w=45,  depth=4  (45  = 120 * 15/40)
  const expected: Record<string, { x: number; y: number; width: number; depth: number }> = {
    '0': { x: 0, y: 150, width: 300, depth: 1 },
    '0.0': { x: 0, y: 100, width: 180, depth: 2 },
    '0.1': { x: 180, y: 100, width: 120, depth: 2 },
    '0.0.0': { x: 0, y: 50, width: 120, depth: 3 },
    '0.0.1': { x: 120, y: 50, width: 60, depth: 3 },
    '0.1.0': { x: 180, y: 50, width: 120, depth: 3 },
    '0.0.0.0': { x: 0, y: 0, width: 75, depth: 4 },
    '0.0.0.1': { x: 75, y: 0, width: 45, depth: 4 },
  }

  it('nodeAlign "end" (source default) matches every hand-computed x/y/width/height exactly', () => {
    const nodes = layoutFlameNodes(root, { ...baseOpts, nodeOrient: 'bottom', nodeAlign: 'end' })
    expect(nodes).toHaveLength(8)
    for (const n of nodes) {
      const e = expected[n.index]
      expect({ x: n.x, y: n.y, width: n.width, depth: n.depth }, n.index).toEqual(e)
      expect(n.height).toBe(50)
    }
  })

  it('nodeAlign "start" produces the IDENTICAL positions for these evenly-dividing ratios (algorithmically different, numerically equivalent - see useFlame.ts doc comment)', () => {
    const endNodes = layoutFlameNodes(root, { ...baseOpts, nodeOrient: 'bottom', nodeAlign: 'end' })
    const startNodes = layoutFlameNodes(root, { ...baseOpts, nodeOrient: 'bottom', nodeAlign: 'start' })
    const byIndex = (list: typeof endNodes) => Object.fromEntries(list.map((n) => [n.index, { x: n.x, width: n.width }]))
    expect(byIndex(startNodes)).toEqual(byIndex(endNodes))
  })

  it('nodeOrient "top" flips the y axis: y = rowHeight * depth (root NOT at y=0 - depths start at 1, a literal preserved quirk)', () => {
    const nodes = layoutFlameNodes(root, { ...baseOpts, nodeOrient: 'top', nodeAlign: 'end' })
    const byIndex = Object.fromEntries(nodes.map((n) => [n.index, n.y]))
    expect(byIndex['0']).toBe(50) // depth 1 * 50
    expect(byIndex['0.0']).toBe(100) // depth 2 * 50
    expect(byIndex['0.0.0']).toBe(150) // depth 3 * 50
    expect(byIndex['0.0.0.0']).toBe(200) // depth 4 * 50 (never 0)
  })
})

describe('filterFlameActive - hand-traced zoom cases', () => {
  const root = buildFlameTree(ROWS)!
  const baseOpts = { areaX: 0, areaWidth: 300, areaHeight: 200, rowHeight: 50 } as const

  it('returns null for an unknown index (deliberate deviation from an upstream throw)', () => {
    expect(filterFlameActive(root, '9.9.9')).toBeNull()
  })

  it('zooming to the root itself (no ancestors) returns the root unchanged with activeDepth=1', () => {
    const f = filterFlameActive(root, '0')!
    expect(f.root).toBe(root)
    expect(f.activeDepth).toBe(1)
  })

  it('1-ancestor case: activeIndex="0.0" (value 60) - "0" is forced to value 60 (rate 1, full width, dimmed); "0.0" and its real subtree keep their real values and are NOT dimmed', () => {
    const f = filterFlameActive(root, '0.0')!
    expect(f.activeDepth).toBe(2)
    expect(f.root.value).toBe(60) // the cloned "0", forced to activeNode's value
    expect(f.root.depth).toBe(1)
    expect(f.root.children).toHaveLength(1)
    expect(f.root.children[0].index).toBe('0.0')
    expect(f.root.children[0].value).toBe(60) // real, unchanged
    expect(f.root.children[0].children.map((c) => c.index)).toEqual(['0.0.0', '0.0.1']) // real subtree intact

    const nodes = layoutFlameNodes(f.root, { ...baseOpts, nodeOrient: 'bottom', nodeAlign: 'end' })
    const byIndex = Object.fromEntries(nodes.map((n) => [n.index, n]))
    // ancestor chain node "0": rate 60/60=1 -> full width, row 1 (y=150), dimmed (depth 1 < activeDepth 2)
    expect(byIndex['0']).toMatchObject({ x: 0, y: 150, width: 300, depth: 1 })
    expect(flameNodeOpacity(byIndex['0'].depth, f.activeDepth, 0.4)).toBe(0.4)
    // active node "0.0": rate 60/60=1 -> full width, row 2 (y=100), FULL opacity (depth 2 == activeDepth)
    expect(byIndex['0.0']).toMatchObject({ x: 0, y: 100, width: 300, depth: 2 })
    expect(flameNodeOpacity(byIndex['0.0'].depth, f.activeDepth, 0.4)).toBe(1)
    // real children of "0.0" scale against "0.0"'s real value (60), same ratios as the unzoomed
    // layout, just stretched into the now-full-width parent: 120/60*300=... no, parent width is
    // 300 now (not 180), so "0.0.0" = 300 * 40/60 = 200, "0.0.1" = 300 * 20/60 = 100
    expect(byIndex['0.0.0']).toMatchObject({ x: 0, y: 50, width: 200, depth: 3 })
    expect(byIndex['0.0.1']).toMatchObject({ x: 200, y: 50, width: 100, depth: 3 })
    expect(flameNodeOpacity(byIndex['0.0.0'].depth, f.activeDepth, 0.4)).toBe(1)
  })

  it('2-ancestor case: activeIndex="0.0.0" (value 40) - both "0" and "0.0" are forced to value 40 (both rate 1, full width, both dimmed); "0.0.0" and its real subtree are NOT dimmed', () => {
    const f = filterFlameActive(root, '0.0.0')!
    expect(f.activeDepth).toBe(3)
    expect(f.root.value).toBe(40)
    expect(f.root.depth).toBe(1)
    expect(f.root.children[0].value).toBe(40)
    expect(f.root.children[0].depth).toBe(2)
    expect(f.root.children[0].children[0].index).toBe('0.0.0')
    expect(f.root.children[0].children[0].value).toBe(40) // real, unchanged

    const nodes = layoutFlameNodes(f.root, { ...baseOpts, nodeOrient: 'bottom', nodeAlign: 'end' })
    const byIndex = Object.fromEntries(nodes.map((n) => [n.index, n]))
    expect(byIndex['0']).toMatchObject({ x: 0, width: 300, depth: 1 })
    expect(byIndex['0.0']).toMatchObject({ x: 0, width: 300, depth: 2 }) // rate 40/40=1
    expect(byIndex['0.0.0']).toMatchObject({ x: 0, width: 300, depth: 3 }) // rate 40/40=1
    expect(flameNodeOpacity(1, f.activeDepth, 0.4)).toBe(0.4)
    expect(flameNodeOpacity(2, f.activeDepth, 0.4)).toBe(0.4)
    expect(flameNodeOpacity(3, f.activeDepth, 0.4)).toBe(1)
    expect(flameNodeOpacity(4, f.activeDepth, 0.4)).toBe(1)
    // real children of "0.0.0" (depth 4): "0.0.0.0"=300*25/40=187.5, "0.0.0.1"=300*15/40=112.5
    expect(byIndex['0.0.0.0']).toMatchObject({ x: 0, width: 187.5, depth: 4 })
    expect(byIndex['0.0.0.1']).toMatchObject({ x: 187.5, width: 112.5, depth: 4 })
  })
})

describe('flameNodeOpacity', () => {
  it('returns 1 for every depth when no zoom is active (activeDepth null)', () => {
    expect(flameNodeOpacity(1, null, 0.4)).toBe(1)
    expect(flameNodeOpacity(9, null, 0.4)).toBe(1)
  })
})

describe('flameTextX / flameTextY', () => {
  it('start/middle/end alignment, TEXT_MARGIN=3', () => {
    expect(flameTextX(10, 100, 'start')).toBe(13)
    expect(flameTextX(10, 100, 'middle')).toBe(60)
    expect(flameTextX(10, 100, 'end')).toBe(107)
  })

  it('vertical centering: nodeY=100, rowHeight=50, fontSize=12 -> 100 + 4 + 25 = 129', () => {
    expect(flameTextY(100, 50, 12)).toBeCloseTo(129, 10)
  })
})
