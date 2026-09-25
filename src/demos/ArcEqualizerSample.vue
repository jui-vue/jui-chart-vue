<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/realtime_arcequalizer.js` (real legacy demo
// config) - the original demo starts empty and populates via a `setTimeout` + `chart.axis(0)
// .update(data)` call (a live-update feature outside a static Playwright-screenshotted demo's
// scope); seeded here with one fixed row of representative data instead of starting empty.
import Chart from '../Chart.vue'

const axis = [
  {
    c: { type: 'panel' },
    data: [{ v1: 32, v2: 14, v3: 6 }],
  },
]

const brush = [
  {
    type: 'arcequalizer',
    target: ['v1', 'v2', 'v3'],
    maxValue: 100,
    stackCount: 20,
    textRadius: 30,
  },
]

const widget = [{ type: 'title', text: 'Equalizer Sample' }]
</script>

<template>
  <div class="demo">
    <h2>arcequalizer</h2>
    <Chart :width="400" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
