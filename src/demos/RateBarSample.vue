<script setup lang="ts">
// No legacy `www.jui-vue.io/play/chart/json/*.js` demo exists for `ratebar` (checked - none of
// the 161 shipped demos reference it) - constructed here directly from `ratebar.js`'s own
// documented option shape (per-row 100%-composition pill bar, one segment per nonzero target).
import Chart from '../Chart.vue'

const data = [
  { quarter: '1Q', chrome: 55, firefox: 20, safari: 15, edge: 10 },
  { quarter: '2Q', chrome: 60, firefox: 18, safari: 12, edge: 0 },
  { quarter: '3Q', chrome: 58, firefox: 22, safari: 10, edge: 10 },
]

const axis = [
  {
    x: { type: 'range', domain: [0, 100], line: true },
    y: { type: 'block', domain: 'quarter', line: true },
    data,
  },
]

const brush = [{ type: 'ratebar', target: ['chrome', 'firefox', 'safari', 'edge'] }]

const widget = [
  { type: 'title', text: 'Browser Share' },
  { type: 'legend' },
]
</script>

<template>
  <div class="demo">
    <h2>ratebar</h2>
    <Chart :width="600" :height="300" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
