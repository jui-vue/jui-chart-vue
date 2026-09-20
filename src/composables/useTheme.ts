import { computed, type ComputedRef, type Ref } from 'vue'
import type { ColorResolver } from './useColorResolver'
import type { ThemeName } from '../types'

/**
 * Flat theme token objects, ported from jui-chart's `src/theme/classic.js`, `dark.js`,
 * `gradient.js` and `pattern.js` (all 4 upstream theme presets - see PORT_STATUS.md's
 * "theme/gradient.js" / "theme/pattern.js" entries for the completeness-audit writeup).
 * Trimmed to the tokens actually used by the MVP's brush types (line/area/bar/column/pie/donut)
 * plus later-ported types (scatter/bubble/rangearea/rangebar/candlestick/ratebar/bargauge/
 * fullgauge/pin/selectbox/heatmap/heatmapscatter/pyramid/arcequalizer/timeline) and widgets
 * (title/tooltip) - the originals also carry tokens for topology, treemap, map, waterfall and
 * other brush types that are out of scope for this port (see README "What's out of scope").
 *
 * **Gradient/pattern rendering pipeline (`gradientTheme`/`patternTheme` `colors` + a handful of
 * `*BackgroundColor` tokens) - IMPLEMENTED**: `gradient.js`'s `"linear(top) #c1,<stop> #c2"`
 * strings and `pattern.js`'s `"pattern-jennifer-NN"` strings are BOTH confirmed-real, actively-
 * rendered formats in upstream jui-chart - NOT decorative metadata. Traced in the compiled
 * `dist/jui-chart.js` (the parser/registry code lives in the `jui-graphics`/`jui-core` dependency
 * jui-chart bundles, not in jui-chart's own `src/`, cross-checked against jui-core's own
 * unminified `src/util/color.js`): `chart.color(index)`/`chart.theme(key)` (for any key whose
 * name contains `"Color"`) resolve through an internal `createColor()` that (a) for a
 * `"linear(...)"`/`"radial(...)"` string, calls `ColorUtil.parse()` (`parseGradient`/`parseAttr`/
 * `parseStop`) and builds a real SVG `<linearGradient>`/`<radialGradient>` def via
 * `createGradient()`, or (b) for a `"pattern-*"` string, calls `createPattern()`, which loads the
 * matching def out of `chart.pattern.<name>` (i.e. `pattern/classic.js`'s 12 `<pattern>`/base64-
 * PNG-fill defs) and injects it - either way returning a `url(#...)` reference as the resolved
 * fill.
 *
 * This port now implements the full pipeline: `colorParser.ts` (`parseGradient`/`parseAttr`/
 * `parseStop`, byte-faithful including a confirmed-real upstream bug in the stop-offset gap-fill
 * logic - see that file's own doc comment), `patternClassic.ts` (the 12 ported `pattern/
 * classic.js` defs), and `useColorResolver.ts` (the `createColor()`/`createGradient()`/
 * `createPattern()` equivalent: one instance per chart, owning a hash-dedup cache + an
 * auto-incrementing id counter + a reactive `defs` list). `color(index)` and `theme(key)` below
 * both route through a resolver's `resolve()` when one is supplied as this function's optional
 * second argument - see `ChartBase.vue` for how each top-level chart-type component (BarChart/
 * LineChart/AreaChart/etc.) creates one `useColorResolver()` per instance, hands it down to its
 * own `useTheme()` call AND to `<ChartBase :color-resolver>` as a prop, and how `ChartBase.vue`
 * renders that resolver's registered defs into a real `<defs>` element via `SvgDefNode.vue`. When
 * no resolver is given (e.g. `useTheme(name)` called directly in a unit test, or by a component
 * not yet wired into this pipeline), `color()`/`theme()` gracefully fall back to returning the raw
 * token string unchanged - the same pass-through-to-an-invalid-SVG-attribute behavior this port
 * had before this feature existed, not an error.
 *
 * **Two deliberate, documented deviations from upstream's exact dispatch behavior** - see
 * `useColorResolver.ts`'s own header doc comment for the full writeup: (1) pattern lookup skips
 * reproducing a confirmed-real upstream prefix-registry-lookup bug (`"pattern-jennifer-NN"`'s
 * `"jennifer"` prefix never actually matches the registered `"chart.pattern.classic"` module name
 * upstream) and instead indexes directly into the single ported pattern source by the trailing
 * method key; (2) gradient/pattern id numbering uses a real per-chart auto-incrementing counter
 * (`gradient-0`, `gradient-1`, ...) rather than reproducing upstream's own `_index` bug (a
 * chart-creation-order constant, never incremented per color, which would make every distinct
 * gradient in one real upstream chart collide on the same SVG `id`).
 *
 * **Still out of scope for this pass** (a deliberate, documented follow-up, not a silent gap):
 * only `ChartBase.vue`-composing chart types (Bar/Line/Area/Bubble/Candlestick/Column3D/Line3D/
 * Focus/Heatmap/EqualizerChart(SVG)/SelectBox/Pin/Scatter/RateBar/RangeBar/HeatmapScatter/
 * RangeArea) are wired to a resolver in this pass. Components with their own standalone `<svg>`
 * root (PieChart/DonutChart/TreemapChart/FlameChart/TimelineChart/PyramidChart/ArcEqualizerChart/
 * etc.) still call `useTheme(name)` with no resolver, so `theme="gradient"`/`theme="pattern"` on
 * those still renders the pre-existing raw-string/invalid-fill/black behavior - each would need
 * its own `useColorResolver()` + its own `<defs>` in its own `<svg>` root, following the exact
 * same pattern `ChartBase.vue` now uses. Canvas-backed brushes (`ChartCanvasBase.vue`-composing
 * components: `EqualizerColumnChart.vue` etc.) are out of scope entirely, not just deferred: a
 * canvas `fillStyle` cannot consume an SVG `url(#id)` reference at all - that would need an
 * entirely separate `CanvasGradient`-based implementation, unrelated to this SVG-defs pipeline.
 * See PORT_STATUS.md for the full writeup.
 *
 * `icon/classic.js` (`chart.icon.classic`) is explicitly OUT of this scope entirely, not merely
 * deferred: it is a wholly separate icon-glyph-font system (`chart.icon(key)`, driven by a
 * `_options.icon.type` chart option), confirmed via source to have zero references from either
 * `theme.js`/`gradient.js`/`pattern.js` or the theme-resolution code path above - it happens to
 * live in a sibling `icon/` directory next to `theme/`/`pattern/` but is unrelated to theming.
 */
