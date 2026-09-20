<script setup lang="ts">
// Ported from `chart.brush.polygon.column3d` (`jui-chart/src/brush/polygon/column3d.js`, 89
// lines) - see `useColumn3d.ts`'s header comment for the full extend-chain / real-SVG-not-canvas /
// `chart.polygon.cube` dependency / z-block-axis / preserved-quirk writeup this component relies
// on.
//
// **Composes `ChartBase.vue` (this port's SVG scaffolding), NOT `ChartCanvasBase.vue`** - unlike
// every other Phase E brush before this one, `column3d.js`'s actual DOM output is real SVG
// `<polygon>` elements (see `useColumn3d.ts`'s header comment), so it belongs with this port's
// existing SVG chart family (`BarChart.vue` et al.), reusing real x/y axis chrome via
// `useChartLayout()`/`ChartBase.vue` exactly as `BarChart.vue` does. The z dimension has a real
// ordinal SCALE (`createOrdinalScale(props.target, [0, depth])` - see `useColumn3d.ts`'s header
// comment on why the z-axis's true upstream domain is the target/series list) but, like
// `dot3d.js`, no rendered z-axis tick/grid chrome (out of scope, same documented boundary).
import { computed, toRef } from 'vue'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import { useChartLayout } from '../composables/useChartLayout'
import { toSeriesScale } from '../composables/useSeries'
import { createOrdinalScale } from '../composables/useScale'
import { computePolygon3dProjection } from '../composables/usePolygon3d'
import { useTheme } from '../composables/useTheme'
import { buildColumn3dDraws, resolveColumnSize, sortColumn3dDraws } from '../composables/useColumn3d'
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
    showGrid?: boolean
    /** `chart.brush.polygon.column3d`'s own `width` (default `0` = auto-fit to `axis.x.rangeBand()`). */
    colWidth?: number
    /** `chart.brush.polygon.column3d`'s own `height` (default `0` = auto-fit to `axis.z.rangeBand()`). */
    colHeight?: number
    /** `chart.brush.polygon.column3d`'s own `padding` (default `20` - NOT `line3d.js`'s own `10`, see `useColumn3d.ts`/`useLine3d.ts`). */
    cubePadding?: number
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
    colWidth: 0,
    colHeight: 0,
    cubePadding: 20,
    colors: undefined,
    depth: 0,
    degreeX: 0,
    degreeY: 0,
    degreeZ: 0,
    perspective: 0.9,
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

/** Ported from `createColumn`'s own `if(data[target] != 0) this.addEvent(g, dataIndex,
 *  targetIndex)` - a zero-value column emits nothing, same shape as `BarChart.vue`'s `forwardEvent`. */
function forwardEvent(type: ChartElementEventType, dataIndex: number, targetKey: string, value: number, e: MouseEvent) {
  if (value === 0) return
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex,
    dataKey: targetKey,
    data: props.data[dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))

// The z-axis's real upstream domain IS the target/series list (`createColumn`'s own `targetIndex`
// parameter) - see this file's header comment. Range `[0, depth]`, matching `chart.grid.core`'s
// `getGridSize()` `isFull3D()`/`orient:"center"` branch.
const zScale = computed(() => createOrdinalScale(props.target, [0, props.depth]))

const projection = computed(() => computePolygon3dProjection(area.value, props.depth, { x: props.degreeX, y: props.degreeY, z: props.degreeZ }, props.perspective))

const columnSize = computed(() => {
  const ax = axisX.value
  if (ax.type !== 'block') return { width: 0, height: 0 }
  return resolveColumnSize(ax.band, zScale.value.rangeBand(), props.cubePadding, props.colWidth, props.colHeight)
})

const draws = computed(() => {
  const ax = axisX.value
  if (ax.type !== 'block' || axisY.value.type !== 'range' || props.target.length === 0) return []

  const size = columnSize.value
  return sortColumn3dDraws(
    buildColumn3dDraws(
      dataRef.value,
      props.target,
      (i) => xScale.value(i) as number,
      (v) => yScale.value(v) as number,
      (j) => zScale.value(j) as number,
      size.width,
      size.height,
      pickColor,
      theme('polygonColumnBackgroundOpacity'),
      theme('polygonColumnBorderOpacity'),
      projection.value,
    ),
  )
})
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g
      v-for="(col, i) in draws"
      :key="i"
      style="cursor: pointer"
      @mouseover="(e) => forwardEvent('mouseover', col.dataIndex, col.targetKey, col.value, e)"
      @mouseout="(e) => forwardEvent('mouseout', col.dataIndex, col.targetKey, col.value, e)"
      @click="(e) => forwardEvent('click', col.dataIndex, col.targetKey, col.value, e)"
      @dblclick="(e) => forwardEvent('dblclick', col.dataIndex, col.targetKey, col.value, e)"
      @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', col.dataIndex, col.targetKey, col.value, e) }"
    >
      <polygon
        v-for="(face, fi) in col.faces"
        :key="fi"
        :points="face.points.map((p) => p.join(',')).join(' ')"
        :fill="col.fill"
        :fill-opacity="col.fillOpacity"
        :stroke="col.stroke"
        :stroke-opacity="col.strokeOpacity"
      />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
