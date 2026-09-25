import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('vscroll widget', () => {
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
        widget: [{ type: 'vscroll' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-vscroll')
    expect(g).not.toBeNull()

    const rects = g!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    const bgHeight = Number(rects[0].getAttribute('height'))
    const thumbHeight = Number(rects[1].getAttribute('height'))
    expect(thumbHeight).toBeLessThan(bgHeight)
    expect(thumbHeight).toBeCloseTo(bgHeight * (2 / 5) + 2, 5)
  })

  it('renders an empty group when the axis has no data at all', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        widget: [{ type: 'vscroll' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-vscroll')
    expect(g).not.toBeNull()
    expect(g!.querySelectorAll('rect').length).toBe(0)
  })
})
