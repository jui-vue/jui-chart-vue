<script setup lang="ts">
// Demo for `EqualizerColumnChart.vue` (`src/composables/useEqualizerColumn.ts`, hand-ported from
// `chart.brush.canvas.equalizercolumn`) - see that composable's header comment for the full
// extend-chain/2D-not-3D/dead-field writeup, and `useRaycast.ts`'s header comment for the click
// hit-testing wiring (this brush is `widget/raycast.js`'s confirmed sole real consumer -
// `widget/canvas/picker.js` is a SEPARATE mechanism, consumed by `bubblecloud.js` instead - see
// `/bubblecloud`'s own click/dblclick readout, added alongside this iteration).
//
// Mirrors `jui-chart/examples/equalizercolumn.html`'s own config shape: 4 date categories, 3
// stacked targets (normal/warning/fatal), `active: [0, 2]` (index 1 dimmed), `unit: 10`. "Toggle
// error" flips `error` between `null` and `[0]` (source's own `errorText: "Stopped"` flag replaces
// column 0 entirely). "Update values" cycles between the two data sets source's own
// `c.run(...)`/`c.update(...)` demo alternates between every 10s - here on a button instead of a
// timer, so it's deterministic for verification. Click a (non-error) column to pick it - the
// original's own `event: {"raycast.click": ...}` handler used this to set `active` on the clicked
// column; this demo just reads back `pickedIndex`/`pickedRow` instead; see
// `EqualizerColumnChart.vue`'s `onClick`.
import { ref } from 'vue'
import EqualizerColumnChart from '../components/EqualizerColumnChart.vue'
import type { BlockAxisConfig, DataRow, RangeAxisConfig } from '../types'

const axisX: BlockAxisConfig = { type: 'block', domain: ['1 year ago', '1 month ago', 'Yesterday', 'Today'] }
// Matches `BarPage.vue`'s own `equalizer` demo convention (`domain: (d) => d.bass+d.mid+d.treble,
// step: 5`) - `RangeAxisConfig.domain` is field/function-derived in this port, not a literal
// `[min, max]` array like source's own `domain: [0, 30]` (see `BarPage.vue`'s header comment on
// this same convention difference).
const axisY: RangeAxisConfig = { type: 'range', domain: (d) => Number(d.normal ?? 0) + Number(d.warning ?? 0) + Number(d.fatal ?? 0), step: 5 }

const dataSetA: DataRow[] = [
  { normal: 5, warning: 5, fatal: 5 },
  { normal: 10, warning: 8, fatal: 5 },
  { normal: 6, warning: 4, fatal: 10 },
  { normal: 5, warning: 5, fatal: 7 },
]
const dataSetB: DataRow[] = [
  { normal: 7, warning: 7, fatal: 7 },
  { normal: 10, warning: 8, fatal: 5 },
  { normal: 6, warning: 4, fatal: 10 },
  { normal: 5, warning: 5, fatal: 7 },
]

const data = ref<DataRow[]>(dataSetA)
const errorEnabled = ref(true)
const updateClicks = ref(0)
const chartRef = ref<InstanceType<typeof EqualizerColumnChart> | null>(null)

function toggleError(): void {
  errorEnabled.value = !errorEnabled.value
}

function updateValues(): void {
  updateClicks.value++
  data.value = data.value === dataSetA ? dataSetB : dataSetA
}

function resetPick(): void {
  chartRef.value?.reset()
}
</script>

<template>
  <div>
    <h2>Equalizer column chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/canvas/equalizercolumn.js</code> (<code>chart.brush.canvas.equalizercolumn</code>, extends
      <code>chart.brush.canvas.core</code> -&gt; <code>chart.brush.core</code>) - a plain 2D stacked "block-train" column visual
      (NOT 3D - it never touches <code>chart.polygon.*</code>) with an animated level-meter bounce overlay. Column 0's
      <code>error</code> flag replaces its stack with a "Stopped" pennant. Clicking a non-error column resolves a hit via
      <code>widget/raycast.js</code>'s ported logic (<code>useRaycast.ts</code>) - this brush turned out to be that widget's
      only real consumer anywhere in the source tree.
    </p>
    <div class="controls">
      <button type="button" data-testid="toggle-error" @click="toggleError">Toggle error (col 0): {{ errorEnabled ? 'on' : 'off' }}</button>
      <button type="button" data-testid="update-values" @click="updateValues">Update values</button>
      <button type="button" data-testid="reset-pick" @click="resetPick">Reset pick</button>
    </div>
    <EqualizerColumnChart
      ref="chartRef"
      data-testid="equalizercolumn-canvas"
      :data="data"
      :axis-x="axisX"
      :axis-y="axisY"
      :target="['normal', 'warning', 'fatal']"
      :active="[0, 2]"
      :error="errorEnabled ? [0] : null"
      :unit="10"
      :width="520"
      :height="320"
      title="Equalizer Sample"
    />
    <p class="readout" data-testid="equalizercolumn-readout">
      rows={{ data.length }} updateClicks={{ updateClicks }} pickedIndex={{ chartRef?.pickedIndex ?? 'none' }} pickedRow={{
        chartRef?.pickedRow ? JSON.stringify(chartRef.pickedRow) : 'none'
      }}
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
