<script setup lang="ts">
// Demo for `Column3DChart.vue` (`src/composables/useColumn3d.ts` + `usePolygon3d.ts`, hand-ported
// from `chart.brush.polygon.column3d`) - see those files' header comments for the full
// extend-chain / real-SVG-not-canvas / `chart.polygon.cube` dependency / z-block-axis writeup.
//
// Same hand-computable-geometry approach as `Dot3DPage.vue`: 480x300 canvas, default padding
// (plot area x:[48,456]/y:[20,268], 408x248), `depth=500` deliberately exceeds the plot area so
// `effectiveDepth = Math.max(408, 248, 500) = 500` exactly (see `usePolygon3d.ts`). Unlike
// `dot3d.js`'s single data POINT, a column's CUBE has 8 vertices spanning a z-range, so no single
// corner is guaranteed to land exactly at rotated z=0 (the one value making the perspective-scale
// step collapse to an exact `s=1` no-op, see `Dot3DPage.vue`'s own comment) - this page instead
// exists to be read back by exact SVG `points` attribute cross-check (this brush renders REAL SVG
// `<polygon>`s, not a canvas raster, so a Playwright check can read the rendered geometry directly
// and compare it byte-for-byte against an independent Node computation of the same
// `buildColumn3dDraws`/`rotatePolygonVertices` formulas - a strictly more precise check than
// pixel-readback, see PORT_STATUS.md).
import { computed, ref } from 'vue'
import Column3DChart from '../components/Column3DChart.vue'
import { useRotate3dDrag } from '../composables/useRotate3d'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { label: 'Mon', a: 4, b: 6 },
  { label: 'Tue', a: 7, b: 3 },
]
const target = ['a', 'b']

// `createColumn`'s own `this.addEvent(g, dataIndex, targetIndex)` - see `Column3DChart.vue`'s
// header comment (skipped when the column's value is 0).
const lastClick = ref<ChartElementEventPayload | null>(null)
function onColumnClick(payload: ChartElementEventPayload): void {
  lastClick.value = payload
}

const axisX: AxisConfig = { type: 'block', domain: 'label' }
const axisY: AxisConfig = { type: 'range', domain: ['a', 'b'], min: 0, max: 10, unit: 10 }

// Real `widget/polygon/rotate3d.js` drag-to-rotate widget (see `useRotate3d.ts`'s header comment)
// - X/Y are driven by a real mouse drag over the chart's own <svg> below; the "+15deg" buttons
// remain for Z (untouched by this widget in source too) and as a deterministic fallback.
const column3dEl = ref<InstanceType<typeof Column3DChart> | null>(null)
const areaWidth = ref(408) // 480 - left(48) - right(24), see this file's own header comment
const areaHeight = ref(248) // 300 - top(20) - bottom(32)
const totalWidth = ref(480)
const totalHeight = ref(300)
const { degreeX, degreeY, onMouseDown: onRotateMouseDown } = useRotate3dDrag({
  elRef: computed(() => column3dEl.value?.$el ?? null),
  areaWidth,
  areaHeight,
  totalWidth,
  totalHeight,
})
const degreeZ = ref(0)

function bump(axis: 'x' | 'y' | 'z', delta: number): void {
  if (axis === 'x') degreeX.value += delta
  else if (axis === 'y') degreeY.value += delta
  else degreeZ.value += delta
}

function resetDegree(): void {
  degreeX.value = 0
  degreeY.value = 0
  degreeZ.value = 0
}
</script>

<template>
  <div>
    <h2>Column3D chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/polygon/column3d.js</code> (<code>chart.brush.polygon.column3d</code>, extends
      <code>chart.brush.polygon.core</code> -&gt; <code>chart.brush.core</code>). Despite the "canvas 3D" framing in this port's
      earlier planning notes, this brush renders REAL SVG <code>&lt;polygon&gt;</code> elements - the 3D-ness is entirely in the
      vertex math (the SAME <code>chart.polygon.*</code> rotation/perspective engine <code>dot3d.js</code> wraps, via a new
      <code>CubePolygon</code> primitive). Each column is a real cube (8 vertices, 6 faces) positioned by a REAL third (z) axis -
      one z-slot per series (<code>target</code>), unlike <code>dot3d.js</code>'s simpler linear z. <strong>Drag on the chart below</strong>
      to rotate X/Y live - the real ported <code>widget/polygon/rotate3d.js</code> mouse-drag widget (<code>useRotate3d.ts</code>). Z has
      no drag widget in source either - use its button.
    </p>
    <div class="controls">
      <button type="button" data-testid="rotate-x" @click="bump('x', 15)">Rotate X +15deg</button>
      <button type="button" data-testid="rotate-y" @click="bump('y', 15)">Rotate Y +15deg</button>
      <button type="button" data-testid="rotate-z" @click="bump('z', 15)">Rotate Z +15deg</button>
      <button type="button" data-testid="reset-degree" @click="resetDegree">Reset rotation</button>
    </div>
    <Column3DChart
      ref="column3dEl"
      data-testid="column3d-chart"
      style="cursor: grab"
      @mousedown="onRotateMouseDown"
      :data="data"
      :target="target"
      :axis-x="axisX"
      :axis-y="axisY"
      :width="480"
      :height="300"
      :depth="500"
      :degree-x="degreeX"
      :degree-y="degreeY"
      :degree-z="degreeZ"
      :perspective="0.9"
      title="Column3D"
      @click="onColumnClick"
    />
    <p class="readout" data-testid="column3d-readout">degree=({{ degreeX }},{{ degreeY }},{{ degreeZ }})</p>
    <p class="readout" data-testid="column3d-click-readout">
      lastClick={{ lastClick ? `${lastClick.dataKey}[${lastClick.dataIndex}]` : 'none' }}
    </p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.readout {
  font-family: monospace;
  font-size: 12px;
  color: #333;
}
</style>
