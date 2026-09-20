import { describe, expect, it } from 'vitest'
import { createLinearScale, createOrdinalScale } from './useScale'

describe('createLinearScale', () => {
  it('interpolates within the domain', () => {
    const scale = createLinearScale([0, 10], [0, 100])
    expect(scale(0)).toBe(0)
    expect(scale(5)).toBe(50)
    expect(scale(10)).toBe(100)
  })

  it('extrapolates outside the domain when not clamped', () => {
    const scale = createLinearScale([0, 10], [0, 100])
    expect(scale(-5)).toBe(-50)
    expect(scale(15)).toBe(150)
  })

  it('clamps to the domain edges when clampToRange is set', () => {
    const scale = createLinearScale([0, 10], [0, 100], true)
    expect(scale(-5)).toBe(0)
    expect(scale(15)).toBe(100)
  })

  it('supports a reversed range (e.g. a "left"/"right" oriented axis)', () => {
    const scale = createLinearScale([0, 10], [100, 0])
    expect(scale(0)).toBe(100)
    expect(scale(10)).toBe(0)
    expect(scale(5)).toBe(50)
  })

  it('inverts range back to domain', () => {
    const scale = createLinearScale([0, 10], [0, 100])
    expect(scale.invert(50)).toBe(5)
  })

  it('reports min/max regardless of domain order', () => {
    const scale = createLinearScale([10, 0], [0, 100])
    expect(scale.min()).toBe(0)
    expect(scale.max()).toBe(10)
  })

  describe('ticks', () => {
    it('divides the domain into `count` even steps when isNice is false', () => {
      const scale = createLinearScale([0, 10], [0, 100])
      expect(scale.ticks(5, false)).toEqual([0, 2, 4, 6, 8, 10])
    })

    it('produces a rangeBand equal to the pixel distance between the first two ticks', () => {
      const scale = createLinearScale([0, 10], [0, 100])
      scale.ticks(5, false)
      expect(scale.rangeBand()).toBe(20)
    })

    it('rounds to nice 1/2/5/10 spacing when isNice is true', () => {
      // Hand-traced against math.js's niceNum(): range 0..97 rounds outward to 0..100 (fraction
      // 9.7 -> niceFraction 10), then spacing 100/5=20 rounds to niceFraction 2 -> 20.
      const scale = createLinearScale([0, 97], [0, 100])
      expect(scale.ticks(5, true)).toEqual([0, 20, 40, 60, 80])
    })

    it('returns an empty array for a zero domain', () => {
      const scale = createLinearScale([0, 0], [0, 100])
      expect(scale.ticks(5, false)).toEqual([])
    })

    it('reverses tick order when the domain is reversed', () => {
      const scale = createLinearScale([10, 0], [0, 100])
      expect(scale.ticks(5, false)).toEqual([10, 8, 6, 4, 2, 0])
    })
  })
})

describe('createOrdinalScale', () => {
  it('places domain entries evenly spaced, centered within the interval', () => {
    const scale = createOrdinalScale(['1Q', '2Q', '3Q', '4Q'], [0, 400])
    expect(scale('1Q')).toBe(50)
    expect(scale('2Q')).toBe(150)
    expect(scale('3Q')).toBe(250)
    expect(scale('4Q')).toBe(350)
  })

  it('resolves an integer index to the same pixel position as its domain label', () => {
    const scale = createOrdinalScale(['1Q', '2Q', '3Q', '4Q'], [0, 400])
    expect(scale(0)).toBe(50)
    expect(scale(2)).toBe(250)
  })

  it('returns null for an unknown label', () => {
    const scale = createOrdinalScale(['1Q', '2Q'], [0, 400])
    expect(scale('9Q')).toBeNull()
  })

  it('reports rangeBand as the unit spacing', () => {
    const scale = createOrdinalScale(['1Q', '2Q', '3Q', '4Q'], [0, 400])
    expect(scale.rangeBand()).toBe(100)
  })

  describe('invert', () => {
    // Ported from `util.scale.ordinal()`'s `invert()` (rangePoints branch, the only mode this
    // port produces) - recovers the (floored) domain INDEX for a pixel position, matching
    // `pin.js`'s `axis.x.invert(d)` call. Domain: 4 quarters over [0,400], unit=100,
    // range=[50,150,250,350] (same fixture as the tests above).
    it('recovers the exact index for a pixel that lands exactly on that index (round-trip via scale())', () => {
      const scale = createOrdinalScale(['1Q', '2Q', '3Q', '4Q'], [0, 400])
      expect(scale.invert(scale(0) as number)).toBe(0)
      expect(scale.invert(scale(2) as number)).toBe(2)
      expect(scale.invert(scale(3) as number)).toBe(3)
    })

    it('clamps an out-of-range (too-low) pixel to index 0, matching the original\'s clamp-before-floor', () => {
      const scale = createOrdinalScale(['1Q', '2Q', '3Q', '4Q'], [0, 400])
      expect(scale.invert(-100)).toBe(0)
    })

    it('is NaN for a single-item domain, a faithfully-ported upstream quirk (Math.min(range[0], range[1]) with range[1] undefined)', () => {
      const scale = createOrdinalScale(['A'], [0, 100])
      expect(scale.invert(50)).toBeNaN()
    })
  })
})
