<script setup lang="ts">
// Ported from `chart.brush.bar` + `chart.brush.column` (bar.js is the shared base; column.js
// swaps x<->y). `orient="bar"` draws horizontal bars (value axis = x, category axis = y),
// `orient="column"` draws vertical bars (value axis = y, category axis = x) - selected here via
// a single prop instead of two separate brush types, since the math is identical modulo axis
// swap. Skips: the entry animation.
//
// `display: "max"|"min"|"all"` (ported from `drawETC()`'s min/max-label gate) IS ported: renders
// a persistent value label on the bar(s) holding a target's max value, min value, or all bars.
// The original draws its own circle+text marker via `drawTooltip()` (shared with the hover
// marker) rather than a balloon widget; this port instead reuses `ChartTooltip` (the balloon
// already used for hover here) in "always visible" mode, for visual consistency with the rest of
// this codebase's hover tooltips rather than matching the original's plainer marker pixel-for-
// pixel.
//
// `active`/`activeEvent`: ported from `drawETC()`'s tail block (`this.barList[this.brush.active]`)
// and `setActiveEffect()`. Unlike pie/donut/line's `active`, which is a series/wedge *name*,
// bar.js's `active` is a plain **number index** into the flat, row-major bar list (one entry per
// (row, target) pair, in draw order) - `this.brush.active` config comment literally says
// "Activates the bar of an applicable index." That list's draw order is exactly this port's
// existing `bars` computed's order (`rows.forEach(row => targets.forEach(...))`), so the prop's
// index lines up 1:1 with `bars`. `setActiveEffect(r)` then dims *every other* bar's element
// opacity to `theme('barDisableBackgroundOpacity')` (whole-element `opacity`, not fill-only,
// matching the original's `.attr({ opacity })`) while the active one stays at 1 - the exact same
// "no active -> everyone full opacity; someone active -> only they're full, rest dimmed" shape as
// pie's `setActiveEvent()`, so this reuses `pieActiveOpacity()` as-is rather than adding a new
// pure function (verified: `pieActiveOpacity(isActive, hasAnyActive, disabledOpacity)`'s formula
// is identical to bar.js's `(cols[i] == r) ? 1 : style.disableOpacity`). `setActiveEffect()` also
// dims each bar's own `display` min/max marker to match (`cols[i].minmax.style(..., opacity)`) -
// ported below by wrapping each `display` `ChartTooltip` in a `<g :opacity>` using the same
// `barOpacity()`.
// `activeEvent` (a DOM event name) wires a listener per bar - **only** on bars whose `value !== 0`
// (`if(r.value != 0 && this.brush.activeEvent != null)`, mirroring the same zero-value guard
// `getBarElement()` uses for core click-event forwarding) - that unconditionally *sets* the
// triggered bar as the new active index and shows a value-only tooltip at its position
// (`self.active.control(bar.position, bar.tooltipX, bar.tooltipY, self.format(bar.value))` - no
// series key, matching the `display` marker's value-only shape, not this port's own key+value
// hover balloon). Ported **literally, with no toggle and no auto-reset on a later `mouseout`**:
// unlike pie.js's `setActiveEvent()` (an explicit per-wedge toggle) or this port's own documented
// LineChart deviation (adding a mouseout-reset pie/line never had), bar.js's handler has neither
// behavior in the source - every trigger just overwrites the active index, and it stays until the
// next trigger. This also matches `ScatterChart.vue`'s precedent of *not* adding a mouseout-reset
// for a hover-style `activeEvent`. A `props.active`-vs-`activeEvent` precedence ref mirrors
// `LineChart.vue`'s `hoveredTarget ?? props.active` shape. **Deviation (new, this port only)**:
// this port's pre-existing always-on hover balloon (unconditional mouseover/mouseout, not gated by
// `activeEvent` - itself already a port-only addition absent from bar.js, which has no default
// hover tooltip at all) is suppressed for a bar that's *also* the current active bar, to avoid two
// overlapping balloons rendering on top of each other when `activeEvent="mouseover"` triggers both
// at once; the active tooltip (value-only) is shown instead. This only changes rendering when both
// coincide on the same bar - the independent hover-only and active-only cases are unaffected.
//
// **Bug found and fixed while verifying this item**: `useChartLayout.ts`'s `xInterval`/`yInterval`
// (feeding `useAxis()`) are defined as *absolute* pixel intervals - `[area.x, area.x2]` /
// `[area.y, area.y2]` - not relative-to-zero, confirmed by cross-referencing `ChartBase.vue`'s own
// gridlines (drawn with zero extra transform, directly from these same `axisX`/`axisY.value`
// outputs, e.g. a gridline for a y-domain max lands exactly at local `y = area.y`). So
// `ax.scale()`/`ay.scale()` already return final, padding-inclusive coordinates - yet every bar's
// `d`/`tooltipX`/`tooltipY` (all built directly from those same `.scale()` calls, see `bars`
// below) was ALSO being wrapped in `<g :transform="translate(area.x, area.y)">`, double-applying
// the padding offset and shifting every bar (and every tooltip anchored to one) an extra
// `(area.x, area.y)` pixels down-right of its true, axis-correct position - invisible at a glance
// (every bar shifts by the same amount, so relative bar heights still *look* plausible) but
// verifiable precisely against gridlines, and *not* invisible at the far edge: a bar/tooltip near
// an axis's max value can be pushed past the root `<svg>`'s own `viewBox` boundary and silently
// clipped - which is exactly how this was found (the new `activeEvent="click"` demo's tooltip for
// a near-max-value bar rendered completely invisible; tracing it back led here). Confirmed via the
// existing `/bar` page's very first demo chart (default padding, unrelated to this item) before
// touching anything: its tallest bar (`3Q`, value 10, domain max 12) rendered visibly *shorter*
// than the "8" gridline it should clear by a wide margin - a real, pre-existing rendering bug, not
// specific to `display`/`active` tooltips. Fixed here by dropping the redundant `translate(...)`
// from every `<g>` in this file (the main bars group and all three tooltip overlay groups) - `bars`
// doesn't otherwise depend on `area.x`/`area.y` at all, so nothing else needed to change.
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts.
// `bar.js`'s `getBarElement()` calls `addEvent(r, dataIndex, targetIndex)` per bar, **skipping any
// bar whose value is `0`** (`if(value != 0) this.addEvent(...)`) - ported literally: a `value===0`
// bar emits nothing. `dataIndex`/`data` are the bar's row index/full row (unlike `LineChart.vue`'s
// always-`null` per-series wiring - bar.js's `addEvent` is genuinely per-row here). Proof-of-concept
// component for this Phase A item alongside `LineChart.vue` - see PORT_STATUS.md.
//
// **Not fixed here** (out of this item's scope, flagged in `PORT_STATUS.md` instead):
// `LineChart.vue`/`AreaChart.vue`/`ScatterChart.vue` share the exact same
// `<g :transform="translate(area.x, area.y)">` pattern over coordinates built from
// `useSeries.ts`'s `toSeriesScale()` (which also calls `axis.scale()` directly) - spot-checked
// `/line`'s first demo chart and confirmed the identical double-offset there too, but a full
// fix+re-verification across those three components is a separate, larger effort than this item.
//
// `stacked`: ported from `stackbar.js`(271)/`stackcolumn.js`(117) - source-confirmed these are
// **NOT** the trivial 1-line `draw()` wrapper the `stackarea.js`/`stackline.js`/`stackscatter.js`
// trio turned out to be (see `LineChart.vue`'s/`AreaChart.vue`'s/`ScatterChart.vue`'s own
// `stacked` writeups). `stackbar.js` does `extend: "chart.brush.bar"` but overrides almost every
// method (`getBarElement`, `drawBefore`, `draw`, and adds brand-new `setActiveEffect`/
// `setActiveEvent`/`getTargetSize`/`drawStackTooltip`/`drawStackEdge` that bar.js has no
// equivalent of) - the *shape* of the inheritance is "extends", but the *behavior* is a near-full
// reimplementation, confirmed by reading it end-to-end rather than assuming from the `extend`
// keyword alone. `stackcolumn.js` (117 lines) then extends `stackbar.js` itself (not column.js),
// overriding only `getTargetSize`/`drawBefore`/`draw` for the axis swap - exactly mirroring how
// `column.js` extends `bar.js` for the non-stacked pair, just one level further down.
// **What the extra lines actually are** (not "just stack the bars"):
//   1. Segments are plain, unrounded rects (`chart.svg.rect()`, no `.round()` call at all) -
//      genuinely different from bar.js's `pathRect()` + corner-rounding, ported here as
//      `roundedRectPath(..., 0, 0, 0, 0)` (reusing the same helper with zero radius rather than a
//      second rect-path builder).
//   2. A value===0 segment is hidden entirely (`display:none` in the source, `v-if` here) and
//      gets no per-element event forwarding - ported literally, matching bar.js's own zero-value
//      guard shape (this port already has that same guard for grouped bars).
//   3. `getTargetSize()`: a stacked bar/column has ONE thickness per *row* (no per-target
//      division/`innerPadding` gap at all - segments butt directly against each other, matching
//      the source's total absence of any `innerPadding` reference in `draw()`), computed as
//      `size > 0 ? size : max(band - outerPadding*2, minSize)`. **Notable semantic shift, ported
//      faithfully**: `minSize` here is a floor on the *whole stack's thickness* (band cross-axis
//      size), NOT bar.js's per-value near-zero-length clamp (which stacked mode doesn't do at
//      all - there's no equivalent minSize-driven value clamp anywhere in stackbar.js's `draw()`).
//      This component reuses the same `minSize`/`outerPadding`/`innerPadding` props for both
//      modes - `innerPadding` is simply unused when `stacked`, and `minSize`'s *meaning* changes,
//      matching upstream's own reused-but-repurposed option name.
//   4. `display: "max"|"min"|"all"` selects against each row's **stack total** (`sumValue`, the
//      running sum across every `target`), not any single target's own value - a real behavioral
//      difference from bar.js's per-target min/max. There's also no per-segment value label at
//      all in stackbar.js (unlike bar.js, `drawStackTooltip` is called once per ROW, never per
//      segment) - ported via a new `selectDisplayIndices()` in `useSeries.ts` (a generalization of
//      the existing `selectDisplayBars` to an arbitrary numeric array, since "one value per row"
//      here is a sum, not a per-target field lookup).
//   5. `active`/`activeEvent` operate on the whole **row group** (all of that row's segments +
//      its stack-total tooltip, dimmed/revealed together), not a single segment - confirmed from
//      `this.addBarElement(group)` being called once per row with the row's whole `<g>`, unlike
//      bar.js's `barList` which is one entry per (row, target) segment. `activeEvent` here also
//      has **no value===0 guard** (`setActiveEventOption(group)` just checks `activeEvent != null`
//      - it's wired on the row group, not a single segment, so there's no single value to guard
//      on). The stack-total tooltip's visibility rule, read directly from `setActiveEffect()`:
//      `display`-selected OR the row is currently active (an OR, independent of whether `display`
//      is set at all) - ported as `row.showTotal || row.dataIndex === effectiveActiveIndex`.
//      `active`/`activeEvent`'s prop *shape* is unchanged (still the same number-index props as
//      grouped mode) but the index now addresses a ROW, not a flat (row,target) bar - documented
//      here as the mode-dependent index-space deviation this implies.
// **Deliberately NOT ported** (documented gap, not silently dropped): `stackbar.js`'s `edge`
// option (`drawStackEdge()`) - optional diagonal connector lines bridging each target's segment
// boundary between adjacent rows (a stream/flow-graph-style overlay), including its
// axis-`reverse`-aware anchor-side correction (`ex`/`ey` in the source). This is a self-contained,
// default-`false`, purely cosmetic addition on top of the (now faithfully ported) core stacking
// geometry - out-of-scope for this iteration, left for a future one if requested.
//
// `normalize` (100% stacked bar/column): ported from `fullstackbar.js`(110)/`fullstackcolumn.js`
// (101). **Source-confirmed**: both declare `extend: "chart.brush.stackbar"`/
// `"chart.brush.fullstackbar"` respectively, and DO reuse a real slice of the parent's machinery
// (`getBarElement`/`addBarElement`/`setActiveEffect`/`setActiveEffectOption`/`setActiveEvent`/
// `setActiveEventOption`/`getTargetSize` are all inherited unmodified) - but `draw()` itself is a
// full reimplementation with a genuinely different algorithm, not a thin percent-scaling wrapper
// around `stackbar.js`'s own `draw()`: it recomputes each row's segment geometry from scratch via
// `axis.x.rate(value, sum)`/`axis.y.rate(value, sum)` (`sum` = that row's own target-value total),
// never calls `stackbar.js`'s cumulative-through-the-axis-domain approach at all, and drops
// `drawStackTooltip`/`drawStackEdge`/`stackTooltips` entirely - `this.brush.display` and
// `this.brush.edge` are never even referenced in `fullstackbar.js`, confirmed by reading it
// end-to-end (not assumed from a missing call): **neither `display` nor `edge` has any effect in
// normalize mode**, a real behavioral difference from `stacked` (see below), not merely "also not
// ported" for the same reason as `stacked`'s own already-documented `edge` gap.
// **Normalization math** (derived by hand from `util.scale.linear.js`'s `func.rate(value, max) =
// func(func.max() * (value / max))`, since `func` is linear with a domain starting at `0`, the
// domain max **cancels out algebraically**, leaving a plain `(value / sum) * totalPixelSpan` -
// verified this derivation against both `examples/fullstackbar.html`/`fullstackcolumn.html`, which
// both set the value axis's domain to `[0, 100]`, and against `chart.grid.core`'s `brush/core.js`
// translate-by-`area.x/y` convention (this port's own `axis.scale()` is already absolute per the
// double-offset bug fix above, so the pixel-span math translates directly to `area.width`/
// `area.height` with no extra offset). **This means the value axis's configured domain/scale has
// ZERO effect on the bar/segment geometry** - every row's stack always spans the full plot
// width/height (`area.width`/`area.height`), proportioned only by that row's own targets' share of
// its own total, regardless of the row's raw total or the axis's domain max. The axis itself
// (ticks/gridlines/labels) is NOT relabeled as percentages automatically - it stays exactly as
// configured (both original demos set `domain: [0, 100]` with a `format: value => value + "%"`
// tick formatter by convention, to make the axis *read* like a percent scale, but that's a
// convention the demo authors chose, not something `normalize` enforces or computes). **The
// optional percent TEXT label is the one place the domain max does still matter**: ported
// literally as `Math.round((value / sum) * axis.x.max())` (`computeStackPercent` in
// `useSeries.ts`) - this is only a true 0-100 percentage when the configured domain max happens to
// be `100` (as both demos do); with e.g. a domain max of `4`, `value=1, sum=4` reads `"1"`, not
// `"25"` (unit-tested explicitly in `useSeries.spec.ts` to pin this non-obvious coupling). Segment
// geometry uses a new pure `normalizeStackFractions(values)` (per-row cumulative `[0,1]` fraction
// boundaries, index 0 = base, matching `stackedBars`'s existing stacking order) instead of
// `useStackedSeries` - that composable maps values *through* the range axis's scale (correct for
// `stacked`'s absolute-value cumulative stacking) and is simply the wrong tool here, since
// normalize's geometry bypasses the axis scale entirely.
// **`display`/`active`/`activeEvent`**: `active`/`activeEvent` behave **identically** to `stacked`'s
// existing row-level (not per-segment) semantics - `setActiveEffect`/`setActiveEventOption` are
// inherited unmodified from `stackbar.js` and called the same way (once per row, on the row's whole
// `<g>` group) from `fullstackbar.js`'s own `draw()`, so this reuses the exact same `stackedRows`/
// `barOpacity`/`onRowActiveEvent` wiring - only the segment geometry itself changes. `display`,
// however, has **no effect at all** in normalize mode (not merely "still row-scoped but now against
// a 100%-normalized total" - genuinely unwired): confirmed `this.brush.display` is never read in
// `fullstackbar.js`, and `drawBefore()` never initializes `this.stackTooltips`/`this.tooltipIndexes`
// (both left `undefined`), so even the inherited `setActiveEffect()`'s `if (tooltips)` guard (added
// specifically per its own comment for "a case where tooltips may not exist") silently no-ops - the
// row-total balloon `stacked` shows (`display`-selected or active) is entirely absent here. Ported
// by gating that balloon's `v-if` off whenever `normalize` is true, regardless of `display`/`active`.
// **API shape decision**: `normalize?: boolean`, a new prop *alongside* the existing `stacked`
// (only meaningful when `stacked` is also `true`), rather than widening `stacked` itself to a
// `'true' | 'full'` union or duplicating `stacked`'s whole prop surface onto a separate
// `FullStackBarChart` component. Chosen because that's the shape the source itself expresses:
// `fullstackbar.js` `extend`s `stackbar.js` (a real "stacked, plus a normalization flag" relationship,
// not two independent siblings the way `bubble.js`/`scatter.js` or `area.js`/`rangearea.js` turned
// out to be earlier in this port) - `normalize` composes with every `stacked` prop that still
// applies (`active`, `activeEvent`, `size`, `minSize`, `outerPadding`) and simply disables the one
// (`display`) that the source itself drops. New `showText?: boolean | ((percent: number) => string)`
// (default `false`, matching both sources' own `showText: false` default) - ported from
// `fullstackbar.js`'s `setup()` option of the same name; a function receives the rounded percent
// number and returns the label text (`fullstackcolumn.html`'s own demo config: `percent => percent +
// "%%"`), otherwise the default is `` `${percent}%` ``. A `0`/`NaN` percent renders no label, ported
// from `drawText`'s own `if (percent === 0 || isNaN(percent)) return null` guard.
//
// `equalizer`/`equalizerUnit`: ported from `equalizerbar.js` (77 lines)/`equalizercolumn.js` (77
// lines). **Source-confirmed relationship, don't assume from the name**: both `extend:
// "chart.brush.stackbar"`/`"chart.brush.stackcolumn"` (NOT the separate, unrelated `equalizer.js`,
// which `extend`s `chart.brush.core` directly and shares no code with the bar family at all - see
// `EqualizerChart.vue`, its own standalone component). `EqualizerBarBrush`/`EqualizerColumnBrush`
// reuse `getBarElement()`/`getTargetSize()`/`addEvent()`/`offset()` inherited from
// `stackbar.js`/`bar.js`, but completely override `drawBefore()`/`draw()` - the actual rendering
// is a real, separate algorithm, not a thin stacked-bar variant (same "extends a sibling but
// overrides the real logic" lesson as `stackbar.js`/`fullstackbar.js` themselves).
// **What it actually renders**: each stacked segment is split into a train of fixed pixel-size
// blocks (`unit` local var - see below) separated by a constant `innerPadding`px gap, instead of
// one continuous rect - ends as soon as the *remaining* segment length can't fit another full
// block+gap step (any shorter leftover is simply unfilled, unlike `equalizer.js`'s own block math,
// which always clips its last block to land exactly on the value edge - a genuinely different
// algorithm, confirmed by reading both loops side by side). Block color is uniform per target
// (inherited `getBarElement()`'s `this.color(targetIndex)`) - **no** per-block color banding (that
// only exists in the separate `equalizer.js`).
// **Block pixel size, source-confirmed non-obvious formula**: `unit = band / (brush.unit *
// padding)`, where `band = axis.<x|y>.rangeBand()` on the VALUE/range axis (not a block axis's
// category width - `util.scale.linear.js`'s `rangeBand()` is the pixel spacing between two
// adjacent ticks, set as a side effect of `ticks()`) and `padding = brush.innerPadding` (inherited
// default `1` from `bar.js` - `stackbar.js`/`equalizerbar.js` never override it, so it is NOT
// `equalizer.js`'s own unrelated default of `10`). `brush.unit` here defaults to `1` and is a
// *divisor*, not a pixel height like `equalizer.js`'s same-named option - ported as `equalizerUnit`
// to avoid confusion with this component's own `size`/`unit`-shaped props. Extracted as pure
// `equalizerUnitSize(tickBand, equalizerUnit, innerPadding)` + `rangeAxisTickBand(values)`
// (`useSeries.ts`, unit-tested) since `RangeAxisResult.band` is hardcoded `0` for a range axis in
// this port (no prior component needed a range axis's tick-pixel-spacing until now).
// **Source-confirmed block-train quirk**: the running pixel position is a single variable shared
// across a WHOLE ROW (declared once before the per-target loop, never reset between targets) - only
// each target's own *remaining capacity* resets per target. So block runs are chained end-to-end
// starting from the row's zero-axis position, not realigned to each segment's own true cumulative
// boundary - ported as pure `equalizerStackedBlocks(segmentLengths, unitSize, gapSize)`
// (`useSeries.ts`, unit-tested against a hand-traced 2-segment case showing the resulting drift,
// plus an exact-multiple case showing no drift, and the guard/edge cases) - see that function's own
// doc comment for the full derivation. A whole-group post-hoc `translate` (`(is_reverse) ? -unit :
// 0` for bar, `(is_reverse) ? 0 : -unit` for column) corrects an off-by-one-step placement quirk in
// the source's own loop (rects are placed at the *pre-step* running position) - derived by hand
// (not just copied) by tracing both the reverse and non-reverse cases to confirm which one needs
// the correction, folded directly into this component's block `y`/`x` formula below rather than a
// literal SVG `translate` (equivalent result, avoids an extra wrapping `<g>` per segment).
// **Events**: unlike `equalizer.js`'s single per-target `addEvent(barGroup, i, j)` call,
// `equalizerbar.js`/`equalizercolumn.js` call `addEvent` TWICE per segment - once per individual
// block (inherited `getBarElement()`'s own `addEvent(r, dataIndex, targetIndex)`) AND once more on
// the whole target `<g>` (`this.addEvent(barGroup, i, j)`) - since a block's rect is a DOM child of
// that same group, a real click on a block would bubble and fire the forwarded event **twice**
// upstream. **Deviation (not replicated)**: matching this port's own established precedent for an
// upstream indiscriminate multi-fire quirk (see `AreaChart.vue`'s `drawArea()` per-target
// `addEvent` writeup), this port wires forwarding once per segment (same granularity as this
// component's own non-equalizer stacked-segment `<path>` handlers), not once per block - a single,
// unambiguous event per click, not a double-fire.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { pieActiveOpacity } from '../composables/useActive'
import {
  computeStackPercent,
  equalizerStackedBlocks,
  equalizerUnitSize,
  normalizeStackFractions,
  rangeAxisTickBand,
  roundedRectPath,
  selectDisplayBars,
  selectDisplayIndices,
  toSeriesScale,
  useStackedSeries,
} from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, BarDisplayMode, BarOrient, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    target: string[]
    axisX: AxisConfig
    axisY: AxisConfig
    orient?: BarOrient
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    /** Fixed bar thickness (or, when `stacked`, the whole stack's thickness). 0 (default)
     * auto-sizes to fill the category band. */
    size?: number
    /** When `!stacked`: minimum rendered length for a near-zero value, so it stays
     * visible/clickable. When `stacked`: a *different* semantic, ported faithfully from
     * `stackbar.js`'s own reuse of this option - a floor on the whole stack's thickness
     * (`max(band - outerPadding*2, minSize)`), not a per-value length clamp (stacked mode has no
     * such clamp at all). See this file's header comment. */
    minSize?: number
    outerPadding?: number
    /** Gap between grouped bars. Unused when `stacked` - stacked segments always butt directly
     * against each other (no gap), matching `stackbar.js`'s `draw()`, which never references
     * `innerPadding`. */
    innerPadding?: number
    colors?: string[]
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Shows a persistent value label. When `!stacked`: on the bar(s) holding each *target's* max
     * value, min value, or every bar (matches `bar.js`'s `display`). When `stacked`: on the
     * *row(s)* whose stack **total** is the max/min, or every row's total (matches `stackbar.js`'s
     * own `display`, which selects against `sumValue`, not any single target - see this file's
     * header comment). Default (omitted) shows none in either mode. */
    display?: BarDisplayMode
    /** Formats the value shown in the hover tooltip and any `display` label (a segment's own value
     * when `!stacked`, or a row's stack total when `stacked`). Default: the raw value. */
    format?: (value: number) => string | number
    /** Statically highlights (full opacity) an element, dimming every other one to
     * `theme('barDisableBackgroundOpacity')`, and shows a persistent value tooltip at its
     * position. `null` (default) highlights nothing. When `!stacked`: a flat, row-major index into
     * the (row, target) segment list (ported from `bar.js`'s `active`). When `stacked`: a row
     * index (the whole row's stack - segments + its total tooltip - highlighted/dimmed together),
     * ported from `stackbar.js`'s own `active`, which is genuinely row-scoped upstream too (see
     * this file's header comment). */
    active?: number | null
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that sets the triggered element as the
     * active one (see `active`). `null` (default) disables the interaction. When `!stacked`:
     * ignored on a segment whose value is `0`, ported from `bar.js`'s `activeEvent`. When
     * `stacked`: wired on the whole row group with **no** value guard, matching `stackbar.js`'s
     * `setActiveEventOption(group)` (see this file's header comment). Both ported literally, with
     * no toggle and no auto-reset on a later `mouseout`. */
    activeEvent?: string | null
    /** Stacks each row's targets cumulatively along the value axis instead of grouping them
     * side-by-side - target array order = stacking order, first target at the base. Ported from
     * `stackbar.js`/`stackcolumn.js` - see this file's header comment for the real extra logic
     * beyond stacking (plain unrounded segments, row-scoped `display`/`active`/`activeEvent`,
     * `minSize`'s repurposed meaning). Default `false`. */
    stacked?: boolean
    /** 100%-normalizes `stacked`'s segments - each row's stack always spans the full plot
     * width/height, proportioned by that row's own targets' share of its own total, regardless of
     * the row's raw total or the value axis's configured domain (which is NOT auto-relabeled as a
     * percent scale - see this file's header comment). Only meaningful when `stacked` is also
     * `true`. Ported from `fullstackbar.js`/`fullstackcolumn.js`. Default `false`. */
    normalize?: boolean
    /** Shows a percent label on each normalized segment (`normalize` only) - `true` for the
     * default `` `${percent}%` `` text, or a function receiving the rounded percent number for
     * custom text (e.g. `fullstackcolumn.html`'s own demo: `percent => percent + "%%"`). A
     * `0`/`NaN` percent (an empty/zero-sum segment) never renders a label. Ported from
     * `fullstackbar.js`'s `showText` option. Default `false`. */
    showText?: boolean | ((percent: number) => string)
    /** Splits each `stacked` segment into a train of small fixed-size blocks with gaps between
     * them (a VU-meter/equalizer look) instead of one continuous rect - ported from
     * `equalizerbar.js`/`equalizercolumn.js`, which `extend: "chart.brush.stackbar"`/
     * `"chart.brush.stackcolumn"` respectively (source-confirmed - NOT a variant of the separate,
     * unrelated `equalizer.js`, despite the shared name; see `EqualizerChart.vue` for that one).
     * Only meaningful when `stacked` is also `true` (matching `normalize`'s own precedent) and
     * ignored under `normalize` (no `fullequalizerbar.js`/`fullequalizercolumn.js` exists upstream
     * to port - the combination is out of scope). Default `false`. See this file's header comment
     * for the full block-geometry derivation, including a source-confirmed quirk: block positions
     * run as one continuous sequence across a whole row's targets (not restarted per segment), so a
     * segment boundary doesn't always land exactly on a block boundary. */
    equalizer?: boolean
    /** `equalizerbar.js`/`equalizercolumn.js`'s own `unit` option (default `1`) - a divisor, NOT a
     * pixel size (unrelated to `EqualizerChart.vue`'s same-named `unit` prop, which *is* a literal
     * pixel block height there). Block pixel size = (value axis's tick pixel spacing) /
     * (`equalizerUnit` * `innerPadding`) - see `equalizerUnitSize`. Only meaningful when both
     * `stacked` and `equalizer` are `true`. */
    equalizerUnit?: number
  }>(),
  {
    orient: 'column',
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    size: 0,
    minSize: 0,
    outerPadding: 2,
    innerPadding: 1,
    colors: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    display: undefined,
    format: undefined,
    active: null,
    activeEvent: null,
    stacked: false,
    normalize: false,
    showText: false,
    equalizer: false,
    equalizerUnit: 1,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

/** Forwards a per-element DOM event for `bar` - see this file's header comment. Skips value===0
 * bars, matching `bar.js`'s `getBarElement()` guard. */
function forwardEvent(type: ChartElementEventType, bar: Bar, e: MouseEvent) {
  if (bar.value === 0) return
  // See LineChart.vue's `forwardEvent` for why this cast is needed and sound.
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: bar.dataIndex,
    dataKey: bar.key,
    data: props.data[bar.dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

// `area` (padding/plot-area geometry) is only destructured for `normalize` mode's segment geometry
// below - `ax.scale()`/`ay.scale()` already return absolute, padding-inclusive pixel coordinates
// (see this file's header comment on the double-offset bug fixed here) so there's still no
// separate area.x/area.y translate to apply anywhere; `normalize` needs `area.width`/`area.height`
// directly because its geometry bypasses the axis scale entirely (see this file's header comment).
const { axisX, axisY, area } = useChartLayout(
  dataRef,
  toRef(props, 'axisX'),
  toRef(props, 'axisY'),
  toRef(props, 'width'),
  toRef(props, 'height'),
  toRef(props, 'padding'),
)

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

// `stacked`-only wiring: `useStackedSeries` (Phase A's `getStackXY` port) already gives exactly
// what's needed for per-segment boundaries - no new composable required. Each target's stored
// range-axis coordinate is the *cumulative* pixel after including that target (its segment's
// outer/"top" edge); a segment's inner/"base" edge is simply the *previous* target's own
// cumulative coordinate (or the zero baseline for the first target) - so segment start/end falls
// straight out of `useStackedSeries`'s existing per-target arrays, read pairwise, with no new pure
// function needed. Kept "live" (not conditionally constructed) so toggling `stacked` at runtime
// reacts correctly, matching `LineChart`/`AreaChart`/`ScatterChart`'s own `stacked` precedent.
const targetRef = toRef(props, 'target')
const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))
const xType = computed(() => axisX.value.type)
const yType = computed(() => axisY.value.type)
const seriesStacked = useStackedSeries(dataRef, targetRef, xScale, yScale, xType, yType)

interface Bar {
  d: string
  color: string
  value: number
  key: string
  tooltipX: number
  tooltipY: number
  /** Does this bar qualify for a persistent `display` label? */
  isDisplay: boolean
  /** Row index into `props.data` - used for the `dataIndex`/`data` in a forwarded element event. */
  dataIndex: number
  /** `normalize`-only: the rendered percent label text (`null` = no label - either `showText` is
   * off, or the segment's percent is `0`/`NaN`, matching `drawText`'s own guard). Always `null`
   * outside `normalize` mode. */
  percentText: string | null
  /** `normalize`-only: the percent label's anchor position - ported literally from `drawText`'s
   * own call-site offsets (`+5` for `fullstackbar`, segment center `+8` for `fullstackcolumn`),
   * deliberately distinct from `tooltipX`/`tooltipY` (the segment's true geometric center, used for
   * this port's own hover balloon) since the source positions its percent text with a small nudge,
   * not dead-center. Unset outside `normalize` mode. */
  textX?: number
  textY?: number
  /** `equalizer`-only: this segment's blocks (see this file's header comment) - `undefined`
   * outside `stacked && equalizer` mode (rendered as the plain `d` rect instead). */
  blocks?: { x: number; y: number; width: number; height: number }[]
}

/** Ported from `stackbar.js`/`stackcolumn.js`'s `draw()` - segment geometry only (row-total
 * `display`/`active` live in `stackedRows` below, since those are row-scoped, not segment-scoped).
 * Plain, unrounded rects (`roundedRectPath(..., 0,0,0,0)`) - stackbar.js never calls `.round()`,
 * unlike bar.js. `isDisplay` is always `false` here (stacked mode has no per-segment display
 * label - see this file's header comment). When `props.normalize`, delegates to
 * `normalizedBars()` instead (see this file's header comment on `fullstackbar.js`/
 * `fullstackcolumn.js` - a genuinely different geometry algorithm, not a thin wrapper around this
 * one). */
function stackedBars(): Bar[] {
  if (props.normalize) return normalizedBars()

  const targets = props.target
  const len = targets.length
  const rows = dataRef.value
  const out: Bar[] = []
  const op = props.outerPadding
  const stacked = seriesStacked.value

  if (props.orient === 'column') {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'block' || ay.type !== 'range' || len === 0) return out

    const zeroY = ay.scale(0) as number
    const thickness = props.size > 0 ? props.size : Math.max(ax.band - op * 2, props.minSize)
    // `equalizer`-only: block pixel height + reverse-axis direction, constant for the whole chart
    // (not per-row) - see this file's header comment for the `unit = band / (brush.unit *
    // padding)` derivation and the reverse-axis translate-correction derivation.
    const unitSize = props.equalizer ? equalizerUnitSize(rangeAxisTickBand(ay.values), props.equalizerUnit, props.innerPadding) : 0
    const isReverseValue = (props.axisY as { reverse?: boolean }).reverse ?? false

    rows.forEach((row, i) => {
      const centerX = ax.scale(i) as number
      const left = centerX - thickness / 2
      let prevY = zeroY

      // `equalizer`-only: one shared running block position for the WHOLE row, computed once
      // before the per-target loop - see `equalizerStackedBlocks`'s own doc comment for why this
      // must NOT be recomputed per target.
      const blockRuns = props.equalizer
        ? equalizerStackedBlocks(
            targets.map((_, j) => Math.abs((j === 0 ? zeroY : (stacked[j - 1].y[i] as number)) - (stacked[j].y[i] as number))),
            unitSize,
            props.innerPadding,
          )
        : []

      targets.forEach((key, j) => {
        const value = row[key]
        const endY = stacked[j].y[i] as number
        const top = Math.min(prevY, endY)

        out.push({
          d: roundedRectPath(left, top, thickness, Math.abs(prevY - endY), 0, 0, 0, 0),
          color: pickColor(j),
          value,
          key,
          tooltipX: centerX,
          tooltipY: (prevY + endY) / 2,
          isDisplay: false,
          dataIndex: i,
          percentText: null,
          blocks: props.equalizer
            ? blockRuns[j].map((b) => ({
                x: left,
                y: isReverseValue ? zeroY + b.offset : zeroY - b.offset - unitSize,
                width: thickness,
                height: unitSize,
              }))
            : undefined,
        })

        prevY = endY
      })
    })
  } else {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'range' || ay.type !== 'block' || len === 0) return out

    const zeroX = ax.scale(0) as number
    const thickness = props.size > 0 ? props.size : Math.max(ay.band - op * 2, props.minSize)
    const unitSize = props.equalizer ? equalizerUnitSize(rangeAxisTickBand(ax.values), props.equalizerUnit, props.innerPadding) : 0
    const isReverseValue = (props.axisX as { reverse?: boolean }).reverse ?? false

    rows.forEach((row, i) => {
      const centerY = ay.scale(i) as number
      const top = centerY - thickness / 2
      let prevX = zeroX

      const blockRuns = props.equalizer
        ? equalizerStackedBlocks(
            targets.map((_, j) => Math.abs((j === 0 ? zeroX : (stacked[j - 1].x[i] as number)) - (stacked[j].x[i] as number))),
            unitSize,
            props.innerPadding,
          )
        : []

      targets.forEach((key, j) => {
        const value = row[key]
        const endX = stacked[j].x[i] as number
        const left = Math.min(prevX, endX)

        out.push({
          d: roundedRectPath(left, top, Math.abs(prevX - endX), thickness, 0, 0, 0, 0),
          color: pickColor(j),
          value,
          key,
          tooltipX: (prevX + endX) / 2,
          tooltipY: centerY,
          isDisplay: false,
          dataIndex: i,
          percentText: null,
          blocks: props.equalizer
            ? blockRuns[j].map((b) => ({
                x: isReverseValue ? zeroX - b.offset - unitSize : zeroX + b.offset,
                y: top,
                width: unitSize,
                height: thickness,
              }))
            : undefined,
        })

        prevX = endX
      })
    })
  }

  return out
}

