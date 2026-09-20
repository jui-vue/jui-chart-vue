import { describe, expect, it } from 'vitest'
import { computeBoxWidth, lineText } from './tooltipMeasure'

describe('lineText', () => {
  it('formats "key: value" when a key is present', () => {
    expect(lineText({ key: 'chrome', value: 64 })).toBe('chrome: 64')
  })

  it('formats just the value when no key is present', () => {
    expect(lineText({ value: 64 })).toBe('64')
  })

  it('stringifies a string value as-is', () => {
    expect(lineText({ key: 'label', value: 'ok' })).toBe('label: ok')
  })
})

describe('computeBoxWidth', () => {
  it('uses the longest measured line width plus padding on both sides', () => {
    expect(computeBoxWidth([10, 40, 25], 7)).toBe(40 + 7 * 2)
  })

  it('floors at the minimum box width (36) for short/empty content', () => {
    expect(computeBoxWidth([0], 7)).toBe(36)
    expect(computeBoxWidth([], 7)).toBe(36)
  })

  it('is not fooled by character count - a visually wide short string can exceed a long narrow one', () => {
    // e.g. "WWW" (wide glyphs) measuring wider in px than "iiiiii" (narrow glyphs) despite fewer chars -
    // this is exactly the case the old char-count approximation got wrong.
    expect(computeBoxWidth([30 /* "WWW" px */], 7)).toBeGreaterThan(computeBoxWidth([12 /* "iiiiii" px */], 7))
  })
})
