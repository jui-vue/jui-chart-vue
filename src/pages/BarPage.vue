<script setup lang="ts">
// Reproduces jui-chart/examples/bar.html exactly: same data, same axis config (x=block over
// "quarter" with `line:true`, y=range over a function domain returning [sales,profit] with
// step:3, orient:"right", also `line:true`), same target/title. The original renders a "column"
// brush (type:"column") - BarChart's default orient is "column" too. `axis.x.line`/`axis.y.line`
// are now ported (see PORT_STATUS.md) and reproduced here. The original's `event: {click: fn}`
// (per-element click forwarding) is also now reproduced below via `BarChart`'s new `@click`
// emit (a Phase A proof-of-concept, see PORT_STATUS.md - not yet ported for every component).
// Not reproduced: the `widget: [{type:"tooltip", format: ...}]` chart-level tooltip widget (this
// port's hover tooltip is a per-component prop, not a chart-level widget registry - out of scope,
// see README's "What wasn't ported" architecture notes).
import { ref } from 'vue'
import BarChart from '../components/BarChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { quarter: '1Q', sales: 1, profit: 3 },
  { quarter: '2Q', sales: 3, profit: 2 },
  { quarter: '3Q', sales: 10, profit: 1 },
  { quarter: '4Q', sales: 0.49, profit: 4 },
]

const axisX: AxisConfig = { type: 'block', domain: 'quarter', line: true }
const axisY: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3, orient: 'right', line: true }

// bar.html's `event: { click: function(obj, e) { console.log(obj, e); } }`, reproduced via
// BarChart's new `@click` emit - logged here (visibly, so it's Playwright-verifiable) instead of
// only `console.log`.
const lastClick = ref<ChartElementEventPayload | null>(null)
function onBarClick(payload: ChartElementEventPayload) {
  lastClick.value = payload
  console.log(payload)
}

// Same series as horizontal bars: axis roles swap (x becomes value/range, y becomes category/block).
const axisXBar: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
const axisYBar: AxisConfig = { type: 'block', domain: 'quarter' }

// `display` demo data: distinct max/min per target so both labels are visible without ties.
const displayData: DataRow[] = [
  { quarter: '1Q', sales: 4, profit: 7 },
  { quarter: '2Q', sales: 9, profit: 2 },
  { quarter: '3Q', sales: 2, profit: 5 },
  { quarter: '4Q', sales: 6, profit: 8 },
]
const axisXDisplay: AxisConfig = { type: 'block', domain: 'quarter' }
const axisYDisplay: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
// The persistent `display` label sits above its bar, which can run past the plot area's top edge
// for the tallest bar (the pie/donut outside-label clipping bug found during the MVP pilot, same
// root cause: an <svg> root clips content outside its viewBox by default) - a larger top padding
// avoids it, same fix pattern as the axis-orient demo's explicit padding overrides.
const displayPadding = { top: 44, right: 24, bottom: 32, left: 48 }

// `active`/`activeEvent` demo data - reuse `displayData`'s shape (4 quarters x [sales, profit])
// so the flat, row-major bar index is easy to reason about: index = row*2 + targetIndex, e.g.
// index 2 = "2Q" sales (the tallest bar in `displayData`, value 9).
const axisXActive: AxisConfig = { type: 'block', domain: 'quarter' }
const axisYActive: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
const axisXActiveBar: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
const axisYActiveBar: AxisConfig = { type: 'block', domain: 'quarter' }

// `stacked` demo data - quarterly sales by 3 product categories, chosen so every row's stack
// total is distinct (no ties) and every segment is easy to hand-verify against the rendered
// gridlines: 1Q=20 (10+6+4), 2Q=16 (5+9+2), 3Q=22 (8+4+10, the max), 4Q=15 (3+7+5, the min).
const stackedData: DataRow[] = [
  { quarter: '1Q', electronics: 10, apparel: 6, grocery: 4 },
  { quarter: '2Q', electronics: 5, apparel: 9, grocery: 2 },
  { quarter: '3Q', electronics: 8, apparel: 4, grocery: 10 },
  { quarter: '4Q', electronics: 3, apparel: 7, grocery: 5 },
]
const stackedTargets = ['electronics', 'apparel', 'grocery']

const axisXStackedCol: AxisConfig = { type: 'block', domain: 'quarter' }
// `stacked` needs a y-domain wide enough for the CUMULATIVE sum (max 22), not each target's own
// range - same pattern as LinePage's/AreaPage's own `axisYStacked` (a single-number domain fn so
// the axis auto-expands to cover it).
const axisYStackedCol: AxisConfig = { type: 'range', domain: (d) => d.electronics + d.apparel + d.grocery, step: 5 }
const axisXStackedBar: AxisConfig = { type: 'range', domain: (d) => d.electronics + d.apparel + d.grocery, step: 5 }
const axisYStackedBar: AxisConfig = { type: 'block', domain: 'quarter' }
const stackedPadding = { top: 44, right: 28, bottom: 32, left: 48 }

