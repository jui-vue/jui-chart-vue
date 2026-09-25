<script setup lang="ts">
// No legacy demo exists for `flame` (only a raw, 41-level-deep data resource,
// examples/resources/flamedata.js, unusably dense for a static screenshot - `main` branch's own
// FlamePage.vue header comment independently reached the same "no shipped example" finding and
// built its own hand-crafted call-stack sample instead). A small, independently-authored 4-level
// call-stack sample is used here for the same reason.
import Chart from '../Chart.vue'

const axis = [
  {
    data: [
      { index: '0', text: 'main()', value: 100 },
      { index: '0.0', text: 'handleRequest()', value: 65 },
      { index: '0.0.0', text: 'parseJson()', value: 20 },
      { index: '0.0.1', text: 'runQuery()', value: 45 },
      { index: '0.0.1.0', text: 'execute()', value: 45 },
      { index: '0.1', text: 'flushLogs()', value: 35 },
    ],
  },
]

const palette = ['#7977C2', '#7BBAE7', '#FFC000', '#87BB66', '#FA5559', '#06D9B6']
function hashColor(node: { text: string }): string {
  let h = 0
  for (let i = 0; i < node.text.length; i++) h = (h * 31 + node.text.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

const brush = [
  {
    type: 'flame',
    nodeColor: hashColor,
    format: (node: { text: string; value: number }) => `${node.text} (${node.value})`,
  },
]

const widget = [{ type: 'title', text: 'Flame Graph Sample' }]
</script>

<template>
  <div class="demo">
    <h2>flame</h2>
    <Chart :width="600" :height="300" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
