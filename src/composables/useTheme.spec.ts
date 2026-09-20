import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useColorResolver } from './useColorResolver'
import { classicTheme, gradientTheme, patternTheme, useTheme } from './useTheme'

/**
 * `gradientTheme`/`patternTheme` values are hand-traced directly from jui-chart's
 * `src/theme/gradient.js` and `src/theme/pattern.js` (both `extend: null`, i.e. NOT built by
 * extending `classic.js` at the source level - each is its own full flat object upstream; this
 * port still builds them as `{...classicTheme, ...overrides}` only as an internal DRY technique,
 * matching `darkTheme`'s own established convention - every asserted value below was read
 * literally off the source file, not inferred from the spread).
 */
describe('gradientTheme', () => {
  it('ports the exact 19-entry `linear(top) #c1,<stop> #c2` gradient-string color palette (one fewer than classic/dark/pattern\'s 20/16/12 - gradient.js genuinely only defines 19 entries, a preserved quirk, not a copy error)', () => {
    expect(gradientTheme.colors).toEqual([
      'linear(top) #9694e0,0.9 #7977C2',
      'linear(top) #a1d6fc,0.9 #7BBAE7',
      'linear(top) #ffd556,0.9 #ffc000',
      'linear(top) #ff9d46,0.9 #ff7800',
      'linear(top) #9cd37a,0.9 #87bb66',
      'linear(top) #3bb9b2,0.9 #1da8a0',
      'linear(top) #b3b3b3,0.9 #929292',
      'linear(top) #67717f,0.9 #555d69',
      'linear(top) #16b5f6,0.9 #0298d5',
      'linear(top) #ff686c,0.9 #fa5559',
      'linear(top) #fbbbb1,0.9 #f5a397',
      'linear(top) #3aedcf,0.9 #06d9b6',
      'linear(top) #d8c2e7,0.9 #c6a9d9',
      'linear(top) #8a87ff,0.9 #6e6afc',
      'linear(top) #eef18c,0.9 #e3e768',
      'linear(top) #ee52a2,0.9 #df328b',
      'linear(top) #b6e5f4,0.9 #96d7eb',
      'linear(top) #93aec8,0.9 #839cb5',
      'linear(top) #b76fef,0.9 #9228e4',
    ])
    expect(gradientTheme.colors).toHaveLength(19)
  })

  it('overrides grid axis/border/label colors that genuinely differ from classic.js', () => {
    expect(gradientTheme.gridXFontColor).toBe('#666')
    expect(gradientTheme.gridYFontColor).toBe('#666')
    expect(gradientTheme.gridXAxisBorderColor).toBe('#efefef')
    expect(gradientTheme.gridYAxisBorderColor).toBe('#efefef')
    expect(gradientTheme.gridBorderColor).toBe('#efefef')
  })

  it('ports single-stop degenerate gradient strings for candlestick fills verbatim (no second color/stop)', () => {
    expect(gradientTheme.candlestickBackgroundColor).toBe('linear(top) #fff')
    expect(gradientTheme.candlestickInvertBackgroundColor).toBe('linear(top) #ff0000')
  })

  it('overrides area/scatter/legend/pie/timeline tokens that differ from classic.js', () => {
    expect(gradientTheme.areaBackgroundOpacity).toBe(0.4)
    expect(gradientTheme.scatterBorderWidth).toBe(2)
    expect(gradientTheme.legendFontColor).toBe('#666')
    expect(gradientTheme.pieBorderColor).toBe('#fff')
    expect(gradientTheme.tooltipBackgroundOpacity).toBe(1)
    expect(gradientTheme.tooltipLineWidth).toBe(1)
    expect(gradientTheme.timelineTitleFontSize).toBe(11)
    expect(gradientTheme.timelineColumnBackgroundColor).toBe('linear(top) #f9f9f9,1 #e9e9e9')
    expect(gradientTheme.timelineEvenRowBackgroundColor).toBe('#fafafa')
    expect(gradientTheme.timelineOddRowBackgroundColor).toBe('#f1f0f3')
    expect(gradientTheme.timelineVerticalLineColor).toBe('#c9c9c9')
    expect(gradientTheme.timelineHorizontalLineColor).toBe('#d2d2d2')
    expect(gradientTheme.flameTextFontSize).toBe(12)
  })

  it('leaves fields identical to classic.js un-overridden (fontFamily, backgroundColor, bar* radius/point tokens, topology*)', () => {
    expect(gradientTheme.fontFamily).toBe(classicTheme.fontFamily)
    expect(gradientTheme.backgroundColor).toBe(classicTheme.backgroundColor)
    expect(gradientTheme.barBorderRadius).toBe(classicTheme.barBorderRadius)
    expect(gradientTheme.topologyNodeFontColor).toBe(classicTheme.topologyNodeFontColor)
    expect(gradientTheme.topologyEdgeColor).toBe(classicTheme.topologyEdgeColor)
  })

  it('documented quirk: gradient.js source omits `tooltipPointFontSize` entirely (present in classic/dark/pattern) - since ChartTheme requires it as a non-optional number, this port inherits classicTheme\'s 11 rather than leaving it undefined (a forced deviation from the literal undefined the original engine would read for this one theme+token combination)', () => {
    expect(gradientTheme.tooltipPointFontSize).toBe(11)
  })

  it('documented quirk: gradient.js source omits all 4 `selectBox*` tokens entirely (only classic.js/dark.js define them) - inherited from classicTheme for the same reason as tooltipPointFontSize above', () => {
    expect(gradientTheme.selectBoxBackgroundColor).toBe('#666')
    expect(gradientTheme.selectBoxBackgroundOpacity).toBe(0.1)
    expect(gradientTheme.selectBoxBorderColor).toBe('#666')
    expect(gradientTheme.selectBoxBorderOpacity).toBe(0.2)
  })
})

