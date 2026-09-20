# jui-chart-vue

A from-scratch Vue 3 Composition API + TypeScript port of [jui-chart](../jui-chart)'s (its
engine is [`juijs-graph`](../jui-chart/node_modules/juijs-graph)) core rendering pipeline, plus
25 chart types so far: **line, area, bar/column, pie, donut, scatter, bubble, range area, range
bar/column, candlestick, equalizer, rate bar, bar gauge, full gauge, pin, select box, heatmap,
heatmap scatter, pyramid, arc equalizer, timeline, focus, flame, treemap, topology**. Line/area/scatter/bar all also support a `stacked` prop
(cumulative series stacking, ported from `stackarea.js`/`stackline.js`/`stackscatter.js`/
`stackbar.js`/`stackcolumn.js`), `BarChart` additionally supports a `normalize` prop (100%-
normalized stacking, ported from `fullstackbar.js`/`fullstackcolumn.js`) and an `equalizer` prop
(splits each `stacked` segment into a train of small blocks, ported from `equalizerbar.js`/
`equalizercolumn.js`). See [`../jui-chart`](../jui-chart) for the original library this ports.

## Scope

The original MVP (line/area/bar/pie/donut) was agreed up front and has since been hardened to
production quality (see `PORT_STATUS.md`'s "Phase A"); porting continued incrementally through
jui-chart's other ~30+ remaining brush types (Phase B: scatter, bubble,
stackarea/stackline/stackscatter, range area, range bar/column, candlestick, stackbar/stackcolumn,
fullstackbar/fullstackcolumn, equalizer/equalizerbar/equalizercolumn, ratebar, bargauge, fullgauge,
pin, selectbox, heatmap, heatmapscatter, pyramid, arcequalizer - **Phase B fully done, 15/15** -
plus Phase C: timeline, focus, flame, treemap, topologynode (**Phase C fully done**), 3d variants
(out of scope, see below)). **Phase D (widgets) is now also fully done**: `topologyctrl.js`'s
viewport pan/zoom (`TopologyChart`'s `pannable`/`zoomable` props), `legend.js` (the standalone
`ChartLegend` component - see its own entry below and `PORT_STATUS.md` for why it's a separate
component rather than another opt-in prop), `guideline.js`/`cross.js` (`LineChart`'s `guideline`/
`crosshair` props - see `PORT_STATUS.md` for why both were ported as genuinely different features,
as opt-in props rather than another separate component), all three zoom widgets - `zoom.js`
(`LineChart`'s `zoomable` prop, a real drag-to-zoom row-window), `zoomscroll.js` (`LineChart`'s
`zoomScrollable` prop, a persistent dual-edge-resize + center-pane-pan control strip with a real
embedded thumbnail chart - see its own entry below and `PORT_STATUS.md`'s `zoomscroll.js` entry for
the full design writeup, including why the thumbnail is a nested small `AreaChart`/`LineChart`
component rather than source's own SVG-to-`<image>`-data-URI serialization trick), and
`zoomselect.js` (deliberately deprioritized as low-value/near-redundant with `FocusChart`'s
existing `selectEvent` - a passive select-and-emit widget with zero chart-mutating effect of its
own, see `PORT_STATUS.md`'s `zoom.js` entry for the full source-grep evidence) - `dragselect.js`
(`LineChart`'s `dragSelect`/`dragSelectMode` props, a passive multi-point drag selection, confirmed
genuinely distinct from `zoomable`/`FocusChart`'s `selectEvent`/`SelectBoxChart`), `scroll.js`/
`vscroll.js` (`LineChart`'s `scrollable`/`verticalScrollable` props, a fixed-size-window scrollbar,
confirmed a simpler sibling of `zoomscroll.js`'s own center-pane-pan mechanism), and `raycast.js`
(investigated in Phase D and found to be transitively out of scope at the time - not merely
unported: it's a click hit-testing shim that exists only to compensate for canvas rendering's lack
of per-shape DOM nodes, and its sole real-world consumer across the whole `jui-chart`/`juijs-graph`
source tree was the then-out-of-scope `brush/canvas/equalizercolumn.js`. **That producer is now
ported in Phase E, so `raycast.js` is too** - folded into the `equalizercolumn.js` (canvas) entry
below rather than tracked separately, since it was never its own checklist line - see
`PORT_STATUS.md`'s `equalizercolumn.js` entry for the full re-investigation, including the
Node-cross-checked block-index math and the confirmed "no external library match" check). **Phases
A-D (the
complete SVG-based port) are done.** This also drops the original's `jui.use()` /
`extend:"chart.brush.core"` string-keyed module registry entirely - that's a plugin-loader artifact
with no Vue equivalent; each chart type here is just a Vue component/composable.

**Phase E (canvas/3D rendering) is now complete** - a user-requested extension into jui-chart's
canvas-2D and hand-rolled-3D brushes, a SECOND rendering backend alongside Phases A-D's shared
`ChartBase.vue`/`useChartLayout`/`useAxis`/`useScale` SVG engine (see `ChartCanvasBase`'s own entry
below). Done so far: the shared canvas infrastructure (`ChartCanvasBase.vue`/`useCanvasChart.ts`);
`base/kinetic.js` via a documented, permanent exception to this project's usual zero-runtime-
dependency rule for generic non-chart utility code (see `PORT_STATUS.md`'s Phase E policy section
and the `kinetic`/`useCanvasChart` composable entries below); and `base/bubble.js`/
`base/mortalbubble.js` (`Bubble`/`MortalBubble`, genuine hand-ports, NOT vendored - see the
`bubble`/`mortalBubble` composable entries below); `activebubble.js` (`ActiveBubbleChart`,
the first canvas BRUSH ported - a gravity/collision-physics bubble burst consuming `MortalBubble`,
genuinely non-axis-based despite living in the axis-based engine, same shape as Phase B's
`BarGaugeChart` - see the `ActiveBubbleChart`/`useActiveBubble` entries below); and `bubblecloud.js`
(`BubbleCloudChart`, the plain, non-mortal `Bubble` clustered by a center-gravity lerp + a
never-decaying pairwise collision pass into a settled, non-overlapping "cloud" that HOLDS its
layout rather than drifting/dying - see the `BubbleCloudChart`/`useBubbleCloud` entries below for
the reference-equality rebuild cache this brush is built around); and `activecircle.js`
(`ActiveCircleChart`, the first canvas brush that's genuinely AXIS-BASED - positions come from the
real x/y axis scales via `useChartLayout`, the same composable every axis-based SVG component
already uses, not a physics-only plot rect - see the `ActiveCircleChart`/`useActiveCircle` entries
below for the "circles seed once, forever" spawn quirk and the bespoke non-`KineticObject` incline-
plane physics `Circle` carries, most of it dead code in the real brush but ported/tested anyway);
and `dot3d.js` (`Dot3DChart`, the first canvas brush with REAL 3D projection - genuine homogeneous
4x4 rotation matrices plus a depth-based perspective scale, ported from the separate `juijs-graph`
package's own `chart.polygon.{core,point,line}` vertex/matrix engine (`dot3d.js` itself is a thin
canvas-drawing adapter over that engine, not self-contained) - see the `Dot3DChart`/`usePolygon3d`/
`useDot3d` entries below for the exact `depth`/rotation-center formula (NOT simply `axis.depth`),
two preserved rendering bugs in the original's `"poly"` symbol, and the external-library-match
check that confirmed hand-porting rather than vendoring); and `equalizercolumn.js` (canvas)
(`EqualizerColumnChart`, a plain 2D stacked-column "block-train" visual - NOT 3D despite living
alongside `dot3d.js`, confirmed by a full read: zero references to `chart.polygon.*`/
`usePolygon3d.ts` anywhere - with an animated level-meter bounce overlay, reusing the SAME
block-train math (`equalizerStackedBlocks`/`equalizerUnitSize`) already extracted for the SVG
sibling behind `BarChart`'s `equalizer` prop. This brush turned out to be `widget/raycast.js`'s
one real, confirmed consumer anywhere in the source tree (a plain axis-aligned rectangle hit-test,
NOT 3D ray casting despite the name - see the `EqualizerColumnChart`/`useEqualizerColumn`/
`useRaycast` entries below) - `widget/canvas/picker.js` was also revisited alongside it but turned
out to be a completely unrelated mechanism, whose real (and now genuinely ported) consumer was
`bubblecloud.js` all along - see `BubbleCloudChart`'s own entry below for its new click/dblclick
picking); and `column3d.js`/`line3d.js` (`Column3DChart`/`Line3DChart`, a genuine surprise: despite
living under `jui-chart/src/brush/polygon/` and this task's own "canvas 3D" framing, both render
REAL SVG `<polygon>` elements, not canvas - the 3D-ness is entirely in the vertex math, the SAME
`chart.polygon.*` engine `dot3d.js` wraps, via a new `CubePolygon` primitive (`column3d.js`) and
the existing point primitive `dot3d.js` already uses (`line3d.js`) - see the `Column3DChart`/
`Line3DChart`/`usePolygon3d`/`useColumn3d`/`useLine3d` entries below for the confirmed-related-but-
not-identical geometry between the two, the real third (z) block axis (one z-slot per series,
unlike `dot3d.js`'s simpler linear z), and the exact-SVG-geometry Playwright cross-check this
brush's real (not canvas-raster) output made possible); and, finally, `widget/polygon/rotate3d.js`
(`useRotate3d.ts`, the generic mouse-drag-to-rotate widget every polygon-based 3D brush above is
meant to opt into - not vendored in `node_modules/juijs-graph` at all, only in `jui-chart/src`;
mutates the SAME `degreeX`/`degreeY` state `usePolygon3d.ts`'s engine already reads, redrawing live
via Vue reactivity rather than source's own imperative `chart.render()` call - see the
`useRotate3d` composable entry below and `PORT_STATUS.md` for the exact drag-delta-to-degree
formula, Node-cross-checked). **All 8 Phase E items are done (643/643 tests)** - see
`PORT_STATUS.md`'s Phase E completion summary for the full list and architectural notes.

## Install (within this workspace)

```bash
npm install
npm run dev        # demo app at http://localhost:5173
npm run test       # vitest - composable unit tests
npm run build      # typecheck + build the demo app
npm run build:lib  # typecheck + build the publishable package into dist-lib/
```

The demo app (`src/App.vue` + `src/router.ts`) is a small vue-router shell, one page per chart
type under `src/pages/`: `/bar` (reproduces [`../jui-chart/examples/bar.html`](../jui-chart/examples/bar.html)
exactly, plus a horizontal-orientation variant of the same data), `/line`, `/area`, `/pie`,
`/donut`, `/scatter`, `/bubble`, `/axis-orient` (configurable `axis.x.orient`/`axis.y.orient`).

## Usage

```vue
<script setup lang="ts">
import { BarChart } from 'jui-chart-vue'
import type { AxisConfig, DataRow } from 'jui-chart-vue'

const data: DataRow[] = [
  { quarter: '1Q', sales: 1, profit: 3 },
  { quarter: '2Q', sales: 3, profit: 2 },
  { quarter: '3Q', sales: 10, profit: 1 },
  { quarter: '4Q', sales: 0.49, profit: 4 },
]

const axisX: AxisConfig = { type: 'block', domain: 'quarter' }
const axisY: AxisConfig = { type: 'range', domain: (d) => [d.sales, d.profit], step: 3 }
</script>

<template>
  <BarChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['sales', 'profit']" orient="column" title="hihi" />
</template>
```

This is the exact config from `examples/bar.html` (jui-chart's only concrete real-world usage
example) - `axis.x`/`axis.y`'s `type: "block" | "range"` shape and a brush's `target: string[]`
carry over directly. `PieChart`/`DonutChart` take a single data row (a `Record<string, number>`)
and a `target: string[]` instead - see "What wasn't validated against a real example" below.

Either axis config can also take `orient` (nested inside `axisX`/`axisY`, exactly like the
original's `axis.x.orient`/`axis.y.orient`): `axisX.orient: "top" | "bottom"` (default
`"bottom"`), `axisY.orient: "left" | "right"` (default `"left"`) - flips which edge of the plot
area the baseline/tick labels are drawn against. See `/axis-orient` in the demo app. `orient`
doesn't auto-adjust `padding` (same as the original - they're independent config), so give a
flipped-orient chart its own `padding` override if the default padding leaves the wrong side too
narrow.

Either axis config can also take `line: boolean` (nested the same way, default `false`, ported
from `grid/core.js`'s `line`): draws a full-length grid line at every tick of that axis alone
(x-axis lines span the plot's full height, y-axis lines its full width), independent of the other
axis and additive on top of `ChartBase`'s chart-wide `showGrid` prop - see "What's simplified"
below for how the two interact. Unlike `showGrid` alone, `line: true` works for a block
(categorical) axis, not just a range (value) one. See `/axis-orient` in the demo app.

### Components

- **`LineChart`** - `symbol: "normal" | "curve" | "step"`, `showPoints`, hover tooltip,
  `active`/`activeEvent` (highlight one series, dim the rest - see below), `stacked` (cumulative
  series stacking, ported from `stackline.js` - see "`stacked`" below). Emits `click`/
  `dblclick`/`contextmenu`/`mouseover`/`mouseout` per series-path (see "What's simplified" below).
  `guideline` (ported from `widget/guideline.js`) - a vertical line SNAPPED to the nearest data row
  under the pointer, paired with a `ChartTooltip` listing every target's value at that row.
  `crosshair` (ported from `widget/cross.js`, genuinely different from `guideline` despite the
  similar-sounding name - see `PORT_STATUS.md`) - `true | "x" | "y" | "both"`, a crosshair tracking
  the RAW (un-snapped) pointer position, each line paired with a simple axis-value readout
  (`crosshairXFormat`/`crosshairYFormat`). Both are opt-in props on `LineChart` itself rather than
  separate components, matching `topologyctrl.js`'s precedent (live access to this chart's own
  scale/series needed, no visual surface outside the plot area) - see `LineChart.vue`'s header
  comment for the full writeup.
  `zoomable` (ported from `widget/zoom.js`) - drag a rectangle over the plot area (only meaningful
  for a `"block"` x-axis) to re-window the visible rows by index; a REAL zoom (both axes' domains
  re-derive from the narrower slice - traced into `juijs-graph`'s `axis.zoom()`, confirmed to slice
  the underlying data array rather than apply a visual transform), not the same mechanism as
  `TopologyChart`'s viewport-transform `zoomable`. A reset ("×") icon appears once zoomed; click it
  to show the full `data` again. Emits `zoom` with the new `{start, end}` window (or `null` after a
  reset). Same "opt-in prop, not a separate component" integration as `guideline`/`crosshair` above
  - see `LineChart.vue`'s header comment and `PORT_STATUS.md`'s `zoom.js` entry.
  `dragSelect`/`dragSelectMode` (ported from `widget/dragselect.js`) - drag a rectangle over the
  plot area; `dragSelectMode="list"` (the default) selects every rendered point whose pixel falls
  inside it and emits the matched `{dataIndex, dataKey, data}` rows, `dragSelectMode="area"` skips
  per-point matching and just emits the dragged rectangle's own axis-value corners. A passive,
  non-domain-mutating notification (unlike `zoomable`, confirmed via a full source read to never
  call `axis.zoom()`/`chart.render()`), genuinely distinct from `FocusChart`'s 2-click `selectEvent`,
  `zoomable`'s domain rescale, and `SelectBoxChart`'s static hover strip - see `LineChart.vue`'s
  header comment and `PORT_STATUS.md`'s `dragselect.js` entry for the full comparison. Shares the
  same hit-rect as `guideline`/`crosshair`/`zoomable`; mutually exclusive with `zoomable` on the
  same drag (`zoomable` takes precedence if both are enabled). Emits `dragselect` with the
  selection.
  `scrollable`/`verticalScrollable`/`visibleCount`/`scrollOrient`/`verticalScrollOrient` (ported
  from `widget/scroll.js`/`widget/vscroll.js`) - a classic scrollbar (track + draggable thumb,
  horizontal below the plot by default / vertical to its left by default) that PANS a FIXED-SIZE
  window of `visibleCount` rows through `data`, distinct from `zoomable`'s variable-size
  drag-any-rectangle window. Reuses `zoomable`'s own `windowedData` slicing mechanism (`zoomable`
  takes precedence if both are enabled); `scrollable`/`verticalScrollable` share one underlying
  row-index window even when both are on, since source's own two widgets drive the identical
  `axis.zoom()` call on the same axes - see `useScrollWindow.ts`'s header comment for the full
  interaction-model writeup, including its confirmed close relationship to `zoomscroll.js` (below),
  and `PORT_STATUS.md`'s `scroll.js`/`vscroll.js` entry for the Vue-boolean-prop naming footgun
  (`vScrollable` silently breaks Vue's bare-attribute shorthand - renamed to `verticalScrollable`)
  found and fixed via Playwright.
  `zoomScrollable`/`zoomScrollKey`/`zoomScrollSymbol`/`zoomScrollColor` (ported from
  `widget/zoomscroll.js`, the last Phase D item) - a persistent control strip below the plot area
  with two independent edge-resize handles (drag either to narrow the visible window from that
  side - a REAL axis-domain rescale, sharing `zoomable`'s own `zoomWindow` state) plus a draggable
  center pane (pans the fixed-width window, the same underlying math `scrollable`'s thumb already
  implements). Backed by a real embedded thumbnail chart - a small nested `AreaChart`
  (`zoomScrollSymbol="area"`, the default) or `LineChart` (`"line"`) showing the FULL, un-windowed
  `data` for `zoomScrollKey` (defaults to `target[0]`), rather than source's own
  serialize-a-whole-separate-chart-to-an-`<image>`-data-URI trick (this port nests a real Vue chart
  component instead - SVG natively supports a nested `<svg>` viewport, so this is the more idiomatic
  equivalent, not a shortcut). Only meaningful for a `"block"` x-axis, same constraint as `zoomable`;
  `zoomable` takes precedence if both are enabled (shares its window state). Emits `zoomscroll` with
  the new `{start, end}` window after a completed drag. See `LineChart.vue`'s header comment and
  `PORT_STATUS.md`'s `zoomscroll.js` entry for the full edge-resize/center-pan math and the
  thumbnail-chart design writeup.
- **`AreaChart`** - extends line: `startZero`, `line` (show/hide the border stroke),
  `active`/`activeEvent` (dims/highlights the outline stroke only, per the original's actual
  behavior - see below), `stacked` (cumulative band stacking, ported from `stackarea.js` with a
  documented band-fill deviation - see "`stacked`" below). Emits `click`/`dblclick`/`contextmenu`/
  `mouseover`/`mouseout` per target (fill + optional outline together, regardless of `line` - see
  "What's simplified" below for why this is per-target rather than a literal port of the original's
  call site).
- **`BarChart`** - `orient: "bar" | "column"` selects horizontal vs. vertical (jui-chart's
  `bar.js`/`column.js` share nearly all their logic; this merges them into one component).
  `display: "max" | "min" | "all"` shows a persistent value label on the bar(s) holding each
  target's max value, min value, or every bar, independent of hover; `format(value)` formats the
  label/hover-tooltip text. `active`/`activeEvent` (see below) - note this is index-based, unlike
  every other chart's series-name `active`. Emits `click`/`dblclick`/`contextmenu`/`mouseover`/
  `mouseout` per bar (skipping `value===0` bars - see "What's simplified" below). `stacked`
  (cumulative segment stacking, ported from `stackbar.js`/`stackcolumn.js` - see "`stacked`"
  below; unlike Line/Area/Scatter's trivial `stacked` wrapper, this one changes real behavior:
  plain unrounded segments, no `innerPadding` gap, and `display`/`active`/`activeEvent` become
  row-scoped - a row's stack *total*, not any single segment). `normalize` (100%-normalized
  stacking - only meaningful alongside `stacked` - ported from `fullstackbar.js`/
  `fullstackcolumn.js`; see "`stacked`" below for how it relates), plus a `showText` percent-label
  prop that only applies when `normalize` is set. `equalizer` (splits each `stacked` segment into
  a train of small fixed-size blocks with gaps, a VU-meter look - only meaningful alongside
  `stacked` - ported from `equalizerbar.js`/`equalizercolumn.js`, which `extend`
  `stackbar.js`/`stackcolumn.js`, NOT the separate `equalizer.js` below despite the shared name),
  plus `equalizerUnit` (a divisor controlling block pixel size, default `1` - unrelated to
  `EqualizerChart`'s own same-named-but-different `unit` prop below).
- **`ScatterChart`** - one marker per (row, target) pair, `symbol: "circle" | "triangle" |
  "rectangle" | "cross"` (fixed, or a `(key, value) => shape` callback), `size`, `hide`
  (invisible except while hovered/active), `hideZero`, `hoverSync` (hovering one target's marker
  also highlights every other target's marker at the same row), `opacity`, `display`/`format`
  (same semantics as `BarChart`), `activeEvent` (persistently highlights + labels a marker until
  another is triggered - no static `active`, matching the original which has none for scatter).
  Note: like the original, this is a dot/strip plot (one categorical/index axis, one value axis
  per `target`) - there's no mode for plotting two independent numeric fields as arbitrary (x, y)
  pairs (see `ScatterChart.vue`'s header comment). `stacked` (cumulative series stacking, ported
  from `stackscatter.js` - see "`stacked`" below). Emits `click`/`dblclick`/`contextmenu`/
  `mouseover`/`mouseout` per marker, including `cross` markers (which otherwise stay
  non-interactive - matches the original's `addEvent()` call site, which has no such guard).
- **`BubbleChart`** - one bubble per (row, target) pair (same dot/strip-plot data model as
  `ScatterChart` - see its own header comment), extends `chart.brush.core` directly (NOT
  `chart.brush.scatter` - a separate implementation, confirmed from source, not "scatter plus a
  radius"). `scaleKey` names a field (on each raw data row, independent of `target`) that drives
  bubble radius instead of the point's own value; `min`/`max` (default `5`/`30`) are the output
  radius bounds a linear scale maps into. `showText` shows a label inside each bubble; `format`
  receives the WHOLE raw data row (not just the value, unlike every other component's
  `format(value)` - a literal, notable nuance from `getFormatText()`). `active`/`activeEvent` are
  index-based (flat, target-major - like `BarChart`'s, not a series name). Emits `click`/
  `dblclick`/`contextmenu`/`mouseover`/`mouseout` per bubble (real `dataIndex`/`data`, fires
  unconditionally - bubble.js has no `hide`/`hideZero`-style guard at all).
- **`RangeAreaChart`** - ported from `rangearea.js`, which `extend`s `chart.brush.core` directly
  (NOT `area.js` - no shared code with `AreaChart`). Each `target` field's row value is a
  **2-element `[low, high]` tuple** (`data[j][target[i]]`, not two separate `target` fields) -
  draws one closed band polygon per target (low values traced forward, high values traced
  backward), with no curve/step interpolation and no `startZero`/`line`/`display`/`active`
  options - the original's own `.setup()` declares none of these, so this component is
  deliberately minimal to match. No per-element event forwarding either - the original's
  `draw()` never calls `addEvent()` at all (unlike `rangebar.js`/`rangecolumn.js`, confirmed from
  source). Port-only hover tooltip (`showTooltip`, `format`) added for consistency with every
  other axis-based component here.
- **`RangeBarChart`** - `orient: "bar" | "column"` merges `rangebar.js`/`rangecolumn.js` (same
  `BarChart`-style precedent - both extend `chart.brush.core` directly, not each other, but share
  an identical `outerPadding`/`innerPadding` group-size formula and rect-drawing shape modulo an
  axis swap). Same `[low, high]` tuple data model as `RangeAreaChart`. No `size`/`minSize`/
  `display`/`active`/`activeEvent`/rounded corners - the originals have none of these (unlike
  `bar.js`). Emits `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` per rect, unconditionally
  (both originals call `addEvent()` with no `value===0`-style guard, unlike `bar.js`). Port-only
  hover tooltip (`showTooltip`, `format`) showing the low/high pair.
- **`CandlestickChart`** - ported from `candlestick.js`, which `extend`s `chart.brush.core`
  directly (no shared code with `bar.js`/`RangeBarChart`). Reads FOUR fixed row fields per
  candle - `openField`/`highField`/`lowField`/`closeField` props (default
  `'open'`/`'high'`/`'low'`/`'close'`), a port-only substitute for the original's `axis.keymap`
  remap table - NOT the `[low, high]`-tuple-per-`target` model `RangeAreaChart`/`RangeBarChart`
  use, and there is no `target` array at all (one candle per row, unconditionally - the source
  has no `.setup()`). Draws a wick (`<line>`, high-low) and a body (`<rect>`, open-close) per
  row. Color is theme-driven only (no `colors` prop - the source has none either): bullish
  (`close >= open`, including an exact tie) uses `candlestickBorderColor`/
  `candlestickBackgroundColor` (classic: a hollow black-on-white candle); bearish (`open >
  close`, strictly) uses `candlestickInvertBorderColor`/`candlestickInvertBackgroundColor`
  (classic: solid red). Emits `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` per candle
  body only (never the wick), unconditionally - `dataKey` is always `null` here (the inverse of
  `RangeAreaChart`/`RangeBarChart`'s `dataIndex: null` shape), since a candlestick fires per ROW,
  not per target. Port-only hover tooltip (`showTooltip`, `format`) showing open/high/low/close.
- **`EqualizerChart`** - ported from `equalizer.js`, which `extend`s `chart.brush.core` directly
  (no shared code with `bar.js`/`stackbar.js`, and genuinely distinct from `equalizerbar.js`/
  `equalizercolumn.js` - see `BarChart`'s `equalizer` prop above). Only one orientation exists
  upstream (x=block category, y=range value - no "equalizerrow" sibling). Each `(row, target)`
  renders as a stack of small `unit`px-tall blocks (default `5`) separated by a fixed, hardcoded
  1.5px gap, growing from zero toward the value and clipping the last block short so the stack
  always lands exactly on the value; blocks cycle through the theme's color list every `gap`
  blocks (default `5`), counting outward from zero - a color-banded VU-meter effect, distinct from
  `BarChart`'s `equalizer` mode (uniform color per target, no banding). Emits `click`/`dblclick`/
  `contextmenu`/`mouseover`/`mouseout` once per `(row, target)` block stack (matching the
  original's own single `addEvent(barGroup, i, j)` call, unlike `equalizerbar.js`/
  `equalizercolumn.js`'s double per-block-and-per-group call - see `PORT_STATUS.md`). Port-only
  hover tooltip (`showTooltip`, `format`) - the source has no default tooltip of its own.
- **`RateBarChart`** - ported from `ratebar.js`, which also `extend`s `chart.brush.core` directly
  (no shared code with `bar.js`/`stackbar.js`/`fullstackbar.js`). Only one orientation exists
  upstream (x=range value axis, y=block category axis). Each ROW renders as one pill-shaped bar
  split into contiguous colored segments, one per `target` whose value is `> 0` (a zero/negative
  value's target is skipped entirely, no zero-width placeholder) - each segment's width is that
  key's share of the ROW's OWN total, so every row always spans the full plot width regardless of
  its raw sum or the x-axis's configured domain (same "always 100%" property as `BarChart`'s
  `normalize` mode). Only the first/last *nonzero* segment gets a rounded pill end (`theme
  ('rateBarBorderRadius')`); interior boundaries are square and contiguous. A percent-or-custom
  label (`showText?: (value, percent, key) => string | number` - **a formatter, not a toggle**,
  the label always renders) sits centered in every segment, and a small dashed-line "flag" tooltip
  (`showTooltip`, same non-boolean shape) floats above each segment showing its raw value, only
  when it actually fits the segment's own width. `active`/`activeTarget`/`activeEvent` are a
  third, distinct shape from every other component here - see below. Emits `click`/`dblclick`/
  `contextmenu`/`mouseover`/`mouseout` once per segment.
- **`BarGaugeChart`** - ported from `bargauge.js`, which `extend`s `chart.brush.core` directly.
  **Despite the name pairing it with "bar" charts, it is not axis-based at all** - it never reads
  `axis.x`/`axis.y`, only `axis.c(0)` (the whole chart plot area, `chart.grid.panel`'s default
  cell) - and despite "gauge", it's linear/width-fraction geometry, not radial (contrast
  `FullGaugeChart` below). `data: DataRow[]` - each row is one independent horizontal bar (own
  `value`/`title`/`max`/`min`, default `max=100`/`min=0`), stacked vertically by `size`+`cut` px
  per row (defaults `20`/`5`). **Source-confirmed quirk, ported literally**: `min` only ever
  shrinks the fill-width divisor - it is never subtracted from `value` as a baseline offset, so
  `value === min` does NOT render a zero-width bar. No threshold bands, no clamping (`value >
  max` renders a bar wider than the track). Emits `click`/`dblclick`/`contextmenu`/`mouseover`/
  `mouseout` once per row (`dataKey` always `null`).
- **`FullGaugeChart`** - ported from `fullgauge.js`, which `extend`s `chart.brush.donut` and
  literally reuses `DonutBrush.drawDonut()` (the same arc math `DonutChart` already ports as
  `donutSlicePath()`) - a genuine radial speedometer-style progress ring, the shape
  `BarGaugeChart`'s name might suggest but isn't. `data: DataRow` (a single row: `value`/`title`/
  `max`/`min`) renders a background track arc plus a foreground value arc whose sweep is
  proportional to `(value-min)/(max-min)` of the configured `startAngle`/`endAngle` range (`size`
  = ring stroke width, `symbol: "butt"|"round"|"square"` = both arcs' notional cap style, though
  **only the foreground arc actually gets `stroke-linecap` set** - the background track is always
  the SVG default `"butt"` cap regardless of `symbol`, confirmed from source). No threshold bands,
  no needle/pointer. **No per-element event forwarding** - confirmed `fullgauge.js` never calls
  `addEvent()` anywhere, a genuine upstream absence, not an oversight of this port.
- **`PinChart`** - ported from `pin.js`, which `extend`s `chart.brush.core` directly. A single
  reference marker at ONE x-axis position (`split`, default `0` - a data INDEX for a `"block"`
  x-axis, or a raw domain value for a `"range"` x-axis, matching the source's generic
  `axis.x(...)` call): a full-plot-height vertical line, a small downward-pointing triangle "flag"
  near the top, and an optional centered label above it. `format`'s presence, not just its return
  value, GATES the label's existence (`showText = typeCheck("function", brush.format)` upstream) -
  omitting it hides the label entirely. `format` receives `axis.x.invert(d)`: for a block axis this
  is the (floored) domain INDEX (`OrdinalScale.invert()`, newly ported this iteration), not the
  category label; for a range axis it's the (possibly domain-CLAMPED) raw value, not necessarily
  the literal `split` passed in. No per-element events - `pin.js` never calls `addEvent()`.
- **`SelectBoxChart`** - ported from `selectbox.js`, which `extend`s `chart.brush.core` directly. A
  row of cells spanning the full plot height, bucketed along a `"range"` (numeric) x-axis by a
  constant `interval` (default `1000`, matching `chart.grid.date`'s own default) - each cell is
  invisible until hovered (`fill-opacity`/`stroke-opacity` 0 -> `theme('selectBoxBackgroundOpacity'
  )`/`theme('selectBoxBorderOpacity')`), purely declarative (bucket boundaries come from
  `interval`, not drag-to-select - no mousedown/drag tracking exists upstream). **Deliberate scope
  decision, not a shortcut**: the source's own `axis.x.ticks("milliseconds", axis.get("x").interval)`
  call only exists on jui-chart's date/time scale (`chart.grid.date`/`dateblock`), a whole axis
  type this port doesn't have; re-reading `util/scale/time.js` showed the unit is always the
  literal string `"milliseconds"` (hardcoded), so the real behavior is plain linear ms-stepping
  with no calendar-arithmetic complexity - ported as that stepping math directly against this
  port's existing numeric `"range"` x-axis rather than building a new date-axis subsystem for one
  72-line brush (see `SelectBoxChart.vue`'s header comment and `PORT_STATUS.md` for the full
  finding). The LAST cell keeps the same width as every other cell even when `interval` doesn't
  evenly divide the domain span (a faithfully-preserved overshoot quirk, matching the source's own
  `rangeBand()`-for-all-cells shape). Emits `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`
  per cell with `data: {start, end}` (the bucket boundaries) - `dataIndex`/`dataKey` are always
  `null` (a cell isn't a row of `props.data`), matching `addEvent()`'s own "whole object, not an
  index" call shape (`this.addEvent(r, {start, end})`, no 3rd arg).
- **`HeatmapChart`** - ported from `heatmap.js`, which `extend`s `chart.brush.core` directly (NOT
  related to `heatmapscatter.js` despite the shared file-naming pattern). One cell per DATA ROW (no
  `target` concept at all upstream) - both axes must be `"block"`-type with an explicit `domain`
  array; `xField`/`yField` name the row fields that position each cell (a component-level
  substitute for the source's `key`-configured block axis, see `useHeatmap.ts`). `textField`
  (default `'text'`)/`format` set the cell's always-rendered label (unlike `PinChart`'s `format`,
  this never hides the label). **The engine has no gradient/interpolation color primitive** -
  `colors?: string[]` stays a plain per-ROW-index array (this port's established convention), with
  the source's own `"none"` sentinel preserved (-> `heatmapBackgroundColor`) and a missing entry
  falling back to the theme palette cycle (a deliberate improvement over the source's own broken
  zero-`colors`-config default - see `HeatmapChart.vue`'s header comment). A genuinely continuous
  gradient (e.g. a realistic activity heatmap) is new, port-only infrastructure - see
  `useColorScale` below. Native hover swaps only `fill-opacity` (no tooltip exists upstream). Emits
  `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` per cell (`dataIndex` real, `dataKey`
  always `null`, `data` the whole row).
- **`HeatmapScatterChart`** - ported from `heatmapscatter.js`, which also `extend`s
  `chart.brush.core` directly (not related to `heatmap.js`). NOT a scatter chart with heatmap-style
  point coloring - it's a coarse 2D density grid: every `(row, target)` point is computed exactly
  like `ScatterChart`'s own points, then binned into an `xDist x yDist` grid (`xInterval`/
  `yInterval` props, both required - the source's own `0` default divides by zero), one `<rect>`
  per OCCUPIED bucket. `colors?: string[]` is per-TARGET (matching every other multi-target
  component, unlike `HeatmapChart`'s per-row indexing - see `HeatmapScatterChart.vue`'s header
  comment for why the two brushes' color models genuinely differ). **Faithfully-preserved quirk**:
  a bucket's rendered color and forwarded event payload are always its FIRST point - later points
  landing in an already-occupied bucket are dropped from what's rendered (confirmed from
  `createScatter()`'s own `tableObj.element == null` guard). **Axis substitution**: this port has
  no date/time axis type (first found porting `SelectBoxChart`) - the x-axis stays `"block"`-type,
  and `xInterval` means "ticks per bucket column" rather than the source's literal domain-unit
  meaning; the y-axis is unaffected (always `"range"`, literal source meaning). Emits `click`/
  `dblclick`/`contextmenu`/`mouseover`/`mouseout` per occupied bucket.
- **`PyramidChart`** - ported from `pyramid.js`, which `extend`s `chart.brush.core` directly - a
  genuinely new blend of two prior precedents, not a clean fit for either alone: like
  `BarGaugeChart`, not axis-based at all (only `axis.area()`, the plot-area rect); like
  `PieChart`/`DonutChart`, a single `data` row's `target` keys become colored segments. **Despite
  the visual association with "funnel charts", each segment is NOT independently sized by `value /
  max`** - the whole shape is one solid triangle (apex top-center, full-width base at the bottom by
  default) and each segment is a trapezoid SLICE of it, sized by `value / total` (that row's own
  total) and sorted value-descending (largest = widest = the base). `reverse` flips which end is the
  wide base (inverted funnel: apex at the bottom). `showText`/`format(key, value, rate)` render a
  leader-line + label per segment, with a literal (preserved, not "fixed") upstream label-dodge
  quirk when consecutive labels land within `pyramidTextLineSize`px - see `PORT_STATUS.md` for the
  exact formula. Emits `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` per segment
  (`dataIndex` always `null`, matching `PieChart`'s own established deviation).
- **`ArcEqualizerChart`** - ported from `arcequalizer.js`, which `extend`s `chart.brush.core`
  directly (source-confirmed - NOT a `pie.js`/`donut.js` variant despite the "pie-family" grouping
  this port's own notes used before reading the source, and NOT sharing an `extend` chain with
  `equalizer.js`/`bargauge.js`/`fullgauge.js` despite the shared naming pattern). Not axis-based.
  Unlike `PieChart`/`DonutChart`/`PyramidChart` (always a single `data` row), `data` here is
  `DataRow[]` - one equal-angle wedge (`360 / rowCount` degrees, a row-COUNT split, NOT `PieChart`'s
  value-weighted slice angles) per row. Within a wedge, each `target` stacks radially outward from
  `textRadius` as small annular-sector "blocks" (`Math.ceil(stackCount * value/maxValue)` per
  target) - the polar analog of `equalizer.js`'s straight-line block-train, but with a simpler
  flat-ratio block count (no zero-baseline/remainder math). `maxValue` (default `100`) can be a
  plain number or a per-row callback (running max across all rows). Center text shows
  `format(total)` (`total` = sum of every row's every target's raw value; `format` defaults to
  identity). An empty `data` array renders a single fully-filled placeholder wedge in
  `arcEqualizerBackgroundColor` (analogous to `pieNoDataBackgroundColor`). Emits `click`/`dblclick`/
  `contextmenu`/`mouseover`/`mouseout` once per (row, target) block group - **`dataIndex` is the
  real row index here, NOT `null`** (a deliberate deviation from `PieChart`/`PyramidChart`'s own
  precedent, since `data` genuinely is an array of rows, like `BarChart`/`EqualizerChart`).
- **`TimelineChart`** - ported from `timeline.js` (395 lines, Phase C's first/largest item so far),
  which `extend`s `chart.brush.core` directly. A Gantt-style schedule: `data` is a FLAT array of
  EVENTS (not one row per lane), each reading `key`/`stime`/`etime` - `axisY` must be a `"block"`
  axis whose domain is the lane labels (conventionally starting with a blank `''` header row - the
  column date labels render inside it), `axisX` a plain `"range"` (numeric) axis - unlike
  `selectbox.js`, `timeline.js` never calls a date-scale-only method, so no axis substitution was
  needed here (see `TimelineChart.vue`'s header comment). NOT a fit for `useRangeSeries` (lane
  position is a value lookup against the block domain, not a row-position block coordinate, and
  `stime`/`etime` are two separate scalar fields, not one `[low,high]` tuple) - new pure logic lives
  in `useTimeline.ts`. Builds its own `<svg>` root instead of wrapping `ChartBase` (its own custom
  lane-title column + embedded column-header row would otherwise double-render against `ChartBase`'s
  default axis chrome - see the component's header comment). `colors?: string[]` indexed by EVENT
  index (a deliberate deviation from the source's own literal single-constant-color default,
  matching `HeatmapChart.vue`'s established precedent). `barSize` (constant or per-event callback),
  `lineWidth` (inter-event connector stroke), `activeType: "rect" | "bar"` (row-band overlay
  highlight vs. bar-grow + `activeTooltip` label), `activeEvent: "click" | "dblclick"`, `hideTitle`.
  Emits the standard 5 DOM events per bar, plus two genuinely custom ones (`active`, `titleHover`) -
  the first brush in this port whose source calls `chart.emit()` with a non-standard event name.
- **`FocusChart`** - ported from `focus.js` (98 lines), which `extend`s `chart.brush.core` directly.
  A translucent rect + border line on each edge, between two `start`/`end` indices (both `-1` by
  default - nothing renders until both are set) - `ChartBase`-wrapped overlay-only brush, same shape
  as `SelectBoxChart`. Confirmed to have NO dependency on any zoom widget (grepped `focus.js`,
  `zoomselect.js`, `dragselect.js`, and every `jui-chart/examples/*.html` - it's a fully
  self-contained renderer, just with no drag/click logic of its own upstream - see
  `FocusChart.vue`'s header comment). Which axis the selection runs along (`"x"` vs `"y"`) is
  decided by whether `axisY` is `"range"`-typed; against a `"block"` grid axis the overlay expands
  by half a `rangeBand()` on each edge - faithfully including a source quirk where a REVERSED
  selection produces a genuinely different rect, not a mirror image (see "What's simplified"
  below). Adds an opt-in `selectEvent` prop (e.g. `"click"`) for a 2-click range picker over
  per-category hit cells, since the source has no interaction of its own - see "What's simplified".
  Emits `change` with the resolved `{start, end, data}`.
- **`FlameChart`** - ported from `flame.js` (390 lines), which `extend`s `chart.brush.core`
  directly (only REUSES `treemap.js`'s `NodeManager` as a data-structure helper, no `extend`
  relationship to it) - this port's first genuinely hierarchical brush. `data` is a FLAT array of
  `{index, text, value}` rows (`index` a dot-separated tree path, e.g. `"0.1.0"`), rebuilt into a
  plain object tree by the new `useFlame.ts` (not a port of `chart.brush.treemap.node`'s own
  classes). The root always spans the full plot width; each child's width is `parentWidth *
  (value / parent.value)` - never normalized against a children-value-sum (a faithfully-preserved
  quirk). Depth maps to a fixed row height (`plotHeight / maxDepth`); `nodeOrient: "bottom"`
  (default) anchors the root at the bottom row per flame-graph convention. Standalone `<svg>` root
  (not `ChartBase`-wrapped), like `PyramidChart`/`ArcEqualizerChart` - only `this.axis.area()` is
  used upstream, never a `.scale()` call. `nodeColor?: (node) => string` is the real per-node color
  hook (source's own literal default is a single constant color, with no `colors[]`-cycling
  deviation invented here - see `FlameChart.vue`'s header comment for why). `format?: (node) =>
  string|number` renders a label only when supplied (matches source) - source has NO narrow-rect
  truncation logic anywhere (checked explicitly), so this port doesn't invent one either; a caller
  wanting that supplies a shortening `format` (demoed in `FlamePage.vue`). `activeIndex` zooms into
  a subtree - source's own filtering logic (`createFilteredNodes()`/`setCacheParents()`/...) was
  re-derived as a much simpler, algebraically-verified-equivalent parent-pointer walk
  (`filterFlameActive()` in `useFlame.ts`) rather than ported literally, since this port's tree is
  a stable `computed()` (source's own version only exists to cope with a fresh `NodeManager`
  rebuilt on every draw call) - see "What's simplified" below for the added `zoomEvent` prop.
- **`TreemapChart`** - ported from `treemap.js` (774 lines), `extend`s `chart.brush.core` directly
  (this brush DEFINES `chart.brush.treemap.nodemanager`, which `flame.js` only borrows). Same flat
  `{index, text, value}` row shape as `FlameChart`, but **multiple rows may share depth 1** (many
  top-level siblings, e.g. several disk folders - `chart.brush.treemap.nodemanager`'s real `root` is
  a synthetic, never-rendered wrapper, unlike `flame.js`'s single-root assumption); rebuilt into a
  plain object FOREST (`buildTreemapForest()` in `useTreemap.ts`), not a single tree. Layout is the
  **squarified treemap algorithm** (Bruls et al.), not slice-and-dice, values processed in the given
  order (no descending sort anywhere in source). Only leaf nodes are ever drawn as rectangles -
  non-leaf nodes are invisible grouping containers that can get a `titleDepth` (default `1`) title
  label instead. A real, algebraically-re-derived-and-hand-traced finding: source's own nested-
  grouping logic (`convertNodeToArray()`/`treemapMultidimensional()`) always reduces to exactly 2
  geometric levels regardless of the input tree's real depth - a chain of single-child non-leaf
  ancestors is harmless, but siblings 3+ levels apart that aren't a simple chain lose their
  intermediate grouping boundary (demoed explicitly in `TreemapPage.vue`'s "Exact-coordinate
  reference #2" section) - see `useTreemap.ts`'s header comment for the full derivation. Default
  `nodeColor` cycles the theme palette by each leaf's TOP-LEVEL ancestor (`this.color(
  getRootNodeSeq(node))` upstream). No click-to-drill-down or any other interaction exists in source
  (checked explicitly, unlike `FlameChart`'s deliberate `zoomEvent` addition) - per-element event
  forwarding (rect only, not title/per-leaf text - confirmed a genuine difference from `flame.js`,
  which forwards from both) is this port's only interaction surface, matching source exactly.
- **`TopologyChart`** - ported from `topologynode.js` (711 lines), `extend`s `chart.brush.core`
  directly. **Real graph nodes+edges, genuinely different from `TreemapChart`/`FlameChart`'s shared
  flat tree-row shape** - each row is `{ key: string, outgoing: string[], ...fields }`; edges are
  derived from `outgoing`, no separate edges/links array. Layout is delegated to
  `grid/topologytable.js`'s own procedural placement (`sort: "linear" | "random"`, this port's
  own prop) - confirmed NOT force-directed physics and NOT caller-supplied coordinates (the
  original example's `x`/`y` data fields are never read); `"linear"`'s deterministic-X/random-Y
  zigzag scan has a real, hand-traced quirk where a row's rendered position is generally the point
  computed for a DIFFERENT row (see `useTopology.ts`'s `layoutTopologyLinear` doc comment).
  `widget/topologyctrl.js` (drag/zoom/pan, 191 lines) is confirmed genuinely OPTIONAL - the brush
  renders and is fully interactive with no awareness of it, like `focus.js`/`zoom.js`. Its viewport
  pan/zoom (not its separate, still-unported individual-node-drag interaction) is ported as this
  port's first widget, exposed as `pannable`/`zoomable` boolean props applied via a single
  `scale()/translate()` wrapping `<g transform>` (confirmed mathematically equivalent to source's
  own per-node/per-edge coordinate scaling - see `useTopologyZoom.ts`). Edge lines run from just
  outside the source node's own circle to
  just outside the target's (pulled back by that endpoint's own radius + a marker radius, both
  distances scaled by the SOURCE's own node scale, never the target's); a reciprocal pair (A->B and
  B->A both present) shares ONE rendered line (the second direction reuses it and just gets its own
  end-marker dot) with a real, order-dependent asymmetry in which direction's activation cascades to
  its reciprocal (preserved exactly, not symmetrized - demoed explicitly in `TopologyPage.vue`).
  `activeEvent` (default `"click"`) gates both node and edge activation; an edge's tooltip only
  shows when BOTH `tooltipTitle`/`tooltipText` are supplied (matches source's own gate). Per-node
  generic event forwarding only (`this.addEvent` is never called for edges in source, so this port
  doesn't invent any either) plus two named events, `nodeclick`/`edgeclick` (renamed from
  `topology.nodeclick`/`edgeclick` - a literal `.` isn't valid in a Vue `v-on` event name).
- **`PieChart`** / **`DonutChart`** - not axis-based (see below). `showText: "inside" | "outside" | null`,
  `format(key, value, total)`, `active`/`activeEvent` (wedge pull-out + dim - see below).
  `DonutChart` additionally takes `size` (ring thickness) and `showValue`. Each takes a single
  `data` row - for multiple rows see `PieGrid`/`DonutGrid` below. Emits `click`/`dblclick`/
  `contextmenu`/`mouseover`/`mouseout` per wedge (`dataIndex` always `null` - see "What's
  simplified" below); `PieGrid`/`DonutGrid` do not re-forward these emits from their inner cells.
- **`PieGrid`** / **`DonutGrid`** - small-multiples grid, ported from the original's `axis.c`
  small-multiples mode (one pie/donut per row of an array). Takes `data: DataRow[]` plus the same
  `target`/`theme`/`colors`/`showText`/`format`/`showTooltip`/`active`/`activeEvent` props as
  `PieChart`/`DonutChart` (forwarded to every cell), plus grid-layout props: `columns` (default
  `3`), `rows` (default: auto, `ceil(data.length / columns)`), `gap` (px between cells, default
  `16`), and `titleField` (a field name read from each row for that cell's title, e.g.
  `"region"`). Internally composes independent `PieChart`/`DonutChart` instances - see
  `PORT_STATUS.md` for why this differs from the original's shared-brush architecture.
- **`ChartLegend`** - ported (adapted) from `widget/legend.js` (324 lines), `extend:
  "chart.widget.core"`. **Architectural adaptation, not a literal port**: source never takes its
  own label/color list - it introspects a *sibling brush* on the same shared chart instance
  (`chart.get("brush", index)`, reading that brush's own `target`/`colors`). This port's chart
  types are independent Vue components with no shared chart instance to introspect, so
  `ChartLegend` instead takes an explicit `items: {label, color}[]` prop, and the caller (a demo
  page, or any consuming app) builds that list from the same `target`/`colors` it already passes
  to the paired chart - see `PORT_STATUS.md`'s "legend.js" entry for the full reasoning, and why
  this is this port's precedent for any future widget that also assumes the original's
  shared-chart-instance model (unlike `topologyctrl.js`'s "opt-in prop" precedent, which only
  generalizes to a widget with no independent visual surface of its own). `orient: "horizontal" |
  "vertical"` (source's `top`/`bottom` vs. `left`/`right`, collapsed since a standalone legend has
  no chart plot-area edge to hug - see `useLegend.ts`), `align: "start" | "center" | "end"`,
  `width`/`height`/`fontSize`/`dx`/`dy`. `toggleable` (ported from source's `filter: true` mode)
  emits a `toggle: {label, index}` event on click instead of mutating a sibling brush directly (it
  can't reach one); pair it with a controlled `hidden: string[]` prop (dims the swatch/text to
  `legendSwitchDisableColor`, matching source's own disabled-state recolor) and filter the paired
  chart's own `target` array by the same list - see `ChartLegendPage.vue`'s demo. Swatch is always
  a plain circle (source draws a different shape - a sliding pill/toggle-switch - only in
  `filter:true` mode; this port uses one shape for both, a documented deviation - see
  `ChartLegend.vue`'s header comment).

### `active` / `activeEvent`

Ported from `pie.js`/`donut.js`'s `setActiveEvent()` and `line.js`'s
`setActiveEffect()`/`setActiveEffects()`. `active: string | string[] | null` (default `null`)
statically marks one or more `target` keys as active; `activeEvent: string | null` (default
`null`) names a DOM event (`"click"`, `"mouseover"`, ...) that toggles/highlights a wedge or
series on that event.

- **Pie**: the active wedge pulls out along its center angle by `theme('pieActiveDistance')`
  and the rest dim to `theme('pieDisableBackgroundOpacity')`.
- **Donut**: same pull-out, but never dims (matches `donut.js` calling the shared
  `setActiveEvent()` with `useOpacity=false`).
- **Line**: the active series stays at full opacity; the rest dim to
  `theme('lineDisableBorderOpacity')`.
- **Area**: same opacity math as Line, but - matching a quirk in the original where
  `area.js` overrides `draw()` and never calls `line.js`'s `drawLine()` (the only place
  `setActiveEffects()`/the event wiring live) - only the optional outline stroke
  (`line: true`, the default) is affected; the translucent fill never dims.

A `"mouseover"`/`"mouseenter"` `activeEvent` restores on `mouseout` for Pie/Donut/Line/Area (a
usability improvement over the original, whose raw event listener never auto-resets); `"click"`
toggles/pins with no such auto-reset.

**`BarChart` is different**, ported from `bar.js`'s own `active`/`activeEvent` (a distinct
interaction from the above, never shared with pie/donut/line/area upstream):

- `active: number | null` is a flat, **row-major bar index** (one entry per `(row, target)` pair,
  in draw order) - not a series/target name like every other chart. Ported literally from the
  original's own doc comment ("Activates the bar of an applicable index").
- The active bar stays at full opacity; every other bar - and any `display` min/max marker on it -
  dims to `theme('barDisableBackgroundOpacity')`.
- `activeEvent` sets the triggered bar (skipping bars with value `0`) as the new active index and
  shows a value-only tooltip at its position. Ported **literally with no toggle and no
  mouseout-reset** (bar.js's handler has neither - every trigger just overwrites the active index
  and it stays until the next one), unlike the mouseout-restore behavior above.

**`RateBarChart` is a third, distinct shape again**, ported from `ratebar.js`'s own
`setActiveBarElement(activeIndex, activeTarget)` - **row-scoped, not whole-chart**:

- `activeIndex: number | null` (a row index) + `activeTarget: string | null` (a target key within
  that row) together address one segment - unlike `BarChart`'s flat index, this is a
  `(row, target)` pair.
- Dimming (to `theme('rateBarDisableBackgroundOpacity')`) only ever applies to a segment in the
  SAME row as `activeIndex` whose own key differs from `activeTarget` - every segment in every
  OTHER row stays at full opacity, always. So the visible effect is "dim this one row's other
  segments", not a whole-chart highlight like `BarChart`'s `active`.
- `activeEvent` (a DOM event name) overwrites the active `(activeIndex, activeTarget)` pair to
  whichever segment it fires on - same one-way-overwrite shape as `BarChart`'s `activeEvent`
  (no toggle, no mouseout-reset).
- **`ChartBase`** - the shared `<svg>` + plot-area + axis chrome (grid lines, baseline, tick
  labels) that Line/Area/Bar all render inside of.
- **`ChartTitle`** / **`ChartTooltip`** - small standalone widgets (ported from `title.js` /
  `tooltip.js`), wired in via each chart component's `title` prop and hover state respectively.

### `stacked`

`LineChart`/`AreaChart`/`ScatterChart`/`BarChart` all take a `stacked?: boolean` prop (default
`false`), ported from `stackline.js`/`stackarea.js`/`stackscatter.js`/`stackbar.js`/
`stackcolumn.js`. Each target stacks cumulatively on top of the previous one along the range
(value) axis - target array order = stacking order, first target at the base - using Phase A's
`useStackedSeries` (a drop-in alternative to `useSeries` with the identical output shape) as the
series source instead of `useSeries`.

**Design decision: a `stacked` prop on the existing components, not separate `StackAreaChart`/
`StackLineChart`/`StackScatterChart`/`StackBarChart` components.** `stackarea.js`/`stackline.js`/
`stackscatter.js` are confirmed-from-source 1-line wrappers - `{ extend: "chart.brush.<base>",
draw() { return this.draw<Base>(this.getStackXY()) } }` - that override nothing but which point
*source* feeds the unchanged base renderer. `stackbar.js`/`stackcolumn.js` are **not** that trivial
(271/117 lines - a near-full reimplementation of `bar.js`, confirmed by reading it end-to-end
rather than assuming from the `extend` keyword alone; see `BarChart.vue`'s header comment and
`PORT_STATUS.md` for the full source-reading writeup) - but the design decision still holds: the
Vue-side rendering primitive (an axis-aligned rect per segment) and data flow are unchanged between
grouped and stacked bars, only the geometry formula and the row-vs-segment granularity of
`display`/`active`/`activeEvent` differ, both handled as `props.stacked` branches inside the same
file. This is a closer match to this port's own `BarChart` `orient` precedent (`orient` merges
bar.js/column.js into one component since the underlying math is identical modulo an axis swap)
than to `PieChart`/`DonutChart`'s precedent of staying separate components (justified there by
real, pervasive rendering differences - ring vs. full circle, different theme tokens, donut's
never-dims `active`). A separate stacked component would just re-import and re-render through its
base component's own template/logic - pure duplication with no independent behavior to justify a
new file, for any of the 4 charts.

`LineChart`/`ScatterChart` needed no other change to support this - neither `drawLine()` nor
`drawScatter()` ever reads another target's data, so swapping the point source is the whole change.
**`AreaChart` needed one deliberate deviation**: `drawArea()` closes every target's fill down to
the *same* fixed baseline regardless of stacking, so a literal port would make each target's fill
span baseline-to-its-own-cumulative-height (each one fully covering the ones beneath it) rather
than a clean band - upstream only "looks right" via a `g.prepend()` z-order trick plus translucent
fill-opacity (the shortest/base layer occludes the bottom of every taller layer beneath it). This
port instead computes each stacked band's fill bottom edge as the *previous* target's own y-curve
(instead of always the baseline), producing a true non-overlapping band with no z-order/opacity
dependency - simpler, more robust, and the visual a stacked-area consumer actually expects. See
`PORT_STATUS.md` for the full writeup and the exact-coordinate Playwright verification.

**`BarChart` needed the most real behavioral change of the 4** (see `BarChart.vue`'s header
comment for the complete source-confirmed accounting): segments render as plain, unrounded rects
(unlike grouped mode's rounded corners); a value===0 segment renders nothing at all (no hit area,
no event forwarding); segment thickness is one-per-row with no `innerPadding` gap, and `minSize`'s
meaning shifts from "near-zero-value length clamp" (grouped) to "whole-stack thickness floor"
(stacked) - both ported faithfully because that's what `stackbar.js` itself does; `display`
selects against each row's stack *total* (a new `selectDisplayIndices()` in `useSeries.ts`, since
that's not any single target's own value); `active`/`activeEvent` dim/reveal a whole row (every
segment + its stack-total tooltip together), not a single segment, confirmed from `stackbar.js`'s
own `barList` being one entry per ROW (not per segment, unlike bar.js). **Not ported**: `edge`
(`drawStackEdge()`'s optional diagonal connector lines between adjacent rows' segment boundaries) -
a self-contained, default-off, purely cosmetic addition, documented as a known gap in
`PORT_STATUS.md` rather than silently dropped.

### `normalize` (100%-normalized stacking)

`BarChart` additionally takes a `normalize?: boolean` prop (default `false`, only meaningful when
`stacked` is also `true`), ported from `fullstackbar.js`/`fullstackcolumn.js`. Each row's stack
always spans the full plot width/height, proportioned only by that row's own targets' share of its
own total - a row's raw total has zero effect on the rendered geometry, only on how much of the
full span each segment claims.

**Source-confirmed**: `fullstackbar.js` `extend`s `stackbar.js` (a real relationship: several
helpers - `getBarElement`/`setActiveEffect`/`setActiveEventOption`/`getTargetSize` - are inherited
unmodified) but `draw()` itself is a full reimplementation using a different algorithm entirely
(each row's own value/sum ratio, not the cumulative-through-the-axis-domain approach `stackbar.js`
uses) - chosen as a `normalize` prop *alongside* `stacked` (not a `stacked: 'true' | 'full'` union
or a separate component) specifically because that's the relationship the source expresses: a real
"stacked, plus a normalization flag" extension, not one of this port's genuinely-separate sibling
pairs (like `bubble.js`/`scatter.js` or `area.js`/`rangearea.js`).

**The normalization math does not touch the value axis at all**: derived by hand from
`util.scale.linear.js`'s `func.rate(value, max) = func(func.max() * (value / max))` - since `func`
is linear from a domain starting at `0`, the domain max cancels out algebraically, leaving a plain
`(value / sum) * totalPixelSpan`. So the axis's configured domain has **zero effect** on segment
geometry (only on the optional percent-text label's scaling, and only as a convention - both
original demos set the value axis's domain to `[0, 100]` so ticks read like a percent scale, but
`normalize` doesn't enforce or compute that relabeling itself). New pure `normalizeStackFractions`
(per-row cumulative `[0,1]` fraction boundaries) computes the geometry directly, bypassing
`useStackedSeries` entirely (that composable maps through the axis scale - the wrong tool once the
axis scale doesn't matter). `showText?: boolean | ((percent: number) => string)` renders an
optional per-segment percent label, `Math.round((value / sum) * axis.max())` - ported literally,
including the non-obvious fact that it's only a true 0-100 percentage when the axis domain max
happens to be configured as `100`.

**`active`/`activeEvent` behave identically to `stacked`'s row-level semantics** (the same
inherited `setActiveEffect`/`setActiveEventOption`, wired the same way). **`display` has no effect
at all** in `normalize` mode - genuinely unwired upstream (`fullstackbar.js` never reads
`this.brush.display`, and never initializes `stackTooltips`, so even the inherited
`setActiveEffect()`'s own tooltip-dimming guard silently no-ops) - there is no row-total tooltip in
this mode, active row or not, confirmed both from source and by Playwright (no tooltip `<rect>`
renders even with `active` set).

### `ChartCanvasBase` (Phase E - canvas rendering backend)

A SECOND rendering backend, alongside every component above's shared `ChartBase.vue`/
`useChartLayout`/`useAxis`/`useScale` SVG engine - Phase E ports jui-chart's canvas-2D and
hand-rolled-3D brushes, which have no SVG DOM to render into at all. `ChartCanvasBase` is this
backend's own `ChartBase.vue`-equivalent: it owns a `<canvas>` element's devicePixelRatio-aware
sizing (crisp on retina displays) and `requestAnimationFrame`-loop lifecycle
(`start()`/`stop()`/auto-cleanup on unmount), and hands a consuming component a ready-to-draw 2D
context every "frame" via `@frame="(ctx, frameInfo) => ..."` - once per reactive prop change by
default (`animate: false`, most Phase E brushes), continuously via RAF when `animate: true`
(physics/kinetic-driven brushes, rotating 3D widgets). It can't reuse `ChartBase.vue`'s
`<slot/>`-based composition (canvas drawing is imperative, not declarative DOM) - see
`PORT_STATUS.md`'s Phase E infra entry for the full design writeup, including a real timing bug
found and fixed via canvas pixel-readback (Playwright) verification, the pattern this whole phase
now follows since canvas has no DOM attributes to inspect the SVG side's tests always relied on.

Phase E has an explicit, documented exception to the rest of this project's "zero runtime
dependency on jui-chart/juijs-graph" rule, scoped ONLY to files that are generic, non-chart-domain
utility code (see `PORT_STATUS.md`'s Phase E policy section) - `ChartCanvasBase`/`useCanvasChart`
themselves are NOT such a file (they're genuine, from-scratch chart-rendering infrastructure, same
as everything else in this project); `base/kinetic.js` (below) is the first file that does get
that exception.

### `ActiveBubbleChart` (Phase E)

Ported from `activebubble.js` (`chart.brush.canvas.activebubble`) - the first canvas BRUSH ported
(`ChartCanvasBase` above is shared infrastructure, `Bubble`/`MortalBubble` below are shared
primitives; this is the first actual chart on top of both). `extend: "chart.brush.canvas.core"` ->
`chart.brush.core`, the same SVG-side brush base every component above builds on - the canvas core
only adds 3D-polygon-sorting machinery `activebubble.js` never uses, so this brush behaves exactly
like an SVG one apart from drawing to a `CanvasRenderingContext2D`. Genuinely non-axis-based
despite living in the axis-based engine (only `axis.area()` for the plot rect, never `axis.x`/
`axis.y` - same shape as `BarGaugeChart` above): `props.data` rows are drained into `MortalBubble`s
that spawn at the top-left and drift under a gravity/collision physics simulation, not any
data-value-to-coordinate mapping. **A real, source-confirmed quirk preserved literally**: the
brush's own "gravity" (`props.gravity`, default `0.2`) is a purely HORIZONTAL force (the source's
own `gDirection = [1, 0]`, not `[0, 1]`) - bubbles drift rightward, not downward, bounded to
`[0, height]` vertically. No maximum concurrent bubble count and no auto-respawn: once every
spawned bubble's `duration` (default `1000`ms, per-row overridable) elapses, it's gone for good
until the caller appends more rows to `data` - see `useActiveBubble.ts`'s header comment for the
full spawn/lifecycle/gravity writeup and `/activebubble`'s demo page for a "spawn a burst" example.

### `BubbleCloudChart` (Phase E)

Ported from `bubblecloud.js` (`chart.brush.canvas.bubblecloud`) - imports the PLAIN, non-mortal
`Bubble` (confirmed from the source's own import path; `MortalBubble` never appears here), so
unlike `ActiveBubbleChart` above, bubbles never die. Same `extend` chain and non-axis-based shape
as `ActiveBubbleChart` (`props.width`/`height` directly are the plot rect). **NOT a kinetic force
simulation, despite `Bubble extends KineticObject`**: every bubble's position is lerped a fraction
of the way toward the canvas center each frame (direct position arithmetic, decaying toward zero
over time) and pairwise-separated from overlapping neighbors by an O(n²) collision pass that runs
EVERY frame with no decay - so the cloud settles into, and then HOLDS, a non-overlapping packed
layout rather than drifting or dying. Bubble `name`/size come from each row's `"title"`/`"capacity"`
fields (hardcoded field names, matching source - not a configurable `domain`/`target`). **The
rebuild cache is REFERENCE-equality, not deep-equality, confirmed from source and ported
literally**: `props.data` is compared by `!==` across frames - reassigning it to a brand-new array
with IDENTICAL row values still forces a full rebuild (every bubble re-scattered to a random
position and re-settled), while reassigning the exact same array reference is a cache hit that
just keeps stepping the already-settled simulation. Hovering a bubble (native `mousemove`/
`mouseleave`) dims every other bubble to 50% alpha, routed through `widget/canvas/picker.js`'s own
ported mechanism (`usePickerWidget.ts`'s `runPickerCheck` - `BubbleCloud.pick` is this widget's
real, confirmed sole consumer anywhere in the source tree). `@click`/`@dblclick` also route through
it, exposing `pickedRow`/`pickedLabel`/`pickedVia` (source's own `examples/bubblecloud.html` wires
`widget: [{type: "canvas.picker"}]` + a `picker.dblclick` handler) - only updated on an actual hit,
never cleared by a miss, matching source. See `useBubbleCloud.ts`'s header comment for the full
algorithm/caching writeup and `/bubblecloud`'s demo page for "shuffle values" / "same values, new
array" / "touch cache" buttons that exercise all three cache paths, plus the click/dblclick pick
readout.

### `ActiveCircleChart` (Phase E)

Ported from `activecircle.js` (`chart.brush.canvas.activecircle`) - same `extend: "chart.brush.
canvas.core"` chain as `ActiveBubbleChart`/`BubbleCloudChart` above, but **the first canvas brush
in this phase that's genuinely AXIS-BASED**: it positions circles at `[axis.x(data.x),
axis.y(data.y)]`, a real data-value-to-pixel mapping, not a plot-rect + physics shape. Confirms the
axis/scale math already built for Phases A-D's SVG components is rendering-backend-agnostic -
`ActiveCircleChart.vue` reuses `useChartLayout`/`useAxis` AS-IS (`props.axisX`/`axisY` take the same
`AxisConfig` every axis-based SVG component takes), just feeding the computed scale positions to
canvas draw calls instead of `<circle>` elements; no new axis composable was needed. Unlike
`activebubble.js`'s `Bubble`/`MortalBubble`, `Circle` here is a wholly bespoke, non-`KineticObject`
incline-plane physics object (mass/friction/gravity/normal-force) - only its `move()`/`stop()`/
`draw()` are ever actually called by the real brush; `checkForMotion()`/`calcAcceleration()` (plus
the brush-level `checkWallCollision()`) are confirmed DEAD CODE (their call site is commented out
in source) but ported and unit-tested anyway, same treatment as `BubbleCloud.processData()`'s own
confirmed-dead diff logic. **A real, source-confirmed quirk preserved literally**: circles are
seeded from `props.data` only on the very FIRST frame that finds zero live circles (`chart.
getCache("active_circle", [])`, no `drawBefore()` reset hook at all) - appending or replacing rows
afterward has **no effect** for the rest of the component's lifetime, unlike either sibling brush's
own drain/rebuild cache; a port-only `reset()` (exposed via `defineExpose`, not in source) clears
the live simulation so the next frame re-seeds from whatever `data` currently holds. See
`useActiveCircle.ts`'s header comment for the full writeup (including the preserved `massToWeight`
2nd-argument-discarded bug in `calcAcceleration()`, and the `tpf === 1`-skip-first-frame guard's
relationship to the not-yet-ported `chart.animation` polling wrapper) and `/activecircle`'s demo
page for the hand-computed pixel-position walkthrough and the "add more rows has no effect until
reset" demonstration.

### `Dot3DChart` (Phase E)

Ported from `dot3d.js` (`chart.brush.canvas.dot3d`) - same `extend: "chart.brush.canvas.core"`
chain as its siblings, but the first canvas brush in this phase to actually exercise that base
class's `addPolygon()`/`drawAfter()` z-order sort, and **the first with REAL 3D projection math**:
genuine homogeneous 4x4 rotation matrices (`rotate3dx`/`y`/`z`, from `degreeX`/`degreeY`/`degreeZ`
props) composed around a rotation center, plus a separate depth-based perspective scale that
shrinks a vertex toward `perspective` (default `0.9`) as it nears the far plane - not a 2D
shading/gradient effect. This math isn't `dot3d.js`'s own: it's a thin canvas-drawing adapter over
the SEPARATE `juijs-graph` package's own `chart.polygon.{core,point,line}` vertex/matrix engine
(confirmed via source read, resolving a flagged "check its actual relationship to `polygon/*`"
task) - ported to `usePolygon3d.ts`, hand-ported rather than vendored after a web search for its
distinctive names (`rotate3dx`/`matrix3d`/`PointPolygon`/`LinePolygon`/`FacePolygon`) found no
matching published library. Supports all four of the original's `symbol` modes (`"dot"`/`"line"`/
`"poly"`/`"area"`), one shared `colorIndex` for the whole series (not per-row), and a REAL,
non-obvious depth/rotation-center formula reproduced exactly from `juijs-graph`'s actual caller
(`calculate3d()`): the perspective "far plane" is `Math.max(plotAreaWidth, plotAreaHeight, depth)`,
not `depth` itself, and the rotation center's z is `depth/2` while the perspective-scale center's z
uses that larger effective-depth value's own `/2` - two DIFFERENT values in general. **Deliberate
scope boundary**: the original's `axis.z` is a full third `chart.axis` grid (ticks/chrome) - the
grid/chrome part remains out of scope here; this component maps a `zDomain` to `[0, depth]` pixels
via the same `createLinearScale()` every axis composable already uses. The interactive rotation
part IS ported (`widget/polygon/rotate3d.js` -> `useRotate3d.ts`, see its own composable entry
below) - `/dot3d`'s demo page wires a real mouse drag over the `degreeX`/`degreeY` props alongside
the existing "+15deg" buttons. **Two preserved rendering
bugs, confirmed from source and NOT fixed**: the `"poly"` symbol's closing-fill triangle only ever
appears at the chart's 3rd data row (`i === 2`), regardless of how many rows actually exist (a
`data.length-1` vs. `datas.length-1` mixup in the original), and its anchor point is cached ONCE,
for the component's entire lifetime, from whatever the very first render's first row projected to -
a later full data replacement does not move it. See `useDot3d.ts`'s header comment for the full
writeup (plus a third, `"area"`-specific quirk: `FacePolygon`'s baseline corners share the CURRENT
point's z, not their own) and `/dot3d`'s demo page for the hand-computed pixel walkthrough and
live rotation buttons.

### `EqualizerColumnChart` (Phase E)

Ported from `equalizercolumn.js` (`chart.brush.canvas.equalizercolumn`, the CANVAS version - distinct
from the already-ported SVG `equalizerbar.js`/`equalizercolumn.js` behind `BarChart`'s `equalizer`
prop) - same `extend: "chart.brush.canvas.core"` chain as `ActiveCircleChart`, and likewise
genuinely AXIS-BASED (column mode: `axisX` a `"block"` category axis, `axisY` a `"range"` value
axis). **NOT 3D, confirmed by a full read** despite sitting next to `Dot3DChart` in this phase: it's
a plain 2D stacked "block-train" column visual (`canvas.rect()`/`.fill()`) with an animated
level-meter bounce overlay - zero references to `chart.polygon.*`/`usePolygon3d.ts` anywhere.
Reuses the SAME block-train stacking math (`equalizerStackedBlocks`/`equalizerUnitSize`/
`rangeAxisTickBand`, `useSeries.ts`) already extracted for the SVG sibling - the algorithm is
byte-identical between the two rendering backends. **This brush turned out to be `widget/raycast.js`'s
one real, confirmed consumer anywhere in the `jui-chart`/`juijs-graph` source tree** (Phase D had
investigated `raycast.js` and found it transitively out of scope for exactly this reason - see
above) - a plain axis-aligned rectangle hit-test against a cached per-column area, NOT 3D ray
casting despite the name, gated by resolving a click's block-axis category index
(`resolveRaycastBlockIndex`, Node-cross-checked against this port's existing `OrdinalScale.invert()`
- see `useRaycast.ts`). No independent visual surface in source (an empty `<g>`, pure event
remapping), so this port wires it directly from `EqualizerColumnChart.vue`'s own `@click` handler
rather than a standalone widget component, exposing `pickedRow`/`pickedIndex` (only updated on a
hit, matching source never "unpicking" on a miss). **Two confirmed-dead `getBarElement()` fields
dropped** (zero rendered-pixel effect): border stroke config (`.stroke()` is never actually called
in the block-drawing loop) and a `hidden` flag that's computed but never read. **Two confirmed,
PRESERVED source bugs**: an unbalanced `save()`/`save()`/`restore()` in the error-flag draw, and the
animated total-label's `font` missing a font-family entirely. See `useEqualizerColumn.ts`'s and
`useRaycast.ts`'s header comments for the full writeup (including the block-index Node-cross-check
derivation) and `/equalizercolumn`'s demo page for the toggleable error flag and interactive pick
readout.

### `Column3DChart` / `Line3DChart` (Phase E)

Ported from `column3d.js`/`line3d.js` (`chart.brush.polygon.column3d`/`line3d`) - both
`extend: "chart.brush.polygon.core"` -> `"chart.brush.core"`, a DIFFERENT Phase E base from every
prior canvas brush's `chart.brush.canvas.core`. **A real surprise, confirmed by a full read**:
despite living in `jui-chart/src/brush/polygon/` and this port's own earlier "canvas 3D" framing,
both brushes render REAL SVG `<polygon>` elements, never a `CanvasRenderingContext2D` - so these
two components compose `ChartBase` (this port's SVG scaffolding, same as `BarChart`), not
`ChartCanvasBase`. The 3D-ness is entirely in the vertex math: `column3d.js` builds a real cube
(`CubePolygon`, 8 vertices/6 faces - a new primitive added to `usePolygon3d.ts`, since `dot3d.js`
only ever needed 1-4-vertex point/line/face polygons) per (row, target) cell; `line3d.js` builds a
flat 4-point ribbon quad (via `PointPolygon`, the SAME single-vertex primitive `dot3d.js`'s own
`createDot` already uses) per row-to-row segment, per target - both funneled through the exact same
`chart.polygon.core`'s `PolygonCore.rotate()` pipeline `usePolygon3d.ts`'s `rotatePolygonVertices()`
already ports for `dot3d.js`. **Closely related but NOT identical structure** - see
`useColumn3d.ts`/`useLine3d.ts`'s header comments for the confirmed geometry difference, plus a
real, source-confirmed `padding` default divergence (`column3d.js`: 20, `line3d.js`: 10).
**Genuinely axis-based with a REAL third (z) block axis** - unlike `dot3d.js`'s deliberately
scope-limited linear z, `axis.z` here is a real `chart.grid.block` (ordinal) grid whose true
upstream domain IS the `target`/series list itself (one z-slot per series), so this port's existing
`createOrdinalScale()` (the same primitive `useAxis.ts` uses for x/y category axes) is directly
reusable, just with range `[0, depth]` - no rendered z-axis tick/grid chrome, matching `dot3d.js`'s
own already-documented scope boundary. Color/opacity, confirmed from source: one color per TARGET
(`this.color(targetIndex)`/`this.color(dataIndex, targetIndex)` - the extra `dataIndex` argument is
a confirmed dead no-op in this port's `colors?: string[]` mode), with a real preserved quirk where
the SAME theme opacity number (`polygonColumnBorderOpacity`/`polygonLineBorderOpacity`) is reused
BOTH as a `darkenColor()` rate for the stroke color AND as that stroke's own `stroke-opacity`.
`column3d.js` forwards per-column `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` (skipped
for a zero-value column, matching source); `line3d.js` forwards nothing (confirmed: source never
calls `addEvent`). See `useColumn3d.ts`/`useLine3d.ts`'s header comments for the full write-up and
`/column3d`/`/line3d`'s demo pages for live rotation - both a real mouse-drag (`useRotate3dDrag`,
the ported `widget/polygon/rotate3d.js`) over X/Y and the existing "+15deg" buttons (Z has no drag
widget in source either) - verified via an exact SVG `points` attribute cross-check against an
independent Node computation of the same exported composable functions (stronger than the
pixel-readback every other Phase E demo uses, since these brushes render real, directly-inspectable
SVG rather than a canvas raster), both at rest and mid-drag.

### Composables

- **`useScale`** - `createLinearScale`/`createOrdinalScale`, ported from `util/scale.js`, including
  `OrdinalScale.invert()` (this iteration - a domain INDEX round trip, ported from
  `util.scale.ordinal()`'s `invert()`, needed by `PinChart`'s `axis.x.invert(d)` call).
- **`useAxis`** - turns a `"block"`/`"range"` axis config into a scale + tick list, ported from
  `grid/block.js`/`grid/range.js` (including range.js's "nice domain" outward-expansion algorithm
  - see `useAxis.spec.ts` for pinned input/output pairs, one of them hand-traced from `bar.html`'s
  own data). Also exports `resolveAxisOrient()`, ported from `chart.axis`'s `drawGridType()`
  orient coercion (defaults/validates an axis config's `orient` per whether it's bound to x or
  y).
- **`useSeries`** - data rows -> per-target pixel coordinates, ported from `chart.brush.core`'s
  `getXY()`; also exports `curvePoints()` (a Bezier-control-point spline solve for `symbol="curve"`,
  via a Thomas-algorithm tridiagonal solve - audited in Phase F and confirmed distinct from
  `cardinal-spline-js`/Catmull-Rom, so it stays a hand-port, not vendored),
  `useStackedSeries()` (`getStackXY()`, cumulative per-target stacking), `selectDisplayBars()`
  (`bar.js`'s `display` min/max/all bar-selection logic), `useRangeSeries()` (the two-values-
  per-point `[low, high]` tuple model `RangeAreaChart`/`RangeBarChart` need - a genuinely
  different shape from `SeriesPoint`, not a `useSeries` wrapper like `useStackedSeries` is),
  `rangeAreaPolygonPoints()` (`rangearea.js`'s forward-low/backward-high polygon trace),
  `rangeGroupGeometry()` (the shared `outerPadding`/`innerPadding` group-size formula from
  `rangebar.js`/`rangecolumn.js`'s `drawBefore()`), `candleBodyGeometry()` (`candlestick.js`'s
  `open > close` branch selection plus the body rect's value-axis `y`/`height` - genuinely
  different from `useRangeSeries()`'s 2-value tuple model, since candlestick reads 4 independent
  scalar fields with no `target` array at all), `equalizerBlocks()` (`equalizer.js`'s
  zero-to-value block-train math, with per-block color-band index), `equalizerStackedBlocks()`
  (`equalizerbar.js`/`equalizercolumn.js`'s block-train math for a `stacked` segment - a
  genuinely different algorithm, see `EqualizerChart`/`BarChart`'s `equalizer` prop above),
  `equalizerUnitSize()` (their `unit = band / (brush.unit * padding)` block-size formula),
  `rangeAxisTickBand()` (a range axis's tick pixel spacing - `util.scale.linear.js`'s own
  `rangeBand()`, not otherwise exposed by this port's `AxisResult`), `roundedRectPath()` (a
  4-independent-corner-radius SVG path helper, shared by `BarChart`'s single-end-rounded bars and
  `RateBarChart`'s pill-shaped segments), `rateBarSegments()` (`ratebar.js`'s per-row nonzero-
  target-filtered fraction/percent geometry - see `RateBarChart` above), `rateBarRowLayout()`
  (its row-vertical-placement formula, reserving `tooltipSize`px above the bar for the flag
  callout), and `rateBarActiveOpacity()` (its row-scoped `active`/`activeTarget` dimming rule).
- **`usePie`** - pie/donut slice angle math (trig, no axis involved), ported from `pie.js`'s
  `drawUnit()`; also exports `pieInsideLabelDeclutter`/`pieOutsideLabelDeclutter` (label collision
  avoidance for `showText="inside"`/`"outside"` - see "What's simplified" below).
- **`usePyramid`** - `PyramidChart`'s pure logic: `pyramidSegments()` (`value / total` rate +
  value-descending sort, ported from `getCalculatedData()`), `pyramidTrapezoids()` (the trapezoid-
  vertex/divider-line trig - each segment a slice of one solid triangle, not an independently-sized
  row), `pyramidLabelPlacements()`/`pyramidLabelY()` (leader-line label placement, including a
  literal, preserved-not-fixed upstream dodge-formula quirk - see `PORT_STATUS.md`).
- **`useArcEqualizer`** - `ArcEqualizerChart`'s pure logic, genuinely new (not reused from
  `usePie`'s value-weighted angle math or `useSeries`'s pixel-based `equalizerBlocks`/
  `equalizerStackedBlocks`, though it DOES reuse `mathUtil`'s `radian`/`rotate` polar primitives,
  the same ones `usePie` uses): `arcEqualizerLayout()` (center/radius/block-thickness from
  width/height/`textRadius`/`stackCount`), `arcEqualizerStackAngle()` (`360 / rowCount`, a
  row-COUNT angular split), `arcEqualizerMaxValue()` (plain number or per-row callback resolution),
  `arcEqualizerRows()` (per-target block COUNTS via `ceil(stackCount * value/maxValue)`, plus the
  empty-`data` placeholder-row fallback), `arcEqualizerBlockPath()` (one annular-sector "block" `d`
  path - two arcs plus two radial lines, the same construction as a donut ring slice but closed
  into a solid band), `arcEqualizerWedgeBlocks()` (stacks a row's per-target block counts radially,
  continuing each target from where the previous one left off).
- **`useTimeline`** - `TimelineChart`'s pure logic: `timelineKeyIndex()`/`timelineRowIndex()` (lane
  label -> positional index lookup, string-coerced like the source's own object-key map),
  `timelineBarGeometry()` (per-event rect geometry + the negative-span/`NaN` validity guard),
  `timelineRowFillKind()` (header/even/odd row background selection), `timelineConnectors()` (the
  inter-event connector line pairing, including the literal preserved quirk where a connector's
  destination endpoint ignores the destination event's OWN validity), `timelineActiveBarLayout()`
  (the `activeType="bar"` grow-to-full-row-band geometry), and `timelineOverlayStyle()`/
  `timelineBarFillMode()` (the active/hover interaction-state formulas, algebraically derived to
  replace the source's separate `setActiveRect`/`setHoverRect`/`setActiveBar`/`setHoverBar`
  functions with one steady-state formula each - see the module's own doc comments for the
  derivation).
- **`useScatter`** - `ScatterChart`'s pure logic: `resolveScatterSymbol()` (fixed shape or
  per-point callback), `isScatterHighlighted()` (hover/`activeEvent` highlight-matching, with or
  without `hoverSync`), `scatterTrianglePoints()` (triangle marker geometry).
- **`useBubble`** - `BubbleChart`'s pure logic: `scaleValue()` (ported from `util.math`'s function
  of the same name - the linear radius-scaling math), `bubbleRadiusDomain()`/`bubbleRadius()`
  (resolves the `scaleKey`-or-own-value radius domain and scales one bubble's radius into it),
  `bubbleFormatText()` (the whole-row `format` callback, or the point's own raw value).
- **`useGauge`** - `BarGaugeChart`/`FullGaugeChart`'s pure logic: `barGaugeFillWidth()` (the
  `min`-is-divisor-only fill-width quirk), `barGaugeRowY()` (per-row vertical stacking),
  `barGaugeRowInput()`/`fullGaugeRowInput()` (each brush's own field defaults - genuinely
  different: `bargauge.js`'s `title` default is `""`, `fullgauge.js`'s has no default at all),
  `fullGaugeEndAngleLimit()`/`fullGaugeCurrentAngle()`/`fullGaugeRate()`/`fullGaugePaddingAngle()`
  (the value-arc sweep-angle math), `fullGaugeRadii()` (`fullgauge.js`'s own inline radius
  formula, deliberately different from `DonutBrush.getProperty()`'s - see `FullGaugeChart` above).
- **`useGridLayout`** - small-multiples grid cell-rect math (`gridCellRect`/`gridCells`/
  `resolveGridRows`), ported from `grid/table.js`'s `scale(i)` (the grid type `axis.c` uses for
  pie/donut small-multiples). Consumed by `PieGrid`/`DonutGrid`.
- **`usePin`** - `PinChart`'s pure geometry: `pinGeometry()` (the label/triangle/line coordinates,
  hand-derived from `pin.js`'s literal translate chain), `pinTrianglePoints()` (the SVG polygon
  points string).
- **`useSelectBox`** - `SelectBoxChart`'s pure logic: `selectBoxTicks()` (the domain-bucketing
  stepping math - see `SelectBoxChart`'s own entry above for why this runs over a `"range"` x-axis
  instead of a genuine date/time axis), `selectBoxCells()` (tick pairs -> `{start, end, x, width}`
  cells, all sharing the first pair's pixel width).
- **`useHeatmap`** - `HeatmapChart`'s pure logic: `heatmapCells()` (per-row grid cell position/size,
  looking up `xField`/`yField` against a block axis's scale directly - no `useAxis.ts`/`useScale.ts`
  changes were needed, see `HeatmapChart`'s own entry above).
- **`useHeatmapScatter`** - `HeatmapScatterChart`'s pure logic: `heatmapScatterGrid()` (bucket
  count/size from tick-index span x yInterval-value span), `heatmapScatterBucketIndex()` (rounds +
  clamps a point to its bucket, ported from `getTableData()`).
- **`useFocus`** - `FocusChart`'s pure logic: `focusGridAxis()` (which axis the selection runs
  along, from `axis.y.type`), `focusPixelRange()` (indices -> pixel range, including the
  reversed-selection quirk - see `FocusChart`'s own entry above), and `resolveFocusSelection()` (the
  ADDED 2-click range-picker state machine - not ported, `focus.js` has no selection logic of its
  own).
- **`useFlame`** - `FlameChart`'s pure logic, this port's first genuinely hierarchical composable:
  `buildFlameTree()` (flat `{index,text,value}` rows -> a plain object tree with real `children`/
  `parent` pointers, replacing `chart.brush.treemap.node`/`nodemanager`'s own imperative classes),
  `getFlameMaxDepth()`/`findFlameNode()`, `layoutFlameNodes()` (the recursive width/position math,
  hand-traced against a 4-level, 8-node tree in `useFlame.spec.ts`), `filterFlameActive()` (the
  `activeIndex` zoom filter, re-derived as a simpler equivalent to source's own
  `createFilteredNodes()` dance and algebraically verified against it - see that function's own
  doc comment), and `flameNodeOpacity()`/`flameTextX()`/`flameTextY()` (the dimmed-ancestor opacity
  and label-position formulas).
- **`useTreemap`** - `TreemapChart`'s pure logic: `buildTreemapForest()` (flat `{index,text,value}`
  rows -> a plain object FOREST, not a single tree - see `TreemapChart`'s own entry above),
  `squarifyRects()` (the squarified treemap algorithm itself - `normalize`/`Container.
  getCoordinates()`/`cutArea()`/`calculateRatio()`/`improvesRatio()` ported faithfully, hand-traced
  against a 4-value case in `useTreemap.spec.ts`), `layoutTreemapForest()` (the 2-pass group-then-
  leaf layout this file's own header comment algebraically derives as equivalent to source's
  arbitrary-depth-looking `treemapMultidimensional()`/`convertNodeToArray()` recursion, hand-traced
  against both a 2-level mixed-sibling case and a 3-level single-child-chain case), plus
  `treemapTitleAnchor()` (the literal, not-a-true-minimum `getMinimumXY()` port) and
  `treemapTextX()`/`treemapTextY()` (the independent horizontal/vertical per-leaf label axes).
- **`useTopology`** - `TopologyChart`'s pure logic: `layoutTopologyLinear()`/`layoutTopologyRandom()`
  (ported from `grid/topologytable.js`'s own `chart.topology.sort.linear`/`.random` - confirmed
  real, hand-traced procedural placements, not physics, not caller-supplied coordinates - see this
  file's own doc comments for the full row-shuffle-quirk derivation), `getDistanceXY()`/
  `buildTopologyEdges()` (the edge pull-back geometry + reciprocal-pair "connect"/`ownsLine`
  detection, hand-traced against a clean-integer 2-node case and a differing-node-scale case in
  `useTopology.spec.ts`), `topologyActiveEdgeKeysForNode()`/`ForEdge()` (the connect-gated,
  order-dependent active-cascading asymmetry), and the edge-label/tooltip placement helpers
  (`topologyEdgeAlign()`/`topologyEdgeTextPosition()`/`topologyBalloonPoints()`/
  `topologyTooltipPosition()`/`topologyTooltipTitleNames()`).
- **`useTopologyZoom`** - `TopologyChart`'s `pannable`/`zoomable` props, ported from
  `widget/topologyctrl.js` (this port's first widget): `clampTopologyZoomScale()`/
  `topologyZoomDirection()` (the `±0.1`-step, `[0.6, 2]`-clamped wheel zoom, rounded to avoid the
  float drift source's own raw `+=`/`-=` accumulates), `computeTopologyPan()` (source's `boxX`/
  `boxY` running-total drag-pan, algebraically simplified to a closed form and hand-traced across a
  chained 2-gesture drag in `useTopologyZoom.spec.ts`), and `topologyViewportTransform()` (the
  `scale()/translate()` string, confirmed by derivation to exactly match
  `grid/topologytable.js`'s own `(base + view) * scale` getter formula).
- **`useColorScale`** - **new, port-only infrastructure, not ported from jui-chart** (confirmed
  absent: the engine's `this.color()`/`chart.color()` is a flat per-index-or-function palette
  lookup, no gradient/interpolation exists anywhere in `juijs-graph`). `interpolateColor()` (linear
  RGB interpolation between two hex colors, `t` clamped to `[0,1]`), `createColorScale()` (a
  `(value) => hexColor` function over a numeric domain and 2+ color stops). Used by `HeatmapPage`'s
  demo to build a `colors[]` array for `HeatmapChart` - see that component's entry above for why the
  gradient lives in the demo, not the component itself.
- **`useActive`** - `active`/`activeEvent` hover-interaction math shared by Pie/Donut/Line/Area
  (`toActiveKeySet`, `pieActivePullOffset`, `pieActiveOpacity`, `lineActiveOpacity`), ported from
  `pie.js`'s `setActiveEvent()` and `line.js`'s `setActiveEffect()`/`setActiveEffects()`.
- **`useTheme`** - `classicTheme`/`darkTheme` flat token objects, ported from
  `src/theme/classic.js`/`dark.js` (trimmed to tokens the ported brush types actually use,
  including `candlestick(Border|Background)Color`/`candlestickInvert(Border|Background)Color` -
  see the doc comment on `ChartTheme`).
- **`useChartLayout`** - shared padding/plot-area/axis computation, used by `ChartBase` and by
  each axis-based chart component directly (not read back out of `ChartBase`'s slot - see its
  doc comment).
- **`useLegend`** - `ChartLegend`'s pure layout math, adapted from `widget/legend.js`'s `draw()`
  flow-layout algorithm (`computeLegendLayout()`: place items left-to-right, wrap to a new row at
  the box's own `width` for `orient="horizontal"`, or stack in a single column for `"vertical"`,
  then position the whole block per `align`) - see that file's header comment for the
  orient/align adaptation and `ChartLegend.vue`'s for the "explicit `items` prop, not sibling-brush
  introspection" architectural decision. Text width is injected via a `measure` callback
  (`ChartLegend.vue` passes `measureTextWidth` from `tooltipMeasure.ts` at runtime) so the
  wrap/align math itself stays pure and hand-traceable in `useLegend.spec.ts` without needing real
  font metrics.
- **`useHoverGuide`** - pure pointer-position helpers shared by `LineChart`'s `guideline`/
  `crosshair` props: `toSvgPoint()` (client coords -> this chart's own SVG user-unit space,
  accounting for `max-width: 100%` shrink - same formula as `TopologyChart`'s own
  `toViewportPoint()`), `nearestIndexByPosition()` (`guideline`'s nearest-data-row snap, computed
  off already-rendered pixel positions rather than `guideline.js`'s own domain/interval math - see
  its doc comment for why), and `invertAxisValue()` (`crosshair`'s raw axis-value readout, with a
  clamp `cross.js` doesn't need since this port's axes can be `block`-type). `clamp()` is also
  exported. Hand-traced in `useHoverGuide.spec.ts`.
- **`useZoomWindow`** - pure row-index-window math for `LineChart`'s `zoomable` prop, ported from
  `widget/zoom.js`: `computeDragZoomWindow()` (a completed drag-rectangle's pixel extent ->
  `[start, end)`, offset by the current window so a second drag on an already-zoomed view composes
  onto it) and `clampZoomWindow()` (clamps against the original data length, rejecting a
  degenerate/zero-width drag - ported from `axis.zoom()`'s own `setZoom()`). No new axis/scale
  primitive was needed - a real zoom is just a sliced `data` ref fed into the SAME
  `useChartLayout()`/`useSeries()` calls `LineChart.vue` already makes (see its doc comment for the
  full source trace confirming this is how the real engine's `axis.zoom()` works too, not an
  approximation). Hand-traced in `useZoomWindow.spec.ts`.
- **`useDragSelect`** - pure hit-testing/normalization for `LineChart`'s `dragSelect` prop, ported
  from `widget/dragselect.js`: `pointsInDragRect()` (which of a chart's already-rendered points fall
  inside a dragged pixel rectangle - hit-tests in pixel space rather than porting source's own
  four axis-type-specific value comparisons, an equivalent reformulation since every scale this port
  has is a monotonic value<->pixel bijection - see that file's doc comment), `normalizeDragRect()`
  (sorts a dragged rectangle's corners, for `dragSelectMode="area"`), and `isDegenerateDragRect()`
  (rejects a zero-width-or-height drag, ported from `endZoomAction()`'s own guard). Hand-traced in
  `useDragSelect.spec.ts`.
- **`useScrollWindow`** - pure scrollbar math for `LineChart`'s `scrollable`/`verticalScrollable`
  props, ported from `widget/scroll.js`/`widget/vscroll.js` (confirmed identical after an s/x/y/
  swap - all formulas here are orientation-agnostic): `canScroll()` (gates rendering on
  `data.length > visibleCount` - a documented simplification, source always draws a possibly
  oversized/undraggable thumb instead); `computeThumbSize()` (the track's visible/total ratio,
  ported from `drawBefore()`); `clampThumbGap()` (the drag's in-track clamp); `computeScrollStart()`
  (the dragged gap -> row-index `start`, ported from `mousemove()` - algebraically simplifies to
  `floor(gap * dataLength / trackSize)`, preserving source's own `+1` edge correction so a full
  rightward/downward drag reaches the TRUE last page rather than stopping one row short); and
  `computeThumbGapFromStart()`, the inverse used to render the thumb's resting position from the
  committed row-index `start` (a port-specific addition - source treats the pixel gap itself as the
  single source of truth, this port treats the row index as canonical instead, the same shape as
  `useZoomWindow`'s own `zoomWindow`). Hand-traced against `LinePage`'s real demo geometry in
  `useScrollWindow.spec.ts`.
- **`useZoomScroll`** - pure edge-resize/center-pan math for `LineChart`'s `zoomScrollable` prop,
  ported from `widget/zoomscroll.js`: `computeZoomScrollTick()`/`computeZoomScrollRestingWidths()`
  (the widget's track-tick size and resting dimmed-zone widths, derived from the committed
  `{start,end}` window); `computeLeftEdgeWidth()`/`computeRightEdgeWidth()` (each edge handle's live
  drag width, hard-clamped at the crossing boundary rather than source's own reject-and-freeze -
  confirmed equivalent end behavior, since the dragged width is always recomputed from a FIXED
  mousedown-anchor each tick, not incrementally); `computeCenterPanLeftWidth()`/
  `computeCenterPanStart()` (the center pane's live pan position - structurally the same
  fixed-width-pan math `useScrollWindow`'s `computeScrollStart` already implements, confirmed from
  source, though not a literal call-through since `scroll.js`'s own thumb-size-ratio fudge doesn't
  apply to a user-resized pane); and `resolveLeftEdgeWindow()`/`resolveRightEdgeWindow()`/
  `resolveCenterPanWindow()` (each drag type's completed-drag `{start,end}` window, fed through
  `useZoomWindow`'s existing `clampZoomWindow` at the call site - reused as-is, confirmed to already
  clamp against the right `originLength`). `clampCornerRadius()` keeps the dimmed-zone rounded-rect
  corners (drawn via `useSeries.ts`'s existing `roundedRectPath()`, reused rather than duplicated)
  from overshooting a zone that's shrunk to just a few pixels wide mid-drag. All hand-traced against
  `LinePage`'s real demo geometry in `useZoomScroll.spec.ts`.
- **`useCanvasChart`** (Phase E) - `useCanvasChart(canvasRef, {width, height, dpr?})`: DPI-aware
  `<canvas>` backing-store sizing (`computeCanvasBackingSize()`, hand-traced for dpr=1/2/1.5/
  invalid-dpr/zero-size in `useCanvasChart.spec.ts`), returning a `context` already
  `setTransform`-scaled so every caller draws in plain CSS pixels. `useAnimationFrameLoop(onFrame)`
  - a generic `requestAnimationFrame` loop (`start`/`stop`/auto-cleanup on unmount) with
  `computeFrameDelta()` (hand-traced: first-frame-is-0, normal ~60fps gap, clamping a
  backgrounded-tab's resume jump to `maxDelta`, negative-delta guard). Genuinely new architecture -
  see `ChartCanvasBase`'s own entry above and `PORT_STATUS.md`'s Phase E infra writeup; nothing in
  Phases A-D's SVG engine has an equivalent.
- **`kinetic`** (`src/composables/kinetic.ts`, Phase E) - **not a hand-port.** `base/kinetic.js`
  (`util.canvas.base.kinetic`) is a small, self-contained, generically-named physics object (mass/
  friction/position/velocity/acceleration - `force()`/`update()`/`distance()`/`direction()`/...)
  with zero chart-domain logic, so per `PORT_STATUS.md`'s Phase E policy (explicit user
  instruction) it's PERMANENTLY exempt from this project's "hand-reimplement everything" rule that
  every actual chart/rendering-engine file otherwise follows. The real, unmodified original is
  vendored byte-for-byte at `src/vendor/kinetic.js`, typed by hand at `src/vendor/kinetic.d.ts`;
  `kinetic.ts` itself is only the thin instantiation shim the original's jui module loader would
  otherwise provide (`export const KineticObject = kineticModule.component()`). See
  `PORT_STATUS.md`'s kinetic.js entry for the full writeup, including why this required adding
  `juijs-graph` as a real (but narrowly-scoped) runtime dependency in `package.json`.
- **`bubble`/`mortalBubble`** (`src/composables/bubble.ts`/`mortalBubble.ts`, Phase E) - genuine
  hand-ports of `base/bubble.js`/`base/mortalbubble.js` (confirmed NOT external: no license header,
  no web-search match, unlike `kinetic.js`/`hidpi.js`/`getCurvePoints` above). `Bubble`/
  `MortalBubble` are `class ... extends KineticObject` (the direct TS equivalent of the originals'
  `extend: "util.canvas.base.kinetic"`) - but `draw` had to be assigned as an INSTANCE property in
  the constructor (`this.draw = (context, now) => {...}`, after `super()`), not a normal class-body
  method, because the vendored `KineticObject`'s own constructor already sets `this.draw` as an
  own property (a no-op stub), which permanently shadows a same-named prototype method; this
  mirrors the originals' own constructors, whose last statement does exactly the same overwrite.
  `MortalBubble`'s age/radius/cross-fade-animation math is a pure `computeMortalBubbleFrame()`
  (extract-the-math-from-the-draw-call convention, same as `useCanvasChart.ts`), every case hand-
  traced (and cross-checked against an isolated Node evaluation) in `mortalBubble.spec.ts`. See
  `PORT_STATUS.md`'s `base/bubble.js`/`base/mortalbubble.js` entry for the full classification
  writeup, the exact animation-math derivation, and the `/bubble-demo` Playwright pixel-readback
  verification (including a real RAF-timing race the verification script itself had to work around).
- **`useActiveBubble`** (`src/composables/useActiveBubble.ts`, Phase E) - genuine hand-port of
  `activebubble.js`'s inner `ActiveBubble` class (confirmed chart-domain code, consumed by
  `ActiveBubbleChart` above). Pure logic extracted and hand-traced: `hexToRgba` (thin wrapper over
  the existing `hexToRgb` from `useColorScale.ts`), `computeGravityForce(mass, gravity)` (the
  horizontal-only `[1, 0]` direction quirk), `buildSpawnQueue(items, colorFor, now)` (the
  batch-local color index + `startTime`/`duration` fallback resolution). The `ActiveBubble` class
  itself (O(n²) collision detection/resolution + bounds clamp, mutating a whole `MortalBubble[]`
  population rather than computing one scalar result) is covered by integration-style tests against
  real `MortalBubble` instances instead of further pure-function extraction, including a preserved
  source bug: `preCheck()`'s dead-bubble splice loop doesn't decrement its own index, so a run of
  consecutive dead bubbles needs multiple calls to fully clear - hand-traced through 3 full
  `preCheck()` calls in `useActiveBubble.spec.ts`, not just asserted as "eventually clears." See
  `PORT_STATUS.md`'s `activebubble.js` entry for the full spawn/lifecycle/gravity algorithm writeup
  and the `/activebubble` Playwright verification (including a "rightmost visible bubble pixel"
  row-scan that proves real rightward drift over time, since a single fixed coordinate guess missed
  it in an earlier draft of that check).
- **`useBubbleCloud`** (`src/composables/useBubbleCloud.ts`, Phase E) - genuine hand-port of
  `bubblecloud.js`'s inner `BubbleCloud` class (confirmed chart-domain code, consumed by
  `BubbleCloudChart` above). Pure logic extracted and hand-traced: `computeBubbleRadius(count,
  totalCount, w, h)` (a PROPORTION of the current data set's total, not an absolute mapping -
  confirmed not guarded against `totalCount === 0`) and `computeCenterGravityStep(pos, center,
  alpha)`. `processData()`'s mark-and-sweep-by-name diff and `step()`'s O(n²) collision-resolution
  loop stayed as `BubbleCloud` class methods (same "mutates a whole population" rationale as
  `ActiveBubble.step()` above), hand-traced directly: two 10px-radius bubbles 10px apart resolve to
  EXACTLY `minDist` (24px) apart after one ordered collision pass, confirming `jitter = 0.5` fully
  closes a single pairwise overlap in one application. `hexToRgba` is reused from
  `useActiveBubble.ts` rather than re-declared (the same function under the same name in two files
  broke the `export *` barrel in `src/index.ts` - caught by `build:lib`, not `vitest`). See
  `PORT_STATUS.md`'s `bubblecloud.js` entry for the full settle-and-hold-a-packed-layout algorithm
  writeup (confirmed NOT a kinetic force simulation - `Bubble.update()` is a no-op here since
  `force()` is never called), the two-layer reference-equality caching derivation, and the
  `/bubblecloud` Playwright verification (shuffle/same-values-new-array/touch-cache pixel-diff
  checks distinguishing a real rescatter from a cache hit).
- **`useActiveCircle`** (`src/composables/useActiveCircle.ts`, Phase E) - genuine hand-port of
  `activecircle.js`'s `Circle` (a bespoke, non-`KineticObject` incline-plane physics object) and
  `CanvasActiveCircleBrush` (`ActiveCircleField` here). Confirms `useChartLayout`/`useAxis`/
  `toSeriesScale` (the exact composables Phases A-D's SVG components already use) are fully reusable
  for a canvas brush's positioning math with zero changes - see `ActiveCircleChart` above and this
  file's header comment for the full derivation. Pure logic hand-traced directly on the `Circle`
  class (constructed with plain `(value) => number` scale functions, not a cached `axis` object -
  same recreatable-context deviation rationale as `ActiveBubble`/`MortalBubble`): `checkForMotion`/
  `calcAcceleration` (angle/friction incline-plane math, confirmed DEAD in the real brush - see
  `PORT_STATUS.md`), `poundToWeight`/`weightToPound`/`massToWeight`/`weightToMass` (unit-conversion
  helpers), `updateAcceleration`/`move` (the position math actually exercised every frame - hand-
  traced including the missing `0.5` factor on the `a*t²` term, preserved not fixed), and the
  standalone `checkWallCollision` (also dead code - preserves a real swapped-bounds quirk explained
  in its own doc comment, tied to a "range" y-axis's pixel interval being reversed). `ActiveCircleField.
  step()` hand-traces the "seeds circles only on the first call that finds zero, never again
  afterward" spawn quirk directly (a LATER call with completely different rows is asserted to have
  zero effect). See `PORT_STATUS.md`'s `activecircle.js` entry for the full writeup and the
  `/activecircle` Playwright verification (hand-computed `scaleX(v) = 48 + 40.8*v` / `scaleY(v) =
  248 - 22.8*v` pixel positions for a fixed `min:0/max:10/unit:10` axis domain, a moving circle's
  rightward drift, and the "add more rows has no effect until `reset()`" quirk demonstrated live).
- **`usePolygon3d`** (`src/composables/usePolygon3d.ts`, Phase E) - the slice of the SEPARATE
  `juijs-graph` package's own 3D engine `dot3d.js` needs (`chart.polygon.core`'s `PolygonCore.
  rotate()`, `util/transform.js`'s matrix builders, `util/math.js`'s `matrix3d`/`deepMatrix3d`),
  confirmed hand-port territory (no license header, no matching published library found via web
  search for its distinctive names - see `PORT_STATUS.md`'s `dot3d.js` entry). Exports
  `move3dMatrix`/`scale3dMatrix`/`rotate3dxMatrix`/`rotate3dyMatrix`/`rotate3dzMatrix` (4x4
  homogeneous matrix builders), `multiplyMatrixMatrix4`/`multiplyMatrixVector4` (split from the
  original's single polymorphic `matrix3d(a,b)` into two clearly-typed functions - same output
  either way, just not runtime-dispatched), `rotatePolygonVertices()` (`PolygonCore.rotate()`
  itself - see its own doc comment for the real `depth`/rotation-center formula, which is NOT
  simply `axis.depth`), and `maxZ()`. Hand-traced AND Node-cross-checked (a standalone
  reimplementation of the same formulas run in plain Node against the same inputs before writing
  the assertions): identity-rotation sanity checks, a hand-derived perspective-scale case, and a
  `rotate3dyMatrix(90)` applied to `(1,0,0)` confirming the standard right-handed rotation
  direction. **Extended for `column3d.js`/`line3d.js`** (see those components' own entries above)
  with `cubeVertices()`/`CUBE_FACES` (`chart.polygon.cube`'s 8-vertex/6-face box - a primitive
  `dot3d.js` never needed), `computePolygon3dProjection()` (the shared `calculate3d()` center/
  effectiveDepth derivation, generalized once a 2nd+3rd consumer needed the identical formula
  `Dot3DChart.vue` already hand-reproduces inline - that existing, already-verified component was
  deliberately left untouched rather than retrofitted), and `darkenColor()` (`util/color.js`'s
  `lighten`/`darken` - no license header, no matching published library found via web search for
  "lighten" "darken" hex color javascript `c + (c * rate)` - same hand-port bucket).
- **`useDot3d`** (`src/composables/useDot3d.ts`, Phase E) - `dot3d.js`'s own brush logic:
  `buildDot3dDraws()` (ported from `CanvasDot3DBrush.draw()` + `createDot`/`createLine`/
  `createArea`, covering all four `symbol` modes), `sortDot3dDraws()` (`chart.brush.canvas.core`'s
  `drawAfter()` back-to-front z-order sort), and `radiusDepthScale()` (`createDot`'s separate,
  simpler linear radius depth-cue - distinct from the position projection's own perspective scale).
  Preserves two real rendering bugs from source (the `"poly"` symbol's closing-fill only ever
  firing at row index 2, and its anchor point being cached once for the brush's whole lifetime -
  see `Dot3DChart` above) plus a `"area"`-specific baseline-z quirk, all hand-traced/Node-cross-
  checked directly rather than only observed indirectly through `Dot3DChart`.
- **`useEqualizerColumn`** (`src/composables/useEqualizerColumn.ts`, Phase E) - genuine hand-port of
  `equalizercolumn.js`'s (canvas) non-drawing logic: `isDisabledIndex`/`isErrorColumn` (the
  `active`/`error` array-or-integer-or-null index checks, de-Morgan-inverted in source and ported
  literally), `getTargetColumnWidth`, `computeErrorFlagGeometry` (the error-flag "pennant" shape's
  derived geometry), and `stepEqualizerBounce` (the level-meter's sawtooth bounce animation -
  `UP_SEC_PER_MOVE=20`/`DOWN_SEC_PER_MOVE=30`, hand-traced through a full cycle back to its exact
  starting state). Documents two confirmed-dead `getBarElement()` fields (border stroke, `hidden`)
  and two confirmed source bugs (an unbalanced `save()`/`save()`/`restore()`, a missing font-family
  on the animated total label) - see `EqualizerColumnChart` above and `PORT_STATUS.md`'s
  `equalizercolumn.js` entry for the full writeup.
- **`useRaycast`** (`src/composables/useRaycast.ts`, Phase E) - genuine hand-port of
  `widget/raycast.js` (NOT vendored: no license header, and a web search for its distinctive names
  - `emitBlockAndRangeEvent`, `blockAxis.invert` - found no external library match). `raycastHitTest`
  (the plain axis-aligned rectangle test - the widget's entire geometric content),
  `resolveRaycastBlockIndex` (source's `blockAxis.invert(chartX) - 1`, Node-cross-checked against
  this port's own `OrdinalScale.invert()` - algebraically identical for every non-exact-boundary
  pixel), and `raycastPick` (the cache lookup + hit-test, returning the matched row + index). See
  `EqualizerColumnChart` above for why this is wired directly from that component's own `@click`
  rather than as a standalone widget, and `PORT_STATUS.md`'s `equalizercolumn.js` entry for the full
  real-dependency-graph investigation (this widget's sole real producer is `equalizercolumn.js`, NOT
  `widget/canvas/picker.js` - the two are unrelated despite living in sibling files).
- **`usePickerWidget`** (`src/composables/usePickerWidget.ts`, Phase E) - genuine hand-port of
  `widget/canvas/picker.js`'s entire mechanism: `runPickerCheck`, a thin null-checked dispatch over
  a brush's already-registered `pick(x, y)` function (source: `chart.getCache('picker')`'s
  `{obj, func}` pair, collapsed into a plain closure in TS). This widget's real, confirmed sole
  consumer anywhere in the source tree is `bubblecloud.js` (`BubbleCloud.pick`, matching
  `PickerCheck<T>`'s shape exactly) - see `BubbleCloudChart` above for its click/dblclick wiring.
- **`useColumn3d`** (`src/composables/useColumn3d.ts`, Phase E) - `column3d.js`'s own brush logic:
  `resolveColumnSize()` (`drawBefore()`'s auto-fit `col_width`/`col_height` sizing),
  `buildColumn3dDraws()` (`createColumn`/`draw()` - builds each cube's 8 rotated/perspective-scaled
  vertices via `usePolygon3d.ts`'s `cubeVertices()`/`rotatePolygonVertices()`, then assembles its 6
  `CUBE_FACES` into 2D point lists), and `sortColumn3dDraws()` (the `chart.brush.polygon.core`
  `createPolygon()`/`util/svg.js` `appendAll()` z-order sort). See `Column3DChart` above for the
  full writeup.
- **`useLine3d`** (`src/composables/useLine3d.ts`, Phase E) - `line3d.js`'s own brush logic:
  `buildLine3dDraws()` (`createLine`/`draw()` - each segment's 4-point ribbon quad, `order`
  computed as a batch `maxZ()` over its 4 projected corners, equivalent to source's own incremental
  `maxPoint` tracking across 4 separate single-vertex `createPolygon()` calls) and
  `sortLine3dDraws()`. See `Line3DChart` above for the full writeup, including the confirmed
  structural difference from `useColumn3d.ts`'s cube geometry.
- **`useRotate3d`** (`src/composables/useRotate3d.ts`, Phase E) - genuine hand-port of
  `widget/polygon/rotate3d.js` (`chart.widget.polygon.rotate3d`, `extend: "chart.widget.polygon.
  core"` -> `"chart.widget.core"` -> `chart.draw`; not vendored in `node_modules/juijs-graph` at
  all, only in `jui-chart/src` - no license header, no external library match found for its own
  distinctive names). `computeRotate3dDegree()`/`shouldSkipRotate3dTick()` are the ported, pure
  per-tick math (`dx = sdx + floor((gapY/h)*180)`, `dy = sdy - floor((gapX/w)*180)`, plus a real
  preserved throttle quirk: a tick is skipped only when NEITHER new angle lands on a `unit`-
  multiple boundary). `useRotate3dDrag()` is the Vue-side `setScrollEvent()` equivalent - owns
  reactive `degreeX`/`degreeY` refs, wired to a native `mousedown` + `window`-level `mousemove`/
  `mouseup` drag (same pattern as `LineChart.vue`'s own zoom/scroll drags), converting pointer
  coordinates via the existing `toSvgPoint()` (works for an `<svg>` OR `<canvas>` root alike).
  Confirmed to be the GENERIC drag-to-rotate widget every polygon-based 3D brush
  (`dot3d.js`/`column3d.js`/`line3d.js`) is meant to opt into, mutating the exact `degree.x/y`
  state `usePolygon3d.ts`'s engine already reads - no new engine/axis infrastructure needed. Only
  X/Y are driven by drag (Z has no mouse widget in source either); source's own imperative
  `chart.render()` call has no equivalent here since Vue's reactivity already re-renders any
  component whose bound `degree-x`/`degree-y` prop changed. See `Dot3DChart`/`Column3DChart`/
  `Line3DChart`'s own entries above and `PORT_STATUS.md`'s `rotate3d.js` entry for the full
  write-up, including the Node-cross-checked drag-delta-to-degree math.

## What's simplified relative to the original

- **Fixed, historical bug (noted here since it's a good "how this was caught" reference, not an
  open issue)**: `BarChart`/`LineChart`/`AreaChart`/`ScatterChart` used to render every mark
  shifted an extra `(padding.left, padding.top)` pixels down-right of its true, axis-correct
  position - their series coordinates (from `useSeries`/`toSeriesScale`, which call `axis.scale()`
  directly) are already absolute/padding-inclusive, but were wrapped in an *additional*
  `<g transform="translate(area.x, area.y)">`, double-applying the offset. Found in `BarChart`
  while verifying its `active`/`activeEvent` port, then confirmed and fixed in the other three with
  exact numeric (gridline-pixel-matched) Playwright verification - see `PORT_STATUS.md`'s "HIGH
  PRIORITY" checklist item for the full evidence. Most visible for a mark near an axis's max value,
  which could render clipped entirely by the root `<svg>`'s own boundary.
- **`PieChart`/`DonutChart` still render a single data row each** - by design, not a gap: the
  original draws one pie per `axis.data` row via a shared `axis.c` coordinate grid, but this port
  builds small-multiples (`PieGrid`/`DonutGrid`) by composing independent, already-verified
  single-pie/donut components positioned in a grid, rather than teaching `PieChart`/`DonutChart`
  themselves about multiple rows - see `PORT_STATUS.md` for the full reasoning. Only the `axis.c`
  `"table"` grid type is ported (uniform row-major grid, no custom per-cell sizing, no 3D/mixed
  grid types, no shared cross-cell legend).
- **`FullGaugeChart` still renders a single data row** - same reasoning as `PieChart`/`DonutChart`
  above (its `extend: 'chart.brush.donut'` chain and `axis.c(index)`-per-row geometry are
  architecturally identical to pie/donut's small-multiples model), but no `FullGaugeGrid` wrapper
  exists yet - not built this iteration since it wasn't needed to satisfy this item's scope; a
  future iteration could add one following `PieGrid`/`DonutGrid`'s exact pattern. **`BarGaugeChart`
  does NOT have this limitation** - it takes `data: DataRow[]` directly and renders one bar per
  row in a single instance (`bargauge.js`'s own `eachData` loop already stacks rows vertically
  within one shared `axis.c(0)` cell, unlike `fullgauge.js`/`pie.js`/`donut.js`, which each need a
  *separate* grid cell per row - see `PORT_STATUS.md`).
- **`SelectBoxChart` runs over a `"range"` (numeric) x-axis, not a genuine date/time axis.** This
  port has no date/time `AxisConfig` type at all (a real, confirmed gap - `selectbox.js` is the
  only brush in this port whose source actually depends on one, via `axis.x.ticks("milliseconds",
  ...)`). Since that call's unit argument is always the literal string `"milliseconds"` (hardcoded
  upstream, not configurable), the real math reduces to plain linear ms-stepping with no calendar
  complexity - ported as that exact stepping function against the existing numeric range axis
  instead. A caller wanting real calendar-date buckets (weeks/months/years) would need to convert
  to a numeric domain (e.g. "days since start") themselves; a genuine date-axis type, if ever
  needed elsewhere, would be a separately-scoped future item (new `AxisConfig` variant + `useAxis`/
  `ChartBase` support).
- **`HeatmapScatterChart` runs its x-axis binning over tick-INDEX space, not the source's literal
  date-domain-unit space** - the same missing-date-axis gap as `SelectBoxChart` above, resolved the
  same way (substitute this port's existing `"block"` axis), but with an extra adaptation:
  `xInterval` means "ticks per bucket column" here, not "domain units per bucket." Also: `xInterval`/
  `yInterval` are **required** props with no default, deliberately diverging from the source's own
  unusable `0` default (which divides by zero) - a caller must always supply both explicitly, same
  as the source's own real-world example always does. **The engine has no color-gradient/
  interpolation primitive at all** - confirmed from a full read of `heatmap.js`/`heatmapscatter.js`
  plus `brush/core.js`'s `color()`/`base/builder.js`'s `chart.color()`: both brushes' color is the
  same flat per-index-or-function palette lookup every other brush uses. `useColorScale` (see above)
  is new, port-only infrastructure built because a realistic demo needs one; neither `HeatmapChart`
  nor `HeatmapScatterChart` themselves know anything about gradients (both just consume the
  established plain-array `colors?: string[]` convention).
- **`TimelineChart` deviations, all deliberate and documented in its own header comment**: (1)
  `colors?: string[]` indexed by event, not the source's literal `this.color(i, 0)` default (a
  single constant color for EVERY event unless `colors` is a function - the same shape
  `HeatmapChart`/`HeatmapScatterChart` already found and dropped, see above); (2) builds its own
  `<svg>` root rather than wrapping `ChartBase`, since its own lane-title column + embedded
  column-header row would otherwise double-render against `ChartBase`'s unconditional default axis
  chrome (a real visual bug, not a style preference); (3) `activeEvent` narrowed to
  `'click' | 'dblclick'` from the source's fully-dynamic any-DOM-event-name config - both already
  in this port's standard forwarded set, and the source's own default/every realistic use is
  `'click'`; (4) the `active` prop indexes the raw `data` array position directly, not the source's
  own `cacheRect`-compacted (successfully-rendered-events-only) index space - identical behavior
  unless BOTH an initial `active` is set AND an earlier event is itself invalid (negative/NaN
  span), a combination no demo here exercises. **No genuine date/time axis needed** - unlike
  `SelectBoxChart`/`HeatmapScatterChart` above, `timeline.js`'s own `axis.x.ticks(step)` call is
  already the plain single-argument form this port's `"range"` axis implements; grepping the whole
  395-line source confirms no call into any date-specific scale method.
- **`FocusChart` adds a `selectEvent` click-to-select capability with no source equivalent** -
  `focus.js` is a purely passive renderer (confirmed: no `this.on(...)` and no `addEvent()`
  anywhere in its 98 lines); this port adds an opt-in 2-click range picker over per-category hit
  cells (only offered for a `"block"` grid axis) so the component is genuinely interactive
  standalone, modeled on the SAME "discrete SVG shape + node-level DOM listener" convention every
  other interactive element in this port already uses (e.g. `SelectBoxChart`'s hover cells) - not a
  newly-invented free-drag/pixel-inversion gesture. Also faithfully preserves (not fixed) a real
  source quirk: `drawFocus()`'s `±band/2` block-axis expansion is applied to whichever index is
  literally passed as `start`/`end`, not to whichever pixel position ends up smaller, so a REVERSED
  selection produces a genuinely different rect (narrower, different position), not a mirror image
  - see `FocusChart`'s own entry above and `PORT_STATUS.md` for the exact numbers.
- **`FlameChart`'s `activeIndex` zoom filter is re-derived, not ported line-by-line** -
  `flame.js`'s own `createFilteredNodes()`/`setCacheParents()`/`setCacheChildren()`/
  `sortingCacheNodes()`/`createIndexData()`/`createChildIndexData()` dance rebuilds a fresh,
  re-indexed `NodeManager` (with an `axis.cacheNodes` fallback for indices from an already-zoomed
  view) purely to cope with having no stable tree between imperative draw calls; this port's tree
  is a stable `computed()`, so `filterFlameActive()` in `useFlame.ts` instead just clones the
  active node's real ancestor chain (forcing each clone's `value` to the active node's own, so
  every ancestor-to-child rate is exactly `1`) and keeps its real subtree untouched - algebraically
  verified equivalent to source's own math by hand-tracing both a 1- and a 2-ancestor case (see
  `PORT_STATUS.md`/`useFlame.spec.ts`). A bad/unknown `activeIndex` renders the full unfiltered
  tree instead of reproducing source's own unguarded crash (`null.value`) in that case. **Adds an
  opt-in `zoomEvent` prop** (`'click' | 'dblclick' | false`, default `'click'`) for click-to-zoom -
  source's `activeIndex` is a passive config value with no interaction of its own, same shape as
  `focus.js`'s `start`/`end` - modeled directly on `FocusChart`'s own `selectEvent` precedent
  (clicking any rendered node, including a dimmed ancestor, re-zooms to it; clicking the true root
  zooms back out, so no separate reset mechanism is needed). No `colors[]`-cycling deviation was
  added for the default color (unlike `TimelineChart`/`HeatmapChart`'s own precedent for an
  analogous constant-color source) - `nodeColor`, source's real per-node hook, already covers the
  realistic use case, demoed as a name-hash in `FlamePage.vue`.
- **`TreemapChart`'s nested-grouping layout is re-derived, not a literal port of
  `treemapMultidimensional()`'s own recursive shape** - an algebraic equivalence (not a behavior
  change), hand-traced against both a 2-level and a 3-level case before being trusted, see
  `useTreemap.ts`'s header comment and `TreemapChart`'s own entry above for the full derivation and
  the real (faithfully preserved, not fixed) "only 2 effective geometric levels regardless of tree
  depth" quirk this uncovered. **Unlike `FlameChart`, no click-to-drill-down (or any other
  interaction) was added** - checked explicitly against `draw()`'s full event-wiring (`this.
  addEvent(elem, nodeList[i])` on the drawn rect only, nothing else), source genuinely has none, so
  this port doesn't invent one either; only per-element DOM event forwarding is offered.
- **`TopologyChart`'s layout is a reactive `computed()`, not source's own compute-once cache** -
  `grid/topologytable.js`'s `axis.cacheXY` is computed ONCE per chart instance and reused forever
  even across later data changes; this port recomputes (`sort`/`space`/`data.length`/size aware)
  whenever those change, the natural Vue idiom - an artifact of the engine's own imperative
  re-render lifecycle, not a documented algorithmic feature, so nothing meaningful is lost.
  `activeNode`/`activeEdge` also apply immediately/reactively from first render, unlike source's own
  `this.on("render", (init) => { if (!init) ... })` gate (only applied starting on a chart's
  *second* `render()` call) - same reasoning, and preserving it literally would make the demo's own
  `active-node`/`active-edge` examples look broken on load. The tooltip balloon's box width is
  measured for real (`getComputedTextLength()`, shared with `ChartTooltip`); its height is a
  `fontSize`-based approximation, matching `ChartTooltip`'s own already-documented approximation
  (no true text bbox measurement). `widget/topologyctrl.js`'s viewport pan/zoom is now ported as
  `pannable`/`zoomable` props (see `TopologyChart`'s own entry above); its separate individual-
  node-drag interaction and the drag-to-front z-order it alone triggers are still not ported -
  confirmed genuinely optional, not required for the brush to render or be interactive (node/edge
  click, hover, tooltip, active cascading, and now pan/zoom all work with zero awareness of it).
- **Reactive, not imperative.** No `.render()`/`chart.update()` call - every chart here is
  `computed()` pixel coordinates from props, so it just re-renders when its props change.
- **Skipped even within the ported brush types**: 3d variants, `stackbar.js`'s own `edge` option
  (optional connector lines between adjacent rows' stacked segments - a documented, deliberate gap,
  see "`stacked`" above; `fullstackbar.js`/`fullstackcolumn.js` never wire it either, or `display`,
  in the first place - see "`normalize`" above), entry animations. Hover tooltips are included via
  `ChartTooltip`.
  `active`/`activeEvent` wedge-pulling and line/area dimming interactions are now ported - see
  "`active` / `activeEvent`" above, which now also covers `BarChart`'s own (distinct,
  index-based) `active`/`activeEvent`. `BarChart`'s `display: "max"|"min"|"all"` per-target min/max
  auto-tooltips are also ported - see the `BarChart` bullet above (Line/Area's own `display` isn't
  yet - also tracked in `PORT_STATUS.md`). `ChartTooltip`'s balloon box now
  measures real text width via `SVGTextElement.getComputedTextLength()` (ported from the
  original's `getTextSize()`), rather than approximating from character count.
- **Per-element DOM event forwarding is ported for all 5 components.** The original wires every
  brush element's click/dblclick/mouseover/mouseout/contextmenu to `chart.emit()`, which an
  `event: { click: fn }` builder config subscribes to, with a `{brush, dataIndex, dataKey, data}`
  payload (`brush/core.js`'s `addEvent()`). This port's equivalent is `defineEmits` (`click`/
  `dblclick`/`contextmenu`/`mouseover`/`mouseout`, dropping `brush` and renaming
  `rclick`->`contextmenu` - see `ChartElementEventPayload` in `types.ts`), wired at each
  component's own upstream granularity (confirmed from source to genuinely differ per brush type,
  not a single shape reused everywhere):
  - `BarChart` - per-bar, real `dataIndex`/`data`, skipping `value===0` bars, matching `bar.js`.
  - `LineChart` - per-series-path, `dataIndex`/`data` always `null`, matching `line.js`'s
    `addEvent(p, null, k)` (the whole line, not per-point).
  - `AreaChart` - per-target, `dataIndex`/`data` always `null`, fires regardless of `line`.
    **Deviation**: `area.js`'s own `addEvent(g, null, k)` call is on a single group shared across
    *every* target (declared once outside the per-target loop), so literally, any click/hover
    anywhere on the whole area chart would fire once per target with the same coordinates and no
    way to tell which target was actually under the cursor - this port instead wires per-target
    onto its own existing per-target `<g>`, matching `LineChart`'s shape and giving a real,
    distinguishable `dataKey`.
  - `ScatterChart` - per-marker, real `dataIndex`/`data`, fires for every symbol **including
    `cross`** (which stays non-interactive for hover-recolor/`activeEvent`, matching the source's
    guard placement - `addEvent` itself has no such guard).
  - `PieChart`/`DonutChart` - per-wedge, `dataKey` = the wedge's target key, `data` = the whole row
    (all wedges' values). **Deviation**: `dataIndex` is always `null` (not upstream's literal
    always-`0`) - these components' `data` prop is a single `DataRow`, not an array, so there's no
    array index to forward at this layer; `PieGrid`/`DonutGrid` do not re-forward these emits from
    their composed inner `PieChart`/`DonutChart` cells (a known, minor, separately-trackable gap).
  Demoed on `/bar`, `/line`, `/area`, `/scatter`, `/pie`, `/donut` (click/mouseover/mouseout, with a
  visible last-event log on each page).
- **`axis.x.line`/`axis.y.line`** (ported from `grid/core.js`'s `line` option, default `false`):
  an independent-per-axis, full-length grid line at every tick, for block (categorical) *and*
  range (value) axes alike - nested in the same `axisX`/`axisY` config object as `orient`, no new
  component prop. This **coexists with, rather than replaces**, `ChartBase`'s pre-existing
  chart-wide `showGrid` boolean (default `true`): `showGrid` keeps its original, unchanged
  behavior (range-type axes only, both axes together, as a convenience default), and a per-axis
  `line: true` is a strictly additive override on top of it - it can turn gridlines on for a
  block axis (which `showGrid` alone still never does) or force them on for one axis even with
  `show-grid="false"`, but it can never turn `showGrid`'s own lines off. See `PORT_STATUS.md` for
  the full reasoning; demoed on `/axis-orient`.
- **`axis.x.hide`/`axis.y.hide`** (ported from `chart.axis`'s `hide` option, default `false`):
  suppresses an axis's own baseline + tick labels entirely (independent of `line`/`showGrid`, same
  as upstream). Added specifically for `LineChart`'s `zoomScrollable` embedded thumbnail chart
  (its y-axis is forced hidden - the track is too short for a meaningful y scale) - no prior demo
  needed to suppress an axis's chrome before this, so it was never plumbed through `ChartBase`
  until now. See `PORT_STATUS.md`'s `zoomscroll.js` entry.
- **Pie/donut outside labels now declutter** (`pieOutsideLabelDeclutter` in `usePie.ts`, ported
  from `pie.js`'s `drawText()` `preAngle`/`preRate`/`preOpacity` walk): when two adjacent slices'
  center angles land within 2 degrees of each other, each successive label shrinks inward and
  fades, disappearing entirely once sufficiently crowded, resuming at full size once a big-enough
  angle gap reopens. Demoed on `/pie` and `/donut`'s "tightly-clustered small wedges" section.
  **This is a fixed-degree threshold, not a pixel/radius-aware one** (ported literally from the
  original) - it never applied to `PieGrid`/`DonutGrid`'s small-cell crowding anyway, since that
  demo uses `showText="inside"` and pie.js never declutters inside labels at all (only the outside
  branch has this logic).
- **Pie/donut inside labels now declutter too** (`pieInsideLabelDeclutter` in `usePie.ts`) - a
  from-scratch fix, not a port (there's no original algorithm for this - see the bullet above).
  Unlike the outside case, this is pixel/text-width-aware from the start: two inside labels are
  treated as colliding once the straight-line distance between their fixed `radius/2` positions is
  less than the sum of their estimated text half-widths (`text.length * fontSize * 0.57`, a factor
  derived from a real `getComputedTextLength()` measurement - see `ChartTooltip`'s bullet above),
  and a colliding label is hidden outright (no fade - an inside label can't shrink into more room
  the way an outside one can, so a partially-transparent overlapping label wouldn't actually fix
  legibility). This fixes both `PieGrid`/`DonutGrid`'s small-cell crowding (the originally-reported
  bug) and a subtler pre-existing overlap on the full-size single-pie `showText="inside"` demo
  (`edge: 5`/`firefox: 3` were silently overlapping there too - a pure angle/radius heuristic
  wouldn't have caught it, since the two labels' *anchor points* aren't that close; their *text*
  is what collides). Also fixed as part of this: labels are now drawn in a separate pass after
  every wedge (not interleaved per-wedge), so a later-drawn wedge - routinely wider on-screen than
  an earlier wedge's own label text at small radii - can no longer paint over part of that label.
  See `PORT_STATUS.md` for the full writeup.

## What wasn't validated against a real example

`examples/bar.html`, `examples/fullgauge.html`, and `examples/heatmapscatter.html` are the only
three concrete examples in jui-chart's repo. `bar.html` only exercises `axis`/`column` brush + `title`/`tooltip` widgets - so the
bar/column axis-config shape above is grounded in a real example, and `BarPage.vue` reproduces its
config exactly (including `axis.y.orient: "right"`, fixed during the Phase A item 7
re-verification pass - see `PORT_STATUS.md`). The example's `event: {click: fn}` config is now
reproduced via `BarChart`'s `@click` emit (see "Per-element DOM event forwarding" above); its
`widget: [{type:"tooltip", format}]` still has no directly-equivalent widget system in this port -
the tooltip `format` shown in that example is the widget's own default behavior, already covered
by `BarChart`'s own `format` prop. `fullgauge.html` (`{title, value, max, min}` data + `symbol`/
`startAngle`/`size`/`titleY`/`showText`/`format` brush options, `axis.c` set to `type: "panel"`) is
reproduced by `FullGaugePage.vue`'s "Reproduces fullgauge.html" demo - **not reproduced**: the
example's chart-level `style: { gaugeFontSize: 30 }` theme-token override, since this port's theme
is a fixed classic/dark palette selected via the `theme` prop, not a per-instance token override
(true of every component here, not a gauge-specific gap). There is no `pie.html`/`donut.html`/
`bargauge.html` example anywhere in the source tree: `PieChart`/`DonutChart`'s prop shape (`data`
as a single row, `target` as a field list, `showText`, `format`) and `BarGaugeChart`'s prop shape
were both inferred directly from reading the brush source's `.setup()` option lists and `draw()`/
`drawUnit()` logic, not cross-checked against a working original-library usage sample - `pie.js`/
`donut.js` were re-confirmed against a full end-to-end re-read during the Phase A item 7 audit;
`bargauge.js` (79 lines) was read in full for this item. A human should sanity-check `PieChart`/
`DonutChart`/`BarGaugeChart`'s inferred shapes against any downstream consumer expectations before
treating them as final. There is also no example anywhere in the source tree using `pin.js` or
`selectbox.js` directly (confirmed via grep across `examples/*.html` before assuming otherwise,
including a targeted check of the "guideline"/"zoomselect"-named examples, whose names suggested a
possible match but which turned out not to reference either brush by name) - `PinChart`'s and
`SelectBoxChart`'s prop shapes were inferred directly from `draw()`/`drawBefore()` and each
brush's `.setup()`. `examples/heatmapscatter.html` (a "Heat-Map Transaction View" demo, `axis.x`
`type: "date"` + `axis.y` `type: "range"`, `brush: {type: "heatmapscatter", target: ["delay"],
yInterval: 250, xInterval: 5000, colors: function(d) {...}}`) IS a real example, used to confirm
`HeatmapScatterChart`'s color-by-row-data-via-a-function real-world usage (this port's own
`colors?: string[]` convention drops the function form - see that component's own entry above) and
that `xInterval`/`yInterval` are always explicitly configured in practice (never left at the
source's own broken `0` default). There is no `heatmap.html`/`heatmap.js` example anywhere in the
source tree (confirmed via grep) - `HeatmapChart`'s prop shape was inferred directly from `draw()`
and `.setup()`, same as `PinChart`/`SelectBoxChart` above. There is also no example anywhere in the
source tree using `timeline.js` (confirmed via grep across `examples/*.html`, including checking
files whose names looked plausible) - `TimelineChart`'s prop shape and, in particular, the
"row 0 is a conventional header lane" convention were both inferred directly from `drawBefore()`/
`drawGrid()`/`drawLine()`/`drawData()`, not cross-checked against a working original-library usage
sample. A human should sanity-check `TimelineChart`'s inferred lane/header convention against any
downstream consumer expectations before treating it as final. There is also no example anywhere in
the source tree using `focus.js` (confirmed via grep across `examples/*.html` - zero matches) -
this was the basis for the dependency check that cleared it for a standalone port rather than
deferring it alongside a future zoom widget (see `PORT_STATUS.md`'s Phase C entry for the full
reasoning); `FocusChart`'s prop shape was inferred directly from `drawBefore()`/`draw()`/
`drawFocus()` and its `.setup()`, same as `PinChart`/`SelectBoxChart`/`TimelineChart` above. There
is also no example anywhere in the source tree using `flame.js` directly (confirmed via grep
across `examples/*.html` - zero matches) - only a raw data resource,
`examples/resources/flamedata.js`, which was used to confirm the flat `{index, text, value}` data
shape but demonstrates no brush config at all. `FlameChart`'s prop shape (`nodeOrient`/`nodeAlign`/
`textAlign`/`nodeColor`/`format`/`activeIndex`) was inferred directly from `drawBefore()`/`draw()`/
`drawNodeAll()`/`FlameBrush.setup()`, same as `PinChart`/`SelectBoxChart`/`TimelineChart`/
`FocusChart` above. There is also no example anywhere in the source tree using `treemap.js`
(confirmed via grep across `examples/*.html` - zero matches, and no data-resource file either,
unlike `flame.js`'s `flamedata.js`) - `TreemapChart`'s prop shape (`titleDepth`/`showText`/
`textOrient`/`textAlign`/`nodeColor`/`format`) was inferred directly from `drawBefore()`/`draw()`/
`createTitleDepth()`/`TreemapBrush.setup()`, same as `FlameChart`/`FocusChart`/`TimelineChart`/
`PinChart`/`SelectBoxChart` above. **Unlike every other Phase C item above, `topologynode.js` DOES
have a real example** - `examples/topology.html` - and `TopologyPage.vue`'s "Realistic dataset"
section reproduces its data/config directly (`nodeTitle`/`nodeText`/`nodeScale`/`edgeText`/
`edgeOpacity`/`tooltipTitle`/`tooltipText`, the WAS/server/DB call graph and its `edgeData`); this
grounded the data-model/callback-shape confirmation directly rather than inferring it purely from
`.setup()`/`draw()` reading. The example's own `axis: [{ c: { type: "topologytable" } }]` and
`widget: { type: "topologyctrl", zoom: true, move: true }` config are the two pieces NOT
reproduced 1:1 - `sort`/`space` (this port's own prop names for the grid's config) default to the
example's own implicit `topologytable.js` defaults (`"linear"`/`50`); the `topologyctrl` widget's
`zoom`/`move` config now maps to `TopologyChart`'s own `zoomable`/`pannable` props (its individual-
node-drag interaction, which the example's config doesn't gate at all, still isn't ported - see
`TopologyChart`'s own entry above). There is also no example anywhere in the source tree using
`widget/zoom.js` directly (confirmed via grep across `examples/*.html`) - the one zoom-related
example, `examples/zoom_scroll_bigdata.html`, uses `zoomscroll.js` instead (now also ported - see
`PORT_STATUS.md`'s `zoomscroll.js` entry, which DID use that example's own `widget: {type:
"zoomscroll", key: "move", ...}` config to confirm the widget's real-world shape, e.g. that
`zoomScrollKey` is genuinely meant to preview a single target, not all of them). `LineChart`'s
`zoomable` prop's drag-to-index-window behavior was inferred directly from reading `zoom.js`'s
`updateBlockGrid()`/`endZoomAction()` and traced through `juijs-graph`'s `axis.zoom()`/`setZoom()`/
`grid/core.js`'s `this.data()` to confirm it's a real domain-rescale, not from any working example
usage.

## Verification

- `npm run test` - all composable specs pass, including hand-traced pinned pairs for the
  range-domain "nice" algorithm (`useAxis.spec.ts`, one case matching `bar.html`'s own data
  exactly) and the curve spline solve (`useSeries.spec.ts`).
- `npm run build:lib` - typechecks the publishable surface and builds `dist-lib/`.
- `npm run build` - typechecks and builds the demo app.
- **Phase E canvas verification pattern**: canvas rendering has no DOM attributes to inspect the
  way every SVG component above does, so Phase E instead reads back actual pixel colors via
  `canvas.getContext('2d').getImageData(x, y, 1, 1).data` at known coordinates (CSS pixels,
  converted to device pixels via the page's own `devicePixelRatio` first, since the backing store
  is DPR-scaled - see `useCanvasChart`) and compares against the exact expected RGBA -
  `canvas.toDataURL()` for a whole-canvas snapshot when that's not enough. Established and
  exercised on `/canvas-demo` (see `PORT_STATUS.md`'s Phase E infra entry for the full list of
  checks performed, including a real initial-paint timing bug this exact technique caught and a
  fix verified) and again on `/bubble-demo` for `Bubble`/`MortalBubble` (deterministic preset-
  driven `now` values instead of a real clock, so the lifecycle checks - radius inflation, the
  circle-to-cross transition, death - aren't timing-flaky; see `PORT_STATUS.md`'s
  `base/bubble.js`/`base/mortalbubble.js` entry for the full 16-check list, including a real
  RAF-scheduling race the verification script itself had to account for) and on `/activebubble` for
  `ActiveBubbleChart` (a REAL clock this time, since the brush's own `MortalBubble.birthtime` is
  always wall-clock-seeded - a "spawn a burst" button plus a live `activeCount` readout instead of
  deterministic presets; 12 checks incl. a canvas row-scan proving actual rightward drift over time
  and full spawn -> movement -> death -> no-auto-respawn coverage - see `PORT_STATUS.md`'s
  `activebubble.js` entry for the full list), on `/bubblecloud` for `BubbleCloudChart` (shuffle/
  same-values-new-array/touch-cache buttons plus a pixel-classification diff distinguishing a real
  rescatter from a cache hit, and a hover readout - see `PORT_STATUS.md`'s `bubblecloud.js` entry
  for the full list), and on `/activecircle` for `ActiveCircleChart` - the first of these checks
  against HAND-COMPUTED AXIS pixel positions rather than just "some circle appeared somewhere",
  the same way Phases A-D's SVG components were verified: a fixed `{min:0, max:10, unit:10}` axis
  domain (bypassing `computeRangeDomain`'s "nice" auto-step search entirely) makes every circle's
  spawn position exactly derivable (`scaleX(v) = 48 + 40.8*v`, `scaleY(v) = 248 - 22.8*v` for the
  demo's 480x280 canvas + default padding), confirmed by reading back the exact expected theme
  color at the exact expected pixel for two static rows, a moving row (`vx=5`, axis-domain units/
  second) confirmed to have left its hand-computed initial position and drifted further right after
  ~700ms, and the "circles seed once, appending more `data` afterward has no visible effect until a
  port-only `reset()`" quirk demonstrated live via a `circleCount` readout staying at `3` after an
  "add more rows" click and only changing to `5` after `reset()` - 12 checks total, zero console/
  page errors across a route sweep incl. every prior Phase E demo. On `/dot3d` for `Dot3DChart` -
  the first REAL 3D-projection check: `depth=500` is deliberately set larger than the demo's own
  plot area so the perspective "far plane" lands exactly at the data's own z-domain max, making
  both a no-rotation point (z=0, `s=1` exactly, unaffected by perspective) and a far-plane point
  (z=10, `s=perspective=0.9` exactly) fully hand-computable pixel positions/radii; confirmed exact
  center-color matches plus inside/outside-radius boundary checks for both, then confirmed clicking
  a "Rotate Y +15deg" button actually moves the near point's pixel away (proving live rotation
  redraws through the real matrix math, not a cached snapshot) and "Reset rotation" restores it
  exactly - plus a `symbol` mode sweep (`dot`/`line`/`poly`/`area`) and the usual route-sweep
  zero-console-errors check. On `/equalizercolumn` for `EqualizerColumnChart` - the first Phase E
  check exercising real INTERACTIVE PICKING (a click at a known canvas coordinate resolving to the
  correct data row, not just a static pixel-color readback): a 5px grid probe located a solid-fill
  interior pixel of the error flag (confirming a color-distance tolerance, not exact equality, is
  needed near canvas antialiasing/tapered shapes) and confirmed it's the error background color; an
  active (full-opacity) column's block pixel is an EXACT palette color while a dimmed column's is a
  BLENDED (non-exact) one, confirming `barDisableBackgroundOpacity` is real; clicking the active
  column's own pixel sets `pickedIndex` to its real row index, clicking the dimmed column's sets it
  to ITS index, clicking empty background leaves the prior pick UNCHANGED (source only ever emits
  on a hit, never clears), and `reset()` clears it back to `none` - 14 checks total. `BubbleCloudChart`
  was re-verified on `/bubblecloud` too (5 new checks) for `widget/canvas/picker.js`'s retrofitted
  click/dblclick support: hovering a settled bubble then clicking the SAME point picks the same
  bubble (`via=click`), dblclicking empty space leaves that pick unchanged, and dblclicking the same
  bubble updates it to `via=dblclick`.
- **`column3d.js`/`line3d.js` broke the canvas-pixel-readback pattern above - and could, since both
  render REAL SVG**: rather than pixel colors, `/column3d`/`/line3d` verification read back the
  live page's rendered `<polygon points="...">` attributes DIRECTLY and compared them BYTE-FOR-BYTE
  against an independent Node computation - a separate script calling the SAME exported, already
  unit-tested `buildColumn3dDraws`/`buildLine3dDraws`/`computePolygon3dProjection`/
  `createOrdinalScale`/`createLinearScale` functions (via the built `dist-lib` output) with the
  demo page's own axis/prop values. This checks the one thing unit tests alone can't - the Vue
  component's own prop -> scale/projection -> rendered-markup wiring - while the projection FORMULA
  itself stays covered by `usePolygon3d.spec.ts`'s existing exhaustive tests. Both demos use the
  same `depth=500`-dominates-`effectiveDepth` setup as `/dot3d`. Confirmed: all 4 rendered
  `/column3d` cube groups' front face points match exactly, including z-sort DOM order; clicking
  "Rotate Y +15deg" changes that face's rendered points (live re-projection, not a snapshot);
  "Reset rotation" restores the exact original points string; `/line3d` renders exactly 4 polygons
  (`(rows-1)*targets`), the first matching the independent computation exactly, and rotation changes
  it too; clicking a rendered column fires `@click` with the correct `{dataKey, dataIndex}`; zero
  console/page errors across a route sweep incl. `/column3d`, `/line3d`, `/dot3d`, `/bar`,
  `/equalizercolumn`. See `PORT_STATUS.md`'s `column3d.js`/`line3d.js` entry for the exact expected
  coordinates.
- **`widget/polygon/rotate3d.js` verification used REAL pointer events, not a called method**: a
  temporary Playwright script drove `page.mouse.down()`/`.move({steps:1})`/`.up()` directly over
  each of `/dot3d`/`/column3d`/`/line3d`'s chart root, at the exact `gapX=102,gapY=0` drag already
  hand-verified in `useRotate3d.spec.ts` (`computeRotate3dDegree({x:0,y:0}, 102, 0, 408, 248) ===
  {x:0,y:-45}`, not skipped by the throttle guard). Confirmed the resulting degree readout on all
  three pages matches that hand-computed value exactly, that `/dot3d`'s canvas pixel at the
  hand-computed center `(252,144)` changes color (and "Reset rotation" restores it exactly), and
  that `/column3d`/`/line3d`'s first rendered `<polygon points="...">` matches an independent Node
  computation of `buildColumn3dDraws`/`buildLine3dDraws`/`rotatePolygonVertices` (via the built
  `dist-lib` output) BOTH before the drag (degree 0) and after it (degree `(0,-45,0)`) - the exact
  same "read real DOM/pixels back, cross-check against an independent computation" bar every prior
  Phase E demo held, extended here to cover a live drag gesture rather than a button click. Also
  confirmed no regression to the existing ad-hoc buttons/click-forwarding on any of the three pages,
  and zero console/page errors across the FULL 37-route sweep (every route in the app, not just the
  Phase E ones) - the widest route sweep of any Phase E verification, run as this phase's closing
  check. See `PORT_STATUS.md`'s `rotate3d.js` entry for the full 13-check list.
