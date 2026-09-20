<script setup lang="ts">
// Ported from `chart.brush.bargauge` (79 lines). **Source-confirmed, don't assume from the
// name** (this port's recurring lesson - see `RateBarChart.vue`'s header comment for the most
// recent instance): `extend: "chart.brush.core"` directly - shares no code with `bar.js`. Despite
// pairing "bar" with "gauge", it is NOT a "single value against a min/max range rendered as a
// speedometer-style linear fill bar" in the axis-scale sense - it never touches `axis.x`/`axis.y`
// at all. It reads `axis.c(0)` exactly once (`chart.grid.panel`'s cell - confirmed from
// `panel.js`'s `drawBefore()`: `scale(i)` always returns the whole chart plot area,
// `{x: axis.area("x"), y: axis.area("y"), width: axis.area("width"), height:
// axis.area("height")}`, regardless of `i`, with zero padding by default since no `axis.padding`
// is configured in the one shipped usage of this brush family, `fullgauge.html`) and then stacks
// one horizontal bar per DATA ROW underneath it (`y += brush.size + brush.cut` per row inside
// `eachData`) - so a single `BarGaugeChart` renders a LIST of independent value-vs-range bars,
// one per `data` array entry, not one gauge for one value. Linear geometry (plain width-fraction
// math via `barGaugeFillWidth` - see `useGauge.ts`), not axis-scale-based and not radial/trig -
// genuinely a fourth shape in this port, distinct from the block/range-axis-based components
// (Bar/Line/RateBar) and the trig-based ones (Pie/Donut/FullGaugeChart).
//
// No threshold/color-banding (no red/yellow/green zones - `chart.color(i)` is a plain per-ROW
// series color), no needle/pointer, no min/max tick marks - confirmed absent from all 79 lines
// (see `useGauge.ts`'s header comment for the same finding on `fullgauge.js`).
//
// **Source quirks ported literally, not "fixed" - see `barGaugeFillWidth`'s doc comment**: `min`
// is only ever used as part of the fill width's divisor (the range span), never subtracted from
// the value as a baseline offset - a nonzero `min` does NOT shift where a bar visually "starts".
// Also literal: the background "track" rect (`x: x + cut, width: <cell width>`) and the
// foreground "fill" rect (`x: x, width: value`) are NOT drawn from the same left edge - the track
// is offset `cut` px to the right of the fill, and (since it reuses the *same* `width` variable as
// the fill's own divisor, not `width - cut`) its right edge overshoots the cell's own right edge
// by `cut` px. Preserved as-is (this port's `area.x` is always `0`, matching every other
// panel-based/non-block-range component here, so this quirk is fully reproduced, not merely
// theoretical). The value label's `x` position (`width - brush.cut`, NOT `x + width - brush.cut`)
// is a separate, similar-looking quirk in the source that would only diverge from the "obviously
// intended" right-aligned position when the cell's own `x` is nonzero - moot here for the same
// `area.x === 0` reason, so implemented as the mathematically-equivalent `area.width - cut`.
//
// Per-element event forwarding: `this.addEvent(g, i, null)` per row (`i` = row index, no
// per-target key since each row is a single value, not a multi-target row) - `dataKey: null`,
// `data` = the whole row.
import { computed, toRef } from 'vue'
import { barGaugeFillWidth, barGaugeRowInput, barGaugeRowY } from '../composables/useGauge'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { ChartElementEventPayload, ChartElementEventType, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** One row per gauge bar - each row's own `value`/`title`/`max`/`min` fields (`bargauge.js`'s own field names/defaults - see `barGaugeRowInput`). */
    data: DataRow[]
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    /** `(value, rowIndex) => label`. Defaults to the raw value, matching `bargauge.js`'s own `format` (default `null`, falling back to the chart-level identity formatter). */
    format?: (value: number, index: number) => string | number
    /** Bar height in px. Matches `bargauge.js`'s own `size` option (default `20`). */
    size?: number
    /** Vertical gap between bars, and the horizontal inset of the background track. Matches `bargauge.js`'s own `cut` option (default `5`). */
    cut?: number
    title?: string
  }>(),
  {
    width: 400,
    height: 220,
    theme: 'classic',
    colors: undefined,
    format: undefined,
    size: 20,
    cut: 5,
    title: undefined,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

function forwardEvent(type: ChartElementEventType, index: number, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: index,
    dataKey: null,
    data: props.data[index] ?? null,
    event: e,
  })
}

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

// `axis.c(0)` (chart.grid.panel) with zero padding by default - see this file's header comment.
// `titleReserve` is a port-only addition (matching PieChart/DonutChart/RateBarChart's own
// heading `title` prop, absent from bargauge.js itself), not part of the original's geometry.
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const area = computed(() => ({ x: 0, y: titleReserve.value, width: props.width, height: props.height - titleReserve.value }))

interface GaugeRow {
  dataIndex: number
  y: number
  bgX: number
  bgWidth: number
  fillWidth: number
  color: string
  title: string
  valueText: string | number
  textY: number
}

const rows = computed<GaugeRow[]>(() =>
  props.data.map((row, i) => {
    const { value, title, max, min } = barGaugeRowInput(row)
    const a = area.value
    const fillWidth = barGaugeFillWidth(value, min, max, a.width)
    const y = barGaugeRowY(i, props.size, props.cut, a.y)
    const textY = y + props.size / 2 + props.cut - 1

    return {
      dataIndex: i,
      y,
      bgX: a.x + props.cut,
      bgWidth: a.width,
      fillWidth,
      color: pickColor(i),
      title,
      valueText: props.format ? props.format(value, i) : value,
      textY,
    }
  }),
)
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g v-for="row in rows" :key="row.dataIndex">
      <g
        style="cursor: pointer"
        @click="(e) => forwardEvent('click', row.dataIndex, e)"
        @dblclick="(e) => forwardEvent('dblclick', row.dataIndex, e)"
        @contextmenu="
          (e) => {
            e.preventDefault()
            forwardEvent('contextmenu', row.dataIndex, e)
          }
        "
        @mouseover="(e) => forwardEvent('mouseover', row.dataIndex, e)"
        @mouseout="(e) => forwardEvent('mouseout', row.dataIndex, e)"
      >
        <rect :x="row.bgX" :y="row.y" :width="row.bgWidth" :height="props.size" :fill="theme('bargaugeBackgroundColor')" />
        <!-- `barGaugeFillWidth` itself is uncapped (see its doc comment) - `Math.max(0, ...)` here
             is a render-only safety net (an SVG `rect` with a negative `width` is invalid/inert),
             not a change to the ported geometry math; a `value < min` producing a negative width
             is exactly the kind of unguarded input the original never clamps either. -->
        <rect :x="area.x" :y="row.y" :width="Math.max(0, row.fillWidth)" :height="props.size" :fill="row.color" />
        <text :x="area.x + props.cut" :y="row.textY" text-anchor="start" :font-size="theme('bargaugeFontSize')" :fill="theme('bargaugeFontColor')">{{ row.title }}</text>
        <text :x="area.width - props.cut" :y="row.textY" text-anchor="end" :font-size="theme('bargaugeFontSize')" :fill="theme('bargaugeFontColor')">{{ row.valueText }}</text>
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
