import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('clusterbar3d brush', () => {
  it('renders one extruded rect3d <g> per (row, target) cell inside a <g class="brush-clusterbar3d">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: 'total' },
            y: { type: 'block', domain: ['Q1', 'Q2'] },
            c: { type: 'grid3d' },
            data: [
              { sales: 12, profit: 10, total: 20 },
              { sales: 15, profit: 6, total: 20 },
            ],
            depth: 20,
            degree: 30,
          },
        ],
        brush: [{ type: 'clusterbar3d', target: ['sales', 'profit'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-clusterbar3d')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('path').length).toBe(12)
  })

  it('setup() defaults outerPadding:5, innerPadding:5', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: 'total' }, y: { type: 'block', domain: ['Q1'] }, c: { type: 'grid3d' }, data: [{ total: 20 }], depth: 20, degree: 30 }],
        brush: [{ type: 'clusterbar3d', target: ['total'] }],
      },
    })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)
    expect(brush.outerPadding).toBe(5)
    expect(brush.innerPadding).toBe(5)
  })
})
