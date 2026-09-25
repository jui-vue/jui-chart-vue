import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('heatmapscatter brush', () => {
  it('buckets scatter points into a coarse density grid, rendering one <rect> per non-empty cell', () => {
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
              domain: [new Date(base), new Date(base + oneDay * 9)],
              interval: oneDay,
              key: 'date',
            },
            y: { type: 'range', domain: [0, 100] },
            data: Array.from({ length: 10 }, (_, i) => ({ date: new Date(base + i * oneDay), value1: i * 10 })),
          },
        ],
        brush: [{ type: 'heatmapscatter', target: ['value1'], xInterval: oneDay * 3, yInterval: 30 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-heatmapscatter')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
    // With 10 points spread across ~4 x-buckets (10 days / 3-day interval) and ~4 y-buckets
    // (100 / 30), there should be noticeably fewer rendered cells than raw points (real bucketing,
    // not one rect per point).
    expect(rects.length).toBeLessThan(10)
  })
})