export interface ChartTheme {
  fontFamily: string
  backgroundColor: string
  colors: string[]

  axisBackgroundColor: string
  axisBackgroundOpacity: number
  axisBorderColor: string
  axisBorderWidth: number

  gridXFontSize: number
  gridYFontSize: number
  gridXFontColor: string
  gridYFontColor: string
  gridXFontWeight: string
  gridYFontWeight: string
  gridXAxisBorderColor: string
  gridYAxisBorderColor: string
  gridXAxisBorderWidth: number
  gridYAxisBorderWidth: number
  gridPatternColor: string
  gridPatternOpacity: number
  gridBorderColor: string
  gridBorderWidth: number
  gridBorderDashArray: string
  gridBorderOpacity: number
  gridTickBorderSize: number
  gridTickBorderWidth: number
  gridTickPadding: number

  tooltipPointRadius: number
  tooltipPointBorderWidth: number
  tooltipPointFontWeight: string
  tooltipPointFontSize: number
  tooltipPointFontColor: string

  barFontSize: number
  barFontColor: string
  barBorderColor: string
  barBorderWidth: number
  barBorderOpacity: number
  barBorderRadius: number
  barPointBorderColor: string
  barDisableBackgroundOpacity: number

  /** `ratebar.js`'s own token set - genuinely distinct from `bar*`/`stackBar*` (no shared setup
   * chain, see `RateBarChart.vue`'s header comment) - confirmed via grep only these fields are
   * ever read by `ratebar.js`'s `getBarStyle()` (the source theme also carries an unused
   * `rateBarBorderOpacity`, dropped here per this file's own "trimmed to tokens actually used"
   * convention). */
  rateBarFontSize: number
  rateBarFontColor: string
  rateBarBorderColor: string
  rateBarBorderWidth: number
  rateBarBorderRadius: number
  rateBarDisableBackgroundOpacity: number
  rateBarTooltipFontSize: number
  rateBarTooltipFontColor: string
  rateBarTooltipBackgroundColor: string
  rateBarTooltipBorderColor: string

  /** `pin.js`'s own tokens (all 4 confirmed actually read from `draw()` - see `PinChart.vue`). */
  pinFontColor: string
  pinFontSize: number
  pinBorderColor: string
  pinBorderWidth: number

  /** `selectbox.js`'s own tokens - background/border only show on hover (see `SelectBoxChart.vue`). */
  selectBoxBackgroundColor: string
  selectBoxBackgroundOpacity: number
  selectBoxBorderColor: string
  selectBoxBorderOpacity: number

  /** `heatmap.js`'s own tokens (all 8 confirmed actually read from `draw()` - see
   * `HeatmapChart.vue`). `heatmapBackgroundColor` doubles as the "none"-sentinel/no-`colors`-prop
   * fallback fill (see `useColorScale.ts`'s header comment on why this port's `colors` stays a
   * plain array, not the source's own color-`function` mode). */
  heatmapBackgroundColor: string
  heatmapBackgroundOpacity: number
  heatmapHoverBackgroundOpacity: number
  heatmapBorderColor: string
  heatmapBorderWidth: number
  heatmapBorderOpacity: number
  heatmapFontSize: number
  heatmapFontColor: string

  /** `heatmapscatter.js`'s own tokens - **only these 2 are actually read** (confirmed via a full
   * read of the 152-line source): the theme file also carries an unused
   * `heatmapscatterActiveBackgroundColor` (no `active`/hover-recolor concept exists anywhere in
   * `heatmapscatter.js`'s `draw()`/`createScatter()` - grepped the whole file for "theme(" to
   * confirm), dropped here per this file's own "trimmed to tokens actually used" convention
   * (matching `fullgauge.js`'s/`bargauge.js`'s own precedent for the same kind of unused token). */
  heatmapscatterBorderColor: string
  heatmapscatterBorderWidth: number

  pieBorderColor: string
  pieBorderWidth: number
  pieOuterFontSize: number
  pieOuterFontColor: string
  pieOuterLineColor: string
  pieOuterLineSize: number
  pieOuterLineRate: number
  pieOuterLineWidth: number
  pieInnerFontSize: number
  pieInnerFontColor: string
  pieActiveDistance: number
  pieNoDataBackgroundColor: string
  pieTotalValueFontSize: number
  pieTotalValueFontColor: string
  pieTotalValueFontWeight: string
  pieDisableBackgroundOpacity: number

  /** `pyramid.js`'s own tokens (all 7 confirmed actually read from `draw()`/`createText()` - see
   * `usePyramid.ts`/`PyramidChart.vue`). No fill-color token - segment fill is `this.color(i)`,
   * the theme palette cycle, same as `PieChart`/`BarGaugeChart`. */
  pyramidLineColor: string
  pyramidLineWidth: number
  pyramidTextLineColor: string
  pyramidTextLineWidth: number
  pyramidTextLineSize: number
  pyramidTextFontSize: number
  pyramidTextFontColor: string

  /** `bargauge.js`'s own tokens (all 3 confirmed actually referenced - see `useGauge.ts`). */
  bargaugeBackgroundColor: string
  bargaugeFontSize: number
  bargaugeFontColor: string

  /** `arcequalizer.js`'s own tokens (all 5 confirmed actually read from `draw()` - see
   * `useArcEqualizer.ts`/`ArcEqualizerChart.vue`). No per-target fill-color token - each row's
   * per-target blocks are filled with `this.color(j)`, the series color cycle, same convention as
   * `PieChart`/`BarGaugeChart`/`PyramidChart`; `arcEqualizerBackgroundColor` is instead the
   * "no data" placeholder fill (`dataCount == 0` branch - see `useArcEqualizer.ts`'s doc comment),
   * analogous to `pieNoDataBackgroundColor`. */
  arcEqualizerBorderColor: string
  arcEqualizerBorderWidth: number
  arcEqualizerFontSize: number
  arcEqualizerFontColor: string
  arcEqualizerBackgroundColor: string

