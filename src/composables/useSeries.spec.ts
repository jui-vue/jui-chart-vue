import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  candleBodyGeometry,
  computeStackPercent,
  curvePoints,
  equalizerBlocks,
  equalizerStackedBlocks,
  equalizerUnitSize,
  normalizeStackFractions,
  rangeAreaPolygonPoints,
  rangeAxisTickBand,
  rangeGroupGeometry,
  rateBarActiveOpacity,
  rateBarRowLayout,
  rateBarSegments,
  roundedRectPath,
  selectDisplayBars,
  selectDisplayIndices,
  useRangeSeries,
  useSeries,
  useStackedSeries,
} from './useSeries'
import type { DataRow, RangeSeriesPoint } from '../types'

describe('useSeries', () => {
  it('maps rows to per-target pixel coordinates (block x-axis, range y-axis)', () => {
    const data = ref<DataRow[]>([
      { q: '1Q', sales: 1, profit: 3 },
      { q: '2Q', sales: 3, profit: 2 },
    ])
    const target = ref(['sales', 'profit'])

    // block x: index 0 -> 50, index 1 -> 150 (mirrors an ordinal scale over 2 categories in [0,200]).
    const xScale = ref((i: number) => (i === 0 ? 50 : 150))
    // range y: value v -> 100 - 25v (domain [0,4] mapped to pixel range [100,0]).
    const yScale = ref((v: number) => 100 - 25 * v)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useSeries(data, target, xScale, yScale, xType, yType)

    // sales: [1, 3]
    expect(series.value[0].x).toEqual([50, 150])
    expect(series.value[0].y).toEqual([75, 25])
    expect(series.value[0].value).toEqual([1, 3])
    expect(series.value[0].min).toEqual([true, false])
    expect(series.value[0].max).toEqual([false, true])

    // profit: [3, 2]
    expect(series.value[1].x).toEqual([50, 150])
    expect(series.value[1].y).toEqual([25, 50])
    expect(series.value[1].min).toEqual([false, true])
    expect(series.value[1].max).toEqual([true, false])
  })

  it('evaluates the block axis once per row, shared across all targets in that row', () => {
    const data = ref<DataRow[]>([{ q: '1Q', a: 1, b: 2 }])
    const target = ref(['a', 'b'])
    const xScale = ref(() => 42)
    const yScale = ref((v: number) => v * 10)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useSeries(data, target, xScale, yScale, xType, yType)
    expect(series.value[0].x[0]).toBe(42)
    expect(series.value[1].x[0]).toBe(42)
  })

  it('recomputes when the underlying data ref changes', () => {
    const data = ref<DataRow[]>([{ v: 1 }])
    const target = ref(['v'])
    const xScale = ref(() => 0)
    const yScale = ref((v: number) => v)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useSeries(data, target, xScale, yScale, xType, yType)
    expect(series.value[0].value).toEqual([1])

    data.value = [{ v: 1 }, { v: 2 }]
    expect(series.value[0].value).toEqual([1, 2])
  })
})

