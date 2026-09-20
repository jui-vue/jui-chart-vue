import { describe, expect, it } from 'vitest'
import { computeChartArea, computeTitlePosition, computeTitleRotation } from './useChartTitle'

// Fixture hand-traced against `jui-chart/src/widget/title.js`'s `TitleWidget.drawBefore()` `else`
// branch (chart.js:37-54) + `juijs-graph/src/base/builder.js`'s `calculate()` (chart.area()'s real
// definition): width=400, height=300, padding={top:20,right:24,bottom:32,left:48}.
//   area.x = padding.left = 48
//   area.y = padding.top = 20
//   area.width = 400 - 48 - 24 = 328
//   area.height = 300 - 20 - 32 = 248
//   area.x2 = area.x + area.width = 376
//   area.y2 = area.y + area.height = 268
const WIDTH = 400
const HEIGHT = 300
const PADDING = { top: 20, right: 24, bottom: 32, left: 48 }

describe('computeChartArea', () => {
  it('reproduces chart.area() from width/height/padding (juijs-graph builder.js calculate())', () => {
    expect(computeChartArea(WIDTH, HEIGHT, PADDING)).toEqual({
      x: 48,
      y: 20,
      x2: 376,
      y2: 268,
      width: 328,
      height: 248,
    })
  })

  it('defaults padding to all-zero, matching every current <ChartTitle> caller (no chart-level padding passed)', () => {
    expect(computeChartArea(WIDTH, HEIGHT)).toEqual({ x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 })
  })

  it('floors width/height at 0 (hidden-element case, matching source\'s own `if (_chart.width < 0) _chart.width = 0`)', () => {
    expect(computeChartArea(10, 10, { left: 20, right: 20, top: 0, bottom: 0 })).toEqual({
      x: 20,
      y: 0,
      x2: 20,
      y2: 10,
      width: 0,
      height: 10,
    })
  })
})

describe('computeTitlePosition', () => {
  // --- orient (y) x align (x/anchor) matrix, hand-traced from source's `else` branch ---
  it('orient="top", align="middle": y is the flat PADDING(20) constant, x is area center', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'top', 'middle')).toEqual({ x: 212, y: 20, anchor: 'middle' })
  })

  it('orient="top", align="start": y stays flat PADDING(20), x = area.x (no extra inset)', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'top', 'start')).toEqual({ x: 48, y: 20, anchor: 'start' })
  })

  it('orient="top", align="end": x = area.x2', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'top', 'end')).toEqual({ x: 376, y: 20, anchor: 'end' })
  })

  it('orient="bottom", align="middle": y = area.y2 + padding.bottom - PADDING (padding.bottom algebraically cancels: reduces to height - PADDING)', () => {
    // area.y2(268) + padding.bottom(32) - PADDING(20) = 280 = HEIGHT(300) - PADDING(20)
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'bottom', 'middle')).toEqual({ x: 212, y: 280, anchor: 'middle' })
  })

  it('orient="bottom", align="start"', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'bottom', 'start')).toEqual({ x: 48, y: 280, anchor: 'start' })
  })

  it('orient="center", align="middle": y = area.y + area.height/2 (vertical center of plot area)', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'center', 'middle')).toEqual({ x: 212, y: 144, anchor: 'middle' })
  })

  it('orient="center", align="start"', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'center', 'start')).toEqual({ x: 48, y: 144, anchor: 'start' })
  })

  it('orient="center", align="end"', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'center', 'end')).toEqual({ x: 376, y: 144, anchor: 'end' })
  })

  it('any unrecognized orient value falls through to the vertical-center branch (implicit else, not an exhaustive enum)', () => {
    // @ts-expect-error - deliberately passing an invalid orient to prove the else-fallthrough
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'nonsense', 'middle')).toEqual({ x: 212, y: 144, anchor: 'middle' })
  })

  it('any unrecognized align value falls through to the end-aligned branch (implicit else, not an exhaustive enum)', () => {
    // @ts-expect-error - deliberately passing an invalid align to prove the else-fallthrough
    expect(computeTitlePosition(WIDTH, HEIGHT, PADDING, 'top', 'nonsense')).toEqual({ x: 376, y: 20, anchor: 'end' })
  })

  it('with no padding (matching every real <ChartTitle> caller today), orient="top"/align="middle" reduces to (width/2, 20)', () => {
    expect(computeTitlePosition(WIDTH, HEIGHT, undefined, 'top', 'middle')).toEqual({ x: 200, y: 20, anchor: 'middle' })
  })
})

describe('computeTitleRotation', () => {
  const halfW = 30
  const halfH = 7

  it('returns null for orient="top" regardless of align', () => {
    expect(computeTitleRotation('top', 'start', 100, 50, halfW, halfH)).toBeNull()
    expect(computeTitleRotation('top', 'end', 100, 50, halfW, halfH)).toBeNull()
  })

  it('returns null for orient="bottom" regardless of align', () => {
    expect(computeTitleRotation('bottom', 'start', 100, 50, halfW, halfH)).toBeNull()
  })

  it('returns null for orient="center", align="middle" - NOT a general "vertical mode" flag', () => {
    expect(computeTitleRotation('center', 'middle', 100, 50, halfW, halfH)).toBeNull()
  })

  it('orient="center", align="start": rotate -90 around (textX + halfW, textY + halfH)', () => {
    expect(computeTitleRotation('center', 'start', 100, 50, halfW, halfH)).toEqual({ angle: -90, cx: 130, cy: 57 })
  })

  it('orient="center", align="end": rotate 90 around (textX - halfW, textY + halfH)', () => {
    expect(computeTitleRotation('center', 'end', 100, 50, halfW, halfH)).toEqual({ angle: 90, cx: 70, cy: 57 })
  })
})