  /**
   * `fullgauge.js`'s tokens. **Confirmed from source only these 5 are actually read**
   * (`gaugeBackgroundColor`/`gaugeFontSize`/`gaugeFontWeight`/`gaugeTitleFontSize`/
   * `gaugeTitleFontWeight`/`gaugeTitleFontColor`/`gaugePaddingAngle` = 7 total below) - the
   * original theme files also carry `gaugeArrowColor` (no needle/pointer exists in `fullgauge.js`
   * to color) and `gaugeFontColor` (the value text's fill is `this.color(index)`, the series
   * color, NOT this token - only the separate title label uses `gaugeTitleFontColor`), both
   * dropped here per this file's "trimmed to tokens actually used" convention.
   */
  gaugeBackgroundColor: string
  gaugeFontSize: number
  gaugeFontWeight: string
  gaugeTitleFontSize: number
  gaugeTitleFontWeight: string
  gaugeTitleFontColor: string
  gaugePaddingAngle: number

  areaBackgroundOpacity: number

  scatterBorderColor: string
  scatterBorderWidth: number
  scatterHoverColor: string

  bubbleBackgroundOpacity: number
  bubbleBorderWidth: number
  bubbleFontSize: number
  bubbleFontColor: string

  /** `bubblecloud.js`'s own tokens - identical across every upstream theme (`classic`/`dark`/
   *  `gradient`/`pattern`.js all define `#fff`/`11`/`"bold"`), so only `classicTheme` sets them;
   *  `darkTheme` inherits via its `...classicTheme` spread, matching source having no per-theme
   *  override at all. */
  bubbleCloudFontColor: string
  bubbleCloudFontSize: number
  bubbleCloudFontWeight: string

  /** `brush/canvas/equalizercolumn.js`'s own error-flag tokens - identical across every upstream
   *  theme (`classic`/`dark`/`gradient`/`pattern`.js all define `#ff0000`/`#fff`), so only
   *  `classicTheme` sets them; `darkTheme` inherits via its `...classicTheme` spread, matching
   *  source having no per-theme override at all (same convention as `bubbleCloudFont*` above). */
  equalizerColumnErrorBackgroundColor: string
  equalizerColumnErrorFontColor: string

  /** `brush/polygon/column3d.js`/`line3d.js`'s own tokens - confirmed identical across every
   *  upstream theme (`classic`/`dark`/`gradient`/`pattern`.js all define the same 4 numbers:
   *  0.6/0.5/0.6/0.7), so only `classicTheme` sets them; `darkTheme` inherits via its
   *  `...classicTheme` spread (same convention as `bubbleCloudFont*`/`equalizerColumnError*`
   *  above). Each `*BorderOpacity` is reused BOTH as a `ColorUtil.darken()` rate AND as the
   *  stroke's own `stroke-opacity` - see `darkenColor()`'s doc comment in `usePolygon3d.ts`. */
  polygonColumnBackgroundOpacity: number
  polygonColumnBorderOpacity: number
  polygonLineBackgroundOpacity: number
  polygonLineBorderOpacity: number

  lineBorderWidth: number
  lineBorderDashArray: string
  lineBorderOpacity: number
  lineDisableBorderOpacity: number
  linePointBorderColor: string

  /** Bullish (close >= open) candle border/fill - `candlestick.js`'s "else" (non-invert) branch. */
  candlestickBorderColor: string
  candlestickBackgroundColor: string
  /** Bearish (open > close) candle border/fill - `candlestick.js`'s `if (open > close)` branch. */
  candlestickInvertBorderColor: string
  candlestickInvertBackgroundColor: string

  titleFontColor: string
  titleFontSize: number
  titleFontWeight: string

  /** `legend.js`'s own tokens - only 3 of the 4 upstream tokens are used by `ChartLegend.vue`:
   * `legendSwitchCircleColor` (the pill-switch's own white knob fill, only ever used by source's
   * `filter:true` toggle-switch swatch shape) is dropped, matching this file's "trimmed to tokens
   * actually used" convention - see `ChartLegend.vue`'s header comment for why this port's
   * click-to-toggle swatch uses a plain dimmed/undimmed circle instead of literally porting the
   * sliding pill-switch visual. */
  legendFontColor: string
  legendFontSize: number
  legendSwitchDisableColor: string

  tooltipFontColor: string
  tooltipFontSize: number
  tooltipBackgroundColor: string
  tooltipBackgroundOpacity: number
  tooltipBorderColor: string | null
  tooltipBorderWidth: number
  tooltipLineColor: string | null
  tooltipLineWidth: number

  /** `guideline.js`'s own line/point tokens (confirmed actually read from `drawBefore()`) - the
   * `guidelineTooltip*`/`guidelineBalloon*` upstream tokens are NOT ported: `LineChart.vue`'s
   * `guideline` prop reuses `ChartTooltip`'s existing `tooltip*` tokens for its multi-series value
   * box instead of a second, near-identical token set - see that prop's own doc comment. */
  guidelineBorderColor: string
  guidelineBorderWidth: number
  guidelineBorderOpacity: number
  guidelineBorderDashArray: string
  guidelinePointRadius: number
  guidelinePointBorderColor: string
  guidelinePointBorderWidth: number

  /** `cross.js`'s own line tokens (confirmed actually read from `drawBefore()`) - like
   * `guideline` above, the upstream `crossBalloon*` tokens are NOT ported: `LineChart.vue`'s
   * `crosshair` prop reuses `ChartTooltip`'s `tooltip*` tokens for its axis-value readout instead. */
  crossBorderColor: string
  crossBorderWidth: number
  crossBorderOpacity: number

  /** `zoom.js`'s own tokens (both confirmed actually read from `drawSection()`) - `LineChart.vue`'s
   * `zoomable` prop. Identical across all 4 theme files upstream (classic/dark/pattern/gradient),
   * so `darkTheme` doesn't override either (same convention as `focus*`/`guideline*` above). */
  zoomBackgroundColor: string
  zoomFocusColor: string