/** Formats a rounded percent into the label text `drawText` would render, or `null` to render
 * nothing (`showText` off, or `percent === 0 || isNaN(percent)`, ported literally from
 * `drawText`'s own guard). */
function formatPercentText(percent: number): string | null {
  if (!props.showText || percent === 0 || Number.isNaN(percent)) return null
  return typeof props.showText === 'function' ? props.showText(percent) : `${percent}%`
}

/** Ported from `fullstackbar.js`/`fullstackcolumn.js`'s `draw()` - see this file's header comment
 * for the full normalization-math derivation. Unlike `stackedBars()`'s non-normalize branch, this
 * does NOT go through `axis.x.scale()`/`axis.y.scale()`/`useStackedSeries` for segment geometry at
 * all - the value axis's domain has zero effect on it (only `area.width`/`area.height` and each
 * row's own target values matter), confirmed by hand-deriving `axis.x.rate()`'s domain-max
 * cancellation. The percent *label* text is the one place the axis domain max still matters
 * (`computeStackPercent`), ported separately. */
function normalizedBars(): Bar[] {
  const targets = props.target
  const len = targets.length
  const rows = dataRef.value
  const out: Bar[] = []
  const op = props.outerPadding
  const plotArea = area.value

  if (props.orient === 'column') {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'block' || ay.type !== 'range' || len === 0) return out

    const thickness = props.size > 0 ? props.size : Math.max(ax.band - op * 2, props.minSize)
    const axisMax = ay.scale.max()

    rows.forEach((row, i) => {
      const values = targets.map((key) => row[key] as number)
      const { sum, start, end } = normalizeStackFractions(values)
      const centerX = ax.scale(i) as number
      const left = centerX - thickness / 2

      targets.forEach((key, j) => {
        const value = values[j]
        // Pixel y increases downward while the fraction accumulates from the baseline upward
        // (target 0 = base, matching `stackedBars`'s own stacking order), so the fraction range
        // is measured from `area.y2` (bottom) toward `area.y` (top) - fraction 1 always lands
        // exactly on `area.y` regardless of the row's raw `sum`, which is the "always reads as
        // 100%" property this component's own header comment/tests verify.
        const top = plotArea.y2 - end[j] * plotArea.height
        const bottom = plotArea.y2 - start[j] * plotArea.height
        const percent = computeStackPercent(value, sum, axisMax)

        out.push({
          d: roundedRectPath(left, top, thickness, bottom - top, 0, 0, 0, 0),
          color: pickColor(j),
          value,
          key,
          tooltipX: centerX,
          tooltipY: (top + bottom) / 2,
          isDisplay: false,
          dataIndex: i,
          percentText: formatPercentText(percent),
          textX: centerX,
          textY: (top + bottom) / 2 + 8,
        })
      })
    })
  } else {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'range' || ay.type !== 'block' || len === 0) return out

    const thickness = props.size > 0 ? props.size : Math.max(ay.band - op * 2, props.minSize)
    const axisMax = ax.scale.max()

    rows.forEach((row, i) => {
      const values = targets.map((key) => row[key] as number)
      const { sum, start, end } = normalizeStackFractions(values)
      const centerY = ay.scale(i) as number
      const top = centerY - thickness / 2

      targets.forEach((key, j) => {
        const value = values[j]
        // Target 0 = base at the left (`area.x`), later targets extend rightward toward
        // `area.x2` - fraction 1 always lands exactly on `area.x2` regardless of the row's raw
        // `sum`.
        const left = plotArea.x + start[j] * plotArea.width
        const right = plotArea.x + end[j] * plotArea.width
        const percent = computeStackPercent(value, sum, axisMax)

        out.push({
          d: roundedRectPath(left, top, right - left, thickness, 0, 0, 0, 0),
          color: pickColor(j),
          value,
          key,
          tooltipX: (left + right) / 2,
          tooltipY: centerY,
          isDisplay: false,
          dataIndex: i,
          percentText: formatPercentText(percent),
          textX: (left + right) / 2,
          textY: centerY + 5,
        })
      })
    })
  }

  return out
}

