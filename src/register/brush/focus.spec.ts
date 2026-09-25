import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('focus brush', () => {
  it('highlights an x-range (block axis) with a semi-transparent band + two border lines', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C', 'D'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
              { name: 'C', value1: 60 },
              { name: 'D', value1: 20 },
            ],
          },
        ],
        brush: [{ type: 'focus', start: 1, end: 2 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-focus')
    expect(group).not.toBeNull()

    expect(group!.querySelectorAll('rect').length).toBe(1)
    expect(group!.querySelectorAll('line').length).toBe(2)
  })

  it('renders an empty group when start or end is -1 (the default, "no focus configured")', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'focus' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-focus')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('rect').length).toBe(0)
    expect(group!.querySelectorAll('line').length).toBe(0)
  })
})