  /** `zoomscroll.js`'s own tokens (all 11 confirmed actually read from `drawBefore()`/`draw()`/
   * `createChartImage()`) - `LineChart.vue`'s `zoomScrollable` prop's dimmed-zone rects/embedded
   * thumbnail chart. Identical across all 4 theme files upstream (classic/dark/pattern/gradient),
   * so `darkTheme` doesn't override any (same convention as `zoom*`/`dragSelect*` above). The
   * handle-button fill (`#e0e0e0`)/stroke (`#616161`) are hardcoded literals in source itself (no
   * `zoomScroll*` token governs them) - kept as literals in `LineChart.vue` rather than invented as
   * new tokens, matching source exactly. */
  zoomScrollBackgroundSize: number
  zoomScrollButtonSize: number
  zoomScrollAreaBackgroundColor: string
  zoomScrollAreaBackgroundOpacity: number
  zoomScrollAreaBorderColor: string
  zoomScrollAreaBorderWidth: number
  zoomScrollAreaBorderRadius: number
  zoomScrollGridFontSize: number
  zoomScrollGridTickPadding: number
  zoomScrollBrushAreaBackgroundOpacity: number
  zoomScrollBrushLineBorderWidth: number

  /** `dragselect.js`'s own tokens (all 4 confirmed actually read from `draw()` - `LineChart.vue`'s
   * `dragSelect` prop's rubber-band rect). Identical across all 4 theme files upstream (classic/
   * dark/pattern/gradient), so `darkTheme` doesn't override any (same convention as `zoom*`/
   * `focus*`/`guideline*` above). */
  dragSelectBorderColor: string
  dragSelectBorderWidth: number
  dragSelectBackgroundColor: string
  dragSelectBackgroundOpacity: number

  /** `scroll.js`/`vscroll.js`'s own tokens (all 4 confirmed actually read from `draw()` - the SAME
   * 4 keys are read by BOTH files, confirmed from source: `vscroll.js` never defines its own
   * `vscroll*` family, it reads the identical `scrollBackgroundSize`/`scrollBackgroundColor`/
   * `scrollThumbBackgroundColor`/`scrollThumbBorderColor` tokens `scroll.js` does - see
   * `LineChart.vue`'s `scrollable`/`vScrollable` props). **Unlike `zoom*`/`dragSelect*` above,
   * these DO differ in `darkTheme`** (confirmed against all 4 theme files upstream -
   * `scrollBackgroundSize` is `7` everywhere, but `scrollBackgroundColor`/`scrollThumbBackgroundColor`/
   * `scrollThumbBorderColor` each have a distinct dark-mode value), so `darkTheme` below overrides
   * the 3 color tokens (not the size). */
  scrollBackgroundSize: number
  scrollBackgroundColor: string
  scrollThumbBackgroundColor: string
  scrollThumbBorderColor: string

  /** `timeline.js`'s own tokens (all 20 confirmed actually read from `draw()`/`drawGrid()`/
   * `drawLine()`/`drawData()` - see `useTimeline.ts`/`TimelineChart.vue`). `timelineHoverBarBackgroundColor`
   * is `null` in both themes upstream (a confirmed dead-by-default path in `activeType="bar"`
   * mode's hover recolor - see `timelineBarFillMode`'s doc comment). */
  timelineTitleFontSize: number
  timelineTitleFontColor: string
  /** `700` in both themes upstream (a numeric CSS font-weight, not a keyword like `titleFontWeight`'s `'normal'`). */
  timelineTitleFontWeight: number
  timelineColumnFontSize: number
  timelineColumnFontColor: string
  timelineColumnBackgroundColor: string
  timelineHoverRowBackgroundColor: string
  timelineEvenRowBackgroundColor: string
  timelineOddRowBackgroundColor: string
  timelineActiveBarBackgroundColor: string
  timelineActiveBarFontColor: string
  timelineActiveBarFontSize: number
  timelineHoverBarBackgroundColor: string | null
  timelineLayerBackgroundOpacity: number
  timelineActiveLayerBackgroundColor: string
  timelineActiveLayerBorderColor: string
  timelineHoverLayerBackgroundColor: string
  timelineHoverLayerBorderColor: string
  timelineVerticalLineColor: string
  timelineHorizontalLineColor: string

  /** `focus.js`'s own tokens (all 4 confirmed actually read from `drawFocus()` - see
   * `FocusChart.vue`/`useFocus.ts`). Identical between `classic.js`/`dark.js` upstream, so
   * `darkTheme` doesn't override any of them (same convention as leaving an unchanged token out
   * of the `darkTheme` spread below). */
  focusBorderColor: string
  focusBorderWidth: number
  focusBackgroundColor: string
  focusBackgroundOpacity: number

  /** `flame.js`'s own tokens (all 5 confirmed actually read from `createNodeElement()`/
   * `createTextElement()`/`drawBefore()` - see `useFlame.ts`/`FlameChart.vue`).
   * `flameNodeBorderColor` doubles as the hover-restore color (the border tints to the node's own
   * fill color on hover, then reverts to this token on mouseout). */
  flameNodeBorderColor: string
  flameNodeBorderWidth: number
  /** `disableOpacity` for a zoomed-out (`activeIndex`) node's dimmed ancestor chain - see
   * `flameNodeOpacity()`. */
  flameDisableBackgroundOpacity: number
  flameTextFontSize: number
  flameTextFontColor: string

  /** `treemap.js`'s own tokens (all 6 confirmed actually read from `createTitleDepth()`/`draw()` -
   * see `useTreemap.ts`/`TreemapChart.vue`). */
  treemapNodeBorderColor: string
  treemapNodeBorderWidth: number
  treemapTextFontSize: number
  treemapTextFontColor: string
  treemapTitleFontSize: number
  treemapTitleFontColor: string

