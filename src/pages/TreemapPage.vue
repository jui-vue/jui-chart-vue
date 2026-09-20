<script setup lang="ts">
// treemap.js has no shipped .html example in jui-chart/examples/ (checked - none reference this
// brush). See TreemapChart.vue's header comment for the full source-confirmed algorithm/data-model/
// interaction write-up.
import { ref } from 'vue'
import TreemapChart from '../components/TreemapChart.vue'
import type { TreemapFormatNode, TreemapSourceRow } from '../composables/useTreemap'
import type { ChartElementEventPayload } from '../types'

// Exact-coordinate reference case #1 (hand-traced in useTreemap.spec.ts's "squarifyRects" describe
// block): a FLAT, single-level set of top-level siblings, values [4,3,2,1] at a 300x300 container.
// No folder nesting at all - purely to make the squarify()/improvesRatio() row-decision arithmetic
// checkable by hand (see useTreemap.ts's header comment for the full by-hand table + the
// scale-invariance argument used to derive it at this pixel size from a cleaner 10x10 trace).
const flatRows: TreemapSourceRow[] = [
  { index: '0', text: 'Box A', value: 4 },
  { index: '1', text: 'Box B', value: 3 },
  { index: '2', text: 'Box C', value: 2 },
  { index: '3', text: 'Box D', value: 1 },
]

// Exact-coordinate reference case #2 (hand-traced in useTreemap.spec.ts's "layoutTreemapForest -
// hand-traced 2-level tree" describe block, x40 scale): a top-level LEAF (A) as a sibling of a
// top-level NON-LEAF (B, with its own children C/D). This is also the smallest possible example of
// this port's confirmed, faithfully-reproduced "grouping boundary" quirk - see the caption below.
const nestedRows: TreemapSourceRow[] = [
  { index: '0', text: 'readme.txt', value: 10 },
  { index: '1', text: 'Archive', value: 0 },
  { index: '1.0', text: 'old1.txt', value: 5 },
  { index: '1.1', text: 'old2.txt', value: 15 },
]

// A realistic, deliberately 2-LEVEL dataset (folder -> file, no sub-folders) - disk usage by
// top-level folder, sized in MB. Kept strictly 2 levels deep so the layout reads as a normal,
// correctly-nested treemap (see the caption on the "nestedRows" section above for why a 3-level
// mixed folder/file structure does NOT render as a clean nested treemap in this source).
const diskUsageRows: TreemapSourceRow[] = [
  { index: '0', text: 'Documents', value: 0 },
  { index: '0.0', text: 'Reports.pdf', value: 120 },
  { index: '0.1', text: 'Notes.txt', value: 30 },
  { index: '0.2', text: 'Budget.xlsx', value: 45 },
  { index: '0.3', text: 'Archive.zip', value: 60 },
  { index: '1', text: 'Photos', value: 0 },
  { index: '1.0', text: 'Vacation.jpg', value: 200 },
  { index: '1.1', text: 'Family.png', value: 150 },
  { index: '1.2', text: 'Pets.png', value: 80 },
  { index: '2', text: 'Videos', value: 0 },
  { index: '2.0', text: 'Movie.mp4', value: 500 },
  { index: '2.1', text: 'Clip.mov', value: 90 },
  { index: '2.2', text: 'Tutorial.mp4', value: 110 },
  { index: '3', text: 'Music', value: 0 },
  { index: '3.0', text: 'Album1', value: 75 },
  { index: '3.1', text: 'Album2', value: 60 },
  { index: '3.2', text: 'Podcast', value: 40 },
]

function diskFormat(node: TreemapFormatNode): string {
  return node.depth === 1 ? node.text : `${node.text} (${node.value}MB)`
}

const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}

function sizeLabel(node: TreemapFormatNode): string {
  return `${node.text}`
}
</script>

