<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/donut.js` (real legacy demo data/config) -
// exercises donut + title + tooltip + legend together, same combo shape as Phase 1's `pie` demo.
import Chart from '../Chart.vue'

const names: Record<string, string> = {
  ie: 'IE',
  ff: 'Fire Fox',
  chrome: 'Chrome',
  safari: 'Safari',
  other: 'Others',
}

const axis = {
  data: [{ ie: 70, ff: 11, chrome: 9, safari: 6, other: 4 }],
}

const brush = {
  type: 'donut',
  showText: 'inside',
  format: (_k: string, v: number) => `${v}%`,
}

const widget = [
  { type: 'title', text: 'Donut Sample' },
  {
    type: 'tooltip',
    orient: 'left',
    format: (data: Record<string, number>, k: string) => ({
      key: names[k],
      value: data[k],
    }),
  },
  {
    type: 'legend',
    format: (k: string) => names[k],
  },
]
</script>

<template>
  <div class="demo">
    <h2>donut</h2>
    <Chart :width="600" :height="400" :padding="150" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