  /** `topologynode.js`'s own tokens (all 19 confirmed actually read from `getNodeRadius()`/
   * `createNodes()`/`createEdgeLine()`/`createEdgeText()`/`onNodeActiveHandler()`/
   * `onEdgeMouseOverHandler()`/`showTooltip()`/`drawBefore()` - see `useTopology.ts`/
   * `TopologyChart.vue`). */
  topologyNodeRadius: number
  topologyNodeFontSize: number
  topologyNodeFontColor: string
  topologyNodeTitleFontSize: number
  topologyNodeTitleFontColor: string
  topologyEdgeWidth: number
  topologyActiveEdgeWidth: number
  topologyHoverEdgeWidth: number
  topologyEdgeColor: string
  topologyActiveEdgeColor: string
  topologyHoverEdgeColor: string
  topologyEdgeFontSize: number
  topologyEdgeFontColor: string
  topologyEdgePointRadius: number
  topologyEdgeOpacity: number
  topologyTooltipBackgroundColor: string
  topologyTooltipBorderColor: string
  topologyTooltipFontSize: number
  topologyTooltipFontColor: string
}

const classicColors = [
  '#7977C2', '#7BBAE7', '#FFC000', '#FF7800', '#87BB66', '#1DA8A0', '#929292', '#555D69',
  '#0298D5', '#FA5559', '#F5A397', '#06D9B6', '#C6A9D9', '#6E6AFC', '#E3E766', '#C57BC3',
  '#DF328B', '#96D7EB', '#839CB5', '#9228E4',
]

const darkColors = [
  '#12f2e8', '#26f67c', '#e9f819', '#b78bf9', '#f94590', '#8bccf9', '#9228e4', '#06d9b6',
  '#fc6d65', '#f199ff', '#c8f21d', '#16a6e5', '#00ba60', '#91f2a1', '#fc9765', '#f21d4f',
]

/**
 * Ported from `theme/gradient.js`'s `themeColors` verbatim - 19 entries (one fewer than
 * `classicColors`'/`darkColors`' 20/16, and `patternColors`' 12), each a
 * `"linear(top) #c1,<stop> #c2"` gradient-string, jui-chart's own mini gradient-color DSL (see
 * `ColorUtil.parseGradient`/`parseAttr`/`parseStop` in the upstream `jui-graphics`/`jui-core`
 * dependency the compiled `dist/jui-chart.js` bundles - confirmed a REAL, actively-parsed format,
 * not decorative metadata: `chart.color(index)` -> `createColor()` -> `ColorUtil.parse()` ->
 * `createGradient()` builds an actual SVG `<linearGradient>` def and returns `url(#gradient-N)`
 * as the resolved fill). See this file's own header doc comment ("Theme scope boundary" section
 * below `ChartTheme`) for why this port still stores these as opaque strings rather than also
 * porting that parser + defs-registry pipeline.
 */
const gradientColors = [
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
]

/**
 * Ported from `theme/pattern.js`'s `themeColors` verbatim - 12 `"pattern-jennifer-NN"` name
 * strings, one per SVG `<pattern>` def in `pattern/classic.js` (confirmed a REAL, actively-
 * resolved format upstream: `chart.color(index)` -> `createColor()` -> `createPattern()` looks
 * the name up as `jui.include("chart.pattern." + name)`, converts that JSON pattern def to a real
 * SVG element, injects it into the chart's `<defs>`, and returns `url(#pattern-jennifer-NN)` as
 * the resolved fill - NOT decorative). See this file's "Theme scope boundary" doc comment below
 * for why this port stores these as opaque strings without also porting `pattern/classic.js`'s
 * SVG defs + the defs-registry/lookup pipeline that would make them actually render as patterns.
 */
const patternColors = [
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
]

