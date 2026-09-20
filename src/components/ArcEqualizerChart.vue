<script setup lang="ts">
// Ported from `chart.brush.arcequalizer` (168 lines). **Source-confirmed, don't assume from the
// name or from this file's own earlier "pie-family" placeholder note in PORT_STATUS.md**:
// `extend: "chart.brush.core"` **directly** - it shares no `extend` chain with `chart.brush.pie`/
// `chart.brush.donut` (it hand-rolls its own `polarToCartesian()`/`describeArc()`, not a call into
// either), nor with `equalizer.js`/`bargauge.js`/`fullgauge.js` despite the shared naming pattern
// (all of which independently `extend: "chart.brush.core"` too - see `useGauge.ts`'s/
// `useSeries.ts`'s own header comments for this port's recurring lesson). Full geometry derivation
// and reuse analysis lives in `useArcEqualizer.ts`'s header comment - summary: unlike `PieChart`/
// `DonutChart`/`PyramidChart` (always a single `data` row), this brush iterates potentially MANY
// rows, one full angular wedge (equal `360/rowCount` degrees - a row-COUNT split, not `PieChart`'s
// value-weighted slice angles) per row; within a wedge, each `target` stacks radially outward as
// small annular-sector "blocks" (`equalizer.js`'s straight-line block-train concept, bent to polar
// coordinates - see `useArcEqualizer.ts` for why neither `useSeries.ts`'s existing
// `equalizerBlocks`/`equalizerStackedBlocks` nor `usePie.ts`'s slice-angle math could be reused
// as-is, though the underlying `radian`/`rotate` polar primitives ARE reused).
//
// **NOT axis-based** (like `PieChart`/`PyramidChart`/`BarGaugeChart`) - the only positioning input
// is the component's own `width`/`height`, consumed with the brush's own trig. `titleReserve`/
// `area` follow `PyramidChart.vue`'s/`BarGaugeChart.vue`'s own established port-only convention
// (the original has no title concept here either - `this.axis.c(0)` upstream is the FULL chart
// cell, with no title reservation of its own).
//
// **Center total-value text**: `this.format(total)`, `total` = the sum of every row's every
// target's RAW value (not stack-count-scaled). `format` prop defaults to identity, matching this
// port's established convention for other `format` props with no meaningful non-function source
// default (see `BarChart.vue`'s own `format` doc comment).
//
// **No native tooltip in the source** (no `display`, no hover marker - confirmed via grep, only
// `addEvent`). Port-only addition (matching `EqualizerChart.vue`'s/`CandlestickChart.vue`'s/
// `RangeBarChart.vue`'s identical precedent): a hover `ChartTooltip` (`showTooltip`, default
// `true`) showing the target key/value, anchored at the (row, target) block group's own angular/
// radial midpoint.
//
// Per-element event forwarding, ported from `brush/core.js`'s `addEvent()`/`chart.emit()` - see
// `ChartElementEventPayload` in types.ts. **Source read**: `this.addEvent(p, i, j)` once per
// `<path>`, i.e. once per (row, target) block group (`i` = row index, `j` = target index) - NOT
// per individual block (multiple blocks share one `<path>`'s `d`, see `useArcEqualizer.ts`'s
// `arcEqualizerWedgeBlocks`). **Deviation from `PieChart.vue`'s/`PyramidChart.vue`'s own
// `dataIndex: null` precedent, deliberately**: `ArcEqualizerChart`'s `data` prop is `DataRow[]`
// (genuinely multiple rows, one per wedge), unlike `PieChart`/`PyramidChart`'s single-row `data` -
// so `i`, the row index, carries real meaning here, exactly like `BarChart.vue`'s/
// `EqualizerChart.vue`'s own per-row `dataIndex` (both also `extend: "chart.brush.core"` directly
// with a real `DataRow[]` shape) - `dataIndex` is the real row index, not `null`. The synthetic
// no-data placeholder row (`data` is an empty array - see `useArcEqualizer.ts`'s header comment)
// has no real row to index into, so no event listeners are attached to its blocks at all (a
// reasonable port simplification: nothing meaningful could be forwarded as `data`/`dataIndex`
// there, and the source's own `getData(0)` against an empty `axis.data` would itself resolve to
// nothing useful).
import { computed, ref, toRef } from 'vue'
import { arcEqualizerLayout, arcEqualizerMaxValue, arcEqualizerRows, arcEqualizerStackAngle, arcEqualizerWedgeBlocks } from '../composables/useArcEqualizer'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { ChartElementEventPayload, ChartElementEventType, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** One row per angular wedge - unlike `PieChart`/`PyramidChart`'s single `DataRow`, this
     * brush genuinely iterates multiple rows (see this file's header comment). */
    data: DataRow[]
    target: string[]
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    /** The value a fully-filled stack (`stackCount` blocks) represents - a plain number, or a
     * callback invoked once per row (the running max across all rows is used), matching
     * `arcequalizer.js`'s own `maxValue` option (default `100`). */
    maxValue?: number | ((row: DataRow) => number)
    /** Number of radial block "steps" from `textRadius` to the outer edge. Default `25`, matching
     * `arcequalizer.js`'s own `stackCount`. */
    stackCount?: number
    /** Inner-hole radius left empty for the center total-value label. Default `50`, matching
     * `arcequalizer.js`'s own `textRadius`. */
    textRadius?: number
    /** Formats the center total-value label. Defaults to the raw total (identity), matching this
     * port's established convention (see `BarChart.vue`'s own `format` doc comment) - the source's
     * own chart-level `format` fallback has no meaningful default to port. */
    format?: (total: number) => string | number
    showTooltip?: boolean
    title?: string
  }>(),
  {
    width: 400,
    height: 400,
    theme: 'classic',
    colors: undefined,
    maxValue: 100,
    stackCount: 25,
    textRadius: 50,
    format: undefined,
    showTooltip: true,
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

function forwardEvent(type: ChartElementEventType, group: BlockGroup, e: MouseEvent) {
  if (group.dataIndex === null) return // synthetic no-data placeholder - nothing real to forward, see header comment
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: group.dataIndex,
    dataKey: group.key,
    data: props.data[group.dataIndex] ?? null,
    event: e,
  })
}

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

