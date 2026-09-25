import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('ohlc brush', () => {
  it('renders 3 <line>s per row (high-low + open tick + close tick) inside a <g class="brush-ohlc">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'date' },
            y: { type: 'range', domain: [0, 30] },
            data: [
              { date: '1', low: 24, high: 25, open: 25, close: 24.9 },
              { date: '2', low: 23.6, high: 25.1, open: 24, close: 24.9 },
            ],
          },
        ],
        brush: [{ type: 'ohlc' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-ohlc')
    expect(group).not.toBeNull()

    expect(group!.querySelectorAll('line').length).toBe(6)
  })

  it('uses ohlcInvertBorderColor when open > close (a falling row)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'date' },
            y: { type: 'range', domain: [0, 30] },
            data: [{ date: '1', low: 10, high: 20, open: 18, close: 12 }],
          },
        ],
        brush: [{ type: 'ohlc' }],
      },
    })

    const line = wrapper.element.querySelector('g.brush-ohlc line')!
    // classic theme: ohlcInvertBorderColor: "#ff0000"
    expect(line.getAttribute('stroke')).toBe('#ff0000')
  })
})
