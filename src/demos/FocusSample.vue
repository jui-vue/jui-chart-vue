<script setup lang="ts">
// No standalone legacy demo exists for `focus` alone (it's normally paired with interactive
// zoom/scroll widgets outside this project's current scope) - constructed here combining `focus`
// with a plain `column` chart to show the highlighted x-range band.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { name: 'Mon', value1: 40 },
      { name: 'Tue', value1: 55 },
      { name: 'Wed', value1: 30 },
      { name: 'Thu', value1: 70 },
      { name: 'Fri', value1: 60 },
      { name: 'Sat', value1: 25 },
      { name: 'Sun', value1: 15 },
    ],
  },
]

const brush = [
  { type: 'column', target: ['value1'] },
  { type: 'focus', start: 2, end: 4 },
]

const widget = [{ type: 'title', text: 'Focus Sample' }]
</script>

<template>
  <div class="demo">
    <h2>focus + column</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
