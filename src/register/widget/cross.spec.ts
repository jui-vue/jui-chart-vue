import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

function baseAxis() {
  return [
    {
      x: { type: 'block', domain: ['a', 'b', 'c'], line: true },
      y: { type: 'range', domain: [0, 10], line: true },
      data: [{ v: 1 }, { v: 2 }, { v: 3 }],
    },
  ]
}

describe('cross widget', () => {
  it('starts hidden and builds both guide lines + balloon tooltips when both xFormat and yFormat are configured', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: baseAxis(),
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'cross', xFormat: (v: unknown) => `x:${v}`, yFormat: (v: unknown) => `y:${v}` }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-cross')
    expect(g).not.toBeNull()
    expect(g!.getAttribute('visibility')).toBe('hidden')

    // Both guide lines exist (one horizontal, from the yFormat-gated xline; one vertical, from the
    // xFormat-gated yline).
    expect(g!.querySelectorAll('line').length).toBe(2)
    // Both balloon tooltips (polygon + text pairs) exist.
    expect(g!.querySelectorAll('polygon').length).toBe(2)
  })

  it('builds only the y-line + its tooltip when only xFormat is configured (yFormat gates the OTHER line - see header comment)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: baseAxis(),
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'cross', xFormat: (v: unknown) => `x:${v}` }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-cross')!
    // Only `yline` (gated by xFormat) is built - `xline` (gated by yFormat) is not.
    expect(g.querySelectorAll('line').length).toBe(1)
    expect(g.querySelectorAll('polygon').length).toBe(1)
  })

  it('builds neither line when no format callback is configured at all', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: baseAxis(),
        brush: [{ type: 'column', target: ['v'] }],
        widget: [{ type: 'cross' }],
      },
    })

    const g = wrapper.element.querySelector('g.widget-cross')!
    expect(g.querySelectorAll('line').length).toBe(0)
    expect(g.querySelectorAll('polygon').length).toBe(0)
  })
})
