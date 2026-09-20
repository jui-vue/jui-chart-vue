import { describe, expect, it } from 'vitest'
import { gridCellRect, gridCells, resolveGridRows } from './useGridLayout'

describe('resolveGridRows', () => {
  it('derives rows as ceil(count / columns) when rows is omitted', () => {
    expect(resolveGridRows(5, 3)).toBe(2)
    expect(resolveGridRows(6, 3)).toBe(2)
    expect(resolveGridRows(7, 3)).toBe(3)
  })

  it('uses an explicit positive rows over the derived value', () => {
    expect(resolveGridRows(6, 3, 5)).toBe(5)
  })

  it('ignores a zero/undefined rows and falls back to derivation', () => {
    expect(resolveGridRows(6, 3, 0)).toBe(2)
    expect(resolveGridRows(6, 3, undefined)).toBe(2)
  })

  it('floors at 1 row for a tiny/empty count', () => {
    expect(resolveGridRows(0, 3)).toBe(1)
  })
})

describe('gridCellRect', () => {
  // 2 rows x 3 columns, gap 15: columnUnit = (630 - 2*15)/3 = 200, rowUnit = (435 - 15)/2 = 210.
  const rows = 2
  const columns = 3
  const width = 630
  const height = 435
  const gap = 15

  it('places cell 0 (row 0, col 0) at the origin', () => {
    expect(gridCellRect(0, rows, columns, width, height, gap)).toEqual({ x: 0, y: 0, width: 200, height: 210 })
  })

  it('places cell 1 (row 0, col 1) one column + gap over', () => {
    expect(gridCellRect(1, rows, columns, width, height, gap)).toEqual({ x: 215, y: 0, width: 200, height: 210 })
  })

  it('places cell 2 (row 0, col 2) two columns + gaps over', () => {
    expect(gridCellRect(2, rows, columns, width, height, gap)).toEqual({ x: 430, y: 0, width: 200, height: 210 })
  })

  it('places cell 3 (row 1, col 0) one row + gap down', () => {
    expect(gridCellRect(3, rows, columns, width, height, gap)).toEqual({ x: 0, y: 225, width: 200, height: 210 })
  })

  it('places cell 5 (row 1, col 2), the last cell, fully within bounds', () => {
    const cell = gridCellRect(5, rows, columns, width, height, gap)
    expect(cell).toEqual({ x: 430, y: 225, width: 200, height: 210 })
    expect(cell.x + cell.width).toBeLessThanOrEqual(width)
    expect(cell.y + cell.height).toBeLessThanOrEqual(height)
  })

  it('produces zero gap between cells when gap is 0', () => {
    expect(gridCellRect(1, 1, 2, 400, 200, 0)).toEqual({ x: 200, y: 0, width: 200, height: 200 })
  })
})

describe('gridCells', () => {
  it('returns one rect per count, matching gridCellRect for each index', () => {
    const cells = gridCells(6, 3, 630, 435, 15)
    expect(cells).toHaveLength(6)
    cells.forEach((cell, i) => {
      expect(cell).toEqual(gridCellRect(i, 2, 3, 630, 435, 15))
    })
  })

  it('respects an explicit rows override', () => {
    const cells = gridCells(4, 2, 400, 600, 10, 4)
    expect(cells).toHaveLength(4)
    // 4 rows x 2 columns explicitly, even though 4 items would default to 2x2.
    expect(cells[2]).toEqual(gridCellRect(2, 4, 2, 400, 600, 10))
  })

  it('handles a count smaller than columns (single row, trailing cells unused)', () => {
    const cells = gridCells(2, 3, 630, 200, 15)
    expect(cells).toHaveLength(2)
    expect(cells[0].y).toBe(0)
    expect(cells[1].y).toBe(0)
  })
})
