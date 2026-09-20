<script setup lang="ts">
// Ported from `chart.brush.bubble`. **Source-confirmed**: `BubbleBrush` `extend`s
// `chart.brush.core` directly, NOT `chart.brush.scatter` - it's a separate implementation, not
// "scatter plus a radius". It does, however, share the exact same positioning primitive
// (`getXY()`, this port's `useSeries`) - so it's the same dot/strip-plot data model as
// `ScatterChart` (one categorical/index axis, one value axis per `target` - see
// `ScatterChart.vue`'s header comment for the full finding, which applies identically here): a
// bubble's (x, y) position is not a free-form 2-numeric-field scatter point, only its *radius*
// encodes a genuine 3rd data dimension.
//
// Radius dimension: config option is `scaleKey` (a field name read off each raw data row,
// independent of `target`) - when set AND numeric on a given row, it overrides that row's radius-
// driving value for every target's bubble in that row (all targets in one row share the same
// `scaleKey` value, since it's a per-row field, not per-target); when unset, each bubble's own
// target value doubles as its own radius driver instead (`getBubbleRadius()`'s fallback).
//
// Radius scale: `min`/`max` props (default 5/30, ported from `BubbleBrush.setup()`'s own
// `min`/`max`) are the *output* pixel-radius bounds; a linear `scaleValue()` (ported from
// `util.math`'s function of the same name - see `useBubble.ts`) maps the raw radius-driving value
// from an *input* domain into that range. That input domain is the min/max of `scaleKey`'s raw
// field across every row when `scaleKey` is set, else (faithfully ported from `drawBefore()`) the
// y-axis's own *resolved* domain bounds (`axis.y.min()/max()`, post "nice" rounding) - i.e. the
// original hardcodes the assumption that y is the value/range axis, same baked-in assumption the
// whole dot/strip-plot data model already makes. See `useBubble.ts`'s `bubbleRadiusDomain()` doc
// comment for the (robustness-only) fallback this port adds for a non-range y-axis, a
// configuration upstream doesn't guard against at all.
//
// `showText`: an optional label centered inside each bubble. Its default text is the *point's own
// raw target value* (not the possibly-`scaleKey`-substituted radius value) - ported from
// `getFormatText()`. **Notable deviation-free-but-easy-to-miss nuance**: unlike every other
// component's `format(value)`, bubble.js's `format` callback receives the *whole raw data row*
// (`this.format(this.axis.data[dataIndex])`) - ported literally as `format?: (row: DataRow) =>
// string | number` (see `useBubble.ts`'s `bubbleFormatText()`).
//
// `active`/`activeEvent`: ported from `drawETC()`'s tail block + `setActiveEffect()` - genuinely
// **index-based** (a flat, *target-major* index into the nested `for(target) for(row)` draw-order
// list, i.e. `bubbleList`), exactly like `BarChart`'s own `active`/`activeEvent` (not a series-
// name like Line/Area/Pie/Donut) - reuses `useActive.ts`'s `pieActiveOpacity()` as-is (verified
// identical formula: `(cols[i]==r) ? 1 : theme("bubbleBackgroundOpacity")`). **Notable deviation-
// free nuance**: unlike `BarChart` (which has a dedicated `barDisableBackgroundOpacity` token),
// bubble.js's dimming reuses the *same* `bubbleBackgroundOpacity` token as every bubble's own
// constant `fill-opacity` - so an inactive bubble, once any bubble is active, ends up with BOTH
// its constant `fill-opacity` (0.5) AND an extra element-level `opacity` (also 0.5) compounding
// multiplicatively (net ~0.25 visual opacity), exactly matching the original's
// `cols[i].get(0).attr({opacity})`/`cols[i].get(1).attr({opacity})` (circle AND text both get the
// SAME extra `opacity` attribute layered on top of the circle's already-constant `fill-opacity`).
// Ported here as two separate attributes on the `<circle>` (`fill-opacity` constant,
// `opacity` = the active/dim factor) and the optional `<text>` (`opacity` only). No toggle/reset
// on `activeEvent` (bubble.js's handler just overwrites the active bubble unconditionally, same as
// `BarChart`'s own documented deviation-free port of `bar.js`'s `activeEvent`) - unlike bar.js,
// bubble.js's `activeEvent` handler shows NO separate tooltip of its own (only dims/highlights via
// `setActiveEffect`), so this port adds none either beyond the always-available hover balloon
// below.
//
// **Port-only addition (not in bubble.js at all)**: a hover `ChartTooltip` balloon (`showTooltip`,
// default `true`) showing `key: <labelText>` (the same `format`-aware text `showText` would render
// inside the bubble, i.e. the point's own raw target value unless `format` overrides it) -
// bubble.js has no `.hover()`/default tooltip wiring whatsoever (unlike scatter.js's native hover
// recolor). Added for consistency with every other axis-based component in this port (Line/Area/
// Bar/Scatter all got the same port-only hover balloon addition - see e.g. `BarChart.vue`'s header
// comment on its own hover tooltip being "itself already an addition absent from bar.js").
//
// Not ported: `clip` has no equivalent config in bubble.js's own `.setup()` (bubble.js simply has
// none - unlike scatter.js, which does), the entry animation (`drawAnimate()`'s scale-in +
// fade-in), and the original's "callback returns an arbitrary image URI" mode (N/A here - bubble
// has no `symbol` option at all, only a plain filled circle).
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts.
// **Source read**: `drawBubble()`'s nested loop is `for(i = target index) { for(j = row index) {
// ... this.addEvent(b, j, i) ... } }`, unconditionally for every (row, target) pair - no
// `hideZero`/`hide`-style guard exists in bubble.js at all (unlike scatter.js), so every bubble
// always forwards events. `addEvent(b, j, i)` = `addEvent(elem, dataIndex=j/*row*/,
// targetIndex=i/*target*/)`, matching this port's `points` computed exactly (`index: i /* row */`,
// `key` = target, built in the same target-major-then-row order the source itself draws in).
import { computed, ref, toRef } from 'vue'
import { pieActiveOpacity } from '../composables/useActive'
import { bubbleFormatText, bubbleRadius, bubbleRadiusDomain } from '../composables/useBubble'
import { useChartLayout } from '../composables/useChartLayout'
import { toSeriesScale, useSeries } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

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
    /** Minimum rendered bubble radius (px). Ported from bubble.js's `min` (default `5`). */
    min?: number
    /** Maximum rendered bubble radius (px). Ported from bubble.js's `max` (default `30`). */
    max?: number
    /** Field name (on each raw data row, independent of `target`) providing the 3rd (radius)
     * dimension. `null` (default): each bubble's own target value doubles as its radius driver -
     * see this file's header comment for the exact scale-domain rules either way. */
    scaleKey?: string | null
    /** Shows a formatted value label centered inside each bubble. */
    showText?: boolean
    colors?: string[]
    showGrid?: boolean
    /** Port-only addition - see this file's header comment. */
    showTooltip?: boolean
    title?: string
    /** Statically highlights (full opacity) the bubble at this flat, **target-major** index into
     * the (target, row) pair list (dimming every other bubble), matching `BarChart`'s own index-
     * based `active` shape rather than every other chart's series-name `active`. Ported from
     * bubble.js's `active` (index-based, per its own doc comment). */
    active?: number | null
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that sets the triggered bubble as the new
     * active one. `null` (default) disables the interaction. Ported literally with no toggle and
     * no auto-reset on a later `mouseout`, matching `BarChart`'s equivalent deviation-free port. */
    activeEvent?: string | null
    /** Formats the label/tooltip text. Receives the WHOLE raw data row (not just the value) -
     * matches bubble.js's `getFormatText()`. Default: the point's own raw target value. */
    format?: (row: DataRow) => string | number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    min: 5,
    max: 30,
    scaleKey: null,
    showText: false,
    colors: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    active: null,
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

