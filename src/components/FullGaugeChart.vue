<script setup lang="ts">
// Ported from `chart.brush.fullgauge` (138 lines). **Source-confirmed**: `extend:
// 'chart.brush.donut'` - literally inherits `DonutBrush.drawDonut()` (the same stroked-arc path
// builder `DonutChart.vue`'s `donutSlicePath()` already ports, reused here directly - see
// `usePie.ts`). Radial/arc-based, a genuine speedometer-dial-style "gauge" (unlike
// `BarGaugeChart.vue`'s linear/non-radial `bargauge.js` - see its own header comment for why that
// one, despite the name pairing, is NOT this shape - confirmed from source, not assumed from
// naming, per this port's recurring lesson).
//
// **Visual model, confirmed from `drawUnit()`**: a background TRACK arc (the full configured
// `[startAngle, endAngle]` range, minus the current value's arc and a small `paddingAngle` gap on
// each side) plus a foreground VALUE arc (`startAngle` to `startAngle + currentAngle`, sweep
// proportional to `(value-min)/(max-min)` of the configured range) drawn as two `donutSlicePath()`
// strokes at the SAME centerline radius/width, a centered value label, and an optional centered
// title label (offset by `titleX`/`titleY`). No threshold/color-banding (no red/yellow/green
// zones - `this.color(index)` is a plain per-instance series color, not value-driven), no needle/
// pointer, no min/max tick marks - confirmed absent from all 138 lines. `gaugeArrowColor` exists
// in the original theme files but is dead/unreferenced here (see `useTheme.ts`'s header comment
// on the token) - no needle exists for it to color.
//
// **Radius math deviates from `DonutBrush.getProperty()`'s own convention** - `fullgauge.js` does
// NOT call (or override) the inherited `getProperty()`; it computes its own `outerRadius = w -
// size` / `innerRadius = outerRadius - size` inline (`w = min(width, height)/2`), leaving the
// ring's true visual outer edge at `w - size/2` (a visible gap from the bounding circle) rather
// than donut's own flush-to-the-edge `min/2 - size/2` centerline. See `fullGaugeRadii`'s doc
// comment in `useGauge.ts` for the full derivation. Also unguarded (no `min/2` clamp on `size`,
// unlike donut) and `showText`/title text is scaled by `scaleValue(w, 40, 400, 1, 1.5)` (reused
// from `useBubble.ts`, itself already a literal port of `util.math`'s `scaleValue()`) so labels
// grow/shrink with the gauge's own size.
//
// **Two confirmed source quirks, ported literally**: (1) the background track's `drawDonut()` call
// has NO `stroke-linecap` in its `attr` (defaults to the SVG initial value, `"butt"`) - only the
// FOREGROUND value arc's attr sets `'stroke-linecap': brush.symbol`, so a `symbol="round"` gauge
// always has a flat-capped track with only its colored value arc rounded. (2) `getValue(data,
// 'title')` has no default (`undefined`, not `''` - confirmed by reading `axis.getValue()`, not
// the JSDoc's `[defaultValue='']` claim) so an omitted title would upstream literally attempt to
// render the string `"undefined"` (`if (title != '')` is `true` when `title` is `undefined`) -
// this port intentionally does NOT reproduce that and instead skips the title whenever it's
// unset/empty, matching this port's established precedent of not reproducing a nonsensical-
// looking upstream gap (see `RateBarChart.vue`'s deviations, or Phase A's area.js
// `active`/`activeEvent` dead-wiring note).
//
// **No `addEvent()` call anywhere in `fullgauge.js`** (checked all 138 lines) - unlike every other
// previously-ported brush in this codebase, there is no per-element event forwarding to port here;
// this is a genuine, confirmed absence in the source, not an oversight of this port.
import { computed, toRef } from 'vue'
import { scaleValue } from '../composables/useBubble'
import { fullGaugeCurrentAngle, fullGaugeEndAngleLimit, fullGaugePaddingAngle, fullGaugeRadii, fullGaugeRate, fullGaugeRowInput } from '../composables/useGauge'
import { donutSlicePath } from '../composables/usePie'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** A single row: `value`/`title`/`max`/`min` fields (`fullgauge.js`'s own field names/defaults - see `fullGaugeRowInput`). */
    data: DataRow
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    /** Which theme color (and `format`'s 2nd argument) this gauge uses - matches `this.color(index)`/`this.format(value, index)`, where `index` is the row's position in `fullgauge.js`'s (typically single-row) `axis.data`. Default `0`, the common single-gauge case. */
    colorIndex?: number
    /** `(value, colorIndex) => label`. Defaults to the raw value, matching `fullgauge.js`'s own `format` (default `null`, falling back to the chart-level identity formatter). */
    format?: (value: number, colorIndex: number) => string | number
    /** Stroke line cap for both arcs - only the foreground (value) arc actually uses this value as its `stroke-linecap`; the background track is always the SVG default `"butt"` cap regardless (see this file's header comment). `"butt"` also gates a small angular gap (`theme('gaugePaddingAngle')`) between the two arcs; `"round"`/`"square"` have no gap. Matches `fullgauge.js`'s own `symbol` option (default `'butt'`). */
    symbol?: 'butt' | 'round' | 'square'
    /** Ring stroke width in px, for BOTH arcs. Matches `fullgauge.js`'s own `size` (default `60`). Unguarded against the available radius - see `fullGaugeRadii`'s doc comment. */
    size?: number
    /** Start angle (degrees) of the gauge's configured range. Matches `fullgauge.js`'s own `startAngle` (default `0`). */
    startAngle?: number
    /** Total sweep (degrees) of the gauge's configured range - `360` is a full circle. Matches `fullgauge.js`'s own `endAngle` (default `360`, internally clamped to `359.99999` - see `fullGaugeEndAngleLimit`). */
    endAngle?: number
    /** Shows the centered value label. Matches `fullgauge.js`'s own `showText` (default `true`). Independent of the title label, which is gated by `data.title` alone, not this prop (matches source: two separate `if` blocks). */
    showText?: boolean
    /** Title label's x offset from the value label's anchor point. `0` centers it; negative right-aligns (`text-anchor: end`); positive left-aligns (`text-anchor: start`) - matches `createTitle()`'s `dx` logic. Matches `fullgauge.js`'s own `titleX` (default `0`). */
    titleX?: number
    /** Title label's y offset. Matches `fullgauge.js`'s own `titleY` (default `0`). */
    titleY?: number
    /** Port-only chart heading, absent from `fullgauge.js` itself - same convention as every other leaf component in this port (Pie/Donut/RateBar/BarGauge). Distinct from `data.title` (the gauge's own centered label). */
    title?: string
  }>(),
  {
    width: 300,
    height: 300,
    theme: 'classic',
    colors: undefined,
    colorIndex: 0,
    format: undefined,
    symbol: 'butt',
    size: 60,
    startAngle: 0,
    endAngle: 360,
    showText: true,
    titleX: 0,
    titleY: 0,
    title: undefined,
  },
)

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

