import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('raycast widget', () => {
  it('renders an empty <g class="widget-raycast"> - it wires events, not visuals', () => {
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
        widget: [{ type: 'raycast', brush: [0] }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-raycast')
    expect(g).not.toBeNull()
    expect(g!.children.length).toBe(0)
  })

  it('mounts without throwing when neither axis is a block/range pair (wiring silently skipped)', () => {
    expect(() =>
      mount(Chart, {
        props: {
          width: 400,
          height: 300,
          axis: [{ data: [{ v: 1 }] }],
          brush: [{ type: 'pyramid', target: ['v'] }],
          widget: [{ type: 'raycast', brush: [0] }],
        },
      }),
    ).not.toThrow()
  })
})
