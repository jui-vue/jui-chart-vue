<script setup lang="ts">
// Demonstrates the `axis.x.orient` / `axis.y.orient` config (Phase A item 1: configurable axis
// orientation), ported from `chart.axis`'s `drawGridType()` - see useAxis.ts/useChartLayout.ts/
// ChartBase.vue. `orient` is nested in the same axisX/axisY config object as `type`/`domain`,
// exactly like the original's `axis.x.orient`/`axis.y.orient` - no new top-level component prop.
import BarChart from '../components/BarChart.vue'
import LineChart from '../components/LineChart.vue'
import type { AxisConfig, DataRow } from '../types'

const data: DataRow[] = [
  { month: 'Jan', visits: 120, signups: 30 },
  { month: 'Feb', visits: 132, signups: 45 },
  { month: 'Mar', visits: 101, signups: 28 },
  { month: 'Apr', visits: 154, signups: 52 },
  { month: 'May', visits: 190, signups: 61 },
  { month: 'Jun', visits: 176, signups: 58 },
]

const axisXBottom: AxisConfig = { type: 'block', domain: 'month' }
const axisXTop: AxisConfig = { type: 'block', domain: 'month', orient: 'top' }
const axisYLeft: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4 }
const axisYRight: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4, orient: 'right' }

const barData: DataRow[] = [
  { quarter: '1Q', sales: 1, profit: 3 },
  { quarter: '2Q', sales: 3, profit: 2 },
  { quarter: '3Q', sales: 10, profit: 1 },
  { quarter: '4Q', sales: 0.49, profit: 4 },
]
const barAxisXLeft: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
const barAxisYLeft: AxisConfig = { type: 'block', domain: 'quarter' }
const barAxisYRight: AxisConfig = { type: 'block', domain: 'quarter', orient: 'right' }

// axis.x.line / axis.y.line: a per-axis, full-length grid line at every tick (grid/core.js's
// `line`, default false) - independent per axis, and (unlike showGrid) works for a block
// (categorical) axis too, not just a range/value axis.
const lineAxisXBlock: AxisConfig = { type: 'block', domain: 'month', line: true }
const lineAxisYRange: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4, line: true }
const lineAxisYRangeOff: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4 }
</script>

<template>
  <div>
    <h2>Axis orientation</h2>
    <p class="desc">
      <code>axis.x.orient: "top" | "bottom"</code> and <code>axis.y.orient: "left" | "right"</code>, ported from <code>chart.axis</code>'s
      orient-based grid placement (<code>grid/block.js</code>/<code>grid/range.js</code>'s <code>top()</code>/<code>bottom()</code>/<code>left()</code>/<code>right()</code>
      draw methods). Padding is adjusted per chart via the existing <code>padding</code> prop so the flipped axis chrome has room - orient doesn't
      auto-adjust padding, same as the original (padding is a separate, independent config).
    </p>

    <h3>Default: x=bottom, y=left</h3>
    <LineChart :data="data" :axis-x="axisXBottom" :axis-y="axisYLeft" :target="['visits', 'signups']" show-points />

    <h3>x=top</h3>
    <LineChart :data="data" :axis-x="axisXTop" :axis-y="axisYLeft" :target="['visits', 'signups']" show-points :padding="{ top: 32, right: 24, bottom: 16, left: 48 }" />

    <h3>y=right</h3>
    <LineChart :data="data" :axis-x="axisXBottom" :axis-y="axisYRight" :target="['visits', 'signups']" show-points :padding="{ top: 20, right: 48, bottom: 32, left: 16 }" />

    <h3>x=top, y=right</h3>
    <LineChart
      :data="data"
      :axis-x="axisXTop"
      :axis-y="axisYRight"
      :target="['visits', 'signups']"
      show-points
      :padding="{ top: 32, right: 48, bottom: 16, left: 16 }"
    />

    <h3>Horizontal bars (block y-axis), y=right</h3>
    <p class="desc">Also exercises the category-axis direction fix: a block axis's pixel interval is never orient-reversed (unlike a range/value axis), matching block.js.</p>
    <BarChart :data="barData" :axis-x="barAxisXLeft" :axis-y="barAxisYLeft" :target="['sales', 'profit']" orient="bar" title="y=left (default)" />
    <BarChart
      :data="barData"
      :axis-x="barAxisXLeft"
      :axis-y="barAxisYRight"
      :target="['sales', 'profit']"
      orient="bar"
      title="y=right"
      :padding="{ top: 20, right: 48, bottom: 32, left: 16 }"
    />

    <h3><code>axis.x.line</code> / <code>axis.y.line</code></h3>
    <p class="desc">
      A per-axis, full-length grid line drawn at every tick (ported from <code>grid/core.js</code>'s <code>line</code> option, default
      <code>false</code>), independent per axis and independent of the chart-wide <code>showGrid</code> prop - and, unlike <code>showGrid</code>,
      works for a block (categorical) axis too, not just a range/value axis. Below: <code>axis.x.line</code> on a block x-axis with
      <code>axis.y.line</code> off, then the reverse (range y-axis line only), then both together, then <code>axis.x.line</code> alone with
      <code>show-grid="false"</code> - proving a per-axis <code>line: true</code> always wins even when the chart-wide gridlines are disabled.
    </p>
    <LineChart :data="data" :axis-x="lineAxisXBlock" :axis-y="lineAxisYRangeOff" :target="['visits', 'signups']" show-points title="x.line only (block x-axis)" />
    <LineChart :data="data" :axis-x="axisXBottom" :axis-y="lineAxisYRange" :target="['visits', 'signups']" show-points title="y.line only (range y-axis)" />
    <LineChart :data="data" :axis-x="lineAxisXBlock" :axis-y="lineAxisYRange" :target="['visits', 'signups']" show-points title="x.line + y.line together" />
    <LineChart
      :data="data"
      :axis-x="lineAxisXBlock"
      :axis-y="lineAxisYRangeOff"
      :target="['visits', 'signups']"
      show-points
      :show-grid="false"
      title="x.line only, show-grid=false (per-axis line still wins)"
    />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
