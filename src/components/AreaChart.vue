<script setup lang="ts">
// Ported from `chart.brush.area` (extends line.js): each of LineChart's line segments gets
// closed down to a baseline (y=0, or the y-axis min when startZero is false) and filled, per
// createLine()'s children + AreaBrush.drawArea()'s `LineTo(x2,y).LineTo(x1,y).ClosePath()`.
// The line stroke on top is optional (`line` prop, default true, matches AreaBrush.setup).
// Not ported: `opacity` as a per-row callback (`getOpacity()`'s `(data, rowIndex) => number` form;
// this port's `opacity` prop is number-only).
//
// `display: "max"|"min"|"all"`: ported from `drawArea()`'s own `if(this.brush.display) {
// this.createTooltip(...) }` call (re-read `area.js` fresh for this - `display` is NOT dead config
// here the way `active`/`activeEvent` are, since `drawArea()` calls `createTooltip()` directly,
// unlike `setActiveEffects()`/the `activeEvent` listener wiring which only ever happen in
// `drawLine()`). **Faithfully ported nuance**: the original only calls `createTooltip()` inside
// the `if(this.brush.line)` branch - i.e. `display` markers require `line=true`, same as
// `active`/`activeEvent` only affecting the (optional) outline stroke - with `line=false` there's
// no line element and no display markers either, matching the original exactly (not just the
// active/activeEvent precedent). See `LineChart.vue`'s matching header comment for the shared
// `max`/`min`/`all` selection logic (reads `useSeries()`'s already-computed per-point `max`/`min`
// flags) and the same all-ties-shown deviation from the original's one-tooltip-per-line quirk.
//
// Simplification: the original supports an area brush on either axis orientation; this port
// always treats Y as the value (range) axis and X as the categorical one, which covers the
// typical area-chart use case (see README).
//
// `active`/`activeEvent`: AreaBrush.setup redeclares these (copy-pasted from LineBrush.setup),
// but area.js overrides `draw()` to call its own `drawArea()` instead of line.js's `drawLine()`
// - and `drawLine()` is the ONLY place `setActiveEffects()`/the `activeEvent` listener wiring
// happen. So in the original, `active`/`activeEvent` are dead config for area charts: declared,
// inherited, but never read. Treating that as an inherited-but-unwired gap rather than an
// intentional no-op, this port wires them up the way `drawLine()` would if `drawArea()` called
// it: `drawArea()` does still register the optional outline stroke via `addLineElement()` when
// `line=true` (identically to line.js), so - consistent with line.js's actual opacity math -
// dimming/highlighting here affects only that outline stroke, never the translucent fill; with
// `line=false` there's no registered element, so active/activeEvent have no visible effect,
// same as line.js would produce for a brush with an empty `lineList`.
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts.
// **Source read**: `area.js`'s `drawArea()` declares its whole-chart `g` group ONCE, *outside* the
// per-target loop (`var g = this.chart.svg.group()`, before `for (var k = 0; k < path.length;
// k++)`), then calls `this.addEvent(g, null, k)` on that SAME shared `g` once per target `k`,
// unconditionally (not gated by `this.brush.line`, unlike `display`/the outline-only `active`
// wiring). Literally reproducing this would mean every click/hover anywhere on the *entire* area
// chart fires one `chart.emit()` per target (N separate emissions per interaction, each with a
// different `dataKey` but the identical click coordinates) with no way to tell which target's
// shape was actually under the cursor - `addEvent`'s shared-`g`/per-target-loop shape here is a
// side effect of `g` being declared before the loop (unlike `line.js`'s `createLine()`, which
// returns a *fresh* per-target `<g>` `p` each iteration - see `LineChart.vue`). **Deviation
// (deliberate, matching this file's own precedent for `active`/`activeEvent` above)**: instead of
// reproducing that indiscriminate multi-fire quirk, `forwardEvent` is wired onto this port's
// existing *per-target* wrapping `<g :key="j">` (the same element that already groups each
// target's fill path(s) + optional line sub-group) - giving a real, distinguishable `dataKey` per
// actually-interacted target, exactly like `LineChart.vue`'s per-series wiring. Unlike
// `active`/`activeEvent` (deliberately scoped to the outline, `line=true` only), this forwarding
// is NOT gated by `props.line` - matching `addEvent(g, null, k)`'s own unconditional-per-target
// call in the source, it fires for hovers/clicks on the fill alone too. `dataIndex`/`data` are
// always `null` (area.js's `addEvent` call never passes a row index, same as `line.js`).
//
// `stacked`: ported from `stackarea.js`, source-confirmed to be `{ extend: "chart.brush.area",
// draw() { return this.drawArea(this.getStackXY()) } }` - nothing else changes on paper. But
// **`drawArea()` itself, unlike `drawLine()`/`drawScatter()`, is NOT indifferent to which points
// come in**: re-reading `drawArea()` fresh (not assuming stackline/stackscatter's "trivial swap"
// finding would carry over) shows every target's FILL is closed down to the exact same fixed
// baseline (`y = axis.y(startZero ? 0 : axis.y.min())`, this port's existing `baselineY`) -
// unchanged by stacking. With `getStackXY()`'s cumulative y-values, that means every target's fill
// would span baseline-to-its-own-cumulative-height (e.g. target 2's fill covers the FULL region
// under its curve, including the region already covered by target 1's fill beneath it), not a
// clean non-overlapping "band" from the previous cumulative height to this one. Upstream makes
// this look right anyway via `g.prepend(p)` (each target prepended, so the *first*-processed/
// lowest-cumulative target ends up LAST in DOM = painted on top) plus translucent fill-opacity -
// the smallest-cumulative layer visually occludes the bottom of every taller layer beneath it,
// leaving each layer's true "band" as the only unoccluded region. That's a fragile combination
// (relies on z-order AND opacity blending, and still shows blended/muddied colors in the
// overlapping region, not clean per-band colors).
// **Deviation (deliberate)**: rather than replicate the z-order/opacity occlusion trick, this port
// computes each stacked band's fill directly - the bottom edge follows the *previous* target's own
// y-curve (or the shared baseline for the first target) instead of always the baseline, producing
// a true non-overlapping "band" polygon per target (top edge = this target's curve, bottom edge =
// previous target's curve, both at the same x positions - `useStackedSeries` guarantees every
// target shares the same row/x positions). This directly satisfies "each series' band starts where
// the previous one's ends, not from zero" with clean, fully-opaque-looking per-band colors, and
// needs no z-order trickery - chosen because it's simpler, more robust (doesn't depend on paint
// order or a translucent fill-opacity to "read" correctly), and is the visual any stacked-area
// consumer actually expects, at the cost of not literally reproducing upstream's occlusion-based
// rendering mechanism (the top-edge cumulative *math* - the part that actually matters for
// correctness - is still ported exactly via `useStackedSeries`). Implemented as a boolean prop
// (see PORT_STATUS.md's design-decision writeup) rather than a separate `StackAreaChart`
// component - `line`/`display`/`active`/`activeEvent`/etc. all keep working unchanged on top of
// stacked data, same as every other prop already does.
import { computed, ref, toRef } from 'vue'
import { lineActiveOpacity } from '../composables/useActive'
import { useChartLayout } from '../composables/useChartLayout'
import { curvePoints, toSeriesScale, useSeries, useStackedSeries } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, BarDisplayMode, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, LineSymbol, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    target: string[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    symbol?: LineSymbol
    /** Close the fill at y=0 (default) instead of the y-axis's minimum value. */
    startZero?: boolean
    /** Draw the line stroke on top of the fill. */
    line?: boolean
    /** Stacks each target's fill on top of the previous one (cumulative sum along the range axis,
     * each band running from the previous target's cumulative height to this one's) instead of
     * each independently filling down to the baseline. Ported from `stackarea.js` - see this
     * file's header comment for the band-fill deviation from upstream's literal z-order/opacity
     * occlusion approach. */
    stacked?: boolean
    colors?: string[]
    opacity?: number
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Highlights (full opacity) the outline of the series matching this target key or keys, dimming the rest. Ported from line.js's `active` (inherited by area.js). */
    active?: string | string[] | null
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that highlights the hovered/clicked series' outline. `null` (default) disables the interaction, per line.js's `activeEvent`. */
    activeEvent?: string | null
    /** Shows a persistent value label on the point(s) holding each target's max value, min value,
     * or on every point. Default (omitted) shows none - matches `area.js`'s `display` option
     * (default `null`). Requires `line: true` (see this file's header comment). */
    display?: BarDisplayMode
    /** Formats the value shown in the hover tooltip and any `display` label. Default: the raw value. */
    format?: (value: number) => string | number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    symbol: 'normal',
    startZero: true,
    line: true,
    stacked: false,
    colors: undefined,
    opacity: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    active: null,
    activeEvent: null,
    display: undefined,
    format: undefined,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

/** Forwards a per-element DOM event for series `key`'s wrapping `<g>` (fill + optional line) -
 * see this file's header comment. */
function forwardEvent(type: ChartElementEventType, key: string, e: MouseEvent) {
  // See LineChart.vue's `forwardEvent` for why this cast is needed and sound.
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, { dataIndex: null, dataKey: key, data: null, event: e })
}

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')

