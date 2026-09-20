<script setup lang="ts">
// Ported from `chart.brush.scatter`: one marker per (row, target) pair, positioned via the same
// axis-based `getXY()` this port already has as `useSeries` (no new coordinate math needed - see
// LineChart.vue for the identical pattern this component follows).
//
// Data model note (inherited from the original, not a limitation introduced by this port):
// `getXY()`/`useSeries` always treats exactly one axis as categorical/index-based and the other
// as each target's own numeric value - confirmed by re-reading `chart.brush.core`'s `getXY()`,
// which only ever calls the "index" axis's scale with the row's positional index, never with a
// second, independently-varying numeric field. There's no "plot arbitrary (x, y) pairs from two
// unrelated fields" mode here (or in the original) - a `ScatterChart` is a dot/strip plot (one
// categorical or index-based axis, one value axis per `target`), not a free-form x/y scatter. See
// `ScatterPage.vue`'s header comment for a demo built around this.
//
// Symbols: `circle`/`triangle`/`rectangle`/`cross`, matching `getSymbolType()`'s shape branches.
// Skips: the original's "callback returns an arbitrary image URI" symbol mode (`<image>` markers)
// - `symbol` here is a shape name or a `(key, value) => shape name` callback, not an image-URI
// callback. `cross` markers are drawn but non-interactive (no hover/click), matching the
// original's `if (symbol.uri != "cross")` guard around `.hover()`/click wiring.
//
// Interactivity: the original always recolors a marker on native hover (fill -> `scatterHoverColor`,
// stroke -> the marker's own color, doubled stroke width) *and*, independently, shows a single
// shared plain-text label above the chart's `activeEvent`-triggered marker (`drawTooltip()`,
// persists until another marker is triggered). This port keeps the hover recolor (faithful to the
// original) but, like BarChart/LineChart elsewhere in this codebase, uses the shared `ChartTooltip`
// balloon instead of the original's plainer text-only marker for both native hover and the
// persistent `activeEvent` label - documented deviation, for visual consistency with the rest of
// this codebase rather than pixel-matching the original. `hoverSync` (highlight every target's
// marker at the same row index, not just the hovered one) is ported literally.
//
// `hide`/`hideZero`/`display`("max"/"min"/"all", via the already-ported `selectDisplayBars`)/
// `opacity` are all ported. Not ported: `clip` (no brush does per-brush SVG clipping in this port
// today - same pre-existing gap as every other component), the entry animation.
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts.
// **Source read**: `drawScatter()`'s nested loop is `for (i = target index) { for (j = row
// index) { ... this.addEvent(p, j, i) ... } }` - `getXY()`'s outer array is indexed by target,
// each entry's `x`/`y`/`value` arrays indexed by row - so `addEvent(p, j, i)` is
// `addEvent(elem, dataIndex=j/*row*/, targetIndex=i/*target*/)`, **per marker**, matching this
// port's existing `points` computed exactly (`index: i /* row */`, `key /* target */` per point -
// see the inner-loop variable names there, which already use `i` for the row loop for the same
// reason). Confirmed `addEvent` is called **unconditionally for every symbol type, including
// `cross`**: the `if(symbol.uri != "cross")` guard in `createScatter()` only wraps the hover-
// recolor `.attr()`/`.hover()` wiring (and the `cursor:pointer` style) - `this.addEvent(p, j, i)`
// in `drawScatter()` is a separate, later call with no such guard, so a `cross` marker still
// forwards `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` even though it stays visually
// non-interactive (no recolor, no `activeEvent`/hover-tooltip involvement) - both properties
// ported faithfully below: `cross` markers get `forwardEvent` wiring but keep `onPointOver`/
// `onPointOut`/`onPointEvent`'s existing early-return guard and no `cursor:pointer` style.
// `hideZero`-skipped points never reach `points` at all (filtered before the marker is ever
// created, matching the source's own `continue` before `createScatter()`/`addEvent()` run), so no
// extra zero-value guard is needed here (unlike `bar.js`'s explicit `value !== 0` skip -
// `scatter.js`'s `addEvent` has no equivalent guard of its own).
//
// `stacked`: ported from `stackscatter.js`, source-confirmed to be a genuinely thin wrapper -
// `{ extend: "chart.brush.scatter", draw() { return this.drawScatter(this.getStackXY()) } }`,
// nothing else. `drawScatter()` never references another target's data (each marker is drawn at
// its own point, independent of any other target/row), so swapping the point source is the whole
// change - see `LineChart.vue`'s matching header comment for why `useStackedSeries` is a drop-in
// here. Implemented as a boolean prop (see PORT_STATUS.md's design-decision writeup) rather than a
// separate `StackScatterChart` component.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { isScatterHighlighted, resolveScatterSymbol, scatterTrianglePoints } from '../composables/useScatter'
import { selectDisplayBars, toSeriesScale, useSeries, useStackedSeries } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, BarDisplayMode, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ScatterSymbol, ThemeName } from '../types'

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
    /** Marker shape, or a `(key, value) => shape` callback (per-point shape). Default `"circle"`. */
    symbol?: ScatterSymbol | ((key: string, value: number) => ScatterSymbol)
    /** Marker size in px (width/height of its bounding box). */
    size?: number
    /** Hide markers entirely except while hovered/active. */
    hide?: boolean
    /** Skip drawing a marker whose value is exactly 0. */
    hideZero?: boolean
    /** When hovering/activating one marker, also highlight every other target's marker at the same row index. */
    hoverSync?: boolean
    /** Stacks each target on top of the previous one (cumulative sum along the range axis),
     * instead of each plotting its own independent value. Ported from `stackscatter.js` (a thin
     * wrapper swapping `getXY()` for `getStackXY()` - see this file's header comment). */
    stacked?: boolean
    /** Marker opacity (fill and stroke). */
    opacity?: number
    colors?: string[]
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Shows a persistent value label on the marker(s) holding each target's max value, min value, or on every marker. */
    display?: BarDisplayMode
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that persistently highlights a marker (and shows its value label) until another marker is triggered. `null` (default) disables the interaction. */
    activeEvent?: string | null
    /** Formats the value shown in tooltips/labels. Default: the raw value. */
    format?: (value: number) => string | number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    symbol: 'circle',
    size: 7,
    hide: false,
    hideZero: false,
    hoverSync: false,
    stacked: false,
    opacity: 1,
    colors: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    display: undefined,
    activeEvent: null,
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

