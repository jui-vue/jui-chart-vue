<script setup lang="ts">
// selectbox.js: a row of invisible-until-hovered cells spanning the full plot height, bucketed
// along the x-axis by a constant `interval`. Source-confirmed declarative (bucket boundaries come
// from config, not drag-to-select) and hover-reveal-only (no persistent "selected" state). See
// `SelectBoxChart.vue`'s header comment for why this port runs it over an existing `"range"`
// (numeric) x-axis instead of building a whole new date/time axis type just for this brush.
import { ref } from 'vue'
import SelectBoxChart from '../components/SelectBoxChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

// 11 rows, day=0..10 - explicit min/max so the "nice domain" algorithm resolves to EXACTLY [0,10]
// (hand-verification-friendly, same pattern as `PinPage.vue`'s range-axis demo).
const dailyReadings: DataRow[] = Array.from({ length: 11 }, (_, day) => ({ day, temp: 60 + Math.round(Math.sin(day / 2) * 8) }))
const axisX: AxisConfig = { type: 'range', domain: 'day', min: 0, max: 10 }
const axisY: AxisConfig = { type: 'range', domain: 'temp' }

// A larger, plainer numeric domain to demo `interval`'s literal upstream default (`1000`, matching
// `chart.grid.date`'s own `interval: 1000`) with an interval that divides the domain evenly (no
// overshoot quirk here - see the primary demo above for that).
const wideData: DataRow[] = [{ n: 0, v: 5 }, { n: 5000, v: 9 }]
const wideAxisX: AxisConfig = { type: 'range', domain: 'n', min: 0, max: 5000 }
const wideAxisY: AxisConfig = { type: 'range', domain: 'v' }

const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onEvent(type: string, payload: ChartElementEventPayload) {
  lastEvent.value = { type, payload }
}
</script>

<template>
  <div>
    <h2>selectbox.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly. Reads
      <code>this.axis.x.ticks("milliseconds", this.axis.get("x").interval)</code> - a method signature that only exists on jui-chart's
      date/time scale, which this port doesn't have (see the component's own header comment for the full finding and the deliberate scope
      decision: run the identical bucket-stepping math directly over this port's existing numeric <code>"range"</code> x-axis instead of
      building a whole new date-axis subsystem for one 72-line brush).
    </p>

    <h3>Primary demo: <code>interval=3</code> over a <code>[0,10]</code> domain (does NOT divide evenly)</h3>
    <p class="desc">
      Ticks: 0, 3, 6, 9, then a final overshooting tick at 12 (matching the source's own unclamped final-tick behavior) - 4 cells, the last one
      (9-12) sharing the SAME pixel width as the first 3 even though its own domain span reaches past the axis's configured max of 10. Hover a
      cell to reveal it.
    </p>
    <SelectBoxChart :data="dailyReadings" :axis-x="axisX" :axis-y="axisY" :interval="3" title="Hover to reveal a bucket" data-testid="selectbox-primary" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>this.addEvent(r, { start, end })</code> - the emitted <code>data</code> is the <code>{start,end}</code> bucket object
      itself (not a row of <code>props.data</code>), so <code>dataIndex</code>/<code>dataKey</code> are always <code>null</code>.
    </p>
    <SelectBoxChart
      :data="dailyReadings"
      :axis-x="axisX"
      :axis-y="axisY"
      :interval="3"
      @click="(p) => onEvent('click', p)"
      @mouseover="(p) => onEvent('mouseover', p)"
      @mouseout="(p) => onEvent('mouseout', p)"
    />
    <p class="desc" data-testid="last-selectbox-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Default <code>interval</code> (1000, matching <code>chart.grid.date</code>'s own default) over a <code>[0,5000]</code> domain</h3>
    <p class="desc">Evenly divides: ticks 0, 1000, 2000, 3000, 4000, 5000 - 5 cells, no overshoot.</p>
    <SelectBoxChart :data="wideData" :axis-x="wideAxisX" :axis-y="wideAxisY" data-testid="selectbox-default-interval" />

    <h3>Dark theme</h3>
    <SelectBoxChart :data="dailyReadings" :axis-x="axisX" :axis-y="axisY" :interval="3" theme="dark" title="Dark theme" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
