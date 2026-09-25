import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackline brush', () => {
  it('draws the second target line stacked ON TOP of the first (getStackXY, not getXY)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', a: 10, b: 20 },
              { name: 'B', a: 15, b: 25 },
            ],
          },
        ],
        brush: [{ type: 'stackline', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackline')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(2)

    // Extract each path's y-coordinates from its `d` attribute (M<x>,<y> L<x>,<y>) - since y grows
    // downward in SVG, the SECOND (stacked, a+b) line's points should have SMALLER y (higher on
    // screen) than the first (a alone) line's points at the same row.
    const firstY = Number(paths[0].getAttribute('d')!.match(/M([\d.-]+),([\d.-]+)/)![2])
    const secondY = Number(paths[1].getAttribute('d')!.match(/M([\d.-]+),([\d.-]+)/)![2])
    expect(secondY).toBeLessThan(firstY)
  })
})
