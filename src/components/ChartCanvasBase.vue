<script setup lang="ts">
// Shared <canvas> + DPI-scaling + redraw-scheduling wrapper for Phase E's canvas-backend chart
// components - the canvas-backend analog of ChartBase.vue's role for the SVG-backend components
// (Phases A-D). See useCanvasChart.ts's header comment for what the original engine's own
// util.canvas.base DOES and DOESN'T provide, and PORT_STATUS.md's Phase E infra entry for the
// full design writeup.
//
// Structurally this can't mirror ChartBase.vue's `<slot/>`-based composition: SVG lets a child
// component declare its own <circle>/<path> elements inside ChartBase's <svg>, rendered by Vue's
// own diffing; canvas drawing is imperative (context.arc()/fillRect()/...), so there's nothing a
// <slot/> could contain. Instead this wrapper owns the <canvas> element + sizing/animation-loop
// lifecycle and hands the caller a ready-to-draw 2D context on every "frame" via a `@frame` event
// (once per reactive change in `animate: false` mode - the common case, matching every other
// Phase E brush that isn't physics-driven; continuously via requestAnimationFrame in `animate:
// true` mode, for kinetic-driven brushes/rotating 3D widgets). This is a new composition pattern
// for this port (no SVG-side precedent) - every canvas-based Phase E component is expected to
// wrap this component and handle `@frame` rather than reimplement useCanvasChart/
// useAnimationFrameLoop itself, the same way every SVG axis-based component wraps ChartBase.vue.
import { onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useAnimationFrameLoop, useCanvasChart, type FrameInfo } from '../composables/useCanvasChart'
import { useTheme } from '../composables/useTheme'
import type { ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    theme?: ThemeName
    /** Continuously redraw via requestAnimationFrame (for physics-animated/kinetic-driven brushes
     * and rotating 3D widgets) instead of drawing once per reactive change. Default false - most
     * Phase E brushes (activecircle, dot3d, equalizercolumn, ...) are static per render, same as
     * every SVG brush; only kinetic-driven ones (activebubble, bubblecloud) and rotate3d need
     * this on. */
    animate?: boolean
    /** Paint the theme background over the whole canvas before each frame's `@frame` handler
     * runs, mirroring ChartBase.vue's own background <rect>. Default true. */
    clearBackground?: boolean
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    animate: false,
    clearBackground: true,
  },
)

const emit = defineEmits<{ frame: [ctx: CanvasRenderingContext2D, frame: FrameInfo] }>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const themeName = toRef(props, 'theme')
const { theme, color } = useTheme(themeName)

const { context, clear, resolvedDpr } = useCanvasChart(canvasEl, {
  width: toRef(props, 'width'),
  height: toRef(props, 'height'),
})

// Paints one frame IF the canvas context is actually ready, then - in static (non-`animate`)
// mode - immediately stops the loop again, so "draw once" is really "run the RAF loop for exactly
// one tick." This is deliberate, not an accidental one-shot hack: `useCanvasChart`'s context ref
// only becomes non-null once its own `watchEffect` has run post-mount (`canvasEl.value` must be
// bound to the real DOM node first), which is NOT guaranteed to have happened yet by the time a
// same-tick, immediate `watch()` callback would fire during this component's own `setup()` - an
// earlier version of this file called `paintFrame` directly from an `immediate: true` watcher and
// the very first static paint silently no-opped (confirmed via a canvas pixel-readback check: the
// canvas was still fully blank after mount). Routing every paint - static or animated - through
// the SAME `requestAnimationFrame`-scheduled `tick()` sidesteps that race entirely: a RAF callback
// only ever runs after the browser's next paint, by which point Vue's mount (and therefore
// `useCanvasChart`'s post-mount sizing effect) has unconditionally already completed.
function paintFrame(frame: FrameInfo): void {
  const ctx = context.value
  if (ctx) {
    if (props.clearBackground) {
      clear()
      ctx.fillStyle = theme('backgroundColor')
      ctx.fillRect(0, 0, props.width, props.height)
    }
    emit('frame', ctx, frame)
  }
  if (!props.animate) stop()
}

const { start, stop, running } = useAnimationFrameLoop(paintFrame)

/** (Re)runs the paint loop for exactly one more frame in static mode, or restarts continuous
 * animation in `animate` mode. Exposed as `redraw()` since, unlike ChartBase's declarative
 * `<slot/>`, this wrapper has no way to know what data a caller's own draw callback depends on
 * beyond `width`/`height`/`theme`/`animate` (already watched below) - a caller whose OWN props
 * change (e.g. a new `data` array) must call this itself, the same way any imperative-canvas
 * component has to. */
function redraw(): void {
  stop()
  start()
}

// Drives the animate on/off switch declaratively: any change restarts the loop (continuous in
// `animate` mode, a single self-stopping tick otherwise - see paintFrame above). `immediate: true`
// covers the very first paint too, exactly the same way as any later prop change.
watch(() => [props.animate, props.width, props.height, props.theme] as const, redraw, { immediate: true })

onBeforeUnmount(stop)

defineExpose({ context, start, stop, running, redraw, resolvedDpr, theme, color })
</script>

<template>
  <canvas ref="canvasEl" class="jui-chart-vue-canvas-root" />
</template>

<style scoped>
.jui-chart-vue-canvas-root {
  display: block;
  max-width: 100%;
}
</style>
