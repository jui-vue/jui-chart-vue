import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackbar3d brush', () => {
  it('renders one stacked rect3d <g> per (row, target) cell (end-to-end along x) inside a <g class="brush-stackbar3d">', () => {
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
        brush: [{ type: 'stackbar3d', target: ['sales', 'profit'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackbar3d')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('path').length).toBe(12)
  })

  it('setup() defaults outerPadding:10', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: 'total' }, y: { type: 'block', domain: ['Q1'] }, c: { type: 'grid3d' }, data: [{ total: 20 }], depth: 20, degree: 30 }],
        brush: [{ type: 'stackbar3d', target: ['total'] }],
      },
    })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    expect(builder.get('brush', 0).outerPadding).toBe(10)
  })
})
