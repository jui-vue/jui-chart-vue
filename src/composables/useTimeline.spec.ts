import { describe, expect, it } from 'vitest'
import {
  timelineActiveBarLayout,
  timelineBarFillMode,
  timelineBarGeometry,
  timelineConnectors,
  timelineKeyIndex,
  timelineOverlayStyle,
  timelineRowFillKind,
  timelineRowIndex,
} from './useTimeline'

describe('timelineKeyIndex / timelineRowIndex', () => {
  it('maps each domain label to its positional index', () => {
    const map = timelineKeyIndex(['', 'Design', 'Development', 'Testing'])
    expect(map).toEqual({ '': 0, Design: 1, Development: 2, Testing: 3 })
    expect(timelineRowIndex('Development', map)).toBe(2)
  })

  it('coerces numeric domain labels and event keys to strings, matching JS object-key coercion', () => {
    const map = timelineKeyIndex([0, 5, 10])
    expect(map).toEqual({ '0': 0, '5': 1, '10': 2 })
    expect(timelineRowIndex(5, map)).toBe(1)
    expect(timelineRowIndex('5', map)).toBe(1)
  })

  it('returns undefined for a key with no matching row (a real, unguarded upstream possibility)', () => {
    const map = timelineKeyIndex(['Design', 'Testing'])
    expect(timelineRowIndex('Deployment', map)).toBeUndefined()
  })
})

describe('timelineBarGeometry', () => {
  it('hand-traced: x1=40, x2=180, yCenter=100, barSize=7', () => {
    // width = 180-40 = 140 (>=0, not NaN) -> valid. y = 100 - 7/2 = 96.5.
    const g = timelineBarGeometry(40, 180, 100, 7)
    expect(g).toEqual({ x: 40, y: 96.5, width: 140, height: 7, valid: true })
  })

  it('marks a negative span (etime pixel before stime pixel) invalid, matching the source\'s continue', () => {
    // width = 30-80 = -50 < 0 -> invalid, matching `if (x2-x1 < 0) continue`.
    const g = timelineBarGeometry(80, 30, 50, 7)
    expect(g.valid).toBe(false)
    expect(g.width).toBe(-50)
  })

  it('marks a NaN x2 (etime resolved to NaN) invalid', () => {
    const g = timelineBarGeometry(40, NaN, 50, 7)
    expect(g.valid).toBe(false)
  })

  it('a zero-width bar (stime === etime) is still valid - only strictly negative is rejected', () => {
    const g = timelineBarGeometry(60, 60, 50, 7)
    expect(g.valid).toBe(true)
    expect(g.width).toBe(0)
  })
})

describe('timelineRowFillKind', () => {
  it('row 0 is always "header", regardless of parity', () => {
    expect(timelineRowFillKind(0)).toBe('header')
  })

  it('odd/even rows alternate starting from row 1 (odd index -> "even" fill, matching j%2 truthy)', () => {
    expect(timelineRowFillKind(1)).toBe('even')
    expect(timelineRowFillKind(2)).toBe('odd')
    expect(timelineRowFillKind(3)).toBe('even')
    expect(timelineRowFillKind(4)).toBe('odd')
  })
})

describe('timelineConnectors', () => {
  it('hand-traced: 3 valid events, 2 connectors linking end[i] to start[i+1]', () => {
    const starts = [
      { x: 10, y: 10 },
      { x: 50, y: 30 },
      { x: 90, y: 50 },
    ]
    const ends = [
      { x: 40, y: 10 },
      { x: 80, y: 30 },
      { x: 120, y: 50 },
    ]
    const connectors = timelineConnectors(starts, ends, [true, true, true])
    expect(connectors).toEqual([
      { from: { x: 40, y: 10 }, to: { x: 50, y: 30 } },
      { from: { x: 80, y: 30 }, to: { x: 90, y: 50 } },
    ])
  })

  it('skips the connector OUT of an invalid event (matching `continue` skipping the rest of that iteration)', () => {
    const starts = [
      { x: 10, y: 10 },
      { x: 50, y: 30 },
      { x: 90, y: 50 },
    ]
    const ends = [
      { x: 40, y: 10 },
      { x: 80, y: 30 },
      { x: 120, y: 50 },
    ]
    // event 1 is invalid: no connector from event 1 -> event 2, but event 0 -> event 1 still
    // draws (event 0 is valid, and event 1's raw `starts[1]` is used regardless of event 1's own
    // validity - a faithfully-preserved upstream quirk).
    const connectors = timelineConnectors(starts, ends, [true, false, true])
    expect(connectors).toEqual([{ from: { x: 40, y: 10 }, to: { x: 50, y: 30 } }])
  })

  it('a single event produces no connectors', () => {
    expect(timelineConnectors([{ x: 0, y: 0 }], [{ x: 10, y: 0 }], [true])).toEqual([])
  })
})

