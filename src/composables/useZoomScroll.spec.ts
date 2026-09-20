import { describe, expect, it } from 'vitest'
import {
  clampCornerRadius,
  computeCenterPanLeftWidth,
  computeCenterPanStart,
  computeLeftEdgeWidth,
  computeRightEdgeWidth,
  computeZoomScrollRestingWidths,
  computeZoomScrollTick,
  resolveCenterPanWindow,
  resolveLeftEdgeWindow,
  resolveRightEdgeWindow,
} from './useZoomScroll'

// Hand-traced against the same 6-row/width=600/default-padding geometry already established by
// LinePage's zoomable/scrollable demos: area.x=48, area.x2=576, trackWidth=528, count=6 rows =>
// tick = 528/6 = 88 (see useZoomScroll.ts's header comment for the full source-mapping).
const TRACK_WIDTH = 528
const COUNT = 6
const TICK = 88

describe('computeZoomScrollTick', () => {
  it('divides the track by the full (un-windowed) row count', () => {
    expect(computeZoomScrollTick(TRACK_WIDTH, COUNT)).toBe(TICK)
  })

  it('returns 0 for a zero/negative count (guards a divide-by-zero, no data yet)', () => {
    expect(computeZoomScrollTick(TRACK_WIDTH, 0)).toBe(0)
  })
})

describe('computeZoomScrollRestingWidths', () => {
  it('is all-zero for the full (unzoomed) window', () => {
    expect(computeZoomScrollRestingWidths(0, COUNT, COUNT, TICK)).toEqual({ leftWidth: 0, rightWidth: 0 })
  })

  it('derives dimmed-zone widths from a committed [1, 4) window', () => {
    // left = 1 row * 88 = 88; right = (6 - 4) rows * 88 = 176
    expect(computeZoomScrollRestingWidths(1, 4, COUNT, TICK)).toEqual({ leftWidth: 88, rightWidth: 176 })
  })
})

describe('computeLeftEdgeWidth / resolveLeftEdgeWindow', () => {
  // Starting from a committed [1, 4) window (leftWidth=88, rightWidth=176 - see above), drag the
  // left handle right by a cumulative 100px: tw = 88 + 100 = 188, well under the crossing-guard max
  // (trackWidth - rightWidth - tick/2 = 528 - 176 - 44 = 308), so unclamped.
  it('grows the left width by the cumulative drag delta (unclamped case)', () => {
    expect(computeLeftEdgeWidth(88, 100, 176, TICK, TRACK_WIDTH)).toBe(188)
  })

  it('resolves the new window: start recomputed via floor(width/tick), end held fixed', () => {
    // floor(188 / 88) = 2 (was 1) - end stays at the committed 4.
    expect(resolveLeftEdgeWindow(188, TICK, 4)).toEqual({ start: 2, end: 4 })
  })

  it('hard-clamps at the crossing boundary instead of letting the handles cross', () => {
    // tw = 88 + 300 = 388, clamped to maxWidth = 528 - 176 - 44 = 308.
    expect(computeLeftEdgeWidth(88, 300, 176, TICK, TRACK_WIDTH)).toBe(308)
    // floor(308 / 88) = 3 - one tick short of the committed end (4), never reaching/crossing it.
    expect(resolveLeftEdgeWindow(308, TICK, 4)).toEqual({ start: 3, end: 4 })
  })

  it('clamps to 0 instead of going negative (dragging past the left edge)', () => {
    expect(computeLeftEdgeWidth(88, -200, 176, TICK, TRACK_WIDTH)).toBe(0)
    expect(resolveLeftEdgeWindow(0, TICK, 4)).toEqual({ start: 0, end: 4 })
  })

  it('un-clamps immediately once the drag moves back within bounds (not "sticky")', () => {
    // Same drag sequence as the clamp case above, but the next tick's dis drops back to +50 -
    // since tw is always recomputed from the FIXED mousedown-width anchor (not incrementally), the
    // result reflects the smaller dis exactly, with no lingering clamp state.
    const clamped = computeLeftEdgeWidth(88, 300, 176, TICK, TRACK_WIDTH)
    expect(clamped).toBe(308)
    const backOff = computeLeftEdgeWidth(88, 50, 176, TICK, TRACK_WIDTH)
    expect(backOff).toBe(138)
  })
})

