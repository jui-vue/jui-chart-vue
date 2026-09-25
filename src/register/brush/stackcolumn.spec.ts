import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackcolumn brush', () => {
  it('renders one stacked <rect> per target inside <g class="brush-stackcolumn">, stacking upward', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 30, b: 40 }],
          },
        ],
        brush: [{ type: 'stackcolumn', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackcolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    const firstY = Number(rects[0].getAttribute('y'))
    const firstHeight = Number(rects[0].getAttribute('height'))
    const secondY = Number(rects[1].getAttribute('y'))
    const secondHeight = Number(rects[1].getAttribute('height'))

    // second segment's top edge should meet the first segment's top edge (stacked upward from 0).
    expect(Math.abs(secondY + secondHeight - firstY)).toBeLessThan(1)
  })
})
