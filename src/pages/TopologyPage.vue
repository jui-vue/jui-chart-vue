<script setup lang="ts">
// Adapted from `jui-chart/examples/topology.html` - the only shipped example for this brush. See
// TopologyChart.vue's header comment for the full source-confirmed algorithm/data-model/
// interaction write-up (data model, edge pull-back geometry, reciprocal-edge "connect" sharing,
// active-cascading asymmetry, the linear-layout row-shuffle quirk).
import { ref } from 'vue'
import TopologyChart from '../components/TopologyChart.vue'
import type { TopologyEdgeDataRow, TopologyNodeRow } from '../composables/useTopology'
import type { ChartElementEventPayload } from '../types'

// Same shape as topology.html's own `data`: a small WAS/server/DB call graph. "1000_1" has a
// (skipped) self-loop in `outgoing`, kept here on purpose to demo the self-loop guard.
const nodes: TopologyNodeRow[] = [
  { key: '1000_1', name: 'W1', kind: 'was', outgoing: ['1000_1'] },
  { key: '1000_2', name: 'W2', kind: 'was', outgoing: ['1000_3', '1000_4'] },
  { key: '1000_3', name: 'W3', kind: 'was', outgoing: ['1_2_3_4', '1000_2'] },
  { key: '1000_4', name: 'W4', kind: 'server', outgoing: ['1_2_3_4'] },
  { key: '1_2_3_4', name: 'Oracle', kind: 'db', outgoing: [] },
]

const edgeData: TopologyEdgeDataRow[] = [
  { key: '1000_1:1000_2', count: 3, time: 1000 },
  { key: '1000_2:1000_3', count: 3, time: 1000 },
  { key: '1000_2:1000_4', count: 3, time: 1000 },
  { key: '1000_3:1_2_3_4', count: 3, time: 2000 },
  { key: '1000_3:1000_2', count: 3, time: 2000 },
  { key: '1000_4:1_2_3_4', count: 3, time: 2000 },
]

function nodeTitle(data: TopologyNodeRow): string {
  return data.name as string
}
function nodeText(data: TopologyNodeRow): string {
  if (data.kind === 'server') return '{server}'
  if (data.kind === 'was') return '{was}'
  return '{db}'
}
function nodeScale(data: TopologyNodeRow): number {
  return (data.outgoing as string[]).length > 1 ? 2 : 1
}
function edgeText(data: TopologyEdgeDataRow, align: 'start' | 'end'): string {
  const text = `${data.time}/${data.count}`
  return align === 'end' ? `${text} →` : `← ${text}`
}
function edgeOpacity(data: TopologyEdgeDataRow): number {
  return (data.time as number) > 1000 ? 1 : 0.3
}
function tooltipTitle(names: [string, string] | string, align: 'start' | 'end'): string {
  if (typeof names === 'string') return names
  return align === 'start' ? [...names].reverse().join(' ← ') : names.join(' → ')
}
function tooltipText(data: TopologyEdgeDataRow): string {
  return `Total time/count: ${data.time}/${data.count}`
}

const lastNodeClick = ref<{ data: TopologyNodeRow; event: MouseEvent } | null>(null)
const lastEdgeClick = ref<{ data: TopologyEdgeDataRow | null; event: MouseEvent } | null>(null)
function onNodeClick(payload: { data: TopologyNodeRow; event: MouseEvent }) {
  lastNodeClick.value = payload
}
function onEdgeClick(payload: { data: TopologyEdgeDataRow | null; event: MouseEvent }) {
  lastEdgeClick.value = payload
}

const lastForward = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastForward.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastForward.value = { type: 'mouseover', payload }
}

// A small graph with a genuine reciprocal pair (A<->B) plus a one-way edge (A->C), to demo the
// "connect" shared-line rendering and the active-cascading asymmetry directly (see
// TopologyChart.vue's header comment) - `nodeImage` variant too.
const reciprocalNodes: TopologyNodeRow[] = [
  { key: 'A', name: 'A', outgoing: ['B', 'C'] },
  { key: 'B', name: 'B', outgoing: ['A'] },
  { key: 'C', name: 'C', outgoing: [] },
]
</script>

