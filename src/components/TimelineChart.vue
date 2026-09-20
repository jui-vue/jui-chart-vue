<script setup lang="ts">
// Ported from `chart.brush.timeline` (395 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson): `extend: "chart.brush.core"` **directly** - no relation to any
// other brush. Read all 395 lines, plus `brush/core.js` (`getValue`/`addEvent`/`color`/`offset`),
// `base/axis.js` (`getValue`/`area`/`get`), `grid/block.js` (`domain()`/`rangeBand()`/index-lookup
// semantics) and `base/builder.js` (`chart.color()`) before writing this file - see PORT_STATUS.md
// for why this is a Phase C ("complex/specialized") item, not a routine axis-based port.
//
// **The data/visual model, confirmed from `drawBefore()`/`drawGrid()`/`drawLine()`/`drawData()`,
// NOT assumed from the "timeline" name**: a Gantt-style schedule. The y-axis is a `"block"`
// (categorical) axis whose domain is the set of LANE labels (`axis.y.domain()`); `data` is a FLAT
// array of events, each reading exactly 3 fields via `getValue()` - `key` (which lane, matched
// against the y-domain by VALUE, not by row position - `keyToIndex[domains[i]] = i` then
// `keyToIndex[event.key]`, so multiple events legitimately share one lane), `stime`/`etime`
// (a start/end value pair on a plain numeric x-axis, defaulting to `0`/`axis.x.max()` when
// omitted). This is superficially close to `RangeBarChart`'s `[low, high]` tuple model but is
// **NOT a fit for `useRangeSeries`**, confirmed by re-reading `useRangeSeries`'s own doc comment
// and `rangebar.js`/`rangecolumn.js` side by side with this file: `useRangeSeries` reads ONE block-
// axis coordinate per ROW (`data[i]`, `i` = the row's OWN position, block axis evaluated `xFn(i)`)
// plus a 2-ELEMENT-ARRAY range value per `target` field - timeline's lane position is instead a
// VALUE LOOKUP against the block domain (an event's row position `i` is unrelated to its lane
// index), and its start/end are two SEPARATE scalar fields (`stime`/`etime`), not one `[low,high]`
// array field - a genuinely different shape needing its own lookup+geometry logic, all in
// `useTimeline.ts` (`timelineKeyIndex`/`timelineRowIndex`/`timelineBarGeometry`/`timelineConnectors`
// /`timelineActiveBarLayout`/`timelineOverlayStyle`/`timelineBarFillMode`), each unit-tested with
// hand-traced values.
//
// **Axis-type decision**: `drawBefore()`'s ticks call is `this.axis.x.ticks(this.axis.get("x")
// .step)` - the plain SINGLE-ARGUMENT `ticks(step)` this port's existing `"range"` (linear numeric)
// x-axis already implements (`RangeAxisResult.ticks`/`.values`, see `useAxis.ts`). **Unlike
// `selectbox.js`** (which called the date/time-scale-ONLY two-argument `ticks(unit, interval)` -
// see that component's own header comment / PORT_STATUS.md), grepping this entire 395-line file
// confirms NO call into any date/time-specific scale method anywhere - `timeline.js` is already
// axis-agnostic. So there is no substitution or scope deviation to make here at all: the caller
// just represents time as plain numbers (e.g. day offsets, or epoch millis) on a `"range"` x-axis,
// exactly like every other numeric axis in this port, and an optional `xFormat` prop (see below)
// renders those numbers as date-like labels for a realistic-looking demo.
//
// **Why this component builds its own `<svg>` root instead of wrapping `<ChartBase>`** (a genuine,
// confirmed-from-source reason, not an arbitrary style choice): `drawGrid()`/`drawLine()` draw a
// COMPLETE custom axis chrome of their own - a lane-title column (replacing a standard y-axis
// label column) and a column-header row embedded inside the plot with its own tick labels
// (replacing a standard bottom x-axis) - which only coexists cleanly with the engine's own default
// axis-grid rendering because a real usage sets `axis.x.hide`/`axis.y.hide: true` (`grid/core.js`'s
// `hide` option, confirmed via `grep`) to suppress it. This port's `AxisConfig`/`ChartBase.vue` has
// no per-axis `hide` - `ChartBase`'s X/Y tick-label `<text>` elements render unconditionally,
// independent of `showGrid` (see `ChartBase.vue`'s own template) - so wrapping it here would
// genuinely double-render axis text (a real visual bug, not a hypothetical one), unlike e.g.
// `HeatmapChart.vue`, which also has a block y-axis but never draws its OWN separate row-label
// text, so `ChartBase`'s default labels are the only ones and there's no clash. Matches
// `PyramidChart.vue`'s/`ArcEqualizerChart.vue`'s own precedent for a non-`ChartBase` component -
// `useChartLayout`/`useAxis` are still used for all scale/tick/band math (max engine reuse), only
// the template differs.
//
// **The default per-event color, confirmed from `drawData()`'s `this.color(i, 0)` re-read against
// `brush/core.js`'s `color(key1,key2)`/`base/builder.js`'s `chart.color(key,colors)` line by
// line**: `key2=0` is NOT `undefined`, so `colorIndex` is the CONSTANT `0` and `rowIndex=i` is only
// ever used when `colors` is a function - with the source's own default (`colors: null`, inherited
// from `chart.brush.core`), EVERY event gets the exact same single color (`theme.colors[0]`), not a
// per-row cycle. This is the SAME shape `HeatmapChart.vue` already found and deliberately deviated
// from for `heatmap.js`'s analogous `this.color(i, null)` (see that file's header comment) - this
// port's established `colors?: string[]` convention (never a function) already replaces that
// pattern everywhere else with "indexed by row, falling back to the theme's palette CYCLE" (not a
// constant), because a monotone default would defeat the entire point of a visually-scannable
// schedule. Ported the same deliberate deviation here: `colors?: string[]` indexed by EVENT index,
// falling back to `theme('colors')`'s per-index cycle - not the source's literal single-color
// default.
//
// **Row index 0 is a conventional HEADER row, not a real lane** - confirmed from `drawGrid()`'s
// `fill = (j==0) ? columnColor : ...` and `drawLine()`'s column-tick labels being positioned at
// `axis.y(0)` (rendered INSIDE row 0) plus the final baseline line sitting at row 0's own bottom
// edge, separating it from the real lanes below. A real usage's y-axis domain therefore
// conventionally starts with an empty/placeholder label (e.g. `''`) as domain index 0 - demoed as
// such in `TimelinePage.vue`. Events are not expected to target this row (nothing in the source
// prevents it, but nothing about the header styling is meaningful for a real event either).
//
// **A confirmed, unguarded upstream edge case, preserved not "fixed"**: an event's `key` that
// doesn't match ANY lane label resolves `keyToIndex[key]` to `undefined`; `axis.y(undefined)` (this
// port's `OrdinalScale`) returns `null`, and `null - h/2` arithmetic coerces `null` to `0` (real JS
// semantics) - so such an event silently renders at `y = -h/2` (just above the very top of the
// chart) rather than being skipped or throwing. Ported literally as `laneY = 0` when the lookup
// misses, not defended against.
//
// **Interaction model, confirmed from `setActiveRect`/`setHoverRect`/`setActiveBar`/`setHoverBar`,
// re-read line by line and reduced to one steady-state formula per mode** - see `useTimeline.ts`'s
// own doc comments on `timelineOverlayStyle`/`timelineBarFillMode` for the algebraic derivation:
// this component's click handler sets BOTH `activeIndex` AND `hoverIndex` to the clicked event
// together (not just `activeIndex`), which is what makes those two pure functions correct replacements
// for both `setActiveRect`+`setHoverRect` and `setActiveBar`+`setHoverBar` without a separate
// "just clicked" code path. `activeType="rect"` (default) highlights a per-event overlay rect
// spanning the bar's own x-span at (almost) full row height; `activeType="bar"` instead grows the
// bar itself to the full row band height and reveals an `activeTooltip`-formatted label above it -
// **`r2` (the rect-mode hit-target overlay) is only rendered in `"rect"` mode** (in `"bar"` mode the
// source sets it `visibility:hidden` with no listeners attached at all - functionally dead, so this
// port skips creating it there instead of rendering an inert element). The lane-title text's own
// separate `mouseover` (`timeline.title` upstream) is ported as a `titleHover` emit; the per-event
// active click (`timeline.active` upstream) as an `active` emit - both genuinely custom event names
// with no prior precedent in this port (every earlier component only ever forwards the 5 standard
// DOM events - see `ChartElementEventPayload`) since no earlier brush called `chart.emit()` with a
// non-standard name. `activeEvent` (which DOM event triggers activation) is narrowed to
// `'click' | 'dblclick'` rather than the source's fully-dynamic-any-event-name config - both already
// members of this port's own standard forwarded set, and the source's own default/every realistic
// use is `'click'` - documented as a deliberate, narrow simplification of a knob nothing exercises
// differently.
//
// **Not ported**: `clip`/`useEvent` (pre-existing, established gap - no brush in this port does
// per-brush SVG clipping or an event-toggle, matching `PinChart.vue`'s/`RangeBarChart.vue`'s own
// header comments). No synthetic generic `ChartTooltip` added (unlike `RangeBarChart.vue`/
// `ArcEqualizerChart.vue`'s own port-only tooltip additions) - the source already ships a rich,
// multi-layered hover/label system of its own (row stripe, overlay tint, lane-title mouseover,
// `activeTooltip` text); layering a second, generic tooltip on top would be redundant, not a
// meaningful analog to the low/high-value tooltip those simpler range-value brushes actually lacked.
// **`active`'s initial-value indexing, a deliberate, documented simplification**: the source's
// `active` config indexes into `cacheRect` - the COMPACTED array of only successfully-rendered
// (non-`continue`d) events - not the raw `data` array position, whenever an earlier event was
// itself skipped as invalid (negative/NaN span). This port's `active` prop instead always indexes
// the raw `data` array position directly (the same index used for `dataIndex` in event forwarding
// and for click/hover-driven activation) - a single coherent index space, with no user-visible
// difference except in the doubly-unusual combination of an explicit initial `active` value AND an
// earlier invalid event, which no demo here exercises.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import {
  timelineActiveBarLayout,
  timelineBarFillMode,
  timelineBarGeometry,
  timelineConnectors,
  timelineKeyIndex,
  timelineOverlayStyle,
  timelineRowFillKind,
  timelineRowIndex,
  type TimelineConnector,
} from '../composables/useTimeline'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** One row per EVENT (not per lane) - each row reads `key` (which lane), `stime`/`etime`
     * (defaulting to `0`/the x-axis domain max when omitted). See this file's header comment. */
    data: DataRow[]
    /** Must resolve to a `"range"` (numeric) axis - plain numbers, e.g. day offsets or epoch
     * millis; use `xFormat` to render them as date-like labels. */
    axisX: AxisConfig
    /** Must resolve to a `"block"` axis whose domain is the lane labels - conventionally starting
     * with an empty/placeholder entry (e.g. `''`) as a header row, see this file's header comment. */
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    /** Indexed by EVENT index - see this file's header comment on why this deviates from the
     * source's own literal (monotone) default. */
    colors?: string[]
    /** `brush.barSize` - a constant, or a per-event callback `(row, index) => number`. Default `7`. */
    barSize?: number | ((row: DataRow, index: number) => number)
    /** `brush.lineWidth` - the inter-event connector line's stroke width. Default `1`. */
    lineWidth?: number
    /** `brush.active` - initial active event index. `null` (default) or a negative number means no
     * initial selection (matches `if (active < 0) return`); see this file's header comment on
     * indexing. */
    active?: number | null
    /** `brush.activeEvent` - which click triggers activation. Default `'click'`; see this file's
     * header comment on why this is narrowed from the source's any-DOM-event-name config. */
    activeEvent?: 'click' | 'dblclick'
    /** `brush.activeType` - `'rect'` (default) highlights a row-height overlay around the active
     * bar; `'bar'` grows the bar itself and reveals `activeTooltip`'s label. */
    activeType?: 'rect' | 'bar'
    /** `brush.activeTooltip` - formats the label shown above the active bar in `activeType="bar"`
     * mode only. */
    activeTooltip?: (row: DataRow, index: number) => string | number
    /** `brush.hideTitle` - hides the lane-title column entirely (every row's title text, not just
     * the header's). Default `false`. */
    hideTitle?: boolean
    /** Port-only (see header comment - `AxisConfig` has no `format`): formats each x-axis tick
     * shown in the header row. Defaults to the raw tick value. */
    xFormat?: (tick: number, index: number) => string | number
    /** Port-only: formats each lane's title text. Defaults to the raw lane label. */
    yFormat?: (key: string | number, index: number) => string | number
    title?: string
  }>(),
  {
    width: 640,
    height: 400,
    theme: 'classic',
    padding: undefined,
    colors: undefined,
    barSize: 7,
    lineWidth: 1,
    active: null,
    activeEvent: 'click',
    activeType: 'rect',
    activeTooltip: undefined,
    hideTitle: false,
    xFormat: undefined,
    yFormat: undefined,
    title: undefined,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
  /** `timeline.active` upstream - fired when an event becomes the active one (see `activeEvent`). */
  active: [payload: { data: DataRow; event: MouseEvent }]
  /** `timeline.title` upstream - fired on hovering a lane's title text. */
  titleHover: [payload: { key: string | number; event: MouseEvent }]
}>()

