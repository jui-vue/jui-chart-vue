<script setup lang="ts">
// Ported from `chart.brush.canvas.equalizercolumn` (256 lines) - see `useEqualizerColumn.ts`'s
// header comment for the full extend-chain/2D-not-3D/dead-field/save-restore-bug writeup this
// component relies on, and `useRaycast.ts`'s header comment for the click hit-testing wiring
// below (this brush's confirmed sole real consumer of `widget/raycast.js`).
//
// **Axis-based, like `activecircle.js`**: reuses `useChartLayout()`/`useAxis.ts` as-is (column
// mode only - `axisX` must resolve to a `'block'` axis, `axisY` to a `'range'` axis, matching
// source's own x=category/y=value assumption baked into `widget/raycast.js`'s block/range gate).
//
// **Block-train stacking reuses `useSeries.ts`'s `equalizerStackedBlocks`/`equalizerUnitSize`/
// `rangeAxisTickBand`** - the SAME pure functions `BarChart.vue`'s `equalizer` prop (Phase B, SVG)
// already uses, since the underlying math is identical between the SVG and canvas siblings (see
// `useEqualizerColumn.ts`'s header comment for the confirming diff).
//
// **Continuous `animate: true` rendering**: unlike `activecircle.js`'s spawn-once-then-static
// circles, EVERY frame here recomputes the full stacked layout from `props.data` (matching
// source's own `draw()`, which has no cache-hit skip at all - contrast `bubblecloud.js`'s
// reference-equality cache) AND advances the level-meter bounce animation
// (`stepEqualizerBounce`), so this must run continuously like `bubblecloud.js`/`activebubble.js`,
// not once per reactive change.
import { onBeforeUnmount, ref, toRef } from 'vue'
import ChartCanvasBase from './ChartCanvasBase.vue'
import { useChartLayout } from '../composables/useChartLayout'
import { useTheme } from '../composables/useTheme'
import { equalizerStackedBlocks, equalizerUnitSize, rangeAxisTickBand } from '../composables/useSeries'
import {
  computeErrorFlagGeometry,
  EQUALIZER_BOUNCE_TOP_PADDING,
  EQUALIZER_BOUNCE_TOTAL_PADDING,
  getTargetColumnWidth,
  isDisabledIndex,
  isErrorColumn,
  stepEqualizerBounce,
  type EqualizerBounceStatus,
  type EqualizerColumnActiveSelector,
  type ErrorFlagGeometry,
} from '../composables/useEqualizerColumn'
import { raycastPick, resolveRaycastBlockIndex, type RaycastArea } from '../composables/useRaycast'
import type { FrameInfo } from '../composables/useCanvasChart'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Rows read by `props.target` field keys - matching source's `data[this.brush.target[j]]`
     *  reads (plain properties, not `getValue()`/keymap lookups). */
    data: DataRow[]
    /** Must resolve to a `'block'` axis - the x-category each stacked column is drawn at. */
    axisX: AxisConfig
    /** Must resolve to a `'range'` axis - the stacked value axis. */
    axisY: AxisConfig
    /** `brush.target` - the stacked field keys, in stacking order (index 0 = base of the stack). */
    target: string[]
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    colors?: string[]
    /** `brush.size` (default `0`, meaning "derive from the band"). */
    size?: number
    /** `brush.minSize` (default `0`). */
    minSize?: number
    /** `brush.outerPadding` (default `15`). */
    outerPadding?: number
    /** `brush.innerPadding` (default `1`) - also the block-train gap, matching
     *  `equalizerStackedBlocks`'s `gapSize` parameter. */
    innerPadding?: number
    /** `brush.unit` (default `1`) - a DIVISOR (`equalizerUnitSize`'s `equalizerUnit`), not a pixel
     *  height (unrelated to `equalizer.js`'s same-named-but-different option - see
     *  `useSeries.ts`'s `equalizerUnitSize` doc comment). */
    unit?: number
    /** `brush.active` (default `null` = nothing dimmed). */
    active?: EqualizerColumnActiveSelector
    /** `brush.error` (default `null` = no error columns). */
    error?: EqualizerColumnActiveSelector
    /** `brush.errorText` (default `"Stopped"`). */
    errorText?: string
    /** Port-only addition, matching every other Phase E canvas component's own `title` prop. */
    title?: string
  }>(),
  {
    width: 600,
    height: 360,
    theme: 'classic',
    padding: undefined,
    colors: undefined,
    size: 0,
    minSize: 0,
    outerPadding: 15,
    innerPadding: 1,
    unit: 1,
    active: null,
    error: null,
    errorText: 'Stopped',
    title: undefined,
  },
)

