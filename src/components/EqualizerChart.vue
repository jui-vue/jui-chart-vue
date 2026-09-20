<script setup lang="ts">
// Ported from `chart.brush.equalizer` (86 lines). **Source-confirmed, don't assume from the
// name**: `extend: "chart.brush.core"` directly - equalizer.js shares NO code with bar.js/
// column.js/stackbar.js/stackcolumn.js beyond the inherited core `eachData`/`color`/`addEvent`
// helpers every brush gets, and it has no `active`/`activeEvent`/`display`/`format`/`size`/
// `minSize` options at all (no `.setup()` entry for any of them - `BarBrush`'s config is never
// inherited here). It's ALSO genuinely distinct from `equalizerbar.js`/`equalizercolumn.js` (see
// `BarChart.vue`'s `equalizer` prop doc comment) - those two `extend: "chart.brush.stackbar"`/
// `"chart.brush.stackcolumn"` respectively, not this file, despite the shared "equalizer" name.
// Only ONE orientation exists in the source (no "equalizerrow"/"equalizerbar" sibling of this
// specific file) - x is always the block/category axis, y always the range/value axis, exactly
// like a non-stacked, grouped (not stacked) `column`-orient bar chart - confirmed from `draw()`'s
// `this.offset("x", i)`/`axis.y(data[target])` calls.
//
// **What "equalizer-style" rendering actually is** (confirmed from `draw()`, not assumed from the
// name): each `(row, target)` pair is NOT one continuous rect - it's a *stack of small fixed-
// height blocks* growing away from the zero baseline toward the value's pixel position, separated
// by a constant, hardcoded 1.5px gap (`var padding = 1.5` - a literal in the source, NOT the
// configurable `innerPadding` option, which here only spaces the grouped *targets* apart
// horizontally, matching `bar.js`'s own `innerPadding` role). Block height is the `unit` config
// (default 5px, a literal pixel height here - NOT `equalizerbar.js`'s same-named but unrelated
// `unit`, a divisor there). The block nearest the value's edge is clipped short instead of
// overshooting (`(eY - unit < startY) ? abs(eY - startY) : unit`), so the stack always lands
// exactly on the value's true pixel position. Ported as pure `equalizerBlocks()` in
// `useSeries.ts` (unit-tested there against a hand-traced 5-block and 3-block case, plus the
// zero-value and non-positive-`unit` edge cases).
//
// **Per-block color banding, the real "equalizer" look**: `this.color(Math.floor(eIndex / gap))`
// - `eIndex` counts blocks from 0 at the one nearest zero, so every `gap` (default 5) consecutive
// blocks share one theme color, then the *next* `gap` blocks cycle to the next theme color, and so
// on outward from zero - a color-banded VU-meter/equalizer zone effect (e.g. green near zero,
// amber/red further out, depending on the theme's `colors` list order), genuinely different from
// `equalizerbar.js`/`equalizercolumn.js`'s block coloring (inherited unmodified from
// `stackbar.js`'s `getBarElement()`: `this.color(targetIndex)`, one uniform color per *target*,
// no per-block banding at all).
//
// **Grouped-target x geometry**: `half_width = (width - outerPadding*2) / 2`, `barWidth = (width
// - outerPadding*2 - (target.length-1)*innerPadding) / target.length`, `startX = offset("x", i) -
// half_width` then `startX += barWidth + innerPadding` per target - the exact same
// outerPadding/innerPadding/target.length division formula as `bar.js`'s own grouped (non-stacked)
// bars, confirmed by comparing side by side. Reused `rangeGroupGeometry()` (already extracted from
// that same formula for `RangeBarChart.vue`) rather than re-deriving it - `groupSize` = `2 *
// half_width`, `itemSize` = `barWidth`.
//
// **Events**: `this.addEvent(barGroup, i, j)` - once per (row, target) group, wrapping every block
// of that target's stack (not per-block, unlike `equalizerbar.js`'s double-wired
// `getBarElement()`+group call site) - `dataIndex`/`dataKey` are both real (`i`/`target[j]`), `data`
// is the whole row. No `value === 0` guard exists in the source here (unlike `bar.js`'s
// `getBarElement()`) - ported literally as unconditional, though a `value === 0` row naturally
// renders zero blocks (`equalizerBlocks` returns `[]`), so there's nothing visible to click in that
// case regardless.
//
// **No native tooltip in the source** (no `display`, no default hover marker - `EqualizerBrush`
// has no `.setup()` beyond `innerPadding`/`outerPadding`/`unit`/`gap`). Port-only addition
// (matching this port's established precedent - see e.g. `CandlestickChart.vue`'s/
// `RangeBarChart.vue`'s identical note): a hover `ChartTooltip` (`showTooltip`, default true)
// showing the target key/value, anchored at the stack's tip (closest block to the value edge).
//
// **No theme tokens**: confirmed via grep - neither this file nor `equalizerbar.js`/
// `equalizercolumn.js` call `chart.theme()` directly; `arcEqualizerXxx` (classic/dark/gradient/
// pattern themes) belongs to the unrelated, out-of-scope `arcequalizer.js` (a radial gauge brush),
// and `equalizerColumnErrorXxx` belongs to the also out-of-scope `brush/canvas/equalizercolumn.js`
// (a *different*, canvas-based file - not this one). No new `ChartTheme` tokens were needed.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { equalizerBlocks, rangeGroupGeometry } from '../composables/useSeries'
import { useColorResolver } from '../composables/useColorResolver'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
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
    /** Outer margin around the whole group of targets within a category band. Default `15`,
     * matching `equalizer.js`'s own `outerPadding` default (NOT `bar.js`'s `2`, since this brush
     * never inherits from `bar.js`). */
    outerPadding?: number
    /** Gap between grouped targets within a category band. Default `10`, matching `equalizer.js`'s
     * own `innerPadding` default (NOT `bar.js`'s `1`). This is unrelated to the fixed 1.5px gap
     * *between blocks within one target's stack*, which the source hardcodes and this port exposes
     * as `EQUALIZER_BLOCK_GAP` (not configurable, matching the source). */
    innerPadding?: number
    /** Pixel height of one block in a target's stack. Default `5`, matching `equalizer.js`'s own
     * `unit` default. */
    unit?: number
    /** Number of consecutive blocks (counting outward from zero) that share one color band before
     * cycling to the next theme color. Default `5`, matching `equalizer.js`'s own `gap` default. */
    gap?: number
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
    outerPadding: 15,
    innerPadding: 10,
    unit: 5,
    gap: 5,
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

