<script setup lang="ts">
// Ported from `chart.brush.canvas.activebubble` (206 lines) - see `useActiveBubble.ts`'s header
// comment for the full `extend` chain / spawn-drain / gravity-quirk writeup this component relies
// on. Renders via `ChartCanvasBase.vue` in `animate: true` mode (kinetic-driven, like
// `/canvas-demo`'s ball, not a static-per-render brush).
//
// **Vue integration design decision**: `activebubble.js` has no real axis/scale at all - it never
// touches `axis.x`/`axis.y`, only `axis.area('width'/'height')` for the plot rectangle and
// `axis.data` as a plain queue of rows to drain (positions come entirely from physics, not from
// any data-driven coordinate mapping) - the same "non-axis-based brush living in an axis-based
// engine" shape `BarGaugeChart.vue` turned out to have in Phase B (see that component's header
// comment). So this component needs none of `useChartLayout.ts`'s axis/scale machinery - `props.
// width`/`props.height` (minus an optional `title` reserve, the same port-only addition
// `BarGaugeChart`/`PieChart`/`RateBarChart` already use, drawn with `ctx.fillText` here since
// canvas has no `<ChartTitle>` SVG equivalent to reuse) directly ARE the plot rectangle
// `useActiveBubble.ts`'s `ActiveBubble` class needs.
//
// **Spawn-per-data-item lifecycle wiring**: the original drains `axis.data` completely into new
// `MortalBubble`s every time the brush's own `draw()` runs (every animation frame, once
// `ChartCanvasBase`'s RAF loop is driving it - see `useActiveBubble.ts`'s header comment on why
// nothing in the source engine itself schedules that call). This component's `props.data` plays
// the role of `axis.data`: a `consumedCount` cursor tracks how many rows have already been
// drained, and each `@frame` callback drains ONLY the rows appended since the last frame (`props.
// data.slice(consumedCount)`) - mirroring "someone pushes more rows into `axis.data` between
// draws" for a caller that wants a staggered burst (append rows across multiple ticks/a timer)
// rather than one instant dump. `ActiveBubble.isArrange` is force-reset to `false` whenever a
// frame drains at least one new row, mirroring `drawBefore()`'s own `activeBubbleCount !=
// dataCount` check.
import { ref, toRef, watch } from 'vue'
import ChartCanvasBase from './ChartCanvasBase.vue'
import { useTheme } from '../composables/useTheme'
import { ActiveBubble, buildSpawnQueue, hexToRgba } from '../composables/useActiveBubble'
import { MortalBubble } from '../composables/mortalBubble'
import type { DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Rows to spawn as bubbles. Each row may carry its own `startTime` (epoch ms, defaults to
     *  `Date.now()` at spawn) / `duration` (ms, defaults to `1000`) - see `useActiveBubble.ts`'s
     *  header comment for exactly what these control (death-countdown timing, NOT spawn delay).
     *  Appending new rows to this array (keeping earlier ones in place) spawns MORE bubbles on a
     *  later frame without disturbing bubbles already in flight - the array is a growing queue,
     *  the same role `axis.data` plays in the original. */
    data: DataRow[]
    width?: number
    height?: number
    theme?: ThemeName
    /** `chart.brush.canvas.activebubble`'s own `gravity` (default `0.2`). Read once, when the
     *  physics simulation is (re)created (on mount, and whenever `width`/`height`/`gravity`
     *  change) - matches the original reading `this.brush.gravity` only inside `drawBefore()`'s
     *  lazy-create branch, never on every `draw()`. See `useActiveBubble.ts` for the confirmed-
     *  horizontal (not vertical) force direction this produces. */
    gravity?: number
    /** `chart.brush.canvas.activebubble`'s own `radius` (default `20`) - re-read on every spawn
     *  (unlike `gravity`), matching the original re-reading `this.brush.radius` inside `draw()`'s
     *  drain loop on every call. */
    radius?: number
    /** `chart.brush.canvas.activebubble`'s own `opacity` (default `1`) - same re-read-per-spawn
     *  behavior as `radius`. */
    opacity?: number
    /** Palette override, matching this port's established `colors?: string[]` convention (e.g.
     *  `BarGaugeChart`). Falls back to the active theme's palette, cycled by `this.color(index)`'s
     *  index - see `useActiveBubble.ts`'s header comment for why that index restarts at 0 for
     *  every batch of rows drained in the SAME frame, not a running count. */
    colors?: string[]
    /** Port-only addition (no original heading in `activebubble.js` itself), matching
     *  `BarGaugeChart`/`PieChart`/`RateBarChart`'s own `title` prop convention. Drawn with
     *  `ctx.fillText` since canvas has no declarative `<ChartTitle>` to reuse. */
    title?: string
  }>(),
  {
    width: 500,
    height: 320,
    theme: 'classic',
    gravity: 0.2,
    radius: 20,
    opacity: 1,
    colors: undefined,
    title: undefined,
  },
)

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i % props.colors.length] ?? themeColor(i)
}

