import { describe, expect, it } from 'vitest'
import { isDegenerateDragRect, normalizeDragRect, pointsInDragRect } from './useDragSelect'

// Hand-traced against LinePage.vue's real geometry (same dataset/axes as the guideline/crosshair/
// zoomable demos - see useZoomWindow.spec.ts's own header comment): width=600, default padding =>
// area.x=48, area.x2=576, area.width=528; 6 rows => band = 528/6 = 88, tick centers at
// 48 + 88*i + 44: Jan=92, Feb=180, Mar=268, Apr=356, May=444, Jun=532. Two targets per row
// ("visits"/"signups"), given distinct y pixels below so a drag can isolate one series' points from
// the other's.
const points = [
  { x: 92, y: 100, dataIndex: 0, dataKey: 'visits' }, // Jan/visits
  { x: 92, y: 300, dataIndex: 0, dataKey: 'signups' }, // Jan/signups
  { x: 180, y: 90, dataIndex: 1, dataKey: 'visits' }, // Feb/visits
  { x: 180, y: 280, dataIndex: 1, dataKey: 'signups' }, // Feb/signups
  { x: 268, y: 120, dataIndex: 2, dataKey: 'visits' }, // Mar/visits
  { x: 356, y: 80, dataIndex: 3, dataKey: 'visits' }, // Apr/visits
]

describe('pointsInDragRect', () => {
  it('selects only the points whose pixel falls inside the rectangle (Feb+Mar visits, x in [136,300], y in [0,150])', () => {
    expect(pointsInDragRect(points, 136, 0, 300, 150)).toEqual([
      { dataIndex: 1, dataKey: 'visits' },
      { dataIndex: 2, dataKey: 'visits' },
    ])
  })

  it('rectangle corners need not be pre-sorted - dragging bottom-right to top-left gives the same result', () => {
    expect(pointsInDragRect(points, 300, 150, 136, 0)).toEqual([
      { dataIndex: 1, dataKey: 'visits' },
      { dataIndex: 2, dataKey: 'visits' },
    ])
  })

  it('a boundary-touching point is included (source uses inclusive >=/<= comparisons) - Feb/visits at y=90 falls just outside [100,300] and is excluded', () => {
    expect(pointsInDragRect(points, 92, 100, 180, 300)).toEqual([
      { dataIndex: 0, dataKey: 'visits' },
      { dataIndex: 0, dataKey: 'signups' },
      { dataIndex: 1, dataKey: 'signups' },
    ])
  })

  it('a rectangle over empty space selects nothing', () => {
    expect(pointsInDragRect(points, 1000, 1000, 1100, 1100)).toEqual([])
  })

  it('an empty points list selects nothing', () => {
    expect(pointsInDragRect([], 0, 0, 1000, 1000)).toEqual([])
  })
})

describe('normalizeDragRect', () => {
  it('passes an already-sorted rectangle through unchanged', () => {
    expect(normalizeDragRect(136, 0, 300, 150)).toEqual({ x1: 136, y1: 0, x2: 300, y2: 150 })
  })

  it('swaps a reversed x1/x2 pair (right-to-left drag)', () => {
    expect(normalizeDragRect(300, 0, 136, 150)).toEqual({ x1: 136, y1: 0, x2: 300, y2: 150 })
  })

  it('swaps a reversed y1/y2 pair (bottom-to-top drag)', () => {
    expect(normalizeDragRect(136, 150, 300, 0)).toEqual({ x1: 136, y1: 0, x2: 300, y2: 150 })
  })

  it('swaps both pairs (bottom-right to top-left drag)', () => {
    expect(normalizeDragRect(300, 150, 136, 0)).toEqual({ x1: 136, y1: 0, x2: 300, y2: 150 })
  })
})

describe('isDegenerateDragRect', () => {
  it('a real 2D drag is not degenerate', () => {
    expect(isDegenerateDragRect(136, 0, 300, 150)).toBe(false)
  })

  it('zero x-movement (source: thumbWidth == 0) is degenerate', () => {
    expect(isDegenerateDragRect(136, 0, 136, 150)).toBe(true)
  })

  it('zero y-movement (source: thumbHeight == 0) is degenerate', () => {
    expect(isDegenerateDragRect(136, 0, 300, 0)).toBe(true)
  })

  it('a plain click (zero movement on both axes) is degenerate', () => {
    expect(isDegenerateDragRect(136, 0, 136, 0)).toBe(true)
  })
})
