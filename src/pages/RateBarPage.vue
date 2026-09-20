<script setup lang="ts">
// ratebar.js has no shipped example in jui-chart/examples/ - hand-built. `extend: "chart.brush.core"`
// directly (see RateBarChart.vue's own header comment) - only one orientation exists (x=range,
// y=block), so every demo below configures the axes that way.
import { ref } from 'vue'
import RateBarChart from '../components/RateBarChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

// Primary demo: storage usage per volume, broken into system/apps/media/free - each row's values
// deliberately sum to exactly 100 so the rendered percent labels double as a sanity check (their
// sum per row should read 100%). Several rows have at least one target at 0 (system=0 for /cache,
// apps=0 for /backup and /logs, media=0 for /cache and /logs) - these are skipped entirely (no
// zero-width segment), which also shifts which segment is "first"/"last" (and thus rounded) per
// row: /cache's first visible segment is "apps", not "system".
const storageData: DataRow[] = [
  { volume: '/data', system: 8, apps: 22, media: 55, free: 15 },
  { volume: '/backup', system: 2, apps: 0, media: 88, free: 10 },
  { volume: '/cache', system: 0, apps: 40, media: 0, free: 60 },
  { volume: '/logs', system: 95, apps: 0, media: 0, free: 5 },
]
const storageTargets = ['system', 'apps', 'media', 'free']
// x=range (value axis, always [0,100] here so the percent label is a true percentage), y=block
// (category axis, one row per volume) - the only orientation ratebar.js supports.
const axisXStorage: AxisConfig = { type: 'range', domain: () => 0, min: 0, max: 100, step: 20 }
const axisYStorage: AxisConfig = { type: 'block', domain: 'volume' }

// Second demo: sales pipeline value ($k) per rep, split into closed/committed/pipeline stages -
// deliberately wildly different row sums (160, 180, 25, 300) to prove the source's own geometry
// claim: every row's bar still spans the FULL plot width regardless of its raw total (same
// "normalize"-style property as fullstackbar.js's own demo - see BarChart.vue's `/bar` page). The
// x-axis domain is still fixed [0,100], so - unlike the "domain max coupling" demo further down -
// these percent labels ARE true percentages of each rep's own total, independent of that total's
// magnitude.
const pipelineData: DataRow[] = [
  { rep: 'Alice', closed: 120, committed: 40, pipeline: 0 },
  { rep: 'Bob', closed: 30, committed: 90, pipeline: 60 },
  { rep: 'Cara', closed: 0, committed: 20, pipeline: 5 },
  { rep: 'Dee', closed: 75, committed: 75, pipeline: 150 },
]
const pipelineTargets = ['closed', 'committed', 'pipeline']
const axisXPipeline: AxisConfig = { type: 'range', domain: () => 0, min: 0, max: 100, step: 20 }
const axisYPipeline: AxisConfig = { type: 'block', domain: 'rep' }

// Third demo: the x-axis's configured domain max only produces a TRUE 0-100 percentage label when
// it's 100 - here max=4, so a:1 (1/4 of the row) reads "1%", not "25%", and b:3 reads "3%", not
// "75%" - the exact same coupling `fullstackbar.js`'s `normalize` mode has (`computeStackPercent`),
// re-derived here for `ratebar.js`'s own `axis.x.rate`/`axis.x.max()` call. Segment WIDTHS are
// unaffected (still exactly 25%/75% of the plot width) - only the printed percent text is "wrong"
// relative to the row's actual proportions.
const domainMaxData: DataRow[] = [{ row: 'r1', a: 1, b: 3 }]
const domainMaxTargets = ['a', 'b']
const axisXDomainMax: AxisConfig = { type: 'range', domain: () => 0, min: 0, max: 4, step: 1 }
const axisYDomainMax: AxisConfig = { type: 'block', domain: 'row' }

// Fourth demo: `active`/`activeTarget` (static) and `activeEvent="click"` (dynamic) - both using
// pipelineData so the row-scoped-only dimming (see RateBarChart.vue's header comment on
// `setActiveBarElement`) is easy to hand-verify: Bob's `committed` segment should stay full
// opacity, Bob's `closed`/`pipeline` segments should dim, and Alice/Cara/Dee should be completely
// unaffected (still full opacity) despite none of them being "active".
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}

