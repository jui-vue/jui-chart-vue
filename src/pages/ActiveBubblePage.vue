<script setup lang="ts">
// Demo for `ActiveBubbleChart.vue` (`src/composables/useActiveBubble.ts`, hand-ported from
// `chart.brush.canvas.activebubble`) - see that composable's header comment for the full
// extend-chain/spawn-drain/gravity-quirk writeup.
//
// "Spawn burst" appends a batch of rows to a reactive `data` array in ONE tick, each with a
// randomized `duration` (staggering their DEATH times, not their spawn - see the composable's
// header note on why `startTime` doesn't delay a bubble's first paint) and a random x-independent
// color cycling the theme palette. `activeCount` (via `defineExpose`) drives the live on-page
// readout so a Playwright check can watch it rise on spawn and fall back to 0 as bubbles die,
// without needing per-bubble DOM elements (canvas has none).
import { ref } from 'vue'
import ActiveBubbleChart from '../components/ActiveBubbleChart.vue'
import type { DataRow } from '../types'

const data = ref<DataRow[]>([])
const spawnBatches = ref(0)
const chartRef = ref<InstanceType<typeof ActiveBubbleChart> | null>(null)

function spawnBurst(count: number): void {
  spawnBatches.value++
  const batch: DataRow[] = []
  for (let i = 0; i < count; i++) {
    // Durations spread 600-2600ms so the burst visibly thins out over time instead of every
    // bubble dying in the same frame - exactly the "staggered `startTime`/`duration` fields"
    // activebubble.js's own row schema is designed for (see useActiveBubble.ts's header note).
    batch.push({ duration: 600 + Math.round(Math.random() * 2000) })
  }
  data.value = [...data.value, ...batch]
}

function reset(): void {
  data.value = []
  spawnBatches.value = 0
}
</script>

<template>
  <div>
    <h2>Active bubble chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/canvas/activebubble.js</code> (<code>chart.brush.canvas.activebubble</code>, extends
      <code>chart.brush.canvas.core</code> -&gt; <code>chart.brush.core</code>, the same SVG-side brush base Phases A-D build on). No
      real axis/scale - bubbles spawn at the top-left and drift under a purely HORIZONTAL "gravity" force (the source's own
      <code>gDirection = [1, 0]</code>, not a typo this port corrected), colliding and repelling each other, before dying out
      per <code>MortalBubble</code>'s birth/inflate/cross-fade/death lifecycle (see <code>/bubble-demo</code>). There is no
      maximum concurrent count and no auto-respawn - once every spawned bubble dies, nothing more appears until you spawn
      another burst.
    </p>
    <div class="controls">
      <button type="button" data-testid="spawn-burst-8" @click="spawnBurst(8)">Spawn burst of 8</button>
      <button type="button" data-testid="spawn-burst-1" @click="spawnBurst(1)">Spawn 1</button>
      <button type="button" data-testid="reset-burst" @click="reset">Reset</button>
    </div>
    <ActiveBubbleChart ref="chartRef" data-testid="activebubble-canvas" :data="data" :width="480" :height="280" title="Active bubbles" />
    <p class="readout" data-testid="activebubble-readout">
      spawned rows={{ data.length }} batches={{ spawnBatches }} activeCount={{ chartRef?.activeCount ?? 0 }}
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
