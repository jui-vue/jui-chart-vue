<script setup lang="ts">
// equalizer.js has no shipped example in jui-chart/examples/ - hand-built. Audio-level-style data
// (bass/mid/treble per channel) with clearly distinct per-target magnitudes so the discrete block
// stack and its per-block color banding both read unambiguously.
import { ref } from 'vue'
import EqualizerChart from '../components/EqualizerChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { channel: 'L', bass: 24, mid: 14, treble: 6 },
  { channel: 'R', bass: 10, mid: 22, treble: 18 },
  { channel: 'C', bass: 16, mid: 8, treble: 26 },
]
const target = ['bass', 'mid', 'treble']
const axisX: AxisConfig = { type: 'block', domain: 'channel' }
const axisY: AxisConfig = { type: 'range', domain: (d) => Math.max(d.bass, d.mid, d.treble), step: 5 }

// `gap` (color-band size) demo - smaller gap cycles colors faster, more visibly "banded".
const axisYBand: AxisConfig = { type: 'range', domain: (d) => Math.max(d.bass, d.mid, d.treble), step: 5 }

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
    <h2>equalizer.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - shares NO code with <code>bar.js</code>/<code>stackbar.js</code>, and is
      genuinely distinct from <code>equalizerbar.js</code>/<code>equalizercolumn.js</code> (those extend <code>stackbar.js</code>/<code>stackcolumn.js</code>
      instead - see the <code>/bar</code> page's "equalizer" section). Each <code>(row, target)</code> pair renders as a stack of small
      <code>unit</code>px-tall blocks (default 5px, separated by a fixed hardcoded 1.5px gap) growing from zero toward the value, clipping the
      last block short so the stack always lands exactly on the value. Blocks cycle through the theme's color list every <code>gap</code>
      blocks (default 5) counting outward from zero - a color-banded VU-meter look, NOT one uniform color per target (unlike
      <code>equalizerbar.js</code>/<code>equalizercolumn.js</code>). Only one orientation exists upstream (x=category, y=value) - no
      "equalizerrow" sibling.
    </p>
    <EqualizerChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" title="Channel levels" />

    <h3>Smaller color band (gap=2)</h3>
    <p class="desc">Same data, <code>gap="2"</code> - colors cycle twice as fast, making the banding more obvious.</p>
    <EqualizerChart :data="data" :axis-x="axisX" :axis-y="axisYBand" :target="target" :gap="2" title="gap=2" />

    <h3>Larger blocks (unit=10)</h3>
    <p class="desc">Same data, <code>unit="10"</code> - fewer, taller blocks per stack.</p>
    <EqualizerChart :data="data" :axis-x="axisX" :axis-y="axisYBand" :target="target" :unit="10" title="unit=10" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>equalizer.js</code>'s own unconditional <code>addEvent(barGroup, i, j)</code> - once per (row, target) block
      stack, not per block. Hover/click a stack below.
    </p>
    <EqualizerChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-equalizer-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey="{{ lastEvent.payload.dataKey }}" data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <EqualizerChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" theme="dark" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
