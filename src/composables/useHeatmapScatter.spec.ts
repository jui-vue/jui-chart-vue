import { describe, expect, it } from 'vitest'
import { heatmapScatterBucketIndex, heatmapScatterGrid } from './useHeatmapScatter'

describe('heatmapScatterGrid', () => {
  it('hand-traces an evenly-dividing grid (30 ticks / 5 per column, value span 1000 / 250 per row)', () => {
    // xDist = 30/5 = 6, yDist = (1000-0)/250 = 4
    const grid = heatmapScatterGrid(30, 0, 1000, 5, 250, 600, 400)
    expect(grid.xDist).toBe(6)
    expect(grid.yDist).toBe(4)
    expect(grid.xSize).toBe(100) // 600/6
    expect(grid.ySize).toBe(100) // 400/4
  })

  it('offsets yDist by a nonzero yMin', () => {
    // yValue = 500 - 100 = 400, yDist = 400/200 = 2
    const grid = heatmapScatterGrid(10, 100, 500, 2, 200, 300, 50)
    expect(grid.yDist).toBe(2)
    expect(grid.ySize).toBe(25) // 50/2
  })

  it('produces a non-integer xDist/xSize when tickCount does not evenly divide by xInterval (not rounded, matching the source\'s own unguarded division)', () => {
    const grid = heatmapScatterGrid(10, 0, 100, 3, 25, 300, 100)
    expect(grid.xDist).toBeCloseTo(10 / 3)
    expect(grid.xSize).toBeCloseTo(300 / (10 / 3))
  })

  it('returns all-zero dimensions for a non-positive interval (defensive, avoids Infinity/NaN)', () => {
    const grid = heatmapScatterGrid(10, 0, 100, 0, 0, 300, 100)
    expect(grid).toEqual({ xDist: 0, yDist: 0, xSize: 0, ySize: 0 })
  })
})

describe('heatmapScatterBucketIndex', () => {
  it('hand-traces a point landing cleanly inside the grid (no rounding/clamping needed)', () => {
    // columnIndex = round(12/5) = round(2.4) = 2; rowIndex = round((450-0)/250) = round(1.8) = 2
    const idx = heatmapScatterBucketIndex(12, 450, 5, 0, 250, 6, 4)
    expect(idx).toEqual({ rowIndex: 2, columnIndex: 2 })
  })

  it('clamps a column/row index that rounds past the last valid bucket down to it', () => {
    // columnIndex = round(29/5) = round(5.8) = 6, but xDist=6 -> clamped to 5
    const idx = heatmapScatterBucketIndex(29, 0, 5, 0, 250, 6, 4)
    expect(idx.columnIndex).toBe(5)
  })

  it('clamps a negative row index up to 0 (a value below yMin)', () => {
    // rowIndex = round((-50-0)/250) = round(-0.2) = 0 already non-negative here; use a bigger negative offset
    const idx = heatmapScatterBucketIndex(0, -300, 5, 0, 250, 6, 4)
    // round(-300/250) = round(-1.2) = -1 -> clamped to 0
    expect(idx.rowIndex).toBe(0)
  })

  it('rounds to the nearest bucket, not floor (round-half-up at the .5 boundary)', () => {
    // columnIndex = round(2.5/5 * ... ) -- construct an exact .5 case: rowOrderIndex=25, xInterval=10 -> 2.5 -> rounds to 3 (JS Math.round rounds .5 up)
    const idx = heatmapScatterBucketIndex(25, 0, 10, 0, 250, 10, 4)
    expect(idx.columnIndex).toBe(3)
  })

  it('returns bucket 0 when the interval is non-positive (defensive, matches heatmapScatterGrid\'s own guard)', () => {
    const idx = heatmapScatterBucketIndex(5, 100, 0, 0, 0, 0, 0)
    expect(idx).toEqual({ rowIndex: 0, columnIndex: 0 })
  })
})
