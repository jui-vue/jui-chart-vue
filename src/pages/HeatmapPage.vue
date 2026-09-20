<script setup lang="ts">
// heatmap.js: one cell per DATA ROW (no `target` concept), positioned on BOTH axes by looking up a
// row field (`xField`/`yField`) against a block axis - see `HeatmapChart.vue`'s header comment.
// **Color-mapping finding, source-confirmed before writing any demo**: the engine has NO gradient/
// interpolation primitive anywhere (`this.color()` is a flat per-index-or-function palette lookup,
// same as every other brush) - a realistic activity heatmap needs a genuine value->color gradient,
// which doesn't exist upstream, so this demo builds one via the new, port-only `useColorScale.ts`
// (`createColorScale`) and feeds the result into `HeatmapChart`'s existing, un-special-cased
// `colors?: string[]` prop (the same plain-array convention every other component already uses).
import { ref } from 'vue'
import HeatmapChart from '../components/HeatmapChart.vue'
import { createColorScale } from '../composables/useColorScale'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

// Deterministic (not random) 7x8 activity matrix, hand-traceable for Playwright verification -
// rows = day of week, columns = 3-hour time-of-day buckets.
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = ['00', '03', '06', '09', '12', '15', '18', '21']

const activityMatrix = [
  [5, 8, 42, 88, 65, 70, 92, 30], // Mon
  [4, 6, 40, 85, 62, 68, 88, 28], // Tue
  [6, 9, 44, 90, 66, 72, 95, 32], // Wed
  [5, 7, 38, 82, 60, 66, 85, 27], // Thu
  [10, 15, 50, 78, 55, 80, 100, 60], // Fri
  [20, 25, 15, 20, 45, 60, 75, 65], // Sat
  [15, 18, 10, 12, 30, 40, 55, 35], // Sun
]

const heatmapData: DataRow[] = []
activityMatrix.forEach((row, d) => {
  row.forEach((value, h) => {
    heatmapData.push({ day: days[d], hour: hours[h], value })
  })
})

const axisX: AxisConfig = { type: 'block', domain: days }
const axisY: AxisConfig = { type: 'block', domain: hours }

// GitHub-contribution-graph-style light->dark green gradient, domain = the matrix's own [0,100] range.
const GRADIENT_LOW = '#ebedf0'
const GRADIENT_HIGH = '#216e39'
const colorScale = createColorScale([0, 100], [GRADIENT_LOW, GRADIENT_HIGH])
const cellColors = heatmapData.map((row) => colorScale(row.value as number))

function formatValue(row: DataRow): string {
  return String(row.value)
}

// Smaller 3x3 grid demonstrating the `colors` array's fallback behavior: an explicit hex, the
// `"none"` sentinel (-> heatmapBackgroundColor), and an omitted entry (-> theme palette cycle) -
// one behavior per SHIFT column (AM/PM/Night), applied consistently across all 3 rooms/rows.
const rooms = ['Lobby', 'Kitchen', 'Office']
const shifts = ['AM', 'PM', 'Night']
const occupancyData: DataRow[] = []
const occupancyColors: string[] = []
rooms.forEach((room) =>
  shifts.forEach((shift, si) => {
    occupancyData.push({ room, shift, text: `${room[0]}${shift[0]}` })
    if (si === 0) occupancyColors[occupancyData.length - 1] = '#4caf50' // AM: explicit hex
    else if (si === 1) occupancyColors[occupancyData.length - 1] = 'none' // PM: "none" sentinel
    // Night (si === 2): entry deliberately left unset -> falls back to the theme palette cycle.
  }),
)
const roomAxisX: AxisConfig = { type: 'block', domain: rooms }
const shiftAxisY: AxisConfig = { type: 'block', domain: shifts }

const lastEvent = ref('(none yet)')
function onHeatmapEvent(type: string, payload: ChartElementEventPayload) {
  lastEvent.value = `${type} dataIndex=${payload.dataIndex} dataKey=${payload.dataKey} data=${JSON.stringify(payload.data)}`
}
</script>

<template>
  <div>
    <h2>heatmap.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - no relation to <code>heatmapscatter.js</code>. One cell per DATA ROW
      (no <code>target</code> concept at all), positioned on both axes by looking up a row field against a block axis. The engine itself has no
      gradient/interpolation color primitive - <code>this.color()</code> is the same flat per-index-or-function palette every other brush uses.
      This demo's gradient below is new, port-only infrastructure (<code>useColorScale.ts</code>), fed into the existing plain-array
      <code>colors</code> prop.
    </p>

    <h3>Day-of-week x hour-of-day activity heatmap (continuous gradient via <code>useColorScale</code>)</h3>
    <p class="desc">
      Domain <code>[0,100]</code>, stops <code>{{ GRADIENT_LOW }}</code> (0%) -&gt; <code>{{ GRADIENT_HIGH }}</code> (100%), linearly interpolated
      per cell's <code>value</code> - see <code>useColorScale.spec.ts</code> for the hand-traced interpolation math this reuses.
    </p>
    <HeatmapChart
      :data="heatmapData"
      :axis-x="axisX"
      :axis-y="axisY"
      x-field="day"
      y-field="hour"
      :colors="cellColors"
      :format="formatValue"
      title="Weekly activity heatmap"
      data-testid="heatmap-activity"
    />

    <h3><code>colors</code> array fallback behavior: explicit hex / <code>"none"</code> sentinel / omitted entry</h3>
    <p class="desc">
      AM cells use an explicit color, PM cells use the literal string <code>"none"</code> (falls back to <code>heatmapBackgroundColor</code>,
      matching the source's own explicit sentinel), Night cells omit the entry entirely (falls back to the theme's per-index palette cycle - this
      port's own established <code>colors?: string[]</code> convention, a deliberate improvement over the source's own broken zero-config default -
      see <code>HeatmapChart.vue</code>'s header comment).
    </p>
    <HeatmapChart :data="occupancyData" :axis-x="roomAxisX" :axis-y="shiftAxisY" x-field="room" y-field="shift" :colors="occupancyColors" title="Room occupancy" data-testid="heatmap-colors-fallback" />

    <h3>Per-element event forwarding + dark theme</h3>
    <p class="desc"><code>addEvent(group, i, null)</code>: <code>dataIndex</code> is the real row index, <code>dataKey</code> is always <code>null</code>, <code>data</code> is the whole row.</p>
    <p data-testid="last-heatmap-event">{{ lastEvent }}</p>
    <HeatmapChart
      :data="heatmapData"
      :axis-x="axisX"
      :axis-y="axisY"
      x-field="day"
      y-field="hour"
      :colors="cellColors"
      :format="formatValue"
      theme="dark"
      title="Weekly activity heatmap (dark)"
      data-testid="heatmap-dark"
      @click="(p) => onHeatmapEvent('click', p)"
      @mouseover="(p) => onHeatmapEvent('mouseover', p)"
      @mouseout="(p) => onHeatmapEvent('mouseout', p)"
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