/** Forwards a per-element DOM event for marker `p` - see this file's header comment. Fires for
 * every symbol including `cross`, matching `addEvent`'s own unguarded call site. */
function forwardEvent(type: ChartElementEventType, p: Point, e: MouseEvent) {
  // See LineChart.vue's `forwardEvent` for why this cast is needed and sound.
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: p.index,
    dataKey: p.key,
    data: props.data[p.index] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')

// `area` (padding/plot-area geometry) isn't destructured here - like `BarChart.vue`/
// `LineChart.vue`, nothing in this file needs it: `ax.scale()`/`ay.scale()` (via
// `toSeriesScale()`) already return absolute, padding-inclusive pixel coordinates, so there's no
// separate area.x/area.y translate to apply (a previous version of this file double-applied that
// offset via 4 redundant `<g transform="translate(area.x, area.y)">`s - fixed; see
// `useChartLayout.ts`'s header comment).
const { axisX, axisY } = useChartLayout(
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

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

interface Point {
  /** Row index - the identity `hoverSync` groups markers by. */
  index: number
  x: number
  y: number
  value: number
  color: string
  key: string
  symbol: ScatterSymbol
  isDisplay: boolean
}

const points = computed<Point[]>(() => {
  const out: Point[] = []
  const rows = dataRef.value
  const displayFlags = props.target.map((key) => selectDisplayBars(rows, key, props.display ?? null))

  series.value.forEach((pts, j) => {
    const key = props.target[j]
    for (let i = 0; i < pts.x.length; i++) {
      const value = pts.value[i]
      if (value === null || value === undefined) continue
      if (props.hideZero && value === 0) continue

      out.push({
        index: i,
        x: pts.x[i],
        y: pts.y[i],
        value,
        color: pickColor(j),
        key,
        symbol: resolveScatterSymbol(props.symbol, key, value),
        isDisplay: displayFlags[j][i],
      })
    }
  })
  return out
})

const displayPoints = computed(() => points.value.filter((p) => p.isDisplay))

// Hover (transient) and activeEvent (persists until another marker is triggered) share the same
// "which marker(s) are highlighted" shape - see isHighlighted(). Matches LineChart's
// hover/hoveredTarget split.
const hover = ref<Point | null>(null)
const activePoint = ref<Point | null>(null)

function isHighlighted(p: Point): boolean {
  return isScatterHighlighted(p, activePoint.value ?? hover.value, props.hoverSync)
}

function markerOpacity(p: Point): number {
  if (!props.hide) return props.opacity
  return isHighlighted(p) ? props.opacity : 0
}

function markerFill(p: Point): string {
  return isHighlighted(p) ? theme('scatterHoverColor') : p.color
}

function markerStroke(p: Point): string {
  return isHighlighted(p) ? p.color : theme('scatterBorderColor')
}

function markerStrokeWidth(p: Point): number {
  return theme('scatterBorderWidth') * (isHighlighted(p) ? 2 : 1)
}

function onPointOver(p: Point) {
  if (p.symbol === 'cross') return
  hover.value = p
}

function onPointOut(p: Point) {
  if (p.symbol === 'cross') return
  hover.value = null
}

function onPointEvent(type: string, p: Point) {
  if (p.symbol === 'cross' || props.activeEvent !== type) return

  if (type === 'click') {
    activePoint.value = activePoint.value && activePoint.value.index === p.index && activePoint.value.key === p.key ? null : p
  } else {
    activePoint.value = p
  }
}

function onPointMouseOver(p: Point) {
  onPointOver(p)
  onPointEvent('mouseover', p)
}

const trianglePoints = scatterTrianglePoints
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <g v-for="(p, i) in points" :key="i" :data-series="p.key">
        <ellipse
          v-if="p.symbol === 'circle'"
          :cx="p.x"
          :cy="p.y"
          :rx="props.size / 2"
          :ry="props.size / 2"
          :fill="markerFill(p)"
          :stroke="markerStroke(p)"
          :stroke-width="markerStrokeWidth(p)"
          :opacity="markerOpacity(p)"
          style="cursor: pointer"
          @mouseover="(e) => { onPointMouseOver(p); forwardEvent('mouseover', p, e) }"
          @mouseout="(e) => { onPointOut(p); forwardEvent('mouseout', p, e) }"
          @click="(e) => { onPointEvent('click', p); forwardEvent('click', p, e) }"
          @dblclick="(e) => forwardEvent('dblclick', p, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', p, e) }"
        />
        <rect
          v-else-if="p.symbol === 'rectangle'"
          :x="p.x - props.size / 2"
          :y="p.y - props.size / 2"
          :width="props.size"
          :height="props.size"
          :fill="markerFill(p)"
          :stroke="markerStroke(p)"
          :stroke-width="markerStrokeWidth(p)"
          :opacity="markerOpacity(p)"
          style="cursor: pointer"
          @mouseover="(e) => { onPointMouseOver(p); forwardEvent('mouseover', p, e) }"
          @mouseout="(e) => { onPointOut(p); forwardEvent('mouseout', p, e) }"
          @click="(e) => { onPointEvent('click', p); forwardEvent('click', p, e) }"
          @dblclick="(e) => forwardEvent('dblclick', p, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', p, e) }"
        />
        <polygon
          v-else-if="p.symbol === 'triangle'"
          :points="trianglePoints(p.x, p.y, props.size)"
          :fill="markerFill(p)"
          :stroke="markerStroke(p)"
          :stroke-width="markerStrokeWidth(p)"
          :opacity="markerOpacity(p)"
          style="cursor: pointer"
          @mouseover="(e) => { onPointMouseOver(p); forwardEvent('mouseover', p, e) }"
          @mouseout="(e) => { onPointOut(p); forwardEvent('mouseout', p, e) }"
          @click="(e) => { onPointEvent('click', p); forwardEvent('click', p, e) }"
          @dblclick="(e) => forwardEvent('dblclick', p, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', p, e) }"
        />
        <g
          v-else
          :opacity="props.hide ? 0 : props.opacity"
          @mouseover="(e) => forwardEvent('mouseover', p, e)"
          @mouseout="(e) => forwardEvent('mouseout', p, e)"
          @click="(e) => forwardEvent('click', p, e)"
          @dblclick="(e) => forwardEvent('dblclick', p, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', p, e) }"
        >
          <line
            :x1="p.x - props.size / 2"
            :y1="p.y - props.size / 2"
            :x2="p.x + props.size / 2"
            :y2="p.y + props.size / 2"
            :stroke="p.color"
            :stroke-width="theme('scatterBorderWidth') * 2"
          />
          <line
            :x1="p.x - props.size / 2"
            :y1="p.y + props.size / 2"
            :x2="p.x + props.size / 2"
            :y2="p.y - props.size / 2"
            :stroke="p.color"
            :stroke-width="theme('scatterBorderWidth') * 2"
          />
        </g>
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
      <g v-if="props.activeEvent && activePoint">
        <ChartTooltip
          visible
          :x="activePoint.x"
          :y="activePoint.y"
          :items="[{ key: activePoint.key, value: formatValue(activePoint.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? activePoint.color"
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
