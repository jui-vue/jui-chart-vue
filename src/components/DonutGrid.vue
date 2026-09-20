<script setup lang="ts">
// Small-multiples grid of donuts, one per row of `data`. Same design as PieGrid.vue (composes
// independent, already-verified `<DonutChart>` instances via nested-`<svg>` cell positioning
// instead of replicating the original's shared-brush `axis.c` lookup) - see PieGrid.vue's header
// comment and PORT_STATUS.md for the full reasoning.
import { computed, toRef } from 'vue'
import { gridCells } from '../composables/useGridLayout'
import DonutChart from './DonutChart.vue'
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
    /** Ring thickness in px, forwarded to each cell's DonutChart. */
    size?: number
    /** Show each cell's summed total in its ring center. */
    showValue?: boolean
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
    size: 24,
    showValue: false,
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
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root" data-chart-grid="donut">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <DonutChart
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
      :size="props.size"
      :show-value="props.showValue"
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
