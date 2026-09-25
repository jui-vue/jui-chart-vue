import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('zoom widget', () => {
  it('renders one drag section (thumb rect + hidden close-button overlay) per configured axis', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['a', 'b', 'c'], line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }],
          },
        ],
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'zoom', axis: 0 }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoom')
    expect(g).not.toBeNull()
    expect(g!.children.length).toBe(1)

    const thumb = g!.querySelector('rect')
    expect(thumb).not.toBeNull()

    const hidden = g!.querySelector('[visibility="hidden"]')
    expect(hidden).not.toBeNull()
  })

  it('renders one section per axis when widget.axis is an array', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['a', 'b', 'c'], line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }],
          },
        ],
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'zoom', axis: [0, 0] }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoom')!
    expect(g.children.length).toBe(2)
  })
})
