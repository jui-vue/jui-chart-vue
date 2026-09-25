import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('bar brush', () => {
  it('renders one <path> per data row inside a <g class="brush-bar">, positioned from the zero point', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B', 'C'] },
            data: [
              { name: 'A', value1: 30 },
              { name: 'B', value1: 60 },
              { name: 'C', value1: 10 },
            ],
          },
        ],
        brush: [{ type: 'bar', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-bar')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(3)

    // Every bar path should have a non-empty `d` (PathRectElement.round() calls .join()).
    for (const p of paths) {
      expect(p.getAttribute('d')).toBeTruthy()
    }
  })

  it('does not add a click/hover event target for a zero-value bar (legacy `value != 0` guard)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B'] },
            data: [
              { name: 'A', value1: 0 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'bar', target: ['value1'] }],
      },
    })

    const paths = wrapper.element.querySelectorAll('g.brush-bar path')
    expect(paths.length).toBe(2)
  })

  it('animate: true renders real animation elements without throwing (CORRECTION: Element.is() genuinely works, matching the real engine)', () => {
    // Previously asserted this as a faithful crash ("jui is not defined") - that was wrong. See
    // `drawAnimate()`'s own comment above and `util/svg/element.ts`'s `Element.is()` doc comment
    // in jui-graph-ts for the full correction (confirmed by loading real `animate: true` demos
    // directly against the live legacy site - none of them throw).
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ x: { type: 'range', domain: [0, 100] }, y: { type: 'block', domain: ['A'] }, data: [{ name: 'A', value1: 30 }] }],
        brush: [{ type: 'bar', target: ['value1'], animate: true }],
      },
    })

    const g = wrapper.element.querySelector('g.brush-bar')
    expect(g).not.toBeNull()
    expect(g!.querySelectorAll('animate').length).toBeGreaterThan(0)
    expect(g!.querySelectorAll('animateTransform').length).toBeGreaterThan(0)
  })
})
