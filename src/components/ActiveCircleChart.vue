<script setup lang="ts">
// Ported from `chart.brush.canvas.activecircle` (174 lines) - see `useActiveCircle.ts`'s header
// comment for the full extend-chain / axis-based-ness / spawn-once / dead-code-methods writeup
// this component relies on.
//
// **The genuinely new integration point this brush needed**: unlike `activebubble.js`/
// `bubblecloud.js` (non-axis-based, plot-rect + physics - see `useActiveBubble.ts`'s header
// comment), this brush positions circles via REAL axis/scale math (`this.axis.x(data.x)`/
// `this.axis.y(data.y)`) - the first canvas brush in this phase that needs it. This component
// therefore reuses `useChartLayout()` AS-IS, the exact same composable every axis-based SVG
// component in Phases A-D already calls, then feeds its computed `axisX.value.scale`/`axisY.value.
// scale` (via `toSeriesScale()`, already built for `ScatterChart.vue`/`HeatmapScatterChart.vue`'s
// own free-form per-row-field scale application) to `ChartCanvasBase`'s `@frame` handler instead of
// a `<circle>` SVG element. No new axis/layout composable was needed - confirming the axis/scale
// math is genuinely rendering-backend-agnostic, only the final draw call differs.
//
// No grid/tick chrome is drawn here (`activecircle.js`'s own `draw()` renders circles only,
// nothing else - grid/axis chrome is a separately-composited widget in the original engine, out of
// scope for a single brush's port, same as every other Phase E canvas brush).
import { ref, toRef } from 'vue'
import ChartCanvasBase from './ChartCanvasBase.vue'
import { useChartLayout } from '../composables/useChartLayout'
import { toSeriesScale } from '../composables/useSeries'
import { useTheme } from '../composables/useTheme'
import type { FrameInfo } from '../composables/useCanvasChart'
import { ActiveCircleField, type ActiveCircleRow } from '../composables/useActiveCircle'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Rows to seed circles from - each needs numeric `x`/`y` (plotted through the real axis
     *  scales, see this file's header comment), plus optional `radius`/`vx`/`vy`/`ax`/`ay` (see
     *  `useActiveCircle.ts`'s `ActiveCircleRow`). **Only the FIRST frame that finds zero live
     *  circles ever reads this** - a real, source-confirmed quirk (see `useActiveCircle.ts`'s
     *  header comment): appending/replacing rows afterward has no effect once circles exist for
     *  this component's lifetime (or since the last `reset()` call - see below). */
    data: DataRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    /** `chart.brush.canvas.activecircle`'s own `radius` (default `20`, matching
     *  `CanvasActiveCircleBrush.setup()`) - only used as a per-row FALLBACK (`data.radius ||
     *  radius`), read once per circle at spawn time, matching source. */
    radius?: number
    colors?: string[]
    /** Port-only addition (no original heading in `activecircle.js` itself), matching every other
     *  Phase E canvas component's own `title` prop convention. */
    title?: string
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    radius: 20,
    colors: undefined,
    title: undefined,
  },
)

const dataRef = toRef(props, 'data')

const { axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i % props.colors.length] ?? themeColor(i)
}

// Small wrapper closures that read the CURRENT axisX.value/axisY.value on every call, so a live
// circle's position keeps reflecting a resize/axis-config change exactly like the original's one
// persistent `this.axis` reference - see useActiveCircle.ts's `Circle` doc comment for why a
// one-time-captured scale function would NOT be faithful here.
const scaleX = (value: number): number => toSeriesScale(axisX.value)(value)
const scaleY = (value: number): number => toSeriesScale(axisY.value)(value)

// Created ONCE, for this component's whole lifetime - matches `chart.getCache("active_circle",
// [])`'s own per-chart-lifetime persistence (this brush has no `drawBefore()` reset hook at all,
// unlike activebubble.js - see useActiveCircle.ts's header comment). Deliberately NOT a `ref`/
// recreated by a `watch` on width/height/axis props: the source has no such reset trigger either,
// so a resize here just keeps stepping the SAME circles through the live (resized) scale.
let field = new ActiveCircleField()
const circleCount = ref(0)

function onFrame(ctx: CanvasRenderingContext2D, frame: FrameInfo): void {
  const tpf = frame.delta / 1000
  field.step(dataRef.value as ActiveCircleRow[], scaleX, scaleY, pickColor, props.radius, tpf)
  field.render(ctx)
  circleCount.value = field.circles.length

  if (props.title) {
    ctx.fillStyle = theme('titleFontColor')
    ctx.font = `${theme('titleFontWeight')} ${theme('titleFontSize')}px ${theme('fontFamily')}`
    ctx.textAlign = 'center'
    ctx.fillText(props.title, props.width / 2, 16)
  }
}

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)

/** Port-only: recreates the physics field from scratch, clearing every live circle so the next
 *  frame re-seeds from `props.data` again - the source itself has no such reset (the
 *  `circles.length === 0` spawn gate never re-opens on its own, see this file's header comment). */
function reset(): void {
  field = new ActiveCircleField()
  circleCount.value = 0
}

defineExpose({ circleCount, reset, redraw: () => canvasBase.value?.redraw() })
</script>

<template>
  <ChartCanvasBase ref="canvasBase" :width="props.width" :height="props.height" :theme="props.theme" :animate="true" @frame="onFrame" />
</template>
