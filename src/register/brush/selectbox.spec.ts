import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('selectbox brush', () => {
  it('renders one invisible, hoverable <rect> cell per tick interval on a date axis', () => {
    const oneDay = 24 * 3600 * 1000
    const base = +new Date(2020, 0, 1)

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: {
              type: 'date',
              domain: [new Date(base), new Date(base + oneDay * 4)],
              interval: oneDay,
            },
            y: { type: 'range', domain: [0, 100] },
            data: [{ value1: 10 }],
          },
        ],
        brush: [{ type: 'selectbox' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-selectbox')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    // 5 days spanning 4 intervals -> 4 cells (one per gap between consecutive ticks).
    expect(rects.length).toBe(4)

    for (const r of rects) {
      // classic theme: selectBoxBackgroundColor/-BorderColor set, but opacity starts at 0 (hover-
      // revealed) - confirmed via the `fill-opacity`/`stroke-opacity` starting attrs.
      expect(r.getAttribute('fill-opacity')).toBe('0')
      expect(r.getAttribute('stroke-opacity')).toBe('0')
      expect(r.getAttribute('cursor')).toBe('pointer')
    }
  })
})
