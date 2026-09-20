<script setup lang="ts">
// Ported from `chart.brush.heatmap` (84 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson): `extend: "chart.brush.core"` **directly** - no relation to
// `heatmapscatter.js` despite the shared file-naming pattern (see that component's own header
// comment for its own, unrelated `extend`/data model). Read all 84 lines before writing this file.
//
// **The color-mapping model, confirmed from source before assuming a gradient exists anywhere**:
// `draw()`'s per-cell color is `this.color(i, null)` - re-read `brush/core.js`'s `color(key1,
// key2)` and `base/builder.js`'s `chart.color(key, colors)` line by line: with `key2` an explicit
// `null` (not `undefined`), `color()` takes its "no target index" branch (`colorIndex = key2 =
// null`, `rowIndex = key1 = i`), and since `this.brush.colors` defaults to `null` (never declared
// in `HeatmapBrush.setup()`, inherited from `chart.brush.core`'s own default), the DEFAULT (no
// `colors` config) path resolves to `chart.color(null, null)` -> `nextColor()` -> `c[null]` ->
// `undefined` - i.e. **without an explicit `colors` config, the source's own default cell color is
// genuinely broken (an `undefined` SVG `fill`)**, only usable via a caller-supplied `colors`
// FUNCTION (confirmed from the real-world sibling example, `examples/heatmapscatter.html`'s
// `colors: function(d) { if (d.level==0) return "#ff0000"; ... }` - a plain per-row threshold/
// bucket function, not interpolation). **There is no gradient/interpolation primitive anywhere in
// `juijs-graph`** (grepped the whole engine source for "interpolate"/"gradient"/"lerp" - none
// exist) - `this.color()` is the SAME flat per-index-or-function palette mechanism every other
// brush in this port already uses. This port's established convention already simplified every
// other component's `colors` config down to a plain array (never a function - see e.g.
// `ScatterChart.vue`'s `pickColor()`), so this file does the same (`colors?: string[]`, indexed by
// ROW - matching the source's own `rowIndex = i` branch), with two deliberate, documented
// deviations from the source's own literal default: (1) a missing `colors[i]` entry falls back to
// `theme('colors')`'s per-index palette cycle (this port's OWN established `colors?: string[]`
// convention, matching every other component) instead of reproducing the source's broken
// `undefined`-fill default; (2) the source's own explicit `"none"` sentinel (`if (color == "none")
// color = theme("heatmapBackgroundColor")`) IS preserved literally - `colors[i] === 'none'` maps to
// `heatmapBackgroundColor`. A genuinely CONTINUOUS gradient (e.g. this file's own demo, a realistic
// day-of-week x hour-of-day activity heatmap) is new, port-only infrastructure built specifically
// because the engine has none - see `useColorScale.ts`'s header comment for the full justification -
// `HeatmapPage.vue`'s demo precomputes a `colors[]` array from each row's value via
// `createColorScale`, keeping this component itself gradient-agnostic (consistent with every other
// component's plain-array `colors` prop).
//
// **The grid/data model, confirmed from `draw()`'s loop - one cell per DATA ROW, not per (row,
// target)**: `heatmap.js` never reads `this.brush.target` anywhere in the file. Both axes must be
// `"block"`-type; each row's OWN x/y grid position comes from looking up a FIELD value on that row
// (`xField`/`yField` props) via the axis's scale - see `useHeatmap.ts`'s header comment for the full
// derivation of why this needed no `useAxis.ts`/`useScale.ts` changes (this port's `OrdinalScale`
// already resolves a *string* argument via `domain.indexOf()`, unchanged - only a new way of calling
// that existing primitive, from the component instead of through a generic per-brush `axis.x(i)`
// wrapper the source relies on for its own `key`-configured block axis). Cell size is the SAME for
// every cell: `axis.x.rangeBand() - borderWidth` x `axis.y.rangeBand() - borderWidth`.
//
// **Events, confirmed from `draw()`'s `this.addEvent(group, i, null)`**: per-CELL (the whole
// `<g>`, not just the rect), `dataIndex = i` (real row index), `dataKey = null` (the 2nd `addEvent`
// arg is `null`, not a target index), `data` = the whole row - a genuinely different payload shape
// from every prior multi-target component (which pass a real `dataKey`), but no new type needed
// (`ChartElementEventPayload` already documents `dataKey: null` as valid).
//
// **Hover, confirmed from `draw()`'s `group.hover(...)`**: swaps ONLY `fill-opacity` between
// `heatmapBackgroundOpacity` (default) and `heatmapHoverBackgroundOpacity` on the rect - no
// persistent tooltip/balloon of any kind exists in the source (unlike `ScatterChart.vue`'s
// `ChartTooltip`), so none is added here either.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { heatmapCells } from '../composables/useHeatmap'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    /** Must be `"block"`-type with an explicit `domain` array of the distinct category labels (not
     * a field-name string - see this file's header comment). */
    axisX: AxisConfig
    axisY: AxisConfig
    /** Row field read to position each cell on the x-axis (matches a `key`-configured block x-axis
     * upstream - see this file's header comment). */
    xField: string
    /** Row field read to position each cell on the y-axis. */
    yField: string
    /** Row field used as the cell's label text when `format` is omitted. Matches `getValue(data,
     * "text")`'s own field name/default. */
    textField?: string
    /** Formats the cell's label from its whole row. Unlike `pin.js`'s `format`, this does NOT gate
     * the label's existence - a cell's text is always rendered (empty string if there's no
     * `format` and no `textField` value), matching the source's own unconditional `.text(...)`. */
    format?: (row: DataRow) => string | number
    /** Per-ROW color (index = row index, matching the source's own `rowIndex` branch of
     * `this.color(i, null)` - see this file's header comment on why this stays a plain array, not
     * a function). The literal string `"none"` falls back to `heatmapBackgroundColor`, matching the
     * source's own explicit sentinel; a missing entry falls back to the theme's per-index palette
     * cycle (this port's own established `colors?: string[]` convention, a deliberate improvement
     * over the source's own broken zero-config default - see header comment). */
    colors?: string[]
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    title?: string
  }>(),
  {
    textField: 'text',
    format: undefined,
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

function forwardEvent(type: ChartElementEventType, index: number, row: DataRow, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: index,
    dataKey: null,
    data: row,
    event: e,
  })
}

