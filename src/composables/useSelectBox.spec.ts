import { describe, expect, it } from 'vitest'
import { selectBoxCells, selectBoxTicks } from './useSelectBox'

describe('selectBoxTicks', () => {
  it('steps evenly from domainMin by interval until reaching domainMax exactly (even division)', () => {
    // 0, 300, 600, then 900 (== domainMax, loop stops, final push is domainMax itself).
    expect(selectBoxTicks(0, 900, 300)).toEqual([0, 300, 600, 900])
  })

  it('overshoots past domainMax on the final tick when interval does not evenly divide the span (faithfully preserved, not clamped)', () => {
    // 0, 300, 600, 900 (< 1000, keep going), then final push at 1200 (> 1000, loop stops there).
    expect(selectBoxTicks(0, 1000, 300)).toEqual([0, 300, 600, 900, 1200])
  })

  it('offsets from a nonzero domainMin', () => {
    expect(selectBoxTicks(1000, 1900, 500)).toEqual([1000, 1500, 2000])
  })

  it('returns exactly two ticks (domainMin and the first overshooting step) when interval already exceeds the whole domain span', () => {
    expect(selectBoxTicks(0, 100, 500)).toEqual([0, 500])
  })

  it('returns an empty array for a non-positive interval (port-only guard against the source\'s unreachable-in-practice infinite loop)', () => {
    expect(selectBoxTicks(0, 1000, 0)).toEqual([])
    expect(selectBoxTicks(0, 1000, -100)).toEqual([])
  })
})

describe('selectBoxCells', () => {
  // A simple deterministic linear scale for hand-tracing: pixel = value / 10.
  const scaleX = (v: number): number => v / 10

  it('builds one cell per consecutive tick pair, all sharing the width of the FIRST pair (matching rangeBand()-for-all-cells)', () => {
    const ticks = selectBoxTicks(0, 1000, 300) // [0, 300, 600, 900, 1200]
    const cells = selectBoxCells(ticks, scaleX)
    expect(cells).toEqual([
      { start: 0, end: 300, x: 0, width: 30 },
      { start: 300, end: 600, x: 30, width: 30 },
      { start: 600, end: 900, x: 60, width: 30 },
      { start: 900, end: 1200, x: 90, width: 30 },
    ])
  })

  it('the last cell keeps the SAME width even though its own tick span overshoots domainMax (900->1200 is 300ms, same as every other cell)', () => {
    const ticks = selectBoxTicks(0, 1000, 300)
    const cells = selectBoxCells(ticks, scaleX)
    const last = cells[cells.length - 1]
    expect(last.start).toBe(900)
    expect(last.end).toBe(1200)
    expect(last.width).toBe(30) // not scaleX(1200)-scaleX(900), which would also be 30 here, but in general isn't guaranteed by construction
  })

  it('returns an empty array for fewer than 2 ticks', () => {
    expect(selectBoxCells([], scaleX)).toEqual([])
    expect(selectBoxCells([500], scaleX)).toEqual([])
  })
})
