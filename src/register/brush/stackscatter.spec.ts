import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackscatter brush', () => {
  it('positions the second target point at the CUMULATIVE value (getStackXY, not getXY)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 10, b: 20 }],
          },
        ],
        brush: [{ type: 'stackscatter', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackscatter')
    expect(group).not.toBeNull()

    const ellipses = group!.querySelectorAll('ellipse')
    expect(ellipses.length).toBe(2)

    // Second point (b, stacked on top of a) should have a SMALLER cy (higher on screen) than the
    // first (a alone), since it's positioned at axis.y(a+b), a larger value than axis.y(a) alone.
    const firstCy = Number(ellipses[0].getAttribute('cy'))
    const secondCy = Number(ellipses[1].getAttribute('cy'))
    expect(secondCy).toBeLessThan(firstCy)
  })
})
