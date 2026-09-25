<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/equalizer.js` (real legacy demo data/config) - the
// `chart.brush.equalizer` brush (distinct from Batch 1's `equalizerbar`/`equalizercolumn`).
import Chart from '../Chart.vue'

const data = [
  { server: 'W1', cpu: 10 },
  { server: 'W2', cpu: 2 },
  { server: 'W3', cpu: 12 },
  { server: 'W4', cpu: 22 },
  { server: 'W5', cpu: 15 },
  { server: 'W6', cpu: 11 },
  { server: 'W7', cpu: 5 },
  { server: 'W8', cpu: 3 },
]

const axis = [
  {
    x: { type: 'block', domain: 'server', line: true },
    y: { type: 'range', domain: 'cpu', step: 10, line: true },
    data,
  },
]

const brush = {
  type: 'equalizer',
  target: 'cpu',
  innerPadding: 1,
  outerPadding: 3,
  gap: 5,
  unit: 10,
}

const widget = [{ type: 'title', text: 'Equalizer Sample' }]
</script>

<template>
  <div class="demo">
    <h2>equalizer</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
