<script setup lang="ts">
// Demo for `Dot3DChart.vue` (`src/composables/useDot3d.ts` + `usePolygon3d.ts`, hand-ported from
// `chart.brush.canvas.dot3d`) - see those composables' header comments for the full extend-chain /
// polygon.* dependency / real-3D-projection / axis-based-ness / preserved-bug writeup.
//
// Axis config and `zDomain`/`depth` are pinned to hand-computable values so the default (degree
// 0, no rotation) frame's pixel positions are exactly hand-traceable - see `useDot3d.spec.ts`'s
// header-adjacent PORT_STATUS.md entry for the derivation. With the default 480x300 canvas and
// default padding (top:20/right:24/bottom:32/left:48), the plot area is x:[48,456]/y:[20,268]
// (408x248, center (252,144)). `depth=500` deliberately exceeds the plot area's own
// width/height so `effectiveDepth = Math.max(plotWidth, plotHeight, depth)` (see
// `usePolygon3d.ts`) equals `depth` itself, making the perspective "far plane" land exactly at
// the data's own z=10 (`zDomain=[0,10]` -> `[0,500]` pixels) - point "A" (z=0) projects with NO
// perspective shrink at all (`scaleValue(far=depth,0,depth,p,1)=1` exactly), point "B" (z=10)
// shrinks toward `perspective` (0.9) around the plot-area center exactly.
import { computed, ref } from 'vue'
import Dot3DChart from '../components/Dot3DChart.vue'
import type { Dot3dRow } from '../composables/useDot3d'
import type { Dot3dSymbol } from '../composables/useDot3d'
import { useRotate3dDrag } from '../composables/useRotate3d'
import type { RangeAxisConfig } from '../types'

const axisX: RangeAxisConfig = { type: 'range', domain: 'x', min: 0, max: 10, unit: 10 }
const axisY: RangeAxisConfig = { type: 'range', domain: 'y', min: 0, max: 10, unit: 10 }

const symbol = ref<Dot3dSymbol>('dot')

// Real `widget/polygon/rotate3d.js` drag-to-rotate widget (see `useRotate3d.ts`'s header comment)
// - X/Y are driven by a real mouse drag over the chart's own canvas below; the "+15deg" buttons
// remain for Z (untouched by this widget in source too) and as a deterministic fallback.
const dot3dEl = ref<InstanceType<typeof Dot3DChart> | null>(null)
const areaWidth = ref(408) // 480 - left(48) - right(24), see this file's own header comment
const areaHeight = ref(248) // 300 - top(20) - bottom(32)
const totalWidth = ref(480)
const totalHeight = ref(300)
const { degreeX, degreeY, onMouseDown: onRotateMouseDown } = useRotate3dDrag({
  elRef: computed(() => dot3dEl.value?.$el ?? null),
  areaWidth,
  areaHeight,
  totalWidth,
  totalHeight,
})
const degreeZ = ref(0)

const dotData: Dot3dRow[] = [
  { x: 5, y: 5, z: 0 }, // "A" - the hand-computable anchor point (z=0 -> no perspective shrink)
  { x: 2, y: 8, z: 10 }, // "B" - z at the far plane -> shrinks toward perspective (0.9)
]

const lineData: Dot3dRow[] = [
  { x: 1, y: 2, z: 0 },
  { x: 3, y: 6, z: 3 },
  { x: 5, y: 3, z: 6 },
  { x: 7, y: 8, z: 9 },
  { x: 9, y: 4, z: 10 },
]

const data = computed<Dot3dRow[]>(() => (symbol.value === 'dot' ? dotData : lineData))

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
    <h2>Dot3D chart (Phase E)</h2>
    <p class="desc">
      Ported from <code>src/brush/canvas/dot3d.js</code> (<code>chart.brush.canvas.dot3d</code>, extends
      <code>chart.brush.canvas.core</code> -&gt; <code>chart.brush.core</code>). Depends on the SEPARATE <code>juijs-graph</code>
      package's 3D vertex/matrix engine (<code>chart.polygon.core/point/line</code>, <code>usePolygon3d.ts</code>) - REAL homogeneous
      4x4 rotation matrices plus a depth-based perspective scale, not a 2D shading effect. At degree (0,0,0) point "A" (z=0) sits
      exactly at its plain axis position with no perspective shrink; point "B" (z=10, the far plane here) shrinks toward
      <code>perspective=0.9</code> around the plot-area center. <strong>Drag on the canvas below</strong> to rotate X/Y live - the real
      ported <code>widget/polygon/rotate3d.js</code> mouse-drag widget (<code>useRotate3d.ts</code>), a vertical drag rotates X and a
      horizontal drag rotates Y (see its own header comment for the exact degree/gap formula). Z has no drag widget in source either -
      use its button.
    </p>
    <div class="controls">
      <label>
        Symbol:
        <select v-model="symbol" data-testid="symbol-select">
          <option value="dot">dot</option>
          <option value="line">line</option>
          <option value="poly">poly</option>
          <option value="area">area</option>
        </select>
      </label>
      <button type="button" data-testid="rotate-x" @click="bump('x', 15)">Rotate X +15deg</button>
      <button type="button" data-testid="rotate-y" @click="bump('y', 15)">Rotate Y +15deg</button>
      <button type="button" data-testid="rotate-z" @click="bump('z', 15)">Rotate Z +15deg</button>
      <button type="button" data-testid="reset-degree" @click="resetDegree">Reset rotation</button>
    </div>
    <Dot3DChart
      ref="dot3dEl"
      data-testid="dot3d-canvas"
      style="cursor: grab"
      @mousedown="onRotateMouseDown"
      :data="data"
      :axis-x="axisX"
      :axis-y="axisY"
      :width="480"
      :height="300"
      :symbol="symbol"
      :size="16"
      :depth="500"
      :z-domain="[0, 10]"
      :degree-x="degreeX"
      :degree-y="degreeY"
      :degree-z="degreeZ"
      :perspective="0.9"
      title="Dot3D"
    />
    <p class="readout" data-testid="dot3d-readout">degree=({{ degreeX }},{{ degreeY }},{{ degreeZ }}) symbol={{ symbol }}</p>
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