describe('useStackedSeries', () => {
  it('accumulates cumulative base/top per row across targets (3 rows x 2 targets, block x / range y)', () => {
    // Hand-computed stack (target order = stacking order, first target at the base):
    //   row0: a=1        -> stacked a = 1;        b=2 -> stacked b = 2 + 1 = 3
    //   row1: a=3        -> stacked a = 3;        b=1 -> stacked b = 1 + 3 = 4
    //   row2: a=2        -> stacked a = 2;        b=4 -> stacked b = 4 + 2 = 6
    const data = ref<DataRow[]>([
      { a: 1, b: 2 },
      { a: 3, b: 1 },
      { a: 2, b: 4 },
    ])
    const target = ref(['a', 'b'])

    // block x: index i -> i * 100, shared per row across targets.
    const xScale = ref((i: number) => i * 100)
    // range y: stacked value v -> v * 10.
    const yScale = ref((v: number) => v * 10)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useStackedSeries(data, target, xScale, yScale, xType, yType)

    // a (base series): stacked values [1, 3, 2] -> y = [10, 30, 20]
    expect(series.value[0].y).toEqual([10, 30, 20])
    expect(series.value[0].x).toEqual([0, 100, 200])
    // value/min/max stay the target's own raw (unstacked) value, same as useSeries.
    expect(series.value[0].value).toEqual([1, 3, 2])
    expect(series.value[0].min).toEqual([true, false, false])
    expect(series.value[0].max).toEqual([false, true, false])

    // b (stacked on top of a): cumulative [3, 4, 6] -> y = [30, 40, 60]
    expect(series.value[1].y).toEqual([30, 40, 60])
    expect(series.value[1].x).toEqual([0, 100, 200])
    expect(series.value[1].value).toEqual([2, 1, 4])
    expect(series.value[1].min).toEqual([false, true, false])
    expect(series.value[1].max).toEqual([false, false, true])
  })

  it('stacks the x coordinate instead when x is the range axis (range x / block y)', () => {
    const data = ref<DataRow[]>([
      { a: 1, b: 2 },
      { a: 3, b: 1 },
    ])
    const target = ref(['a', 'b'])

    const xScale = ref((v: number) => v * 10)
    const yScale = ref((i: number) => i * 100)
    const xType = ref<'block' | 'range'>('range')
    const yType = ref<'block' | 'range'>('block')

    const series = useStackedSeries(data, target, xScale, yScale, xType, yType)

    // a: stacked [1, 3] -> x = [10, 30]; b: cumulative [3, 4] -> x = [30, 40]
    expect(series.value[0].x).toEqual([10, 30])
    expect(series.value[1].x).toEqual([30, 40])
    expect(series.value[0].y).toEqual([0, 100])
    expect(series.value[1].y).toEqual([0, 100])
  })

  it('recomputes when the underlying data ref changes', () => {
    const data = ref<DataRow[]>([{ a: 1, b: 1 }])
    const target = ref(['a', 'b'])
    const xScale = ref(() => 0)
    const yScale = ref((v: number) => v)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useStackedSeries(data, target, xScale, yScale, xType, yType)
    expect(series.value[1].y).toEqual([2])

    data.value = [{ a: 1, b: 1 }, { a: 2, b: 3 }]
    expect(series.value[1].y).toEqual([2, 5])
  })
})

describe('selectDisplayBars', () => {
  const rows: DataRow[] = [{ v: 1 }, { v: 3 }, { v: 3 }, { v: 0.49 }]

  it('flags every row tied for the max value when mode is "max"', () => {
    // ties: both v=3 rows qualify, matching the original's `value == series[key].max` check.
    expect(selectDisplayBars(rows, 'v', 'max')).toEqual([false, true, true, false])
  })

  it('flags the row with the min value when mode is "min"', () => {
    expect(selectDisplayBars(rows, 'v', 'min')).toEqual([false, false, false, true])
  })

  it('flags every row when mode is "all"', () => {
    expect(selectDisplayBars(rows, 'v', 'all')).toEqual([true, true, true, true])
  })

  it('flags no rows when mode is null/undefined', () => {
    expect(selectDisplayBars(rows, 'v', null)).toEqual([false, false, false, false])
    expect(selectDisplayBars(rows, 'v', undefined)).toEqual([false, false, false, false])
  })

  it('ignores non-numeric values when computing the min/max boundary', () => {
    const mixed: DataRow[] = [{ v: 5 }, { v: null }, { v: undefined }, { v: 2 }]
    expect(selectDisplayBars(mixed, 'v', 'max')).toEqual([true, false, false, false])
    expect(selectDisplayBars(mixed, 'v', 'min')).toEqual([false, false, false, true])
  })
})

describe('selectDisplayIndices', () => {
  // Same shape as `selectDisplayBars`'s cases, but as a plain numeric array - the shape
  // `BarChart`'s `stacked` mode feeds it (each row's stack *total*, not one target's own value).
  const sums = [4, 12, 12, 3]

  it('flags every index tied for the max value when mode is "max"', () => {
    expect(selectDisplayIndices(sums, 'max')).toEqual([false, true, true, false])
  })

  it('flags the index with the min value when mode is "min"', () => {
    expect(selectDisplayIndices(sums, 'min')).toEqual([false, false, false, true])
  })

  it('flags every index when mode is "all"', () => {
    expect(selectDisplayIndices(sums, 'all')).toEqual([true, true, true, true])
  })

  it('flags no indices when mode is null/undefined', () => {
    expect(selectDisplayIndices(sums, null)).toEqual([false, false, false, false])
    expect(selectDisplayIndices(sums, undefined)).toEqual([false, false, false, false])
  })

  it('ignores non-numeric values when computing the min/max boundary', () => {
    const mixed = [5, undefined, undefined, 2]
    expect(selectDisplayIndices(mixed, 'max')).toEqual([true, false, false, false])
    expect(selectDisplayIndices(mixed, 'min')).toEqual([false, false, false, true])
  })

  it('selectDisplayBars is a (rows, targetKey) specialization of this function', () => {
    const rows: DataRow[] = [{ v: 4 }, { v: 12 }, { v: 12 }, { v: 3 }]
    expect(selectDisplayBars(rows, 'v', 'max')).toEqual(selectDisplayIndices(sums, 'max'))
  })
})