/** Forwards a per-element DOM event for one (row, target) block stack - see this file's header
 * comment on `addEvent(barGroup, i, j)`. No value===0 guard (the source doesn't have one here). */
function forwardEvent(type: ChartElementEventType, group: EqualizerGroup, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: group.dataIndex,
    dataKey: group.key,
    data: props.data[group.dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

// `area` isn't needed - `axis.scale()` already returns absolute, padding-inclusive pixel
// coordinates (see BarChart.vue's header comment on the double-offset bug).
const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const colorResolver = useColorResolver()
const { theme, color: themeColor } = useTheme(themeName, colorResolver)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

interface EqualizerBlockShape {
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface EqualizerGroup {
  key: string
  value: number
  dataIndex: number
  blocks: EqualizerBlockShape[]
  tooltipX: number
  tooltipY: number
}

const groups = computed<EqualizerGroup[]>(() => {
  const ax = axisX.value
  const ay = axisY.value
  const rows = dataRef.value
  const targets = props.target
  const out: EqualizerGroup[] = []

  if (ax.type !== 'block' || ay.type !== 'range' || targets.length === 0) return out

  const { itemSize: barWidth, groupSize } = rangeGroupGeometry(ax.band, targets.length, props.outerPadding, props.innerPadding)
  const zeroY = ay.scale(0) as number

  rows.forEach((row, i) => {
    let startX = (ax.scale(i) as number) - groupSize / 2

    targets.forEach((key) => {
      const value = row[key] as number
      const valueY = ay.scale(value) as number
      const blocks = equalizerBlocks(zeroY, valueY, props.unit, props.gap).map((b) => ({
        x: startX,
        y: b.y,
        width: barWidth,
        height: b.height,
        color: pickColor(b.colorIndex),
      }))

      out.push({
        key,
        value,
        dataIndex: i,
        blocks,
        tooltipX: startX + barWidth / 2,
        tooltipY: valueY,
      })

      startX += barWidth + props.innerPadding
    })
  })

  return out
})

const hoverIndex = ref<number | null>(null)
const hover = computed<EqualizerGroup | null>(() => (hoverIndex.value != null ? (groups.value[hoverIndex.value] ?? null) : null))
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid" :color-resolver="colorResolver">
    <g>
      <g
        v-for="(group, i) in groups"
        :key="i"
        style="cursor: pointer"
        @mouseover="(e: MouseEvent) => { hoverIndex = i; forwardEvent('mouseover', group, e) }"
        @mouseout="(e: MouseEvent) => { hoverIndex = null; forwardEvent('mouseout', group, e) }"
        @click="(e: MouseEvent) => forwardEvent('click', group, e)"
        @dblclick="(e: MouseEvent) => forwardEvent('dblclick', group, e)"
        @contextmenu="
          (e: MouseEvent) => {
            e.preventDefault()
            forwardEvent('contextmenu', group, e)
          }
        "
      >
        <rect v-for="(block, bi) in group.blocks" :key="bi" :x="block.x" :y="block.y" :width="block.width" :height="block.height" :fill="block.color" />
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.tooltipX"
          :y="hover.tooltipY"
          :items="[{ key: hover.key, value: formatValue(hover.value) }]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.blocks[0]?.color"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
    </template>
  </ChartBase>
</template>
