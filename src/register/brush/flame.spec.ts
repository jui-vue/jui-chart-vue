import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('flame brush', () => {
  it('renders one <rect> per node (root + every descendant, unlike treemap which skips non-leaves)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            data: [
              { index: '0', text: 'root', value: 100 },
              { index: '0.0', text: 'child A', value: 60 },
              { index: '0.1', text: 'child B', value: 40 },
            ],
          },
        ],
        brush: [{ type: 'flame' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-flame')
    expect(group).not.toBeNull()

    // flame draws EVERY node (root, child A, child B) as a rect, unlike treemap's leaf-only rule.
    expect(group!.querySelectorAll('rect').length).toBe(3)
  })

  it('divides a parent\'s width among children proportional to value, right-to-left by default (nodeAlign: "end")', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 200,
        axis: [
          {
            data: [
              { index: '0', text: 'root', value: 100 },
              { index: '0.0', text: 'A', value: 25 },
              { index: '0.1', text: 'B', value: 75 },
            ],
          },
        ],
        brush: [{ type: 'flame' }],
      },
    })

    const rects = Array.from(wrapper.element.querySelectorAll('g.brush-flame rect')) as SVGRectElement[]
    // Root is the full-width rect (width attr closest to the axis area's own width).
    const root = rects.reduce((a, b) => (Number(a.getAttribute('width')) > Number(b.getAttribute('width')) ? a : b))
    const rootWidth = Number(root.getAttribute('width'))

    const children = rects.filter((r) => r !== root)
    const widths = children.map((r) => Number(r.getAttribute('width'))).sort((a, b) => a - b)

    // 25/75 split of the root's width.
    expect(widths[0]).toBeCloseTo(rootWidth * 0.25, 5)
    expect(widths[1]).toBeCloseTo(rootWidth * 0.75, 5)
  })

  it('only ever reads the FIRST top-level row as root - a second top-level row is silently ignored', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 200,
        axis: [
          {
            data: [
              { index: '0', text: 'root', value: 10 },
              { index: '1', text: 'ignored second root', value: 999 },
            ],
          },
        ],
        brush: [{ type: 'flame' }],
      },
    })

    // Only "0" is ever drawn - `getNode()[0]` never reads index [1].
    expect(wrapper.element.querySelectorAll('g.brush-flame rect').length).toBe(1)
  })
})
