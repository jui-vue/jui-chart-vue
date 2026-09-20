<script setup lang="ts">
// No scatter.js example ships in jui-chart/examples/ - this uses a representative "weekly sensor
// reading" dataset (one categorical x per week, two sensors' numeric readings as `target`) to
// exercise symbols, size, hide/hideZero, hoverSync, activeEvent, and display.
//
// Note on the data model: `getXY()` (this port's `useSeries`, shared with Line/Area/Bar) always
// treats exactly one axis as categorical/index-based and the other as each target's own numeric
// value - there's no "two independent numeric fields" mode (e.g. plotting `{x: weight, y:
// height}` pairs) in the original engine either, so this demo (like the original) uses a
// categorical x-axis, same as a dot-plot/strip-plot rather than a free-form x/y scatter.
import { ref } from 'vue'
import ScatterChart from '../components/ScatterChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { week: 'W1', sensorA: 12, sensorB: 30 },
  { week: 'W2', sensorA: 18, sensorB: 0 },
  { week: 'W3', sensorA: 9, sensorB: 22 },
  { week: 'W4', sensorA: 24, sensorB: 26 },
  { week: 'W5', sensorA: 15, sensorB: 19 },
  { week: 'W6', sensorA: 27, sensorB: 33 },
  { week: 'W7', sensorA: 21, sensorB: 14 },
  { week: 'W8', sensorA: 30, sensorB: 28 },
]

const axisX: AxisConfig = { type: 'block', domain: 'week' }
const axisY: AxisConfig = { type: 'range', domain: ['sensorA', 'sensorB'], step: 6 }
const target = ['sensorA', 'sensorB']

// `stacked` needs a y-domain wide enough for the CUMULATIVE sum (sensorA+sensorB), not each
// target's own independent max.
const axisYStacked: AxisConfig = { type: 'range', domain: (d) => d.sensorA + d.sensorB, step: 6 }

function shapeBySize(_key: string, value: number): 'circle' | 'triangle' {
  return value >= 25 ? 'triangle' : 'circle'
}

// Per-element event forwarding demo - ported from `brush/core.js`'s `addEvent()`. See
// `ScatterChart.vue`'s header comment: unlike Line/Area, `dataIndex`/`data` are real here
// (per-marker), and forwarding fires for every symbol including `cross`.
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onScatterClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onScatterMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onScatterMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>Scatter chart</h2>
    <p class="desc">
      Ported from <code>src/brush/scatter.js</code>. No dedicated example ships in jui-chart/examples - this uses a sample
      "weekly sensor reading" dataset instead (one categorical x per week, two sensors' readings as <code>target</code>).
    </p>

    <h3>default (symbol="circle")</h3>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" title="Weekly sensor readings" />

    <h3>symbol="triangle" / per-point callback</h3>
    <p class="desc">
      <code>symbol</code> can be a fixed shape name or a <code>(key, value) =&gt; shape</code> callback (ported from
      <code>getSymbolType()</code>) - here, points with a value &gt;= 25 render as a triangle, the rest as a circle.
    </p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" :symbol="shapeBySize" :size="10" />

    <h3>symbol="rectangle"</h3>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" symbol="rectangle" />

    <h3>symbol="cross" (non-interactive, matches the original's guard)</h3>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" symbol="cross" :size="10" />

    <h3>hide + hoverSync</h3>
    <p class="desc">
      <code>hide</code>: markers are invisible until hovered. <code>hoverSync</code>: hovering one sensor's marker also
      reveals/highlights the other sensor's marker in the same <code>week</code> - ported from <code>createScatter()</code>'s
      <code>hoverSync</code> cached-symbol loop.
    </p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" hide hover-sync />

    <h3>hideZero</h3>
    <p class="desc">sensorB's W2 reading is 0 - <code>hideZero</code> skips drawing it entirely rather than rendering a marker at the axis baseline.</p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" hide-zero />

    <h3>activeEvent="click" (persistent highlight + label)</h3>
    <p class="desc">Ported from scatter.js's <code>activeEvent</code>: click a marker to persistently highlight it and show its value, until another marker is clicked.</p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" active-event="click" />

    <h3>display="max"|"min"|"all"</h3>
    <p class="desc">Ported from scatter.js's <code>display</code> (shared min/max-label logic with <code>BarChart</code>'s <code>display</code>, via <code>selectDisplayBars</code>).</p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" display="max" :width="500" :height="300" />
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" display="min" :width="500" :height="300" />
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" display="all" :width="500" :height="300" />

    <h3>stacked (same data, non-stacked vs. stacked)</h3>
    <p class="desc">
      Ported from <code>stackscatter.js</code> (a thin wrapper swapping <code>getXY()</code> for <code>getStackXY()</code> - see
      <code>ScatterChart.vue</code>'s header comment). Each week's <code>sensorB</code> marker now sits at
      <code>sensorA + sensorB</code>, not its own independent value.
    </p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" title="non-stacked" />
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisYStacked" :target="target" stacked title="stacked" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - per-marker, with a real
      <code>dataIndex</code>/<code>data</code> (unlike Line/Area's always-<code>null</code> per-series wiring). Fires for every symbol,
      including <code>cross</code> markers (which stay non-interactive for hover-recolor/<code>activeEvent</code> - see the component's
      header comment). Hover or click a marker below.
    </p>
    <ScatterChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" @click="onScatterClick" @mouseover="onScatterMouseover" @mouseout="onScatterMouseout" />
    <p class="desc" data-testid="last-scatter-event">
      Last event:
      <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }}, dataKey="{{ lastEvent.payload.dataKey }}", data={{ JSON.stringify(lastEvent.payload.data) }}</code>
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
