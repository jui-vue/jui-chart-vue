<script setup lang="ts">
// Ported from `chart.brush.pin` (69 lines). **Source-confirmed, don't assume from the name** (this
// port's recurring lesson): `extend: "chart.brush.core"` **directly** - no relation to any other
// brush. Read all 69 lines before writing this file.
//
// **What a "pin" actually is, confirmed from `draw()`**: a single marker at ONE x-axis position
// (`brush.split`, default `0`) - NOT one marker per data point, NOT a map-style pin with a popup.
// It's a reference-line widget: a thin vertical line spanning the FULL plot height (`axis.area("y")`
// to `axis.area("y") + axis.area("height")`), a small downward-pointing triangle "flag" near the
// top of that line, and an optional centered text label above the flag (only rendered when
// `brush.format` is an actual function - `showText = _.typeCheck("function", this.brush.format)`,
// so an omitted/non-function `format` silently hides the label entirely, not a togglable boolean).
// There is no hover/click interaction and no per-element event forwarding (`addEvent()` is never
// called anywhere in the 69 lines, confirmed by reading the whole file) - a genuine, confirmed
// upstream absence, so this component has no `defineEmits` at all (matching `FullGaugeChart.vue`'s
// same finding for `fullgauge.js`).
//
// **Positioning, hand-derived from the source's literal translate chain** (see `usePin.ts`'s own
// doc comment for the full point-by-point algebra): `d = axis.x(brush.split)` - genuinely generic,
// works whether the x-axis is `"block"` (an index into the category domain, per this port's own
// `OrdinalScale`'s "a numeric argument is a literal index" convention - see `useScale.ts`) or
// `"range"` (a raw numeric domain value) - `PinChart.vue` supports both, same as the source's
// untyped `axis.x(...)` call. All pure geometry (triangle/line/label coordinates) lives in
// `usePin.ts` (`pinGeometry`/`pinTrianglePoints`), unit-tested with hand-traced values.
//
// **The label value, confirmed from `self.format(self.axis.x.invert(d))` - NOT simply
// `brush.split` echoed back**: the source always round-trips `d` through `axis.x.invert(...)`
// rather than reusing `split` directly - a real behavioral difference for an out-of-domain
// `split` (the round trip returns the CLAMPED value, not the raw input) and, for a block axis,
// `invert()` (ported as `OrdinalScale.invert` in `useScale.ts`, this iteration) returns the
// (floored) domain INDEX, not the category label - so `format` receives an index number for a
// block x-axis, and the real (possibly clamped) numeric value for a range x-axis. Ported exactly
// as this asymmetry, not "fixed" - see this file's own demo page for both cases, including the
// out-of-domain-clamp edge case.
//
// **Not ported**: `clip` (`brush.size`'s sibling option, default `false`) - no brush in this port
// does per-brush SVG clipping (pre-existing, established gap - see e.g. `ScatterChart.vue`'s/
// `BubbleChart.vue`'s own header comments).
import { computed, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { pinGeometry, pinTrianglePoints } from '../composables/usePin'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    title?: string
    /** `brush.size` - the triangle "flag" marker's width/height in px. Default `6`, matching the source. */
    size?: number
    /** `brush.split` - which x-axis position the pin marks: an index for a `"block"` x-axis, or a
     * raw domain value for a `"range"` x-axis. Default `0`, matching the source. */
    split?: number
    /** `brush.format` - formats the label shown above the pin. Receives `axis.x.invert(d)` (see
     * this file's header comment for exactly what that is per axis type) - **note this gates the
     * label's very existence, not just its text**: omitting `format` hides the label entirely,
     * matching the source's own `showText = typeCheck("function", brush.format)` (default `null`). */
    format?: (value: number) => string | number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
    title: undefined,
    size: 6,
    split: 0,
    format: undefined,
  },
)

const dataRef = toRef(props, 'data')
const { axisX, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme } = useTheme(themeName)

const centerX = computed<number | null>(() => axisX.value.scale(props.split))

const geometry = computed(() => {
  const x = centerX.value
  if (x == null) return null
  return pinGeometry(x, area.value.y, area.value.y2, props.size, theme('pinFontSize'))
})

const trianglePoints = computed(() => (geometry.value ? pinTrianglePoints(geometry.value) : ''))

const label = computed<string | number | null>(() => {
  if (!props.format) return null
  const x = centerX.value
  if (x == null) return null
  const invertedValue = axisX.value.scale.invert(x)
  return props.format(invertedValue)
})
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g v-if="geometry">
      <text v-if="label != null" text-anchor="middle" :font-size="theme('pinFontSize')" :fill="theme('pinFontColor')" :x="geometry.x" :y="geometry.textY">{{ label }}</text>
      <polygon :points="trianglePoints" :fill="theme('pinBorderColor')" />
      <line :x1="geometry.x" :x2="geometry.x" :y1="geometry.lineY1" :y2="geometry.lineY2" :stroke="theme('pinBorderColor')" :stroke-width="theme('pinBorderWidth')" />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
