<script setup lang="ts">
// Demo for `ActiveCircleChart.vue` (`src/composables/useActiveCircle.ts`, hand-ported from
// `chart.brush.canvas.activecircle`) - see that composable's header comment for the full
// extend-chain / axis-based-ness / spawn-once-forever quirk writeup.
//
// Axis config is deliberately pinned to a fixed, hand-computable domain (`min:0, max:10,
// unit:10` bypasses `computeRangeDomain`'s auto-"nice" step search entirely - see
// `useAxis.spec.ts`'s own header comments for that algorithm) so every circle's pixel position at
// spawn is exactly hand-traceable: with the default 480x280 canvas and default padding
// (top:20/right:24/bottom:32/left:48), the plot area is x:[48,456]/y:[20,248] (y reversed for a
// "range" axis - see `useChartLayout.ts`), so `scaleX(v) = 48 + 40.8*v` and
// `scaleY(v) = 248 - 22.8*v`. Two rows are static (no vx/vy/ax/ay - zero by default), one row
// carries `vx=5` (axis-domain units/second, NOT pixels/second - `Circle.updateAcceleration()`
// scales `xValue + vx*runtime` through the axis scale every frame) to demonstrate real movement,
// clamped once it runs off the right edge of the domain (`RangeAxisConfig`'s default `clamp: true`
// - see `useScale.ts`'s `createLinearScale`).
//
// "Spawn 3 circles" sets `data` for the first time. "Add 2 more" appends further rows to the SAME
// reactive array - demonstrating the real, source-confirmed quirk `useActiveCircle.ts` documents:
// once circles exist, this has ZERO visible effect (the `circles.length === 0` spawn gate never
// re-opens on its own). "Reset" clears the live simulation (a port-only affordance, not in the
// source) so the NEXT frame re-seeds from whatever `data` currently holds - including any rows
// added since the last spawn.
import { ref } from 'vue'
import ActiveCircleChart from '../components/ActiveCircleChart.vue'
import type { DataRow, RangeAxisConfig } from '../types'

const axisX: RangeAxisConfig = { type: 'range', domain: 'x', min: 0, max: 10, unit: 10 }
const axisY: RangeAxisConfig = { type: 'range', domain: 'y', min: 0, max: 10, unit: 10 }

const data = ref<DataRow[]>([])
const spawnClicks = ref(0)
const chartRef = ref<InstanceType<typeof ActiveCircleChart> | null>(null)

function spawn(): void {
  spawnClicks.value++
  data.value = [
    { x: 5, y: 3, radius: 15 },
    { x: 2, y: 8, radius: 12 },
    { x: 8, y: 2, radius: 10, vx: 5 },
  ]
}

function addMore(): void {
  // Appends to the SAME array - demonstrates the "no effect once circles already exist" quirk.
  data.value = [...data.value, { x: 5, y: 5, radius: 8 }, { x: 9, y: 9, radius: 8 }]
}

function reset(): void {
  chartRef.value?.reset()
}
</script>

<template>
  <div>
    <h2>Active circle chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/canvas/activecircle.js</code> (<code>chart.brush.canvas.activecircle</code>, extends
      <code>chart.brush.canvas.core</code> -&gt; <code>chart.brush.core</code>). The first canvas brush in this phase that's
      genuinely axis-based: each circle's position comes from the real x/y axis scales (<code>useChartLayout</code>, the SAME
      composable every axis-based SVG component in this port uses), not a physics-only plot rect. Circles are seeded from
      <code>data</code> only on the very first frame that finds zero live circles - appending more rows later has no effect
      until <code>reset()</code> clears the simulation. The third circle carries a data-domain <code>vx</code> and visibly
      drifts right, clamping once it reaches the axis's max.
    </p>
    <div class="controls">
      <button type="button" data-testid="spawn" @click="spawn">Spawn 3 circles</button>
      <button type="button" data-testid="add-more" @click="addMore">Add 2 more (no effect until reset)</button>
      <button type="button" data-testid="reset" @click="reset">Reset</button>
    </div>
    <ActiveCircleChart
      ref="chartRef"
      data-testid="activecircle-canvas"
      :data="data"
      :axis-x="axisX"
      :axis-y="axisY"
      :width="480"
      :height="280"
      title="Active circles"
    />
    <p class="readout" data-testid="activecircle-readout">
      rows={{ data.length }} spawnClicks={{ spawnClicks }} circleCount={{ chartRef?.circleCount ?? 0 }}
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
