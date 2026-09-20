<script setup lang="ts">
// Ported from `chart.widget.title` (jui-chart/src/widget/title.js). `extend: "chart.widget.core"`,
// confirmed from source (matches `topologyctrl.js`'s/`legend.js`'s own chain) - and confirmed to
// make ZERO `jui.include(...)` calls, so nothing here traces back into `juijs-graph`/`jui-graph-ts`;
// this is a pure hand-port of `title.js`'s own leaf-level orient/align/rotation math.
//
// **Only source's `else`/`@Deprecated` branch is ported - the `if(axis)` branch is NOT.** Full
// reasoning (`chart.area()`/`chart.padding()` vs. `axis.area()`/`axis.padding()`, confirmed from
// `juijs-graph/src/base/builder.js` + `axis.js`) lives in `useChartTitle.ts`'s header comment and
// PORT_STATUS.md's `title.js` entry - short version: this port's `useChartLayout.ts` has exactly
// ONE shared plot area/padding for `axisX`/`axisY` together, no per-axis area/padding the way
// upstream's multi-axis-grid layout allows, and `AxisConfig` carries no `padding` field at all - so
// `chart.axis(widget.axis)` has no real per-axis region to resolve against here, and none of this
// port's 27 `<ChartTitle>` call sites ever had an axis concept to begin with.
//
// `width`/`height`/`padding` replace source's implicit `chart.area()`/`chart.padding()` (see
// `computeChartArea()` in `useChartTitle.ts`, which reproduces `chart.builder`'s own `calculate()`)
// - callers pass their own SVG size + (optional) chart-level padding instead of pre-building a
// plot-area object, so non-axis chart types (PieChart/DonutChart/...) that never call
// `useChartLayout` don't need one either.
import { computed } from 'vue'
import { computeTitlePosition, computeTitleRotation, type TitleAlign, type TitleOrient } from '../composables/useChartTitle'
import { measureTextSize } from '../composables/tooltipMeasure'
import type { ChartPadding } from '../types'

const props = withDefaults(
  defineProps<{
    text: string
    /** Chart's own SVG width - `chart.svg.size().width` equivalent. */
    width: number
    /** Chart's own SVG height - `chart.svg.size().height` equivalent. */
    height: number
    /** Chart-level padding - `chart.padding()` equivalent. Defaults to all-zero, matching every
     * current `<ChartTitle>` caller (none has a chart-level padding concept for its title today). */
    padding?: Partial<ChartPadding>
    /** `[orient="top"]` - top/bottom/center. Anything other than `"bottom"`/`"top"` falls to the
     * vertical-center branch, matching source's implicit else-chain (not an exhaustive enum). */
    orient?: TitleOrient
    /** `[align="middle"]` - start/middle/end. Anything other than `"middle"`/`"start"` falls to
     * the end-aligned branch, matching source's implicit else-chain (not an exhaustive enum). */
    align?: TitleAlign
    /** `[dx=0]` - moves x by a set value from the computed orient/align position. */
    dx?: number
    /** `[dy=0]` - moves y by a set value from the computed orient/align position. */
    dy?: number
    /** `widget.color || chart.theme("titleFontColor")` - explicit override; falls back to this
     * component's own default (`#333`, `classicTheme.titleFontColor`'s value) when omitted, since
     * `ChartTitle` has no `chart` instance of its own to read a live theme token from - the caller
     * passes the resolved theme value (as every current caller already does via `theme(...)`). */
    color?: string
    /** `widget.size || chart.theme("titleFontSize")` - same override/fallback shape as `color`. */
    size?: number
    /** `chart.theme("titleFontWeight")` - **NOT overridable in source** (`draw()` sets
     * `"font-weight": chart.theme("titleFontWeight")` unconditionally, no `widget.weight ||`
     * fallback exists at all, unlike `color`/`size`). Kept as a prop (not a hardcoded internal
     * default) only because `ChartTitle` has no theme of its own to read - every caller passes
     * the theme value straight through, exactly matching source's own always-theme behavior. */
    weight?: string
  }>(),
  {
    padding: () => ({}),
    orient: 'top',
    align: 'middle',
    dx: 0,
    dy: 0,
    color: '#333',
    size: 13,
    weight: 'normal',
  },
)

const position = computed(() => computeTitlePosition(props.width, props.height, props.padding, props.orient, props.align))

const textX = computed(() => position.value.x + props.dx)
const textY = computed(() => position.value.y + props.dy)

// `chart.svg.getTextSize(widget.text)` equivalent - real DOM measurement, only needed for the
// rotation center (orient="center" + align="start"/"end"); see `measureTextSize()`'s own header
// comment for why it isn't unit-tested directly (no real font metrics under vitest/jsdom).
const rotation = computed(() => {
  const { width: textWidth, height: textHeight } = measureTextSize(props.text, props.size)
  return computeTitleRotation(props.orient, props.align, textX.value, textY.value, textWidth / 2, textHeight / 2)
})

const transform = computed(() => (rotation.value ? `rotate(${rotation.value.angle} ${rotation.value.cx} ${rotation.value.cy})` : undefined))
</script>

<template>
  <text
    :x="textX"
    :y="textY"
    :text-anchor="position.anchor"
    :fill="color"
    :font-size="size"
    :font-weight="weight"
    :transform="transform"
  >{{ text }}</text>
</template>
