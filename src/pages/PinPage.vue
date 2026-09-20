<script setup lang="ts">
// pin.js: a single reference marker at one x-axis position - a full-height vertical line, a small
// downward-pointing triangle "flag" near the top, and an optional label (only rendered when
// `format` is provided - see `PinChart.vue`'s header comment). No per-data-point looping, no
// interaction/events (confirmed absent from the whole 69-line source).
import PinChart from '../components/PinChart.vue'
import type { AxisConfig, DataRow } from '../types'

// Demo A: block x-axis - split is a DATA INDEX (matches pin.js's own config comment).
const monthlyData: DataRow[] = [
  { month: 'Jan', sales: 42 },
  { month: 'Feb', sales: 58 },
  { month: 'Mar', sales: 71 },
  { month: 'Apr', sales: 65 },
  { month: 'May', sales: 80 },
  { month: 'Jun', sales: 74 },
]
const monthAxisX: AxisConfig = { type: 'block', domain: 'month' }
const monthAxisY: AxisConfig = { type: 'range', domain: 'sales' }

// Demo B: range (numeric) x-axis - split is a raw DOMAIN VALUE, not an index. Explicit min/max so
// the "nice domain" algorithm doesn't perturb the bounds (see `SelectBoxPage.vue` for the same
// hand-verification-friendly pattern).
const dayData: DataRow[] = Array.from({ length: 11 }, (_, day) => ({ day, reading: 50 + day * 2 }))
const dayAxisX: AxisConfig = { type: 'range', domain: 'day', min: 0, max: 10 }
const dayAxisY: AxisConfig = { type: 'range', domain: 'reading' }

function monthLabel(index: number): string {
  return monthlyData[index]?.month ?? `#${index}`
}

function dayLabel(value: number): string {
  return `Day ${value}`
}
</script>

<template>
  <div>
    <h2>pin.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly. One marker at ONE x-axis position (<code>split</code>, default
      <code>0</code>) - a full plot-height vertical line, a small triangle flag near the top, and an optional label above it. No per-element
      events exist upstream (checked all 69 lines).
    </p>

    <h3>Block x-axis: <code>split</code> is a data INDEX</h3>
    <p class="desc">
      <code>format</code> receives <code>axis.x.invert(d)</code>, which for a block axis is the (floored) domain INDEX, not the category label -
      confirmed from `OrdinalScale.invert()`'s source-ported formula. This demo's <code>format</code> looks the index back up in
      <code>monthlyData</code> to show the real label.
    </p>
    <PinChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :split="2" :format="monthLabel" title="Marking March" data-testid="pin-block" />

    <h3>Same chart, <code>format</code> shown WITHOUT the lookup (the raw index quirk, undisguised)</h3>
    <PinChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :split="2" :format="(i: number) => String(i)" data-testid="pin-block-raw-index" />

    <h3>Range x-axis: <code>split</code> is a raw domain VALUE</h3>
    <p class="desc">Here `axis.x.invert(d)` round-trips back to (approximately) the raw numeric value passed as `split`, not an index.</p>
    <PinChart :data="dayData" :axis-x="dayAxisX" :axis-y="dayAxisY" :split="7" :format="dayLabel" title="Day 7 marker" data-testid="pin-range" />

    <h3>Out-of-domain <code>split</code>: the label shows the CLAMPED value, not the raw input</h3>
    <p class="desc">
      <code>split=15</code> against a `[0,10]` domain: `d = axis.x(15)` clamps to the domain-max pixel (default `clamp: true`), then
      <code>axis.x.invert(d)</code> recovers `10` (the clamped value) - not `15`. The pin itself renders pinned to the chart's right edge.
    </p>
    <PinChart :data="dayData" :axis-x="dayAxisX" :axis-y="dayAxisY" :split="15" :format="dayLabel" data-testid="pin-clamped" />

    <h3>No <code>format</code>: the label is hidden entirely (not just empty)</h3>
    <PinChart :data="dayData" :axis-x="dayAxisX" :axis-y="dayAxisY" :split="3" data-testid="pin-no-format" />

    <h3>Custom <code>size</code>, dark theme</h3>
    <PinChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :split="4" :size="14" :format="monthLabel" theme="dark" title="Marking May" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