// `normalize` (fullstackbar.js/fullstackcolumn.js) demo data - deliberately wildly different row
// totals (17, 450, 55, 1) so normalization is visually obvious: every row must render as a
// full-height/full-width 100% bar regardless of that huge magnitude spread, with segment
// proportions still matching each row's own raw data ratios.
const normalizeData: DataRow[] = [
  { quarter: '1Q', electronics: 2, apparel: 15, grocery: 0 }, // sum 17
  { quarter: '2Q', electronics: 100, apparel: 300, grocery: 50 }, // sum 450
  { quarter: '3Q', electronics: 20, apparel: 30, grocery: 5 }, // sum 55
  { quarter: '4Q', electronics: 0, apparel: 0, grocery: 1 }, // sum 1
]
// Value axis stays in absolute units, fixed to [0, 100] - matching both original demos'
// `domain: [0, 100]` convention (this port's `RangeAxisConfig.domain` is field/function-derived,
// not a literal array, so a constant-0 domain function + explicit `min`/`max` produces the same
// fixed [0,100] domain). `normalize`'s own bar/segment geometry ignores this domain entirely (see
// `BarChart.vue`'s header comment) - it only matters for the percent *text* label's scaling
// (`computeStackPercent`, which is only a true 0-100 percentage because this domain's max is
// configured as 100). Axis tick-label formatting (the original demos' own `format: v => v+"%"`)
// isn't part of this port's `AxisConfig` at all (a pre-existing, unrelated gap - this port has no
// axis tick formatter anywhere yet, not something this item introduces or needs to fix) - ticks
// render as plain `0`-`100` numbers here instead.
const axisXNormalizeCol: AxisConfig = { type: 'block', domain: 'quarter' }
const axisYNormalizeCol: AxisConfig = { type: 'range', domain: () => 0, min: 0, max: 100, step: 10 }
const axisXNormalizeBar: AxisConfig = { type: 'range', domain: () => 0, min: 0, max: 100, step: 10 }
const axisYNormalizeBar: AxisConfig = { type: 'block', domain: 'quarter' }

// `equalizer` (equalizerbar.js/equalizercolumn.js) demo data - audio-level-style values (clear,
// widely-spaced magnitudes per target) so the discrete block train reads unambiguously, unlike
// `stackedData`'s more modest values above. `innerPadding`/`equalizerUnit` are both overridden
// from their defaults (1/1) - the defaults alone produce a `unit = band / (1*1) = band`-sized
// block (~one full tick's pixel span), which renders as one giant "block" indistinguishable from a
// plain stacked rect; bumping both makes the block/gap structure clearly visible.
const equalizerData: DataRow[] = [
  { channel: 'L', bass: 14, mid: 9, treble: 5 },
  { channel: 'R', bass: 8.3, mid: 16, treble: 3 },
  { channel: 'C', bass: 4, mid: 6, treble: 12 },
]
const equalizerTargets = ['bass', 'mid', 'treble']
const axisXEqualizerCol: AxisConfig = { type: 'block', domain: 'channel' }
const axisYEqualizerCol: AxisConfig = { type: 'range', domain: (d) => d.bass + d.mid + d.treble, step: 5 }
const axisXEqualizerBar: AxisConfig = { type: 'range', domain: (d) => d.bass + d.mid + d.treble, step: 5 }
const axisYEqualizerBar: AxisConfig = { type: 'block', domain: 'channel' }
// A reversed value axis - proves the source's own whole-group `translate` correction (ported into
// this component's block `x`/`y` formula directly - see `BarChart.vue`'s header comment) is
// actually applied in the right direction, not just for the common non-reversed case.
const axisYEqualizerColReversed: AxisConfig = { type: 'range', domain: (d) => d.bass + d.mid + d.treble, step: 5, reverse: true }
</script>