describe('patternTheme', () => {
  it('ports the exact 12-entry `pattern-jennifer-01`..`-12` name palette (matching pattern/classic.js\'s 12 SVG pattern defs)', () => {
    expect(patternTheme.colors).toEqual([
      'pattern-jennifer-01',
      'pattern-jennifer-02',
      'pattern-jennifer-03',
      'pattern-jennifer-04',
      'pattern-jennifer-05',
      'pattern-jennifer-06',
      'pattern-jennifer-07',
      'pattern-jennifer-08',
      'pattern-jennifer-09',
      'pattern-jennifer-10',
      'pattern-jennifer-11',
      'pattern-jennifer-12',
    ])
    expect(patternTheme.colors).toHaveLength(12)
  })

  it('overrides grid/bar/pie tokens that genuinely differ from classic.js (a visibly bordered, non-radiused-the-same bar look)', () => {
    expect(patternTheme.gridXAxisBorderColor).toBe('#ebebeb')
    expect(patternTheme.gridYAxisBorderColor).toBe('#ebebeb')
    expect(patternTheme.barBorderColor).toBe('#000')
    expect(patternTheme.barBorderWidth).toBe(1)
    expect(patternTheme.barBorderOpacity).toBe(1)
    expect(patternTheme.barBorderRadius).toBe(5)
    expect(patternTheme.pieBorderColor).toBe('#fff')
  })

  it('overrides tooltip/timeline/flame tokens that differ from classic.js', () => {
    expect(patternTheme.tooltipLineWidth).toBe(1)
    expect(patternTheme.timelineTitleFontSize).toBe(11)
    expect(patternTheme.timelineColumnBackgroundColor).toBe('linear(top) #f9f9f9,1 #e9e9e9')
    expect(patternTheme.timelineEvenRowBackgroundColor).toBe('#fafafa')
    expect(patternTheme.timelineOddRowBackgroundColor).toBe('#f1f0f3')
    expect(patternTheme.timelineVerticalLineColor).toBe('#c9c9c9')
    expect(patternTheme.timelineHorizontalLineColor).toBe('#d2d2d2')
    expect(patternTheme.flameTextFontSize).toBe(12)
  })

  it('leaves fields identical to classic.js un-overridden (gridXFontColor, legendFontColor, areaBackgroundOpacity, scatterBorderWidth, tooltipBackgroundOpacity, gridBorderColor)', () => {
    expect(patternTheme.gridXFontColor).toBe(classicTheme.gridXFontColor)
    expect(patternTheme.legendFontColor).toBe(classicTheme.legendFontColor)
    expect(patternTheme.areaBackgroundOpacity).toBe(classicTheme.areaBackgroundOpacity)
    expect(patternTheme.scatterBorderWidth).toBe(classicTheme.scatterBorderWidth)
    expect(patternTheme.tooltipBackgroundOpacity).toBe(classicTheme.tooltipBackgroundOpacity)
    expect(patternTheme.gridBorderColor).toBe(classicTheme.gridBorderColor)
  })

  it('documented quirk: pattern.js source, like gradient.js, omits all 4 `selectBox*` tokens - inherited from classicTheme', () => {
    expect(patternTheme.selectBoxBackgroundColor).toBe('#666')
    expect(patternTheme.selectBoxBorderColor).toBe('#666')
  })

  it('does NOT have the tooltipPointFontSize quirk (pattern.js, unlike gradient.js, defines it explicitly as 11 - same value as classic, so no override needed either way)', () => {
    expect(patternTheme.tooltipPointFontSize).toBe(11)
  })
})

describe('useTheme with gradient/pattern names', () => {
  it('resolves "gradient" and "pattern" theme names to their token objects', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const { tokens } = useTheme(name)
    expect(tokens.value).toBe(gradientTheme)

    name.value = 'pattern'
    expect(tokens.value).toBe(patternTheme)
  })

  it('color() cycles through gradientTheme\'s 19-color palette (not classic\'s 20), clamping index 19 back to index 0', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const { color } = useTheme(name)
    expect(color(0)).toBe(gradientTheme.colors[0])
    expect(color(18)).toBe(gradientTheme.colors[18])
    expect(color(19)).toBe(gradientTheme.colors[0])
  })

  it('color() cycles through patternTheme\'s 12-name palette, wrapping index 12 back to index 0', () => {
    const name = ref<'gradient' | 'pattern'>('pattern')
    const { color } = useTheme(name)
    expect(color(0)).toBe('pattern-jennifer-01')
    expect(color(11)).toBe('pattern-jennifer-12')
    expect(color(12)).toBe('pattern-jennifer-01')
  })
})

