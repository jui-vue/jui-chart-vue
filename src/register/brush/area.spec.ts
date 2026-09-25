import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('area brush', () => {
  it('renders a closed, filled path (area) plus a visible line inside a <g class="brush-area">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
              { name: 'C', value1: 20 },
            ],
          },
        ],
        brush: [{ type: 'area', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-area')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    // one closed fill path (from createLine+close) + one visible line path (brush.line defaults true)
    expect(paths.length).toBe(2)

    const filled = Array.from(paths).find((p) => p.getAttribute('d')!.toUpperCase().includes('Z'))
    expect(filled).toBeTruthy()
    expect(filled!.getAttribute('fill')).not.toBe('transparent')
  })

  it('omits the line path when brush.line is false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'area', target: ['value1'], line: false }],
      },
    })

    const paths = wrapper.element.querySelectorAll('g.brush-area path')
    expect(paths.length).toBe(1)
  })
})
