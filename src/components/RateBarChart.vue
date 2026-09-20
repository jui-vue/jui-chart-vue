<script setup lang="ts">
// Ported from `chart.brush.ratebar` (212 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson - see e.g. `EqualizerChart.vue`'s/`BarChart.vue`'s own header
// comments on `equalizer.js`/`fullstackbar.js`): `extend: "chart.brush.core"` **directly** - shares
// NO code with `bar.js`/`stackbar.js`/`fullstackbar.js` (no inherited `getBarElement`/
// `addBarElement`/`setActiveEffect` - `RateBarBrush` writes its own `createBarElement`/`draw`/
// `setActiveBarElement` from scratch). Only ONE orientation exists upstream (no "ratecolumn"
// sibling) - x is always the range/value axis, y always the block/category axis, confirmed from
// `draw()`'s `this.offset("y", i)`/`axis.x.rate(...)` calls (the reverse of `equalizer.js`, which
// is x=block/y=range).
//
// **What "rate" actually means here, confirmed from `draw()` - NOT a single value against a
// separate max/goal field** (the name plausibly suggests that, but it's wrong): each ROW renders
// as ONE horizontal pill-shaped bar, split into contiguous colored segments, one per `target` key
// whose value is `> 0` (`nonZeroKeys = keys.filter(k => data[k] > 0)` - a zero/negative value's
// target is skipped entirely, not rendered as a zero-width placeholder). Each segment's width is
// that key's share of the ROW's own total (`sumValues`, the sum of only that row's nonzero
// targets) - i.e. a per-row 100%-composition bar (closer to `fullstackbar.js`'s `normalize` mode
// than to any single-value "progress toward a goal" widget), always filling the chart's full plot
// width regardless of the row's raw total. There is no separate background "track" bar behind the
// fill - the segments themselves (which always sum to 100% of the row) ARE the whole visible bar.
//
// **Geometry derivation** (same algebra as `fullstackbar.js`'s `normalize` mode - see
// `normalizeStackFractions`'s doc comment in `useSeries.ts`): the source literally calls
// `axis.x.rate(data[key], sumValues)`, which is `util.scale.linear.js`'s `func(func.max() *
// (value/max))` - linear from a domain starting at 0, so the domain max cancels out algebraically,
// leaving a plain `(value / sum) * totalPixelSpan`. So the x-axis's configured domain has ZERO
// effect on segment geometry (only on the optional percent label, and only when its domain max is
// configured as `100` - see `computeStackPercent`'s doc comment). Ported as pure `rateBarSegments()`
// in `useSeries.ts` (unit-tested with hand-traced values, including the nonzero-key-filtering
// behavior and the rounded-pill-end selection).
//
// **Distinguishing visual features, all source-confirmed** (per this item's own brief - checked
// each candidate rather than assuming): (1) rounded pill ends - `leftRadius`/`rightRadius`
// (`theme('rateBarBorderRadius')`, default 5) apply ONLY to the first/last *nonzero* segment of
// each row (interior segment boundaries are always square, contiguous, no gap) - ported via the
// shared `roundedRectPath()` (moved out of `BarChart.vue` into `useSeries.ts` so both components
// reuse the same arc-path helper rather than duplicating it); the source's own `rightRadius`
// condition also checks `keys.length == 1`, but since `nonZeroKeys` is always a subset of `keys`,
// that clause is dead - if `keys.length === 1` then `nonZeroKeys.length` is 0 or 1, and when it's
// 1 the first clause (`j == nonZeroKeys.length-1`) is already true - confirmed by hand-tracing,
// not ported as a separate condition. (2) an unconditional percent-or-custom TEXT label centered
// in every segment - **NOT a togglable boolean** despite the option being named `showText`: the
// source's `_.typeCheck("function", this.brush.showText) ? this.brush.showText.call(...) :
// \`${percent}%\`` means a non-function `showText` (including `true`/`false`/omitted) always falls
// through to the default `"N%"` text - there is no way to hide the label upstream. This port keeps
// the same non-boolean shape (`showText?: (value, percent, key) => string | number`) rather than
// inventing a toggle, to avoid silently adding upstream-absent behavior. (3) a small dashed-line
// "flag" callout tooltip floating above each segment (in the reserved `tooltipSize`px gap above the
// bar), showing the raw value or a custom format - same non-boolean shape as `showText`
// (`showTooltip?: (value, percent, key) => string | number`) - rendered only if the tooltip text's
// REAL measured pixel width is narrower than the segment's own width
// (`this.svg.getTextSize(tooltip).width < width`), ported via the same `measureTextWidth()` this
// port's `ChartTooltip.vue` already uses (extracted to `tooltipMeasure.ts` so both share one
// offscreen-`<text>` measurer). (4) NO color-banding-by-value (no speedometer red/yellow/green
// zones, unlike `equalizer.js`'s per-block color bands) - color is a plain per-TARGET
// `this.color(dataIndex, targetIndex)`, i.e. `pickColor(targetIndex)`, same convention as every
// other multi-target component in this port. (5) no animation-only features exist in the source at
// all (no `.animate()`/transition calls anywhere in the 212 lines).
//
// **`active`/`activeEvent` - a genuinely new, third shape in this port, don't assume it matches
// `bar.js`'s row-level or flat-index precedent**: re-read `setActiveBarElement(activeIndex,
// activeTarget)` closely (see `rateBarActiveOpacity`'s own doc comment in `useSeries.ts` for the
// full derivation) - dimming only ever applies to a segment in the SAME row as `activeIndex` whose
// own key differs from `activeTarget`; segments in every OTHER row are always full opacity, and the
// exact matching segment is also never dimmed. So the visible effect is "dim this one row's OTHER
// segments" (highlighting one segment within its own row), not a whole-chart highlight the way
// `bar.js`'s flat-index `active` or `stackbar.js`'s row-level `active` behave. `activeEvent` (a DOM
// event name string) wires a listener per segment that unconditionally OVERWRITES the active
// `(index, target)` pair on that event - no toggle, no mouseout-reset (same one-way-overwrite shape
// as `bar.js`'s own later-shipped `activeEvent`, confirmed absent here too) - and sets
// `cursor:pointer` on the segment, only when `activeEvent != null`.
//
// **Events**: `this.addEvent(g, dataIndex, targetIndex)` - once per segment (`dataIndex`/`dataKey`
// both real, `data` = the whole row), unconditionally (no `value === 0` guard - the `nonZeroKeys`
// pre-filter already means a zero-value target never gets a segment/group to attach a listener to
// in the first place, so there's nothing to guard).
//
// **No native hover balloon in the source** beyond the always-on flag callout above - this port
// does not add a redundant extra hover `ChartTooltip` (unlike `EqualizerChart.vue`/
// `RangeBarChart.vue`'s port-only hover additions), since the flag already surfaces the value
// without requiring a hover.
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { measureTextWidth } from '../composables/tooltipMeasure'
import { rateBarActiveOpacity, rateBarRowLayout, rateBarSegments, roundedRectPath } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
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
    colors?: string[]
    showGrid?: boolean
    title?: string
    /** Row index into `props.data` to statically mark active - see this file's header comment on
     * `setActiveBarElement`. Only meaningful together with `activeTarget` (both `!= null`).
     * Matches `ratebar.js`'s own `activeIndex` option name/default (`null`). */
    activeIndex?: number | null
    /** Target key, within `activeIndex`'s row, to statically mark active. See `activeIndex`. */
    activeTarget?: string | null
    /** DOM event name (e.g. `"click"`/`"mouseover"`) that overwrites the active `(activeIndex,
     * activeTarget)` pair to whichever segment it fires on - no toggle, no reset. `null` (default)
     * disables the interaction entirely, matching `ratebar.js`'s own `activeEvent` default. */
    activeEvent?: string | null
    /** Formats each segment's centered label. Receives the segment's raw value, its rounded
     * percent (`Math.round((value/sum)*axisX.max())` - see `computeStackPercent`), and its target
     * key. Default: `` `${percent}%` `` - **note this is a formatter, not a boolean toggle**: the
     * label always renders, matching `ratebar.js`'s own non-boolean `showText` (see header
     * comment). */
    showText?: (value: number, percent: number, key: string) => string | number
    /** Formats each segment's flag-callout tooltip text (shown above the bar when it fits - see
     * header comment). Default: the raw value. Same non-boolean shape as `showText`. */
    showTooltip?: (value: number, percent: number, key: string) => string | number
    /** Pixel height reserved above each row's bar for the flag-callout tooltip - also subtracted
     * from the bar's own visible height. Default `14`, matching `ratebar.js`'s own `tooltipSize`. */
    tooltipSize?: number
    /** `ratebar.js`'s own `padding` option (half of it is subtracted from the bar's visible
     * height) - distinct from this component's chart-level `padding` prop (outer margins). Default
     * `0`, matching the source. */
    barPadding?: number
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    colors: undefined,
    showGrid: true,
    title: undefined,
    activeIndex: null,
    activeTarget: null,
    activeEvent: null,
    showText: undefined,
    showTooltip: undefined,
    tooltipSize: 14,
    barPadding: 0,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

