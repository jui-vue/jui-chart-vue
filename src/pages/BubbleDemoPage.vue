<script setup lang="ts">
// Demo for `base/bubble.js`/`base/mortalbubble.js` (`src/composables/bubble.ts`/`mortalBubble.ts`)
// - proves the `class ... extends KineticObject` composition renders correctly end to end on top
// of the Phase E canvas infrastructure (`ChartCanvasBase.vue`/`useCanvasChart.ts`), the same way
// `/canvas-demo` proved `kinetic.ts` itself does. See PORT_STATUS.md's Phase E entry for both
// items for the full port writeup (classification, the `this.draw` instance-property-shadowing
// gotcha this composition surfaced, and the hand-traced age/radius/cross-fade math).
//
// Left: a single static `Bubble` (no lifecycle - just proves color/text/shadow rendering).
// Right: a single `MortalBubble` whose simulated `now` is driven by preset buttons rather than a
// real clock/RAF loop, so Playwright's pixel-readback checks are fully deterministic - each preset
// below is one of the exact `birthtime=0, age=1000, baseRadius=30` cases already hand-traced in
// `mortalBubble.spec.ts` (see that file for the derivation of each radius/sd/ed value), reused here
// so the demo and the unit tests agree on the same numbers.
import { computed, ref } from 'vue'
import ChartCanvasBase from '../components/ChartCanvasBase.vue'
import { Bubble } from '../composables/bubble'
import { computeMortalBubbleFrame, MortalBubble } from '../composables/mortalBubble'

const WIDTH = 420
const HEIGHT = 220

const BUBBLE_POS: [number, number] = [90, 110]
const BUBBLE_COLOR = '#22aa55'
const BUBBLE_RADIUS = 25

const MORTAL_POS: [number, number] = [300, 110]
const MORTAL_BIRTHTIME = 0
const MORTAL_AGE = 1000
const MORTAL_BASE_RADIUS = 30
const MORTAL_COLOR = '#c04dd9'

const bubble = new Bubble(BUBBLE_RADIUS, 'B', BUBBLE_COLOR)
bubble.pos = BUBBLE_POS

const mortalBubble = new MortalBubble(MORTAL_BIRTHTIME, MORTAL_AGE, MORTAL_BASE_RADIUS, MORTAL_COLOR)
mortalBubble.pos = MORTAL_POS

/** Preset "now" values, each a case already hand-traced in `mortalBubble.spec.ts` (birthtime=0,
 *  age=1000, baseRadius=30): d=1000 -> plain circle at base radius; d=250 -> inflated circle
 *  (radius 35); d=120 -> cross-fade (sd=9, ed~11.9, stroke=3.5); d=0 -> dead (nothing drawn). */
const NOW_PRESETS = [
  { label: 'Young (now=0)', now: 0 },
  { label: 'Inflating (now=750)', now: 750 },
  { label: 'Cross-fade (now=880)', now: 880 },
  { label: 'Dead (now=1000)', now: 1000 },
] as const

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)
const nowValue = ref(0)

/** Reuses the exact same pure function `MortalBubble.draw()` calls internally, purely for the
 *  on-page readout - not a separate reimplementation to keep in sync. */
const mortalFrame = computed(() => computeMortalBubbleFrame(MORTAL_BIRTHTIME, MORTAL_AGE, MORTAL_BASE_RADIUS, nowValue.value))

function onFrame(ctx: CanvasRenderingContext2D): void {
  bubble.draw(ctx, 0)
  mortalBubble.draw(ctx, nowValue.value)
}

function setNow(now: number): void {
  nowValue.value = now
  canvasBase.value?.redraw()
}
</script>

<template>
  <div>
    <h2>Bubble / MortalBubble demo</h2>
    <p class="desc">
      Validates <code>Bubble</code>/<code>MortalBubble</code> (<code>src/composables/bubble.ts</code>/<code>mortalBubble.ts</code>, hand-ported
      from <code>base/bubble.js</code>/<code>base/mortalbubble.js</code>) rendering on
      <code>ChartCanvasBase.vue</code>. The left circle is a static <code>Bubble</code>; the right one is a
      <code>MortalBubble</code> whose simulated <code>now</code> is set by the buttons below (deterministic, not a real clock) to
      step through its birth/inflation/cross-fade/death lifecycle.
    </p>
    <div class="controls">
      <button
        v-for="preset in NOW_PRESETS"
        :key="preset.now"
        type="button"
        :data-testid="`bubble-demo-now-${preset.now}`"
        @click="setNow(preset.now)"
      >
        {{ preset.label }}
      </button>
    </div>
    <ChartCanvasBase ref="canvasBase" :width="WIDTH" :height="HEIGHT" :animate="false" data-testid="bubble-demo-canvas" @frame="onFrame" />
    <p class="readout" data-testid="bubble-demo-readout">
      now={{ nowValue }} mortal.active={{ mortalFrame.active }} mortal.mode={{ mortalFrame.active ? mortalFrame.mode : 'n/a' }}
      <template v-if="mortalFrame.active && mortalFrame.mode === 'circle'">radius={{ mortalFrame.radius }}</template>
      <template v-else-if="mortalFrame.active && mortalFrame.mode === 'cross'">sd={{ mortalFrame.sd }} ed={{ mortalFrame.ed.toFixed(3) }} stroke={{ mortalFrame.stroke }}</template>
    </p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.readout {
  font-family: monospace;
  font-size: 12px;
  color: #333;
}
</style>
