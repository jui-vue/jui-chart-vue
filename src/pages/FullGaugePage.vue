<script setup lang="ts">
// Ported (config shape) from jui-chart/examples/fullgauge.html, plus hand-built demos covering
// edge cases confirmed from source - see FullGaugeChart.vue's header comment: `extend:
// 'chart.brush.donut'`, a radial progress ring (background track + foreground value arc), not a
// linear bar despite BarGaugeChart's similarly-named sibling being something else entirely.
import FullGaugeChart from '../components/FullGaugeChart.vue'
import type { DataRow } from '../types'

// Reproduces fullgauge.html's config: { title: "Overall Visits", value: 140, max: 200, min: 0 },
// symbol="round", startAngle=270, size=20, titleY=30, showText=true, format=v=>`${v}k`.
// **Not reproduced**: the example's chart-level `style: { gaugeFontSize: 30 }` theme override -
// this port's theme is a fixed classic/dark palette selected via the `theme` prop, not a
// per-instance token override, matching every other component here (none support ad-hoc theme
// overrides either).
// Hand-computed (width=height=300): w=150, outerRadius=130, innerRadius=110,
// textScale=scaleValue(150,40,400,1,1.5)=1.152777..., rate=140/200=0.7,
// currentAngle=0.7*359.99999=251.999993, paddingAngle=0 (symbol="round"), foreground arc
// [270, 270+251.999993], background arc starts at 270+251.999993=521.999993 sweeping
// 359.99999-251.999993=107.999997.
const overallVisits: DataRow = { title: 'Overall Visits', value: 140, max: 200, min: 0 }
function kFormat(value: number): string {
  return `${value}k`
}

// CPU usage as a bottom semicircle: startAngle=180, endAngle=180 (a 180deg configured range, not
// a full circle). value=72 of [0,100], symbol="butt" (default) so the paddingAngle gap applies.
// Hand-computed (width=height=260, size=24): w=130, outerRadius=106, innerRadius=82,
// textScale=scaleValue(130,40,400,1,1.5)=1.125, rate=0.72, currentAngle=0.72*180=129.6 (under the
// 180 ceiling, no clamp), paddingAngle=2 (theme default), foreground [180, 309.6], background
// [180+129.6+2, ...] = [311.6, 311.6+46.4] (sweep = 180-129.6-4 = 46.4).
// titleY=26 offsets the title below the value label (default titleX/titleY=0 would overlap the
// two labels exactly - the original leaves this to the caller too, see fullgauge.html's own
// titleY=30, which this page's first demo already mirrors).
const cpuUsage: DataRow = { title: 'CPU', value: 72, max: 100, min: 0 }
function percentFormat(value: number): string {
  return `${value}%`
}

// Nonzero-min KPI attainment, full circle, symbol="round" (paddingAngle=0).
// Hand-computed (width=height=240, size=30): w=120, outerRadius=90, innerRadius=60,
// textScale=scaleValue(120,40,400,1,1.5)=1.111111..., rate=(110-50)/(150-50)=0.6,
// currentAngle=0.6*359.99999=215.999994, foreground [0, 215.999994], background
// [215.999994, 215.999994+143.999996] (sweep = 359.99999-215.999994-0 = 143.999996).
const quotaAttainment: DataRow = { title: 'Quota Attainment', value: 110, max: 150, min: 50 }

// Edge case 1: value clamped at/above max (rate > 1) - `fullGaugeCurrentAngle` clamps to
// `endAngle`, so the value arc fills the ENTIRE configured 270deg range, leaving the background
// track's own sweep computation negative (270 - 270 - paddingAngle*2 = -4, since symbol="butt" ->
// paddingAngle=2) - a confirmed, unclamped upstream edge case (no `Math.max(0, ...)` in the
// source), included here specifically to Playwright-verify what a negative sweep angle actually
// renders as (still a valid, if degenerate, arc `d` - see donutSlicePath), not a crash.
const overCapacity: DataRow = { title: 'Over capacity', value: 140, max: 100, min: 0 }

