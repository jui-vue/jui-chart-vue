<script setup lang="ts">
// No standalone legacy demo exists for `pin` alone on a plain block/range axis (the one real
// legacy usage found, `split_line.js`, pairs it with `splitline` - a brush outside this project's
// current scope - over a synthetic realtime dataset) - constructed here combining `pin` with a
// plain `column` brush instead, to show the pin marker (label + flag + vertical line) at a fixed
// category index.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { name: 'Mon', value1: 40 },
      { name: 'Tue', value1: 55 },
      { name: 'Wed', value1: 30 },
      { name: 'Thu', value1: 70 },
      { name: 'Fri', value1: 60 },
    ],
  },
]

const brush = [
  { type: 'column', target: ['value1'] },
  { type: 'pin', split: 2, format: (v: number) => `day ${v}` },
]

const widget = [{ type: 'title', text: 'Pin Sample' }]
</script>

<template>
  <div class="demo">
    <h2>pin + column</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
