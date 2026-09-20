import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { computeRangeDomain, resolveAxisOrient, useAxis, type AxisRole } from './useAxis'
import type { BlockAxisConfig, DataRow, RangeAxisConfig } from '../types'

describe('computeRangeDomain', () => {
  // Hand-traced from jui-chart's own examples/bar.html:
  //   axis.y = { domain: (d) => [d.sales, d.profit], step: 3 }
  //   data = [{sales:1,profit:3}, {sales:3,profit:2}, {sales:10,profit:1}, {sales:0.49,profit:4}]
  // value_list folds each row's [sales,profit] pair to its max/min: [3,1, 3,2, 10,1, 4,0.49]
  // -> tempMin=0.49, tempMax=10. unit = ceil(10/3) = 4 (unit>1 branch).
  // Stepping up from 0 by 4 until >=10 gives start=12; stepping down from 12 by 4 until <=0.49
  // gives end=0. So domain=[0,12], step=|0-12|/4=3.
  it('matches bar.html: a function domain returning [sales, profit] with step 3', () => {
    const data: DataRow[] = [
      { quarter: '1Q', sales: 1, profit: 3 },
      { quarter: '2Q', sales: 3, profit: 2 },
      { quarter: '3Q', sales: 10, profit: 1 },
      { quarter: '4Q', sales: 0.49, profit: 4 },
    ]
    const config: RangeAxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }

    expect(computeRangeDomain(data, config)).toEqual({ domain: [0, 12], step: 3 })
  })

  it('folds a single string field, defaulting the domain floor to 0 (unit>1 branch, negative values)', () => {
    const data: DataRow[] = [{ a: 5 }, { a: -3 }, { a: 8 }]
    const config: RangeAxisConfig = { type: 'range', domain: 'a', step: 2 }

    // value_list = [5,0, -3,0, 8,0] -> tempMin=-3, tempMax=8.
    // min stays -3 (not >0, so no floor). unit = ceil((8-(-3))/2) = ceil(5.5) = 6.
    // start: 0 -> 6 -> 12 (>=8). end: 12 -> 6 -> 0 -> -6 (<=-3). domain=[-6,12], step=|-6-12|/6=3.
    expect(computeRangeDomain(data, config)).toEqual({ domain: [-6, 12], step: 3 })
  })

  it('rounds a fractional unit up to one decimal place (0<unit<1 branch)', () => {
    const data: DataRow[] = [{ a: 0 }, { a: 0.2 }]
    const config: RangeAxisConfig = { type: 'range', domain: 'a', step: 5 }

    // value_list=[0,0, 0.2,0] -> tempMin=0, tempMax=0.2. unit = 0.2/5 = 0.04 -> rounds up to 0.1.
    // start: 0 -> 0.1 -> 0.2 (>=0.2). end: 0.2 -> 0.1 -> 0 (<=0). domain=[0,0.2], step=2.
    expect(computeRangeDomain(data, config)).toEqual({ domain: [0, 0.2], step: 2 })
  })

  it('an explicit min/max only ever widens the computed domain, never narrows it', () => {
    const data: DataRow[] = [{ a: 5 }, { a: -3 }, { a: 8 }]
    // config.min is less extreme than the data minimum -> ignored, data wins.
    const ignored = computeRangeDomain(data, { type: 'range', domain: 'a', step: 2, min: 0 })
    expect(ignored.domain[0]).toBe(-6)

    // config.min is more extreme than the data minimum -> widens the domain outward.
    const widened = computeRangeDomain(data, { type: 'range', domain: 'a', step: 2, min: -10 })
    expect(widened.domain[0]).toBeLessThanOrEqual(-10)
  })

  it('reverses the domain when reverse is set', () => {
    const data: DataRow[] = [{ a: 5 }, { a: -3 }, { a: 8 }]
    const normal = computeRangeDomain(data, { type: 'range', domain: 'a', step: 2 })
    const reversed = computeRangeDomain(data, { type: 'range', domain: 'a', step: 2, reverse: true })
    expect(reversed.domain).toEqual([normal.domain[1], normal.domain[0]])
  })

  it('folds min/max across multiple named fields (domain as a field-name array)', () => {
    const data: DataRow[] = [
      { sales: 1, profit: 3 },
      { sales: 3, profit: 2 },
      { sales: 10, profit: 1 },
      { sales: 0.49, profit: 4 },
    ]
    const config: RangeAxisConfig = { type: 'range', domain: ['sales', 'profit'], step: 3 }
    expect(computeRangeDomain(data, config)).toEqual({ domain: [0, 12], step: 3 })
  })
})