const dataRef = toRef(props, 'data')
const { area, axisX, axisY } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(j: number): string {
  return props.colors?.[j % props.colors.length] ?? themeColor(j)
}

function drawErrorFlag(ctx: CanvasRenderingContext2D, geom: ErrorFlagGeometry, offsetX: number, y: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.fillStyle = theme('equalizerColumnErrorBackgroundColor')
  ctx.moveTo(offsetX, y)
  ctx.lineTo(geom.startX, geom.yt)
  ctx.lineTo(geom.startX, geom.yht + geom.round)
  ctx.arcTo(geom.startX, geom.yht, geom.startX + geom.round, geom.yht, geom.round)
  ctx.lineTo(geom.startX + geom.size - geom.round, geom.yht)
  ctx.arcTo(geom.startX + geom.size, geom.yht, geom.startX + geom.size, geom.yht + geom.round, geom.round)
  ctx.lineTo(geom.startX + geom.size, geom.yt)
  ctx.fill()

  // Deliberately unbalanced second `save()` with only one matching `restore()` below - a real,
  // preserved source bug (see `useEqualizerColumn.ts`'s header comment), not a mistake here.
  ctx.save()
  ctx.font = `${geom.fontSize}px ${theme('fontFamily')}`
  ctx.translate(offsetX, geom.yht)
  ctx.rotate(Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = theme('equalizerColumnErrorFontColor')
  ctx.fillText(props.errorText, geom.height / 1.75, geom.fontSize / 3, geom.height)
  ctx.restore()
}

/** Per-row bounce animation state, keyed by data index - persists for this component's whole
 *  lifetime with no reset hook, matching source's never-cleared `equalizer_move_${i}` cache (see
 *  `useEqualizerColumn.ts`'s header comment). */
const bounceStatus = new Map<number, EqualizerBounceStatus>()

/** This frame's `raycast_area_${i}` cache equivalent - rebuilt from scratch every frame (matching
 *  source recomputing it on every `draw()` call), read synchronously by `onClick` below. Not a
 *  `ref`: never templated, only read from a native DOM event handler after the latest `onFrame`
 *  has run. */
let raycastAreas = new Map<number, RaycastArea>()

const pickedRow = ref<DataRow | null>(null)
const pickedIndex = ref<number | null>(null)

function onFrame(ctx: CanvasRenderingContext2D, frame: FrameInfo): void {
  const ax = axisX.value
  const ay = axisY.value
  if (ax.type !== 'block' || ay.type !== 'range') return

  const zeroY = ay.scale(0) as number
  const columnWidth = getTargetColumnWidth(ax.band, props.size, props.outerPadding, props.minSize)
  const isReverse = (props.axisY as { reverse?: boolean }).reverse ?? false
  const unitSize = equalizerUnitSize(rangeAxisTickBand(ay.values), props.unit, props.innerPadding)
  const tpf = frame.delta / 1000

  const nextAreas = new Map<number, RaycastArea>()

  dataRef.value.forEach((row, i) => {
    const centerX = ax.scale(i) as number
    const left = centerX - columnWidth / 2

    if (isErrorColumn(props.error, i)) {
      // Source draws this identical flag once per target (3x for a 3-target row, since the error
      // branch never advances the row's shared `y`) - byte-identical output, drawn once here (see
      // `useEqualizerColumn.ts`'s header comment).
      const geom = computeErrorFlagGeometry(centerX, zeroY, ax.band, area.value.height)
      drawErrorFlag(ctx, geom, centerX, zeroY)
      return
    }

    let value = 0
    let startY = zeroY
    const segmentLengths: number[] = []
    for (const key of props.target) {
      const yValue = (Number(row[key]) || 0) + value
      const endY = ay.scale(yValue) as number
      segmentLengths.push(Math.abs(startY - endY))
      startY = endY
      value = yValue
    }

    const blockRuns = equalizerStackedBlocks(segmentLengths, unitSize, props.innerPadding)
    let lastBlock: { x: number; y: number; width: number; height: number; fill: string; fillOpacity: number } | null = null

    props.target.forEach((_key, j) => {
      const color = pickColor(j)
      const fillOpacity = isDisabledIndex(props.active, i) ? theme('barDisableBackgroundOpacity') : 1
      for (const b of blockRuns[j]) {
        const y = isReverse ? zeroY + b.offset : zeroY - b.offset - unitSize
        ctx.save()
        ctx.globalAlpha = fillOpacity
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.rect(left, y, columnWidth, unitSize)
        ctx.fill()
        ctx.restore()
        lastBlock = { x: left, y, width: columnWidth, height: unitSize, fill: color, fillOpacity }
      }
    })

    if (lastBlock) {
      const block = lastBlock as { x: number; y: number; width: number; height: number; fill: string; fillOpacity: number }
      nextAreas.set(i, {
        x1: left,
        x2: left + columnWidth,
        y1: block.y,
        y2: ay.scale(ay.scale.min()) as number,
      })

      let total = 0
      for (const key of props.target) total += Number(row[key]) || 0

      const status = bounceStatus.get(i) ?? { direction: -1, distance: 0 }
      const nextStatus = stepEqualizerBounce(status, tpf)
      bounceStatus.set(i, nextStatus)

      const ry = block.y + nextStatus.distance + EQUALIZER_BOUNCE_TOP_PADDING

      ctx.save()
      ctx.globalAlpha = block.fillOpacity
      ctx.strokeStyle = block.fill
      ctx.lineWidth = block.height * 0.7
      ctx.beginPath()
      ctx.moveTo(block.x, ry)
      ctx.lineTo(block.x + block.width, ry)
      ctx.closePath()
      ctx.stroke()

      ctx.fillStyle = theme('barFontColor')
      // Preserved source bug: no font-family here (contrast the error flag's own font above,
      // which correctly includes one) - see `useEqualizerColumn.ts`'s header comment.
      ctx.font = `${theme('barFontSize')}px`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(total), block.x + block.width / 2, ry + EQUALIZER_BOUNCE_TOTAL_PADDING)
      ctx.restore()
    }
  })

  raycastAreas = nextAreas

  if (props.title) {
    ctx.fillStyle = theme('titleFontColor')
    ctx.font = `${theme('titleFontWeight')} ${theme('titleFontSize')}px ${theme('fontFamily')}`
    ctx.textAlign = 'center'
    ctx.fillText(props.title, props.width / 2, 16)
  }
}

