import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('treemap brush', () => {
  it('renders one <rect> per leaf node (non-leaf grouping nodes are never drawn)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            data: [
              { index: '0', text: 'A', value: 10 },
              { index: '1', text: 'B', value: 20 },
              { index: '1.0', text: 'B1', value: 12 },
              { index: '1.1', text: 'B2', value: 8 },
            ],
          },
        ],
        brush: [{ type: 'treemap', titleDepth: -1 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-treemap')
    expect(group).not.toBeNull()

    // Leaves: "0" (no children) and "1.0"/"1.1" (children of "1") = 3 leaf rects. "1" itself is a
    // non-leaf grouping node and, per `isDrawNode()`, is never drawn since it keeps its
    // `drawBefore()`-time default all-zero geometry.
    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(3)
  })

  it('draws a title label at the configured titleDepth and suppresses the regular text label there', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            data: [
              { index: '0', text: 'Group A', value: 10 },
              { index: '0.0', text: 'Leaf', value: 10 },
            ],
          },
        ],
        brush: [{ type: 'treemap', titleDepth: 1, showText: true }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-treemap')!
    const texts = Array.from(group.querySelectorAll('text')).map((t) => t.textContent)

    expect(texts).toContain('Group A')
    // Only the leaf's own regular label should render alongside the title - the title node
    // itself ("0") is excluded from the regular per-leaf text pass via `titleKeys`.
    expect(texts).toContain('Leaf')
    expect(texts.length).toBe(2)
  })

  it('does not draw any node when showText is false and titleDepth matches nothing', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ index: '0', text: 'A', value: 10 }] }],
        brush: [{ type: 'treemap', titleDepth: -1, showText: false }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-treemap')!
    expect(group.querySelectorAll('text').length).toBe(0)
    expect(group.querySelectorAll('rect').length).toBe(1)
  })
})