describe('useRangeSeries', () => {
  it('maps each row/target [low,high] tuple to two coordinate pairs (block x-axis, range y-axis)', () => {
    const data = ref<DataRow[]>([
      { day: 'Mon', temp: [10, 20] },
      { day: 'Tue', temp: [12, 18] },
    ])
    const target = ref(['temp'])

    // block x: index 0 -> 50, index 1 -> 150.
    const xScale = ref((i: number) => (i === 0 ? 50 : 150))
    // range y: value v -> 100 - 2v.
    const yScale = ref((v: number) => 100 - 2 * v)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useRangeSeries(data, target, xScale, yScale, xType, yType)

    // Block (x) coordinate is shared by low/high within a row.
    expect(series.value[0].xLow).toEqual([50, 150])
    expect(series.value[0].xHigh).toEqual([50, 150])
    // Range (y) coordinate differs between low/high.
    expect(series.value[0].yLow).toEqual([80, 76])
    expect(series.value[0].yHigh).toEqual([60, 64])
    expect(series.value[0].low).toEqual([10, 12])
    expect(series.value[0].high).toEqual([20, 18])
  })

  it('evaluates a range x-axis (block y) twice per row - low and high on x, shared y', () => {
    const data = ref<DataRow[]>([{ week: 'W1', price: [100, 140] }])
    const target = ref(['price'])
    const xScale = ref((v: number) => v * 2)
    const yScale = ref((i: number) => (i === 0 ? 30 : 90))
    const xType = ref<'block' | 'range'>('range')
    const yType = ref<'block' | 'range'>('block')

    const series = useRangeSeries(data, target, xScale, yScale, xType, yType)
    expect(series.value[0].xLow).toEqual([200])
    expect(series.value[0].xHigh).toEqual([280])
    expect(series.value[0].yLow).toEqual([30])
    expect(series.value[0].yHigh).toEqual([30])
  })

  it('recomputes when the underlying data ref changes', () => {
    const data = ref<DataRow[]>([{ v: [1, 2] }])
    const target = ref(['v'])
    const xScale = ref(() => 0)
    const yScale = ref((v: number) => v)
    const xType = ref<'block' | 'range'>('block')
    const yType = ref<'block' | 'range'>('range')

    const series = useRangeSeries(data, target, xScale, yScale, xType, yType)
    expect(series.value[0].low).toEqual([1])

    data.value = [{ v: [1, 2] }, { v: [3, 4] }]
    expect(series.value[0].low).toEqual([1, 3])
  })
})

describe('rangeAreaPolygonPoints', () => {
  it('traces low values forward then high values backward, matching rangearea.js', () => {
    const point: RangeSeriesPoint = {
      xLow: [0, 100, 200],
      yLow: [80, 76, 82],
      xHigh: [0, 100, 200],
      yHigh: [60, 64, 58],
      low: [10, 12, 9],
      high: [20, 18, 21],
    }

    expect(rangeAreaPolygonPoints(point)).toBe('0,80 100,76 200,82 200,58 100,64 0,60')
  })

  it('skips rows with a non-numeric low/high (malformed data)', () => {
    const point: RangeSeriesPoint = {
      xLow: [0, 100],
      yLow: [80, NaN],
      xHigh: [0, 100],
      yHigh: [60, NaN],
      low: [10, undefined],
      high: [20, undefined],
    }

    expect(rangeAreaPolygonPoints(point)).toBe('0,80 0,60')
  })
})

