<script setup lang="ts">
// Phase E infra validation demo - NOT a ported brush (no direct jui-chart source; the closest
// real brush, `activebubble.js`, is next iteration's job, see PORT_STATUS.md). This exists purely
// to prove ChartCanvasBase.vue + useCanvasChart.ts + kinetic.ts actually work together end to end
// before anything else in this phase builds on them: a single KineticObject-driven ball, rendered
// on a DPI-scaled <canvas>, whose position updates every requestAnimationFrame tick.
//
// Playwright verification pattern established here for the rest of Phase E (see PORT_STATUS.md's
// infra entry for the full writeup): canvas rendering has no DOM attributes to inspect the way
// this port's SVG components have all along, so verification instead reads back actual pixel
// colors via `canvas.getContext('2d').getImageData(x, y, 1, 1).data` (or `toDataURL()` for a
// whole-canvas snapshot) at known coordinates - e.g. confirm the pixel at the ball's initial
// center is its fill color and a pixel outside its radius is the background color, then after
// letting the animation run confirm the center pixel reverted to background (the ball moved away)
// and its NEW position's pixel is now the fill color.
import { ref } from 'vue'
import ChartCanvasBase from '../components/ChartCanvasBase.vue'
import { KineticObject } from '../composables/kinetic'
import type { FrameInfo } from '../composables/useCanvasChart'

const WIDTH = 400
const HEIGHT = 300
const RADIUS = 18
const BALL_COLOR = '#7BBAE7'
/** px/frame^2 - applied via `force()` every frame below, matching kinetic.js's own no-`dt`,
 * per-tick integration model (see kinetic.ts's `update()` doc comment). Not part of kinetic.js
 * itself (it has no built-in gravity) - this is this demo's own constant force source, the
 * simplest possible thing to drive `force()`/`update()` visibly. */
const GRAVITY = 0.5

const ball = new KineticObject()
ball.pos = [WIDTH / 2, HEIGHT / 2]

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)
const animate = ref(false)
const frameCount = ref(0)
const posX = ref(Math.round(ball.pos[0]))
const posY = ref(Math.round(ball.pos[1]))
const velX = ref(0)
const velY = ref(0)

function syncReadout(): void {
  posX.value = Math.round(ball.pos[0])
  posY.value = Math.round(ball.pos[1])
  velX.value = Math.round(ball.veloc[0] * 10) / 10
  velY.value = Math.round(ball.veloc[1] * 10) / 10
}

/** `ChartCanvasBase`'s `@frame` handler - the "consuming component registers its own per-frame
 * draw callback" hook `useCanvasChart.ts`'s header comment describes. Physics only advance while
 * `animate` is on (RAF loop running); the draw itself always runs so a `redraw()` while paused
 * (reset/kick) still repaints the ball at its current position. */
function onFrame(ctx: CanvasRenderingContext2D, frame: FrameInfo): void {
  if (animate.value) {
    // Gravity: force = mass * desired_accel, so this contributes a constant GRAVITY px/frame^2
    // regardless of ball.mass - see kinetic.ts's force()/update().
    ball.force([0, GRAVITY * ball.mass])
    ball.update()

    // Wall/floor bounce - demo-only collision logic, not part of kinetic.js itself (it has no
    // chart-agnostic collision concept of its own; activebubble.js next iteration implements its
    // OWN bubble-vs-bubble collision on top of the same force()/update() primitives).
    if (ball.pos[1] + RADIUS > HEIGHT) {
      ball.pos = [ball.pos[0], HEIGHT - RADIUS]
      ball.veloc = [ball.veloc[0], -Math.abs(ball.veloc[1]) * 0.6]
    } else if (ball.pos[1] - RADIUS < 0) {
      ball.pos = [ball.pos[0], RADIUS]
      ball.veloc = [ball.veloc[0], Math.abs(ball.veloc[1]) * 0.6]
    }
    if (ball.pos[0] - RADIUS < 0) {
      ball.pos = [RADIUS, ball.pos[1]]
      ball.veloc = [Math.abs(ball.veloc[0]) * 0.6, ball.veloc[1]]
    } else if (ball.pos[0] + RADIUS > WIDTH) {
      ball.pos = [WIDTH - RADIUS, ball.pos[1]]
      ball.veloc = [-Math.abs(ball.veloc[0]) * 0.6, ball.veloc[1]]
    }

    frameCount.value = frame.frame
    syncReadout()
  }

  ctx.beginPath()
  ctx.arc(ball.pos[0], ball.pos[1], RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = BALL_COLOR
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = '#434d6b'
  ctx.stroke()
}

function toggleAnimate(): void {
  animate.value = !animate.value
}

function applyKick(): void {
  // Instantaneous impulse: force = mass * desired_accel, so this contributes accel=[-8, -14] on
  // the very next update() tick regardless of ball.mass - see kinetic.ts's force().
  ball.force([-8 * ball.mass, -14 * ball.mass])
  if (!animate.value) {
    // Not currently animating - consume the impulse once immediately so a kick is visible even
    // before "Start animation" is pressed, then repaint (ChartCanvasBase's own RAF loop isn't
    // running, so nothing will repaint this on its own).
    ball.update()
    syncReadout()
    canvasBase.value?.redraw()
  }
}

function reset(): void {
  animate.value = false
  ball.pos = [WIDTH / 2, HEIGHT / 2]
  ball.veloc = [0, 0]
  ball.accel = [0, 0]
  frameCount.value = 0
  syncReadout()
  canvasBase.value?.redraw()
}
</script>

<template>
  <div>
    <h2>Canvas infrastructure + kinetic.js demo</h2>
    <p class="desc">
      Validates <code>ChartCanvasBase.vue</code> + <code>useCanvasChart.ts</code> +
      <code>kinetic.ts</code> (ported from <code>util.canvas.base.kinetic</code>) working together
      end to end - the prerequisite infrastructure for every other Phase E item (see
      <code>PORT_STATUS.md</code>). Not a ported brush itself: <code>activebubble.js</code>/
      <code>bubblecloud.js</code>, which extend <code>kinetic.js</code> for real, are next
      iteration's job.
    </p>
    <div class="controls">
      <button type="button" data-testid="canvas-demo-toggle" @click="toggleAnimate">{{ animate ? 'Stop' : 'Start' }} animation</button>
      <button type="button" data-testid="canvas-demo-kick" @click="applyKick">Apply kick</button>
      <button type="button" data-testid="canvas-demo-reset" @click="reset">Reset</button>
    </div>
    <ChartCanvasBase ref="canvasBase" :width="WIDTH" :height="HEIGHT" :animate="animate" data-testid="canvas-demo-canvas" @frame="onFrame" />
    <p class="readout" data-testid="canvas-demo-readout">pos=({{ posX }}, {{ posY }}) veloc=({{ velX }}, {{ velY }}) frame={{ frameCount }}</p>
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
}
.readout {
  font-family: monospace;
  font-size: 12px;
  color: #333;
}
</style>
