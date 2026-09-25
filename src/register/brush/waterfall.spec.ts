import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('waterfall brush', () => {
  it('renders one <rect> per row (edge-colored first/last, rise/fall colored in between) plus connector <line>s, inside a <g class="brush-waterfall">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'name' },
            y: { type: 'range', step: 10, domain: 'value' },
            data: [
              { name: 'Start', value: 90 },
              { name: 'a', value: 105 },
              { name: 'b', value: 126 },
              { name: 'end', value: 168 },
            ],
          },
        ],
        brush: [{ type: 'waterfall', target: 'value', end: true }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-waterfall')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(4)

    // `line: true` (the default) connects every middle segment (rows 1 and 2 here, since 0/3 are
    // edges with `end: true`) to the next one.
    expect(group!.querySelectorAll('line').length).toBe(2)
  })

  it('setup() defaults line:true, end:false, outerPadding:5', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'block', domain: 'name' }, y: { type: 'range', domain: 'value' }, data: [{ name: 'A', value: 10 }] }],
        brush: [{ type: 'waterfall', target: 'value' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.line).toBe(true)
    expect(brush.end).toBe(false)
    expect(brush.outerPadding).toBe(5)
  })
})