export const classicTheme: ChartTheme = {
  fontFamily: 'arial,Tahoma,verdana',
  backgroundColor: '#fff',
  colors: classicColors,

  axisBackgroundColor: '#fff',
  axisBackgroundOpacity: 0,
  axisBorderColor: '#fff',
  axisBorderWidth: 0,

  gridXFontSize: 11,
  gridYFontSize: 11,
  gridXFontColor: '#333',
  gridYFontColor: '#333',
  gridXFontWeight: 'normal',
  gridYFontWeight: 'normal',
  gridXAxisBorderColor: '#bfbfbf',
  gridYAxisBorderColor: '#bfbfbf',
  gridXAxisBorderWidth: 2,
  gridYAxisBorderWidth: 2,
  gridPatternColor: '#ababab',
  gridPatternOpacity: 0.1,
  gridBorderColor: '#ebebeb',
  gridBorderWidth: 1,
  gridBorderDashArray: 'none',
  gridBorderOpacity: 1,
  gridTickBorderSize: 3,
  gridTickBorderWidth: 1.5,
  gridTickPadding: 5,

  tooltipPointRadius: 5,
  tooltipPointBorderWidth: 1,
  tooltipPointFontWeight: 'bold',
  tooltipPointFontSize: 11,
  tooltipPointFontColor: '#333',

  barFontSize: 11,
  barFontColor: '#333',
  barBorderColor: 'none',
  barBorderWidth: 0,
  barBorderOpacity: 0,
  barBorderRadius: 3,
  barPointBorderColor: '#fff',
  barDisableBackgroundOpacity: 0.4,

  rateBarFontSize: 11,
  rateBarFontColor: '#333',
  rateBarBorderColor: 'none',
  rateBarBorderWidth: 0,
  rateBarBorderRadius: 5,
  rateBarDisableBackgroundOpacity: 0.7,
  rateBarTooltipFontSize: 10,
  rateBarTooltipFontColor: '#333',
  rateBarTooltipBackgroundColor: '#fff',
  rateBarTooltipBorderColor: '#666666',

  pinFontColor: '#FF7800',
  pinFontSize: 10,
  pinBorderColor: '#FF7800',
  pinBorderWidth: 0.7,

  selectBoxBackgroundColor: '#666',
  selectBoxBackgroundOpacity: 0.1,
  selectBoxBorderColor: '#666',
  selectBoxBorderOpacity: 0.2,

  heatmapBackgroundColor: '#fff',
  heatmapBackgroundOpacity: 1,
  heatmapHoverBackgroundOpacity: 0.2,
  heatmapBorderColor: '#000',
  heatmapBorderWidth: 0.5,
  heatmapBorderOpacity: 1,
  heatmapFontSize: 11,
  heatmapFontColor: '#000',

  heatmapscatterBorderColor: '#fff',
  heatmapscatterBorderWidth: 0.5,

  pieBorderColor: '#ececec',
  pieBorderWidth: 1,
  pieOuterFontSize: 11,
  pieOuterFontColor: '#333',
  pieOuterLineColor: '#a9a9a9',
  pieOuterLineSize: 8,
  pieOuterLineRate: 1.3,
  pieOuterLineWidth: 0.7,
  pieInnerFontSize: 11,
  pieInnerFontColor: '#333',
  pieActiveDistance: 5,
  pieNoDataBackgroundColor: '#E9E9E9',
  pieTotalValueFontSize: 36,
  pieTotalValueFontColor: '#dcdcdc',
  pieTotalValueFontWeight: 'bold',
  pieDisableBackgroundOpacity: 0.5,

  pyramidLineColor: '#fff',
  pyramidLineWidth: 1,
  pyramidTextLineColor: '#a9a9a9',
  pyramidTextLineWidth: 1,
  pyramidTextLineSize: 30,
  pyramidTextFontSize: 10,
  pyramidTextFontColor: '#333',

  bargaugeBackgroundColor: '#ececec',
  bargaugeFontSize: 11,
  bargaugeFontColor: '#333333',

  arcEqualizerBorderColor: '#fff',
  arcEqualizerBorderWidth: 1,
  arcEqualizerFontSize: 13,
  arcEqualizerFontColor: '#333',
  arcEqualizerBackgroundColor: '#a9a9a9',

  gaugeBackgroundColor: '#ececec',
  gaugeFontSize: 20,
  gaugeFontWeight: 'bold',
  gaugeTitleFontSize: 12,
  gaugeTitleFontWeight: 'normal',
  gaugeTitleFontColor: '#333',
  gaugePaddingAngle: 2,

  areaBackgroundOpacity: 0.5,

  scatterBorderColor: '#fff',
  scatterBorderWidth: 1,
  scatterHoverColor: '#fff',

  bubbleBackgroundOpacity: 0.5,
  bubbleBorderWidth: 1,
  bubbleFontSize: 12,
  bubbleFontColor: '#fff',

  bubbleCloudFontColor: '#fff',
  bubbleCloudFontSize: 11,
  bubbleCloudFontWeight: 'bold',

  equalizerColumnErrorBackgroundColor: '#ff0000',
  equalizerColumnErrorFontColor: '#fff',

  polygonColumnBackgroundOpacity: 0.6,
  polygonColumnBorderOpacity: 0.5,
  polygonLineBackgroundOpacity: 0.6,
  polygonLineBorderOpacity: 0.7,

  lineBorderWidth: 2,
  lineBorderDashArray: 'none',
  lineBorderOpacity: 1,
  lineDisableBorderOpacity: 0.3,
  linePointBorderColor: '#fff',

  candlestickBorderColor: '#000',
  candlestickBackgroundColor: '#fff',
  candlestickInvertBorderColor: '#ff0000',
  candlestickInvertBackgroundColor: '#ff0000',

  titleFontColor: '#333',
  titleFontSize: 13,
  titleFontWeight: 'normal',

  legendFontColor: '#333',
  legendFontSize: 12,
  legendSwitchDisableColor: '#c8c8c8',

  tooltipFontColor: '#333',
  tooltipFontSize: 12,
  tooltipBackgroundColor: '#fff',
  tooltipBackgroundOpacity: 0.7,
  tooltipBorderColor: null,
  tooltipBorderWidth: 2,
  tooltipLineColor: null,
  tooltipLineWidth: 0.7,

  guidelineBorderColor: '#a9a9a9',
  guidelineBorderWidth: 1,
  guidelineBorderOpacity: 0.8,
  guidelineBorderDashArray: '2,2',
  guidelinePointRadius: 3,
  guidelinePointBorderColor: '#fff',
  guidelinePointBorderWidth: 1,

  crossBorderColor: '#a9a9a9',
  crossBorderWidth: 1,
  crossBorderOpacity: 0.8,

  zoomBackgroundColor: '#ff0000',
  zoomFocusColor: '#808080',

  zoomScrollBackgroundSize: 45,
  zoomScrollButtonSize: 18,
  zoomScrollAreaBackgroundColor: '#fff',
  zoomScrollAreaBackgroundOpacity: 0.7,
  zoomScrollAreaBorderColor: '#d4d4d4',
  zoomScrollAreaBorderWidth: 1,
  zoomScrollAreaBorderRadius: 3,
  zoomScrollGridFontSize: 10,
  zoomScrollGridTickPadding: 4,
  zoomScrollBrushAreaBackgroundOpacity: 0.7,
  zoomScrollBrushLineBorderWidth: 1,

  dragSelectBorderColor: '#7BBAE7',
  dragSelectBorderWidth: 1,
  dragSelectBackgroundColor: '#7BBAE7',
  dragSelectBackgroundOpacity: 0.3,

  scrollBackgroundSize: 7,
  scrollBackgroundColor: '#dcdcdc',
  scrollThumbBackgroundColor: '#b2b2b2',
  scrollThumbBorderColor: '#9f9fa4',

  timelineTitleFontSize: 10,
  timelineTitleFontColor: '#333',
  timelineTitleFontWeight: 700,
  timelineColumnFontSize: 10,
  timelineColumnFontColor: '#333',
  timelineColumnBackgroundColor: '#fff',
  timelineHoverRowBackgroundColor: '#f4f0f9',
  timelineEvenRowBackgroundColor: '#f8f8f8',
  timelineOddRowBackgroundColor: '#fff',
  timelineActiveBarBackgroundColor: '#9262cf',
  timelineActiveBarFontColor: '#fff',
  timelineActiveBarFontSize: 9,
  timelineHoverBarBackgroundColor: null,
  timelineLayerBackgroundOpacity: 0.15,
  timelineActiveLayerBackgroundColor: '#A75CFF',
  timelineActiveLayerBorderColor: '#caa4f5',
  timelineHoverLayerBackgroundColor: '#DEC2FF',
  timelineHoverLayerBorderColor: '#caa4f5',
  timelineVerticalLineColor: '#f0f0f0',
  timelineHorizontalLineColor: '#ddd',

  focusBorderColor: '#FF7800',
  focusBorderWidth: 1,
  focusBackgroundColor: '#FF7800',
  focusBackgroundOpacity: 0.1,

  flameNodeBorderColor: '#fff',
  flameNodeBorderWidth: 0.5,
  flameDisableBackgroundOpacity: 0.4,
  flameTextFontSize: 11,
  flameTextFontColor: '#333',

  treemapNodeBorderColor: '#333',
  treemapNodeBorderWidth: 0.5,
  treemapTextFontSize: 11,
  treemapTextFontColor: '#333',
  treemapTitleFontSize: 12,
  treemapTitleFontColor: '#333',

  topologyNodeRadius: 12.5,
  topologyNodeFontSize: 14,
  topologyNodeFontColor: '#fff',
  topologyNodeTitleFontSize: 11,
  topologyNodeTitleFontColor: '#333',
  topologyEdgeWidth: 1,
  topologyActiveEdgeWidth: 2,
  topologyHoverEdgeWidth: 2,
  topologyEdgeColor: '#b2b2b2',
  topologyActiveEdgeColor: '#905ed1',
  topologyHoverEdgeColor: '#d3bdeb',
  topologyEdgeFontSize: 10,
  topologyEdgeFontColor: '#666',
  topologyEdgePointRadius: 3,
  topologyEdgeOpacity: 1,
  topologyTooltipBackgroundColor: '#fff',
  topologyTooltipBorderColor: '#ccc',
  topologyTooltipFontSize: 11,
  topologyTooltipFontColor: '#333',
}

