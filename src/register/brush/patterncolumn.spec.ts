import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('patterncolumn brush', () => {
  it('renders one pattern-filled <rect> per (row, target) cell inside a <g class="brush-patterncolumn">', () => {
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
        brush: [{ type: 'patterncolumn', target: ['twitter', 'facebook'], width: 40, height: 45, uri: (k: string) => `${k}.png` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-patterncolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(4)
    for (const r of rects) {
      expect(r.getAttribute('fill')).toMatch(/^url\(#pattern-/)
    }
  })
})
