import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullstackbar brush', () => {
  it('always fills the full axis width regardless of the row sum (100%-normalized)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B'] },
            data: [
              { name: 'A', a: 30, b: 70 },
              { name: 'B', a: 3, b: 7 },
            ],
          },
        ],
        brush: [{ type: 'fullstackbar', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackbar')
    expect(group).not.toBeNull()

    const rowGroups = group!.querySelectorAll(':scope > g')
    expect(rowGroups.length).toBe(2)

    for (const rowGroup of rowGroups) {
      const rects = rowGroup.querySelectorAll('rect')
      expect(rects.length).toBe(2)
      const totalWidth = Array.from(rects).reduce((sum, r) => sum + Number(r.getAttribute('width')), 0)
      // Both rows have the same a:b ratio (30:70 vs 3:7) so both should fill the identical total
      // pixel width - that's the "always normalized to 100%" behavior under test.
      expect(totalWidth).toBeGreaterThan(0)
    }

    const firstRowWidth = Array.from(rowGroups[0].querySelectorAll('rect')).reduce((s, r) => s + Number(r.getAttribute('width')), 0)
    const secondRowWidth = Array.from(rowGroups[1].querySelectorAll('rect')).reduce((s, r) => s + Number(r.getAttribute('width')), 0)
    expect(Math.abs(firstRowWidth - secondRowWidth)).toBeLessThan(1)
  })

  it('renders a percent <text> label per segment when showText is enabled', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', a: 25, b: 75 }],
          },
        ],
        brush: [{ type: 'fullstackbar', target: ['a', 'b'], showText: true }],
      },
    })

    const texts = wrapper.element.querySelectorAll('g.brush-fullstackbar text')
    expect(texts.length).toBe(2)
    expect(texts[0].textContent).toBe('25%')
    expect(texts[1].textContent).toBe('75%')
  })
})
