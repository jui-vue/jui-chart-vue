import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('line brush', () => {
  it('renders a connected <path> stroke through every data point inside a <g class="brush-line">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C', 'D'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
              { name: 'C', value1: 20 },
              { name: 'D', value1: 80 },
            ],
          },
        ],
        brush: [{ type: 'line', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-line')
    expect(group).not.toBeNull()

    const path = group!.querySelector('path')
    expect(path).not.toBeNull()
    // 4 points -> 3 line segments -> 3 absolute "L" commands (plus the initial "M" moveTo -
    // legacy `createLine()` uses the capitalized `MoveTo`/`LineTo` absolute-command variants).
    const d = path!.getAttribute('d')!
    expect(d.startsWith('M')).toBe(true)
    expect((d.match(/L/g) ?? []).length).toBe(3)
  })

  it('draws two separate target lines with two different stroke colors', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10, value2: 90 },
              { name: 'B', value1: 40, value2: 60 },
            ],
          },
        ],
        brush: [{ type: 'line', target: ['value1', 'value2'] }],
      },
    })

    const paths = wrapper.element.querySelectorAll('g.brush-line path')
    expect(paths.length).toBe(2)
    expect(paths[0].getAttribute('stroke')).not.toBe(paths[1].getAttribute('stroke'))
  })
})