describe('rangeGroupGeometry', () => {
  it('matches rangebar.js/rangecolumn.js\'s drawBefore() formula (outerPadding=2, innerPadding=1, 2 targets, band=100)', () => {
    // groupSize = 100 - 2*2 = 96; itemSize = (96 - 1*1) / 2 = 47.5
    const { groupSize, itemSize } = rangeGroupGeometry(100, 2, 2, 1)
    expect(groupSize).toBe(96)
    expect(itemSize).toBe(47.5)
  })

  it('floors item size at 0 instead of going negative (defensive, port-only)', () => {
    const { itemSize } = rangeGroupGeometry(10, 5, 4, 4)
    expect(itemSize).toBe(0)
  })
})

describe('candleBodyGeometry', () => {
  // Hand-built scale: a "range" y-axis mapping value v to pixel v*2 (unreversed, matching a
  // normal non-reversed range axis - candlestick.js's source never reverses the value axis).
  const yScale = (v: number) => v * 2

  it('bearish (open > close): anchors at axis.y(open), matches source\'s literal `if (open > close)` branch', () => {
    // open=30, close=20 -> open(60) > close(40): bullish=false, y=axis.y(open)=60, height=|40-60|=20
    const result = candleBodyGeometry(30, 20, yScale)
    expect(result).toEqual({ bullish: false, y: 60, height: 20 })
  })

  it('bullish (close > open): anchors at axis.y(close)', () => {
    // open=20, close=30 -> open(40) not > close(60): bullish=true, y=axis.y(close)=60, height=|40-60|=20
    const result = candleBodyGeometry(20, 30, yScale)
    expect(result).toEqual({ bullish: true, y: 60, height: 20 })
  })

  it('exact tie (open === close) takes the bullish branch, not invert - matches `!(open > close)`, height 0', () => {
    const result = candleBodyGeometry(25, 25, yScale)
    expect(result).toEqual({ bullish: true, y: 50, height: 0 })
  })
})

describe('curvePoints', () => {
  it('matches hand-solved control points for a straight run of 4 coordinates', () => {
    // Solved by hand via the Thomas algorithm the original implements: for K=[0,10,20,30],
    // p1 = [10/3, 40/3, 70/3], p2 = [20/3, 50/3, 80/3].
    const { p1, p2 } = curvePoints([0, 10, 20, 30])

    expect(p1[0]).toBeCloseTo(10 / 3, 6)
    expect(p1[1]).toBeCloseTo(40 / 3, 6)
    expect(p1[2]).toBeCloseTo(70 / 3, 6)

    expect(p2[0]).toBeCloseTo(20 / 3, 6)
    expect(p2[1]).toBeCloseTo(50 / 3, 6)
    expect(p2[2]).toBeCloseTo(80 / 3, 6)
  })
})

describe('normalizeStackFractions', () => {
  it('always spans the full [0,1] fraction range regardless of the row total', () => {
    // fullstackbar.html's own row 1: { name: 2, value: 15, test: 0 } -> sum 17.
    const { sum, start, end } = normalizeStackFractions([2, 15, 0])

    expect(sum).toBe(17)
    expect(start).toEqual([0, 2 / 17, 17 / 17])
    expect(end[0]).toBeCloseTo(2 / 17, 10)
    expect(end[1]).toBeCloseTo(17 / 17, 10)
    expect(end[2]).toBeCloseTo(17 / 17, 10)
    // Last segment always ends at exactly 1 (full 100%), no matter the raw sum.
    expect(end[end.length - 1]).toBeCloseTo(1, 10)
  })

  it('proportions match the raw data ratios for a very different row total', () => {
    // fullstackcolumn.html's row 2: { samsung: 20, lg: 30, sony: 5 } -> sum 55 - a totally
    // different magnitude from row 1 (sum 17 above), yet both must still resolve to [0,1] overall,
    // with each segment's own share of the fraction range exactly matching value/sum.
    const { sum, start, end } = normalizeStackFractions([20, 30, 5])

    expect(sum).toBe(55)
    const widths = start.map((s, i) => end[i] - s)
    expect(widths[0]).toBeCloseTo(20 / 55, 10)
    expect(widths[1]).toBeCloseTo(30 / 55, 10)
    expect(widths[2]).toBeCloseTo(5 / 55, 10)
    expect(end[end.length - 1]).toBeCloseTo(1, 10)
  })

  it('treats a zero row total as all-zero-length segments (no division-by-zero NaN)', () => {
    const { sum, start, end } = normalizeStackFractions([0, 0, 0])

    expect(sum).toBe(0)
    expect(start).toEqual([0, 0, 0])
    expect(end).toEqual([0, 0, 0])
  })

  it('defaults non-numeric/NaN values to 0, matching the rest of this port', () => {
    const { sum, end } = normalizeStackFractions([10, Number.NaN, 10])
    expect(sum).toBe(20)
    expect(end[end.length - 1]).toBeCloseTo(1, 10)
  })

  it('empty input returns an empty stack with sum 0', () => {
    expect(normalizeStackFractions([])).toEqual({ sum: 0, start: [], end: [] })
  })
})

