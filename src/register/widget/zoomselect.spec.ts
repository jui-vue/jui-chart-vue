import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('zoomselect widget', () => {
  it('renders one drag-thumb <rect> (initially unset width, hidden focus overlay) per configured axis', () => {
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
        widget: [{ type: 'zoomselect', axis: 0 }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoomselect')
    expect(g).not.toBeNull()

    const rects = g!.querySelectorAll('rect')
    // 1 thumb rect + 1 focus-overlay rect (hidden group's own background) = at least 2.
    expect(rects.length).toBeGreaterThanOrEqual(2)

    // The close-button group is hidden until a drag completes.
    const hidden = g!.querySelector('[visibility="hidden"]')
    expect(hidden).not.toBeNull()
  })

  it('renders one section per configured axis when widget.axis is an array', () => {
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
        widget: [{ type: 'zoomselect', axis: [0, 0] }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoomselect')!
    // Each section contributes exactly 1 thumb <rect> as its group's first child - 2 configured
    // axis entries -> 2 top-level section <g> children.
    expect(g.children.length).toBe(2)
  })
})
