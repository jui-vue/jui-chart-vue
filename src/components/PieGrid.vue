<script setup lang="ts">
// Small-multiples grid of pies, one per row of `data` - the Vue port of jui-chart's `axis.c`
// small-multiples mode for `chart.brush.pie` (see PieChart.vue's header comment and
// PORT_STATUS.md for the architectural comparison).
//
// In the original, ONE PieBrush instance draws every row's pie itself, looking up each row's
// cell rect via a shared `axis.c(index)` (a `chart.grid.table` scale function - ported here as
// `useGridLayout.ts`, since `chart.grid.table` is the grid type that actually produces a
// row/column layout; `axis.c`'s default grid type, "panel", is a single full-area cell and
// would just stack every pie on top of each other).
//
// This port instead composes N independent, already-verified `<PieChart>` instances, each
// positioned via a nested `<svg x="" y="" width="" height="">` viewport at its grid cell -
// `x`/`y` aren't declared props on PieChart, so they fall through Vue's automatic attribute
// inheritance onto its root `<svg>` unchanged. Chosen over replicating the original's
// single-shared-brush architecture because: (1) it reuses 100% of PieChart's already-verified
// wedge/label/active/tooltip/outside-label-clipping-safe-radius logic with zero risk to the
// single-pie call shape (PieChart.vue is untouched); (2) a nested `<svg>` clips to its own
// viewport per the SVG spec, so no cell's wedges/labels can bleed into a neighboring cell or
// past the outer boundary "for free"; (3) unlike e.g. a shared axis/scale brush (bar/line), the
// original's per-row pies never interact with each other (no shared legend/tooltip/hover across
// rows), so independent components are behaviorally equivalent here.
import { computed, toRef } from 'vue'
import { gridCells } from '../composables/useGridLayout'
import PieChart from './PieChart.vue'
import { useTheme } from '../composables/useTheme'
import type { DataRow, PieShowText, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    target: string[]
    /** Number of columns in the grid. Rows default to `ceil(data.length / columns)`. */
    columns?: number
    /** Explicit row count, overriding the auto-derived value. */
    rows?: number
    /** Pixel gap between cells, both directions. */
    gap?: number
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    showText?: PieShowText
    format?: (key: string, value: number, total: number) => string
    showTooltip?: boolean
    /** Field name read from each row for that cell's title (e.g. `"region"`). Omit for no per-cell titles. */
    titleField?: string
    active?: string | string[] | null
    activeEvent?: string | null
  }>(),
  {
    columns: 3,
    rows: undefined,
    gap: 16,
    width: 720,
    height: 480,
    theme: 'classic',
    colors: undefined,
    showText: null,
    format: undefined,
    showTooltip: true,
    titleField: undefined,
    active: null,
    activeEvent: null,
  },
)

const themeName = toRef(props, 'theme')
const { theme } = useTheme(themeName)

const cells = computed(() => gridCells(props.data.length, props.columns, props.width, props.height, props.gap, props.rows))

function cellTitle(row: DataRow): string | undefined {
  if (!props.titleField) return undefined
  const value = row[props.titleField]
  return value === undefined ? undefined : String(value)
}
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root" data-chart-grid="pie">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <PieChart
      v-for="(cell, i) in cells"
      :key="i"
      :x="cell.x"
      :y="cell.y"
      :width="cell.width"
      :height="cell.height"
      :data="props.data[i]"
      :target="props.target"
      :theme="props.theme"
      :colors="props.colors"
      :show-text="props.showText"
      :format="props.format"
      :show-tooltip="props.showTooltip"
      :title="cellTitle(props.data[i])"
      :active="props.active"
      :active-event="props.activeEvent"
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