describe('computeStackPercent', () => {
  it('reads as a true percentage when the axis domain max is 100 (both original demos configure it this way)', () => {
    expect(computeStackPercent(15, 17, 100)).toBe(88) // round(15/17*100)
    expect(computeStackPercent(2, 17, 100)).toBe(12) // round(2/17*100)
    expect(computeStackPercent(30, 55, 100)).toBe(55) // round(30/55*100)
  })

  it('scales with the axis max, not a fixed 100 - it is not always a true percentage', () => {
    expect(computeStackPercent(1, 4, 4)).toBe(1) // 1/4 of a max-4 axis -> "1", not "25"
    expect(computeStackPercent(1, 4, 100)).toBe(25) // same ratio, max-100 axis -> "25"
  })

  it('is NaN when the row sum is 0, matching the source’s unguarded division (caller must gate)', () => {
    expect(Number.isNaN(computeStackPercent(0, 0, 100))).toBe(true)
  })
})

describe('equalizerBlocks', () => {
  it('upward branch (value >= 0): fills zeroY..valueY with unit-height blocks, clipping the last one short instead of overshooting', () => {
    // zeroY=100, valueY=70 (distance 30), unit=5, gap=5 - hand-traced against equalizer.js's own loop.
    const blocks = equalizerBlocks(100, 70, 5, 5)
    expect(blocks.map((b) => b.y)).toEqual([95, 88.5, 82, 75.5, 70])
    expect(blocks.map((b) => b.height)).toEqual([5, 5, 5, 5, 4])
    // gap=5 and only 5 blocks (eIndex 0-4) -> every block floor(eIndex/5)=0, one color band.
    expect(blocks.map((b) => b.colorIndex)).toEqual([0, 0, 0, 0, 0])
  })

  it('color bands cycle every `gap` blocks, independent of block height/count', () => {
    const blocks = equalizerBlocks(100, 70, 5, 2)
    expect(blocks.map((b) => b.colorIndex)).toEqual([0, 0, 1, 1, 2])
  })

  it('downward branch (value < 0): fills zeroY..valueY growing in the positive direction', () => {
    // zeroY=50, valueY=80 (distance 30), unit=10, gap=5.
    const blocks = equalizerBlocks(50, 80, 10, 5)
    expect(blocks.map((b) => b.y)).toEqual([50, 61.5, 73])
    expect(blocks.map((b) => b.height)).toEqual([10, 10, 7])
    expect(blocks.map((b) => b.colorIndex)).toEqual([0, 0, 0])
  })

  it('a zero value (valueY === zeroY) renders no blocks in either branch', () => {
    expect(equalizerBlocks(100, 100, 5, 5)).toEqual([])
  })

  it('returns no blocks for a non-positive unit (defensive, port-only guard)', () => {
    expect(equalizerBlocks(100, 70, 0, 5)).toEqual([])
    expect(equalizerBlocks(100, 70, -1, 5)).toEqual([])
  })
})

