import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BarChart from './BarChart.vue'
import type { AxisConfig, DataRow } from '../types'

/**
 * Component-level proof that the SVG defs-registry pipeline (`colorParser.ts` +
 * `useColorResolver.ts`, wired through `useTheme.ts` + `ChartBase.vue`) actually reaches a real
 * chart's rendered output - not just the composable-level unit tests above. Before this feature,
 * `theme="gradient"`/`theme="pattern"` passed raw `"linear(...)"`/`"pattern-jennifer-NN"` strings
 * straight into a `fill` attribute (invalid SVG, browser default black - see PORT_STATUS.md's
 * Phase H entry and the Playwright screenshot it describes).
 *
 * Every test here `await nextTick()`s once after mounting: `<ChartBase>`'s `<defs>` and its
 * wrapping component's series marks are two SEPARATE components sharing one `useColorResolver()`
 * (see `ChartBase.vue`'s `colorResolver` prop doc comment) - on the very first synchronous render,
 * `<defs>` (earlier in `ChartBase.vue`'s template) evaluates before the marks in the default
 * `<slot/>` (later in the same template) have had a chance to call `color(i)`/populate the shared
 * reactive `defs` list, so it initially renders empty. Vue's reactivity then schedules a
 * (batched, microtask-queued) re-render of `<ChartBase>` once `defs.value` changes, which
 * `nextTick()` flushes - matching what happens before any real paint in a browser (verified
 * separately via Playwright - see PORT_STATUS.md).
 */
const data: DataRow[] = [
  { quarter: '1Q', sales: 1, profit: 3 },
  { quarter: '2Q', sales: 3, profit: 2 },
]
const axisX: AxisConfig = { type: 'block', domain: 'quarter' }
const axisY: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }

describe('BarChart theme="gradient"/"pattern" defs-registry rendering', () => {
  it('theme="gradient": renders real <linearGradient> defs in <defs>, and bars\' fill attrs are url(#gradient-N) references, not the raw "linear(...)" string', async () => {
    const wrapper = mount(BarChart, {
      props: { data, axisX, axisY, target: ['sales', 'profit'], orient: 'column', theme: 'gradient' },
    })
    await nextTick()

    const gradientDefs = wrapper.findAll('defs linearGradient')
    expect(gradientDefs.length).toBeGreaterThan(0)

    const rects = wrapper.findAll('path').filter((r) => (r.attributes('fill') ?? '').startsWith('url(#'))
    expect(rects.length).toBeGreaterThan(0)

    for (const rect of rects) {
      const fill = rect.attributes('fill')!
      expect(fill).toMatch(/^url\(#gradient-\d+\)$/)
      expect(fill).not.toContain('linear(')

      const id = fill.slice(5, -1)
      const matchingDef = gradientDefs.find((d) => d.attributes('id') === id)
      expect(matchingDef).toBeDefined()
    }

    // Sanity: the referenced <linearGradient> actually has <stop> children with real colors.
    const firstDef = gradientDefs[0]
    const stops = firstDef.findAll('stop')
    expect(stops.length).toBeGreaterThan(0)
    expect(stops[0].attributes('stop-color')).toMatch(/^#[0-9a-fA-F]{3,6}$/)
  })

  it('theme="gradient": resolving the same palette color across multiple bars dedups to the same def (no duplicate <linearGradient> per repeated raw color)', async () => {
    const manyRowsData: DataRow[] = [
      { quarter: '1Q', sales: 1 },
      { quarter: '2Q', sales: 2 },
      { quarter: '3Q', sales: 3 },
    ]
    const wrapper = mount(BarChart, {
      props: {
        data: manyRowsData,
        axisX,
        axisY: { type: 'range', domain: (d) => [d.sales], step: 3 },
        target: ['sales'],
        orient: 'column',
        theme: 'gradient',
      },
    })
    await nextTick()

    // Every bar is the same target ("sales", palette index 0) -> same raw gradient string -> must
    // dedup to exactly one <linearGradient> def, not one per bar.
    const gradientDefs = wrapper.findAll('defs linearGradient')
    expect(gradientDefs).toHaveLength(1)

    const rects = wrapper.findAll('path').filter((r) => (r.attributes('fill') ?? '').startsWith('url(#'))
    expect(rects.length).toBeGreaterThan(1)
    const fills = new Set(rects.map((r) => r.attributes('fill')))
    expect(fills.size).toBe(1)
  })

  it('theme="pattern": renders a real <pattern> def with an <image> child, and a bar\'s fill is url(#pattern-jennifer-NN), not the raw name string', async () => {
    const wrapper = mount(BarChart, {
      props: { data, axisX, axisY, target: ['sales', 'profit'], orient: 'column', theme: 'pattern' },
    })
    await nextTick()

    const patternDefs = wrapper.findAll('defs pattern')
    expect(patternDefs.length).toBeGreaterThan(0)
    expect(patternDefs[0].attributes('id')).toMatch(/^pattern-jennifer-\d\d$/)
    expect(patternDefs[0].find('image').exists()).toBe(true)
    // @vue/test-utils' `.attributes()` reports the namespaced `xlink:href` attribute under its
    // local name `href` (confirmed the real rendered DOM node's `outerHTML` still has the
    // qualified `xlink:href="..."` attribute, as SVG/browsers require - this is a test-tooling
    // attribute-name quirk, not a rendering bug).
    expect(patternDefs[0].find('image').attributes('href')).toMatch(/^data:image\/png;base64,/)

    const rects = wrapper.findAll('path').filter((r) => (r.attributes('fill') ?? '').startsWith('url(#'))
    expect(rects.length).toBeGreaterThan(0)
    for (const rect of rects) {
      expect(rect.attributes('fill')).toMatch(/^url\(#pattern-jennifer-\d\d\)$/)
    }
  })

  it('theme="classic" (unaffected baseline): bars\' fill attrs are still the exact plain hex color strings, not url(#...) references - zero regression for non-gradient/pattern themes', async () => {
    const wrapper = mount(BarChart, {
      props: { data, axisX, axisY, target: ['sales', 'profit'], orient: 'column', theme: 'classic' },
    })
    await nextTick()

    expect(wrapper.findAll('defs linearGradient')).toHaveLength(0)
    expect(wrapper.findAll('defs pattern')).toHaveLength(0)

    // classicTheme.colors are all 6-hex-digit (e.g. "#7977C2") - excludes the chart's own 3-digit
    // "#fff" background rect, which isn't a bar / doesn't go through color(i). Bars themselves are
    // rendered as rounded-corner <path> elements (see `roundedRectPath`), not <rect>.
    const barRects = wrapper.findAll('path').filter((r) => /^#[0-9a-fA-F]{6}$/.test(r.attributes('fill') ?? ''))
    expect(barRects.length).toBeGreaterThan(0)
    for (const rect of barRects) {
      expect(rect.attributes('fill')).not.toMatch(/^url\(#/)
    }
  })
})