function forwardEvent(type: ChartElementEventType, dataIndex: number, key: string, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex,
    dataKey: key,
    data: props.data[dataIndex] ?? null,
    event: e,
  })
}

const dataRef = toRef(props, 'data')

// `area` IS needed here (unlike most axis-based components post the double-offset-bug fix) - see
// `rateBarSegments`'s doc comment: segment geometry is pure `(value/sum)*totalPixelSpan` fraction
// math that bypasses `axis.x.scale()` entirely (same reasoning as `BarChart.vue`'s `normalize`
// mode), so it needs `area.width`/`area.x` as its own absolute pixel span/origin. The row's
// vertical position, by contrast, DOES go through `axis.y.scale()` (already absolute), so `area.y`
// is never used.
const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

interface RateBarSegmentShape {
  key: string
  value: number
  percent: number
  x: number
  width: number
  d: string
  color: string
  text: string | number
  tooltipText: string | number | null
  /** Measured pixel width of `tooltipText` (`0` when `tooltipText` is `null`) - sizes the flag
   * callout's background rect, matching `createTooltipElement`'s `r` rect (`width: textSize.width`). */
  tooltipWidth: number
}

interface RateBarRow {
  dataIndex: number
  y: number
  height: number
  segments: RateBarSegmentShape[]
}