/** Forwards a per-element DOM event for bubble `p` - see this file's header comment. Fires
 * unconditionally for every bubble, matching `addEvent`'s own unguarded call site. */
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

// `area` isn't destructured here - like `ScatterChart.vue`/`LineChart.vue`/`BarChart.vue`,
// `ax.scale()`/`ay.scale()` (via `toSeriesScale()`) already return absolute, padding-inclusive
// pixel coordinates - see `useChartLayout.ts`'s header comment on the double-offset bug this
// avoids from the outset.
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

const series = useSeries(dataRef, targetRef, xScale, yScale, xType, yType)

// See `useBubble.ts`'s `bubbleRadiusDomain()` doc comment: faithfully `axis.y.min()/max()` when
// y is a resolved "range" axis (the assumption bubble.js always makes), else a robustness-only
// fallback (not present upstream) rather than crashing.
const yRangeDomain = computed(() => {
  const ay = axisY.value
  return ay.type === 'range' ? { min: ay.scale.min(), max: ay.scale.max() } : null
})

const radiusDomain = computed(() => bubbleRadiusDomain(dataRef.value, targetRef.value, props.scaleKey, yRangeDomain.value))

interface Point {
  /** Row index - the identity a forwarded event's `dataIndex` carries. */
  index: number
  x: number
  y: number
  /** The point's own raw target value (used for the hover tooltip and `showText`'s default label -
   * NOT necessarily what drives the radius, see `radius` below). */
  value: number
  radius: number
  color: string
  key: string
  labelText: string | number
}