function titleReserve(): number {
  return props.title ? theme('titleFontSize') + 14 : 0
}

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)
/** Live count of bubbles the simulation is currently tracking (spawned but not yet dead) -
 *  exposed for demo readouts/Playwright checks, since canvas has no DOM element per bubble to
 *  query. Updated once per frame, at the end of `onFrame`. */
const activeCount = ref(0)

let sim: ActiveBubble | null = null
let consumedCount = 0

/** (Re)creates the physics simulation, matching the original's lazy-once-per-chart `chart.
 *  getCache('active_bubble', ...)` creation - `contextWidth`/`contextHeight`/`gravity` are fixed
 *  at this point and never re-read afterward, same as source. Recreated (losing any in-flight
 *  bubbles and resetting `consumedCount`, so already-drained rows spawn fresh) only when `width`/
 *  `height`/`gravity`/`title` themselves change - the source engine never resizes a live chart's
 *  cached `ActiveBubble` in place either, so there's no original behavior to preserve continuity
 *  from. */
function resetSimulation(): void {
  sim = new ActiveBubble(props.width, Math.max(0, props.height - titleReserve()), props.gravity)
  consumedCount = 0
}

watch(() => [props.width, props.height, props.gravity, props.title] as const, resetSimulation, { immediate: true })

/** Drains any rows appended to `props.data` since the last frame into new `MortalBubble`s (see
 *  this file's header comment), then steps physics and renders - the two halves of the original's
 *  single `ActiveBubble.draw()`, per `useActiveBubble.ts`'s `step()`/`render()` split. */
function onFrame(ctx: CanvasRenderingContext2D): void {
  if (!sim) return
  const now = Date.now()

  if (props.data.length > consumedCount) {
    const newRows = props.data.slice(consumedCount)
    consumedCount = props.data.length
    sim.isArrange = false

    const spawns = buildSpawnQueue(newRows, (_row, i) => pickColor(i), now)
    for (const spawn of spawns) {
      sim.data.push(new MortalBubble(spawn.startTime, spawn.duration, props.radius, hexToRgba(spawn.color, props.opacity), hexToRgba(spawn.color, 0.2)))
    }
  }

  sim.step()
  sim.render(ctx, now)
  activeCount.value = sim.data.length

  if (props.title) {
    ctx.fillStyle = theme('titleFontColor')
    ctx.font = `${theme('titleFontWeight')} ${theme('titleFontSize')}px ${theme('fontFamily')}`
    ctx.textAlign = 'center'
    ctx.fillText(props.title, props.width / 2, 16)
  }
}

/** A shorter `data` array (e.g. a caller resets it to start a fresh burst) re-arms draining from
 *  the top rather than being treated as an error - matches "fewer/no rows to drain," not a
 *  reduction of already-spawned bubbles (those are independent `MortalBubble` instances by then,
 *  unaffected by `props.data` shrinking). */
watch(
  () => props.data.length,
  (len) => {
    if (len < consumedCount) consumedCount = 0
  },
)

defineExpose({ activeCount, redraw: () => canvasBase.value?.redraw() })
</script>

<template>
  <ChartCanvasBase ref="canvasBase" :width="props.width" :height="props.height" :theme="props.theme" :animate="true" @frame="onFrame" />
</template>
