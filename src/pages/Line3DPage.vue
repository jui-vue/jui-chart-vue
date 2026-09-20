<script setup lang="ts">
// Demo for `Line3DChart.vue` (`src/composables/useLine3d.ts` + `usePolygon3d.ts`, hand-ported
// from `chart.brush.polygon.line3d`) - see those files' header comments for the full extend-chain
// / real-SVG-not-canvas / ribbon-geometry / no-event-forwarding writeup. Same hand-computable
// plot-area setup as `Column3DPage.vue` (480x300, `depth=500` dominates `effectiveDepth`) - see
// that page's own comment for why exact SVG `points` cross-check (not pixel-readback) is this
// brush's own verification method too.
import { computed, ref } from 'vue'
import Line3DChart from '../components/Line3DChart.vue'
import { useRotate3dDrag } from '../composables/useRotate3d'
import type { AxisConfig, DataRow } from '../types'

const data: DataRow[] = [
  { label: 'Mon', a: 4, b: 6 },
  { label: 'Tue', a: 7, b: 3 },
  { label: 'Wed', a: 5, b: 8 },
]
const target = ['a', 'b']

const axisX: AxisConfig = { type: 'block', domain: 'label' }
const axisY: AxisConfig = { type: 'range', domain: ['a', 'b'], min: 0, max: 10, unit: 10 }

// Real `widget/polygon/rotate3d.js` drag-to-rotate widget (see `useRotate3d.ts`'s header comment)
// - X/Y are driven by a real mouse drag over the chart's own <svg> below; the "+15deg" buttons
// remain for Z (untouched by this widget in source too) and as a deterministic fallback.
const line3dEl = ref<InstanceType<typeof Line3DChart> | null>(null)
const areaWidth = ref(408) // 480 - left(48) - right(24), see Column3DPage.vue's own header comment
const areaHeight = ref(248) // 300 - top(20) - bottom(32)
const totalWidth = ref(480)
const totalHeight = ref(300)
const { degreeX, degreeY, onMouseDown: onRotateMouseDown } = useRotate3dDrag({
  elRef: computed(() => line3dEl.value?.$el ?? null),
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
    <h2>Line3D chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/polygon/line3d.js</code> (<code>chart.brush.polygon.line3d</code>, extends
      <code>chart.brush.polygon.core</code> -&gt; <code>chart.brush.core</code>). Closely related to <code>column3d.js</code> (same
      extend chain, same <code>chart.polygon.*</code> engine, same real-x/y + z-block-axis shape) but NOT identical structure: each
      segment is a flat 4-point ribbon quad (via <code>PointPolygon</code>, the same primitive <code>dot3d.js</code> uses) between
      consecutive rows, not a cube - one ribbon per <code>target</code> series, per row-to-row segment. <strong>Drag on the chart
      below</strong> to rotate X/Y live - the real ported <code>widget/polygon/rotate3d.js</code> mouse-drag widget
      (<code>useRotate3d.ts</code>). Z has no drag widget in source either - use its button.
    </p>
    <div class="controls">
      <button type="button" data-testid="rotate-x" @click="bump('x', 15)">Rotate X +15deg</button>
      <button type="button" data-testid="rotate-y" @click="bump('y', 15)">Rotate Y +15deg</button>
      <button type="button" data-testid="rotate-z" @click="bump('z', 15)">Rotate Z +15deg</button>
      <button type="button" data-testid="reset-degree" @click="resetDegree">Reset rotation</button>
    </div>
    <Line3DChart
      ref="line3dEl"
      data-testid="line3d-chart"
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
      title="Line3D"
    />
    <p class="readout" data-testid="line3d-readout">degree=({{ degreeX }},{{ degreeY }},{{ degreeZ }})</p>
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
