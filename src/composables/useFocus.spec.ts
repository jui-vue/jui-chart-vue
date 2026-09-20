import { describe, expect, it } from 'vitest'
import { focusGridAxis, focusPixelRange, resolveFocusSelection } from './useFocus'

describe('focusGridAxis', () => {
  it('is "x" when the y-axis is "range" (the common vertical-chart case)', () => {
    expect(focusGridAxis('range')).toBe('x')
  })

  it('is "y" when the y-axis is "block" (horizontal-chart case)', () => {
    expect(focusGridAxis('block')).toBe('y')
  })
})

describe('focusPixelRange', () => {
  it('returns null when start is -1 (unset sentinel, matches draw()\'s early return)', () => {
    expect(focusPixelRange('range', (v) => v, 0, -1, 5)).toBeNull()
  })

  it('returns null when end is -1', () => {
    expect(focusPixelRange('range', (v) => v, 0, 5, -1)).toBeNull()
  })

  it('block axis: expands outward by half the rangeBand on each side (hand-traced: scale(v)=v*50, band=50, start=1,end=3)', () => {
    // scale(1) = 50, scale(3) = 150; -25/+25 => [25, 175]
    const result = focusPixelRange('block', (v) => v * 50, 50, 1, 3)
    expect(result).toEqual({ start: 25, end: 175 })
  })

  it('block axis: a single-category selection still expands to the full band width', () => {
    // scale(2) = 100; 100-25=75, 100+25=125
    const result = focusPixelRange('block', (v) => v * 50, 50, 2, 2)
    expect(result).toEqual({ start: 75, end: 125 })
  })

  it('block axis: faithfully-preserved source quirk - a reversed selection (start index after end index) applies -/+ half-band to the literal start/end params, not to whichever pixel position is smaller, so the result can come out crossed', () => {
    // scale(3)=150, scale(1)=50; start_px = 150-25=125, end_px = 50+25=75 (125 > 75)
    const result = focusPixelRange('block', (v) => v * 50, 50, 3, 1)
    expect(result).toEqual({ start: 125, end: 75 })
  })

  it('range axis: passes indices straight through the scale, no band adjustment (hand-traced: scale(v)=v*2+10, start=5,end=20)', () => {
    // scale(5) = 5*2+10 = 20; scale(20) = 20*2+10 = 50
    const result = focusPixelRange('range', (v) => v * 2 + 10, 999, 5, 20)
    expect(result).toEqual({ start: 20, end: 50 })
  })
})

describe('resolveFocusSelection', () => {
  const initial = { pendingStart: null, start: -1, end: -1 }

  it('first click arms pendingStart and leaves start/end untouched', () => {
    expect(resolveFocusSelection(initial, 3)).toEqual({ pendingStart: 3, start: -1, end: -1 })
  })

  it('second click resolves start/end sorted low/high and clears pendingStart, regardless of click order', () => {
    const afterFirst = resolveFocusSelection(initial, 3)
    expect(resolveFocusSelection(afterFirst, 7)).toEqual({ pendingStart: null, start: 3, end: 7 })

    // Same two indices, reverse click order -> same sorted result.
    const afterFirstReversed = resolveFocusSelection(initial, 7)
    expect(resolveFocusSelection(afterFirstReversed, 3)).toEqual({ pendingStart: null, start: 3, end: 7 })
  })

  it('clicking the same index twice selects that single category (start === end)', () => {
    const afterFirst = resolveFocusSelection(initial, 2)
    expect(resolveFocusSelection(afterFirst, 2)).toEqual({ pendingStart: null, start: 2, end: 2 })
  })

  it('starting a fresh selection preserves the previous completed start/end until the new one resolves', () => {
    const completed = { pendingStart: null, start: 3, end: 7 }
    const armed = resolveFocusSelection(completed, 2)
    expect(armed).toEqual({ pendingStart: 2, start: 3, end: 7 })
    expect(resolveFocusSelection(armed, 5)).toEqual({ pendingStart: null, start: 2, end: 5 })
  })
})
