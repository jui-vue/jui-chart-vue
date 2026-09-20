<script setup lang="ts">
// flame.js has no shipped example in jui-chart/examples/ (only a raw data resource,
// examples/resources/flamedata.js - a flat {index, text, value} list, confirming the data model
// documented in FlameChart.vue's header comment). See that file for the full source-confirmed
// layout formula, color/label/zoom behavior, and the deliberate zoomEvent addition.
import { computed, ref } from 'vue'
import FlameChart from '../components/FlameChart.vue'
import type { FlamePositionedNode, FlameSourceRow } from '../composables/useFlame'
import type { ChartElementEventPayload } from '../types'

// The EXACT tree hand-traced in useFlame.spec.ts (see that file's own comment for the diagram and
// the full by-hand x/y/width table) - used here, at the SAME 300x200 area (width=300, height=200,
// no title), so the rendered SVG's rect coordinates can be checked pixel-for-pixel against that
// same hand computation.
const tracedRows: FlameSourceRow[] = [
  { index: '0', text: 'main', value: 100 },
  { index: '0.0', text: 'processRequest', value: 60 },
  { index: '0.0.0', text: 'parseInput', value: 40 },
  { index: '0.0.0.0', text: 'tokenize', value: 25 },
  { index: '0.0.0.1', text: 'normalize', value: 15 },
  { index: '0.0.1', text: 'validate', value: 20 },
  { index: '0.1', text: 'backgroundJob', value: 40 },
  { index: '0.1.0', text: 'flushQueue', value: 40 },
]

// A realistic 5-level call-stack / profiling sample, varying weights, used for the visual demos
// below (color hashing, zoom, textAlign, orientation, dark theme).
const stackRows: FlameSourceRow[] = [
  { index: '0', text: 'main()', value: 500 },
  { index: '0.0', text: 'handleRequest()', value: 320 },
  { index: '0.0.0', text: 'parseJson()', value: 60 },
  { index: '0.0.1', text: 'runQuery()', value: 200 },
  { index: '0.0.1.0', text: 'buildQuery()', value: 20 },
  { index: '0.0.1.1', text: 'execute()', value: 170 },
  { index: '0.0.1.1.0', text: 'readRows()', value: 150 },
  { index: '0.0.1.1.0.0', text: 'decodeRow()', value: 140 },
  { index: '0.0.2', text: 'renderView()', value: 55 },
  { index: '0.0.2.0', text: 'escapeHtml()', value: 30 },
  { index: '0.1', text: 'flushLogs()', value: 90 },
  { index: '0.1.0', text: 'writeFile()', value: 85 },
  { index: '0.2', text: 'gcSweep()', value: 70 },
]