// Fifth demo: the flag-callout tooltip only renders when its (real, measured) text width fits
// inside the segment - Erin's `closed` segment (2 of a 500 total = 0.4% of the row, a few px wide)
// is far too narrow for any tooltip text and should render no flag at all, while her `committed`
// segment (98% of the row) easily fits even a long custom-formatted string.
const tooltipFitData: DataRow[] = [{ rep: 'Erin', closed: 2, committed: 490, pipeline: 8 }]
function longTooltip(value: number): string {
  return `${value}k in this stage`
}
</script>

<template>
  <div>
    <h2>ratebar.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - shares NO code with <code>bar.js</code>/<code>stackbar.js</code>/
      <code>fullstackbar.js</code>. Each ROW renders as one pill-shaped bar split into contiguous colored segments, one per target whose value
      is <code>&gt; 0</code> (a zero/negative value's target is skipped entirely) - each segment's width is that key's share of the ROW's OWN
      total, so every row always fills the full plot width regardless of its raw sum (no separate background "track" - the segments themselves
      sum to 100%). Only the leftmost/rightmost nonzero segment gets a rounded pill end; interior boundaries are square and contiguous. A
      percent-or-custom label sits centered in every segment (<code>showText</code> is a formatter, not a toggle - the label always renders),
      and a small dashed-line "flag" tooltip floats above each segment showing its raw value, only when it actually fits the segment's width.
    </p>
    <RateBarChart :data="storageData" :axis-x="axisXStorage" :axis-y="axisYStorage" :target="storageTargets" title="Storage usage per volume (%)" />

    <h3>Wildly different row totals still fill 100% of the width</h3>
    <p class="desc">
      Row sums here are 160 / 180 / 25 / 300 ($k) - yet every rep's bar spans the identical full plot width, proportioned only by that rep's
      own closed/committed/pipeline split.
    </p>
    <RateBarChart :data="pipelineData" :axis-x="axisXPipeline" :axis-y="axisYPipeline" :target="pipelineTargets" title="Pipeline value per rep ($k)" />

    <h3>Percent label's domain-max coupling</h3>
    <p class="desc">
      x-axis <code>max=4</code> here (not 100): segment <strong>widths</strong> are still exactly 25%/75%, but the printed percent labels read
      "1%"/"3%" (<code>Math.round((value/sum)*axis.x.max())</code>) - only a true 0-100 percentage when the axis's own domain max is 100, same
      coupling as <code>fullstackbar.js</code>'s <code>normalize</code> mode (see <code>/bar</code>).
    </p>
    <RateBarChart :data="domainMaxData" :axis-x="axisXDomainMax" :axis-y="axisYDomainMax" :target="domainMaxTargets" :height="120" title="domain max = 4" />

    <h3><code>active</code> / <code>activeEvent</code> - row-scoped, not whole-chart</h3>
    <p class="desc">
      Source-confirmed from <code>setActiveBarElement()</code>: dimming only ever applies to a segment in the SAME row as the active index whose
      key differs from the active target - every OTHER row stays at full opacity. Below, Bob's <code>committed</code> segment is active - Bob's
      other two segments dim, but Alice/Cara/Dee are completely unaffected.
    </p>
    <RateBarChart :data="pipelineData" :axis-x="axisXPipeline" :axis-y="axisYPipeline" :target="pipelineTargets" :active-index="1" active-target="committed" title="active-index=1 active-target=committed" />
    <p class="desc">Click any segment below - <code>activeEvent=&quot;click&quot;</code> overwrites the active pair with no toggle/reset.</p>
    <RateBarChart :data="pipelineData" :axis-x="axisXPipeline" :axis-y="axisYPipeline" :target="pipelineTargets" active-event="click" title="activeEvent=click" />

    <h3>Flag tooltip only renders when it fits</h3>
    <p class="desc">
      Erin's <code>closed</code> segment is 2 of a 500 total (0.4% of the row's own width) - far too narrow for any tooltip text, so no flag
      renders there at all, while <code>committed</code> (98%) easily fits the long custom-formatted string below.
    </p>
    <RateBarChart :data="tooltipFitData" :axis-x="axisXPipeline" :axis-y="{ type: 'block', domain: 'rep' }" :target="pipelineTargets" :show-tooltip="longTooltip" :height="140" title="tooltip width fit-check" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>ratebar.js</code>'s unconditional <code>addEvent(g, dataIndex, targetIndex)</code> - once per segment. Hover/click a
      segment below.
    </p>
    <RateBarChart :data="storageData" :axis-x="axisXStorage" :axis-y="axisYStorage" :target="storageTargets" @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-ratebar-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey="{{ lastEvent.payload.dataKey }}" data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <RateBarChart :data="storageData" :axis-x="axisXStorage" :axis-y="axisYStorage" :target="storageTargets" theme="dark" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
