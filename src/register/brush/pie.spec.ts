import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('pie brush', () => {
  it('renders one pie slice <path> per non-zero target key inside a <g class="brush-pie">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            data: [{ name: 'row', a: 30, b: 70 }],
          },
        ],
        brush: [{ type: 'pie', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pie')
    expect(group).not.toBeNull()

    // Each slice's arc is a filled <path> (fill = the slice color); `drawText()`'s "outside label"
    // branch may ALSO emit a transparent-fill leader-line <path> even while its containing group
    // is `visibility: hidden` (showText isn't configured) - filtering by `fill !== "transparent"`
    // isolates just the two real slice arcs.
    const arcPaths = Array.from(group!.querySelectorAll('path')).filter((p) => p.getAttribute('fill') !== 'transparent')
    expect(arcPaths.length).toBe(2)
  })

  it('renders a single full <circle> (not a <path>) when only one non-zero slice exists', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ name: 'row', a: 100, b: 0 }] }],
        brush: [{ type: 'pie', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pie')!
    // b == 0 is skipped entirely (legacy `if(data[target[i]] == 0) continue`), a is 100% -> circle,
    // not an arc <path> (see legacy `drawPie()`'s `endAngle == 360` branch).
    const arcPaths = Array.from(group.querySelectorAll('path')).filter((p) => p.getAttribute('fill') !== 'transparent')
    expect(arcPaths.length).toBe(0)
    expect(group.querySelectorAll('circle').length).toBe(1)
  })

  it('draws a background placeholder circle via drawNoData() when axis.data is empty', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        brush: [{ type: 'pie', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pie')!
    expect(group.querySelectorAll('circle').length).toBe(1)
  })
})