const bars = computed<Bar[]>(() => {
  if (props.stacked) return stackedBars()

  const targets = props.target
  const len = targets.length
  const rows = dataRef.value
  const out: Bar[] = []
  const radiusToken = theme('barBorderRadius')
  const op = props.outerPadding
  const ip = props.innerPadding
  // Per-target "which rows qualify for a persistent display label" flags (bar.js's
  // `getMinMaxValue()` computes min/max per target across ALL rows, independent of orient).
  const displayFlags = targets.map((key) => selectDisplayBars(rows, key, props.display))

  if (props.orient === 'column') {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'block' || ay.type !== 'range') return out

    const zeroY = ay.scale(0) as number
    const bandWidth = ax.band
    const colWidth = props.size > 0 ? props.size : Math.max((bandWidth - op * 2 - (len - 1) * ip) / len, 0)
    const groupWidth = props.size > 0 ? colWidth * len + (len - 1) * ip : bandWidth - op * 2

    rows.forEach((row, i) => {
      const centerX = ax.scale(i) as number
      let startX = centerX - groupWidth / 2

      targets.forEach((key, j) => {
        const value = row[key]
        let tooltipY = ay.scale(value) as number
        if (Math.abs(zeroY - tooltipY) < props.minSize) {
          tooltipY = tooltipY <= zeroY ? zeroY - props.minSize : zeroY + props.minSize
        }
        const h = Math.abs(zeroY - tooltipY)
        const radius = colWidth < radiusToken || h < radiusToken ? 0 : radiusToken
        const top = tooltipY <= zeroY ? tooltipY : zeroY

        out.push({
          d: tooltipY <= zeroY ? roundedRectPath(startX, top, colWidth, h, radius, radius, 0, 0) : roundedRectPath(startX, top, colWidth, h, 0, 0, radius, radius),
          color: pickColor(j),
          value,
          key,
          tooltipX: startX + colWidth / 2,
          tooltipY,
          isDisplay: displayFlags[j][i],
          dataIndex: i,
          percentText: null,
        })

        startX += colWidth + ip
      })
    })
  } else {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'range' || ay.type !== 'block') return out

    const zeroX = ax.scale(0) as number
    const bandHeight = ay.band
    const barHeight = props.size > 0 ? props.size : Math.max((bandHeight - op * 2 - (len - 1) * ip) / len, 0)
    const groupHeight = props.size > 0 ? barHeight * len + (len - 1) * ip : bandHeight - op * 2

    rows.forEach((row, i) => {
      const centerY = ay.scale(i) as number
      let startY = centerY - groupHeight / 2

      targets.forEach((key, j) => {
        const value = row[key]
        let tooltipX = ax.scale(value) as number
        if (Math.abs(zeroX - tooltipX) < props.minSize) {
          tooltipX = tooltipX >= zeroX ? zeroX + props.minSize : zeroX - props.minSize
        }
        const w = Math.abs(zeroX - tooltipX)
        const radius = barHeight < radiusToken || w < radiusToken ? 0 : radiusToken
        const left = tooltipX >= zeroX ? zeroX : zeroX - w

        out.push({
          d: tooltipX >= zeroX ? roundedRectPath(left, startY, w, barHeight, 0, radius, radius, 0) : roundedRectPath(left, startY, w, barHeight, radius, 0, 0, radius),
          color: pickColor(j),
          value,
          key,
          tooltipX,
          tooltipY: startY + barHeight / 2,
          isDisplay: displayFlags[j][i],
          dataIndex: i,
          percentText: null,
        })

        startY += barHeight + ip
      })
    })
  }

  return out
})

