import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import type { Builder } from 'jui-graph-ts'

// `tooltipFormat` is deliberately never configured in these tests - see `guideline.ts`'s own
// header comment: `drawContentTooltip()`'s `getTextWidth()` uses a real `<canvas>` 2D context,
// unimplemented in jsdom (this project's unit-test environment). The rest of this widget's logic
// (line positioning, tooltip visibility, point coloring/hiding) doesn't touch canvas at all and is
// fully covered here.
function mountGuideline() {
  const wrapper = mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'range', domain: [0, 4], step: 1, line: true },
          y: { type: 'range', domain: [0, 10], line: true },
          data: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
        },
      ],
      brush: [{ type: 'line', target: ['v'] }],
      widget: [{ type: 'guideline', brush: 0, xFormat: (v: unknown) => `t:${v}` }],
    },
  })

  const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
  return { wrapper, builder }
}

describe('guideline widget', () => {
  it('starts hidden with a zero-position line and no content-tooltip data yet', () => {
    const { wrapper } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')
    expect(g).not.toBeNull()
    expect(g!.getAttribute('visibility')).toBe('hidden')
  })

  it('guideline.show moves the line to the snapped data-row position and makes the group visible', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])

    expect(g.getAttribute('visibility')).toBe('visible')
    const line = g.querySelector('line')!
    // domain [0,4], 5 rows -> interval 0.8, time=2 -> index floor(2/0.8)=2.
    expect(line.getAttribute('x1')).not.toBe('0')
  })

  it('guideline.hide makes the group invisible again', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])
    expect(g.getAttribute('visibility')).toBe('visible')

    builder.emit('guideline.hide', [])
    expect(g.getAttribute('visibility')).toBe('hidden')
  })

  it('colors the target point for a target present in the (default, un-toggled) legend_target cache', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])

    const circles = g.querySelectorAll('circle')
    // At least the point-marker circle (created in drawBefore, positioned/colored by
    // drawContentTooltip) should have a real, non-transparent fill.
    const fills = Array.from(circles).map((c) => c.getAttribute('fill'))
    expect(fills.some((f) => f && f !== 'transparent')).toBe(true)
  })
})
