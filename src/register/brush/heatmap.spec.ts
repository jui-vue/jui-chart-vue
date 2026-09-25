import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('heatmap brush', () => {
  it('renders one cell <rect> + one <text> per axis.data row, at (axis.x(i), axis.y(i))', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'block', domain: ['A', 'B', 'C'] },
            data: [
              { name: 'A', text: 'low' },
              { name: 'B', text: 'mid' },
              { name: 'C', text: 'high' },
            ],
          },
        ],
        brush: [{ type: 'heatmap' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-heatmap')
    expect(group).not.toBeNull()

    expect(group!.querySelectorAll('rect').length).toBe(3)

    const texts = Array.from(group!.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toEqual(['low', 'mid', 'high'])
  })

  it('uses a format callback over the raw text field when brush.format is a function', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', text: 'raw', score: 42 }],
          },
        ],
        brush: [{ type: 'heatmap', format: (d: Record<string, unknown>) => `score:${d.score}` }],
      },
    })

    const text = wrapper.element.querySelector('g.brush-heatmap text')!
    expect(text.textContent).toBe('score:42')
  })
})