<template>
  <div>
    <h2>topologynode.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly. Data is real graph nodes+edges (<code>{ key, outgoing: string[] }</code>) - genuinely
      different from <code>treemap.js</code>/<code>flame.js</code>'s shared flat tree-row shape. Layout is delegated to <code>grid/topologytable.js</code>'s
      own procedural placement (<code>sort="linear"</code>, a deterministic-X/random-Y zigzag scan with a real row-shuffle quirk; or
      <code>sort="random"</code>) - NOT force-directed physics, and NOT caller-supplied coordinates. <code>widget/topologyctrl.js</code> (drag/zoom/pan) is
      confirmed genuinely optional - the chart below is fully interactive without it. Its viewport pan/zoom is now ported as the <code>pannable</code>/
      <code>zoomable</code> props (see "Pannable + zoomable viewport" below); its individual-node dragging is a separate, still-unported feature - see the
      component's header comment.
    </p>

    <h3>Realistic dataset: WAS/server/DB call graph</h3>
    <p class="desc">
      <code>nodeScale</code> doubles a node with &gt;1 outgoing edge (W2, W3); <code>nodeText</code> shows a type tag, <code>nodeTitle</code> the name;
      <code>edgeText</code>/<code>edgeOpacity</code> read the separate <code>edgeData</code> array; <code>1000_1</code>'s self-referencing
      <code>outgoing</code> entry is silently skipped (no self-loop edge, confirmed from source's own explicit guard). Click an edge (or its label/dot) to
      activate it and show its tooltip (needs both <code>tooltipTitle</code>/<code>tooltipText</code>); click the background to reset.
    </p>
    <TopologyChart
      :data="nodes"
      :width="640"
      :height="360"
      :edge-data="edgeData"
      :node-title="nodeTitle"
      :node-text="nodeText"
      :node-scale="nodeScale"
      :edge-text="edgeText"
      :edge-opacity="edgeOpacity"
      :tooltip-title="tooltipTitle"
      :tooltip-text="tooltipText"
      @nodeclick="onNodeClick"
      @edgeclick="onEdgeClick"
    />
    <p class="desc" data-testid="last-node-click">
      Last nodeclick: <code v-if="lastNodeClick">{{ (lastNodeClick.data as any).name }} ({{ lastNodeClick.data.key }})</code> <code v-else>(none yet)</code>
    </p>
    <p class="desc" data-testid="last-edge-click">
      Last edgeclick: <code v-if="lastEdgeClick">{{ lastEdgeClick.data ? `${lastEdgeClick.data.key} time=${(lastEdgeClick.data as any).time}` : '(no edgeData row)' }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Reciprocal edge sharing (A&lt;-&gt;B) + one-way edge (A-&gt;C)</h3>
    <p class="desc">
      A&lt;-&gt;B is a genuine reciprocal pair: only the A:B direction renders the actual line (B:A reuses it and just gets its own end-marker dot near A) - see
      <code>useTopology.spec.ts</code>'s hand-traced <code>buildTopologyEdges</code> case for this exact graph. The shared A:B line itself lights up either
      way (A directly owns it; B pulls it in via cascade), so the visible difference is subtle - it's the small end-marker DOT near A (B:A's own circle,
      distinct from the dot near B that belongs to A:B): with <code>active-node="A"</code> it stays the default color (A's own activation never cascades to
      B:A, since A:B's own <code>connect</code> is <code>false</code>); with <code>active-node="B"</code> it turns active-purple too (B:A's own
      <code>connect</code> is <code>true</code>, so B's activation DOES cascade to A:B). Playwright-confirmed exact fill colors for both dots in both
      scenarios - see this port's task report. A real, order-dependent asymmetry in source, preserved exactly, not symmetrized.
    </p>
    <div style="display: flex; gap: 16px; flex-wrap: wrap">
      <div>
        <p class="desc">active-node="A" (no cascade to B:A)</p>
        <TopologyChart :data="reciprocalNodes" :width="260" :height="200" active-node="A" />
      </div>
      <div>
        <p class="desc">active-node="B" (cascades to A:B)</p>
        <TopologyChart :data="reciprocalNodes" :width="260" :height="200" active-node="B" />
      </div>
    </div>

    <h3><code>sort="random"</code></h3>
    <p class="desc">The other layout mode - every node placed via <code>Math.random()</code> directly, no zigzag/shuffle quirk.</p>
    <TopologyChart :data="nodes" :width="640" :height="300" sort="random" :node-title="nodeTitle" />

    <h3>Per-element event forwarding (nodes only)</h3>
    <p class="desc">
      Ported from <code>this.addEvent(node, index, null)</code> - confirmed edges get NO generic forwarding in source (only the two named
      <code>nodeclick</code>/<code>edgeclick</code> events above). <code>dataIndex</code> is the node's row index, <code>dataKey</code> is always
      <code>null</code>, <code>data</code> is the full node row.
    </p>
    <TopologyChart :data="nodes" :width="640" :height="300" :node-title="nodeTitle" @click="onClick" @mouseover="onMouseover" />
    <p class="desc" data-testid="last-forward-event">
      Last event: <code v-if="lastForward">{{ lastForward.type }} dataIndex={{ lastForward.payload.dataIndex }} dataKey={{ lastForward.payload.dataKey }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Pannable + zoomable viewport</h3>
    <p class="desc">
      Ported from <code>widget/topologyctrl.js</code>'s <code>move</code>/<code>zoom</code> config flags - this port's first widget. Drag the background to pan
      (<code>pannable</code>); scroll/wheel over the chart to zoom in/out, clamped to <code>[0.6, 2]</code> in <code>0.1</code> steps (<code>zoomable</code>).
      Both apply as a single <code>scale()/translate()</code> transform around the already-rendered nodes/edges/tooltip - confirmed mathematically equivalent
      to source's own per-node/per-edge coordinate scaling (see <code>useTopologyZoom.ts</code>). Nodes/edges stay fully clickable/hoverable after panning or
      zooming - try activating an edge, then pan or zoom; the tooltip tracks its edge. Individual-node dragging (source's own unconditional
      <code>initDragEvent</code>) is a separate, still-unported feature - see the component's header comment for why.
    </p>
    <div data-testid="pan-zoom-chart">
      <TopologyChart :data="reciprocalNodes" :width="480" :height="320" pannable zoomable :node-title="nodeTitle" />
    </div>

    <h3>Dark theme</h3>
    <TopologyChart
      :data="nodes"
      :width="640"
      :height="360"
      theme="dark"
      title="Call graph"
      :edge-data="edgeData"
      :node-title="nodeTitle"
      :node-text="nodeText"
      :node-scale="nodeScale"
      :edge-text="edgeText"
      :tooltip-title="tooltipTitle"
      :tooltip-text="tooltipText"
    />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 720px;
}
</style>
