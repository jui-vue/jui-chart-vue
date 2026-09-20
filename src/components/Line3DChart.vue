<script setup lang="ts">
// Ported from `chart.brush.polygon.line3d` (`jui-chart/src/brush/polygon/line3d.js`, 82 lines) -
// see `useLine3d.ts`'s header comment for the full extend-chain / real-SVG-not-canvas / ribbon-
// geometry / `padding` default divergence from `column3d.js` / no-event-forwarding writeup this
// component relies on. Structurally a near-twin of `Column3DChart.vue` (same `ChartBase.vue`
// composition, same real x/y + z-block-axis shape, same `Polygon3dProjection`), but the actual
// per-cell geometry differs (a 4-point ribbon quad via `PointPolygon`, not an 8-vertex/6-face
// `CubePolygon`) - see `useLine3d.ts`'s header comment for the confirmed structural relationship.
import { computed, toRef } from 'vue'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import { useChartLayout } from '../composables/useChartLayout'
import { toSeriesScale } from '../composables/useSeries'
import { createOrdinalScale } from '../composables/useScale'
import { computePolygon3dProjection } from '../composables/usePolygon3d'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import { buildLine3dDraws, sortLine3dDraws } from '../composables/useLine3d'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

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
    showGrid?: boolean
    /** `chart.brush.polygon.line3d`'s own `padding` (default `10` - NOT `column3d.js`'s own `20`, see `useLine3d.ts`). */
    ribbonPadding?: number
    colors?: string[]
    /** `axis.depth` (default `0`, matching `chart.axis`'s own default). */
    depth?: number
    /** `axis.degree.x/y/z` (each default `0`, matching `chart.axis`'s own default). */
    degreeX?: number
    degreeY?: number
    degreeZ?: number
    /** `axis.perspective` (default `0.9`, matching `chart.axis`'s own default). */
    perspective?: number
    title?: string
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
    ribbonPadding: 10,
    colors: undefined,
    depth: 0,
    degreeX: 0,
    degreeY: 0,
    degreeZ: 0,
    perspective: 0.9,
    title: undefined,
  },
)

const dataRef = toRef(props, 'data')

const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme, color: themeColor } = useTheme(themeName, colorResolver)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))

// Same z-axis shape as `Column3DChart.vue` - see that component's header comment.
const zScale = computed(() => createOrdinalScale(props.target, [0, props.depth]))

const projection = computed(() => computePolygon3dProjection(area.value, props.depth, { x: props.degreeX, y: props.degreeY, z: props.degreeZ }, props.perspective))

// Ported from `createLine`'s `d = axis.z.rangeBand() - this.brush.padding * 2`.
const ribbonDepth = computed(() => zScale.value.rangeBand() - props.ribbonPadding * 2)

const draws = computed(() => {
  const ax = axisX.value
  if (ax.type !== 'block' || axisY.value.type !== 'range' || props.target.length === 0) return []

  return sortLine3dDraws(
    buildLine3dDraws(
      dataRef.value,
      props.target,
      (i) => xScale.value(i) as number,
      (v) => yScale.value(v) as number,
      (j) => zScale.value(j) as number,
      ribbonDepth.value,
      pickColor,
      theme('polygonLineBackgroundOpacity'),
      theme('polygonLineBorderOpacity'),
      projection.value,
    ),
  )
})
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <polygon
      v-for="(seg, i) in draws"
      :key="i"
      :points="seg.points.map((p) => p.join(',')).join(' ')"
      :fill="seg.fill"
      :fill-opacity="seg.fillOpacity"
      :stroke="seg.stroke"
      :stroke-opacity="seg.strokeOpacity"
    />

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
