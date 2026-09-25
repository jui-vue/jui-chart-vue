import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('equalizercolumn brush', () => {
  it('renders a "block-train" of several small fixed-height blocks per target', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 60 }],
          },
        ],
        brush: [{ type: 'equalizercolumn', target: ['a'], unit: 1, innerPadding: 4 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-equalizercolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(1)

    const heights = new Set(Array.from(rects).map((r) => r.getAttribute('height')))
    expect(heights.size).toBe(1)
  })
})
