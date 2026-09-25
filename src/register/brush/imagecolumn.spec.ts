import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('imagecolumn brush', () => {
  it('renders one <image> per (row, target) cell inside a <g class="brush-imagecolumn">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'quarter' },
            y: { type: 'range', domain: [0, 100], step: 10 },
            data: [
              { quarter: '1Q', twitter: 50, facebook: 70 },
              { quarter: '2Q', twitter: 20, facebook: 40 },
            ],
          },
        ],
        brush: [{ type: 'imagecolumn', target: ['twitter', 'facebook'], width: 40, height: 45, uri: (k: string) => `${k}.png` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-imagecolumn')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('image').length).toBe(4)
  })
})
