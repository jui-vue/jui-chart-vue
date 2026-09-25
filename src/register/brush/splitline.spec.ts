import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('splitline brush', () => {
  it('with no split configured, draws exactly one <path> per target inside a <g class="brush-splitline">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value: 30 },
              { name: 'B', value: 60 },
              { name: 'C', value: 10 },
            ],
          },
        ],
        brush: [{ type: 'splitline', target: ['value'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-splitline')
    expect(group).not.toBeNull()

    // `createLine()` only appends a SECOND <path> once the split boundary is actually crossed - no
    // split configured means it never is, so this group's own <g> wrapper (one per target) holds
    // exactly one <path>.
    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(1)
  })

  it('an integer split index draws a SECOND <path>, re-styled with lineSplitBorderColor, from that row onward', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C', 'D'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value: 10 },
              { name: 'B', value: 20 },
              { name: 'C', value: 30 },
              { name: 'D', value: 40 },
            ],
          },
        ],
        brush: [{ type: 'splitline', target: ['value'], split: 1 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-splitline')!
    const paths = group.querySelectorAll('path')
    expect(paths.length).toBe(2)
  })

  it('setup() defaults symbol:"normal" and split:null', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value: 10 }] }],
        brush: [{ type: 'splitline', target: ['value'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.symbol).toBe('normal')
    expect(brush.split).toBeNull()
  })
})