// `area` IS still needed here (unlike `LineChart.vue`/`BarChart.vue`, which dropped it entirely) -
// `baselineY` below uses `area.value.y2` directly as an already-absolute fallback coordinate for a
// non-range y-axis, not as a translate offset. The redundant `<g transform="translate(area.x,
// area.y)">` that double-applied the offset on top of `toSeriesScale()`'s already-absolute
// coordinates has been removed from the template below (see `useChartLayout.ts`'s header comment).
const { area, axisX, axisY } = useChartLayout(
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

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))
const xType = computed(() => axisX.value.type)
const yType = computed(() => axisY.value.type)

// Both computeds stay live (not conditionally constructed) so toggling `props.stacked` at runtime
// reacts correctly - see this file's header comment.
const seriesNormal = useSeries(dataRef, targetRef, xScale, yScale, xType, yType)
const seriesStacked = useStackedSeries(dataRef, targetRef, xScale, yScale, xType, yType)
const series = computed(() => (props.stacked ? seriesStacked.value : seriesNormal.value))

const fillOpacity = computed(() => props.opacity ?? theme('areaBackgroundOpacity'))

// `activeEvent`-driven hover override for the outline stroke only - see the top-of-file note on
// why area.js's dim/highlight never touches the fill.
const hoveredTarget = ref<string | null>(null)
const effectiveActive = computed<string | string[] | null>(() => hoveredTarget.value ?? props.active)