function forwardEvent(type: ChartElementEventType, index: number, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: index,
    dataKey: null,
    data: props.data[index] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')
const { area, padding, axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

function resolveBarSize(row: DataRow, i: number): number {
  return typeof props.barSize === 'function' ? props.barSize(row, i) : props.barSize
}

// `startX`/`titleX`/`rowWidth`, ported literally from `drawBefore()`/`drawGrid()`: `axis.area("x")`
// always equals `padding.left` in this port's own `PlotArea` (see `useChartLayout.ts`), so
// `titleX = area.x - startX` reduces to `padding.left - startX` directly.
const startX = computed(() => (props.hideTitle ? 0 : padding.value.left))
const titleX = computed(() => padding.value.left - startX.value)
const rowWidth = computed(() => area.value.width + startX.value)

const laneKeyIndex = computed(() => (axisY.value.type === 'block' ? timelineKeyIndex(axisY.value.ticks) : {}))
const rowBandHeight = computed(() => (axisY.value.type === 'block' ? axisY.value.band : 0))

interface RowBackground {
  index: number
  y: number
  fill: string
  label: string | number
  domain: string | number
}

const rowBackgrounds = computed<RowBackground[]>(() => {
  if (axisY.value.type !== 'block') return []
  const ay = axisY.value
  const out: RowBackground[] = []

  for (let j = 0; j < ay.ticks.length; j++) {
    const domain = ay.ticks[j]
    const kind = timelineRowFillKind(j)
    const fill = kind === 'header' ? theme('timelineColumnBackgroundColor') : kind === 'even' ? theme('timelineEvenRowBackgroundColor') : theme('timelineOddRowBackgroundColor')
    out.push({
      index: j,
      y: ay.values[j],
      fill,
      label: props.yFormat ? props.yFormat(domain, j) : domain,
      domain,
    })
  }

  return out
})

const stripeHoverIndex = ref<number | null>(null)

interface HeaderTick {
  x: number
  label: string | number
  showLine: boolean
  lineColor: string
  lineVisible: boolean
}

// Vertical divider lines + column tick labels, ported from `drawLine()`. `headerY` = `axis.y(0)`
// (the header row's own centered pixel position, where the column tick labels sit).
const headerY = computed(() => (rowBackgrounds.value.length > 0 ? rowBackgrounds.value[0].y : 0))

const headerTicks = computed<HeaderTick[]>(() => {
  if (axisX.value.type !== 'range' || axisY.value.type !== 'block') return []
  const ax = axisX.value
  const out: HeaderTick[] = []

  for (let i = 0; i < ax.ticks.length; i++) {
    out.push({
      x: ax.values[i],
      label: props.xFormat ? props.xFormat(ax.ticks[i], i) : ax.ticks[i],
      showLine: i < ax.ticks.length - 1,
      lineColor: i === 0 ? theme('timelineHorizontalLineColor') : theme('timelineVerticalLineColor'),
      lineVisible: !(startX.value === 0 && i === 0),
    })
  }

  return out
})

interface TimelineBar {
  index: number
  row: DataRow
  x: number
  y: number
  width: number
  height: number
  valid: boolean
  color: string
  connectorFrom: { x: number; y: number }
  connectorTo: { x: number; y: number }
  laneY: number
}

const bars = computed<TimelineBar[]>(() => {
  if (axisX.value.type !== 'range' || axisY.value.type !== 'block') return []
  const ax = axisX.value
  const keyIndex = laneKeyIndex.value
  const rows = dataRef.value
  const out: TimelineBar[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const stime = row.stime !== undefined ? (row.stime as number) : 0
    const etime = row.etime !== undefined ? (row.etime as number) : ax.scale.max()
    const x1 = ax.scale(stime) as number
    const x2 = ax.scale(etime) as number

    const laneIndex = timelineRowIndex(row.key, keyIndex)
    // `null - h/2` upstream coerces to `-h/2` (see this file's header comment) - reproduced here
    // as `laneY = 0` on a missed lookup, giving the identical final `y` after `timelineBarGeometry`.
    const laneY = laneIndex !== undefined ? axisY.value.values[laneIndex] : 0

    const h = resolveBarSize(row, i)
    const geom = timelineBarGeometry(x1, x2, laneY, h)

    out.push({
      index: i,
      row,
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      valid: geom.valid,
      color: pickColor(i),
      connectorFrom: { x: x2, y: laneY },
      connectorTo: { x: x1, y: laneY },
      laneY,
    })
  }

  return out
})

const connectors = computed<TimelineConnector[]>(() => {
  const list = bars.value
  const starts = list.map((b) => b.connectorTo)
  const ends = list.map((b) => b.connectorFrom)
  const valid = list.map((b) => b.valid)
  return timelineConnectors(starts, ends, valid)
})

// Ported from `drawData()`'s `l = svg.line({..., stroke: color, ...})` - each connector's stroke is
// the color of its OWN origin event (`color` in that same loop iteration). `timelineConnectors`'s
// output is a COMPACTED array (one entry per valid origin event, `i < len-1`) - not 1:1 with `bars`
// by array position whenever an earlier event was invalid - so this mirrors `timelineConnectors`'s
// exact same filter predicate (`i < length-1 && valid[i]`) to stay aligned with it index-for-index,
// rather than indexing `bars` directly by the connector's own array position (a real bug caught
// before this file's own first test run - see PORT_STATUS.md).
const connectorColors = computed<string[]>(() =>
  bars.value
    .slice(0, -1)
    .filter((b) => b.valid)
    .map((b) => b.color),
)

const validBars = computed(() => bars.value.filter((b) => b.valid))

const initialActive = props.active != null && props.active >= 0 ? props.active : null
// `hoverIndex` starts equal to `activeIndex`, not `null` - reproduces the source's OWN initial
// `setActiveRect`/`setActiveBar` call (run unconditionally when `active` is configured, independent
// of any hover) via the same `hoverIndex === activeIndex` equivalence `timelineOverlayStyle`'s/
// `timelineBarFillMode`'s own doc comments derive for the click handler - without this, the
// initial active row would render merely "visible" (hover-tinted) instead of "active"-tinted,
// since `null !== initialActive` would fail the `isHovered` half of `active = isHovered &&
// isActive`. Caught by this file's own Playwright verification, not assumed correct - see
// PORT_STATUS.md.
const activeIndex = ref<number | null>(initialActive)
const hoverIndex = ref<number | null>(initialActive)

function activate(index: number, row: DataRow, e: MouseEvent) {
  activeIndex.value = index
  hoverIndex.value = index
  emit('active', { data: row, event: e })
}

function onBarClick(bar: TimelineBar, e: MouseEvent) {
  forwardEvent('click', bar.index, e)
  if (props.activeType === 'bar' && props.activeEvent === 'click') activate(bar.index, bar.row, e)
}
function onBarDblClick(bar: TimelineBar, e: MouseEvent) {
  forwardEvent('dblclick', bar.index, e)
  if (props.activeType === 'bar' && props.activeEvent === 'dblclick') activate(bar.index, bar.row, e)
}
function onOverlayClick(bar: TimelineBar, e: MouseEvent) {
  if (props.activeEvent === 'click') activate(bar.index, bar.row, e)
}
function onOverlayDblClick(bar: TimelineBar, e: MouseEvent) {
  if (props.activeEvent === 'dblclick') activate(bar.index, bar.row, e)
}

function overlayStyle(bar: TimelineBar) {
  const style = timelineOverlayStyle(bar.index, hoverIndex.value, activeIndex.value)
  return {
    fill: style.active ? theme('timelineActiveLayerBackgroundColor') : theme('timelineHoverLayerBackgroundColor'),
    stroke: style.active ? theme('timelineActiveLayerBorderColor') : theme('timelineHoverLayerBorderColor'),
    fillOpacity: style.visible ? theme('timelineLayerBackgroundOpacity') : 0,
    strokeWidth: style.visible ? 1 : 0,
  }
}

function barFill(bar: TimelineBar) {
  const mode = timelineBarFillMode(bar.index, hoverIndex.value, activeIndex.value)
  if (mode === 'active') return theme('timelineActiveBarBackgroundColor') || bar.color
  if (mode === 'hover') return theme('timelineHoverBarBackgroundColor') || bar.color
  return bar.color
}

function barLayout(bar: TimelineBar) {
  if (props.activeType === 'bar' && bar.index === activeIndex.value) {
    return timelineActiveBarLayout(bar.laneY, rowBandHeight.value)
  }
  return { y: bar.y, height: bar.height }
}

function barTooltipText(bar: TimelineBar): string | number {
  return props.activeTooltip ? props.activeTooltip(bar.row, bar.index) : ''
}

function onGroupMouseout() {
  hoverIndex.value = null
}

const overlayHeight = computed(() => area.value.height - 6)
const overlayY = computed(() => area.value.y + 3)
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <!-- drawGrid(): lane row backgrounds + (optional) lane title column -->
    <g>
      <g v-for="rb in rowBackgrounds" :key="`row-${rb.index}`">
        <rect
          :x="titleX"
          :y="rb.y - rowBandHeight / 2"
          :width="rowWidth"
          :height="rowBandHeight"
          :fill="rb.index === stripeHoverIndex ? theme('timelineHoverRowBackgroundColor') : rb.fill"
          @mouseover="() => { if (rb.index > 0) stripeHoverIndex = rb.index }"
          @mouseout="() => { if (rb.index > 0) stripeHoverIndex = null }"
        />
        <text
          v-if="startX > 0"
          :x="titleX + 5"
          :y="rb.y + theme('timelineTitleFontSize') / 3"
          text-anchor="start"
          :font-size="theme('timelineTitleFontSize')"
          :font-weight="theme('timelineTitleFontWeight')"
          :fill="theme('timelineTitleFontColor')"
          style="cursor: default"
          @mouseover="(e) => emit('titleHover', { key: rb.domain, event: e })"
        >
          {{ rb.label }}
        </text>
      </g>
    </g>

    <!-- drawLine(): vertical dividers, column header tick labels, baseline -->
    <g>
      <template v-for="(t, i) in headerTicks" :key="`tick-${i}`">
        <line
          v-if="t.showLine"
          :x1="t.x"
          :x2="t.x"
          :y1="headerY - rowBandHeight / 2"
          :y2="area.y2"
          :stroke="t.lineColor"
          stroke-width="1"
          :visibility="t.lineVisible ? 'visible' : 'hidden'"
        />
        <text v-if="i > 0" :x="t.x - 5" :y="headerY + theme('timelineColumnFontSize') / 2" text-anchor="end" :font-size="theme('timelineColumnFontSize')" :fill="theme('timelineColumnFontColor')">
          {{ t.label }}
        </text>
      </template>
      <line :x1="titleX" :x2="area.x2" :y1="headerY + rowBandHeight / 2" :y2="headerY + rowBandHeight / 2" :stroke="theme('timelineHorizontalLineColor')" stroke-width="1" />
    </g>

    <!-- drawData(): connector lines + per-event bars/overlay/tooltip -->
    <g @mouseout="onGroupMouseout">
      <line v-for="(c, i) in connectors" :key="`conn-${i}`" :x1="c.from.x" :y1="c.from.y" :x2="c.to.x" :y2="c.to.y" :stroke="connectorColors[i]" :stroke-width="props.lineWidth" />

      <g v-for="bar in validBars" :key="`bar-${bar.index}`">
        <rect
          :x="bar.x"
          :y="barLayout(bar).y"
          :width="bar.width"
          :height="barLayout(bar).height"
          :fill="props.activeType === 'bar' ? barFill(bar) : bar.color"
          style="cursor: pointer"
          @click="(e) => onBarClick(bar, e)"
          @dblclick="(e) => onBarDblClick(bar, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', bar.index, e) }"
          @mouseover="
            (e) => {
              forwardEvent('mouseover', bar.index, e)
              if (props.activeType === 'bar') hoverIndex = bar.index
            }
          "
          @mouseout="(e) => forwardEvent('mouseout', bar.index, e)"
        />

        <text
          v-if="props.activeType === 'bar'"
          text-anchor="end"
          :font-size="theme('timelineActiveBarFontSize')"
          :fill="theme('timelineActiveBarFontColor')"
          :x="bar.x + bar.width - theme('timelineActiveBarFontSize') / 2"
          :y="bar.laneY + theme('timelineActiveBarFontSize') / 3"
          :visibility="bar.index === activeIndex ? 'visible' : 'hidden'"
        >
          {{ barTooltipText(bar) }}
        </text>

        <rect
          v-if="props.activeType === 'rect'"
          :x="bar.x"
          :y="overlayY"
          :width="bar.width"
          :height="overlayHeight"
          :fill="overlayStyle(bar).fill"
          :stroke="overlayStyle(bar).stroke"
          :fill-opacity="overlayStyle(bar).fillOpacity"
          :stroke-width="overlayStyle(bar).strokeWidth"
          style="cursor: pointer"
          @mouseover="() => (hoverIndex = bar.index)"
          @click="(e) => onOverlayClick(bar, e)"
          @dblclick="(e) => onOverlayDblClick(bar, e)"
        />
      </g>
    </g>

    <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