// Edge case 2: value below min (rate < 0) - `fullGaugeCurrentAngle` is NOT lower-clamped, so
// `currentAngle` goes negative (-107.999997), which pushes the background track's OWN sweep past
// 360deg (467.999987) - large enough that `donutSlicePath`'s own internal `>=360 -> 359.9999`
// clamp (a full circle can't be drawn as a single arc) kicks in on top of `fullGaugeEndAngleLimit`
// having already clamped the *configured* endAngle - two independent, stacked safety clamps at
// two different layers, both exercised by this one demo. Also note (Playwright-confirmed): a
// negative FOREGROUND sweep here means `donutSlicePath`'s hardcoded SVG sweep-flag (`1`, always)
// combined with `largeArc = sweep > 180 ? 1 : 0` evaluated on the *raw negative* angle can select
// a visually counter-intuitive arc (the majority of the ring, not a small sliver) - confirmed an
// exact match to `drawDonut()`'s own identical, equally unguarded `(endAngle > 180) ? 1 : 0` +
// hardcoded sweep-flag `1`, i.e. this port reproduces upstream's own behavior for this edge case
// byte-for-byte, not a rendering bug introduced here.
const belowMin: DataRow = { title: 'Below minimum', value: 20, max: 150, min: 50 }
</script>

<template>
  <div>
    <h2>fullgauge.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: 'chart.brush.donut'</code> - reuses <code>DonutBrush.drawDonut()</code> directly (same stroked-arc math
      <code>DonutChart</code> already ports as <code>donutSlicePath()</code>). A radial progress RING: a background track arc plus a foreground
      value arc whose sweep is proportional to <code>(value-min)/(max-min)</code> of the configured <code>[startAngle, startAngle+endAngle]</code>
      range. No threshold bands, no needle/pointer - confirmed absent from source.
    </p>
    <h3>Reproduces fullgauge.html</h3>
    <FullGaugeChart :data="overallVisits" :width="300" :height="300" symbol="round" :start-angle="270" :size="20" :title-y="30" :format="kFormat" />

    <h3>Configured sub-range (180deg "semicircle" gauge)</h3>
    <p class="desc"><code>startAngle=180 endAngle=180</code> - the configured range is only half a circle, not a full one.</p>
    <FullGaugeChart :data="cpuUsage" :width="260" :height="260" :start-angle="180" :end-angle="180" :size="24" :title-y="26" :format="percentFormat" />

    <h3>Nonzero <code>min</code> (a real baseline offset here - unlike BarGaugeChart's quirk)</h3>
    <p class="desc">value=110 of [50,150] -&gt; rate=0.6, a real 60%-of-range fill (contrast with <code>/bargauge</code>'s divisor-only <code>min</code>).</p>
    <FullGaugeChart :data="quotaAttainment" :width="240" :height="240" symbol="round" :size="30" :title-y="22" />

    <h3>Edge case: value at/above max (clamped fill, negative background sweep)</h3>
    <p class="desc">
      value=140 against max=100 clamps the value arc to the FULL configured 270deg range - the background track's own sweep computation then goes
      negative (<code>270 - 270 - 2*2 = -4</code>), an unclamped upstream edge case, ported as-is.
    </p>
    <FullGaugeChart :data="overCapacity" :width="220" :height="220" :end-angle="270" :size="20" :title-y="20" />

    <h3>Edge case: value below min (negative rate, background sweep past 360deg)</h3>
    <p class="desc">value=20 against [50,150] -&gt; rate=-0.3, a negative currentAngle, pushing the background arc's own sweep past 360deg - exercises <code>donutSlicePath</code>'s own internal clamp.</p>
    <FullGaugeChart :data="belowMin" :width="220" :height="220" symbol="round" :size="25" :title-y="20" />

    <h3><code>showText=false</code>, no title, and the port-only chart heading</h3>
    <FullGaugeChart :data="{ value: 55, max: 100, min: 0 }" :width="200" :height="200" :show-text="false" title="No inner labels" />

    <h3>Dark theme</h3>
    <FullGaugeChart :data="overallVisits" :width="300" :height="300" symbol="round" :start-angle="270" :size="20" :title-y="30" :format="kFormat" theme="dark" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
