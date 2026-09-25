<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/full_gauge.js` (real legacy demo data/config).
import Chart from '../Chart.vue'

const axis = [
  {
    data: [{ title: 'Overall Visits', value: 140, max: 200, min: 0 }],
  },
]

const brush = [
  {
    type: 'fullgauge',
    size: 20,
    titleY: 40,
    showText: true,
    format: (value: number) => `${value}k`,
  },
]

const style = { gaugeFontSize: 30 }
</script>

<template>
  <div class="demo">
    <h2>fullgauge</h2>
    <Chart :width="400" :height="400" :axis="axis" :brush="brush" :style="style" />
  </div>
</template>
