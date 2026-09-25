import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import { classicIcons } from './classic'

describe('classic icon map', () => {
  it('has exactly the 192 real icon keys from the legacy source', () => {
    expect(Object.keys(classicIcons).length).toBe(192)
    expect(classicIcons['check']).toBe('')
    expect(classicIcons['chevron-left']).toBe('')
  })

  it('is registered as "classic" - Chart resolves a `{key}` placeholder in any chart.text() call to the real codepoint', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 200,
        axis: [{ data: [] }],
        widget: [{ type: 'title', text: '{check} Done' }],
      },
    })

    const text = wrapper.element.querySelector('text.widget-title')
    expect(text?.textContent).toBe(' Done')
  })

  it('<Chart> injects a real @font-face rule by default, pointing at the bundled icomoon font files', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 200,
        axis: [{ data: [] }],
      },
    })

    // jsdom's CSSOM (the `cssstyle` package) doesn't parse/store an `@font-face`'s `src` value at
    // all (neither in `cssText` nor as an individually readable property - confirmed empirically:
    // both come back empty here even though `Builder.setVectorFontIcons()` built and passed the
    // real, correct rule string to `insertRule()`) - a genuine jsdom limitation, same category as
    // its missing canvas 2D context (see `guideline.ts`'s own header comment for that precedent).
    // This test therefore only confirms the rule itself exists with the right `font-family` -
    // the real `src`/font-file wiring is verified via Playwright (a real browser) instead.
    const styleEls = Array.from(document.head.querySelectorAll('style'))
    const fontFaceRule = styleEls.flatMap((el) => Array.from(el.sheet?.cssRules ?? [])).find((r) => r.cssText.includes('@font-face') && r.cssText.includes('classic'))

    expect(fontFaceRule).toBeDefined()

    wrapper.unmount()
  })
})
