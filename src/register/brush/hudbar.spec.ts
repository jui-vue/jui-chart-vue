import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('hudbar brush', () => {
  it('renders top/bottom rects + text labels per row, plus a side funnel-grid polygon per domain row, inside a <g class="brush-hudbar">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 10], hide: true },
            y: { type: 'block', domain: 'quarter', hide: true },
            data: [
              { quarter: '1Q', top: 1, bottom: 0 },
              { quarter: '2Q', top: 3, bottom: 7 },
            ],
          },
        ],
        brush: [{ type: 'hudbar', target: ['top', 'bottom'], format: (v: unknown, k: string) => `${k}:${v}` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-hudbar')
    expect(group).not.toBeNull()

    // 2 rows * 2 (top/bottom) rects, plus 2 domain-grid polygons
    expect(group!.querySelectorAll('rect').length).toBe(4)
    expect(group!.querySelectorAll('polygon').length).toBe(2)
    expect(group!.querySelectorAll('text').length).toBeGreaterThan(0)
  })

  it('setup() defaults outerPadding/innerPadding to 7 and clip:false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'block', domain: 'q' }, data: [{ q: '1Q', top: 1, bottom: 1 }] }],
        brush: [{ type: 'hudbar', target: ['top', 'bottom'], format: () => 'x' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.outerPadding).toBe(7)
    expect(brush.innerPadding).toBe(7)
    expect(brush.clip).toBe(false)
  })
})