<template>
  <div>
    <h2>examples/bar.html</h2>
    <p class="desc">
      Original config: <code>axis.x = {type:"block", domain:"quarter", line:true}</code>,
      <code>axis.y = {type:"range", domain: d => [d.sales, d.profit], step:3, line:true}</code>,
      <code>brush = [{type:"column", target:["sales","profit"]}]</code>, plus a title widget, a tooltip widget with a
      custom <code>format</code>, and <code>event: {click: fn}</code> (click a bar below to see its forwarded payload).
    </p>

    <BarChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['sales', 'profit']" orient="column" title="hihi" @click="onBarClick" />
    <p class="desc" data-testid="last-click">
      Last click payload: <code v-if="lastClick">dataIndex={{ lastClick.dataIndex }}, dataKey="{{ lastClick.dataKey }}", data={{ JSON.stringify(lastClick.data) }}</code>
      <code v-else>(none yet - click a bar)</code>
    </p>

    <h3>Same data, as horizontal bars</h3>
    <p class="desc">Same series, <code>orient="bar"</code> - axis roles swap (x becomes the value/range axis, y the category/block axis).</p>
    <BarChart :data="data" :axis-x="axisXBar" :axis-y="axisYBar" :target="['sales', 'profit']" orient="bar" />

    <h3>display: "max" | "min" | "all"</h3>
    <p class="desc">
      Ported from <code>bar.js</code>'s <code>display</code> option: a persistent value label on the bar(s) holding each target's max value
      (<code>"max"</code>), min value (<code>"min"</code>), or every bar (<code>"all"</code>) - independent of hover.
    </p>
    <BarChart :data="displayData" :axis-x="axisXDisplay" :axis-y="axisYDisplay" :target="['sales', 'profit']" orient="column" display="max" :padding="displayPadding" />
    <BarChart :data="displayData" :axis-x="axisXDisplay" :axis-y="axisYDisplay" :target="['sales', 'profit']" orient="column" display="min" :padding="displayPadding" />
    <BarChart :data="displayData" :axis-x="axisXDisplay" :axis-y="axisYDisplay" :target="['sales', 'profit']" orient="column" display="all" :padding="displayPadding" />

    <h3>active / activeEvent</h3>
    <p class="desc">
      Ported from <code>bar.js</code>'s <code>active</code> (a flat, row-major bar <em>index</em> - unlike pie/donut/line's series-name
      <code>active</code>) and <code>activeEvent</code>: the active bar stays at full opacity while every other bar dims to
      <code>theme('barDisableBackgroundOpacity')</code>, and a value-only tooltip appears at its position.
    </p>
    <p class="desc">
      Static <code>:active="2"</code> (column orient) - index 2 is "2Q" sales, the tallest bar.
    </p>
    <BarChart :data="displayData" :axis-x="axisXActive" :axis-y="axisYActive" :target="['sales', 'profit']" orient="column" :active="2" />

    <p class="desc">
      <code>active-event="click"</code> (bar orient) - click a bar to make it the active one; ported literally from <code>bar.js</code>
      with no toggle and no auto-reset on <code>mouseout</code>, so it stays active until another bar is clicked.
    </p>
    <BarChart :data="displayData" :axis-x="axisXActiveBar" :axis-y="axisYActiveBar" :target="['sales', 'profit']" orient="bar" active-event="click" />

    <h3>stacked (stackbar.js / stackcolumn.js)</h3>
    <p class="desc">
      Ported from <code>stackbar.js</code>/<code>stackcolumn.js</code> - source-confirmed to be a near-full reimplementation (271/117
      lines), NOT the trivial 1-line <code>draw()</code> wrapper <code>stackarea.js</code>/<code>stackline.js</code>/<code>stackscatter.js</code>
      turned out to be (see <code>BarChart.vue</code>'s header comment). Segments stack cumulatively along the value axis with no gap
      between them (target order = stacking order) and render as plain, unrounded rects (unlike grouped bars' rounded corners).
      <code>display</code>/<code>active</code>/<code>activeEvent</code> operate on each row's <em>stack total</em>, not a single segment -
      a real behavioral difference from grouped mode, ported faithfully from the source.
    </p>
    <p class="desc">Same data (quarterly sales x 3 product categories), non-stacked (grouped) vs. stacked, column orientation.</p>
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" title="non-stacked" />
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked title="stacked" />

    <p class="desc">Same data, stacked, horizontal (<code>orient="bar"</code>) - axis roles swap, same as the non-stacked `orient="bar"` demo above.</p>
    <BarChart :data="stackedData" :axis-x="axisXStackedBar" :axis-y="axisYStackedBar" :target="stackedTargets" orient="bar" stacked title="stacked (bar)" />

    <p class="desc">
      <code>display="max"|"min"|"all"</code>, stacked: the label now shows each row's <em>stack total</em> (e.g. 3Q = 22, the max; 4Q = 15,
      the min), not any single category's value.
    </p>
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked display="max" :padding="stackedPadding" />
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked display="min" :padding="stackedPadding" />
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked display="all" :padding="stackedPadding" />

    <p class="desc">
      <code>active</code>/<code>activeEvent</code>, stacked: the index now addresses a whole <em>row</em> (its 3 segments dim/highlight
      together), not a single segment. Static <code>:active="2"</code> highlights 3Q's whole stack; <code>active-event="click"</code>
      lets you click any segment in a row to make that row active.
    </p>
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked :active="2" :padding="stackedPadding" />
    <BarChart :data="stackedData" :axis-x="axisXStackedCol" :axis-y="axisYStackedCol" :target="stackedTargets" orient="column" stacked active-event="click" :padding="stackedPadding" />

    <h3>normalize / 100% stacked (fullstackbar.js / fullstackcolumn.js)</h3>
    <p class="desc">
      Ported from <code>fullstackbar.js</code>/<code>fullstackcolumn.js</code> - source-confirmed a real reimplementation of
      <code>draw()</code> on top of <code>stackbar.js</code>'s inherited helpers (<code>getBarElement</code>/<code>setActiveEffect</code>/
      <code>setActiveEventOption</code>/<code>getTargetSize</code>), NOT a thin percent-scaling wrapper. Each row's stack always spans the
      full plot width/height regardless of its raw total - the rows below have wildly different sums (17, 450, 55, 1) yet every one renders
      as a full 100% bar, with segment widths/heights still proportional to that row's own raw data ratios. The value axis's domain has zero
      effect on this geometry (only the percent text label's scaling) - see <code>BarChart.vue</code>'s header comment for the full
      derivation. <code>display</code> has no effect in this mode (unwired upstream); <code>active</code>/<code>activeEvent</code> behave
      identically to <code>stacked</code>'s own row-level semantics.
    </p>
    <p class="desc"><code>showText</code> renders a percent label per segment - column chart uses a custom formatter (<code>p =&gt; p + "%%"</code>,
      matching <code>fullstackcolumn.html</code>'s own demo config), bar chart uses the default <code>showText: true</code> (matching
      <code>fullstackbar.html</code>'s own config).</p>
    <BarChart :data="normalizeData" :axis-x="axisXNormalizeCol" :axis-y="axisYNormalizeCol" :target="stackedTargets" orient="column" stacked normalize :show-text="(p: number) => `${p}%%`" title="normalize (column)" />
    <BarChart :data="normalizeData" :axis-x="axisXNormalizeBar" :axis-y="axisYNormalizeBar" :target="stackedTargets" orient="bar" stacked normalize :show-text="true" title="normalize (bar)" />

    <p class="desc">
      <code>active</code>/<code>activeEvent</code> still work row-scoped, exactly like <code>stacked</code> - but the row-total tooltip
      (<code>display</code>) never appears here, since <code>fullstackbar.js</code> never initializes it upstream.
    </p>
    <BarChart :data="normalizeData" :axis-x="axisXNormalizeCol" :axis-y="axisYNormalizeCol" :target="stackedTargets" orient="column" stacked normalize :active="1" title="normalize, active=1" />

    <h3>equalizer (equalizerbar.js / equalizercolumn.js)</h3>
    <p class="desc">
      Source-confirmed: both <code>extend: "chart.brush.stackbar"</code>/<code>"chart.brush.stackcolumn"</code> (NOT the separate,
      unrelated <code>equalizer.js</code> - see the <code>/equalizer</code> page for that one), reusing inherited
      <code>getBarElement</code>/<code>getTargetSize</code> but completely overriding <code>draw()</code>. Each stacked segment
      renders as a train of small blocks (<code>unit = band / (equalizerUnit * innerPadding)</code>px each, separated by an
      <code>innerPadding</code>px gap) instead of one continuous rect - block color stays uniform per target (no per-block
      banding, unlike <code>equalizer.js</code>). <code>innerPadding=4</code>/<code>equalizer-unit=3</code> below (bumped from the
      defaults of 1/1, which would produce one giant ~one-tick-wide block).
    </p>
    <BarChart :data="equalizerData" :axis-x="axisXEqualizerCol" :axis-y="axisYEqualizerCol" :target="equalizerTargets" orient="column" stacked equalizer :inner-padding="4" :equalizer-unit="3" title="equalizer (column)" />

    <p class="desc">Same data, horizontal (<code>orient="bar"</code>) - axis roles swap, blocks now train left-to-right.</p>
    <BarChart :data="equalizerData" :axis-x="axisXEqualizerBar" :axis-y="axisYEqualizerBar" :target="equalizerTargets" orient="bar" stacked equalizer :inner-padding="4" :equalizer-unit="3" title="equalizer (bar)" />

    <p class="desc">
      Same data/config, but <code>axis.y.reverse</code> - proves the source's own whole-group <code>translate</code> correction
      (ported directly into this component's block position formula) is applied for the reversed-axis direction too, not just
      the common non-reversed case.
    </p>
    <BarChart :data="equalizerData" :axis-x="axisXEqualizerCol" :axis-y="axisYEqualizerColReversed" :target="equalizerTargets" orient="column" stacked equalizer :inner-padding="4" :equalizer-unit="3" title="equalizer (column, reversed y)" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
