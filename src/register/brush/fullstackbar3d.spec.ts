import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullstackbar3d brush', () => {
  it('renders one rescaled-to-full-width rect3d <g> per (row, target) cell inside a <g class="brush-fullstackbar3d">, plus % text labels when showText:true', () => {
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
              { sales: 12, profit: 8, total: 20 },
              { sales: 15, profit: 5, total: 20 },
            ],
            depth: 20,
            degree: 30,
          },
        ],
        brush: [{ type: 'fullstackbar3d', target: ['sales', 'profit'], showText: true }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackbar3d')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('path').length).toBe(12)
    expect(group!.querySelectorAll('text').length).toBe(4)
  })

  it('setup() defaults outerPadding:10, showText:false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: 'total' }, y: { type: 'block', domain: ['Q1'] }, c: { type: 'grid3d' }, data: [{ total: 20 }], depth: 20, degree: 30 }],
        brush: [{ type: 'fullstackbar3d', target: ['total'] }],
      },
    })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)
    expect(brush.outerPadding).toBe(10)
    expect(brush.showText).toBe(false)
  })
})