describe('computeRightEdgeWidth / resolveRightEdgeWindow', () => {
  // Same committed [1, 4) window (leftWidth=88, rightWidth=176). Drag the right handle LEFT
  // (dis negative) by a cumulative 100px: tw = 176 - (-100) = 276, under the crossing-guard max
  // (trackWidth - leftWidth - tick/2 = 528 - 88 - 44 = 396).
  it('grows the right width when dragged toward the center (unclamped case)', () => {
    expect(computeRightEdgeWidth(176, -100, 88, TICK, TRACK_WIDTH)).toBe(276)
  })

  it('resolves the new window: end recomputed via count - floor(width/tick), start held fixed', () => {
    // floor(276 / 88) = 3 -> end = 6 - 3 = 3 (was 4) - start stays at the committed 1.
    expect(resolveRightEdgeWindow(276, TICK, COUNT, 1)).toEqual({ start: 1, end: 3 })
  })

  it('hard-clamps at the crossing boundary', () => {
    // tw = 176 - (-300) = 476, clamped to maxWidth = 528 - 88 - 44 = 396.
    expect(computeRightEdgeWidth(176, -300, 88, TICK, TRACK_WIDTH)).toBe(396)
    expect(resolveRightEdgeWindow(396, TICK, COUNT, 1)).toEqual({ start: 1, end: 2 })
  })

  it('clamps to 0 instead of going negative (dragging past the right edge)', () => {
    expect(computeRightEdgeWidth(176, 300, 88, TICK, TRACK_WIDTH)).toBe(0)
    expect(resolveRightEdgeWindow(0, TICK, COUNT, 1)).toEqual({ start: 1, end: 6 })
  })
})

describe('computeCenterPanLeftWidth / computeCenterPanStart / resolveCenterPanWindow', () => {
  // Committed [1, 4) window: leftWidth=88, rightWidth=176, so the center pane's own fixed width is
  // trackWidth - leftWidth - rightWidth = 528 - 88 - 176 = 264 (= 3 rows * tick, matching the
  // window's 3-row width exactly).
  const CENTER_WIDTH = 264

  it('pans the window by one tick (unclamped case)', () => {
    const width = computeCenterPanLeftWidth(88, 88, CENTER_WIDTH, TRACK_WIDTH)
    expect(width).toBe(176)
    expect(computeCenterPanStart(width, TICK)).toBe(2)
    // Both start and end shift by the same delta (+1): [1,4) -> [2,5) - a fixed-width pan.
    expect(resolveCenterPanWindow(width, TICK, 1, 4)).toEqual({ start: 2, end: 5 })
  })

  it('hard-clamps at the track\'s far right edge (pane flush against the end)', () => {
    // tw = 88 + 300 = 388, clamped to trackWidth - centerWidth = 528 - 264 = 264 exactly.
    const width = computeCenterPanLeftWidth(88, 300, CENTER_WIDTH, TRACK_WIDTH)
    expect(width).toBe(264)
    expect(computeCenterPanStart(width, TICK)).toBe(3)
    // [1,4) panned by +2 -> [3,6) - flush against count=6, never overshooting.
    expect(resolveCenterPanWindow(width, TICK, 1, 4)).toEqual({ start: 3, end: 6 })
  })

  it('hard-clamps at 0 (pane flush against the start)', () => {
    const width = computeCenterPanLeftWidth(88, -300, CENTER_WIDTH, TRACK_WIDTH)
    expect(width).toBe(0)
    expect(resolveCenterPanWindow(width, TICK, 1, 4)).toEqual({ start: 0, end: 3 })
  })
})

describe('clampCornerRadius', () => {
  it('leaves an already-safe radius unchanged', () => {
    expect(clampCornerRadius(3, 88, 43)).toBe(3)
  })

  it('clamps to half the smaller dimension when the rect has shrunk below 2x the radius', () => {
    // A 4px-wide dimmed zone (early in an edge-resize drag) with the default 3px radius: half of
    // the smaller dimension (width=4) is 2, so the radius clamps down from 3 to 2.
    expect(clampCornerRadius(3, 4, 43)).toBe(2)
  })

  it('clamps to 0 for a zero-width rect (fully closed dimmed zone)', () => {
    expect(clampCornerRadius(3, 0, 43)).toBe(0)
  })
})