describe('resolveAxisOrient', () => {
  it('defaults and coerces an x-axis to top/bottom only', () => {
    expect(resolveAxisOrient(undefined, 'x')).toBe('bottom')
    expect(resolveAxisOrient('top', 'x')).toBe('top')
    expect(resolveAxisOrient('bottom', 'x')).toBe('bottom')
    // an invalid value for this axis (e.g. accidentally passing a y-only orient) falls back
    expect(resolveAxisOrient('left', 'x')).toBe('bottom')
  })

  it('defaults and coerces a y-axis to left/right only', () => {
    expect(resolveAxisOrient(undefined, 'y')).toBe('left')
    expect(resolveAxisOrient('right', 'y')).toBe('right')
    expect(resolveAxisOrient('left', 'y')).toBe('left')
    expect(resolveAxisOrient('top', 'y')).toBe('left')
  })
})

describe('useAxis', () => {
  const xKind = ref<AxisRole>('x')
  const yKind = ref<AxisRole>('y')

  it('builds an ordinal scale + tick list for a block axis', () => {
    const data = ref<DataRow[]>([{ quarter: '1Q' }, { quarter: '2Q' }, { quarter: '3Q' }, { quarter: '4Q' }])
    const config = ref<BlockAxisConfig>({ type: 'block', domain: 'quarter' })
    const interval = ref<[number, number]>([0, 400])

    const axis = useAxis(data, config, interval, xKind)

    expect(axis.value.type).toBe('block')
    expect(axis.value.ticks).toEqual(['1Q', '2Q', '3Q', '4Q'])
    expect(axis.value.values).toEqual([50, 150, 250, 350])
    expect(axis.value.band).toBe(100)
    expect(axis.value.orient).toBe('bottom')
    expect(axis.value.line).toBe(false)
  })

  it('builds a linear scale + tick list for a range axis, matching bar.html', () => {
    const data = ref<DataRow[]>([
      { sales: 1, profit: 3 },
      { sales: 3, profit: 2 },
      { sales: 10, profit: 1 },
      { sales: 0.49, profit: 4 },
    ])
    const config = ref<RangeAxisConfig>({ type: 'range', domain: (d) => [d.sales, d.profit], step: 3 })
    const interval = ref<[number, number]>([300, 0]) // e.g. a "right" oriented y-axis

    const axis = useAxis(data, config, interval, yKind)

    expect(axis.value.type).toBe('range')
    expect(axis.value.ticks).toEqual([0, 4, 8, 12])
    // interval is reversed (bottom of pixel range = top of value range), so tick 0 sits at pixel 300.
    expect(axis.value.values[0]).toBe(300)
    expect(axis.value.values[axis.value.values.length - 1]).toBe(0)
    expect(axis.value.orient).toBe('left')
    expect(axis.value.line).toBe(false)
  })

  it('resolves orient from config, defaulted per axis kind', () => {
    const data = ref<DataRow[]>([{ a: 0 }])
    const config = ref<RangeAxisConfig>({ type: 'range', domain: 'a', orient: 'right' })
    const interval = ref<[number, number]>([0, 100])

    expect(useAxis(data, config, interval, yKind).value.orient).toBe('right')
    // same config's orient is meaningless for an x-axis - coerces to the x default instead.
    expect(useAxis(data, config, interval, xKind).value.orient).toBe('bottom')
  })

  it('resolves line, defaulted false, independent of axis type', () => {
    const data = ref<DataRow[]>([{ a: 0, quarter: '1Q' }])
    const interval = ref<[number, number]>([0, 100])

    const rangeNoLine = ref<RangeAxisConfig>({ type: 'range', domain: 'a' })
    expect(useAxis(data, rangeNoLine, interval, xKind).value.line).toBe(false)

    const rangeLine = ref<RangeAxisConfig>({ type: 'range', domain: 'a', line: true })
    expect(useAxis(data, rangeLine, interval, xKind).value.line).toBe(true)

    const blockNoLine = ref<BlockAxisConfig>({ type: 'block', domain: 'quarter' })
    expect(useAxis(data, blockNoLine, interval, xKind).value.line).toBe(false)

    // block (categorical) axes support `line` too, unlike this port's chart-wide `showGrid`.
    const blockLine = ref<BlockAxisConfig>({ type: 'block', domain: 'quarter', line: true })
    expect(useAxis(data, blockLine, interval, xKind).value.line).toBe(true)
  })

  it('recomputes reactively when the underlying data changes', () => {
    const data = ref<DataRow[]>([{ a: 0 }, { a: 5 }])
    const config = ref<RangeAxisConfig>({ type: 'range', domain: 'a', step: 5 })
    const interval = ref<[number, number]>([0, 100])

    const axis = useAxis(data, config, interval, xKind)
    const firstTicks = axis.value.ticks

    data.value = [{ a: 0 }, { a: 50 }]
    expect(axis.value.ticks).not.toEqual(firstTicks)
  })
})
