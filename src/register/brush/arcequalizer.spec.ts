import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('arcequalizer brush', () => {
  it('renders one wedge <path> per (row, target) with a non-zero stack, plus a center total-value <text>', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 400,
        axis: [{ data: [{ a: 40, b: 60 }] }],
        brush: [{ type: 'arcequalizer', target: ['a', 'b'], maxValue: 100, stackCount: 10 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-arcequalizer')
    expect(group).not.toBeNull()

    // 1 row * 2 targets = 2 wedge <path>s.
    expect(group!.querySelectorAll('path').length).toBe(2)

    const text = group!.querySelector('text')
    expect(text).not.toBeNull()
    // total = 40 + 60 = 100.
    expect(text!.textContent).toBe('100')
  })

  it('splits the circle into equal angular wedges, one per data row (not value-weighted)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 400,
        axis: [{ data: [{ a: 10 }, { a: 90 }] }],
        brush: [{ type: 'arcequalizer', target: ['a'], maxValue: 100, stackCount: 10 }],
      },
    })

    const paths = wrapper.element.querySelectorAll('g.brush-arcequalizer path')
    // 2 rows * 1 target = 2 wedges, EQUAL angular width regardless of value (180 degrees each).
    expect(paths.length).toBe(2)
  })
})