// Tracked by index (not the `Bar` object itself) so it can be compared against
// `effectiveActiveIndex` by value below - a `ref` holding an object auto-wraps it in a `reactive()`
// proxy (`toReactive()`), while `bars`/`activeBar` are plain `computed`s that don't, so a
// reference-equality check between a ref'd object and a computed's object is never true even for
// "the same" bar; index comparison sidesteps that entirely.
const hoverIndex = ref<number | null>(null)
const hover = computed<Bar | null>(() => (hoverIndex.value != null ? (bars.value[hoverIndex.value] ?? null) : null))

// Keeps each display-flagged bar's flat index alongside it (needed to dim its marker in sync with
// `barOpacity()` below - see this file's header comment on `setActiveEffect()`'s `minmax.style()`).
// Grouped (`!stacked`) mode only - stacked mode's `display`/`active` are row-scoped, see
// `stackedRows` below.
const displayBars = computed(() => (props.stacked ? [] : bars.value.map((bar, i) => ({ bar, i })).filter((entry) => entry.bar.isDisplay)))

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

// `activeEvent`-triggered override; `null` falls back to the static `active` prop. See this file's
// header comment for why this is index-based (not key-based like pie/donut/line) and why it's
// ported with no toggle/reset, mirroring `LineChart.vue`'s `hoveredTarget ?? props.active` shape.
// Addresses a flat (row, target) segment when `!stacked`, or a row when `stacked` (see header
// comment) - both share this one ref/computed pair since only one mode is ever active at a time.
const activeEventIndex = ref<number | null>(null)
const effectiveActiveIndex = computed<number | null>(() => activeEventIndex.value ?? props.active)
// Grouped mode's single-segment active tooltip - `null` when `stacked` (that mode's active tooltip
// is the row's stack-total tooltip, rendered from `stackedRows` below instead).
const activeBar = computed<Bar | null>(() => {
  if (props.stacked) return null
  const idx = effectiveActiveIndex.value
  return idx != null ? (bars.value[idx] ?? null) : null
})

