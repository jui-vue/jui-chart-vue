import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('zoomscroll widget', () => {
  it('renders a minimap <image> snapshot plus draggable end-cap and center-window rects', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 500,
        height: 350,
        axis: [
          {
            x: { type: 'block', domain: ['a', 'b', 'c', 'd', 'e'], line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
          },
        ],
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'zoomscroll', axis: 0, key: 'v' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoomscroll')
    expect(g).not.toBeNull()

    const image = g!.querySelector('image')
    expect(image).not.toBeNull()
    // A real, non-empty inline SVG data URI - confirms the headless snapshot chart actually
    // rendered (via a detached, never-appended <div> root - see zoomscroll.ts's own header
    // comment) rather than throwing or producing an empty string.
    expect(image!.getAttribute('xlink:href')).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(image!.getAttribute('xlink:href')!.length).toBeGreaterThan(100)

    // 2 end-cap path-rects (left/right) + 1 center rect.
    expect(g!.querySelectorAll('path').length).toBeGreaterThanOrEqual(2)
    // 2 round drag-handle rects + 1 center-window rect = 3 rects (path-rects render as <path>).
    expect(g!.querySelectorAll('rect').length).toBe(3)
  })

  it('renders nothing (no image/rects) when the computed end-cap widths are NaN (dataLength/window edge case)', () => {
    // count = 0 -> tick = w/0 = Infinity -> lw/rw computations resolve to NaN, hit the
    // `isNaN(lw) || isNaN(rw)` early-return guard.
    const wrapper = mount(Chart, {
      props: {
        width: 500,
        height: 350,
        axis: [{ data: [] }],
        widget: [{ type: 'zoomscroll', axis: 0, key: 'v' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-zoomscroll')!
    expect(g.querySelectorAll('image').length).toBe(0)
    expect(g.querySelectorAll('rect').length).toBe(0)
  })
})