// A simple deterministic name -> color hash (common flame-graph practice) - the caller's own
// choice via nodeColor; the brush itself has no such logic (see FlameChart.vue header comment).
const palette = ['#7977C2', '#7BBAE7', '#FFC000', '#FF7800', '#87BB66', '#1DA8A0', '#929292', '#0298D5', '#FA5559', '#06D9B6']
function hashColor(node: FlamePositionedNode): string {
  let h = 0
  for (let i = 0; i < node.text.length; i++) h = (h * 31 + node.text.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function labelFormat(node: FlamePositionedNode): string {
  return `${node.text} (${node.value})`
}

// truncated label - demonstrates a CALLER-supplied narrow-rect strategy (source has none built in
// - see FlameChart.vue header comment on why this port doesn't invent one either).
function truncatedFormat(node: FlamePositionedNode): string {
  const maxChars = Math.max(0, Math.floor(node.width / 6))
  return node.text.length > maxChars ? node.text.slice(0, Math.max(0, maxChars - 1)) + '…' : node.text
}

const zoomIndex = ref<string | null>(null)
function onZoom(payload: { index: string }) {
  zoomIndex.value = payload.index
}
function resetZoom() {
  zoomIndex.value = null
}

const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}

const breadcrumb = computed(() => zoomIndex.value ?? '(root - unzoomed)')
</script>

<template>
  <div>
    <h2>flame.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly (only reuses <code>treemap.js</code>'s <code>NodeManager</code> as a data-structure
      helper). Data is a FLAT array of <code>{index, text, value}</code> rows, <code>index</code> a dot-separated tree path (<code>"0.1.0"</code>). The root
      always spans the full plot width; each child's width is <code>parentWidth * (value / parent.value)</code> - not normalized against a children-sum, so a
      mismatched value can leave a visible gap. Depth maps to a fixed row height (<code>plotHeight / maxDepth</code>). Not axis-based - only
      <code>this.axis.area()</code>.
    </p>

    <h3>Exact-coordinate reference tree (hand-traced in <code>useFlame.spec.ts</code>)</h3>
    <p class="desc">
      area 300x200, maxDepth=4 -> rowHeight=50. <code>nodeOrient="bottom"</code> (default): root at the bottom row (y=150), leaves at the top (y=0).
    </p>
    <FlameChart :data="tracedRows" :width="300" :height="200" :format="labelFormat" :node-color="hashColor" />

    <h3><code>nodeOrient="top"</code></h3>
    <p class="desc">Root anchored at the top row (y=rowHeight, i.e. <code>50</code> - depths start at 1, so the very first row stays empty, a literal preserved source quirk).</p>
    <FlameChart :data="tracedRows" :width="300" :height="200" node-orient="top" :format="labelFormat" :node-color="hashColor" />

    <h3>Realistic call-stack sample, <code>nodeColor</code> hashing by frame name</h3>
    <p class="desc">A common flame-graph convention (not built into the source - <code>nodeColor</code> is the caller-supplied hook it exposes for exactly this).</p>
    <FlameChart :data="stackRows" :width="640" :height="300" :format="labelFormat" :node-color="hashColor" title="CPU profile" />

    <h3>Click-to-zoom (<code>zoomEvent="click"</code>, the default)</h3>
    <p class="desc">
      Source has no zoom interaction of its own - <code>activeIndex</code> is a passive config value (see header comment). Clicking any node (including a
      dimmed ancestor) re-zooms to it; the zoomed node fills the full width, its ancestor chain renders dimmed above, its own subtree keeps its real relative
      proportions. Click the bottom-most (root) row, or "Reset zoom" below, to zoom back out.
    </p>
    <p class="desc" data-testid="flame-breadcrumb">Zoomed to: <code>{{ breadcrumb }}</code> <button type="button" @click="resetZoom">Reset zoom</button></p>
    <FlameChart :data="stackRows" :width="640" :height="300" :format="labelFormat" :node-color="hashColor" :active-index="zoomIndex" @zoom="onZoom" />

    <h3>Narrow rects with a caller-supplied truncating <code>format</code></h3>
    <p class="desc">Source itself never truncates (checked explicitly - see header comment); this <code>format</code> shortens the label itself once its node is narrower than roughly 6px/char.</p>
    <FlameChart :data="stackRows" :width="400" :height="300" :format="truncatedFormat" :node-color="hashColor" />

    <h3><code>textAlign="middle"</code> / <code>"end"</code></h3>
    <div style="display: flex; gap: 16px; flex-wrap: wrap">
      <FlameChart :data="tracedRows" :width="300" :height="200" text-align="middle" :format="labelFormat" :node-color="hashColor" />
      <FlameChart :data="tracedRows" :width="300" :height="200" text-align="end" :format="labelFormat" :node-color="hashColor" />
    </div>

    <h3>No <code>format</code> - no labels at all</h3>
    <p class="desc">Matches source exactly: <code>createTextElement()</code> returns <code>null</code> when <code>format</code> isn't a function.</p>
    <FlameChart :data="tracedRows" :width="300" :height="200" :node-color="hashColor" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>this.addEvent(r, node)</code>/<code>this.addEvent(t, node)</code> - <code>dataIndex</code> is always <code>null</code> (source passes
      the node object itself, not an array index), <code>dataKey</code> is the node's own hierarchical index string.
    </p>
    <FlameChart :data="tracedRows" :width="300" :height="200" :format="labelFormat" :node-color="hashColor" :zoom-event="false" @click="onClick" @mouseover="onMouseover" />
    <p class="desc" data-testid="last-flame-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <FlameChart :data="stackRows" :width="640" :height="300" :format="labelFormat" :node-color="hashColor" theme="dark" title="CPU profile" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 720px;
}
</style>