/** Opacity for element `i` in `bars` - a segment index when `!stacked`, matching `effectiveActiveIndex`
 * 1:1; when `stacked`, `i` is converted to its owning ROW index first (`effectiveActiveIndex`
 * addresses a row there), so every segment in the active row - and its stack-total tooltip, called
 * with any of its own segments' indices - resolves to the same opacity, matching `stackbar.js`'s
 * `setActiveEffect()` dimming the whole row group as one unit. */
function barOpacity(i: number): number {
  const activeIdx = effectiveActiveIndex.value
  const ownIndex = props.stacked && props.target.length > 0 ? Math.floor(i / props.target.length) : i
  return pieActiveOpacity(ownIndex === activeIdx, activeIdx != null, theme('barDisableBackgroundOpacity'))
}

function onBarActiveEvent(bar: Bar, i: number) {
  if (bar.value === 0) return
  activeEventIndex.value = i
}

/** `stacked`-only row-group `activeEvent` handler - ported from `stackbar.js`'s
 * `setActiveEventOption(group)`, wired on the whole row's `<g>` with **no** value guard (see this
 * file's header comment). */
function onRowActiveEvent(rowIndex: number) {
  activeEventIndex.value = rowIndex
}

// `stacked`-only: hovering a segment inside the currently-active ROW doesn't collide with the
// active tooltip (that's the row's stack-total tooltip, at the outer edge of the whole stack - a
// different position from any individual segment's own hover tooltip, at that segment's midpoint),
// so - unlike grouped mode - there's no need to suppress it. Grouped mode keeps the original
// same-bar dedup (the active tooltip there sits at the exact same position as that bar's hover
// tooltip).
const suppressHover = computed(() => !props.stacked && hoverIndex.value != null && hoverIndex.value === effectiveActiveIndex.value)

