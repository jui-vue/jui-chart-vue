<script setup lang="ts">
// Converted from `www.jui-vue.io/play/chart/json/pie.js` - exercises pie + title + tooltip +
// legend together (with `format` callbacks and `showText: "inside"`), the richest single-demo
// coverage of this project's Phase 1 registered surface.
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
  type: 'pie',
  showText: 'inside',
  // `k` (the target key) is unused here, matching the legacy demo's own `function(k, v)` - only
  // `v` is read.
  format: (_k: string, v: number) => `${v}%`,
}

const widget = [
  { type: 'title', text: 'Pie Sample' },
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
    <h2>pie</h2>
    <Chart :width="600" :height="400" :padding="150" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
