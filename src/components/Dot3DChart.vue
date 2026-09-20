<script setup lang="ts">
// Ported from `chart.brush.canvas.dot3d` (`jui-chart/src/brush/canvas/dot3d.js`, 166 lines) - see
// `useDot3d.ts`'s header comment for the full extend-chain / polygon.* dependency / real-3D-vs-
// shading / axis-based-ness / preserved-bug writeup this component relies on.
//
// **Static per render (`animate: false`), unlike activecircle/activebubble/bubblecloud**:
// `dot3d.js` has no kinetic/physics loop of its own - its `draw()` only reruns when the chart
// itself re-renders (a data/config change, or the separate, unported `rotate3d.js` mouse-drag
// widget calling `chart.render()`). `ChartCanvasBase.vue`'s own header comment already names
// dot3d as a canonical "static per render" example. Since this wrapper only auto-redraws on its
// own `width`/`height`/`theme`/`animate` props (see `ChartCanvasBase.vue`), every OTHER prop this
// component reads inside its `@frame` handler (`data`, `symbol`, `degreeX/Y/Z`, `depth`,
// `perspective`, `colorIndex`, `size`, `zDomain`) is watched explicitly below to call `redraw()` -
// the same pattern every other Phase E component's own prop-driven redraw uses.
//
// **z axis scope, see `useDot3d.ts`'s header comment**: `axisX`/`axisY` reuse the real
// `useChartLayout`/`toSeriesScale` machinery exactly like `activecircle.js`'s own port. The z
// dimension does NOT get a full ported `chart.axis` grid (ticks/chrome/`isFull3D()` positioning,
// the interactive rotate widget) - out of scope for this iteration, same boundary as
// `column3d.js`/`line3d.js`/`widget/polygon/rotate3d.js`. Instead `zDomain` (explicit, or
// auto-computed from `data`'s own z values) is mapped to `[0, depth]` via the same
// `createLinearScale` every other axis composable already uses, and `calculate3d()`'s exact
// depth/center formula (`Math.max(plotWidth, plotHeight, depth)`, center `(areaCenterX,
// areaCenterY, depth/2)` - see `usePolygon3d.ts`) is reproduced here by hand.
import { computed, ref, toRef, watch } from 'vue'
import ChartCanvasBase from './ChartCanvasBase.vue'
import { useChartLayout } from '../composables/useChartLayout'
import { toSeriesScale } from '../composables/useSeries'
import { createLinearScale } from '../composables/useScale'
import { useTheme } from '../composables/useTheme'
import { drawFilledCircle, drawFilledPolygon, drawStrokedLineWithFill } from '../composables/canvasPrimitives'
import { buildDot3dDraws, createPolyFillCache, sortDot3dDraws, type Dot3dProjection, type Dot3dRow, type Dot3dSymbol } from '../composables/useDot3d'
import type { AxisConfig, ChartPadding, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: Dot3dRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    /** `chart.brush.canvas.dot3d`'s own `symbol` (default `"dot"`, matches `CanvasDot3DBrush.setup()`). */
    symbol?: Dot3dSymbol
    /** `chart.brush.canvas.dot3d`'s own `size` (default `4`) - dot diameter and line width, both `size/2`. */
    size?: number
    /** `chart.brush.canvas.dot3d`'s own `color` (a theme palette INDEX, default `0` - one color for the whole series, not per-row). */
    colorIndex?: number
    /** `axis.depth` (default `0`, matching `chart.axis`'s own default - with `depth: 0` every z position/perspective collapses flat). */
    depth?: number
    /** `axis.degree.x/y/z` (each default `0`, matching `chart.axis`'s own default - no rotation). */
    degreeX?: number
    degreeY?: number
    degreeZ?: number
    /** `axis.perspective` (default `0.9`, matching `chart.axis`'s own default). */
    perspective?: number
    /** Data z-value domain mapped to `[0, depth]` pixels. Defaults to the min/max of `data`'s own `z` (missing/undefined treated as `0`, matching the original's 2D-row `z`-push) - see this file's header comment for why there's no ported z-axis grid to derive this from instead. */
    zDomain?: [number, number]
    title?: string
  }>(),
  {
    width: 480,
    height: 300,
    theme: 'classic',
    padding: undefined,
    symbol: 'dot',
    size: 4,
    colorIndex: 0,
    depth: 0,
    degreeX: 0,
    degreeY: 0,
    degreeZ: 0,
    perspective: 0.9,
    zDomain: undefined,
    title: undefined,
  },
)

