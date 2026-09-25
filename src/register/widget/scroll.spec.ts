import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('scroll widget', () => {
  it('renders a background rect + a proportionally-sized thumb rect when buffer < data length', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            buffer: 2,
            x: { type: 'block', domain: ['a', 'b', 'c', 'd', 'e'], line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
          },
        ],
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'scroll' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-scroll')
    expect(g).not.toBeNull()

    const rects = g!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    // Thumb width is proportional to buffer/dataLength (2/5 of the area width, +2), strictly
    // narrower than the full-width background rect.
    const bgWidth = Number(rects[0].getAttribute('width'))
    const thumbWidth = Number(rects[1].getAttribute('width'))
    expect(thumbWidth).toBeLessThan(bgWidth)
    expect(thumbWidth).toBeCloseTo(bgWidth * (2 / 5) + 2, 5)
  })

  it('renders an empty group when the axis has no data at all', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        widget: [{ type: 'scroll' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-scroll')
    expect(g).not.toBeNull()
    expect(g!.querySelectorAll('rect').length).toBe(0)
  })
})
