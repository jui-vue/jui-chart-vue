<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/bar_gauge.js` (real legacy demo data/config).
import Chart from '../Chart.vue'

const axis = [
  {
    data: [
      { title: 'OPTION 1', value: 75 },
      { title: 'OPTION 2', value: 68 },
      { title: 'OPTION 3', value: 60 },
      { title: 'OPTION 4', value: 70 },
      { title: 'OPTION 5', value: 20 },
      { title: 'OPTION 6', value: 20 },
    ],
  },
]

const brush = {
  type: 'bargauge',
  size: 18,
  format: (value: number) => `${value}%`,
}
</script>

<template>
  <div class="demo">
    <h2>bargauge</h2>
    <Chart :width="600" :height="300" :padding="0" :axis="axis" :brush="brush" />
  </div>
</template>
