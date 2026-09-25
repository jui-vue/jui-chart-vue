<script setup lang="ts">
// Converted from `www.jui-vue.io/play/chart/json/area.js` - a date-axis area chart, faithfully
// keeping the original's random-walk 3650-day dataset (not reduced - see this task's final report
// for why shrinking it would count as an unrequested scope reduction).
import Chart from '../Chart.vue'

const baseDate = +new Date(1968, 9, 3)
const oneDay = 24 * 3600 * 1000
let baseValue = Math.random() * 150

const data: { date: Date; value: number }[] = [{ date: new Date(baseDate), value: baseValue }]

let cursor = baseDate
for (let i = 1; i < 3650; i++) {
  cursor += oneDay
  const now = new Date(cursor)
  baseValue = Math.round((Math.random() - 0.498) * 40 + data[i - 1].value)
  data.push({ date: now, value: baseValue })
}

const axis = [
  {
    x: {
      type: 'date',
      domain: [data[0].date, data[data.length - 1].date],
      interval: oneDay * 365,
      format: 'yyyy',
      key: 'date',
      line: 'solid',
    },
    y: {
      type: 'range',
      domain: 'value',
      step: 10,
      line: 'solid',
    },
    data,
  },
]

const brush = [{ type: 'area', target: ['value'] }]

const widget = [{ type: 'title', text: 'Area Sample' }]
</script>

<template>
  <div class="demo">
    <h2>area (date axis)</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
