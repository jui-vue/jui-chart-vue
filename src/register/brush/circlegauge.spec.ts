import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('circlegauge brush', () => {
  it('renders a background circle + a value-scaled foreground circle per row, inside a <g class="brush-circlegauge">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        axis: [{ data: [{ value: 50, min: 0, max: 100 }] }],
        brush: [{ type: 'circlegauge' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-circlegauge')
    expect(group).not.toBeNull()

    const circles = group!.querySelectorAll('circle')
    expect(circles.length).toBe(2)

    const bgR = Number(circles[0].getAttribute('r'))
    const fgR = Number(circles[1].getAttribute('r'))
    // value:50 of a 0-100 range -> rate 0.5, so the foreground radius is half the background's.
    expect(fgR).toBeCloseTo(bgR * 0.5, 5)
  })

  it('setup() defaults clip:false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ data: [{ value: 10, min: 0, max: 100 }] }],
        brush: [{ type: 'circlegauge' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.clip).toBe(false)
  })
})
