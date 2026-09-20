import { describe, expect, it } from 'vitest'
import { bubbleFormatText, bubbleRadius, bubbleRadiusDomain, scaleValue } from './useBubble'
import type { DataRow } from '../types'

describe('scaleValue', () => {
  it('linearly maps a value from [minValue, maxValue] into [minScale, maxScale]', () => {
    expect(scaleValue(5, 0, 10, 0, 100)).toBe(50)
    expect(scaleValue(0, 0, 10, 5, 30)).toBe(5)
    expect(scaleValue(10, 0, 10, 5, 30)).toBe(30)
    expect(scaleValue(2.5, 0, 10, 5, 30)).toBeCloseTo(11.25)
  })

  it('coerces minValue to 0 when minValue === maxValue (ported literal zero-division guard)', () => {
    // minValue==maxValue==10 -> coerced minValue=0, so per = (value-0)/(10-0)
    expect(scaleValue(10, 10, 10, 5, 30)).toBe(30) // per = 10/10 = 1 -> max scale
    expect(scaleValue(0, 10, 10, 5, 30)).toBe(5) // per = 0/10 = 0 -> min scale
  })
})

describe('bubbleRadiusDomain', () => {
  const data: DataRow[] = [
    { a: 1, b: 20, pop: 100 },
    { a: 5, b: 8, pop: 500 },
    { a: 3, b: 12, pop: 250 },
  ]

  it('with scaleKey set: min/max of that raw field across every row, independent of target', () => {
    expect(bubbleRadiusDomain(data, ['a', 'b'], 'pop', null)).toEqual({ min: 100, max: 500 })
  })

  it('without scaleKey, with a resolved range y-axis domain: uses that domain as-is', () => {
    expect(bubbleRadiusDomain(data, ['a', 'b'], null, { min: 0, max: 20 })).toEqual({ min: 0, max: 20 })
  })

  it('without scaleKey and no range y-axis domain (deviation fallback): raw min/max across every target field', () => {
    // a: [1,5,3] -> min 1 max 5; b: [20,8,12] -> min 8 max 20; combined min 1 max 20
    expect(bubbleRadiusDomain(data, ['a', 'b'], null, null)).toEqual({ min: 1, max: 20 })
  })

  it('ignores non-numeric values when computing scaleKey min/max', () => {
    const withGaps: DataRow[] = [{ pop: 10 }, { pop: 'n/a' }, { pop: 40 }]
    expect(bubbleRadiusDomain(withGaps, [], 'pop', null)).toEqual({ min: 10, max: 40 })
  })
})

describe('bubbleRadius', () => {
  const domain = { min: 0, max: 100 }

  it('without scaleKey, scales the point\'s own value', () => {
    expect(bubbleRadius(50, undefined, null, domain, 5, 30)).toBeCloseTo(17.5)
  })

  it('with scaleKey set and numeric on the row, uses that field instead of value', () => {
    const row = { value: 50, pop: 100 }
    expect(bubbleRadius(50, row, 'pop', domain, 5, 30)).toBe(30) // pop=100 -> max of domain -> max radius
  })

  it('with scaleKey set but non-numeric/missing on the row, falls back to value (ported typeCheck guard)', () => {
    const row = { value: 50, pop: 'n/a' }
    expect(bubbleRadius(50, row, 'pop', domain, 5, 30)).toBeCloseTo(17.5)
    expect(bubbleRadius(50, {}, 'pop', domain, 5, 30)).toBeCloseTo(17.5)
    expect(bubbleRadius(50, undefined, 'pop', domain, 5, 30)).toBeCloseTo(17.5)
  })
})

describe('bubbleFormatText', () => {
  it('without format, returns the point\'s own raw value unchanged (not the scaleKey-substituted radius value)', () => {
    expect(bubbleFormatText(42, { pop: 999 }, undefined)).toBe(42)
  })

  it('with format, calls it with the WHOLE raw data row (not just the value) - matches getFormatText()', () => {
    const row = { name: 'Tokyo', pop: 999 }
    const format = (r: DataRow) => `${r.name}: ${r.pop}`
    expect(bubbleFormatText(42, row, format)).toBe('Tokyo: 999')
  })
})