function lineStrokeOpacity(key: string): number {
  return lineActiveOpacity(key, effectiveActive.value, theme('lineBorderOpacity'), theme('lineDisableBorderOpacity'))
}

function onLineEvent(type: string, key: string) {
  if (props.activeEvent !== type) return

  if (type === 'click') {
    hoveredTarget.value = hoveredTarget.value === key ? null : key
  } else {
    hoveredTarget.value = key
  }
}

function onLineLeave(key: string) {
  if (props.activeEvent && props.activeEvent !== 'click' && hoveredTarget.value === key) {
    hoveredTarget.value = null
  }
}

function onPointOver(p: Point) {
  hover.value = p
  onLineEvent('mouseover', p.key)
}

function onPointOut(p: Point) {
  hover.value = null
  onLineLeave(p.key)
}

const baselineY = computed(() => {
  const ay = axisY.value
  if (ay.type !== 'range') return area.value.y2
  const value = props.startZero ? 0 : ay.scale.min()
  return ay.scale(value)
})

interface AreaSegment {
  fillPath: string
  linePath: string
  color: string
}

const segmentsByTarget = computed<AreaSegment[][]>(() =>
  series.value.map((pts, j) => {
    const segs: AreaSegment[] = []
    const { x: xs, y: ys, value: vs } = pts
    const curveX = props.symbol === 'curve' ? curvePoints(xs) : null
    const curveY = props.symbol === 'curve' ? curvePoints(ys) : null
    const baseline = baselineY.value
    // Stacked band bottom edge: the previous target's own y-curve at the same x positions
    // (straight line between its start/end points - matching how the non-stacked case's fill
    // bottom edge is also a straight line down to the baseline, not curve/step-shaped) instead of
    // the shared baseline - see this file's header comment's `stacked` deviation writeup. `null`
    // (non-stacked, or the first/base target) keeps the original baseline-anchored fill.
    const prevYs = props.stacked && j > 0 ? series.value[j - 1].y : null

    let start: number | null = null
    let end: number | null = null

    for (let i = 0; i < xs.length - 1; i++) {
      if (vs[i] !== null && vs[i] !== undefined) start = i
      if (vs[i + 1] !== null && vs[i + 1] !== undefined) end = i + 1
      if (start === null || end === null || start === end) continue

      let curve = `L ${xs[end]} ${ys[end]}`
      if (props.symbol === 'curve' && curveX && curveY) {
        curve = `C ${curveX.p1[start]} ${curveY.p1[start]}, ${curveX.p2[start]} ${curveY.p2[start]}, ${xs[end]} ${ys[end]}`
      } else if (props.symbol === 'step') {
        const sx = xs[start] + (xs[end] - xs[start]) / 2
        curve = `L ${sx} ${ys[start]} L ${sx} ${ys[end]} L ${xs[end]} ${ys[end]}`
      }

      const linePath = `M ${xs[start]} ${ys[start]} ${curve}`
      const bandBottomEnd = prevYs ? prevYs[end] : baseline
      const bandBottomStart = prevYs ? prevYs[start] : baseline
      const fillPath = `${linePath} L ${xs[end]} ${bandBottomEnd} L ${xs[start]} ${bandBottomStart} Z`

      segs.push({ fillPath, linePath, color: pickColor(j) })
    }

    return segs
  }),
)

