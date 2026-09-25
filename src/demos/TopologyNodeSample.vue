<script setup lang="ts">
// Adapted from the real legacy demo `examples/topology.html` (data/config copied verbatim) - now
// buildable since `chart.grid.topologytable` (the real required `axis.c` grid, a `jui-chart`-own
// extension, NOT a `jui-graph-ts` engine gap - see `register/grid/topologytable.ts`'s header
// comment for the full correction) is registered. The real demo's own `topologyctrl` widget
// (pan/zoom/drag-node) is now included too, matching the real demo fully - see
// `register/widget/topologyctrl.ts`.
import Chart from '../Chart.vue'

const data = [
  { key: '1000_1', name: 'W1', type: 'was', outgoing: ['1000_1'] },
  { key: '1000_2', name: 'W2', type: 'was', outgoing: ['1000_3', '1000_4'] },
  { key: '1000_3', name: 'W3', type: 'was', outgoing: ['1_2_3_4', '1000_2'] },
  { key: '1000_4', name: 'W4', type: 'server', outgoing: ['1_2_3_4'] },
  { key: '1_2_3_4', name: 'Oracle', type: 'db', outgoing: [] },
]

const edgeData = [
  { key: '1000_1:1000_2', count: 3, time: 1000 },
  { key: '1000_2:1000_3', count: 3, time: 1000 },
  { key: '1000_2:1000_4', count: 3, time: 1000 },
  { key: '1000_3:1_2_3_4', count: 3, time: 2000 },
  { key: '1000_3:1000_2', count: 3, time: 2000 },
  { key: '1000_4:1_2_3_4', count: 3, time: 2000 },
]

const axis = [{ c: { type: 'topologytable' }, data }]

const brush = [
  {
    type: 'topologynode',
    colors: ['#729ff1'],
    edgeData,
    edgeText: (d: { time: number; count: number }, align: string) => {
      let text = d.time + '/' + d.count
      if (align === 'end') {
        text = text + ' →'
      } else {
        text = '← ' + text
      }
      return text
    },
    edgeOpacity: (d: { time: number }) => (d.time > 1000 ? 1 : 0.3),
    tooltipTitle: (names: string[] | string, align: string) => {
      if (!Array.isArray(names)) return names
      if (align === 'start') {
        return names.slice().reverse().join(' ← ')
      }
      return names.join(' → ')
    },
    tooltipText: (d: { time: number; count: number }) => `Total response time/count: ${d.time}/${d.count}`,
    // Restored to the real legacy demo's own `"{server}"`/`"{was}"`/`"{db}"` icon-font placeholders
    // now that the icon subsystem is registered (`register/icon/classic.ts`) and `<Chart>` wires a
    // working default font. The underlying codepoint-resolution/font-loading/CSS wiring is all
    // correct and unit-tested, but these still render as tofu boxes (not real glyphs) in a
    // Playwright screenshot - OPEN ISSUE, NOT FIXED, root cause unknown - see
    // `register/icon/classic.ts`'s own header comment for the full history.
    nodeText: (d: { type: string }) => {
      if (d.type === 'server') return '{server}'
      else if (d.type === 'was') return '{was}'
      else return '{db}'
    },
    nodeTitle: (d: { name: string }) => d.name,
    nodeScale: (d: { outgoing: unknown[] }) => (d.outgoing.length > 1 ? 2 : 1),
    activeEdge: '1000_2:1000_3',
    activeEvent: 'dblclick',
  },
]

const widget = [
  { type: 'title', text: 'Topology Sample' },
  { type: 'topologyctrl', zoom: true, move: true },
]

const style = { axisBackgroundColor: '#fff', axisBackgroundOpacity: 1, topologyEdgeWidth: 1 }
</script>

<template>
  <div class="demo">
    <h2>topologynode</h2>
    <Chart :width="700" :height="500" :axis="axis" :brush="brush" :widget="widget" :style="style" />
  </div>
</template>