export const darkTheme: ChartTheme = {
  ...classicTheme,
  fontFamily: 'arial,Tahoma,verdana',
  backgroundColor: '#222222',
  colors: darkColors,

  axisBackgroundColor: '#222222',
  axisBorderColor: '#222222',

  gridXFontColor: '#868686',
  gridYFontColor: '#868686',
  gridXAxisBorderColor: '#464646',
  gridYAxisBorderColor: '#464646',
  gridBorderColor: '#868686',

  tooltipPointFontColor: '#868686',

  barFontColor: '#868686',

  rateBarFontColor: '#868686',
  rateBarTooltipFontColor: '#868686',
  rateBarTooltipBackgroundColor: '#222',

  bargaugeBackgroundColor: '#3e3e3e',
  bargaugeFontColor: '#c5c5c5',

  arcEqualizerBorderColor: '#222222',
  arcEqualizerFontColor: '#868686',
  arcEqualizerBackgroundColor: '#222222',

  gaugeBackgroundColor: '#3e3e3e',
  gaugeTitleFontColor: '#c5c5c5',

  selectBoxBackgroundColor: '#fff',
  selectBoxBorderColor: '#fff',

  heatmapBackgroundColor: '#222222',
  heatmapBorderColor: '#fff',
  heatmapFontColor: '#868686',

  heatmapscatterBorderColor: '#222222',

  pieBorderColor: '#232323',
  pieOuterFontColor: '#868686',
  pieInnerFontColor: '#868686',

  pyramidLineColor: '#464646',
  pyramidTextLineColor: '#B2A6A6',
  pyramidTextFontColor: '#222',

  scatterBorderColor: 'none',
  scatterHoverColor: '#222222',

  bubbleFontColor: '#868686',

  candlestickBorderColor: '#14be9d',
  candlestickBackgroundColor: '#14be9d',
  candlestickInvertBorderColor: '#ff4848',
  candlestickInvertBackgroundColor: '#ff4848',

  titleFontColor: '#ffffff',
  titleFontSize: 14,

  legendFontColor: '#ffffff',
  legendFontSize: 11,

  tooltipFontColor: '#333333',
  tooltipBackgroundOpacity: 1,
  tooltipLineWidth: 1,

  scrollBackgroundColor: '#3e3e3e',
  scrollThumbBackgroundColor: '#666666',
  scrollThumbBorderColor: '#686868',

  timelineTitleFontSize: 11,
  timelineTitleFontColor: '#d5d5d5',
  timelineColumnFontColor: '#d5d5d5',
  timelineColumnBackgroundColor: '#1c1c1c',
  timelineHoverRowBackgroundColor: '#2f2f2f',
  timelineEvenRowBackgroundColor: '#202020',
  timelineOddRowBackgroundColor: '#1c1c1c',
  timelineActiveBarBackgroundColor: '#6f32ba',
  timelineLayerBackgroundOpacity: 0.1,
  timelineActiveLayerBackgroundColor: '#7F5FA4',
  timelineActiveLayerBorderColor: '#7f5fa4',
  timelineHoverLayerBackgroundColor: '#7F5FA4',
  timelineHoverLayerBorderColor: '#7f5fa4',
  timelineVerticalLineColor: '#2f2f2f',
  timelineHorizontalLineColor: '#4d4d4d',

  flameNodeBorderColor: '#222',
  flameTextFontSize: 12,
  flameTextFontColor: '#868686',

  treemapNodeBorderColor: '#222222',
  treemapTextFontColor: '#868686',
  treemapTitleFontColor: '#868686',

  topologyNodeFontColor: '#c5c5c5',
  topologyNodeTitleFontColor: '#c5c5c5',
  topologyEdgeColor: '#b2b2b2',
  topologyActiveEdgeColor: '#905ed1',
  topologyHoverEdgeColor: '#d3bdeb',
  topologyEdgeFontColor: '#c5c5c5',
  topologyTooltipBackgroundColor: '#222222',
  topologyTooltipBorderColor: '#ccc',
  topologyTooltipFontColor: '#c5c5c5',
}

