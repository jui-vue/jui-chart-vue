import { describe, expect, it } from 'vitest'
import {
  barGaugeFillWidth,
  barGaugeRowInput,
  barGaugeRowY,
  fullGaugeCurrentAngle,
  fullGaugeEndAngleLimit,
  fullGaugePaddingAngle,
  fullGaugeRadii,
  fullGaugeRate,
  fullGaugeRowInput,
} from './useGauge'

describe('barGaugeFillWidth', () => {
  it('default min=0: plain (value/max)*width', () => {
    // width=200, max=100, min=0, v=40 -> (200/100)*40 = 80
    expect(barGaugeFillWidth(40, 0, 100, 200)).toBe(80)
  })

  it('ported quirk: nonzero min is only a divisor, never subtracted as a baseline offset', () => {
    // min=20, max=100, v=20 -> (width/(100-20))*20 = (200/80)*20 = 50, NOT 0
    expect(barGaugeFillWidth(20, 20, 100, 200)).toBe(50)
  })

  it('uncapped: a value beyond max renders a bar wider than the track, no clamp', () => {
    // width=200, max=100, min=0, v=150 -> (200/100)*150 = 300 > width
    expect(barGaugeFillWidth(150, 0, 100, 200)).toBe(300)
  })
})

describe('barGaugeRowY', () => {
  it('stacks rows by size+cut px per index, starting at startY', () => {
    expect(barGaugeRowY(0, 20, 5, 10)).toBe(10)
    expect(barGaugeRowY(1, 20, 5, 10)).toBe(35) // 10 + 1*25
    expect(barGaugeRowY(2, 20, 5, 10)).toBe(60) // 10 + 2*25
  })
})

describe('barGaugeRowInput', () => {
  it('applies bargauge.js field defaults: value=0, title="", max=100, min=0', () => {
    expect(barGaugeRowInput({})).toEqual({ value: 0, title: '', max: 100, min: 0 })
  })

  it('reads explicit fields when present', () => {
    expect(barGaugeRowInput({ value: 42, title: 'CPU', max: 200, min: 10 })).toEqual({ value: 42, title: 'CPU', max: 200, min: 10 })
  })

  it('ignores non-numeric/non-string values, falling back to defaults', () => {
    expect(barGaugeRowInput({ value: 'x', title: 5 })).toEqual({ value: 0, title: '', max: 100, min: 0 })
  })
})

describe('fullGaugeEndAngleLimit', () => {
  it('passes through angles under 360', () => {
    expect(fullGaugeEndAngleLimit(270)).toBe(270)
    expect(fullGaugeEndAngleLimit(0)).toBe(0)
  })

  it('clamps 360 (and beyond) to 359.99999 - a distinct constant from donutSlicePath\'s own 359.9999', () => {
    expect(fullGaugeEndAngleLimit(360)).toBe(359.99999)
    expect(fullGaugeEndAngleLimit(400)).toBe(359.99999)
  })
})

describe('fullGaugeRate', () => {
  it('a conventional normalized fraction - min DOES act as a baseline offset here', () => {
    expect(fullGaugeRate(140, 0, 200)).toBe(0.7)
    expect(fullGaugeRate(20, 20, 100)).toBe(0) // matches fullgauge.html-style usage, unlike barGaugeFillWidth's quirk
    expect(fullGaugeRate(60, 20, 100)).toBe(0.5)
  })

  it('not clamped: values outside [min, max] yield a rate < 0 or > 1', () => {
    expect(fullGaugeRate(-10, 0, 100)).toBe(-0.1)
    expect(fullGaugeRate(150, 0, 100)).toBe(1.5)
  })
})

describe('fullGaugeCurrentAngle', () => {
  it('rate * endAngle, under the endAngle ceiling', () => {
    expect(fullGaugeCurrentAngle(0.7, 359.99999)).toBeCloseTo(251.999993)
    expect(fullGaugeCurrentAngle(0.5, 180)).toBe(90)
  })

  it('upper-clamped to endAngle when rate > 1', () => {
    expect(fullGaugeCurrentAngle(1.5, 300)).toBe(300)
  })

  it('NOT lower-clamped: a negative rate yields a negative angle', () => {
    expect(fullGaugeCurrentAngle(-0.1, 300)).toBeCloseTo(-30)
  })
})

describe('fullGaugePaddingAngle', () => {
  it('"butt" symbol: uses the theme padding angle', () => {
    expect(fullGaugePaddingAngle('butt', 2)).toBe(2)
  })

  it('"round" (or any other) symbol: no padding gap', () => {
    expect(fullGaugePaddingAngle('round', 2)).toBe(0)
    expect(fullGaugePaddingAngle('square', 2)).toBe(0)
  })
})

describe('fullGaugeRadii', () => {
  it('outerRadius = w - size, innerRadius = w - 2*size (distinct from DonutBrush.getProperty\'s w/2-size/2 convention)', () => {
    expect(fullGaugeRadii(200, 60)).toEqual({ outerRadius: 140, innerRadius: 80 })
  })

  it('unguarded: an oversized size relative to w can drive innerRadius negative', () => {
    expect(fullGaugeRadii(50, 60)).toEqual({ outerRadius: -10, innerRadius: -70 })
  })
})

describe('fullGaugeRowInput', () => {
  it('applies fullgauge.js field defaults: value=0, title=undefined, max=100, min=0', () => {
    expect(fullGaugeRowInput({})).toEqual({ value: 0, title: undefined, max: 100, min: 0 })
  })

  it('reads explicit fields when present', () => {
    expect(fullGaugeRowInput({ value: 140, title: 'Overall Visits', max: 200, min: 0 })).toEqual({
      value: 140,
      title: 'Overall Visits',
      max: 200,
      min: 0,
    })
  })
})
