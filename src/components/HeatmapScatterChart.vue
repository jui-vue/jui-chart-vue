<script setup lang="ts">
// Ported from `chart.brush.heatmapscatter` (152 lines). **Source-confirmed, don't assume from the
// name** (this port's recurring lesson): `extend: "chart.brush.core"` **directly** - no relation to
// `heatmap.js` despite the shared file-naming pattern (each has its own, unrelated `extend` chain
// and data/color model - see `HeatmapChart.vue`'s own header comment for its side of this finding).
// Read all 152 lines before writing this file.
//
// **What this actually is, confirmed from `draw()`/`drawScatter()`/`createScatter()`/
// `getTableData()`**: NOT a scatter chart with heatmap-style per-point coloring - it's a coarse 2D
// DENSITY grid laid over ordinary (row, target) scatter points: every point is computed exactly like
// `ScatterChart.vue`'s own points (via `useSeries`, see below), then BINNED into one of
// `xDist x yDist` buckets; one `<rect>` is drawn per OCCUPIED bucket (not per point) - points that
// land in an already-occupied bucket contribute nothing further to what's rendered.
//
// **Color model, confirmed from `createScatter()`'s `this.color(dataIndex, targetIndex)`**: this is
// the exact SAME per-TARGET-index color mechanism every other multi-target component in this port
// already uses (`this.brush.colors` not a function -> `chart.color(targetIndex, colors)` -
// re-derived from `brush/core.js`'s `color(key1,key2)`: since `key2` here is a real target index,
// not `null`/`undefined` like `heatmap.js`'s own call, it takes the SAME branch as `bar.js`/
// `scatter.js`/etc: `colorIndex = key2`). So `colors?: string[]` here is indexed by TARGET, matching
// `ScatterChart.vue`'s `pickColor()` precedent exactly - no new color mechanism needed for this
// component (unlike the gradient built for `HeatmapChart.vue`'s demo, which doesn't apply here: the
// real example's own `colors: function(d){...}` colors by ROW DATA, not target, a mode this port's
// established `colors?: string[]` convention already dropped everywhere else, and doubly moot for a
// typically-single-target chart like the real example's own `target: ["delay"]`).
//
// **A real, faithfully-preserved quirk, confirmed from `createScatter()`**: `tableObj.color = color`
// is reassigned on EVERY point landing in a bucket, but the actual `<rect>`'s `fill` (and the
// `addEvent`-registered `dataIndex`/`dataKey`/`data`) is only ever set once, when the bucket's
// element is first created (`if (tableObj.element == null)`) - later points update `tableObj.color`/
// push onto `tableObj.data` but NEITHER is ever re-read by anything else in the file (confirmed:
// `tableObj.data`'s accumulated array is returned by `createScatter()` but never consulted by
// `drawScatter()` beyond the `obj.draw` flag). So a bucket's rendered color and forwarded event
// payload are always the FIRST point to land there - this port reproduces exactly that observable
// behavior (tracks only the first `{dataIndex, dataKey, data}` per bucket) rather than also
// replicating the dead `data[]` accumulation.
//
// **x-axis substitution** (matching `selectbox.js`'s already-established precedent for the same gap):
// see `useHeatmapScatter.ts`'s header comment for the full derivation - this port has no date/time
// axis type, so the x-axis stays `"block"`-type and `xInterval` means "ticks per bucket column"
// (an integer) rather than the source's literal "domain units per bucket" (milliseconds in the real
// example). The y-axis keeps its literal source meaning (`"range"`-type, `yInterval` = value units
// per bucket row) with no adaptation needed. `xInterval`/`yInterval` are REQUIRED props (no default),
// deliberately deviating from the source's own unusable `0` default (divide-by-zero).
//
// **Events, confirmed from `drawScatter()`'s `if (obj != null && obj.draw == false) { this.addEvent
// (obj.element, i, j); g.append(obj.element); }`**: `addEvent` and the DOM append both only happen
// on a bucket's FIRST point (`obj.draw` becomes `true`, i.e. "already drawn", for every later point
// in the same bucket) - `dataIndex = i` (the first point's row), `dataKey = target[j]` (its target
// key), `data` = that row - a normal, real (non-null) payload shape, matching every per-marker
// component's own convention (e.g. `ScatterChart.vue`).
//
// **Not ported**: `clip` (`brush.clip`, default `false` upstream) - no brush in this port does
// per-brush SVG clipping (pre-existing, established gap, same as every other component).
import { computed, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { heatmapScatterBucketIndex, heatmapScatterGrid } from '../composables/useHeatmapScatter'
import { toSeriesScale, useSeries } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    target: string[]
    /** Must be `"block"`-type - see this file's header comment on the date-axis substitution. */
    axisX: AxisConfig
    /** Must be `"range"`-type (a real numeric value axis, matching the source). */
    axisY: AxisConfig
    /** Bucket column width in x-axis TICK count (not domain units - see header comment). Required:
     * the source's own `0` default divides by zero. */
    xInterval: number
    /** Bucket row height in y-axis domain units (matches the source's own literal meaning). Required
     * for the same reason as `xInterval`. */
    yInterval: number
    /** Per-TARGET color (index = target index), matching every other multi-target component's
     * `colors?: string[]` convention (see header comment on why this differs from `HeatmapChart`'s
     * per-ROW indexing). */
    colors?: string[]
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    title?: string
  }>(),
  {
    colors: undefined,
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
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

interface Bucket {
  rowIndex: number
  columnIndex: number
  x: number
  y: number
  width: number
  height: number
  color: string
  dataIndex: number
  dataKey: string
  data: DataRow
}

function forwardEvent(type: ChartElementEventType, bucket: Bucket, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: bucket.dataIndex,
    dataKey: bucket.dataKey,
    data: bucket.data,
    event: e,
  })
}

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')

