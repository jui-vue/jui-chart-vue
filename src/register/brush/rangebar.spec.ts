import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('rangebar brush', () => {
  it('renders one <rect> per [min,max] range value inside a <g class="brush-rangebar">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B', 'C'] },
            data: [
              { name: 'A', value1: [10, 40] },
              { name: 'B', value1: [20, 60] },
              { name: 'C', value1: [5, 90] },
            ],
          },
        ],
        brush: [{ type: 'rangebar', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-rangebar')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(3)

    // Every rect's width should be positive (abs(zeroX - startX) for a real [min,max] span).
    for (const r of rects) {
      expect(Number(r.getAttribute('width'))).toBeGreaterThan(0)
    }
  })

  it('positions each range rect from value[0] (x = axis.x(value[0]), width = |axis.x(value[0]) - axis.x(value[1])|)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', value1: [20, 80] }],
          },
        ],
        brush: [{ type: 'rangebar', target: ['value1'] }],
      },
    })

    const rect = wrapper.element.querySelector('g.brush-rangebar rect')!
    // Legacy: `zeroX = axis.x(value[0])` is the rect's own `x` (NOT the numeric min/max - order
    // in the `[a, b]` pair matters, `x` always comes from index 0). For a 400px-wide chart with
    // default 50px padding and a 0-100 domain, `axis.x(20)` falls in the left quarter of the plot
    // area and `axis.x(80)` in the right quarter - so `x` should be well left of the plot's
    // horizontal midpoint (~200) and `x + width` well right of it.
    const x = Number(rect.getAttribute('x'))
    const width = Number(rect.getAttribute('width'))
    expect(x).toBeLessThan(200)
    expect(x + width).toBeGreaterThan(200)
  })
})
