import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('rangecolumn brush', () => {
  it('renders one <rect> per [min,max] range value with a literal stroke="undefined" (legacy theme-key gap)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: [10, 40] },
              { name: 'B', value1: [20, 60] },
            ],
          },
        ],
        brush: [{ type: 'rangecolumn', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-rangecolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    for (const r of rects) {
      expect(Number(r.getAttribute('height'))).toBeGreaterThan(0)
      // `rangecolumn.js` looks up theme keys ("columnBorderColor" etc.) that don't exist anywhere
      // in the classic theme, even in the legacy engine - `chart.theme(...)` returns `undefined`,
      // which `setAttribute` stringifies to the literal text "undefined". Preserved, not "fixed".
      expect(r.getAttribute('stroke')).toBe('undefined')
    }
  })
})
