import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('bubble3d brush', () => {
  it('renders one radial-gradient-filled bubble <g> per (row, target) cell inside a <g class="brush-bubble3d">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'fullblock', domain: ['Q1', 'Q2', 'Q3', 'Q4'] },
            y: { type: 'range', domain: [5, 20], step: 3 },
            c: { type: 'grid3d' },
            data: [
              { sales: 12, profit: 10, total: 15 },
              { sales: 15, profit: 6, total: 15 },
            ],
            depth: 150,
            degree: 30,
          },
        ],
        brush: [{ type: 'bubble3d', target: ['sales', 'profit'], min: 25, max: 25, clip: false }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-bubble3d')
    expect(group).not.toBeNull()

    const circles = group!.querySelectorAll('circle')
    expect(circles.length).toBe(4)
    for (const c of circles) {
      expect(c.getAttribute('fill')).toMatch(/^url\(#/)
    }
  })
})
