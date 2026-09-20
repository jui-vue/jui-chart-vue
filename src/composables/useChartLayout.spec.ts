import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useChartLayout } from './useChartLayout'
import type { AxisConfig, ChartPadding, DataRow } from '../types'

const catData: DataRow[] = [
  { q: '1Q', v: 1 },
  { q: '2Q', v: 5 },
]

function layout(axisX: AxisConfig, axisY: AxisConfig, data: DataRow[] = catData) {
  return useChartLayout(
    ref(data),
    ref(axisX),
    ref(axisY),
    ref(400),
    ref(300),
    ref<Partial<ChartPadding> | undefined>(undefined),
  )
}

describe('useChartLayout', () => {
  it('computes the plot area from default padding', () => {
    const { area } = layout({ type: 'block', domain: 'q' }, { type: 'range', domain: 'v' })
    // defaults: top20 right24 bottom32 left48
    expect(area.value).toEqual({ x: 48, y: 20, x2: 376, y2: 268, width: 328, height: 248 })
  })

  it('a range y-axis increases upward (interval reversed relative to pixel top/bottom)', () => {
    const { axisY, area } = layout({ type: 'block', domain: 'q' }, { type: 'range', domain: 'v' })
    // scale(min) should land near the bottom of the plot area (large pixel y), scale near max at top.
    const values = axisY.value.values
    expect(values[0]).toBeGreaterThan(values[values.length - 1])
    expect(Math.max(...values)).toBeLessThanOrEqual(area.value.y2)
  })

  it('a block y-axis is NOT reversed - first category lands near the top, matching block.js (never orient-reversed)', () => {
    const { axisY, area } = layout({ type: 'range', domain: 'v' }, { type: 'block', domain: 'q' })
    expect(axisY.value.type).toBe('block')
    const values = axisY.value.values
    // first domain entry ('1Q') should be closest to area.y (top), not area.y2 (bottom).
    expect(values[0]).toBeLessThan(values[values.length - 1])
    expect(values[0]).toBeGreaterThanOrEqual(area.value.y)
  })

  it('an x-axis interval is never reversed, block or range', () => {
    const blockX = layout({ type: 'block', domain: 'q' }, { type: 'range', domain: 'v' })
    expect(blockX.axisX.value.values[0]).toBeLessThan(blockX.axisX.value.values[1])

    const rangeX = layout({ type: 'range', domain: 'v' }, { type: 'block', domain: 'q' })
    const v = rangeX.axisX.value.values
    expect(v[0]).toBeLessThanOrEqual(v[v.length - 1])
  })

  it('resolves default orient per axis (x=bottom, y=left) when unset', () => {
    const { axisX, axisY } = layout({ type: 'block', domain: 'q' }, { type: 'range', domain: 'v' })
    expect(axisX.value.orient).toBe('bottom')
    expect(axisY.value.orient).toBe('left')
  })

  it('honors an explicit orient, coerced to the valid pair for that axis', () => {
    const { axisX, axisY } = layout({ type: 'block', domain: 'q', orient: 'top' }, { type: 'range', domain: 'v', orient: 'right' })
    expect(axisX.value.orient).toBe('top')
    expect(axisY.value.orient).toBe('right')
  })
})
