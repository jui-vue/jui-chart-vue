import { describe, expect, it } from 'vitest'
import { canScroll, clampThumbGap, computeScrollStart, computeThumbGapFromStart, computeThumbSize } from './useScrollWindow'

describe('canScroll', () => {
  it('true once there are more rows than fit on screen', () => {
    expect(canScroll(6, 3)).toBe(true)
  })

  it('false when visibleCount covers (or exceeds) the whole dataset - nothing to scroll', () => {
    expect(canScroll(6, 6)).toBe(false)
    expect(canScroll(6, 10)).toBe(false)
  })

  it('false for a zero/negative visibleCount', () => {
    expect(canScroll(6, 0)).toBe(false)
    expect(canScroll(6, -1)).toBe(false)
  })
})

// Hand-traced against LinePage.vue's real "scrollable" demo geometry: width=600, default padding
// {left:48, right:24} => area.x=48, area.x2=576, trackSize (area width) = 528; 6-row dataset,
// visibleCount=3 (shows 3 of 6 months at a time) - same dataset/geometry already established by
// useZoomWindow.spec.ts's own header comment.
describe('computeThumbSize', () => {
  it('hand-traced: trackSize=528, visibleCount=3, dataLength=6 -> 528*(3/6)+2 = 266', () => {
    expect(computeThumbSize(528, 3, 6)).toBe(266)
  })

  it('a second, smaller abstract example: trackSize=200, visibleCount=5, dataLength=20 -> 200*(5/20)+2 = 52', () => {
    expect(computeThumbSize(200, 5, 20)).toBe(52)
  })

  it('clamped to the track itself, never bigger than 100% (visibleCount >= dataLength)', () => {
    expect(computeThumbSize(528, 6, 6)).toBe(528)
    expect(computeThumbSize(528, 10, 6)).toBe(528)
  })

  it('falls back to the full track for an empty dataset rather than dividing by zero', () => {
    expect(computeThumbSize(528, 3, 0)).toBe(528)
  })
})

describe('clampThumbGap', () => {
  it('hand-traced: trackSize=528, thumbSize=266 -> max gap is 528-266=262', () => {
    expect(clampThumbGap(300, 266, 528)).toBe(262)
    expect(clampThumbGap(262, 266, 528)).toBe(262)
    expect(clampThumbGap(131, 266, 528)).toBe(131)
  })

  it('negative gap (dragged past the left edge) clamps to 0', () => {
    expect(clampThumbGap(-40, 266, 528)).toBe(0)
  })

  it('never produces a negative max gap for an oversized thumb', () => {
    expect(clampThumbGap(300, 600, 528)).toBe(0)
  })
})

describe('computeScrollStart', () => {
  // trackSize=528, dataLength=6, visibleCount=3, thumbSize=266 (from computeThumbSize above),
  // max gap = 262 (from clampThumbGap above).
  it('hand-traced: gap=0 (thumb at the left edge) -> start=0, showing rows [0,3) - Jan,Feb,Mar', () => {
    expect(computeScrollStart(0, 266, 528, 6, 3)).toBe(0)
  })

  it('hand-traced: gap=131 (thumb at the exact midpoint of its travel) -> floor(131*6/528)=floor(1.488)=1', () => {
    expect(computeScrollStart(131, 266, 528, 6, 3)).toBe(1)
  })

  it('hand-traced: gap=262 (thumb fully at the right edge) -> the +1 edge correction fires (262+266=528=trackSize), reaching the true last page [3,6) - Apr,May,Jun', () => {
    // Without the +1 correction: floor(262*6/528) = floor(2.977) = 2, which would only reach
    // [2,5) - one row short of the dataset's actual end. This is exactly the correction source's
    // own `if (gap + thumbWidth == chart.area("width")) start += 1` exists for.
    expect(computeScrollStart(262, 266, 528, 6, 3)).toBe(3)
  })

  it('a second, smaller abstract example (trackSize=200, visibleCount=5, dataLength=20, thumbSize=52, max gap=148)', () => {
    expect(computeScrollStart(0, 52, 200, 20, 5)).toBe(0)
    expect(computeScrollStart(74, 52, 200, 20, 5)).toBe(7)
    expect(computeScrollStart(148, 52, 200, 20, 5)).toBe(15) // edge correction: floor(14.8)=14, +1 = 15 = dataLength-visibleCount
  })

  it('never lets start+visibleCount exceed dataLength, even from a gap past the computed max', () => {
    expect(computeScrollStart(9999, 266, 528, 6, 3)).toBe(3)
  })

  it('zero track size or empty dataset falls back to 0 rather than dividing by zero', () => {
    expect(computeScrollStart(100, 266, 0, 6, 3)).toBe(0)
    expect(computeScrollStart(100, 266, 528, 0, 3)).toBe(0)
  })
})

describe('computeThumbGapFromStart', () => {
  it('hand-traced inverse: start=0 -> gap=0', () => {
    expect(computeThumbGapFromStart(0, 528, 6, 266)).toBe(0)
  })

  it('hand-traced inverse: start=3 (last page) -> 528*3/6=264, clamped to the max gap 262', () => {
    expect(computeThumbGapFromStart(3, 528, 6, 266)).toBe(262)
  })

  it('hand-traced inverse: start=1 -> 528*1/6=88 (well within [0,262], no clamping needed)', () => {
    expect(computeThumbGapFromStart(1, 528, 6, 266)).toBe(88)
  })

  it('empty dataset falls back to 0 rather than dividing by zero', () => {
    expect(computeThumbGapFromStart(0, 528, 0, 266)).toBe(0)
  })
})
