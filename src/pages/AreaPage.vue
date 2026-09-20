<script setup lang="ts">
// No area.js example ships in jui-chart/examples/ - reuses LinePage's sample dataset since
// area.js extends line.js (same axis shape, same symbol options).
import { ref } from 'vue'
import AreaChart from '../components/AreaChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { month: 'Jan', visits: 120, signups: 30 },
  { month: 'Feb', visits: 132, signups: 45 },
  { month: 'Mar', visits: 101, signups: 28 },
  { month: 'Apr', visits: 154, signups: 52 },
  { month: 'May', visits: 190, signups: 61 },
  { month: 'Jun', visits: 176, signups: 58 },
]

const axisX: AxisConfig = { type: 'block', domain: 'month' }
const axisY: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4 }

// `stacked` needs a y-domain wide enough for the CUMULATIVE sum (visits+signups) - see LinePage's
// matching note.
const axisYStacked: AxisConfig = { type: 'range', domain: (d) => d.visits + d.signups, step: 4 }

// Extra top padding so the "display" balloon on the topmost point isn't clipped - see LinePage's
// matching note.
const displayPadding = { top: 44, right: 24, bottom: 32, left: 48 }

// Per-element event forwarding demo - ported from `brush/core.js`'s `addEvent()`. See
// `AreaChart.vue`'s header comment: `dataIndex`/`data` are always `null` (per-target wiring, not
// per-point), and forwarding fires regardless of `line`.
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onAreaClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onAreaMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onAreaMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>Area chart</h2>
    <p class="desc">Ported from <code>src/brush/area.js</code> (extends line.js). No dedicated example ships in jui-chart/examples.</p>

    <h3>startZero (default): fills down to y=0</h3>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" title="Monthly visits & signups" />

    <h3>symbol="curve", line=false</h3>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" symbol="curve" :line="false" />

    <h3>activeEvent="mouseover" (hover an outline to highlight it, dim the other's outline)</h3>
    <p class="desc">
      Ported from line.js's <code>activeEvent</code>, inherited by area.js - only affects the outline stroke, never the translucent fill (see
      the component's top-of-file note on why).
    </p>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" active-event="mouseover" />

    <h3>display="max" | "min" | "all"</h3>
    <p class="desc">
      Ported from area.js's own <code>display</code> option (<code>drawArea()</code> calls <code>createTooltip()</code> directly - unlike
      <code>active</code>/<code>activeEvent</code>, this one is NOT dead config upstream). Requires <code>line: true</code>, matching the
      original's <code>if(this.brush.line) { ... if(this.brush.display) ... }</code> nesting.
    </p>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" display="max" :padding="displayPadding" />
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" display="min" :padding="displayPadding" />
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" display="all" :padding="displayPadding" />

    <h3>display="max" with line=false (no markers - requires line: true)</h3>
    <p class="desc">Confirms the original's nesting is faithfully ported: no display markers render when the outline is off.</p>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" display="max" :line="false" :padding="displayPadding" />

    <h3>stacked (same data, non-stacked vs. stacked)</h3>
    <p class="desc">
      Ported from <code>stackarea.js</code>, plus this port's own band-fill deviation (each target's fill runs from the
      <em>previous</em> target's cumulative curve to its own, instead of upstream's baseline-anchored + z-order-occlusion
      approach) - see <code>AreaChart.vue</code>'s header comment for the full writeup. <code>signups</code>'s band now visibly starts
      where <code>visits</code>'s band ends, not from zero.
    </p>
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" title="non-stacked" />
    <AreaChart :data="data" :axis-x="axisX" :axis-y="axisYStacked" :target="['visits', 'signups']" stacked title="stacked" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - see this component's header comment for why
      forwarding is wired per-target (not literally per the original's shared-group multi-fire quirk) and always fires regardless of
      <code>line</code>. <code>dataIndex</code>/<code>data</code> are always <code>null</code>. Hover or click the fill/outline below.
    </p>
    <AreaChart
      :data="data"
      :axis-x="axisX"
      :axis-y="axisY"
      :target="['visits', 'signups']"
      @click="onAreaClick"
      @mouseover="onAreaMouseover"
      @mouseout="onAreaMouseout"
    />
    <p class="desc" data-testid="last-area-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }}, dataKey="{{ lastEvent.payload.dataKey }}"</code>
      <code v-else>(none yet)</code>
    </p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
