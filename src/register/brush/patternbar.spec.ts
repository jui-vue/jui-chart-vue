import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('patternbar brush', () => {
  it('renders one pattern-filled <rect> per (row, target) cell, each with a fresh <pattern> registered in <defs>, inside a <g class="brush-patternbar">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100], step: 10 },
            y: { type: 'block', domain: 'quarter' },
            data: [
              { quarter: '1Q', twitter: 50, facebook: 70 },
              { quarter: '2Q', twitter: 20, facebook: 40 },
            ],
          },
        ],
        brush: [{ type: 'patternbar', target: ['twitter', 'facebook'], width: 40, height: 40, uri: (k: string) => `${k}.png` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-patternbar')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(4)
    for (const r of rects) {
      expect(r.getAttribute('fill')).toMatch(/^url\(#pattern-/)
    }

    const patterns = wrapper.element.querySelectorAll('pattern')
    expect(patterns.length).toBe(4)
    expect(patterns[0].querySelector('image')).not.toBeNull()
  })
})