const rows = computed<RateBarRow[]>(() => {
  const ax = axisX.value
  const ay = axisY.value
  if (ax.type !== 'range' || ay.type !== 'block') return []

  const axisMax = ax.scale.max()
  const totalWidth = area.value.width
  const targets = props.target
  const radius = theme('rateBarBorderRadius')
  const tooltipFontSize = theme('rateBarTooltipFontSize')

  return dataRef.value.map((row, i) => {
    const centerY = ay.scale(i) as number
    const { y, height } = rateBarRowLayout(centerY, ay.band, props.tooltipSize, props.barPadding)

    const segments = rateBarSegments(row, targets, totalWidth, axisMax).map((seg): RateBarSegmentShape => {
      const targetIndex = targets.indexOf(seg.key)
      const leftRadius = seg.isFirst ? radius : 0
      const rightRadius = seg.isLast ? radius : 0
      const text = props.showText ? props.showText(seg.value, seg.percent, seg.key) : `${seg.percent}%`
      const rawTooltip = props.showTooltip ? props.showTooltip(seg.value, seg.percent, seg.key) : seg.value
      const measuredTooltipWidth = measureTextWidth(String(rawTooltip), tooltipFontSize)
      const fits = measuredTooltipWidth < seg.width

      return {
        key: seg.key,
        value: seg.value,
        percent: seg.percent,
        x: area.value.x + seg.x,
        width: seg.width,
        d: roundedRectPath(0, 0, seg.width, height, leftRadius, rightRadius, rightRadius, leftRadius),
        color: pickColor(targetIndex),
        text,
        tooltipText: fits ? rawTooltip : null,
        tooltipWidth: fits ? measuredTooltipWidth : 0,
      }
    })

    return { dataIndex: i, y, height, segments }
  })
})

const activeEventPair = ref<{ index: number; target: string } | null>(null)
const effectiveActiveIndex = computed(() => activeEventPair.value?.index ?? props.activeIndex)
const effectiveActiveTarget = computed(() => activeEventPair.value?.target ?? props.activeTarget)

function onSegmentActiveEvent(rowIndex: number, key: string) {
  activeEventPair.value = { index: rowIndex, target: key }
}

function segmentOpacity(rowIndex: number, key: string): number {
  return rateBarActiveOpacity(rowIndex, key, effectiveActiveIndex.value, effectiveActiveTarget.value, theme('rateBarDisableBackgroundOpacity'))
}
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g>
      <g v-for="row in rows" :key="row.dataIndex">
        <g
          v-for="seg in row.segments"
          :key="seg.key"
          :transform="`translate(${seg.x}, ${row.y})`"
          :opacity="segmentOpacity(row.dataIndex, seg.key)"
          :style="{ cursor: props.activeEvent ? 'pointer' : undefined }"
          @click="(e: MouseEvent) => forwardEvent('click', row.dataIndex, seg.key, e)"
          @dblclick="(e: MouseEvent) => forwardEvent('dblclick', row.dataIndex, seg.key, e)"
          @contextmenu="
            (e: MouseEvent) => {
              e.preventDefault()
              forwardEvent('contextmenu', row.dataIndex, seg.key, e)
            }
          "
          @mouseover="(e: MouseEvent) => forwardEvent('mouseover', row.dataIndex, seg.key, e)"
          @mouseout="(e: MouseEvent) => forwardEvent('mouseout', row.dataIndex, seg.key, e)"
          @[props.activeEvent]="onSegmentActiveEvent(row.dataIndex, seg.key)"
        >
          <path :d="seg.d" :fill="seg.color" :stroke="theme('rateBarBorderColor')" :stroke-width="theme('rateBarBorderWidth')" />
          <text :x="seg.width / 2" :y="row.height / 2 + theme('rateBarFontSize') / 3" font-weight="bold" :font-size="theme('rateBarFontSize')" :fill="theme('rateBarFontColor')" text-anchor="middle">
            {{ seg.text }}
          </text>
          <g v-if="seg.tooltipText != null" :transform="`translate(0, ${-props.tooltipSize})`">
            <path
              :d="`M 1 ${props.tooltipSize} V ${props.tooltipSize / 2} H ${seg.width - 1} V ${props.tooltipSize}`"
              fill="transparent"
              :stroke="theme('rateBarTooltipBorderColor')"
              stroke-dasharray="2,2"
            />
            <rect :x="seg.width / 2 - seg.tooltipWidth / 2" y="1" :width="seg.tooltipWidth" :height="props.tooltipSize - 2" :fill="theme('rateBarTooltipBackgroundColor')" />
            <text :x="seg.width / 2" :y="props.tooltipSize / 2" text-anchor="middle" alignment-baseline="middle" :font-size="theme('rateBarTooltipFontSize')" :fill="theme('rateBarTooltipFontColor')">
              {{ seg.tooltipText }}
            </text>
          </g>
        </g>
      </g>
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