/** `stacked`-only: one entry per row, grouping `bars`' segments for row-scoped rendering (opacity,
 * `activeEvent` wiring, and the stack-total `display`/`active` tooltip) - ported from
 * `stackbar.js`'s `barList` (one entry per row's whole `<g>` group, NOT per segment - confirmed
 * from `this.addBarElement(group)`, called once per row, unlike bar.js's per-segment `barList`). */
interface StackRow {
  dataIndex: number
  segments: Bar[]
  /** Row's stack total (`sumValue` in the source) - defaults missing/non-numeric target fields to
   * `0` (a defensive port-only addition; the source's own `sumValue += data[target[j]]` has no
   * such guard and would produce `NaN`). */
  sum: number
  /** Stack's outer edge (the pixel position of the cumulative total) on the value axis; the row's
   * own block-axis center on the other axis - ported from `drawStackTooltip`'s `(startX,
   * offsetY)`/`(offsetX, startY)` call-site position. */
  tooltipX: number
  tooltipY: number
  /** Does this row's stack total qualify for a persistent `display` label (selected against every
   * row's `sum`, NOT any single target's value - see this file's header comment)? */
  showTotal: boolean
}

const stackedRows = computed<StackRow[]>(() => {
  if (!props.stacked) return []
  const targets = props.target
  const len = targets.length
  if (len === 0) return []

  const rows = dataRef.value
  const stacked = seriesStacked.value
  const lastIdx = len - 1
  const sums = rows.map((row) => targets.reduce((s, key) => s + (typeof row[key] === 'number' ? (row[key] as number) : 0), 0))
  // `normalize` mode never shows a row-total tooltip (`display` has no effect there - see this
  // file's header comment) - `showFlags` stays all-`false` rather than calling
  // `selectDisplayIndices`, so this row-total's `tooltipX`/`tooltipY` (unused in that mode, since
  // `stackRowTooltipVisible` below also short-circuits on `normalize`) don't need to be
  // normalize-aware either.
  const showFlags = props.normalize ? rows.map(() => false) : selectDisplayIndices(sums, props.display)
  const isColumn = props.orient === 'column'
  const ax = axisX.value
  const ay = axisY.value

  return rows.map((_, i) => ({
    dataIndex: i,
    segments: bars.value.slice(i * len, i * len + len),
    sum: sums[i],
    tooltipX: isColumn ? (ax.scale(i) as number) : (stacked[lastIdx].x[i] as number),
    tooltipY: isColumn ? (stacked[lastIdx].y[i] as number) : (ay.scale(i) as number),
    showTotal: showFlags[i],
  }))
})

