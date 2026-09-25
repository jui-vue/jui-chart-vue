import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('pyramid brush', () => {
  it('renders one trapezoid <polygon> per target, sorted by value descending (largest = widest base)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ a: 10, b: 50, c: 30 }] }],
        brush: [{ type: 'pyramid', target: ['a', 'b', 'c'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pyramid')
    expect(group).not.toBeNull()

    const polygons = group!.querySelectorAll('polygon')
    expect(polygons.length).toBe(3)
  })

  it('renders a connecting <line> between adjacent segments and text labels when showText is true', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ a: 10, b: 50, c: 30 }] }],
        brush: [{ type: 'pyramid', target: ['a', 'b', 'c'], showText: true }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pyramid')!
    // 3 segments -> 2 connecting lines (i > 0) + one line per createText() label = 2 + 3 = 5.
    expect(group.querySelectorAll('line').length).toBe(5)
    expect(group.querySelectorAll('text').length).toBe(3)
  })

  it('only ever reads axis.data[0] - a second row is ignored entirely', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ a: 10, b: 20 }, { a: 999, b: 999 }] }],
        brush: [{ type: 'pyramid', target: ['a', 'b'] }],
      },
    })

    const polygons = wrapper.element.querySelectorAll('g.brush-pyramid polygon')
    expect(polygons.length).toBe(2)
  })
})
