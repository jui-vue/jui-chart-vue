<script setup lang="ts">
// Ported from `chart.brush.rangearea` (`extend: "chart.brush.core"` directly - NOT area.js, no
// shared code with `AreaChart.vue`). **Source-confirmed data model**: each row's target field is a
// **2-element `[low, high]` tuple** (`data[j][target[i]]`, `value[0]`/`value[1]` in the source) -
// NOT two separate `target` fields - so `RangeAreaChart`'s own `target` prop names fields whose
// *value* is a tuple, unlike every other chart in this port. `draw()` builds one closed polygon per
// target: `value[0]` (low) traced forward across every row, then `value[1]` (high) traced backward
// - a literal point-to-point band, no curve/step interpolation (the source's `.setup()` doesn't
// exist at all - `RangeAreaBrush` declares no options whatsoever beyond the inherited core ones, so
// there's no `symbol`/`startZero`/`line`/`opacity`/`display`/`active`/`activeEvent` to port - this
// component is deliberately minimal, matching the source's own minimalism, not an oversight).
// Fill: `this.color(i)` + `theme("areaBackgroundOpacity")` fill-opacity, `stroke-width: 0` - ported
// exactly, no stroke/outline option exists to port.
//
// **Also source-confirmed**: `RangeAreaBrush.draw()` never calls `this.addEvent(...)` anywhere (
// unlike `rangebar.js`/`rangecolumn.js`, both of which do) - so per-element DOM event forwarding
// (ported for every other axis-based component in this port) has no upstream call site to port here
// and is deliberately NOT added, rather than silently missing it.
//
// Pure two-values-per-point coordinate math lives in `useRangeSeries`/`rangeAreaPolygonPoints`
// (`useSeries.ts`) - see that file's doc comments for why this needed its own function rather than
// reusing `useSeries`/`useStackedSeries`'s single-value-per-point shape.
//
// Port-only addition (not in rangearea.js at all, matching this port's established precedent for
// every other axis-based component - see e.g. BubbleChart's identical note): a hover `ChartTooltip`
// (`showTooltip`, default true) showing the low/high value at each row's low/high point, since the
// source has no default tooltip wiring of its own.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { rangeAreaPolygonPoints, toSeriesScale, useRangeSeries } from '../composables/useSeries'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    /** Field names whose row value is a 2-element `[low, high]` tuple - see this file's header comment. */
    target: string[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    colors?: string[]
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Formats the value shown in the hover tooltip. Default: the raw value. */
    format?: (value: number) => string | number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    colors: undefined,
    showGrid: true,
    showTooltip: true,
    title: undefined,
    format: undefined,
  },
)

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')

// `area` isn't needed - `axis.scale()` already returns absolute, padding-inclusive pixel
// coordinates (see BarChart.vue/LineChart.vue's header comments on the double-offset bug fixed
// across every other axis-based component in this port).
const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme, color: themeColor } = useTheme(themeName, colorResolver)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))
const xType = computed(() => axisX.value.type)
const yType = computed(() => axisY.value.type)

const series = useRangeSeries(dataRef, targetRef, xScale, yScale, xType, yType)

const fillOpacity = computed(() => theme('areaBackgroundOpacity'))

interface Band {
  points: string
  color: string
}

const bands = computed<Band[]>(() => series.value.map((pts, j) => ({ points: rangeAreaPolygonPoints(pts), color: pickColor(j) })))

interface HoverPoint {
  x: number
  y: number
  value: number
  color: string
  key: string
  kind: 'low' | 'high'
}

const hoverPoints = computed<HoverPoint[]>(() => {
  const out: HoverPoint[] = []
  series.value.forEach((pts, j) => {
    for (let i = 0; i < pts.low.length; i++) {
      const key = props.target[j]
      const color = pickColor(j)
      if (typeof pts.low[i] === 'number') out.push({ x: pts.xLow[i], y: pts.yLow[i], value: pts.low[i] as number, color, key, kind: 'low' })
      if (typeof pts.high[i] === 'number') out.push({ x: pts.xHigh[i], y: pts.yHigh[i], value: pts.high[i] as number, color, key, kind: 'high' })
    }
  })
  return out
})

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

const hover = ref<HoverPoint | null>(null)
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <g>
      <polygon v-for="(band, j) in bands" :key="j" :points="band.points" :fill="band.color" :fill-opacity="fillOpacity" stroke="none" />

      <g>
        <circle
          v-for="(p, i) in hoverPoints"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          :r="theme('tooltipPointRadius')"
          fill="transparent"
          style="cursor: pointer"
          @mouseover="hover = p"
          @mouseout="hover = null"
        />
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.x"
          :y="hover.y"
          :items="[{ key: `${hover.key} (${hover.kind})`, value: formatValue(hover.value) }]"
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
