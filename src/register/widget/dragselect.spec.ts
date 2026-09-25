import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('dragselect widget', () => {
  it('renders one rubber-band <rect> (initially 0x0) per configured brush', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['a', 'b', 'c'], line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }],
          },
        ],
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'dragselect', brush: [0] }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-dragselect')
    expect(g).not.toBeNull()

    const rect = g!.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect!.getAttribute('width')).toBe('0')
    expect(rect!.getAttribute('height')).toBe('0')
  })

  it('still renders a rect for an out-of-range brush index - Builder.get("brush", key) falls back to the WHOLE brush array (a real engine quirk, not null) when the key misses', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ v: 1 }] }],
        brush: [{ type: 'pyramid', target: ['v'] }],
        widget: [{ type: 'dragselect', brush: [5] }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-dragselect')
    expect(g).not.toBeNull()
    // `this.chart.get('brush', 5)` misses (`this._brush[5]` is undefined) and falls back to
    // returning `this._brush` itself (confirmed via `Builder.get()`'s own `if (obj[type][key])
    // return obj[type][key]; return obj[type];`) - a real, non-null array, so `if (brush != null)`
    // still passes and a rect IS created (just wired against a nonsensical "brush").
    expect(g!.querySelectorAll('rect').length).toBe(1)
  })
})