// `axis.c(index)` (chart.grid.panel) with zero padding by default - same reasoning as
// `BarGaugeChart.vue`'s `area` (see its header comment). `titleReserve` is this port's own
// chart-heading addition, unrelated to `fullgauge.js`'s own geometry.
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const area = computed(() => ({ x: 0, y: titleReserve.value, width: props.width, height: props.height - titleReserve.value }))

const w = computed(() => Math.min(area.value.width, area.value.height) / 2)
const centerX = computed(() => area.value.width / 2 + area.value.x)
const centerY = computed(() => area.value.height / 2 + area.value.y)
const radii = computed(() => fullGaugeRadii(w.value, props.size))
const textScale = computed(() => scaleValue(w.value, 40, 400, 1, 1.5))

const rowInput = computed(() => fullGaugeRowInput(props.data))
const endAngleLimit = computed(() => fullGaugeEndAngleLimit(props.endAngle))
const rate = computed(() => fullGaugeRate(rowInput.value.value, rowInput.value.min, rowInput.value.max))
const currentAngle = computed(() => fullGaugeCurrentAngle(rate.value, endAngleLimit.value))
const paddingAngle = computed(() => fullGaugePaddingAngle(props.symbol, theme('gaugePaddingAngle')))

const backgroundPath = computed(() =>
  donutSlicePath(centerX.value, centerY.value, radii.value.outerRadius, props.startAngle + currentAngle.value + paddingAngle.value, endAngleLimit.value - currentAngle.value - paddingAngle.value * 2),
)
const foregroundPath = computed(() => donutSlicePath(centerX.value, centerY.value, radii.value.outerRadius, props.startAngle, currentAngle.value))

const color = computed(() => pickColor(props.colorIndex))
const valueText = computed(() => (props.format ? props.format(rowInput.value.value, props.colorIndex) : rowInput.value.value))
const valueCenterY = computed(() => centerY.value - radii.value.outerRadius * 0.1)

const hasTitle = computed(() => rowInput.value.title != null && rowInput.value.title !== '')
const titleAnchor = computed(() => (props.titleX === 0 ? 'middle' : props.titleX < 0 ? 'end' : 'start'))
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <path :d="backgroundPath" fill="none" :stroke="theme('gaugeBackgroundColor')" :stroke-width="props.size" />
    <path :d="foregroundPath" fill="none" :stroke="color" :stroke-width="props.size" :stroke-linecap="props.symbol" />

    <g v-if="props.showText" :transform="`translate(${centerX}, ${valueCenterY}) scale(${textScale})`">
      <text text-anchor="middle" :font-size="theme('gaugeFontSize')" :font-weight="theme('gaugeFontWeight')" :fill="color" :y="theme('gaugeFontSize') / 3">{{ valueText }}</text>
    </g>

    <g v-if="hasTitle" :transform="`translate(${centerX + props.titleX}, ${valueCenterY + props.titleY}) scale(${textScale})`">
      <text :text-anchor="titleAnchor" :font-size="theme('gaugeTitleFontSize')" :font-weight="theme('gaugeTitleFontWeight')" :fill="theme('gaugeTitleFontColor')" :y="theme('gaugeTitleFontSize') / 3">
        {{ rowInput.title }}
      </text>
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
