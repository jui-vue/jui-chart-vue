import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('equalizerbar brush', () => {
  it('renders a "block-train" of several small fixed-width blocks per target, not one continuous rect', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', a: 60 }],
          },
        ],
        brush: [{ type: 'equalizerbar', target: ['a'], unit: 1, innerPadding: 4 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-equalizerbar')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    // A value of 60 (out of a 100-wide range) split into `unit`-sized blocks with gaps should
    // produce multiple discrete blocks, not a single bar.
    expect(rects.length).toBeGreaterThan(1)

    // Every block should have the same (unit) width.
    const widths = new Set(Array.from(rects).map((r) => r.getAttribute('width')))
    expect(widths.size).toBe(1)
  })
})
