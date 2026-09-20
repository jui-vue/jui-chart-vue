import { describe, expect, it } from 'vitest'
import { createOrdinalScale } from './useScale'
import type { BlockAxisResult } from './useAxis'
import { raycastHitTest, raycastPick, resolveRaycastBlockIndex, type RaycastArea } from './useRaycast'

/** A 4-category block axis over `interval [48, 576]` (matching this port's default 600-wide canvas
 *  with default left/right padding 48/24 - the same config `/tmp/verify_invert.js` Node-cross-
 *  checked against source's `grid/block.js` `Math.ceil(x/rangeBand)` + `raycast.js`'s own `- 1`
 *  during this port - see `useRaycast.ts`'s header comment for the full derivation). unit = 132. */
function makeBlockAxis(): BlockAxisResult {
  const scale = createOrdinalScale(['a', 'b', 'c', 'd'], [48, 576])
  return {
    type: 'block',
    scale,
    ticks: ['a', 'b', 'c', 'd'],
    values: [scale('a') as number, scale('b') as number, scale('c') as number, scale('d') as number],
    band: scale.rangeBand(),
    orient: 'bottom',
    line: false,
    hide: false,
  }
}

describe('resolveRaycastBlockIndex', () => {
  it('resolves each of the 4 bands to its own 0-indexed data row - Node-cross-checked against source', () => {
    const axis = makeBlockAxis()
    // unit=132, band starts at interval0=48 -> band i spans [48+i*132, 48+(i+1)*132)
    expect(resolveRaycastBlockIndex(axis, 48 + 10)).toBe(0)
    expect(resolveRaycastBlockIndex(axis, 48 + 131)).toBe(0)
    expect(resolveRaycastBlockIndex(axis, 48 + 132 + 10)).toBe(1)
    expect(resolveRaycastBlockIndex(axis, 48 + 2 * 132 + 50)).toBe(2)
    expect(resolveRaycastBlockIndex(axis, 48 + 3 * 132 + 131)).toBe(3)
  })

  it('clamps to index 0 below the axis start (matching OrdinalScale.invert - no upper clamp, same as source)', () => {
    const axis = makeBlockAxis()
    expect(resolveRaycastBlockIndex(axis, 0)).toBe(0)
    // beyond the last band: no clamp, matches source's own lack of one (a raycastPick cache-miss
    // handles this naturally, since no row 4+ area is ever cached)
    expect(resolveRaycastBlockIndex(axis, 48 + 4 * 132 + 10)).toBe(4)
  })
})

describe('raycastHitTest', () => {
  const area: RaycastArea = { x1: 10, x2: 30, y1: 5, y2: 25 }

  it('inclusive on all 4 edges, matching source\'s >= / <=', () => {
    expect(raycastHitTest(area, 10, 5)).toBe(true)
    expect(raycastHitTest(area, 30, 25)).toBe(true)
    expect(raycastHitTest(area, 20, 15)).toBe(true)
  })

  it('rejects just outside any edge', () => {
    expect(raycastHitTest(area, 9.99, 15)).toBe(false)
    expect(raycastHitTest(area, 30.01, 15)).toBe(false)
    expect(raycastHitTest(area, 20, 4.99)).toBe(false)
    expect(raycastHitTest(area, 20, 25.01)).toBe(false)
  })
})

describe('raycastPick', () => {
  const data = ['row0', 'row1', 'row2']
  const areas = new Map<number, RaycastArea>([
    [0, { x1: 0, x2: 10, y1: 0, y2: 10 }],
    [2, { x1: 20, x2: 30, y1: 0, y2: 10 }],
  ])

  it('returns the matched row + index on a hit', () => {
    expect(raycastPick(areas, data, 0, 5, 5)).toEqual({ data: 'row0', dataIndex: 0 })
    expect(raycastPick(areas, data, 2, 25, 5)).toEqual({ data: 'row2', dataIndex: 2 })
  })

  it('returns null on a cache miss (no area for that block index - e.g. row1 never drew a block)', () => {
    expect(raycastPick(areas, data, 1, 5, 5)).toBeNull()
  })

  it('returns null when the point is outside the cached area', () => {
    expect(raycastPick(areas, data, 0, 50, 50)).toBeNull()
  })
})