/**
 * Ported from `theme/gradient.js`. Upstream declares `extend: null` (like every theme file, it is
 * its own full flat object, never literally built by extending `classic.js`) - this port still
 * builds it as `{...classicTheme, ...overrides}` purely as an internal DRY technique, matching
 * `darkTheme`'s own established convention; every value below (including the ones NOT re-listed
 * here because they equal `classicTheme`'s) was individually hand-traced against `gradient.js`,
 * not inferred from the spread.
 *
 * Two source quirks, preserved deliberately rather than silently "fixed":
 * - `gradient.js` omits `tooltipPointFontSize` entirely (present in `classic`/`dark`/`pattern`).
 *   In the original engine this makes `theme("tooltipPointFontSize")` resolve to `undefined` when
 *   this theme is active. `ChartTheme` requires it as a non-optional `number`, so this port
 *   inherits `classicTheme`'s `11` via the spread instead - a forced deviation from that literal
 *   `undefined`, not a faithful reproduction of it.
 * - `gradient.js` omits all 4 `selectBox*` tokens entirely (only `classic.js`/`dark.js` define
 *   them - `selectbox.js` postdates `gradient.js`/`pattern.js`, or they were simply never
 *   updated). Same treatment: inherited from `classicTheme` for the same non-optional-field reason.
 */
export const gradientTheme: ChartTheme = {
  ...classicTheme,
  colors: gradientColors,

  gridXFontColor: '#666',
  gridYFontColor: '#666',
  gridXAxisBorderColor: '#efefef',
  gridYAxisBorderColor: '#efefef',
  gridBorderColor: '#efefef',

  pieBorderColor: '#fff',

  areaBackgroundOpacity: 0.4,

  scatterBorderWidth: 2,

  /** `candlestick.js`'s "else"/bullish fill - a degenerate single-stop gradient string (no second
   * color), ported verbatim rather than "corrected" to a plain `"#fff"`. */
  candlestickBackgroundColor: 'linear(top) #fff',
  /** `candlestick.js`'s `open > close`/bearish fill - same single-stop-gradient quirk. */
  candlestickInvertBackgroundColor: 'linear(top) #ff0000',

  legendFontColor: '#666',

  tooltipBackgroundOpacity: 1,
  tooltipLineWidth: 1,

  timelineTitleFontSize: 11,
  timelineColumnBackgroundColor: 'linear(top) #f9f9f9,1 #e9e9e9',
  timelineEvenRowBackgroundColor: '#fafafa',
  timelineOddRowBackgroundColor: '#f1f0f3',
  timelineVerticalLineColor: '#c9c9c9',
  timelineHorizontalLineColor: '#d2d2d2',

  flameTextFontSize: 12,
}

/**
 * Ported from `theme/pattern.js`. Same `{...classicTheme, ...overrides}` DRY convention as
 * `gradientTheme`/`darkTheme` above (upstream is its own full flat object, `extend: null`).
 *
 * One source quirk shared with `gradient.js`, preserved deliberately: `pattern.js` also omits all
 * 4 `selectBox*` tokens entirely - inherited from `classicTheme` for the same non-optional-field
 * reason documented on `gradientTheme` above. Unlike `gradient.js`, `pattern.js` does NOT omit
 * `tooltipPointFontSize` (it defines it explicitly as `11`, the same value `classicTheme` already
 * has, so no override entry is needed either way).
 */
export const patternTheme: ChartTheme = {
  ...classicTheme,
  colors: patternColors,

  gridXAxisBorderColor: '#ebebeb',
  gridYAxisBorderColor: '#ebebeb',

  barBorderColor: '#000',
  barBorderWidth: 1,
  barBorderOpacity: 1,
  barBorderRadius: 5,

  pieBorderColor: '#fff',

  tooltipLineWidth: 1,

  timelineTitleFontSize: 11,
  timelineColumnBackgroundColor: 'linear(top) #f9f9f9,1 #e9e9e9',
  timelineEvenRowBackgroundColor: '#fafafa',
  timelineOddRowBackgroundColor: '#f1f0f3',
  timelineVerticalLineColor: '#c9c9c9',
  timelineHorizontalLineColor: '#d2d2d2',

  flameTextFontSize: 12,
}

const themes: Record<ThemeName, ChartTheme> = {
  classic: classicTheme,
  dark: darkTheme,
  gradient: gradientTheme,
  pattern: patternTheme,
}

export interface UseThemeResult {
  tokens: ComputedRef<ChartTheme>
  /** `chart.theme(key)` equivalent: reads a single token off the active theme. When a
   *  `resolver` was passed to `useTheme()` and `key`'s name contains `"Color"` (matching
   *  upstream's own `chart.theme()` - `key.indexOf("Color") > -1 && _theme[key] != null` -
   *  `dist/jui-chart.js:12337-12341`), the value is routed through `resolver.resolve()` first. */
  theme: <K extends keyof ChartTheme>(key: K) => ChartTheme[K]
  colors: ComputedRef<string[]>
  /** `chart.color(index)` equivalent: cycles through the theme's color list. Routed through
   *  `resolver.resolve()` when a `resolver` was passed to `useTheme()`. */
  color: (index: number) => string
}

/**
 * @param resolver Optional per-chart-instance `useColorResolver()` (see that file's doc comment)
 *   - when given, `color()`/`theme()` route `"linear(...)"`/`"pattern-*"` theme token strings
 *     through it, turning them into real registered SVG defs + a `url(#id)` reference instead of
 *     returning them raw. Omit it (as every call site outside `ChartBase.vue`'s wired component
 *     tree currently does - see this file's header doc comment's "still out of scope" section) to
 *     get the pre-existing raw-passthrough behavior; that's also what a bare `useTheme(name)` call
 *     in a unit test gets, deliberately, rather than needing to fake a resolver.
 */
export function useTheme(name: Ref<ThemeName>, resolver?: ColorResolver): UseThemeResult {
  const tokens = computed(() => themes[name.value] ?? classicTheme)
  const colors = computed(() => tokens.value.colors)

  function theme<K extends keyof ChartTheme>(key: K): ChartTheme[K] {
    const raw = tokens.value[key]
    if (resolver && typeof key === 'string' && key.indexOf('Color') > -1 && raw != null) {
      return resolver.resolve(raw as unknown as string) as ChartTheme[K]
    }
    return raw
  }

  function color(index: number): string {
    const list = colors.value
    const raw = list[index % list.length]
    return resolver ? resolver.resolve(raw) : raw
  }

  return { tokens, theme, colors, color }
}