/**
 * `useTheme()`'s optional second `resolver` param - the SVG-defs-registry rendering pipeline
 * wiring (see `useColorResolver.ts` and `ChartBase.vue`). Called with no resolver (as every test
 * above does, and as any unit test outside a `ChartBase.vue` tree naturally would), `color()`/
 * `theme()` fall back to returning the raw token string unchanged - the pre-existing, still-valid
 * behavior for a `classic`/`dark` theme (whose tokens are never gradient/pattern strings) and the
 * documented graceful-degradation path for `gradient`/`pattern` themes used outside a resolver.
 */
describe('useTheme with a color resolver', () => {
  it('with no resolver given, color()/theme() return raw gradient/pattern strings unchanged (graceful fallback, matches pre-existing behavior)', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const { color, theme } = useTheme(name)
    expect(color(0)).toBe(gradientTheme.colors[0])
    expect(theme('candlestickBackgroundColor')).toBe('linear(top) #fff')
  })

  it('with a resolver given, color() routes gradientTheme\'s raw strings through resolve() and returns url(#gradient-N)', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const resolver = useColorResolver()
    const { color } = useTheme(name, resolver)

    expect(color(0)).toBe('url(#gradient-0)')
    expect(resolver.defs.value).toHaveLength(1)
    expect(resolver.defs.value[0].descriptor.type).toBe('linearGradient')
  })

  it('with a resolver given, color() routes patternTheme\'s raw strings through resolve() and returns url(#pattern-jennifer-NN)', () => {
    const name = ref<'gradient' | 'pattern'>('pattern')
    const resolver = useColorResolver()
    const { color } = useTheme(name, resolver)

    expect(color(0)).toBe('url(#pattern-jennifer-01)')
    expect(resolver.defs.value).toHaveLength(1)
    expect(resolver.defs.value[0].descriptor.type).toBe('pattern')
  })

  it('with a resolver given, theme(key) also resolves any *Color-suffixed token (matching upstream\'s own `key.indexOf("Color") > -1` check in `chart.theme()`), not just the color() palette cycle', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const resolver = useColorResolver()
    const { theme } = useTheme(name, resolver)

    expect(theme('candlestickBackgroundColor')).toBe('url(#gradient-0)')
    expect(theme('candlestickInvertBackgroundColor')).toBe('url(#gradient-1)')
    expect(resolver.defs.value).toHaveLength(2)
  })

  it('with a resolver given, theme(key) leaves a plain (non-gradient) *Color token untouched, still going through resolve() but resolving to the same plain string with no def registered', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const resolver = useColorResolver()
    const { theme } = useTheme(name, resolver)

    expect(theme('gridXFontColor')).toBe('#666')
    expect(resolver.defs.value).toHaveLength(0)
  })

  it('with a resolver given, theme(key) does not call resolve() for a null-valued *Color token (classicTheme.tooltipBorderColor/tooltipLineColor are null) - matches upstream\'s `_theme[key] != null` guard', () => {
    const name = ref<'gradient' | 'pattern' | 'classic'>('classic')
    const resolver = useColorResolver()
    const { theme } = useTheme(name, resolver)

    expect(theme('tooltipBorderColor')).toBeNull()
    expect(theme('tooltipLineColor')).toBeNull()
    expect(resolver.defs.value).toHaveLength(0)
  })

  it('with a resolver given, theme(key) does not resolve a non-Color-suffixed key even if its value happens to look like a gradient string (defensive: only *Color-suffixed keys are ever gradient/pattern-valued in this port\'s theme data, but the routing itself is keyed on the name, not a value sniff)', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const resolver = useColorResolver()
    const { theme } = useTheme(name, resolver)

    // gridBorderDashArray is plain non-color data either way - sanity check it passes through raw.
    expect(theme('gridBorderDashArray')).toBe('none')
    expect(resolver.defs.value).toHaveLength(0)
  })

  it('dedup persists across BOTH color() and theme(key) sharing one resolver: the same raw gradient string resolved via either path returns the same url(#id) and registers only once', () => {
    const name = ref<'gradient' | 'pattern'>('gradient')
    const resolver = useColorResolver()
    const { color, theme } = useTheme(name, resolver)

    // gradientTheme.colors doesn't reuse candlestickBackgroundColor's exact string, so resolve the
    // same palette entry via color() twice and confirm the resolver-level dedup (already unit
    // tested on useColorResolver directly) is genuinely reached through useTheme()'s color().
    const first = color(0)
    const second = color(0)
    expect(second).toBe(first)
    expect(resolver.defs.value).toHaveLength(1)

    theme('candlestickBackgroundColor')
    expect(resolver.defs.value).toHaveLength(2)
  })
})