const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(j: number): string {
  return props.colors?.[j] ?? themeColor(j)
}

const xScale = computed(() => toSeriesScale(axisX.value))
const yScale = computed(() => toSeriesScale(axisY.value))
const xType = computed(() => axisX.value.type)
const yType = computed(() => axisY.value.type)

// Same `useSeries` call every other axis-based multi-target component uses - `x[i]` is `axis.x(i)`
// (row-index-driven, matching the source's `drawScatter()` exactly for a block x-axis), `y[i]` is
// `axis.y(value)` (value-driven), `value[i]` the point's own raw y-value - see header comment.
const series = useSeries(dataRef, targetRef, xScale, yScale, xType, yType)

const grid = computed(() => {
  const ax = axisX.value
  const ay = axisY.value
  if (ax.type !== 'block' || ay.type !== 'range') return null

  const yMin = ay.scale.min()
  const yMax = ay.scale.max()
  const dims = heatmapScatterGrid(ax.ticks.length, yMin, yMax, props.xInterval, props.yInterval, area.value.width, area.value.height)
  return { ...dims, yMin }
})

const buckets = computed<Bucket[]>(() => {
  const g = grid.value
  if (!g || g.xDist <= 0 || g.yDist <= 0) return []

  const rows = dataRef.value
  const map = new Map<string, Bucket>()

  series.value.forEach((pts, j) => {
    const key = props.target[j]

    for (let i = 0; i < pts.value.length; i++) {
      const value = pts.value[i]
      if (typeof value !== 'number') continue

      const { rowIndex, columnIndex } = heatmapScatterBucketIndex(i, value, props.xInterval, g.yMin, props.yInterval, g.xDist, g.yDist)
      const bucketKey = `${rowIndex}:${columnIndex}`

      // Only the FIRST point to land in a bucket creates it - later points landing here are
      // faithfully dropped (matching `tableObj.element == null`'s source guard - see header comment).
      if (map.has(bucketKey)) continue

      // **Real geometry finding, caught by this iteration's own Playwright pass (a bucket's right
      // edge overshot the plot area by exactly half a tick-band width, on every column) - not a
      // faithful-quirk-to-preserve, a genuine adaptation bug**: the source's `xPos = axis.x(xVal)`
      // is used AS-IS as the bucket's left edge, valid only because a continuous date/linear scale
      // maps any value proportionally with no "tick" concept. This port's substituted BLOCK x-axis
      // (see header comment) is fundamentally discrete - `scale(xVal)` returns tick `xVal`'s
      // CENTER (this port's established `createOrdinalScale`/`rangePoints()` semantics, same as
      // every other block-axis consumer in this port), not a left edge. Subtracting half the axis's
      // own tick band (`ax.band`) converts that center back to the bucket's true left edge, making
      // buckets exactly contiguous (column N's right edge === column N+1's left edge) instead of
      // each one drifting half a band-width too far right.
      const xVal = columnIndex * props.xInterval
      const xPos = (axisX.value.scale(xVal) ?? 0) - axisX.value.band / 2
      const yVal = g.yMin + rowIndex * props.yInterval
      const yPos = (axisY.value.scale(yVal) ?? 0) - g.ySize

      map.set(bucketKey, {
        rowIndex,
        columnIndex,
        x: xPos,
        y: yPos,
        width: g.xSize,
        height: g.ySize,
        color: pickColor(j),
        dataIndex: i,
        dataKey: key,
        data: rows[i],
      })
    }
  })

  return Array.from(map.values())
})
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <rect
        v-for="bucket in buckets"
        :key="`${bucket.rowIndex}:${bucket.columnIndex}`"
        :x="bucket.x"
        :y="bucket.y"
        :width="bucket.width"
        :height="bucket.height"
        :fill="bucket.color"
        :stroke="theme('heatmapscatterBorderColor')"
        :stroke-width="theme('heatmapscatterBorderWidth')"
        cursor="pointer"
        @mouseover="(e: MouseEvent) => forwardEvent('mouseover', bucket, e)"
        @mouseout="(e: MouseEvent) => forwardEvent('mouseout', bucket, e)"
        @click="(e: MouseEvent) => forwardEvent('click', bucket, e)"
        @dblclick="(e: MouseEvent) => forwardEvent('dblclick', bucket, e)"
        @contextmenu="
          (e: MouseEvent) => {
            e.preventDefault()
            forwardEvent('contextmenu', bucket, e)
          }
        "
      />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
