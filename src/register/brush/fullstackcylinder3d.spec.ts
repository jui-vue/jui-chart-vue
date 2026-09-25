import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullstackcylinder3d brush', () => {
  it('renders one rescaled cylinder3d <g> per (row, target) cell inside a <g class="brush-fullstackcylinder3d">', () => {
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
              { sales: 12, profit: 8, total: 20 },
              { sales: 15, profit: 5, total: 20 },
            ],
            depth: 20,
            degree: 30,
          },
        ],
        brush: [{ type: 'fullstackcylinder3d', target: ['sales', 'profit'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackcylinder3d')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('ellipse').length).toBe(8)
  })
})
