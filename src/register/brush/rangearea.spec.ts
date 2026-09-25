import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('rangearea brush', () => {
  it('renders one closed <polygon> band per target, tracing [low...] forward then [...high] backward', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: [10, 40] },
              { name: 'B', value1: [20, 60] },
              { name: 'C', value1: [5, 90] },
            ],
          },
        ],
        brush: [{ type: 'rangearea', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-rangearea')
    expect(group).not.toBeNull()

    const polygons = group!.querySelectorAll('polygon')
    expect(polygons.length).toBe(1)

    // 3 rows forward (low) + 3 rows backward (high) + 1 auto-closing repeated point = 7 points.
    const points = polygons[0].getAttribute('points')!.trim().split(/\s+/)
    expect(points.length).toBe(7)
  })

  it('does not add click/hover events (legacy never calls addEvent here, unlike rangebar/rangecolumn)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', value1: [10, 40] }],
          },
        ],
        brush: [{ type: 'rangearea', target: ['value1'] }],
      },
    })

    const polygon = wrapper.element.querySelector('g.brush-rangearea polygon')!
    expect(polygon.getAttribute('cursor')).toBeNull()
  })
})
