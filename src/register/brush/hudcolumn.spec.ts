import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('hudcolumn brush', () => {
  it('renders left/right "flag" polygons per row plus a bottom domain grid (circles + text + hit-test outlines), inside a <g class="brush-hudcolumn">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'year', hide: true },
            y: { type: 'range', domain: [0, 10], hide: true },
            data: [
              { year: '2010', left: 1, right: 0 },
              { year: '2011', left: 3, right: 7 },
            ],
          },
        ],
        brush: [{ type: 'hudcolumn', target: ['left', 'right'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-hudcolumn')
    expect(group).not.toBeNull()

    // 2 rows * 2 (left/right) data polygons + 2 domain rows * 2 hit-test outline polygons = 8
    expect(group!.querySelectorAll('polygon').length).toBe(8)
    // 2 domain rows * 2 circles (outer point + inner hover dot)
    expect(group!.querySelectorAll('circle').length).toBe(4)
  })

  it('setup() defaults outerPadding/innerPadding to 5 and clip:false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'block', domain: 'year' }, y: { type: 'range', domain: [0, 10] }, data: [{ year: '2010', left: 1, right: 1 }] }],
        brush: [{ type: 'hudcolumn', target: ['left', 'right'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.outerPadding).toBe(5)
    expect(brush.innerPadding).toBe(5)
    expect(brush.clip).toBe(false)
  })
})
