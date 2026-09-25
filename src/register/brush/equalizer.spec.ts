import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('equalizer brush', () => {
  it('renders a stack of small fixed-height blocks per (row, target), growing away from zero, color-banded every `gap` blocks', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', value1: 60 }],
          },
        ],
        brush: [{ type: 'equalizer', target: ['value1'], unit: 5, gap: 3 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-equalizer')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(1)

    // Every block should have the same fixed `unit` height (except possibly the last, clipped
    // one) - assert at least the first few (unclipped) blocks share one height.
    const heights = Array.from(rects).map((r) => Number(r.getAttribute('height')))
    expect(heights[0]).toBe(heights[1])

    // Color-banding: with gap=3, blocks 0-2 share one color, blocks 3-5 share the next.
    const fills = Array.from(rects).map((r) => r.getAttribute('fill'))
    expect(fills[0]).toBe(fills[1])
    expect(fills[0]).toBe(fills[2])
    if (fills.length > 3) {
      expect(fills[3]).not.toBe(fills[0])
    }
  })

  it('groups multiple targets side by side per row (outerPadding/innerPadding division, like bar.js)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 30, b: 60 }],
          },
        ],
        brush: [{ type: 'equalizer', target: ['a', 'b'] }],
      },
    })

    // Each target gets its own <g> group (one per (row, target) pair, per `addEvent(barGroup, i, j)`).
    const groups = wrapper.element.querySelectorAll('g.brush-equalizer > g')
    expect(groups.length).toBe(2)
  })
})
