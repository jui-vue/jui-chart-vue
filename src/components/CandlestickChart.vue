<script setup lang="ts">
// Ported from `chart.brush.candlestick` (82 lines). **Source-confirmed data model** (per this
// item's brief - don't assume the common naming): `draw()` reads FOUR separate, fixed field
// names per row via `this.getValue(data, "high", 0)` / `"low"` / `"open"` / `"close"` -
// `getValue` is `chart.axis.getValue()`, which looks up `data[axis.keymap[fieldString]]` first
// (an optional per-axis rename table, e.g. the original's own `examples/candlestick.html` remaps
// `high`->`h`, `low`->`l`, `open`->`o`, `close`->`c`) and falls back to `data[fieldString]`
// directly. So this is NOT the `[low, high]`-tuple-per-target model `useRangeSeries` was built
// for (rangearea.js/rangebar.js/rangecolumn.js) - it's 4 independent scalar fields on the SAME
// row, and critically **there is no `target` array config at all**: `CandleStickBrush` has no
// `.setup()` (confirmed by reading the whole file), so `target`/`colors`/`display`/`active` (all
// inherited from `chart.brush.core`'s defaults) are simply never read - one candle is drawn per
// row, unconditionally, not one shape per `(row, target)` pair like every other ported brush.
// This port doesn't have an `axis.keymap` composable, so the equivalent of the source's keymap
// remap is 4 props (`openField`/`highField`/`lowField`/`closeField`, defaulting to
// `'open'`/`'high'`/`'low'`/`'close'`) read directly off each row - a port-only ergonomic
// substitute for the same remapping capability, not a new concept.
//
// **Separate implementation, not a `bar.js`/`rangebar.js` extension**: `extend: "chart.brush.core"`
// directly (confirmed from the file header) - candlestick.js shares no code with bar.js,
// rangebar.js, or rangecolumn.js beyond the inherited core `eachData`/`getValue`/`offset`/
// `addEvent` helpers every brush gets. Its own geometry (`drawBefore()`'s `barWidth`/`barPadding`
// formula, `draw()`'s open/close-relative rect+line shape) is unique to this brush.
//
// **Body + wick, two primitives per row** (source-confirmed): `draw()` builds one `<line>` (the
// high-low "wick", `x1===x2===startX`, spanning `axis.y(high)` to `axis.y(low)`) and one `<rect>`
// (the open-close "body", `x: startX - barPadding`, `width: barWidth`, `y`/`height` computed
// against whichever of open/close is the *lower pixel position* - see below) per row. `startX` is
// `this.offset("x", i)`: for a block-type x-axis (the only kind this brush is ever used with),
// `offset()` returns `this.axis.x(i)` unchanged (`offset()`'s `rangeBand()/2` addition is gated on
// `type != "block"`) - i.e. exactly this port's own block-axis `scale(i)`, which `useScale.ts`'s
// `createOrdinalScale` already returns as the band's pixel CENTER, not its left edge (confirmed by
// reading `createOrdinalScale` fresh rather than assuming - matches `RangeBarChart.vue`'s own
// `ax.scale(i)` precedent for a block axis in "column" orient). `barWidth = axis.x.rangeBand() *
// 0.7`, `barPadding = barWidth / 2` - `axis.x.rangeBand()` is this port's `ax.band`.
//
// **Bullish/bearish color logic, theme-driven, source-confirmed** (`src/theme/classic.js`/
// `dark.js`, tokens NOT already in this port's trimmed `ChartTheme` - added below): branches on
// `open > close` (strictly), matching the source's own `if (open > close)` - NOT `close >= open`
// vs. `close < open`, i.e. an exact tie (`open === close`) takes the "close >= open" branch, not
// the invert one:
//   - `open > close` (a down/bearish day - source's own Korean comment: "시가가 종가보다 높을 때 (Red)",
//     "when the open is higher than the close (Red)"): wick+body both use
//     `candlestickInvertBorderColor`/`candlestickInvertBackgroundColor` (classic: solid red
//     `#ff0000` both border+fill; dark: `#ff4848` both). Body's `y` = `axis.y(open)` (the higher
//     pixel-value point since a "range" y-axis is never reversed by default), `height =
//     abs(axis.y(close) - axis.y(open))`.
//   - otherwise (`close >= open`, an up/bullish day, including an exact tie): wick+body use
//     `candlestickBorderColor`/`candlestickBackgroundColor` (classic: black border `#000`, white
//     fill `#fff` - a hollow candle; dark: solid teal `#14be9d` both). Body's `y` = `axis.y(close)`,
//     `height = abs(axis.y(open) - axis.y(close))`.
// No `colors`/per-target override exists in the source for either color pair (no `.setup()` at
// all) - this port matches that: colors come from theme tokens only, no `colors` prop on this
// component (unlike every other ported chart, which all have a per-target `target`/`colors`
// pair - candlestick genuinely has neither).
//
// **Per-element event forwarding**: `this.addEvent(r, i, null)` - called on the BODY rect only
// (never the wick line), unconditionally (no `value === 0`-style guard, matching
// `RangeBarChart.vue`'s own precedent for a brush with no single "zero" value to guard against).
// `addEvent(elem, dataIndex, targetIndex)` with `targetIndex === null` resolves `dataKey = null`
// (`this.brush.target[targetIndex]` is skipped whenever `targetIndex == null`, confirmed from
// `brush/core.js`) - the payload shape here is `{dataIndex: i (real row index), dataKey: null,
// data: row i}`, the INVERSE of `RangeAreaChart`'s/most per-target components' `{dataIndex: null,
// dataKey: real}` shape, because a candlestick is one-shape-per-ROW, not one-shape-per-target.
//
// No curve/step option, no `startZero`, no `display`, no `active`/`activeEvent` - none exist in
// the source (confirmed, no `.setup()` beyond the inherited core no-ops), so none are added here.
//
// Port-only addition (not in candlestick.js at all, matching this port's established precedent -
// see e.g. `RangeAreaChart`'s/`RangeBarChart`'s identical note): a hover `ChartTooltip`
// (`showTooltip`, default true, `format` prop) showing the open/high/low/close values for the
// hovered candle - the source has no default tooltip wiring of its own.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { candleBodyGeometry } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { AxisConfig, ChartElementEventPayload, ChartElementEventType, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    /** Row field holding the open value. Port-only substitute for the original's `axis.keymap`. Default `'open'`. */
    openField?: string
    /** Row field holding the high value. Default `'high'`. */
    highField?: string
    /** Row field holding the low value. Default `'low'`. */
    lowField?: string
    /** Row field holding the close value. Default `'close'`. */
    closeField?: string
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    showTooltip?: boolean
    title?: string
    /** Formats the open/high/low/close values shown in the hover tooltip. Default: the raw value. */
    format?: (value: number) => string | number
  }>(),
  {
    openField: 'open',
    highField: 'high',
    lowField: 'low',
    closeField: 'close',
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
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

/** Forwards a per-element DOM event for one candle's body - see this file's header comment.
 * `dataKey` is always `null` (source's `addEvent(r, i, null)` - `targetIndex` is `null`, unlike
 * every per-target component's `dataIndex: null` shape). No `value === 0` guard - the source
 * doesn't guard `addEvent` at all here either. */
function forwardEvent(type: ChartElementEventType, candle: Candle, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: candle.dataIndex,
    dataKey: null,
    data: props.data[candle.dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

// `area` isn't needed - `axis.scale()` already returns absolute, padding-inclusive pixel
// coordinates (see BarChart.vue's header comment on the double-offset bug fixed across every
// other axis-based component in this port; RangeBarChart.vue/RangeAreaChart.vue already follow
// this same "don't destructure area" precedent).
const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme } = useTheme(themeName)

interface Candle {
  x: number
  bodyY: number
  bodyHeight: number
  bodyWidth: number
  wickX: number
  wickY1: number
  wickY2: number
  borderColor: string
  fillColor: string
  bullish: boolean
  open: number
  high: number
  low: number
  close: number
  dataIndex: number
  tooltipX: number
  tooltipY: number
}

const candles = computed<Candle[]>(() => {
  const ax = axisX.value
  const ay = axisY.value
  const rows = dataRef.value
  const out: Candle[] = []

  if (ax.type !== 'block' || ay.type !== 'range') return out

  const barWidth = ax.band * 0.7 // barPadding (source's own half-width offset) = barWidth / 2, applied in the template (`candle.x - candle.bodyWidth / 2`)

  rows.forEach((row, i) => {
    const startX = ax.scale(i) as number
    const high = row[props.highField] as number
    const low = row[props.lowField] as number
    const open = row[props.openField] as number
    const close = row[props.closeField] as number

    const wickY1 = ay.scale(high) as number
    const wickY2 = ay.scale(low) as number

    const yScale = (v: number) => ay.scale(v) as number
    const { bullish, y: bodyAnchorY, height: bodyHeight } = candleBodyGeometry(open, close, yScale)

    out.push({
      x: startX,
      bodyY: bodyAnchorY,
      bodyHeight,
      bodyWidth: barWidth,
      wickX: startX,
      wickY1,
      wickY2,
      borderColor: bullish ? theme('candlestickBorderColor') : theme('candlestickInvertBorderColor'),
      fillColor: bullish ? theme('candlestickBackgroundColor') : theme('candlestickInvertBackgroundColor'),
      bullish,
      open,
      high,
      low,
      close,
      dataIndex: i,
      tooltipX: startX,
      tooltipY: Math.min(wickY1, wickY2),
    })
  })

  return out
})

function formatValue(value: number): string | number {
  return props.format ? props.format(value) : value
}

const hoverIndex = ref<number | null>(null)
const hover = computed<Candle | null>(() => (hoverIndex.value != null ? (candles.value[hoverIndex.value] ?? null) : null))
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <template v-for="(candle, i) in candles" :key="i">
        <line :x1="candle.wickX" :y1="candle.wickY1" :x2="candle.wickX" :y2="candle.wickY2" :stroke="candle.borderColor" stroke-width="1" />
        <rect
          :x="candle.x - candle.bodyWidth / 2"
          :y="candle.bodyY"
          :width="candle.bodyWidth"
          :height="candle.bodyHeight"
          :fill="candle.fillColor"
          :stroke="candle.borderColor"
          stroke-width="1"
          style="cursor: pointer"
          @mouseover="(e) => { hoverIndex = i; forwardEvent('mouseover', candle, e) }"
          @mouseout="(e) => { hoverIndex = null; forwardEvent('mouseout', candle, e) }"
          @click="(e) => forwardEvent('click', candle, e)"
          @dblclick="(e) => forwardEvent('dblclick', candle, e)"
          @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', candle, e) }"
        />
      </template>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
      <g v-if="props.showTooltip && hover">
        <ChartTooltip
          visible
          :x="hover.tooltipX"
          :y="hover.tooltipY"
          :items="[
            { key: 'open', value: formatValue(hover.open) },
            { key: 'high', value: formatValue(hover.high) },
            { key: 'low', value: formatValue(hover.low) },
            { key: 'close', value: formatValue(hover.close) },
          ]"
          :background-color="theme('tooltipBackgroundColor')"
          :background-opacity="theme('tooltipBackgroundOpacity')"
          :border-color="theme('tooltipBorderColor') ?? hover.borderColor"
          :font-color="theme('tooltipFontColor')"
          :font-size="theme('tooltipFontSize')"
        />
      </g>
    </template>
  </ChartBase>
</template>