<template>
  <div>
    <h2>treemap.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - this brush DEFINES <code>chart.brush.treemap.nodemanager</code> (the tree helper
      <code>flame.js</code> only borrows). Data is a flat array of <code>{index, text, value}</code> rows, <code>index</code> a dot-separated tree path -
      unlike <code>flame.js</code>, MULTIPLE rows may share depth 1 (several top-level siblings, not one implicit root). Layout is the SQUARIFIED treemap
      algorithm (Bruls et al.), not slice-and-dice. Only leaf nodes are ever drawn as rectangles; non-leaf nodes are invisible grouping containers that can
      get a title label (<code>titleDepth</code>).
    </p>

    <h3>Exact-coordinate reference #1: flat squarify, values [4,3,2,1]</h3>
    <p class="desc">
      A synthetic, hand-traceable example (see <code>useTreemap.spec.ts</code>) - area 300x300, 4 top-level siblings, no nesting. Expected rects:
      Box A x=0,y=0,w=210,h=1200/7 (&asymp;171.43); Box B x=0,y=1200/7,w=210,h=900/7 (&asymp;128.57); Box C x=210,y=0,w=90,h=200; Box D x=210,y=200,w=90,h=100.
    </p>
    <TreemapChart :data="flatRows" :width="300" :height="300" :title-depth="0" />

    <h3>Exact-coordinate reference #2: a top-level leaf sibling next to a top-level folder</h3>
    <p class="desc">
      Also hand-traced in <code>useTreemap.spec.ts</code> (x40 scale) - area 240x200. Expected rects: readme.txt x=160,y=0,w=80,h=200; old1.txt
      x=0,y=0,w=160,h=50; old2.txt x=0,y=50,w=160,h=150. <strong>Confirms a real, faithfully-reproduced source quirk</strong>: <code>readme.txt</code> and
      the <code>Archive</code> folder's own files (<code>old1.txt</code>/<code>old2.txt</code>) render as separate, non-adjacent rectangles at the SAME
      nesting level - there is no visual grouping boundary distinguishing "Archive's own area" from "readme.txt's own area", because
      <code>convertNodeToArray()</code>'s grouping (re-derived in <code>useTreemap.ts</code>) only ever produces 2 effective geometric levels, regardless of
      how deep the tree's index paths go - see that file's header comment for the full derivation. This is why the realistic dataset below is kept strictly
      2 levels deep (folder -&gt; file, no sub-folders).
    </p>
    <TreemapChart :data="nestedRows" :width="240" :height="200" :title-depth="0" />

    <h3>Realistic dataset: disk usage by folder (strictly 2 levels)</h3>
    <p class="desc">
      <code>titleDepth=1</code> (default) labels each top-level folder; default <code>nodeColor</code> cycles the theme palette by top-level folder (every
      file under the same folder shares one color) - the <code>format</code> callback distinguishes folder titles (name only) from file labels (name +
      size).
    </p>
    <TreemapChart :data="diskUsageRows" :width="640" :height="360" title="Disk usage by folder (MB)" :format="diskFormat" />

    <h3><code>textAlign</code> / <code>textOrient</code> variants</h3>
    <p class="desc">Per-leaf label anchor - two independent axes (source computes them from two separate config values, not one combined setting).</p>
    <div style="display: flex; gap: 16px; flex-wrap: wrap">
      <TreemapChart :data="diskUsageRows" :width="300" :height="220" text-align="start" text-orient="top" :format="sizeLabel" />
      <TreemapChart :data="diskUsageRows" :width="300" :height="220" text-align="end" text-orient="bottom" :format="sizeLabel" />
    </div>

    <h3>No title labels (<code>titleDepth=0</code>, no depth matches)</h3>
    <p class="desc">Every leaf still gets its own regular label (<code>showText</code>, default <code>true</code> - unlike <code>flame.js</code>'s format-gated labels).</p>
    <TreemapChart :data="diskUsageRows" :width="640" :height="300" :title-depth="0" :format="sizeLabel" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>this.addEvent(elem, node)</code> - only the RECT gets events (confirmed: unlike <code>flame.js</code>, source never attaches events
      to title or per-leaf text). <code>dataIndex</code> is always <code>null</code> (source passes the node object, not an array index),
      <code>dataKey</code> is the node's own hierarchical index string.
    </p>
    <TreemapChart :data="diskUsageRows" :width="640" :height="300" :format="diskFormat" @click="onClick" @mouseover="onMouseover" />
    <p class="desc" data-testid="last-treemap-event">
      Last event:
      <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <TreemapChart :data="diskUsageRows" :width="640" :height="360" :format="diskFormat" theme="dark" title="Disk usage by folder (MB)" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 720px;
}
</style>