/** Ported from `raycast.js`'s `emitBlockAndRangeEvent` wiring (`widget: [{type: "raycast"}]` +
 *  `axis.click` in source) - see `useRaycast.ts`'s header comment for why this is wired directly
 *  from this component's own `@click` rather than a standalone widget. Only updates
 *  `pickedRow`/`pickedIndex` on an actual hit, matching source only ever EMITTING on a hit (a
 *  miss leaves any previous pick untouched, not cleared - source has no "unpick" concept). */
function onClick(event: MouseEvent): void {
  const ax = axisX.value
  const ay = axisY.value
  if (ax.type !== 'block' || ay.type !== 'range') return

  const blockIndex = resolveRaycastBlockIndex(ax, event.offsetX)
  const hit = raycastPick(raycastAreas, dataRef.value, blockIndex, event.offsetX, event.offsetY)
  if (hit) {
    pickedRow.value = hit.data
    pickedIndex.value = hit.dataIndex
  }
}

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)

/** Port-only: clears the bounce-animation state and any prior pick, matching this port's
 *  established `reset()` affordance on other stateful Phase E components (source itself has no
 *  reset - `equalizer_move_*` never clears on its own). */
function reset(): void {
  bounceStatus.clear()
  raycastAreas = new Map()
  pickedRow.value = null
  pickedIndex.value = null
}

onBeforeUnmount(() => bounceStatus.clear())

defineExpose({ pickedRow, pickedIndex, reset, redraw: () => canvasBase.value?.redraw() })
</script>

<template>
  <ChartCanvasBase ref="canvasBase" :width="props.width" :height="props.height" :theme="props.theme" :animate="true" @frame="onFrame" @click="onClick" />
</template>
