<script setup lang="ts">
// No legacy demo exists for `timeline` (checked examples/ - none reference this brush, same finding
// `main` branch's own TimelinePage.vue header comment independently reached) - a representative
// project-schedule (Gantt) sample is used here instead. A blank header lane at domain index 0
// (`''`) is included deliberately: `drawGrid()`'s own `fill = (j == 0) ? columnColor : ...` treats
// row 0 as a conventional header-styled row, confirmed by reading `timeline.js` directly.
//
// `x.domain` is a literal 2-element NUMBER array (`[0, 30]`), not `['stime', 'etime']` - confirmed
// by reading the real engine's own `grid/range.js` `initDomain()`: its "domain is a string" branch
// reads exactly ONE data-row field name per row, and (unlike `main` branch's own from-scratch Vue
// port, which invented a "fold min/max across an array of field names" config mode for its own
// composable) an ARRAY-typed `domain` in the real engine is taken as the LITERAL domain bounds
// themselves (`Math.min`/`Math.max` applied directly to the array's own values) - so
// `['stime','etime']` would coerce both field-name STRINGS to `NaN` and silently drop every row
// (`isNaN(x2)` in `drawData()`). A plain `[0, 30]` literal is the real, correct way to fix this
// axis's domain.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'range', domain: [0, 30], line: true },
    y: { type: 'block', domain: ['', 'Design', 'Development', 'Testing', 'Launch'], line: true },
    data: [
      { key: 'Design', stime: 0, etime: 6 },
      { key: 'Design', stime: 6, etime: 10 },
      { key: 'Development', stime: 10, etime: 22 },
      { key: 'Development', stime: 22, etime: 26 },
      { key: 'Testing', stime: 20, etime: 27 },
      { key: 'Launch', stime: 27, etime: 30 },
    ],
  },
]

const brush = [{ type: 'timeline', barSize: 14 }]

const widget = [{ type: 'title', text: 'Project Schedule' }]
</script>

<template>
  <div class="demo">
    <h2>timeline</h2>
    <Chart :width="600" :height="300" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
