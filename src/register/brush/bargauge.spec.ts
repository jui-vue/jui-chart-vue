import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('bargauge brush', () => {
  it('renders one track+fill <rect> pair and a title/value <text> pair per data row', () => {
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
        brush: [{ type: 'bargauge' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-bargauge')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    // 2 rows * (1 track + 1 fill) = 4.
    expect(rects.length).toBe(4)

    const texts = Array.from(group!.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toEqual(['CPU', '40', 'Memory', '80'])
  })

  it("the fill rect's width is proportional to value/(max-min)", () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ title: 'A', value: 25, min: 0, max: 100 }] }],
        brush: [{ type: 'bargauge' }],
      },
    })

    const rects = wrapper.element.querySelectorAll('g.brush-bargauge rect')
    const trackWidth = Number(rects[0].getAttribute('width'))
    const fillWidth = Number(rects[1].getAttribute('width'))

    expect(fillWidth).toBeCloseTo(trackWidth * 0.25, 1)
  })
})