const points = computed<Point[]>(() => {
  const out: Point[] = []
  const rows = dataRef.value
  const domain = radiusDomain.value

  series.value.forEach((pts, j) => {
    const key = props.target[j]
    for (let i = 0; i < pts.x.length; i++) {
      const value = pts.value[i]
      if (value === null || value === undefined) continue
      const row = rows[i]

      out.push({
        index: i,
        x: pts.x[i],
        y: pts.y[i],
        value,
        radius: bubbleRadius(value, row, props.scaleKey, domain, props.min, props.max),
        color: pickColor(j),
        key,
        labelText: bubbleFormatText(value, row, props.format),
      })
    }
  })
  return out
})

// `activeEvent`-triggered override; `null` falls back to the static `active` prop - mirrors
// `BarChart.vue`'s `activeEventIndex`/`effectiveActiveIndex` shape exactly (index-based, not
// key-based - see this file's header comment).
const activeEventIndex = ref<number | null>(null)
const effectiveActiveIndex = computed<number | null>(() => activeEventIndex.value ?? props.active)

function bubbleOpacity(i: number): number {
  return pieActiveOpacity(i === effectiveActiveIndex.value, effectiveActiveIndex.value != null, theme('bubbleBackgroundOpacity'))
}

function onBubbleActiveEvent(i: number) {
  activeEventIndex.value = i
}

const hoverIndex = ref<number | null>(null)
const hover = computed<Point | null>(() => (hoverIndex.value != null ? (points.value[hoverIndex.value] ?? null) : null))
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <g v-for="(p, i) in points" :key="i" :data-series="p.key">
        <circle
          :cx="p.x"
          :cy="p.y"
          :r="p.radius"
          :fill="p.color"
          :fill-opacity="theme('bubbleBackgroundOpacity')"
          :stroke="p.color"
          :stroke-width="theme('bubbleBorderWidth')"
          :opacity="bubbleOpacity(i)"
          style="cursor: pointer"
          @mouseover="(e) => { hoverIndex = i; forwardEvent('mouseover', p, e) }"
          @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', p, e) }"
          @click="(e) => forwardEvent('click', p, e)"
          @dblclick="(e) => forwardEvent('dblclick', p, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', p, e) }"
          @[props.activeEvent]="onBubbleActiveEvent(i)"
        />
        <text v-if="props.showText" :x="p.x" :y="p.y + 3" text-anchor="middle" :font-size="theme('bubbleFontSize')" :fill="theme('bubbleFontColor')" :opacity="bubbleOpacity(i)" style="pointer-events: none">
          {{ p.labelText }}
        </text>
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.x"
          :y="hover.y - hover.radius"
          :items="[{ key: hover.key, value: hover.labelText }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
    </template>
  </ChartBase>
</template>
