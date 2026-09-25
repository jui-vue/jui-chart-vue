<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/stack_line.js` (real legacy demo data/config) -
// `target` is left unset, matching the legacy demo, relying on Builder's own auto-inference from
// `axis.data[0]`'s keys (apple/microsoft/oracle).
import Chart from '../Chart.vue'

const data = [
  { apple: 26.1, microsoft: 24.86, oracle: 22.08 },
  { apple: 43.83, microsoft: 25.14, oracle: 30.15 },
  { apple: 55.03, microsoft: 24, oracle: 24.88 },
  { apple: 72.95, microsoft: 25.39, oracle: 32.78 },
]

const axis = [
  {
    x: { type: 'fullblock', domain: ['2010', '2011', '2012', '2013'], line: true },
    y: {
      type: 'range',
      domain: (row: Record<string, number>) => row.apple + row.microsoft + row.oracle,
      step: 10,
    },
    data,
  },
]

const brush = { type: 'stackline', symbol: 'step' }

const widget = [
  { type: 'title', text: 'Line Sample' },
  { type: 'legend' },
]

const style = { lineBorderDashArray: '6, 3' }
</script>

<template>
  <div class="demo">
    <h2>stackline</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" :style="style" />
  </div>
</template>
