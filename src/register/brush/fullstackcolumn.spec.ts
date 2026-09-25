import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullstackcolumn brush', () => {
  it('always fills the full axis height regardless of the row sum (100%-normalized), stacked bottom-up', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 25, b: 75 }],
          },
        ],
        brush: [{ type: 'fullstackcolumn', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackcolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    const totalHeight = Array.from(rects).reduce((sum, r) => sum + Number(r.getAttribute('height')), 0)
    const axisHeight = 300 - 50 - 50 // default 50px chart padding both sides, no axis-level padding
    expect(Math.abs(totalHeight - axisHeight)).toBeLessThan(1)
  })
})
