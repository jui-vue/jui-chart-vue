<script setup lang="ts">
// Ported from `chart.brush.rangebar` (`orient="bar"`, horizontal - value/range axis on x, category/
// block axis on y) + `chart.brush.rangecolumn` (`orient="column"`, vertical - value/range axis on
// y, category/block axis on x). **Source-confirmed**: unlike `bar.js`/`column.js` (`column.js`
// literally `extend`s `bar.js`), `rangebar.js`/`rangecolumn.js` both `extend: "chart.brush.core"`
// directly - they don't share code via inheritance in the original. They ARE still structurally
// identical modulo the axis swap (same `outerPadding`/`innerPadding` options, same
// group/item-size formula in `drawBefore()`, same per-target rect-drawing shape in `draw()`), so
// - following this port's own established `BarChart.vue` precedent (`orient` prop merging bar.js/
// column.js into one component because the underlying math is identical modulo axis swap) - this
// port merges rangebar.js/rangecolumn.js into one component the same way, via `orient`, rather than
// two separate `RangeBarChart`/`RangeColumnChart` components.
//
// **Data model** (matching `RangeAreaChart.vue`): each row's target field is a 2-element
// `[low, high]` tuple (`data[i][target[j]]`, `value[0]`/`value[1]` in the source), NOT two
// separate `target` fields.
//
// **Source-confirmed minimalism**: neither brush's `.setup()` declares `size`/`minSize`/`display`/
// `active`/`activeEvent` (all present on `bar.js`) or any border-radius option - just
// `outerPadding`/`innerPadding`. Rects are drawn as plain `chart.svg.rect(...)` (no
// `pathRect`/rounded corners). Ported minimally to match - no rounded corners, no `display`/
// `active`/`activeEvent` props exist here (unlike `BarChart.vue`).
//
// **Literal, deliberately-unguarded geometry** (ported exactly, not "fixed"): both sources compute
// the rect's value-axis start as the LOW pixel position and width/height as `Math.abs(low - high)`
// pixels, with no check that low's pixel position is actually "before" high's - this assumes a
// typical low<high tuple on a normal (non-reversed) axis. Preserved as-is rather than defensively
// clamped, matching the original's own lack of a guard.
//
// Per-element event forwarding: ported from `rangebar.js`/`rangecolumn.js`'s own
// `this.addEvent(r, i, j)` call inside the per-target loop (both sources call it, unconditionally -
// unlike `bar.js`'s `value !== 0` guard, there is no such guard here since a range rect has no
// single "zero" value to compare against). `dataIndex`/`dataKey`/`data` match `bar.js`'s own shape
// (`ChartElementEventPayload`).
//
// Pure two-values-per-point coordinate math and the shared outer/inner-padding group-size formula
// live in `useRangeSeries`/`rangeGroupGeometry` (`useSeries.ts`).
//
// Port-only addition (not in either source): a hover `ChartTooltip` (`showTooltip`, default true)
// showing the low/high value pair, matching this port's established precedent for every other
// axis-based component (rangebar.js/rangecolumn.js have no default tooltip wiring of their own).
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { rangeGroupGeometry } from '../composables/useSeries'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, BarOrient, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    /** Field names whose row value is a 2-element `[low, high]` tuple - see this file's header comment. */
    target: string[]
    axisX: AxisConfig
    axisY: AxisConfig
    orient?: BarOrient
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    outerPadding?: number
    innerPadding?: number
    colors?: string[]
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Formats the low/high values shown in the hover tooltip. Default: the raw value. */
    format?: (value: number) => string | number
  }>(),
  {
    orient: 'column',
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    outerPadding: 2,
    innerPadding: 1,
    colors: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
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

/** Forwards a per-element DOM event for one range bar/column - see this file's header comment.
 * Unlike `BarChart.vue`'s `forwardEvent`, no `value === 0` guard - neither source guards its
 * `addEvent` call at all. */
function forwardEvent(type: ChartElementEventType, rect: RangeRect, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: rect.dataIndex,
    dataKey: rect.key,
    data: props.data[rect.dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

// `area` isn't needed - `axis.scale()` already returns absolute, padding-inclusive pixel
// coordinates (see BarChart.vue's header comment on the double-offset bug fixed across every
// other axis-based component in this port).
const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme, color: themeColor } = useTheme(themeName, colorResolver)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

interface RangeRect {
  x: number
  y: number
  width: number
  height: number
  color: string
  key: string
  low: number
  high: number
  tooltipX: number
  tooltipY: number
  dataIndex: number
}

const rects = computed<RangeRect[]>(() => {
  const targets = props.target
  const len = targets.length
  const rows = dataRef.value
  const out: RangeRect[] = []
  const op = props.outerPadding
  const ip = props.innerPadding

  if (props.orient === 'column') {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'block' || ay.type !== 'range') return out

    const { itemSize: columnWidth, groupSize: halfWidth } = rangeGroupGeometry(ax.band, len, op, ip)

    rows.forEach((row, i) => {
      const centerX = ax.scale(i) as number
      let startX = centerX - halfWidth / 2

      targets.forEach((key, j) => {
        const value = row[key] as [number, number]
        const low = value?.[0]
        const high = value?.[1]
        const zeroY = ay.scale(low) as number
        const startY = ay.scale(high) as number
        const h = Math.abs(zeroY - startY)

        out.push({
          x: startX,
          y: startY,
          width: columnWidth,
          height: h,
          color: pickColor(j),
          key,
          low,
          high,
          tooltipX: startX + columnWidth / 2,
          tooltipY: startY + h / 2,
          dataIndex: i,
        })

        startX += columnWidth + ip
      })
    })
  } else {
    const ax = axisX.value
    const ay = axisY.value
    if (ax.type !== 'range' || ay.type !== 'block') return out

    const { itemSize: barHeight, groupSize: halfHeight } = rangeGroupGeometry(ay.band, len, op, ip)

    rows.forEach((row, i) => {
      const centerY = ay.scale(i) as number
      let startY = centerY - halfHeight / 2

      targets.forEach((key, j) => {
        const value = row[key] as [number, number]
        const low = value?.[0]
        const high = value?.[1]
        const zeroX = ax.scale(low) as number
        const startX = ax.scale(high) as number
        const w = Math.abs(zeroX - startX)

        out.push({
          x: zeroX,
          y: startY,
          width: w,
          height: barHeight,
          color: pickColor(j),
          key,
          low,
          high,
          tooltipX: zeroX + w / 2,
          tooltipY: startY + barHeight / 2,
          dataIndex: i,
        })

        startY += barHeight + ip
      })
    })
  }

  return out
})

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

const hoverIndex = ref<number | null>(null)
const hover = computed<RangeRect | null>(() => (hoverIndex.value != null ? (rects.value[hoverIndex.value] ?? null) : null))
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <g>
      <rect
        v-for="(rect, i) in rects"
        :key="i"
        :x="rect.x"
        :y="rect.y"
        :width="rect.width"
        :height="rect.height"
        :fill="rect.color"
        :stroke="theme('barBorderColor')"
        :stroke-width="theme('barBorderWidth')"
        :stroke-opacity="theme('barBorderOpacity')"
        style="cursor: pointer"
        @mouseover="(e) => { hoverIndex = i; forwardEvent('mouseover', rect, e) }"
        @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', rect, e) }"
        @click="(e) => forwardEvent('click', rect, e)"
        @dblclick="(e) => forwardEvent('dblclick', rect, e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', rect, e) }"
      />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.tooltipX"
          :y="hover.tooltipY"
          :items="[
            { key: `${hover.key} low`, value: formatValue(hover.low) },
            { key: `${hover.key} high`, value: formatValue(hover.high) },
          ]"
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
