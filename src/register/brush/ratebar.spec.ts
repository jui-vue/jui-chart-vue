import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('ratebar brush', () => {
  it('skips a zero-value target entirely and renders one pill-segment <path> per remaining target', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A'] },
            data: [{ name: 'A', a: 30, b: 0, c: 70 }],
          },
        ],
        brush: [{ type: 'ratebar', target: ['a', 'b', 'c'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-ratebar')
    expect(group).not.toBeNull()

    // Each rendered segment is its own <g> (createBarElement's own `this.svg.group()`), containing
    // one pill-shaped <path> (fill = a real color) and a percent <text> label - `b` (value 0)
    // should be skipped entirely. `createTooltipElement()`'s own dashed-line <path> (fill:
    // "transparent") may also render (jsdom's `getTextSize()` can't do real text layout, so its
    // "does the tooltip text fit" width check always passes) - filtered out here.
    const segmentPaths = Array.from(group!.querySelectorAll('path')).filter((p) => p.getAttribute('fill') !== 'transparent')
    expect(segmentPaths.length).toBe(2)

    // Percent labels are drawn via `createTextElement()` (`dx`/`dy`-positioned, unlike the
    // optional tooltip's own `x`/`y`-positioned value text, which may also render under jsdom
    // since `getTextSize()` can't do real text layout there) - filter to just the percent labels.
    const percentTexts = Array.from(group!.querySelectorAll('text[dx]')).map((t) => t.textContent)
    // 30/(30+70) = 30%, 70/(30+70) = 70%.
    expect(percentTexts).toEqual(['30%', '70%'])
  })
})
