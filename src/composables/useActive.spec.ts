import { describe, expect, it } from 'vitest'
import { lineActiveOpacity, pieActiveOpacity, pieActivePullOffset, toActiveKeySet } from './useActive'

describe('toActiveKeySet', () => {
  it('returns an empty set for null/undefined', () => {
    expect(toActiveKeySet(null).size).toBe(0)
    expect(toActiveKeySet(undefined).size).toBe(0)
  })

  it('wraps a single string key', () => {
    expect([...toActiveKeySet('sales')]).toEqual(['sales'])
  })

  it('wraps an array of keys as-is', () => {
    expect([...toActiveKeySet(['sales', 'profit'])].sort()).toEqual(['profit', 'sales'])
  })
})

describe('pieActivePullOffset', () => {
  it('points straight up (negative y, zero x) at centerAngle -90deg', () => {
    const { dx, dy } = pieActivePullOffset(-90, 10)
    expect(dx).toBeCloseTo(0, 10)
    expect(dy).toBeCloseTo(-10, 10)
  })

  it('points straight right (positive x, zero y) at centerAngle 0deg', () => {
    const { dx, dy } = pieActivePullOffset(0, 5)
    expect(dx).toBeCloseTo(5, 10)
    expect(dy).toBeCloseTo(0, 10)
  })

  it('scales linearly with distance', () => {
    const a = pieActivePullOffset(30, 4)
    const b = pieActivePullOffset(30, 8)
    expect(b.dx).toBeCloseTo(a.dx * 2, 10)
    expect(b.dy).toBeCloseTo(a.dy * 2, 10)
  })
})

describe('pieActiveOpacity', () => {
  it('is fully opaque when nothing is active at all (isDisableAll)', () => {
    expect(pieActiveOpacity(false, false, 0.5)).toBe(1)
    expect(pieActiveOpacity(true, false, 0.5)).toBe(1)
  })

  it('is fully opaque for the active wedge once something is active', () => {
    expect(pieActiveOpacity(true, true, 0.5)).toBe(1)
  })

  it('dims a non-active wedge once something is active', () => {
    expect(pieActiveOpacity(false, true, 0.5)).toBe(0.5)
  })
})

describe('lineActiveOpacity', () => {
  it('returns the normal active opacity when active is null (no dimming configured)', () => {
    expect(lineActiveOpacity('sales', null, 1, 0.3)).toBe(1)
  })

  it('highlights the matching single-string target', () => {
    expect(lineActiveOpacity('sales', 'sales', 1, 0.3)).toBe(1)
    expect(lineActiveOpacity('profit', 'sales', 1, 0.3)).toBe(0.3)
  })

  it('highlights any target included in an active array', () => {
    expect(lineActiveOpacity('sales', ['sales', 'profit'], 1, 0.3)).toBe(1)
    expect(lineActiveOpacity('etc', ['sales', 'profit'], 1, 0.3)).toBe(0.3)
  })
})
