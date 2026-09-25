<script setup lang="ts">
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { day: 'Mon', a: 40, b: 20 },
      { day: 'Tue', a: 55, b: 35 },
      { day: 'Wed', a: 30, b: 45 },
      { day: 'Thu', a: 70, b: 50 },
      { day: 'Fri', a: 60, b: 30 },
    ],
  },
]

const brush = [{ type: 'column', target: ['a', 'b'] }]

const widget = [{ type: 'title', text: 'Dark Theme Sample' }]
</script>

<template>
  <div class="demo">
    <h2>theme: dark</h2>
    <Chart :width="500" :height="350" theme="dark" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
