import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('donut brush', () => {
  it('renders one arc <path> per non-zero target, each stroked (not filled) with stroke-width = size (a ring, not a wedge)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ a: 30, b: 70 }] }],
        brush: [{ type: 'donut', target: ['a', 'b'], size: 40 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-donut')
    expect(group).not.toBeNull()

    // `drawText()`'s "outside label" leader-line annotation (inherited from `PieBrush`) may also
    // emit its own transparent-fill <path> even while hidden - same quirk already documented in
    // `pie.spec.ts`. Every REAL donut-ring path has `fill: "transparent"` too (it's a stroked
    // ring, not a filled wedge) - so filter by `stroke-width` (only set on ring arcs) instead.
    const paths = Array.from(group!.querySelectorAll('path')).filter((p) => p.getAttribute('stroke-width') === '40')
    expect(paths.length).toBe(2)

    for (const p of paths) {
      expect(p.getAttribute('fill')).toBe('transparent')
    }
  })

  it('renders a total-value label when showValue: true', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ a: 30, b: 70 }] }],
        brush: [{ type: 'donut', target: ['a', 'b'], showValue: true }],
      },
    })

    const texts = Array.from(wrapper.element.querySelectorAll('g.brush-donut text')).map((t) => t.textContent)
    expect(texts).toContain('100')
  })

  it('draws a placeholder ring via drawNoData() when axis.data is empty', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        brush: [{ type: 'donut', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-donut')!
    expect(group.querySelectorAll('path').length).toBe(1)
  })
})