function formatTotal(value: number): string | number {
  return props.format ? props.format(value) : value
}

// Port-only convention (no upstream equivalent), matching `PyramidChart.vue`'s/`BarGaugeChart
// .vue`'s own `titleReserve` - `this.axis.c(0)` upstream is the full chart cell; here the plot
// area is the full width/height minus room for the optional title heading.
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))

const dataCount = computed(() => props.data.length)
const stackAngle = computed(() => arcEqualizerStackAngle(dataCount.value))
const layout = computed(() => arcEqualizerLayout(props.width, props.height - titleReserve.value, props.textRadius, props.stackCount))
const cx = computed(() => layout.value.cx)
const cy = computed(() => layout.value.cy + titleReserve.value)

const effectiveMaxValue = computed(() => arcEqualizerMaxValue(props.data, props.maxValue))
const rowCounts = computed(() => arcEqualizerRows(props.data, props.target, effectiveMaxValue.value, props.stackCount))
const isNoData = computed(() => dataCount.value === 0)

const total = computed(() => props.data.reduce((sum, row) => sum + props.target.reduce((s, key) => s + (Number(row[key]) || 0), 0), 0))

interface BlockGroup {
  key: string
  value: number
  dataIndex: number | null
  rowIndex: number
  path: string
  color: string
  tooltipX: number
  tooltipY: number
}

const blockGroups = computed<BlockGroup[]>(() => {
  const out: BlockGroup[] = []
  const targets = props.target
  const angle = stackAngle.value
  const placeholderColor = theme('arcEqualizerBackgroundColor')

  rowCounts.value.forEach((row, i) => {
    const startAngle = i * angle
    const endAngle = (i + 1) * angle
    const wedge = arcEqualizerWedgeBlocks(row.counts, cx.value, cy.value, props.textRadius, layout.value.stackSize, startAngle, endAngle)

    wedge.forEach((tb) => {
      if (tb.blockCount === 0) return // no blocks -> nothing to render or hit-test, matching an empty `d` upstream

      const key = targets[tb.targetIndex]
      const centerAngle = (startAngle + endAngle) / 2
      const midRadius = (tb.innerRadius + tb.outerRadius) / 2
      const rad = ((centerAngle - 90) * Math.PI) / 180

      out.push({
        key,
        value: row.isPlaceholder ? 0 : (Number(props.data[i]?.[key]) || 0),
        dataIndex: row.isPlaceholder ? null : i,
        rowIndex: i,
        path: tb.path,
        color: row.isPlaceholder || isNoData.value ? placeholderColor : pickColor(tb.targetIndex),
        tooltipX: cx.value + midRadius * Math.cos(rad),
        tooltipY: cy.value + midRadius * Math.sin(rad),
      })
    })
  })

  return out
})

const hoverKey = ref<string | null>(null)
const hover = computed<BlockGroup | null>(() => blockGroups.value.find((g) => `${g.rowIndex}:${g.key}` === hoverKey.value) ?? null)

function groupId(g: BlockGroup): string {
  return `${g.rowIndex}:${g.key}`
}
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g v-for="(g, i) in blockGroups" :key="i">
      <path
        :d="g.path"
        :fill="g.color"
        :stroke="theme('arcEqualizerBorderColor')"
        :stroke-width="theme('arcEqualizerBorderWidth')"
        style="cursor: pointer"
        @mouseover="(e) => { hoverKey = groupId(g); forwardEvent('mouseover', g, e) }"
        @mouseout="(e) => { hoverKey = null; forwardEvent('mouseout', g, e) }"
        @click="(e) => forwardEvent('click', g, e)"
        @dblclick="(e) => forwardEvent('dblclick', g, e)"
        @contextmenu="
          (e) => {
            e.preventDefault()
            forwardEvent('contextmenu', g, e)
          }
        "
      />
    </g>

    <text :x="cx" :y="cy" text-anchor="middle" :dy="theme('arcEqualizerFontSize') / 3" :font-size="theme('arcEqualizerFontSize')" :fill="theme('arcEqualizerFontColor')">{{ formatTotal(total) }}</text>

    <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />

    <ChartTooltip
      v-if="props.showTooltip && hover"
      visible
      :x="hover.tooltipX"
      :y="hover.tooltipY"
      :items="[{ key: hover.key, value: hover.value }]"
      :background-color="theme('tooltipBackgroundColor')"
      :background-opacity="theme('tooltipBackgroundOpacity')"
      :border-color="theme('tooltipBorderColor') ?? hover.color"
      :font-color="theme('tooltipFontColor')"
      :font-size="theme('tooltipFontSize')"
    />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
