import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('tooltip widget', () => {
  it('renders one hidden tooltip group (per configured brush) with a line + balloon polygon', () => {
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
        brush: [{ type: 'column', target: ['value1'] }],
        widget: [{ type: 'tooltip' }],
      },
    })

    const tooltipRoot = wrapper.element.querySelector('g.widget-tooltip')
    expect(tooltipRoot).not.toBeNull()

    // hidden until hovered
    const innerGroup = tooltipRoot!.querySelector('g[visibility="hidden"]')
    expect(innerGroup).not.toBeNull()

    expect(tooltipRoot!.querySelector('line')).not.toBeNull()
    expect(tooltipRoot!.querySelector('polygon')).not.toBeNull()
  })
})
