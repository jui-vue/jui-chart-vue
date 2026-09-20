<script setup lang="ts">
// pyramid.js has no shipped example in jui-chart/examples/ - hand-built. See PyramidChart.vue's
// header comment: `extend: "chart.brush.core"` directly, NOT axis-based (only `axis.area()`), and
// - despite pairing conceptually with a "funnel chart" - each segment is a trapezoid SLICE of one
// solid triangle, sized by `value / total` (not `value / max`), not an independently-sized row.
import { ref } from 'vue'
import PyramidChart from '../components/PyramidChart.vue'
import type { ChartElementEventPayload, DataRow } from '../types'

// A sales/conversion funnel - reused across most demos below for easy cross-comparison. total =
// 1600, so each stage's rate is a clean fraction: visitors 1000/1600=62.5%, signups 400/1600=25%,
// trials 150/1600=9.375%, purchases 50/1600=3.125%.
const funnelData: DataRow = { visitors: 1000, signups: 400, trials: 150, purchases: 50 }
const funnelTarget = ['visitors', 'signups', 'trials', 'purchases']

function percentFormat(key: string, value: number, rate: number): string {
  return `${key}: ${value} (${Math.round(rate * 1000) / 10}%)`
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
    <h2>pyramid.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - not axis-based, only <code>this.axis.area()</code> (the plot-area
      rect). A single <code>data</code> row's <code>target</code> keys become trapezoid SLICES of one solid triangle, sorted value-descending
      (largest = widest, at the base) and sized by <code>value / total</code> - NOT independently-sized rows the way a typical funnel-chart
      implementation would compute each row's own width from <code>value / max</code>.
    </p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" />

    <h3><code>showText</code> - value labels</h3>
    <p class="desc">Default label text is the raw value (<code>format</code> omitted). Leader-line + text anchored at each segment's right-edge midpoint.</p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" show-text />

    <h3>Custom <code>format</code> - percentage of total</h3>
    <p class="desc"><code>format(key, value, rate)</code> - <code>rate</code> is this port's exposed <code>value / total</code> share (0-1), a caller-supplied use, not a built-in mode upstream.</p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" show-text :format="percentFormat" />

    <h3><code>reverse</code> - inverted funnel (apex at the bottom)</h3>
    <p class="desc">Same data, <code>reverse</code> flips which end is the wide base: the largest segment (visitors) is now at the TOP, narrowing down to the smallest (purchases) at the bottom apex.</p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" reverse show-text />

    <h3>A narrower/taller shape (non-45-degree slope)</h3>
    <p class="desc">Confirms the trapezoid geometry generalizes beyond a square-ish plot area - the triangle's slope angle (<code>atan2(height, width/2)</code>) is steeper here.</p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="220" :height="320" show-text />

    <h3>Per-element event forwarding</h3>
    <p class="desc">Ported from <code>this.addEvent(poly, 0, d.index)</code> - per segment, <code>dataIndex</code> is <code>null</code> (single-row component, see header comment), <code>dataKey</code> is the segment's <code>target</code> key. Hover/click a segment below.</p>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" show-text @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-pyramid-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <PyramidChart :data="funnelData" :target="funnelTarget" :width="360" :height="280" show-text theme="dark" title="Conversion funnel" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
