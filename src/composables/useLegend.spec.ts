import { describe, expect, it } from 'vitest'
import { computeLegendLayout, type LegendItem } from './useLegend'

// Deterministic fake measurer (real `measureTextWidth` needs real font metrics - not meaningful
// under vitest/jsdom, see `tooltipMeasure.ts`'s own header comment on the same split). Every
// 1-character label below measures 6px, so each item's width is always
// `fontSize(12) + 6 + PADDING(5)*2 = 28`, and the horizontal item-to-item gap is `PADDING*2 = 10`.
const measure = (label: string) => label.length * 6

const items: LegendItem[] = [
  { label: 'a', color: 'red' },
  { label: 'b', color: 'blue' },
  { label: 'c', color: 'green' },
]

describe('computeLegendLayout - horizontal, no wrap', () => {
  it('places items left-to-right with a 10px gap, align="start"', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ label: 'a', x: 0, y: 0, width: 28, height: 17, active: true })
    expect(result.items[1]).toMatchObject({ label: 'b', x: 38, y: 0, width: 28, height: 17, active: true })
    // widest (only) row = 28 + 10 + 28 = 66, minus the trailing gap
    expect(result.contentWidth).toBe(66)
    expect(result.contentHeight).toBe(17)
  })

  it('align="center" offsets the whole row within `width`', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'center',
      fontSize: 12,
      measure,
    })
    // originX = floor((400 - 66) / 2) = 167
    expect(result.items[0].x).toBe(167)
    expect(result.items[1].x).toBe(167 + 38)
  })

  it('align="end" right-aligns the whole row within `width`', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'end',
      fontSize: 12,
      measure,
    })
    // originX = 400 - 66 = 334
    expect(result.items[0].x).toBe(334)
    expect(result.items[1].x).toBe(334 + 38)
  })

  it('applies dx/dy as a final translation', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
      dx: 5,
      dy: 3,
    })
    expect(result.items[0]).toMatchObject({ x: 5, y: 3 })
    expect(result.items[1]).toMatchObject({ x: 43, y: 3 })
  })
})

describe('computeLegendLayout - horizontal, wraps', () => {
  it('wraps to a new row per item when width only fits one item at a time', () => {
    // Each item alone (28px) fits in width=50, but two together (28+10+28=66) don't.
    const result = computeLegendLayout(items, {
      width: 50,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
    })

    expect(result.items[0]).toMatchObject({ label: 'a', x: 0, y: 0 })
    expect(result.items[1]).toMatchObject({ label: 'b', x: 0, y: 17 })
    expect(result.items[2]).toMatchObject({ label: 'c', x: 0, y: 34 })
    expect(result.contentWidth).toBe(28)
    expect(result.contentHeight).toBe(51) // 3 rows * itemHeight(17)
  })

  it('never wraps the first item of a row even if it alone overflows the boundary', () => {
    const result = computeLegendLayout([items[0]], {
      width: 10, // narrower than a single item's own 28px width
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
    })
    expect(result.items[0]).toMatchObject({ x: 0, y: 0 })
    expect(result.contentWidth).toBe(28)
    expect(result.contentHeight).toBe(17)
  })
})

describe('computeLegendLayout - vertical', () => {
  it('stacks items in a single column, never wrapping', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 200,
      height: 100,
      orient: 'vertical',
      align: 'start',
      fontSize: 12,
      measure,
    })
    expect(result.items[0]).toMatchObject({ x: 0, y: 0 })
    expect(result.items[1]).toMatchObject({ x: 0, y: 17 })
    expect(result.contentWidth).toBe(28)
    expect(result.contentHeight).toBe(34)
  })

  it('align="center" offsets the column within `height`', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 200,
      height: 100,
      orient: 'vertical',
      align: 'center',
      fontSize: 12,
      measure,
    })
    // originY = floor((100 - 34) / 2) = 33
    expect(result.items[0].y).toBe(33)
    expect(result.items[1].y).toBe(50)
  })

  it('align="end" bottom-aligns the column within `height`', () => {
    const result = computeLegendLayout(items.slice(0, 2), {
      width: 200,
      height: 100,
      orient: 'vertical',
      align: 'end',
      fontSize: 12,
      measure,
    })
    // originY = 100 - 34 = 66
    expect(result.items[0].y).toBe(66)
    expect(result.items[1].y).toBe(83)
  })
})

describe('computeLegendLayout - hidden/active', () => {
  it('marks items in `hidden` (array) as inactive, others active', () => {
    const result = computeLegendLayout(items, {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
      hidden: ['b'],
    })
    expect(result.items.map((i) => [i.label, i.active])).toEqual([
      ['a', true],
      ['b', false],
      ['c', true],
    ])
  })

  it('accepts `hidden` as a Set too', () => {
    const result = computeLegendLayout(items, {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
      hidden: new Set(['a', 'c']),
    })
    expect(result.items.map((i) => [i.label, i.active])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ])
  })
})

describe('computeLegendLayout - itemHeight scales with fontSize (deliberate fix vs. source)', () => {
  it('a larger fontSize produces taller rows, unlike source\'s hardcoded 15.5px', () => {
    const small = computeLegendLayout(items.slice(0, 1), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 12,
      measure,
    })
    const large = computeLegendLayout(items.slice(0, 1), {
      width: 400,
      height: 100,
      orient: 'horizontal',
      align: 'start',
      fontSize: 24,
      measure,
    })
    expect(small.items[0].height).toBe(17) // 12 + PADDING(5)
    expect(large.items[0].height).toBe(29) // 24 + PADDING(5)
  })
})