interface Point {
  x: number
  y: number
  value: number
  color: string
  key: string
  /** Does this point qualify for a persistent `display` label? See this file's header comment. */
  isDisplay: boolean
}

const points = computed<Point[]>(() => {
  const out: Point[] = []
  series.value.forEach((pts, j) => {
    for (let i = 0; i < pts.x.length; i++) {
      const value = pts.value[i]
      if (value === null || value === undefined) continue
      const isDisplay = (props.display === 'max' && pts.max[i]) || (props.display === 'min' && pts.min[i]) || props.display === 'all'
      out.push({ x: pts.x[i], y: pts.y[i], value, color: pickColor(j), key: props.target[j], isDisplay })
    }
  })
  return out
})

// `display` markers require `line: true`, matching `drawArea()`'s own `if(this.brush.line) { ...
// if(this.brush.display) { this.createTooltip(...) } }` nesting (see this file's header comment).
const displayPoints = computed(() => (props.line ? points.value.filter((p) => p.isDisplay) : []))

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

const hover = ref<Point | null>(null)
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <g
        v-for="(segs, j) in segmentsByTarget"
        :key="j"
        :data-series="props.target[j]"
        @mouseover="(e) => forwardEvent('mouseover', props.target[j], e)"
        @mouseout="(e) => forwardEvent('mouseout', props.target[j], e)"
        @click="(e) => forwardEvent('click', props.target[j], e)"
        @dblclick="(e) => forwardEvent('dblclick', props.target[j], e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', props.target[j], e) }"
      >
        <path v-for="(seg, i) in segs" :key="i" :d="seg.fillPath" :fill="seg.color" :fill-opacity="fillOpacity" stroke="none" />
        <g
          v-if="props.line"
          :style="{ cursor: props.activeEvent ? 'pointer' : undefined }"
          @mouseover="onLineEvent('mouseover', props.target[j])"
          @mouseout="onLineLeave(props.target[j])"
          @click="onLineEvent('click', props.target[j])"
        >
          <!-- Wider invisible hit-area so a thin 2px outline is easy to hover/click. -->
          <path v-for="(seg, i) in segs" :key="`hit-${i}`" :d="seg.linePath" fill="none" stroke="transparent" stroke-width="16" style="pointer-events: stroke" />
          <path
            v-for="(seg, i) in segs"
            :key="`l-${i}`"
            :d="seg.linePath"
            fill="none"
            :stroke="seg.color"
            :stroke-opacity="lineStrokeOpacity(props.target[j])"
            :stroke-width="theme('lineBorderWidth')"
            style="pointer-events: none"
          />
        </g>
      </g>

      <g>
        <circle
          v-for="(p, i) in points"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          :r="theme('tooltipPointRadius')"
          fill="transparent"
          style="cursor: pointer"
          @mouseover="onPointOver(p)"
          @mouseout="onPointOut(p)"
          @click="onLineEvent('click', p.key)"
        />
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.x"
          :y="hover.y"
          :items="[{ key: hover.key, value: formatValue(hover.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
      <g v-if="props.display">
        <ChartTooltip
          v-for="(p, i) in displayPoints"
          :key="i"
          visible
          :x="p.x"
          :y="p.y"
          :items="[{ value: formatValue(p.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? p.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
    </template>
  </ChartBase>
</template>