const dataRef = toRef(props, 'data')
const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  const c = props.colors?.[i]
  if (c === 'none') return theme('heatmapBackgroundColor')
  return c ?? themeColor(i)
}

const cells = computed(() => {
  const ax = axisX.value
  const ay = axisY.value
  if (ax.type !== 'block' || ay.type !== 'block') return []

  return heatmapCells(props.data, props.xField, props.yField, props.textField, ax.scale, ay.scale, ax.band, ay.band, theme('heatmapBorderWidth'), props.format)
})

const hoverIndex = ref<number | null>(null)

function fillOpacity(i: number): number {
  return hoverIndex.value === i ? theme('heatmapHoverBackgroundOpacity') : theme('heatmapBackgroundOpacity')
}
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <g
        v-for="cell in cells"
        :key="cell.index"
        cursor="pointer"
        @mouseover="
          (e: MouseEvent) => {
            hoverIndex = cell.index
            forwardEvent('mouseover', cell.index, cell.row, e)
          }
        "
        @mouseout="
          (e: MouseEvent) => {
            if (hoverIndex === cell.index) hoverIndex = null
            forwardEvent('mouseout', cell.index, cell.row, e)
          }
        "
        @click="(e: MouseEvent) => forwardEvent('click', cell.index, cell.row, e)"
        @dblclick="(e: MouseEvent) => forwardEvent('dblclick', cell.index, cell.row, e)"
        @contextmenu="
          (e: MouseEvent) => {
            e.preventDefault()
            forwardEvent('contextmenu', cell.index, cell.row, e)
          }
        "
      >
        <rect
          :x="cell.x"
          :y="cell.y"
          :width="cell.width"
          :height="cell.height"
          :fill="pickColor(cell.index)"
          :fill-opacity="fillOpacity(cell.index)"
          :stroke="theme('heatmapBorderColor')"
          :stroke-opacity="theme('heatmapBorderOpacity')"
          :stroke-width="theme('heatmapBorderWidth')"
        />
        <text text-anchor="middle" :fill="theme('heatmapFontColor')" :font-size="theme('heatmapFontSize')" :x="cell.centerX" :y="cell.centerY + theme('heatmapFontSize') / 2">{{ cell.label }}</text>
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