describe('timelineActiveBarLayout', () => {
  it('hand-traced: yCenter=100, rowBandHeight=24 -> centered full-band rect', () => {
    const g = timelineActiveBarLayout(100, 24)
    expect(g).toEqual({ y: 88, height: 24 })
  })
})

describe('timelineOverlayStyle (activeType="rect")', () => {
  it('no active, no hover: every row hidden', () => {
    expect(timelineOverlayStyle(2, null, null)).toEqual({ visible: false, active: false })
  })

  it('hovering row 3, nothing active yet: only row 3 visible, hover-tinted (not active-tinted)', () => {
    expect(timelineOverlayStyle(3, 3, null)).toEqual({ visible: true, active: false })
    expect(timelineOverlayStyle(1, 3, null)).toEqual({ visible: false, active: false })
  })

  it('row 2 active, hovering a DIFFERENT row 4: BOTH stay visible, both hover-tinted (not active-tinted)', () => {
    // Matches setHoverRect: isTarget(4)&&cacheRectIndex(2)==k is only true for k=4 when
    // cacheRectIndex also equals 4, which it doesn't here - so row 4 gets hover tint (isTarget
    // true, but active false since 4!==2), and row 2 also stays visible (cacheRectIndex==k) but
    // ALSO not active-tinted (isTarget is false for row 2, since the hovered target is row 4).
    expect(timelineOverlayStyle(4, 4, 2)).toEqual({ visible: true, active: false })
    expect(timelineOverlayStyle(2, 4, 2)).toEqual({ visible: true, active: false })
    expect(timelineOverlayStyle(0, 4, 2)).toEqual({ visible: false, active: false })
  })

  it('hovering the active row itself: active-tinted (the only case active=true)', () => {
    expect(timelineOverlayStyle(2, 2, 2)).toEqual({ visible: true, active: true })
  })

  it('equivalence used by the component: hoverIndex forced equal to activeIndex reproduces setActiveRect\'s own post-click style for every row', () => {
    const activeIndex = 5
    for (const k of [0, 1, 5, 9]) {
      const expected = { visible: k === activeIndex, active: k === activeIndex }
      expect(timelineOverlayStyle(k, activeIndex, activeIndex)).toEqual(expected)
    }
  })
})

describe('timelineBarFillMode (activeType="bar")', () => {
  it('no active, no hover: "own"', () => {
    expect(timelineBarFillMode(1, null, null)).toBe('own')
  })

  it('hovering a non-active row: "hover"', () => {
    expect(timelineBarFillMode(3, 3, null)).toBe('hover')
    expect(timelineBarFillMode(1, 3, null)).toBe('own')
  })

  it('active row, hovering elsewhere: active row stays "active" regardless of what is hovered', () => {
    expect(timelineBarFillMode(2, 5, 2)).toBe('active')
    expect(timelineBarFillMode(5, 5, 2)).toBe('hover')
    expect(timelineBarFillMode(0, 5, 2)).toBe('own')
  })

  it('hovering the active row itself: "active" wins over "hover" (matches cacheRectIndex==k branch order)', () => {
    expect(timelineBarFillMode(2, 2, 2)).toBe('active')
  })
})