describe('equalizerStackedBlocks', () => {
  it('the running pixel position carries across segments (not reset per segment) - a later segment\'s blocks start wherever the previous one\'s left off, not at its own true boundary', () => {
    // unitSize=10, gapSize=5 -> step=15. Segment 0 (length 47): floor(47/15)=3 blocks, using
    // 45 of its 47px - 2px "spare" that the next segment's blocks do NOT get realigned to.
    // Segment 1 (length 32) then starts its first block at offset 45 (not 47), and fits
    // floor(32/15)=2 blocks (30 of its own 32px).
    const result = equalizerStackedBlocks([47, 32], 10, 5)
    expect(result).toEqual([
      [
        { offset: 0, size: 10 },
        { offset: 15, size: 10 },
        { offset: 30, size: 10 },
      ],
      [
        { offset: 45, size: 10 },
        { offset: 60, size: 10 },
      ],
    ])
  })

  it('exact-multiple segment lengths stay perfectly aligned to their true boundary (no drift)', () => {
    // Both segments are exactly 2 steps (30 = 2*15) - offset 30 is segment 1's true start edge.
    const result = equalizerStackedBlocks([30, 30], 10, 5)
    expect(result).toEqual([
      [
        { offset: 0, size: 10 },
        { offset: 15, size: 10 },
      ],
      [
        { offset: 30, size: 10 },
        { offset: 45, size: 10 },
      ],
    ])
  })

  it('a segment shorter than one step renders no blocks for that segment, without disturbing later segments\' offsets', () => {
    const result = equalizerStackedBlocks([10, 30], 10, 5)
    expect(result[0]).toEqual([])
    expect(result[1]).toEqual([{ offset: 0, size: 10 }, { offset: 15, size: 10 }])
  })

  it('returns one empty array per segment when unitSize+gapSize is non-positive (defensive, port-only guard)', () => {
    expect(equalizerStackedBlocks([100, 50], 0, 0)).toEqual([[], []])
    expect(equalizerStackedBlocks([100, 50], -5, 2)).toEqual([[], []])
  })
})

describe('equalizerUnitSize', () => {
  it('matches equalizerbar.js/equalizercolumn.js\'s `unit = band / (brush.unit * padding)` formula', () => {
    expect(equalizerUnitSize(100, 1, 1)).toBe(100) // defaults: equalizerUnit=1, innerPadding=1 (inherited from bar.js)
    expect(equalizerUnitSize(100, 2, 5)).toBe(10)
  })

  it('returns 0 instead of dividing by 0 when equalizerUnit or innerPadding is 0 (defensive, port-only guard)', () => {
    expect(equalizerUnitSize(100, 0, 1)).toBe(0)
    expect(equalizerUnitSize(100, 1, 0)).toBe(0)
  })
})

describe('rangeAxisTickBand', () => {
  it('is the pixel distance between the first two ticks, matching util.scale.linear.js\'s rangeBand()', () => {
    expect(rangeAxisTickBand([20, 50, 80])).toBe(30)
  })

  it('uses abs() so a descending (reversed) tick order still yields a positive band', () => {
    expect(rangeAxisTickBand([80, 50, 20])).toBe(30)
  })

  it('is 0 with fewer than 2 ticks - no spacing can be derived', () => {
    expect(rangeAxisTickBand([5])).toBe(0)
    expect(rangeAxisTickBand([])).toBe(0)
  })
})

describe('roundedRectPath', () => {
  it('hand-traced: only the corners with a nonzero radius get an A (arc) command', () => {
    // x=0,y=0,w=10,h=6, left end rounded (tl=bl=2), right end square (tr=br=0) - RateBarChart.vue's
    // own leftRadius/rightRadius shape for a first-but-not-last segment.
    const d = roundedRectPath(0, 0, 10, 6, 2, 0, 0, 2)
    expect(d).toBe('M 2 0 L 10 0 L 10 6 L 2 6 A 2 2 0 0 1 0 4 L 0 2 A 2 2 0 0 1 2 0 Z')
  })

  it('hand-traced: all-zero radii is a plain rect with no arc commands at all', () => {
    const d = roundedRectPath(5, 3, 4, 2, 0, 0, 0, 0)
    expect(d).toBe('M 5 3 L 9 3 L 9 5 L 5 5 L 5 3 Z')
    expect(d).not.toContain('A')
  })
})

