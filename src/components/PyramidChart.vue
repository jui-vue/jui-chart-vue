<script setup lang="ts">
// Ported from `chart.brush.pyramid` (165 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson - see e.g. `PinChart.vue`'s/`BarGaugeChart.vue`'s/`HeatmapChart
// .vue`'s own header comments for the most recent instances): `extend: "chart.brush.core"`
// **directly** - shares no code with any other brush. Read all 165 lines before writing this file.
//
// **The data model, like `PieChart`/`DonutChart`**: a single `data` ROW, sliced into one segment
// per `target` key (`obj = axis.data.length > 0 ? axis.data[0] : {}` - the source only ever reads
// the FIRST data row). **The actual visual model, confirmed from `draw()` - NOT independently-
// sized rows**: the whole shape is one solid triangle (apex top-center, full-width base at the
// bottom by default) inscribed in the plot area; each target's segment is a trapezoid SLICE of
// that same triangle, sized by `rate = value / total` (share of the row's total, not `value / max`)
// and sorted value-DESCENDING before drawing, so the largest value is the wide base and the
// smallest is the tip nearest the apex - see `usePyramid.ts`'s header comment for the full
// derivation (including why the last segment always converges exactly to the apex point, verified
// with a hand-traced 45-degree case in `usePyramid.spec.ts`). `reverse` (default `false`) flips
// which end is the wide base: `false` = upright pyramid (apex top); `true` = inverted funnel (apex
// bottom, wide top) - a literal, source-confirmed geometry flip, not a CSS-transform trick.
//
// **NOT axis-based**, like `BarGaugeChart`/`PieChart`/`DonutChart` - the only positioning input is
// `this.axis.area()` (the plot-area rect), consumed with the brush's own trig/geometry, never a
// shared `axis.x`/`axis.y` `.scale()` call. `titleReserve`/`area` follow `BarGaugeChart.vue`'s own
// established port-only convention (the original has no title concept here either).
//
// Fill color is `this.color(i)` where `i` is the SORTED draw-order index (0 = largest segment),
// NOT the target's original declared position - confirmed by re-reading the loop order (sort
// happens inside `getCalculatedData()`, before the color-assigning draw loop runs).
//
// **Divider lines** (`pyramidLineColor`/`pyramidLineWidth`) are drawn between adjacent segments
// (`i > 0`), spanning slightly wider than the segment boundary itself (`+/- lineWidth/2`).
// **Labels** (`showText`, default `false`) show `value` by default, or `format(key, value, rate)`
// when a formatter is supplied (percentage, e.g. `(k,v,r) => \`${Math.round(r*100)}%\`, is a common
// caller-supplied use of `rate` - the source itself has no built-in percentage mode). Each label is
// a short leader-line + text anchored at its segment's right-edge midpoint, with a literal (not
// "fixed") upstream dodge quirk when consecutive labels land within `pyramidTextLineSize`px of each
// other vertically - ported exactly, see `usePyramid.ts`'s `pyramidLabelY` doc comment.
//
// Per-element event forwarding, ported from `brush/core.js`'s `addEvent()`/`chart.emit()` - see
// `ChartElementEventPayload` in types.ts. **Source read**: `this.addEvent(poly, 0, d.index)` per
// segment - `dataIndex` is the literal `0` (only one row ever exists at this layer, same finding as
// `PieChart.vue`'s own header comment on `pie.js`'s `drawUnit(index, ...)`), `targetIndex = d.index`
// (the segment's ORIGINAL position in `target`, before the value-descending sort - resolved to
// `dataKey = target[d.index]` by `addEvent()` itself). **Deviation, matching `PieChart.vue`'s own
// precedent exactly**: `dataIndex` is `null` here (not upstream's literal always-`0`) since
// `PyramidChart`'s `data` prop is already a single `DataRow`, not an array - there's no meaningful
// index *into* anything at this layer.
import { computed, toRef } from 'vue'
import { pyramidLabelPlacements, pyramidSegments, pyramidTrapezoids } from '../composables/usePyramid'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { ChartElementEventPayload, ChartElementEventType, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** A single row - one segment per `target` key present on it (matching `PieChart`/
     * `DonutChart`'s single-row shape). */
    data: DataRow
    target: string[]
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    /** Show a value/percentage label per segment. Default `false`, matching `pyramid.js`'s own
     * `showText` (default `false`). */
    showText?: boolean
    /** `(key, value, rate) => label`. `rate` is `value / total` (0-1) - defaults to the raw value,
     * matching `pyramid.js`'s own `format` (default `null`, falling back to `d.value`). */
    format?: (key: string, value: number, rate: number) => string | number
    /** `false` (default) = upright pyramid, apex at top, widest/largest segment at the bottom.
     * `true` = inverted funnel, apex at bottom, widest/largest segment at the top. */
    reverse?: boolean
    title?: string
  }>(),
  {
    width: 400,
    height: 320,
    theme: 'classic',
    colors: undefined,
    showText: false,
    format: undefined,
    reverse: false,
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

function forwardEvent(type: ChartElementEventType, key: string, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, { dataIndex: null, dataKey: key, data: props.data, event: e })
}

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

// Port-only convention (no upstream equivalent), matching `BarGaugeChart.vue`'s/`PieChart.vue`'s
// own `titleReserve` - the plot area (`this.axis.area()` upstream) is the full width/height minus
// room for the optional title heading.
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const area = computed(() => ({ x: 0, y: titleReserve.value, width: props.width, height: props.height - titleReserve.value }))

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')
const segments = computed(() => pyramidSegments(dataRef.value, targetRef.value))
const rates = computed(() => segments.value.map((s) => s.rate))

const trapezoids = computed(() => pyramidTrapezoids(area.value.width, area.value.height, props.reverse, rates.value, theme('pyramidLineWidth')))

const labelAnchors = computed(() => trapezoids.value.map((t) => t.labelAnchor))
const labelPlacements = computed(() => (props.showText ? pyramidLabelPlacements(labelAnchors.value, theme('pyramidTextLineSize')) : []))

interface RenderSegment {
  key: string
  value: number
  rate: number
  color: string
  points: string
  divider: { x1: number; y1: number; x2: number; y2: number } | null
  label: { lineX1: number; lineY1: number; lineX2: number; lineY2: number; text: string | number } | null
}

const renderSegments = computed<RenderSegment[]>(() => {
  const ox = area.value.x
  const oy = area.value.y

  return segments.value.map((seg, i) => {
    const t = trapezoids.value[i]
    const points = t.points.map(([x, y]) => `${x + ox},${y + oy}`).join(' ')
    const divider = t.divider ? { x1: t.divider.x1 + ox, y1: t.divider.y + oy, x2: t.divider.x2 + ox, y2: t.divider.y + oy } : null

    let label: RenderSegment['label'] = null
    if (props.showText) {
      const lp = labelPlacements.value[i]
      const text = props.format ? props.format(seg.key, seg.value, seg.rate) : seg.value
      label = { lineX1: lp.lineX1 + ox, lineY1: lp.lineY1 + oy, lineX2: lp.lineX2 + ox, lineY2: lp.lineY2 + oy, text }
    }

    return { key: seg.key, value: seg.value, rate: seg.rate, color: pickColor(i), points, divider, label }
  })
})
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g v-for="(seg, i) in renderSegments" :key="i">
      <polygon
        :points="seg.points"
        :fill="seg.color"
        style="cursor: pointer"
        @click="(e) => forwardEvent('click', seg.key, e)"
        @dblclick="(e) => forwardEvent('dblclick', seg.key, e)"
        @contextmenu="
          (e) => {
            e.preventDefault()
            forwardEvent('contextmenu', seg.key, e)
          }
        "
        @mouseover="(e) => forwardEvent('mouseover', seg.key, e)"
        @mouseout="(e) => forwardEvent('mouseout', seg.key, e)"
      />
      <line v-if="seg.divider" :x1="seg.divider.x1" :y1="seg.divider.y1" :x2="seg.divider.x2" :y2="seg.divider.y2" :stroke="theme('pyramidLineColor')" :stroke-width="theme('pyramidLineWidth')" />
      <g v-if="seg.label">
        <line :x1="seg.label.lineX1" :y1="seg.label.lineY1" :x2="seg.label.lineX2" :y2="seg.label.lineY2" :stroke="theme('pyramidTextLineColor')" :stroke-width="theme('pyramidTextLineWidth')" />
        <text :x="seg.label.lineX2" :y="seg.label.lineY2" :dx="3" :dy="theme('pyramidTextFontSize') / 3" :font-size="theme('pyramidTextFontSize')" :fill="theme('pyramidTextFontColor')">{{ seg.label.text }}</text>
      </g>
    </g>

    <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
