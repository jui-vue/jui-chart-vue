import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('legend widget', () => {
  it('renders one legend icon+label group per brush target key, inside <g class="widget-legend">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10, value2: 20 },
              { name: 'B', value1: 40, value2: 30 },
            ],
          },
        ],
        brush: [{ type: 'column', target: ['value1', 'value2'] }],
        widget: [{ type: 'legend' }],
      },
    })

    const legend = wrapper.element.querySelector('g.widget-legend')
    expect(legend).not.toBeNull()

    // default (non-filter) icon shape is a <circle> next to a <text> label, one pair per target key.
    expect(legend!.querySelectorAll('circle').length).toBe(2)

    const texts = Array.from(legend!.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toEqual(['value1', 'value2'])
  })
})