const dataRef = toRef(props, 'data')

const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const scaleX = (value: number): number => toSeriesScale(axisX.value)(value)
const scaleY = (value: number): number => toSeriesScale(axisY.value)(value)

const zDomain = computed<[number, number]>(() => {
  if (props.zDomain) return props.zDomain
  const zs = props.data.map((row) => row.z ?? 0)
  if (zs.length === 0) return [0, 1]
  return [Math.min(...zs), Math.max(...zs)]
})

const scaleZ = (value: number): number => createLinearScale(zDomain.value, [0, props.depth])(value)

// Reproduces `juijs-graph/src/base/draw.js`'s `calculate3d()` exactly - see
// `usePolygon3d.ts`'s `rotatePolygonVertices` doc comment for the derivation.
const projection = computed<Dot3dProjection>(() => {
  const a = area.value
  return {
    effectiveDepth: Math.max(a.width, a.height, props.depth),
    center: { x: a.x + a.width / 2, y: a.y + a.height / 2, z: props.depth / 2 },
    degree: { x: props.degreeX, y: props.degreeY, z: props.degreeZ },
    perspective: props.perspective,
    axisDepth: props.depth,
  }
})

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)
const color = computed(() => themeColor(props.colorIndex))

// Created ONCE for this component's lifetime, matching `firstCacheData`'s own brush-instance
// (never-reset) persistence - see `useDot3d.ts`'s header comment. NOT a `ref`/recreated on a data
// change: a stale "poly" fill anchor surviving a later redraw is the real, source-confirmed
// behavior, not a bug to route around.
const polyFillCache = createPolyFillCache()

function onFrame(ctx: CanvasRenderingContext2D): void {
  const draws = sortDot3dDraws(buildDot3dDraws(dataRef.value, scaleX, scaleY, scaleZ, props.symbol, color.value, props.size, projection.value, polyFillCache))

  for (const d of draws) {
    if (d.kind === 'dot') {
      drawFilledCircle(ctx, d.x, d.y, d.radius, d.color)
    } else if (d.kind === 'line') {
      drawStrokedLineWithFill(ctx, d.x1, d.y1, d.x2, d.y2, d.color, d.lineWidth, d.polyFillTo)
    } else {
      drawFilledPolygon(ctx, d.points, d.color)
    }
  }

  if (props.title) {
    ctx.fillStyle = theme('titleFontColor')
    ctx.font = `${theme('titleFontWeight')} ${theme('titleFontSize')}px ${theme('fontFamily')}`
    ctx.textAlign = 'center'
    ctx.fillText(props.title, props.width / 2, 16)
  }
}

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)

// `ChartCanvasBase` only auto-redraws on its own width/height/theme/animate props - every other
// input `onFrame` reads must trigger a redraw explicitly (see this file's header comment).
watch(
  () => [props.data, props.symbol, props.size, props.colorIndex, props.depth, props.degreeX, props.degreeY, props.degreeZ, props.perspective, props.zDomain, props.axisX, props.axisY, props.title] as const,
  () => canvasBase.value?.redraw(),
  { deep: true },
)

defineExpose({ redraw: () => canvasBase.value?.redraw() })
</script>

<template>
  <ChartCanvasBase ref="canvasBase" :width="props.width" :height="props.height" :theme="props.theme" :animate="false" @frame="onFrame" />
</template>
