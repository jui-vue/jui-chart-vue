<script setup lang="ts">
// Demo for `BubbleCloudChart.vue` (`src/composables/useBubbleCloud.ts`, hand-ported from
// `chart.brush.canvas.bubblecloud`) - see that composable's header comment for the full extend-
// chain/caching/settle-and-hold-non-overlapping-layout algorithm writeup.
//
// A "popular pages" word-cloud-ish visualization: each row's `title`/`capacity` (source's own
// hardcoded field names - see useBubbleCloud.ts) drive a labeled bubble's name/size. "Shuffle
// values" reassigns `data` to a NEW array with randomized capacities (same page names) - a
// reference change, so it demonstrates a full rebuild + fresh random scatter + re-settle
// animation, exactly like a real page-view count changing. "Same values, new array" reassigns
// `data` to a new array holding IDENTICAL row values, demonstrating the source's confirmed
// REFERENCE-equality (not deep-equality) cache: even though nothing actually changed, this still
// forces a full rebuild (positions re-randomize) - the exact quirk useBubbleCloud.ts's header
// comment documents. "Touch cache" reassigns `data.value = data.value` (same underlying array
// object) so nothing changes at all - the cache HITS, and the simulation just keeps
// stepping/holding its already-settled layout.
import { ref } from 'vue'
import BubbleCloudChart from '../components/BubbleCloudChart.vue'
import type { DataRow } from '../types'

const pageNames = ['Home', 'Pricing', 'Docs', 'Blog', 'Support', 'API', 'Changelog', 'About']

function randomRows(): DataRow[] {
  return pageNames.map((title) => ({ title, capacity: 5 + Math.round(Math.random() * 95) }))
}

const data = ref<DataRow[]>(randomRows())
const rebuildCount = ref(0)
const chartRef = ref<InstanceType<typeof BubbleCloudChart> | null>(null)

function shuffleValues(): void {
  rebuildCount.value++
  data.value = randomRows()
}

function sameValuesNewArray(): void {
  rebuildCount.value++
  // Deliberately a NEW array (spread), same row VALUES - forces a rebuild per the source's
  // reference-equality cache, even though nothing about the data actually changed.
  data.value = data.value.map((row) => ({ ...row }))
}

function touchCache(): void {
  // Same array reference - the outer cache HITS, no rebuild, simulation just keeps stepping.
  data.value = data.value
}
</script>

<template>
  <div>
    <h2>Bubble cloud chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/canvas/bubblecloud.js</code> (<code>chart.brush.canvas.bubblecloud</code>, extends
      <code>chart.brush.canvas.core</code> -&gt; <code>chart.brush.core</code>) - imports the PLAIN <code>Bubble</code>
      (<code>base/bubble.js</code>), not <code>MortalBubble</code>: bubbles here never die. Every bubble is pulled toward the
      canvas center by a decaying "gravity" (direct position lerp, not a kinetic force) and pairwise-separated from its
      neighbors every frame regardless of that decay, so the cloud settles into - and then HOLDS - a non-overlapping packed
      layout, unlike <code>/activebubble</code>'s continuous drift-and-die simulation. Hover a bubble to see the rest dim.
    </p>
    <div class="controls">
      <button type="button" data-testid="shuffle-values" @click="shuffleValues">Shuffle values (new data)</button>
      <button type="button" data-testid="same-values-new-array" @click="sameValuesNewArray">Same values, new array (still rebuilds)</button>
      <button type="button" data-testid="touch-cache" @click="touchCache">Touch cache (no rebuild)</button>
    </div>
    <BubbleCloudChart ref="chartRef" data-testid="bubblecloud-canvas" :data="data" :width="520" :height="340" title="Popular pages" />
    <p class="readout" data-testid="bubblecloud-readout">
      rows={{ data.length }} rebuildClicks={{ rebuildCount }} hovered={{ chartRef?.hoveredLabel ?? 'none' }}
    </p>
    <!-- `widget/canvas/picker.js`'s click/dblclick path (`usePickerWidget.ts`'s `runPickerCheck`,
         retrofitted onto this component's pre-existing hover-only wiring) - see
         `BubbleCloudChart.vue`'s own header comment. -->
    <p class="readout" data-testid="bubblecloud-pick-readout">picked={{ chartRef?.pickedLabel ?? 'none' }} via={{ chartRef?.pickedVia ?? 'none' }}</p>
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
