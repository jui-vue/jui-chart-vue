<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/equalizer_bar.js` (real legacy demo data/config) -
// exercises `equalizerbar` and `equalizercolumn` (the "block-train" segmented-meter rendering)
// side by side.
import Chart from '../Chart.vue'

const data = [
  { label: '1 year ago', normal: 5, warning: 15, fatal: 5 },
  { label: '1 month ago', normal: 25, warning: 8, fatal: 5 },
  { label: 'Yesterday', normal: 12, warning: 4, fatal: 10 },
  { label: 'Today', normal: 18, warning: 5, fatal: 7 },
]

const barAxis = [
  {
    x: {
      type: 'range',
      domain: (row: Record<string, number>) => Math.max(row.normal, row.warning, row.fatal),
      step: 5,
      line: true,
    },
    y: { domain: ['1 year ago', '1 month ago', 'Yesterday', 'Today'], line: true },
    data,
  },
]

const columnAxis = [
  {
    x: { domain: ['1 year ago', '1 month ago', 'Yesterday', 'Today'], line: true },
    y: {
      type: 'range',
      domain: (row: Record<string, number>) => Math.max(row.normal, row.warning, row.fatal),
      step: 5,
      line: true,
    },
    data,
  },
]

const barBrush = [{ type: 'equalizerbar', target: ['normal', 'warning', 'fatal'], unit: 10 }]
const columnBrush = [{ type: 'equalizercolumn', target: ['normal', 'warning', 'fatal'], unit: 10 }]

const widget = [
  { type: 'title', text: 'Equalizer Sample', align: 'end' },
  { type: 'tooltip' },
  { type: 'legend' },
]
</script>

<template>
  <div class="demo">
    <h2>equalizerbar</h2>
    <Chart :width="600" :height="400" :padding="{ left: 75, top: 50, right: 50, bottom: 50 }" :axis="barAxis" :brush="barBrush" :widget="widget" />
  </div>
  <div class="demo">
    <h2>equalizercolumn</h2>
    <Chart :width="600" :height="400" :axis="columnAxis" :brush="columnBrush" :widget="widget" />
  </div>
</template>
