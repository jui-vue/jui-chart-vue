<script setup lang="ts">
// timeline.js: a Gantt-style schedule. See `TimelineChart.vue`'s own header comment for the full
// source-confirmed data model (flat events with `key`/`stime`/`etime`, a "block" y-axis whose
// domain is the lane labels with a conventional header row at index 0, a plain numeric "range"
// x-axis - no date-axis infra needed, unlike `selectbox.js`).
import { ref } from 'vue'
import TimelineChart from '../components/TimelineChart.vue'
import type { AxisConfig, DataRow } from '../types'

// A 30-day project schedule, 4 real lanes + the conventional blank header lane at index 0.
// `stime`/`etime` are day offsets from kickoff - plain numbers, per `TimelineChart.vue`'s header
// comment on the axis-type decision. `domain: ['stime','etime']` folds min/max across BOTH fields
// (see `RangeAxisConfig`'s own array-domain mode) - explicit min/max so the "nice domain" algorithm
// resolves to EXACTLY [0,30] (hand-verification-friendly, same pattern as `PinPage.vue`/
// `SelectBoxPage.vue`'s range-axis demos): with `step` defaulted to `10`, `unit = div(30,10) = 3`,
// producing ticks 0,3,6,...,30 (11 ticks, every 3 days).
const schedule: DataRow[] = [
  { key: 'Design', stime: 0, etime: 6, label: 'Wireframes' },
  { key: 'Design', stime: 6, etime: 10, label: 'Visual design' },
  { key: 'Development', stime: 10, etime: 22, label: 'Build features' },
  { key: 'Development', stime: 22, etime: 26, label: 'Bug fixes' },
  { key: 'Testing', stime: 20, etime: 27, label: 'QA pass' },
  { key: 'Launch', stime: 27, etime: 30, label: 'Release' },
]
const axisX: AxisConfig = { type: 'range', domain: ['stime', 'etime'], min: 0, max: 30 }
const axisY: AxisConfig = { type: 'block', domain: ['', 'Design', 'Development', 'Testing', 'Launch'] }

// Project kickoff: Sep 1, 2026 - purely cosmetic (`xFormat` renders day-offset ticks as dates);
// the axis itself stays a plain numeric "range" axis throughout, see `TimelineChart.vue`'s header
// comment.
const PROJECT_START = new Date(2026, 8, 1)
function dayToDate(day: number): string {
  const d = new Date(PROJECT_START)
  d.setDate(d.getDate() + day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Port-only: a per-event `colors` array standing in for the source's `colors` FUNCTION mode (see
// `TimelineChart.vue`'s header comment on why this port only supports a plain array, matching
// `HeatmapChart.vue`'s established precedent) - colored by lane/task-type here, demonstrating
// "color per event type" without a function prop.
const laneColor: Record<string, string> = { Design: '#7BBAE7', Development: '#FFC000', Testing: '#87BB66', Launch: '#DF328B' }
const typeColors = schedule.map((row) => laneColor[row.key as string] ?? '#999')

function taskLabel(row: DataRow): string {
  return `${row.label} (day ${row.stime}-${row.etime})`
}

const lastActive = ref<{ label: string; stime: number; etime: number } | null>(null)
function onActive(payload: { data: DataRow; event: MouseEvent }) {
  lastActive.value = { label: payload.data.label as string, stime: payload.data.stime as number, etime: payload.data.etime as number }
}

const lastTitle = ref<string | number | null>(null)
</script>

<template>
  <div>
    <h2>timeline.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly (395 lines - Phase C's largest item so far). A flat array of EVENTS
      (not one row per lane) - each reads <code>key</code>/<code>stime</code>/<code>etime</code>; the y-axis is a <code>"block"</code> axis
      whose domain is the lane labels, with index <code>0</code> conventionally a blank HEADER row (the column date labels render inside it).
      See <code>TimelineChart.vue</code>'s header comment for the full source-confirmed model, the axis-type decision (a plain numeric
      <code>"range"</code> x-axis - no date-axis infra needed here, unlike <code>selectbox.js</code>), and the interaction-state derivation.
    </p>

    <h3>Primary demo: <code>activeType="rect"</code> (default) + per-event-type colors</h3>
    <p class="desc">
      Click a bar to highlight its full row band; hover a different bar/row to preview it without disturbing the active selection (both stay
      highlighted at once - see <code>timelineOverlayStyle</code>'s doc comment). The diagonal connector lines link each event to the NEXT one
      in <code>schedule</code>'s array order, including across lanes (Development's last task flows into Testing, which flows into Launch).
    </p>
    <TimelineChart :data="schedule" :axis-x="axisX" :axis-y="axisY" :colors="typeColors" :x-format="dayToDate" :active="0" title="Project schedule" data-testid="timeline-rect" @active="onActive" @title-hover="(p) => (lastTitle = p.key)" />
    <p class="desc" data-testid="timeline-active-log">
      Last activated: <code v-if="lastActive">{{ lastActive.label }} (day {{ lastActive.stime }}-{{ lastActive.etime }})</code> <code v-else>(none yet - row 0 pre-selected via :active="0")</code>
      &nbsp;|&nbsp; Last title hovered: <code>{{ lastTitle ?? '(none yet)' }}</code>
    </p>

    <h3><code>activeType="bar"</code>: the active bar grows to full row height and reveals an <code>activeTooltip</code> label</h3>
    <p class="desc">
      Ported from <code>setActiveBar</code>/<code>setHoverBar</code> - note the hover recolor is a confirmed no-op with the default theme
      (<code>timelineHoverBarBackgroundColor</code> is <code>null</code> in both <code>classic</code>/<code>dark</code> upstream), so only the
      persistent active bar visibly recolors on hover.
    </p>
    <TimelineChart :data="schedule" :axis-x="axisX" :axis-y="axisY" active-type="bar" :active="2" :active-tooltip="taskLabel" :x-format="dayToDate" data-testid="timeline-bar" />

    <h3>Default colors (no <code>colors</code> prop): cycles the theme palette per EVENT index</h3>
    <p class="desc">
      Deliberate deviation from the source's own literal default (a single constant color for every event, <code>theme.colors[0]</code> - see
      <code>TimelineChart.vue</code>'s header comment) - matches this port's established <code>colors?: string[]</code>-with-palette-cycle-
      fallback convention (<code>HeatmapChart.vue</code>'s own precedent for the same upstream shape).
    </p>
    <TimelineChart :data="schedule" :axis-x="axisX" :axis-y="axisY" :x-format="dayToDate" />

    <h3><code>hideTitle</code>: the lane-title column is dropped entirely</h3>
    <TimelineChart :data="schedule" :axis-x="axisX" :axis-y="axisY" :colors="typeColors" :x-format="dayToDate" hide-title data-testid="timeline-hidetitle" />

    <h3>Dark theme</h3>
    <TimelineChart :data="schedule" :axis-x="axisX" :axis-y="axisY" :colors="typeColors" :x-format="dayToDate" theme="dark" title="Dark theme" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 720px;
}
</style>
