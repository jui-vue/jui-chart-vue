import { computed, onBeforeUnmount, ref, watchEffect, type ComputedRef, type Ref } from 'vue'

/**
 * Shared canvas-drawing infrastructure for Phase E (canvas/2D-context and hand-rolled-3D
 * rendering) - the canvas-backend analog of what `useChartLayout.ts`/`ChartBase.vue` are for the
 * SVG side (Phases A-D). Read first: `jui-chart/node_modules/juijs-graph/src/util/canvas/base.js`
 * (`util.canvas.base`), the original engine's own shared canvas helper layer, imported by several
 * files this phase will need to port.
 *
 * **What `util.canvas.base` actually provides, confirmed by a full read (330 lines)**: purely a
 * grab-bag of imperative shape-drawing PRIMITIVES over an already-existing `CanvasRenderingContext2D`
 * passed into its constructor - `clearContext()`, `drawLine`/`drawDashedLine`/`drawLines` (multi-
 * segment), `drawCurve`/`getCurvePoints` (a Catmull-Rom/cardinal-spline with a tension parameter,
 * confirmed matching the `cardinal-spline-js` npm package - NOT the same algorithm as this port's
 * own `useSeries.ts`'s `curvePoints()`, which solves for Bezier control points via a different
 * technique; see PORT_STATUS.md's Phase F section for the re-verified writeup. Neither
 * `getCurvePoints` nor `drawCurve` has been ported into this codebase - no canvas widget in scope
 * needs curve drawing, so there is no call site for them here),
 * `drawRoundRect`, `drawFreeRect`/`drawFreeRectStroke` (arbitrary 4-point quads), `drawTriangle`/
 * `drawSquare`, `drawPage` (a folded-corner card shape), `drawCircle`, and `drawBullet` (a
 * linear-gradient-filled rounded stub, used by `pin.js`'s canvas sibling). **It provides NONE of
 * the following**, confirmed absent by the same full read: no devicePixelRatio/retina handling
 * anywhere (every coordinate is a raw, unscaled number handed straight to the context - callers
 * are on their own for HiDPI), no `requestAnimationFrame`/animation-loop scheduling of any kind
 * (confirmed again by grepping the ENTIRE `jui-chart` + `juijs-graph` source tree for
 * `requestAnimationFrame`/`setInterval`: zero matches outside two unrelated `examples/*.html`
 * demo scripts - the engine itself has no animation-loop concept at all; `chart.brush.canvas.
 * activebubble`'s kinetic physics only advances when something external calls the brush's own
 * `draw()` again, which nothing in the source does on a schedule), and no resize/redraw
 * scheduling beyond "the caller calls `clearContext()` then redraws everything itself." In short:
 * `util.canvas.base` is this port's `useSeries.ts`-equivalent (a bag of pure-ish drawing helpers),
 * NOT a `useChartLayout.ts`-equivalent (there is no session/lifecycle/sizing layer to port at
 * all).
 *
 * **What this file adds that has no upstream source to port from** (all three are this port's own
 * new architecture, not literal ports - each documented at its own definition below, and in
 * PORT_STATUS.md's Phase E infra entry):
 * 1. `useCanvasChart()` - a `<canvas>` ref's devicePixelRatio-aware backing-store sizing, so every
 *    Phase E component draws in plain CSS-pixel coordinates (matching every prop/number this
 *    port's SVG components already use) while the canvas still renders crisply on a retina
 *    display, via `context.setTransform(dpr, 0, 0, dpr, 0, 0)`.
 * 2. `useAnimationFrameLoop()` - a generic `requestAnimationFrame` loop with `start()`/`stop()`/
 *    auto-cleanup-on-unmount and a per-frame `{ delta, elapsed, frame }` callback, for the
 *    physics-animated brushes (`activebubble.js`/`bubblecloud.js`, both driven by `kinetic.ts`'s
 *    `update()`) and the rotating 3D widgets (`rotate3d.js`) later in this phase.
 * 3. `computeCanvasBackingSize()`/`computeFrameDelta()` - the pure numeric cores of (1)/(2),
 *    extracted so they're hand-traceable in `useCanvasChart.spec.ts` without a real `<canvas>`/
 *    DOM (this port's established "extract the pure math, keep DOM measurement in the component"
 *    split - same convention as `tooltipMeasure.ts`/`useHoverGuide.ts`'s `toSvgPoint`).
 *
 * `util.canvas.base`'s own drawing-primitive layer itself is NOT ported here - it has no
 * DPI/lifecycle concern of its own, so each brush that needs `drawCircle`/`drawRoundRect`/etc.
 * will port just the handful of primitives it actually calls, directly in its own file, the same
 * way this port has never built a single monolithic "SVG primitives" module for the axis-based
 * SVG components either (each `.vue` component's `<template>` writes its own SVG elements
 * directly).
 */

