import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('candlestick brush', () => {
  it('renders one wick <line> + one body <rect> per row, colored by open-vs-close (invert when open > close)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              // open > close ("invert"/red)
              { name: 'A', high: 90, low: 10, open: 70, close: 40 },
              // open <= close (normal)
              { name: 'B', high: 90, low: 10, open: 30, close: 60 },
            ],
          },
        ],
        brush: [{ type: 'candlestick' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-candlestick')
    expect(group).not.toBeNull()

    const lines = group!.querySelectorAll('line')
    const rects = group!.querySelectorAll('rect')
    expect(lines.length).toBe(2)
    expect(rects.length).toBe(2)

    // classic theme: candlestickInvertBackgroundColor: "#ff0000", candlestickBackgroundColor: "#fff"
    expect(rects[0].getAttribute('fill')).toBe('#ff0000')
    expect(rects[1].getAttribute('fill')).toBe('#fff')
  })
})
