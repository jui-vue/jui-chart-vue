import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('cylinder3d brush', () => {
  it('renders one cylinder3d <g> (2 ellipses + 1 gradient-filled path) per (row, target) cell inside a <g class="brush-cylinder3d">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['Q1', 'Q2'] },
            y: { type: 'range', domain: 'total' },
            c: { type: 'grid3d' },
            data: [
              { sales: 12, profit: 10, total: 20 },
              { sales: 15, profit: 6, total: 20 },
            ],
            depth: 20,
            degree: 30,
          },
        ],
        brush: [{ type: 'cylinder3d', target: ['sales', 'profit'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-cylinder3d')
    expect(group).not.toBeNull()
    // 2 rows * 2 targets * 2 ellipses = 8
    expect(group!.querySelectorAll('ellipse').length).toBe(8)
    expect(group!.querySelectorAll('path').length).toBe(4)
  })

  it('setup() defaults topRate:1, outerPadding:10, innerPadding:5 (inherits column3d\'s own defaults, plus its own new topRate)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'block', domain: ['Q1'] }, y: { type: 'range', domain: 'total' }, c: { type: 'grid3d' }, data: [{ total: 20 }], depth: 20, degree: 30 }],
        brush: [{ type: 'cylinder3d', target: ['total'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)
    expect(brush.topRate).toBe(1)
    expect(brush.outerPadding).toBe(10)
    expect(brush.innerPadding).toBe(5)
  })
})