/** Falls back to `1` for a missing/non-positive/SSR-unavailable `devicePixelRatio` (a real device
 *  can theoretically report a fractional or even sub-1 ratio under some browser zoom levels - only
 *  a non-positive or missing value is actually invalid here). */
export function resolveDevicePixelRatio(raw: number | null | undefined): number {
  return typeof raw === 'number' && raw > 0 ? raw : 1
}

/**
 * The canvas element's DEVICE-pixel backing-store size for a given CSS-pixel size and DPR -
 * `Math.round(cssSize * dpr)`, floored at `1` so a `0`-sized chart (e.g. before its container has
 * laid out) never produces an invalid `0x0` canvas. New math (no upstream source - see this
 * file's header comment); the standard HiDPI-canvas technique of setting `canvas.width/height` to
 * `cssSize * dpr` device pixels while `canvas.style.width/height` stays at the CSS size, then
 * scaling the context by `dpr` so drawing code itself works entirely in CSS-pixel units.
 */
export function computeCanvasBackingSize(cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number } {
  const safeDpr = resolveDevicePixelRatio(dpr)
  return {
    width: Math.max(1, Math.round(cssWidth * safeDpr)),
    height: Math.max(1, Math.round(cssHeight * safeDpr)),
  }
}

export interface CanvasChartOptions {
  width: Ref<number>
  height: Ref<number>
  /** Defaults to `window.devicePixelRatio` (re-read reactively whenever `width`/`height` change,
   *  not on every frame - see `useCanvasChart`'s own `watchEffect`). Override for testing or to
   *  deliberately cap it (e.g. `Math.min(devicePixelRatio, 2)` to bound backing-store memory on a
   *  very-high-DPR device) - not something `util.canvas.base` had any equivalent of. */
  dpr?: Ref<number>
}

export interface CanvasChartHandle {
  /** The live, already DPR-scaled 2D context (`null` until the `<canvas>` ref mounts, or if
   *  `getContext('2d')` fails). Every coordinate a caller passes to it is a plain CSS pixel - the
   *  `setTransform(dpr, 0, 0, dpr, 0, 0)` below absorbs the DPR entirely. */
  context: Ref<CanvasRenderingContext2D | null>
  resolvedDpr: ComputedRef<number>
  /** Clears the canvas back to empty, in CSS-pixel space (not the raw DPR-scaled backing store -
   *  callers never need to think in device pixels, matching `util.canvas.base`'s own
   *  `clearContext()` in spirit, just DPR-aware). */
  clear: () => void
}

/**
 * Wires a `<canvas>` template ref up to DPI-aware backing-store sizing. Re-runs (via
 * `watchEffect`) whenever the ref first mounts or `width`/`height`/`dpr` change - resizing
 * `canvas.width`/`canvas.height` clears the bitmap AND resets any transform even when set to the
 * SAME numeric value, so this must not run on every animation frame (that's `useAnimationFrameLoop`
 * below, a fully separate concern that only ever reads `context.value`, never touches sizing).
 */
