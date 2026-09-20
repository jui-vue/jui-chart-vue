<script setup lang="ts">
// arcequalizer.js has no shipped example in jui-chart/examples/ - hand-built. See
// ArcEqualizerChart.vue's header comment: `extend: "chart.brush.core"` directly, NOT axis-based,
// NOT sharing an `extend` chain with pie.js/donut.js OR equalizer.js/bargauge.js/fullgauge.js
// despite the naming pattern. One angular wedge per `data` row (equal `360/rowCount` degrees each,
// not value-weighted like PieChart), each target stacking radially as small annular-sector
// "blocks" - `Math.ceil(stackCount * value/maxValue)` blocks per target.
import { ref } from 'vue'
import ArcEqualizerChart from '../components/ArcEqualizerChart.vue'
import type { ChartElementEventPayload, DataRow } from '../types'

// A 6-band stereo audio-equalizer-style level display, arranged radially - one wedge per
// frequency band, left/right channel levels stacked radially within each wedge (0-100 scale,
// matching `maxValue`'s default of 100).
const bandData: DataRow[] = [
  { band: 'Bass', left: 82, right: 78 },
  { band: 'Low-Mid', left: 65, right: 70 },
  { band: 'Mid', left: 55, right: 52 },
  { band: 'High-Mid', left: 40, right: 45 },
  { band: 'Treble', left: 60, right: 58 },
  { band: 'Air', left: 25, right: 30 },
]
const target = ['left', 'right']

function dynamicMax(row: DataRow): number {
  return (row.left as number) + (row.right as number)
}

function percentFormat(total: number): string {
  return `${Math.round(total)} total`
}

const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>arcequalizer.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - NOT a `pie.js`/`donut.js` variant (it hand-rolls its own
      <code>polarToCartesian()</code>/<code>describeArc()</code>), and NOT sharing an <code>extend</code> chain with <code>equalizer.js</code>/
      <code>bargauge.js</code>/<code>fullgauge.js</code> despite the shared naming pattern. Each row of <code>data</code> becomes one equal-angle
      wedge (<code>360 / rowCount</code> degrees, unlike <code>PieChart</code>'s value-weighted slices); within a wedge, each <code>target</code>
      stacks radially outward as small annular-sector "blocks" - the polar analog of <code>equalizer.js</code>'s straight-line block train.
    </p>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" />

    <h3>Custom <code>stackCount</code> / <code>textRadius</code></h3>
    <p class="desc">More (finer) radial steps and a larger center hole for the total label.</p>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" :stack-count="40" :text-radius="70" />

    <h3><code>maxValue</code> as a per-row callback</h3>
    <p class="desc">
      <code>maxValue</code> can be a function invoked once per row (the running max across all rows is used) instead of a flat number - here each
      row's own <code>left + right</code> sum, so every wedge's blocks are scaled relative to the LOUDEST band's total, not a fixed 100.
    </p>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" :max-value="dynamicMax" />

    <h3>Custom <code>format</code> - center total label</h3>
    <p class="desc"><code>format(total)</code> - <code>total</code> is the sum of every row's every target's raw value.</p>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" :format="percentFormat" />

    <h3>No-data placeholder</h3>
    <p class="desc">
      An empty <code>data</code> array - ported from <code>calculateData()</code>'s <code>stackData.length == 0</code> branch: a single full-circle
      wedge, fully filled, rendered entirely in <code>arcEqualizerBackgroundColor</code> regardless of target (matching the source's
      <code>dataCount == 0</code> fill guard).
    </p>
    <ArcEqualizerChart :data="[]" :target="target" :width="240" :height="240" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>this.addEvent(p, i, j)</code> - once per (row, target) block group. <strong>Deviation from PieChart/PyramidChart's
      <code>dataIndex: null</code></strong>: since <code>data</code> is genuinely <code>DataRow[]</code> here (one row per wedge), <code>dataIndex</code>
      is the real row index, like <code>BarChart</code>/<code>EqualizerChart</code>. Hover/click a block group below.
    </p>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-arcequalizer-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Custom colors + title</h3>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" :colors="['#0298D5', '#FA5559']" title="Stereo band levels" />

    <h3>Dark theme</h3>
    <ArcEqualizerChart :data="bandData" :target="target" :width="360" :height="360" theme="dark" title="Stereo band levels" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
