<script setup lang="ts">
// Shared <svg> + plot-area + axis (grid lines, baseline, tick labels) rendering for the
// axis-based chart types (line/area/bar/column). Ported from `chart.base.core`'s
// calculate -> drawAxis pipeline, minus the plugin/module-registry machinery (each chart type
// is just a Vue component here, composing this one - see README).
//
// Not used by PieChart/DonutChart: those aren't axis-based (see usePie.ts).
import { computed, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { useTheme } from '../composables/useTheme'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    /** Draw the light horizontal/vertical grid lines behind the plot. */
    showGrid?: boolean
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
  },
)

const themeName = toRef(props, 'theme')
const { theme, color } = useTheme(themeName)

const { area, axisX, axisY } = useChartLayout(
  toRef(props, 'data'),
  toRef(props, 'axisX'),
  toRef(props, 'axisY'),
  toRef(props, 'width'),
  toRef(props, 'height'),
  toRef(props, 'padding'),
)

// Axis chrome placement, ported from `chart.axis`'s `drawGridType()` translate-by-orient (the
// original moves the whole grid <g> to the appropriate plot-area edge; here the baseline/label
// coordinates are computed directly instead, matching how the rest of this file already draws
// absolute coordinates rather than nested/translated groups). Grid lines themselves (the light
// lines spanning the plot) aren't orient-dependent - they always span the full plot area
// regardless of which edge the axis line/labels sit on, same as the original.
const xBaselineY = computed(() => (axisX.value.orient === 'top' ? area.value.y : area.value.y2))
const xLabelY = computed(() => {
  const pad = theme('gridTickPadding')
  return axisX.value.orient === 'top' ? xBaselineY.value - pad : xBaselineY.value + pad + theme('gridXFontSize')
})

const yBaselineX = computed(() => (axisY.value.orient === 'right' ? area.value.x2 : area.value.x))
const yLabelX = computed(() => {
  const pad = theme('gridTickPadding')
  return axisY.value.orient === 'right' ? yBaselineX.value + pad : yBaselineX.value - pad
})
const yLabelAnchor = computed(() => (axisY.value.orient === 'right' ? 'start' : 'end'))

// Grid line visibility, per axis, independently. `showGrid` (chart-wide, default true) keeps its
// pre-existing behavior unchanged (range-type axes only) for zero regression to existing demos;
// `axis.x.line`/`axis.y.line` (per-axis, default false, ported from `grid/core.js`'s `line`) is
// an additive override that also works for a block-type axis - see PORT_STATUS.md/README.md for
// the coexistence rationale. `axis.x.line`/`axis.y.line: true` always wins even if `showGrid` is
// false, matching the original's per-axis-independent `line` semantics.
const showXGridLines = computed(() => (props.showGrid && axisX.value.type === 'range') || axisX.value.line)
const showYGridLines = computed(() => (props.showGrid && axisY.value.type === 'range') || axisY.value.line)

defineExpose({ area, axisX, axisY, theme, color })
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <!-- Grid lines. X and Y are controlled independently - see showXGridLines/showYGridLines. -->
    <g v-if="showXGridLines">
      <line
        v-for="(v, i) in axisX.values"
        :key="`gx-${i}`"
        :x1="v"
        :x2="v"
        :y1="area.y"
        :y2="area.y2"
        :stroke="theme('gridBorderColor')"
        :stroke-width="theme('gridBorderWidth')"
        :stroke-opacity="theme('gridBorderOpacity')"
      />
    </g>
    <g v-if="showYGridLines">
      <line
        v-for="(v, i) in axisY.values"
        :key="`gy-${i}`"
        :x1="area.x"
        :x2="area.x2"
        :y1="v"
        :y2="v"
        :stroke="theme('gridBorderColor')"
        :stroke-width="theme('gridBorderWidth')"
        :stroke-opacity="theme('gridBorderOpacity')"
      />
    </g>

    <!-- Axis baselines - each independently suppressible via axis.x.hide/axis.y.hide (default
         false, unaffected by showGrid/line - see AxisConfig.hide's doc comment), ported from
         `chart.axis`'s own `hide` option. Added for LineChart.vue's `zoomScrollable` embedded
         thumbnail chart (see PORT_STATUS.md's `zoomscroll.js` entry) - no prior demo needed it. -->
    <line v-if="!axisX.hide" :x1="area.x" :x2="area.x2" :y1="xBaselineY" :y2="xBaselineY" :stroke="theme('gridXAxisBorderColor')" :stroke-width="theme('gridXAxisBorderWidth')" />
    <line v-if="!axisY.hide" :x1="yBaselineX" :x2="yBaselineX" :y1="area.y" :y2="area.y2" :stroke="theme('gridYAxisBorderColor')" :stroke-width="theme('gridYAxisBorderWidth')" />

    <!-- X tick labels -->
    <template v-if="!axisX.hide">
      <text
        v-for="(v, i) in axisX.values"
        :key="`xt-${i}`"
        :x="v"
        :y="xLabelY"
        text-anchor="middle"
        :font-size="theme('gridXFontSize')"
        :font-weight="theme('gridXFontWeight')"
        :fill="theme('gridXFontColor')"
      >
        {{ axisX.ticks[i] }}
      </text>
    </template>

    <!-- Y tick labels -->
    <template v-if="!axisY.hide">
      <text
        v-for="(v, i) in axisY.values"
        :key="`yt-${i}`"
        :x="yLabelX"
        :y="v + theme('gridYFontSize') / 3"
        :text-anchor="yLabelAnchor"
        :font-size="theme('gridYFontSize')"
        :font-weight="theme('gridYFontWeight')"
        :fill="theme('gridYFontColor')"
      >
        {{ axisY.ticks[i] }}
      </text>
    </template>

    <!-- Brush layer: the chart-type component (LineChart/AreaChart/BarChart) renders its marks
         here via the default slot, using its OWN useChartLayout()/useSeries() call (same props
         in -> same area/axisX/axisY out) rather than reading these back out of this slot. -->
    <slot />

    <!-- Overlays: title/tooltip render above the brush layer. -->
    <slot name="overlay" />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