export function useCanvasChart(canvasRef: Ref<HTMLCanvasElement | null>, options: CanvasChartOptions): CanvasChartHandle {
  const context = ref<CanvasRenderingContext2D | null>(null) as Ref<CanvasRenderingContext2D | null>

  const resolvedDpr = computed(() => resolveDevicePixelRatio(options.dpr?.value ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)))

  watchEffect(() => {
    const canvas = canvasRef.value
    const cssWidth = options.width.value
    const cssHeight = options.height.value
    const dpr = resolvedDpr.value

    if (!canvas || cssWidth <= 0 || cssHeight <= 0) {
      context.value = null
      return
    }

    const { width, height } = computeCanvasBackingSize(cssWidth, cssHeight, dpr)
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.value = ctx
  })

  function clear(): void {
    const ctx = context.value
    if (!ctx) return
    ctx.clearRect(0, 0, options.width.value, options.height.value)
  }

  return { context, resolvedDpr, clear }
}

export interface FrameInfo {
  /** The raw `requestAnimationFrame` timestamp (`DOMHighResTimeStamp`, ms). */
  timestamp: number
  /** Ms since the previous frame, clamped - see `computeFrameDelta`. `0` on the very first frame
   *  after `start()`. */
  delta: number
  /** Ms since `start()` was called (first frame's own `timestamp`, so `elapsed` is `0` on that
   *  first frame too). */
  elapsed: number
  /** 1-based frame counter since `start()`. */
  frame: number
}

/**
 * Ms elapsed since the previous frame. `previousTimestamp === null` means "first frame since
 * `start()`" - returns `0` rather than a meaningless huge number. Clamps to `maxDelta` (default
 * `250`ms, ~4fps) so a backgrounded/throttled tab resuming doesn't hand a physics callback (like
 * `kinetic.ts`'s `update()`, a fixed-per-tick Euler step with no `dt` parameter of its own to
 * scale by) a multi-second jump that would fling an object across the canvas in one tick. New
 * math with no upstream equivalent - the original engine has no animation-loop concept at all to
 * have solved this problem in the first place (see this file's header comment).
 */
export function computeFrameDelta(previousTimestamp: number | null, timestamp: number, maxDelta = 250): number {
  if (previousTimestamp === null) return 0
  return Math.min(Math.max(timestamp - previousTimestamp, 0), maxDelta)
}

/**
 * A generic `requestAnimationFrame` loop: `start()`/`stop()`, auto-`stop()` on unmount (via
 * `onBeforeUnmount` - must be called during a component's own `setup()`, same rule as any other
 * lifecycle-hook-using composable), and a per-frame callback carrying `{ delta, elapsed, frame }`
 * so a caller doesn't have to re-derive frame timing itself. Deliberately NOT canvas-specific -
 * `ChartCanvasBase.vue` composes this with `useCanvasChart` above for the canvas brushes, but
 * `rotate3d.js` (a plain rotation-angle-over-time widget, later in this phase) can use it directly
 * with no `<canvas>` involved at all.
 */
export function useAnimationFrameLoop(onFrame: (frame: FrameInfo) => void): { running: Ref<boolean>; start: () => void; stop: () => void } {
  const running = ref(false)
  let rafId: number | null = null
  let previousTimestamp: number | null = null
  let startTimestamp: number | null = null
  let frame = 0

  function tick(timestamp: number): void {
    if (startTimestamp === null) startTimestamp = timestamp
    const delta = computeFrameDelta(previousTimestamp, timestamp)
    const elapsed = timestamp - startTimestamp
    previousTimestamp = timestamp
    frame += 1
    onFrame({ timestamp, delta, elapsed, frame })
    if (running.value) rafId = requestAnimationFrame(tick)
  }

  function start(): void {
    if (running.value) return
    running.value = true
    previousTimestamp = null
    startTimestamp = null
    frame = 0
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    running.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onBeforeUnmount(stop)

  return { running, start, stop }
}
