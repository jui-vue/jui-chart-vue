import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('pin brush', () => {
  it('renders a single marker (triangle flag + vertical line) at axis.x(brush.split), not once per data row', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
              { name: 'C', value1: 90 },
            ],
          },
        ],
        brush: [{ type: 'pin', split: 1 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-pin')
    expect(group).not.toBeNull()

    // One triangle "flag" and one vertical line, regardless of the 3 data rows.
    expect(group!.querySelectorAll('polygon').length).toBe(1)
    expect(group!.querySelectorAll('line').length).toBe(1)
    expect(group!.querySelectorAll('text').length).toBe(0)
  })

  it('renders a text label when brush.format is a function', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'pin', split: 0, format: (v: unknown) => `idx:${v}` }],
      },
    })

    const text = wrapper.element.querySelector('g.brush-pin text')
    expect(text).not.toBeNull()
    // NOT "idx:0": the ordinal scale's own `invert(x) = Math.ceil(x / rangeBand)` rounds the
    // first band's own center position (`rangeBand / 2`) UP to 1, not down to 0 - a real,
    // preserved off-by-one quirk in `jui-graph-ts`'s ordinal scale (matching the legacy engine's
    // identical formula), not a bug in this brush.
    expect(text!.textContent).toBe('idx:1')
  })
})