/** A row's stack-total tooltip is visible when `display` selects it OR the row is currently
 * active - an OR, independent of whether `display` is even set - ported directly from
 * `setActiveEffect()`'s `if (opacity == 1 || tooltipIndexes.includes(i))` (the "row is active"
 * and "row was `display`-selected" cases, respectively). **`normalize` mode**: always `false` -
 * `fullstackbar.js`/`fullstackcolumn.js` never initialize `stackTooltips`/`tooltipIndexes` at all,
 * so the inherited `setActiveEffect()`'s own `if (tooltips)` guard silently no-ops there (see this
 * file's header comment) - there is no row-total balloon in normalize mode, active row or not. */
function stackRowTooltipVisible(row: StackRow): boolean {
  if (props.normalize) return false
  return row.showTotal || row.dataIndex === effectiveActiveIndex.value
}
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g v-if="!props.stacked">
      <path
        v-for="(bar, i) in bars"
        :key="i"
        :d="bar.d"
        :fill="bar.color"
        :stroke="theme('barBorderColor')"
        :stroke-width="theme('barBorderWidth')"
        :stroke-opacity="theme('barBorderOpacity')"
        :opacity="barOpacity(i)"
        style="cursor: pointer"
        @mouseover="(e) => { hoverIndex = i; forwardEvent('mouseover', bar, e) }"
        @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', bar, e) }"
        @click="(e) => forwardEvent('click', bar, e)"
        @dblclick="(e) => forwardEvent('dblclick', bar, e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', bar, e) }"
        @[props.activeEvent]="onBarActiveEvent(bar, i)"
      />
    </g>
    <g v-else>
      <!-- Ported from `stackbar.js`'s row-`<g>` grouping (`this.addBarElement(group)`, one group
           per row) - opacity and `activeEvent` are wired here, at row granularity, not per segment
           (see this file's header comment). -->
      <g
        v-for="row in stackedRows"
        :key="row.dataIndex"
        :opacity="barOpacity(row.dataIndex * props.target.length)"
        :style="{ cursor: props.activeEvent ? 'pointer' : undefined }"
        @[props.activeEvent]="onRowActiveEvent(row.dataIndex)"
      >
        <template v-for="(seg, j) in row.segments" :key="j">
          <!-- value===0 segments render nothing at all (no hit area, no event forwarding),
               matching `stackbar.js`'s `display:none` + skipped `addEvent`. -->
          <path
            v-if="seg.value !== 0 && !seg.blocks"
            :d="seg.d"
            :fill="seg.color"
            :stroke="theme('barBorderColor')"
            :stroke-width="theme('barBorderWidth')"
            :stroke-opacity="theme('barBorderOpacity')"
            style="cursor: pointer"
            @mouseover="(e) => { hoverIndex = row.dataIndex * props.target.length + j; forwardEvent('mouseover', seg, e) }"
            @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', seg, e) }"
            @click="(e) => forwardEvent('click', seg, e)"
            @dblclick="(e) => forwardEvent('dblclick', seg, e)"
            @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', seg, e) }"
          />
          <!-- `equalizer` mode: the segment's block train (see this file's header comment) - one
               event listener per segment `<g>`, not per block (a deliberate deviation from the
               source's own double `addEvent` call - see header comment). -->
          <g
            v-if="seg.value !== 0 && seg.blocks"
            style="cursor: pointer"
            @mouseover="(e) => { hoverIndex = row.dataIndex * props.target.length + j; forwardEvent('mouseover', seg, e) }"
            @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', seg, e) }"
            @click="(e) => forwardEvent('click', seg, e)"
            @dblclick="(e) => forwardEvent('dblclick', seg, e)"
            @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', seg, e) }"
          >
            <rect
              v-for="(block, bi) in seg.blocks"
              :key="bi"
              :x="block.x"
              :y="block.y"
              :width="block.width"
              :height="block.height"
              :fill="seg.color"
              :stroke="theme('barBorderColor')"
              :stroke-width="theme('barBorderWidth')"
              :stroke-opacity="theme('barBorderOpacity')"
            />
          </g>
          <!-- `normalize`-only percent label, ported from `drawText()` - see this file's header
               comment (`showText` prop) and `Bar.percentText`'s own doc comment for the anchor
               offset. -->
          <text
            v-if="seg.percentText != null"
            :x="seg.textX"
            :y="seg.textY"
            :font-size="theme('barFontSize')"
            :fill="theme('barFontColor')"
            text-anchor="middle"
            style="pointer-events: none"
          >{{ seg.percentText }}</text>
        </template>
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover && !suppressHover">
        <ChartTooltip
          visible
          :x="hover.tooltipX"
          :y="hover.tooltipY"
          :items="[{ key: hover.key, value: formatValue(hover.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
      <g v-if="props.display && !props.stacked">
        <g v-for="entry in displayBars" :key="entry.i" :opacity="barOpacity(entry.i)">
          <ChartTooltip
            visible
            :x="entry.bar.tooltipX"
            :y="entry.bar.tooltipY"
            :items="[{ value: formatValue(entry.bar.value) }]"
            :background-color="theme('tooltipBackgroundColor')"
            :background-opacity="theme('tooltipBackgroundOpacity')"
            :border-color="theme('tooltipBorderColor') ?? entry.bar.color"
            :font-color="theme('tooltipFontColor')"
            :font-size="theme('tooltipFontSize')"
          />
        </g>
      </g>
      <g v-if="activeBar">
        <ChartTooltip
          visible
          :x="activeBar.tooltipX"
          :y="activeBar.tooltipY"
          :items="[{ value: formatValue(activeBar.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? activeBar.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
      <!-- `stacked`-only: each row's stack-total tooltip - always present (per row) upstream, just
           opacity-0 by default; ported here as `v-if="stackRowTooltipVisible(row)"` instead
           (identical visible result, avoids rendering hidden balloons). -->
      <template v-if="props.stacked">
        <g v-for="row in stackedRows" :key="row.dataIndex">
          <g v-if="stackRowTooltipVisible(row)" :opacity="barOpacity(row.dataIndex * props.target.length)">
            <ChartTooltip
              visible
              :x="row.tooltipX"
              :y="row.tooltipY"
              :items="[{ value: formatValue(row.sum) }]"
              :background-color="theme('tooltipBackgroundColor')"
              :background-opacity="theme('tooltipBackgroundOpacity')"
              :border-color="theme('tooltipBorderColor') ?? row.segments[row.segments.length - 1]?.color"
              :font-color="theme('tooltipFontColor')"
              :font-size="theme('tooltipFontSize')"
            />
          </g>
        </g>
      </template>
    </template>
  </ChartBase>
</template>
