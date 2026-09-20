import { describe, expect, it } from 'vitest'
import { createOrdinalScale } from './useScale'
import { heatmapCells } from './useHeatmap'

describe('heatmapCells', () => {
  // 3 x-categories (Mon/Tue/Wed) over pixel interval [0, 300] -> band = 100, centers at 50/150/250.
  const xScale = createOrdinalScale(['Mon', 'Tue', 'Wed'], [0, 300])
  // 2 y-categories (AM/PM) over pixel interval [0, 200] -> band = 100, centers at 50/150.
  const yScale = createOrdinalScale(['AM', 'PM'], [0, 200])

  it('hand-traces cell position/size for a simple 3x2 grid, one cell per row (no target concept)', () => {
    const data = [
      { day: 'Mon', period: 'AM', value: 1 },
      { day: 'Tue', period: 'PM', value: 2 },
    ]
    const cells = heatmapCells(data, 'day', 'period', 'text', xScale, yScale, xScale.rangeBand(), yScale.rangeBand(), 1)

    expect(cells).toHaveLength(2)
    // w = 100 - 1 = 99, h = 100 - 1 = 99
    expect(cells[0]).toMatchObject({ index: 0, centerX: 50, centerY: 50, x: 50 - 99 / 2, y: 50 - 99 / 2, width: 99, height: 99 })
    expect(cells[1]).toMatchObject({ index: 1, centerX: 150, centerY: 150, x: 150 - 99 / 2, y: 150 - 99 / 2, width: 99, height: 99 })
  })

  it('uses format(row) as the label when given, overriding the textField', () => {
    const data = [{ day: 'Mon', period: 'AM', value: 42, text: 'ignored' }]
    const cells = heatmapCells(data, 'day', 'period', 'text', xScale, yScale, 100, 100, 0, (row) => `v=${row.value}`)
    expect(cells[0].label).toBe('v=42')
  })

  it('falls back to the textField (empty string if absent), matching getValue(data,"text")\'s own default', () => {
    const withText = heatmapCells([{ day: 'Mon', period: 'AM', text: 'hello' }], 'day', 'period', 'text', xScale, yScale, 100, 100, 0)
    expect(withText[0].label).toBe('hello')

    const withoutText = heatmapCells([{ day: 'Mon', period: 'AM' }], 'day', 'period', 'text', xScale, yScale, 100, 100, 0)
    expect(withoutText[0].label).toBe('')
  })

  it('skips a row whose x or y field value is not in either domain (scale returns null)', () => {
    const data = [
      { day: 'Mon', period: 'AM' },
      { day: 'NotADay', period: 'AM' },
      { day: 'Mon', period: 'NotAPeriod' },
    ]
    const cells = heatmapCells(data, 'day', 'period', 'text', xScale, yScale, 100, 100, 0)
    expect(cells).toHaveLength(1)
    expect(cells[0].index).toBe(0)
  })
})
