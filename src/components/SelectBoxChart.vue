<script setup lang="ts">
// Ported from `chart.brush.selectbox` (72 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson): `extend: "chart.brush.core"` **directly**. Read all 72 lines
// before writing this file.
//
// **What it actually is, confirmed from `drawBefore()`/`draw()`**: a row of adjacent, invisible-
// until-hovered rects ("cells") spanning the FULL plot height, one per interval-sized bucket along
// the x-axis - e.g. hovering reveals which day/hour bucket the cursor is over. It's DECLARATIVE
// (the bucket boundaries come from the x-axis's own configured `interval`, not user drag-to-select
// - there is no mousedown/drag tracking anywhere in the source) and purely additive visually (each
// cell starts at `fill-opacity: 0`/`stroke-opacity: 0` and only becomes visible via a native
// `elem.hover(...)` swap to `theme('selectBoxBackgroundOpacity')`/`theme('selectBoxBorderOpacity')`
// - there's no "selected" persistent state, only a hover reveal). No z-ordering concern versus
// other brushes: it's a single `chart.svg.group()` like any other brush layer, drawn in whatever
// order the chart's `brush` array lists it (same as every other brush type in this port).
//
// **The real, substantial finding this item surfaced**: `drawBefore()` calls
// `this.axis.x.ticks("milliseconds", this.axis.get("x").interval)` - a method signature that only
// exists on `util.scale.time` (jui-chart's date/time scale, backing its `chart.grid.date`/
// `chart.grid.dateblock` axis types). This port has NO date/time axis type at all (confirmed via
// grep across `types.ts`/`useAxis.ts`/`useScale.ts` before assuming otherwise) - building one would
// mean a new `AxisConfig` variant, new `useAxis.ts` resolution, and new `ChartBase.vue` tick/label
// rendering, a much larger and separately-scoped undertaking than "port a 72-line brush." Re-reading
// `util/scale/time.js`'s `ticks(type, interval)` and `util/time.js`'s `add()` closely shows the unit
// this call site ALWAYS passes is the literal string `"milliseconds"` (hardcoded, not read from any
// config) - and adding milliseconds is plain numeric addition, with none of `"months"`/`"years"`'s
// real calendar-arithmetic complexity. So this specific call's actual behavior reduces to "step from
// the domain start by a constant ms `interval` until past the domain end" - see `useSelectBox.ts`'s
// own header comment for the full derivation. **Deliberate scope decision**: rather than build a
// whole new date-axis subsystem, `SelectBoxChart` works against this port's EXISTING `"range"`-type
// (linear numeric) x-axis, whose domain field the caller supplies as an epoch-millisecond number (or
// any other numeric axis - the bucketing math doesn't care what the numbers represent), plus a new
// `interval` prop (ms per bucket, default `1000`, matching `chart.grid.date`'s own `interval: 1000`
// default). Also deliberately not reproduced: the source reads `width = axis.x.rangeBand()` BEFORE
// calling `axis.x.ticks(...)` in the same function, only valid because the shared axis-grid scale
// object already called `.ticks()` once during ITS OWN earlier render pass (a call-order side
// effect) - this port computes `width` directly from its own fresh `ticks` array instead (see
// `useSelectBox.ts`'s `selectBoxCells`), the same numeric result without depending on that coupling.
//
// **Events, confirmed from `draw()`'s loop**: `this.addEvent(r, { start: ticks[i], end: ticks[i+1]
// })` - since the 2nd arg is an OBJECT (not a number) and there's no 3rd arg, `brush/core.js`'s
// `addEvent()` takes its special "whole-object" branch: `obj.data = dataIndex` (here, the
// `{start,end}` object itself), `dataIndex`/`dataKey` are never set (`undefined` upstream, ported
// as `null` matching `ChartElementEventPayload`'s documented "not tied to one row" meaning - a cell
// isn't a row of `props.data` at all). All 5 events are wired (`click`/`dblclick`/`contextmenu`/
// `mouseover`/`mouseout`), same shape as every other component's per-element forwarding in this
// port. The native `elem.hover(...)` opacity toggle is a SEPARATE, unconditional mechanism on the
// same rect (not gated by whether a listener is attached) - ported as an internal `hoverIndex` ref,
// alongside (not instead of) the `mouseover`/`mouseout` forwarding.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { selectBoxCells, selectBoxTicks } from '../composables/useSelectBox'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    /** Must be a `"range"`-type (numeric) x-axis - see this file's header comment on why this
     * port doesn't have a genuine date/time axis type. A `"block"` x-axis produces no cells. */
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    title?: string
    /** Bucket width in the x-axis's own domain units (e.g. milliseconds, for an epoch-ms domain).
     * Matches `chart.grid.date`'s own `interval` option/default (`1000`) - see header comment for
     * why this is a component prop rather than an axis-level config in this port. */
    interval?: number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
    title: undefined,
    interval: 1000,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

function forwardEvent(type: ChartElementEventType, cell: { start: number; end: number }, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: null,
    dataKey: null,
    data: { start: cell.start, end: cell.end },
    event: e,
  })
}

const dataRef = toRef(props, 'data')
const { axisX, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme } = useTheme(themeName, colorResolver)

const cells = computed(() => {
  const ax = axisX.value
  if (ax.type !== 'range') return []

  const domainMin = ax.scale.min()
  const domainMax = ax.scale.max()
  const ticks = selectBoxTicks(domainMin, domainMax, props.interval)
  return selectBoxCells(ticks, ax.scale)
})

const hoverIndex = ref<number | null>(null)

function cellOpacity(i: number): { fill: number; stroke: number } {
  if (hoverIndex.value !== i) return { fill: 0, stroke: 0 }
  return { fill: theme('selectBoxBackgroundOpacity'), stroke: theme('selectBoxBorderOpacity') }
}

function onCellOver(i: number, cell: { start: number; end: number }, e: MouseEvent) {
  hoverIndex.value = i
  forwardEvent('mouseover', cell, e)
}

function onCellOut(i: number, cell: { start: number; end: number }, e: MouseEvent) {
  if (hoverIndex.value === i) hoverIndex.value = null
  forwardEvent('mouseout', cell, e)
}
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <g>
      <rect
        v-for="(cell, i) in cells"
        :key="`${cell.start}-${cell.end}`"
        :x="cell.x"
        :y="area.y"
        :width="cell.width"
        :height="area.height"
        :fill="theme('selectBoxBackgroundColor')"
        :fill-opacity="cellOpacity(i).fill"
        :stroke="theme('selectBoxBorderColor')"
        :stroke-opacity="cellOpacity(i).stroke"
        cursor="pointer"
        @mouseover="(e: MouseEvent) => onCellOver(i, cell, e)"
        @mouseout="(e: MouseEvent) => onCellOut(i, cell, e)"
        @click="(e: MouseEvent) => forwardEvent('click', cell, e)"
        @dblclick="(e: MouseEvent) => forwardEvent('dblclick', cell, e)"
        @contextmenu="
          (e: MouseEvent) => {
            e.preventDefault()
            forwardEvent('contextmenu', cell, e)
          }
        "
      />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
