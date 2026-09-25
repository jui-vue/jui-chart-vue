import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullgauge brush', () => {
  it('renders a background ring + a value-proportional foreground ring, plus text/title labels, per data row', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            data: [
              { title: 'CPU', value: 40, min: 0, max: 100 },
              { title: 'Memory', value: 80, min: 0, max: 100 },
            ],
          },
        ],
        brush: [{ type: 'fullgauge' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullgauge')
    expect(group).not.toBeNull()

    // 2 rows * 2 rings (background + value arc) = 4 donut <path>s.
    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(4)

    const texts = Array.from(group!.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('CPU')
    expect(texts).toContain('Memory')
    expect(texts).toContain('40')
    expect(texts).toContain('80')
  })
})
