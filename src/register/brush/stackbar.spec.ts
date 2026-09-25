import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackbar brush', () => {
  it('renders one stacked <rect> per target inside a per-row <g>, all inside <g class="brush-stackbar">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B'] },
            data: [
              { name: 'A', a: 30, b: 40 },
              { name: 'B', a: 10, b: 20 },
            ],
          },
        ],
        brush: [{ type: 'stackbar', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackbar')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(4)
  })

  it('hides (display: none) a zero-value target segment, matching the legacy `value == 0` guard', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', a: 0, b: 40 }],
          },
        ],
        brush: [{ type: 'stackbar', target: ['a', 'b'] }],
      },
    })

    const rects = wrapper.element.querySelectorAll('g.brush-stackbar rect')
    expect(rects.length).toBe(2)
    expect(rects[0].getAttribute('display')).toBe('none')
    expect(rects[1].getAttribute('display')).toBeNull()
  })

  it('stacks the second target starting where the first ends (cumulative x)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', a: 30, b: 40 }],
          },
        ],
        brush: [{ type: 'stackbar', target: ['a', 'b'] }],
      },
    })

    const rects = wrapper.element.querySelectorAll('g.brush-stackbar rect')
    expect(rects.length).toBe(2)

    const firstX = Number(rects[0].getAttribute('x'))
    const firstWidth = Number(rects[0].getAttribute('width'))
    const secondX = Number(rects[1].getAttribute('x'))

    // second segment starts approximately where the first ends (allowing for float rounding).
    expect(Math.abs(secondX - (firstX + firstWidth))).toBeLessThan(1)
  })
})
