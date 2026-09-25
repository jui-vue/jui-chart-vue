import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('arcgauge brush', () => {
  it('renders tick lines + a filled arc <path> (+ text, since showText defaults true) inside a <g class="brush-arcgauge">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        axis: [{ c: { type: 'panel' }, data: [{ title: 'Overall', value: 140, max: 200, min: 0 }] }],
        brush: [{ type: 'arcgauge', size: 10, showText: true, format: (v: unknown) => `${v}k` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-arcgauge')
    expect(group).not.toBeNull()

    expect(group!.querySelectorAll('line').length).toBeGreaterThan(0)
    expect(group!.querySelectorAll('path').length).toBe(1)
    expect(group!.querySelectorAll('text').length).toBeGreaterThan(0)
  })

  it('setup() defaults startAngle:245, endAngle:475, size:5', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ c: { type: 'panel' }, data: [{ value: 10, max: 100, min: 0 }] }],
        brush: [{ type: 'arcgauge' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.startAngle).toBe(245)
    expect(brush.endAngle).toBe(475)
    expect(brush.size).toBe(5)
  })
})
