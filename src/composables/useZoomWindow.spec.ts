import { describe, expect, it } from 'vitest'
import { clampZoomWindow, computeDragZoomWindow } from './useZoomWindow'

// Hand-traced against LinePage.vue's real geometry: width=600, default padding
// {left:48, right:24} => area.x=48, area.x2=576, area.width=528; 6 rows => band = 528/6 = 88,
// matching the same tick positions already Playwright-verified for the guideline/crosshair demos
// (Feb's tick center at x=180 = 48 + 88*1 + 44).
describe('computeDragZoomWindow', () => {
  it('hand-traced: drag from x=136 (left edge of index 1\'s cell) to x=400 (inside index 3\'s cell) zooms to [1, 4) - Feb, Mar, Apr', () => {
    // tick = 528/6 = 88. lo = 136-48 = 88, hi = 400-48 = 352.
    // start = floor(88/88) + 0 = 1. end = ceil(352/88) + 0 = ceil(4.0) = 4.
    expect(computeDragZoomWindow(48, 528, 6, 0, 136, 400)).toEqual({ start: 1, end: 4 })
  })

  it('drag direction does not matter - dragging right-to-left produces the same window', () => {
    expect(computeDragZoomWindow(48, 528, 6, 0, 400, 136)).toEqual({ start: 1, end: 4 })
  })

  it('composes onto an already-zoomed window via currentStart, second drag on a 3-row [1,4) window (band = 528/3 = 176)', () => {
    // Currently showing Feb,Mar,Apr (currentStart=1, visibleRowCount=3, tick=176).
    // Drag from local x=224 to x=400: lo=224-48=176, hi=400-48=352.
    // start = floor(176/176)+1 = 1+1 = 2. end = ceil(352/176)+1 = 2+1 = 3 => just Mar.
    expect(computeDragZoomWindow(48, 528, 3, 1, 224, 400)).toEqual({ start: 2, end: 3 })
  })

  it('a drag past the right edge produces an out-of-bounds (un-clamped) end - clamping is clampZoomWindow\'s job', () => {
    // hi = 700-48 = 652; ceil(652/88) = 8, past the 6-row dataset.
    expect(computeDragZoomWindow(48, 528, 6, 0, 136, 700)).toEqual({ start: 1, end: 8 })
  })

  it('zero-width drag (a plain click, dragX1 === dragX2) still returns a window (degenerate - clampZoomWindow rejects it)', () => {
    expect(computeDragZoomWindow(48, 528, 6, 0, 136, 136)).toEqual({ start: 1, end: 1 })
  })

  it('zero visible rows (empty data) falls back to currentStart for both ends rather than dividing by zero', () => {
    expect(computeDragZoomWindow(48, 528, 0, 2, 136, 400)).toEqual({ start: 2, end: 2 })
  })
})

describe('clampZoomWindow', () => {
  it('passes a fully in-bounds window through unchanged', () => {
    expect(clampZoomWindow({ start: 1, end: 4 }, 6)).toEqual({ start: 1, end: 4 })
  })

  it('clamps end down to the original data length (source: setZoom\'s "end > dataList.length" branch)', () => {
    expect(clampZoomWindow({ start: 1, end: 8 }, 6)).toEqual({ start: 1, end: 6 })
  })

  it('clamps start up to 0 (source: setZoom\'s "start < 0" branch)', () => {
    expect(clampZoomWindow({ start: -2, end: 4 }, 6)).toEqual({ start: 0, end: 4 })
  })

  it('rejects a zero-width window (a plain click) as null, matching source\'s "thumbWidth == 0" no-op', () => {
    expect(clampZoomWindow({ start: 1, end: 1 }, 6)).toBeNull()
  })

  it('rejects a reversed (start > end, post-clamp) window as null', () => {
    expect(clampZoomWindow({ start: 5, end: 2 }, 6)).toBeNull()
  })

  it('rejects a window entirely past the dataset (clamped end <= clamped start)', () => {
    expect(clampZoomWindow({ start: 8, end: 10 }, 6)).toBeNull()
  })
})
