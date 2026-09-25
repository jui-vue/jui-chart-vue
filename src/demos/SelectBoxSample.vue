<script setup lang="ts">
// No legacy demo exists for `selectbox` alone (checked - it's normally paired with zoom/scroll
// widgets outside this project's current scope) - constructed here over a real `date`-typed axis
// (jui-graph-ts's real `DateGrid`, unlike `main` branch's Vue port, which had no real date axis at
// all and had to approximate this brush's math by hand - see `selectbox.ts`'s own header comment).
import Chart from '../Chart.vue'

const oneDay = 24 * 3600 * 1000
const base = +new Date(2024, 0, 1)
const data = Array.from({ length: 8 }, (_, i) => ({
  date: new Date(base + i * oneDay),
  value: 20 + Math.round(Math.sin(i) * 15) + i,
}))

const axis = [
  {
    x: {
      type: 'date',
      domain: [data[0].date, data[data.length - 1].date],
      interval: oneDay,
      format: 'MM-dd',
      key: 'date',
      line: true,
    },
    y: { type: 'range', domain: [0, 50], line: true },
    data,
  },
]

const brush = [
  { type: 'line', target: ['value'] },
  { type: 'selectbox' },
]

const widget = [{ type: 'title', text: 'Select Box Sample' }]
</script>

<template>
  <div class="demo">
    <h2>selectbox + line</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