describe('rateBarSegments', () => {
  it('hand-traced: skips a zero-value target entirely (no zero-width placeholder), widths proportional to the row\'s own nonzero sum', () => {
    // row total (nonzero only) = 30 + 70 = 100; b (value 0) contributes no segment at all.
    const segments = rateBarSegments({ a: 30, b: 0, c: 70 }, ['a', 'b', 'c'], 100, 100)
    expect(segments).toEqual([
      { key: 'a', value: 30, percent: 30, x: 0, width: 30, isFirst: true, isLast: false },
      { key: 'c', value: 70, percent: 70, x: 30, width: 70, isFirst: false, isLast: true },
    ])
  })

  it('hand-traced: a single nonzero target fills the whole totalWidth and is both isFirst and isLast', () => {
    const segments = rateBarSegments({ a: 0, b: 50, c: 0 }, ['a', 'b', 'c'], 200, 100)
    expect(segments).toEqual([{ key: 'b', value: 50, percent: 100, x: 0, width: 200, isFirst: true, isLast: true }])
  })

  it('an all-zero row renders no segments (matches nonZeroKeys being empty - draw()\'s forEach never runs)', () => {
    expect(rateBarSegments({ a: 0, b: 0 }, ['a', 'b'], 100, 100)).toEqual([])
  })

  it('a negative value is excluded exactly like a zero one (source filter is `> 0`, not `!== 0`)', () => {
    const segments = rateBarSegments({ a: -5, b: 10 }, ['a', 'b'], 100, 100)
    expect(segments).toEqual([{ key: 'b', value: 10, percent: 100, x: 0, width: 100, isFirst: true, isLast: true }])
  })

  it('hand-traced: percent label is only a true 0-100 percentage when axisMax is 100 - same domain-max coupling as computeStackPercent/fullstackbar', () => {
    // sum=4 (1+3); a: 1/4 of totalWidth=100 -> width 25, percent = round(1/4*4) = 1 (NOT 25);
    // b: 3/4 -> width 75, percent = round(3/4*4) = 3 (NOT 75).
    const segments = rateBarSegments({ a: 1, b: 3 }, ['a', 'b'], 100, 4)
    expect(segments).toEqual([
      { key: 'a', value: 1, percent: 1, x: 0, width: 25, isFirst: true, isLast: false },
      { key: 'b', value: 3, percent: 3, x: 25, width: 75, isFirst: false, isLast: true },
    ])
  })
})

describe('rateBarRowLayout', () => {
  it('hand-traced: bar height is band minus tooltipSize minus half barPadding, vertically nudged down by half tooltipSize to leave room for the flag above', () => {
    // height = 40 - 14 - 0/2 = 26; y = 50 - 26/2 + 14/2 = 50 - 13 + 7 = 44.
    expect(rateBarRowLayout(50, 40, 14, 0)).toEqual({ y: 44, height: 26 })
  })

  it('hand-traced: barPadding further shrinks the bar height (its own half)', () => {
    // height = 40 - 14 - 8/2 = 22; y = 50 - 22/2 + 14/2 = 50 - 11 + 7 = 46.
    expect(rateBarRowLayout(50, 40, 14, 8)).toEqual({ y: 46, height: 22 })
  })

  it('with tooltipSize=0 and barPadding=0 the bar exactly fills the band, centered on centerY', () => {
    expect(rateBarRowLayout(50, 40, 0, 0)).toEqual({ y: 30, height: 40 })
  })
})

describe('rateBarActiveOpacity', () => {
  it('dims a sibling segment in the SAME row as activeIndex whose key differs from activeTarget', () => {
    expect(rateBarActiveOpacity(1, 'b', 1, 'a', 0.7)).toBe(0.7)
  })

  it('does NOT dim the exact matching (activeIndex, activeTarget) segment itself', () => {
    expect(rateBarActiveOpacity(1, 'a', 1, 'a', 0.7)).toBe(1)
  })

  it('does NOT dim a segment in a DIFFERENT row, even with the same key as activeTarget - confirms this is a row-scoped highlight, not a whole-chart one', () => {
    expect(rateBarActiveOpacity(2, 'a', 1, 'a', 0.7)).toBe(1)
    expect(rateBarActiveOpacity(2, 'b', 1, 'a', 0.7)).toBe(1)
  })

  it('dims nothing when activeIndex/activeTarget are null (defaults)', () => {
    expect(rateBarActiveOpacity(1, 'b', null, null, 0.7)).toBe(1)
  })

  it('dims nothing when only one of activeIndex/activeTarget is set (source requires both != null)', () => {
    expect(rateBarActiveOpacity(1, 'b', 1, null, 0.7)).toBe(1)
    expect(rateBarActiveOpacity(1, 'b', null, 'a', 0.7)).toBe(1)
  })
})
