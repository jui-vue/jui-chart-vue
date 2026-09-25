<script setup lang="ts">
// No legacy demo exists for `heatmapscatter` in this environment's copy of the demo library -
// constructed here over a real `date`-typed x-axis (see `heatmapscatter.ts`'s own header comment
// for why a real date axis, unlike `main` branch's from-scratch port, needs no adaptation here).
import Chart from '../Chart.vue'

const oneDay = 24 * 3600 * 1000
const base = +new Date(2024, 0, 1)
const data = Array.from({ length: 40 }, (_, i) => ({
  date: new Date(base + i * oneDay),
  value1: 50 + Math.round(Math.sin(i / 3) * 40 + (Math.random() - 0.5) * 10),
}))

const axis = [
  {
    x: {
      type: 'date',
      domain: [data[0].date, data[data.length - 1].date],
      // Tick interval widened to 4 days (matching the brush's own xInterval bucket width) purely
      // for demo legibility - with 40 daily data points in a 600px-wide chart, a 1-day tick
      // interval crams 40 overlapping labels onto the x-axis. This is a demo-authoring choice
      // only (no legacy demo exists for heatmapscatter to match against); it does not affect the
      // brush's own point-to-cell bucketing, which is independently driven by `brush.xInterval`.
      interval: oneDay * 4,
      // Without an explicit `format`, a date grid's default tick text is the raw `Date` object's
      // own `.toString()` (confirmed via `base/draw.ts`'s `format()` falling through to
      // `Builder.format()`, which returns `args[0]` unchanged when no `chart.format` option is
      // set - correct, faithful behavior matching the real legacy engine) - producing long,
      // overlapping "Thu Jan 04 2024 00:00:00 GMT+0900 (...)" labels. Real legacy date-axis demos
      // always configure a short `format` string for this reason; doing the same here for
      // legibility, not working around a bug.
      format: 'MM-dd',
      key: 'date',
      line: true,
    },
    y: { type: 'range', domain: [0, 100], line: true },
    data,
  },
]

const brush = [{ type: 'heatmapscatter', target: ['value1'], xInterval: oneDay * 4, yInterval: 20 }]

const widget = [{ type: 'title', text: 'Heatmap Scatter Sample' }]
</script>

<template>
  <div class="demo">
    <h2>heatmapscatter</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
