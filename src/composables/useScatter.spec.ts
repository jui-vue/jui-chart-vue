import { describe, expect, it } from 'vitest'
import { isScatterHighlighted, resolveScatterSymbol, scatterTrianglePoints } from './useScatter'

describe('resolveScatterSymbol', () => {
  it('returns a fixed shape unchanged', () => {
    expect(resolveScatterSymbol('circle', 'a', 5)).toBe('circle')
    expect(resolveScatterSymbol('cross', 'a', 5)).toBe('cross')
  })

  it('calls a callback shape with (key, value)', () => {
    const symbol = (_key: string, value: number) => (value >= 10 ? ('rectangle' as const) : ('circle' as const))
    expect(resolveScatterSymbol(symbol, 'a', 5)).toBe('circle')
    expect(resolveScatterSymbol(symbol, 'a', 15)).toBe('rectangle')
  })
})

describe('isScatterHighlighted', () => {
  it('is false when nothing is highlighted', () => {
    expect(isScatterHighlighted({ index: 0, key: 'a' }, null, false)).toBe(false)
  })

  it('without hoverSync, only the exact (index, key) match highlights', () => {
    const highlighted = { index: 2, key: 'a' }
    expect(isScatterHighlighted({ index: 2, key: 'a' }, highlighted, false)).toBe(true)
    expect(isScatterHighlighted({ index: 2, key: 'b' }, highlighted, false)).toBe(false) // same row, different target
    expect(isScatterHighlighted({ index: 3, key: 'a' }, highlighted, false)).toBe(false) // same target, different row
  })

  it('with hoverSync, every target at the same row index highlights, regardless of key', () => {
    const highlighted = { index: 2, key: 'a' }
    expect(isScatterHighlighted({ index: 2, key: 'a' }, highlighted, true)).toBe(true)
    expect(isScatterHighlighted({ index: 2, key: 'b' }, highlighted, true)).toBe(true)
    expect(isScatterHighlighted({ index: 3, key: 'a' }, highlighted, true)).toBe(false) // still a different row
  })
})

describe('scatterTrianglePoints', () => {
  it('inscribes an apex-up isoceles triangle in the size x size box centered on (x, y)', () => {
    const points = scatterTrianglePoints(100, 100, 10)
    expect(points).toBe('95,105 105,105 100,95')
  })
})
