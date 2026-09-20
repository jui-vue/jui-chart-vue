# jui-chart-vue port status

Tracks progress porting [jui-chart](../jui-chart) (SVG chart engine, via its `juijs-graph`
dependency for the core rendering/axis/scale engine) to Vue 3 Composition API + TypeScript,
from-scratch (same convention as [jui-grid-vue](../jui-grid-vue)). Phases A-D (the full SVG-based
port) are complete; canvas/3D rendering - originally scoped out, then promoted to a real "Phase E"
per explicit user request to continue beyond A-D - is tracked separately below and not yet started.

Work proceeds one checklist item at a time. Each item, before being checked off, must:
1. Be implemented as `src/components/XxxChart.vue` (+ any new composables it needs) following
   the conventions in `README.md` / existing components (typed props, `<script setup lang="ts">`,
   theme tokens via `useTheme`, no runtime dependency on `jui-chart`/`juijs-graph`).
2. Have unit tests for any new non-trivial composable logic (`*.spec.ts`, vitest).
3. Have a demo page under `src/pages/` wired into `src/router.ts`, using real sample data.
4. Pass `npm run test`, `npm run build:lib`, `npm run build`.
5. Be visually verified via Playwright (dev server + screenshot, check for console/page errors,
   check rendered SVG isn't clipped/empty) — see the workflow used for the pie/donut label-
   clipping bug fixed during the MVP pilot as the reference bar for "verified."
6. Be exported from `src/index.ts`.
7. Have this file updated: check the box, add a one-line note on any deviation or known gap
   (mirror the "What's simplified" style already in `README.md`).

Work through phases in order (A before B before C before D), but within a phase, order is
flexible — pick whichever unblocks the most value or shares the most code with what's already
done.

## Phase A — Harden the MVP (remove pilot-stage simplifications)

**Phase A is fully complete** (as of the iteration that finished per-element event forwarding for
`AreaChart`/`ScatterChart`/`PieChart`/`DonutChart` - see that checklist item's own entry and the
"Iteration judgment" note right before Phase B below for the final write-up). Every checklist item
in this phase is checked off. In full, Phase A covers - across many iterations, on top of the MVP
pilot's original 5 components (Line/Area/Bar/Pie/Donut):

1. Configurable axis orientation (`axis.x.orient`/`axis.y.orient`), including a real bug fix to
   `useChartLayout.ts`'s y-pixel-interval reversal logic (was flipping horizontal-bar category
   order).
2. Stacked series math (`useStackedSeries`/`getStackXY`) - ported and unit-tested, **not yet
   consumed by any component** (that's Phase B's stackarea/stackbar/stackcolumn/stackline/
   stackscatter - tracked there, not part of Phase A's own scope).
3. `active`/`activeEvent` hover interactions for pie/donut (wedge-pull + dim), line/area (series
   dim/highlight), and later `BarChart`'s own distinct index-based `active`/`activeEvent`
   (dim + always-visible tooltip).
4. Bar/column auto min/max `display` tooltips, later extended to line/area (`display:
   "max"|"min"|"all"`, reusing `useSeries()`'s per-point `min`/`max` flags) and already present for
   scatter.
5. `ChartTooltip.vue`'s real text-width measurement (`getComputedTextLength()`), replacing a
   character-count approximation.
6. Pie/donut `axis.c` small-multiples grid (`PieGrid.vue`/`DonutGrid.vue`), composing independent
   already-verified `PieChart`/`DonutChart` instances rather than replicating the original's
   shared-brush architecture.
7. A full re-verification pass against jui-chart's actual source (`examples/bar.html` plus an
   end-to-end re-read of `line.js`/`area.js`/`pie.js`/`donut.js`), which found and fixed one real
   drift directly (a missing `axis.y.orient: "right"` in a demo) and surfaced 5 new,
   previously-undocumented gaps - all 5 are now closed (items 8-14 below).
8. Per-axis `axis.x.line`/`axis.y.line` full-length grid lines (independent of, and additive to,
   the pre-existing chart-wide `showGrid` boolean - works for block *and* range axis types).
9. `BarChart`'s own `active`/`activeEvent` (index-based, no toggle/reset - distinct from pie/
   donut/line/area's series-name-based version). Verifying this surfaced a real, more significant
   bug (see next item).
10. **HIGH PRIORITY coordinate double-offset bug**: `BarChart.vue` (found first), then
    `LineChart.vue`/`AreaChart.vue`/`ScatterChart.vue` (found via spot-check, fixed in a dedicated
    follow-up iteration) were all wrapping already-absolute, padding-inclusive coordinates
    (`axis.scale()`'s output) in a redundant `<g transform="translate(area.x, area.y)">`, silently
    shifting every rendered mark and tooltip. Fixed with exact numeric (not just visual) Playwright
    verification against `ChartBase`'s own gridlines.
11. `line.js`/`area.js`'s `display: "max"|"min"|"all"` auto min/max tooltip (item 4 had only
    covered bar/column at first).
12. `pie.js`'s outside-label collision avoidance (`preAngle`/`preRate`/`preOpacity` decluttering),
    ported into `pieOutsideLabelDeclutter` and wired into both `PieChart.vue`/`DonutChart.vue`.
13. A from-scratch inside-label decluttering heuristic (`pieInsideLabelDeclutter`) for
    `showText="inside"` - no original algorithm exists for this (pie.js never declutters inside
    labels), needed to fix real overlap/paint-over bugs found in `PieGrid`/`DonutGrid` small cells
    (and, once looked for, in full-size single pies too).
14. Per-element `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` DOM event forwarding with a
    `{dataIndex, dataKey, data, event}` payload (`ChartElementEventPayload`), ported from
    `brush/core.js`'s `addEvent()`/`chart.emit()`, for all 5 components (`BarChart`/`LineChart`
    first as a proof-of-concept, then `AreaChart`/`ScatterChart`/`PieChart`/`DonutChart` in the
    final iteration) - each matching its own upstream call-site granularity (confirmed to
    genuinely differ per brush type, not a one-size-fits-all shape).

**Phase B/C/D have NOT been started**, with exactly one explicit, deliberate exception: `scatter.js`
(Phase B's first listed item) was ported early/out-of-order, as a proof-of-concept, during the same
iteration that finished the inside-label-decluttering item above - see Phase B's own entry for
`ScatterChart` for its write-up. Per the user's later, explicit instruction, all further Phase B/C/D
work stopped there so this effort could focus entirely on clearing Phase A to zero; no other Phase
B item, and no Phase C or Phase D item, has been started. This should not be read as an oversight -
it's the deliberate, requested stopping point once Phase A closed out.

The pilot (line/area/bar+column/pie/donut) shipped with these known simplifications, noted in
`README.md`'s "What's simplified" section. Bring each to production quality:

- [x] Configurable axis orientation (x top/bottom, y left/right) — `axis.x.orient`/
      `axis.y.orient` (nested in the same `AxisConfig`, exactly like the original's
      `axis.x.orient`/`axis.y.orient`; no new component prop), ported from `chart.axis`'s
      `drawGridType()` orient coercion/placement. `useAxis.ts` resolves+defaults `orient` per
      axis (`resolveAxisOrient`, x→top/bottom default bottom, y→left/right default left) and
      returns it on `AxisResult`; `ChartBase.vue` uses it to place the baseline/tick labels on
      the correct plot-area edge with mirrored label offset/anchor. Series geometry
      (Line/Area/Bar) is unaffected - confirmed from the original that only `orient`'s *default
      pixel-interval direction* (not the specific top/bottom/left/right choice) affects a range
      axis's value mapping, and that's determined solely by x-vs-y identity, not orient itself.
      **Bug fix included**: `useChartLayout.ts`'s y-pixel-interval was previously reversed
      unconditionally for *any* y-axis type; per block.js/range.js only a "range" (value) y-axis
      reverses - a "block" (category) y-axis never does. This was flipping horizontal bar chart
      category order (e.g. `/bar`'s `orient="bar"` demo previously showed 4Q at top, 1Q at
      bottom); now fixed to show 1Q at top, matching the original. Demo: new `/axis-orient` page
      (x=top, y=right, and combined variants, plus the horizontal-bar category-order fix) -
      orient doesn't auto-adjust `padding` (same as the original, a separate independent
      config), so each flipped-orient demo chart passes an explicit `padding` override.
- [x] Stacked series support — ported `getStackXY` into `useSeries.ts` as `useStackedSeries(data,
      target, xScale, yScale, xType, yType)`, same signature/shape as `useSeries` (returns
      `ComputedRef<SeriesPoint[]>`) so it's a drop-in alternative rather than a parallel API -
      internally it calls `useSeries` for the base x/y/value/min/max and then overwrites the
      "range"-axis coordinate per target with the axis-scaled *cumulative* sum (running total of
      all earlier `target` entries + its own value), matching the original's `isRangeY` branch,
      generalized the same way `useSeries` already generalizes `getXY` (whichever of x/y is
      `"range"` is the one that stacks; `value`/`min`/`max` stay each target's own raw value,
      unchanged from `useSeries`). Pinned with unit tests (3 rows x 2 targets, hand-computed
      cumulative base/top, plus an x-stacks-instead-of-y case and a reactivity case) in
      `useSeries.spec.ts`. Not yet consumed by any component (that's Phase B's stackarea/
      stackbar/stackcolumn/stackline/stackscatter) - ready to consume via `useStackedSeries(...)`
      exactly like `useSeries` is used today, just swap the call.
- [x] `active`/`activeEvent` wedge-pull (pie/donut) and line-dimming (line/area) hover
      interactions, ported from `pie.js`/`donut.js`/`line.js`. Shared pure math lives in new
      `useActive.ts` (`toActiveKeySet`, `pieActivePullOffset`, `pieActiveOpacity`,
      `lineActiveOpacity`; unit-tested in `useActive.spec.ts`). Pie: `active`
      (`string | string[] | null`) statically pulls+dims the named wedge(s) by
      `theme('pieActiveDistance')`/`theme('pieDisableBackgroundOpacity')`; `activeEvent` (a DOM
      event name, e.g. `"click"`/`"mouseover"`) toggles a wedge's membership on that event, per
      `setActiveEvent()`'s per-wedge toggle (multi-select, no auto-reset). Donut: same but never
      dims (only pulls), matching donut.js's `setActiveEvent(cache, false)`. Line/Area: `active`
      statically highlights the named series (full opacity) and dims the rest to
      `theme('lineDisableBorderOpacity')`, per `setActiveEffects()`; `activeEvent` highlights
      the hovered/clicked series via the same math as `setActiveEffect()`'s single-line
      highlight - **deviation**: a `"mouseover"`/`"mouseenter"` `activeEvent` also restores on
      `mouseout` (the original's raw event listener never resets); `"click"` toggles/pins with
      no such auto-reset, matching a click-to-pin interaction. **Finding**: in the original,
      area.js's `AreaBrush.setup` redeclares `active`/`activeEvent` (copied from
      `LineBrush.setup`) but area.js overrides `draw()` to call its own `drawArea()` instead of
      line.js's `drawLine()` - the *only* place `setActiveEffects()`/the `activeEvent` listener
      wiring happen - so these options are dead config for area charts upstream. Treated as an
      inherited-but-unwired gap rather than intentional: this port wires them the way
      `drawLine()` would if `drawArea()` called it, affecting only the optional outline stroke
      (registered via `addLineElement()` when `line=true`, exactly like line.js), never the
      translucent fill - with `line=false` there's no registered element, so active/activeEvent
      have no visible effect, same as line.js would produce for an empty `lineList`. Demo:
      extended `/pie`, `/donut`, `/line`, `/area` pages with `active`/`activeEvent` sections.
      Playwright-verified: hovering a pie/donut wedge visibly pulls it out (donut also confirmed
      it does NOT dim, pie does); hovering a line/area series point dims the other series'
      stroke-opacity to `0.3` (`lineDisableBorderOpacity`) while the hovered one stays at `1`
      (confirmed both visually via screenshot and by reading the rendered `stroke-opacity`
      attribute).
- [x] Auto min/max value tooltips (`display: "max"|"min"|"all"` on bar/column), from `bar.js`.
      Confirmed from `drawETC()`: `display` (default `null`) gates a *persistent* label per bar -
      `"max"`/`"min"` show it only on the bar(s) tied for that target's max/min value (computed
      per-target across *all* rows via `getMinMaxValue()`, so ties can flag more than one bar),
      `"all"` shows it on every bar - independent of hover/`active`/`activeEvent` (bar.js's own
      hover marker and `display` marker are both instances of the same `drawTooltip()` circle+
      text widget, just one controlled by an event listener and the other `.control()`-ed once at
      draw time). Ported the per-target min/max selection as a pure `selectDisplayBars(rows,
      targetKey, mode)` in `useSeries.ts` (unit-tested in `useSeries.spec.ts`, including a tie
      case), wired into `BarChart.vue`'s existing `bars` computed as an `isDisplay` flag, rendered
      via new persistent `ChartTooltip` instances (`visible` always true) in the overlay slot.
      **Deviation**: the original draws its own small circle+text marker for both the hover and
      `display` tooltips (not the balloon-box `chart.widget.tooltip`); this port reuses
      `ChartTooltip` (the balloon already used for `BarChart`'s hover) for both, for visual
      consistency with the rest of this codebase rather than pixel-matching the original's plainer
      marker. Also not ported: the original hides a tooltip when its value is exactly `0`
      (`bar.js`'s `drawTooltip().control()`) - `ChartTooltip` has no such check (pre-existing gap,
      shared with the already-shipped hover tooltip, not introduced by this item). Added `format`
      prop (`(value: number) => string | number`, default identity) matching `bar.js`'s `format`
      option, applied to both the hover tooltip and `display` labels. Demo: extended `/bar` with
      three `display="max"|"min"|"all"` column charts using data with distinct (non-tied) per-
      target min/max so both labels are visible. Playwright-verified: labels land on the correct
      bar(s) for each mode (spot-checked against the demo's own data by hand), none clipped by the
      SVG viewBox (needed a larger `padding.top` on the demo charts - same root cause as the
      pie/donut outside-label clipping bug from the MVP pilot, fixed the same way), zero console/
      page errors.
- [x] `ChartTooltip.vue`: replace the character-count text-width approximation with real
      measurement, ported from `util/svg.js`'s `getTextSize()` (an offscreen `<text>` appended to
      `document.body`, measured, then removed). New `measureTextWidth()` in `ChartTooltip.vue`
      does the same, but via `SVGTextElement.getComputedTextLength()` instead of the original's
      `getBoundingClientRect()` (per this item's brief: simpler, and avoids a `getBBox()`-style
      dependency on the element already having visible layout) - reuses one lazily-created,
      module-level offscreen `<text>` element across calls (position `absolute`/off-canvas, not
      `display:none`, so font metrics still lay out) instead of creating/destroying a node per
      measurement like the original does. `boxWidth` in `ChartTooltip.vue` now calls this per
      line and feeds the widths into a new pure `computeBoxWidth(lineWidths, padding)` (new
      `src/composables/tooltipMeasure.ts`, alongside the also-extracted `lineText()` formatter).
      **Not unit tested**: the DOM measurement itself - vitest's jsdom has no real font metrics
      (`getComputedTextLength()` there would return 0 or a constant for every string regardless of
      content, so a test would just pin a fake number, not catch a real regression); what *is*
      pure and extractable (`computeBoxWidth`'s padding/floor math, `lineText`'s formatting) is
      unit-tested in new `tooltipMeasure.spec.ts`. `document`-existence guarded (returns `0` width
      off-browser) though nothing else in this codebase has an SSR concern to justify it - cheap
      insurance, confirmed via grep that no other component does DOM work outside an SFC's
      lifecycle. Playwright-verified on `/bar`, `/pie`, `/line`: hovering to trigger tooltips shows
      boxes that now hug their text tightly (screenshotted and inspected). Concretely measured (via
      `getComputedTextLength()` in a real Chromium page) the old approximation's error in both
      directions: `"chrome: 64"` (pie demo) needed 68.3px but the old formula gave 88.4px (~20px
      too wide); `"visits: 120"` (line demo) needed 63.7px vs. 95.8px old (~32px too wide);
      conversely an all-wide-glyph string like `"WWWWWW"` needed 82.0px but the old approximation
      gave only 58.6px - i.e. the old approximation could be *either* too wide (wasted padding,
      the common case for these demos' labels) or too narrow (clipped text, for wide-glyph
      content), confirming the imprecision this item set out to fix. Zero console/page errors.
- [x] Pie/donut `axis.c` small-multiples grid (rendering an array of data rows as multiple small
      pies/donuts in a grid). **Source investigation**: `axis.c` is a chart-*level* axis config
      (`base/axis.js`'s `drawGridType(this, "c")`, alongside `x`/`y`/`z`/`map`) - it resolves to a
      grid-type component (default `"panel"`, a single full-area cell that ignores its index arg,
      i.e. one pie only) or, when configured `type: "table"`, `grid/table.js`'s `TableGrid`: given
      `rows`/`columns`/`padding`, its `scale(i)` returns cell `{x,y,width,height}` for index `i`
      in row-major order (`r = floor(i/columns)`, `c = i % columns`). `pie.js`/`donut.js`'s
      `getProperty(index)` calls `this.axis.c(index)` (that same `scale(i)`) to get each row's
      cell, then derives `centerX/centerY/outerRadius` from it exactly like this port's existing
      single-pie `centerX`/`centerY`/`outerRadius` computeds already do from the full chart area -
      so architecturally, ONE shared `PieBrush`/`DonutBrush` instance draws every row's pie itself,
      looking up per-row geometry from a grid function shared across the whole draw pass.
      **Design decision**: rather than replicate that shared-brush architecture, ported
      `chart.grid.table`'s cell-rect math as a standalone pure composable (`useGridLayout.ts`:
      `gridCellRect`/`gridCells`/`resolveGridRows`, unit-tested in `useGridLayout.spec.ts`) and
      built two thin wrapper components, `PieGrid.vue`/`DonutGrid.vue`, that compose N independent,
      already-verified `PieChart`/`DonutChart` instances - one per data row - positioned at their
      grid cell via a nested `<svg x="" y="" width="" height="">` viewport (`x`/`y` aren't declared
      props on `PieChart`/`DonutChart`, so they fall through Vue's automatic attribute inheritance
      onto the root `<svg>` unmodified). Reasoning: (1) reuses 100% of `PieChart`/`DonutChart`'s
      already-verified wedge/label/`active`/`activeEvent`/tooltip/outside-label-clipping-safe-radius
      logic with zero risk to the single-pie call shape - `PieChart.vue`/`DonutChart.vue` are
      **untouched** by this item (headers updated only to point at the new grid components); (2) a
      nested `<svg>` clips to its own viewport per the SVG spec, so no cell's wedges/labels can
      bleed into a neighboring cell or past the outer boundary "for free" - this is exactly the bug
      class flagged for careful checking, and the nesting structurally prevents it rather than
      requiring per-cell clip-path bookkeeping; (3) unlike a shared-axis/scale brush family
      (bar/line, where rows genuinely share one continuous axis), the original's per-row pies never
      interact with each other (no shared legend/tooltip/hover across rows), so independent
      components are behaviorally equivalent to the original's shared-brush output here. This
      deviates from a literal architectural port but was chosen deliberately given this item's
      explicit time-boxing note, and keeps the common single-pie case exactly as simple as before
      (unchanged API, unchanged file). `rows` auto-derives as `ceil(count / columns)` when omitted
      (a Vue-port ergonomic addition - the original always requires both explicitly). New
      `titleField` prop reads a per-row field (e.g. `"region"`) for each cell's title, forwarded to
      the inner chart's existing `title` prop. **Deferred** (noted here for a future iteration, not
      silently dropped): only `axis.c`'s `"table"` grid type is ported, not `"panel"`/other grid
      types (irrelevant here - `"panel"` is the single-pie default, already the existing behavior);
      no support for the original's `area`-as-percentage / 3D / mixed-grid-type configs; cells are
      always a uniform row-major grid (no custom per-cell sizing); no shared cross-cell legend
      (would naturally pair with Phase D's `legend.js` widget once ported). Exports:
      `PieGrid`/`DonutGrid` components, `useGridLayout.ts`. Demo: extended `/pie` and `/donut` with
      an "axis.c small-multiples grid" section, a 2x3 grid of per-region browser-share data.
      Playwright-verified: zero console/page errors; every cell's nested `<svg>` rect confirmed
      programmatically to stay fully within the grid's own viewBox bounds (no out-of-bounds cells);
      screenshotted both grids and visually confirmed no wedge/label bleeds into a neighboring cell
      or past the outer SVG boundary, titles render correctly per cell, and the pre-existing
      individual-pie/donut demo sections above the grid are unaffected (no regression).
- [x] Re-verify all 5 MVP components against jui-chart's original `examples/*.html` configs where
      one exists (only `bar.html` does today) and against hand-built configs otherwise, same
      rigor as the Playwright pass already done. **Audited**: re-read `examples/bar.html` in full
      against `BarPage.vue`/`BarChart.vue`; re-read `src/brush/line.js`, `area.js`, `pie.js`,
      `donut.js` end-to-end (not just prior iterations' focus areas) against the current
      `LineChart.vue`/`AreaChart.vue`/`PieChart.vue`/`DonutChart.vue`; spot-checked item 6's claim
      that `PieChart.vue`/`DonutChart.vue` are untouched by the grid work (confirmed true - no
      grid-related code in either file); checked prop/type consistency across all 5 components
      (theme/title/showTooltip/colors/format/active/activeEvent all present and consistently
      named/typed where the originals have an equivalent concept, modulo `BarChart` missing
      `active`/`activeEvent` - tracked below).
      **Found and fixed directly**: `BarPage.vue`'s "reproduces bar.html exactly" demo chart was
      missing `axis.y.orient: "right"` (bar.html sets it; the demo's own comment claimed an exact
      config match but the axis rendered on the left) - added, Playwright-confirmed the y-axis now
      renders on the right with labels/baseline correctly mirrored, matching the original.
      **Found and newly tracked** (real, previously-undocumented gaps, not present in `README.md`'s
      "what's simplified" list before this audit - see the 5 new sub-items directly below this one):
      per-element click/dblclick/mouseover event forwarding with jui-chart's rich
      `{brush,dataIndex,dataKey,data}` payload (`brush/core.js`'s `addEvent`/`useEvent`, wired to
      `event: {click: fn}` in the original's builder config) is entirely unported across all 5
      components - bar.html's own `event.click` handler has no working equivalent here (Vue's
      default attrs-fallthrough does let a bare native `@click` reach the root `<svg>`, but with
      none of the original's per-element data context, so this doesn't count as ported); per-axis
      `axis.x.line`/`axis.y.line` (a full-length grid line per tick, independent per axis, drawn
      for block *and* range axis types) has no equivalent - this port's `showGrid` is one
      chart-wide boolean that also never draws lines for block-type axes; `BarChart` never got
      `active`/`activeEvent` (bar.js's own always-visible "active" tooltip + per-bar dim, distinct
      from pie/donut/line/area's already-shipped version) - self-documented in `BarChart.vue`'s own
      header comment as skipped but never promoted to a tracked item until now; `line.js`/`area.js`'s
      `display: "max"|"min"|"all"` auto min/max tooltip was ported for bar/column only (item 4's
      explicit scope) - `LineChart.vue` self-documents the skip, `AreaChart.vue` didn't mention it
      at all (now noted in both files' headers as part of this audit); pie/donut's outside-label
      collision avoidance (`pie.js`'s stateful `preAngle`/`preRate`/`preOpacity` fade + leader-line
      shrink for closely-spaced small wedges) has no equivalent in `usePie.ts`'s
      `pieOutsideLabelAnchor` (a static, non-decluttering position) - not a regression from item 6's
      grid work, but the grid's small radii made pre-existing label overlap visible for the first
      time (Playwright-confirmed on `/pie`'s "axis.c small-multiples grid" section, e.g. the North
      America cell's "firefox: 3"/"other: 9" labels overlapping).
      **Full regression sweep**: `npm run test` (81/81 passing), `npm run build:lib`, `npm run
      build` all clean with no type errors. Playwright pass across every page in `router.ts`
      (`/bar`, `/line`, `/area`, `/pie`, `/donut`, `/axis-orient`) - zero console/page errors on
      all 6, every page's SVG(s) confirmed rendered (not empty), screenshots visually inspected for
      clipping/regressions (none beyond the pre-existing outside-label overlap noted above, which is
      a `usePie.ts` gap rather than a rendering bug).

- [x] Port per-element click/dblclick/mouseover/mouseout/contextmenu DOM event forwarding with
      jui-chart's `{brush, dataIndex, dataKey, data}` payload, from `brush/core.js`'s
      `addEvent()`/`useEvent` (default `true`) wired to `chart.emit()`, which the original's
      `event: { click: fn }` builder config subscribes to (see `examples/bar.html`). Found during
      item 7's audit: none of the 5 MVP components emitted anything (no `defineEmits` anywhere in
      `src/components/`). Completed across two iterations: the first shipped `BarChart.vue`/
      `LineChart.vue` as a proof-of-concept (each matching its own upstream call-site granularity);
      this iteration finished the remaining 4: `AreaChart.vue`, `ScatterChart.vue`, `PieChart.vue`,
      `DonutChart.vue`.
      **Source read (all 6 call sites)**: `brush/core.js`'s `addEvent(elem, dataIndex,
      targetIndex)` wires `click`/`dblclick`/`contextmenu` (emitted as `"rclick"` upstream)/
      `mouseover`/`mouseout`/`mousemove`/`mousedown`/`mouseup` (this item scopes to the 5 the
      checklist names - `mousemove`/`mousedown`/`mouseup` are out of scope) to
      `chart.emit(eventName, [obj, e])`, `obj = {brush, dataIndex, dataKey, data}`. Confirmed
      call-site granularity varies *per brush type*, not just per element in general:
      - `bar.js`'s `getBarElement()` calls `addEvent(r, dataIndex, targetIndex)` **per bar**,
        skipping any bar whose `value === 0`.
      - `line.js`'s `drawLine()` calls `addEvent(p, null, k)` **per target's whole line-segment
        `<path>`** (not per-point) - `dataIndex`/`data` always `null`, only `dataKey` meaningful.
      - `area.js`'s `drawArea()` declares its `g` group ONCE, *outside* the per-target loop, and
        calls `addEvent(g, null, k)` on that SAME shared `g` once per target - literally, any
        click/hover anywhere on the whole area chart would fire one `chart.emit()` per target
        (same coordinates, different `dataKey`, no way to tell which target's shape was actually
        under the cursor). **Deviation**: rather than reproduce that indiscriminate multi-fire
        quirk, wired per-target onto this port's existing per-target `<g>` (matching
        `LineChart.vue`'s shape) - fires regardless of `line` (matching `addEvent`'s own
        unconditional-per-target call, unlike `display`/`active` which are `line`-gated).
      - `scatter.js`'s `drawScatter()` calls `addEvent(p, j /*row*/, i /*target*/)` **per marker**,
        unconditionally for every symbol type **including `cross`** (the `symbol.uri != "cross"`
        guard only wraps the hover-recolor/`activeEvent` wiring, not `addEvent` itself) - so cross
        markers forward events while staying visually non-interactive otherwise, both ported
        faithfully.
      - `pie.js`'s `drawUnit(index, data, g)` calls `self.addEvent(pie, index, i)` **per wedge**,
        where `index` is the ROW index into `axis.data` (always `0` for a lone, non-grid pie -
        `PieGrid.vue` composes N independent `PieChart` instances rather than one shared brush
        walking an array) and `i` is the wedge/target index; `data = getData(index)` is the whole
        row (all wedges' values), not a single wedge's value. **Deviation**: `dataIndex` is `null`
        here (not upstream's literal always-`0`) since `PieChart`'s `data` prop is already a single
        `DataRow`, not an array - there's no meaningful index *into* anything at this layer,
        matching `ChartElementEventPayload`'s own documented "not tied to one row" meaning.
      - `donut.js`'s `drawUnit()` calls `this.addEvent(donut, index, i)` - identical shape to
        pie.js's call site (not inherited, donut.js has its own `drawUnit`, but the shape matches
        exactly) - same treatment/deviation as pie.js.
      **Design** (unchanged from the proof-of-concept iteration): `defineEmits` per component
      (`click`, `dblclick`, `contextmenu`, `mouseover`, `mouseout`), payload =
      `ChartElementEventPayload` (`types.ts`) - the original's `{brush, dataIndex, dataKey, data}`
      minus `brush` (no Vue-port equivalent - the emitting component instance already identifies
      "which chart"), plus `event: MouseEvent`. Upstream's jQuery-style `"rclick"` is renamed to
      the native/Vue-idiomatic `contextmenu` (calling `e.preventDefault()`, same as the original).
      A shared `ChartElementEventType` union type avoids repeating the 5 event names per component.
      **Implementation, matching each component's own upstream call-site granularity exactly**:
      - `BarChart.vue`: per-bar (`Bar.dataIndex`; `forwardEvent()` skips `value === 0` bars,
        ported literally from `getBarElement()`'s guard; `data: props.data[bar.dataIndex]`) -
        wired onto the bar `<path>` alongside its pre-existing `hoverIndex`/`activeEvent`
        listeners.
      - `LineChart.vue`: per-series (`dataIndex`/`data` always `null`, `dataKey` = target key) -
        wired onto the per-series `<g>` (segment-path wrapper); point `<circle>`s (`showPoints`)
        intentionally get no forwarding, matching the original never wiring them either.
      - `AreaChart.vue`: per-target (`dataIndex`/`data` always `null`) - wired onto the existing
        per-target `<g>` that wraps both the fill path(s) and the optional line sub-group, NOT
        gated by `props.line` (see the deviation above); the inner line-only `<g v-if="props.line">`
        keeps its own pre-existing `active`/`activeEvent` listeners unchanged (still `line`-gated,
        per that item's own established deviation).
      - `ScatterChart.vue`: per-marker, real `dataIndex`/`data` (`p.index`/`props.data[p.index]`) -
        wired onto every marker shape (`ellipse`/`rect`/`polygon`/the `cross` `<g>`), alongside
        each shape's pre-existing hover/`activeEvent` handlers; `cross` gets forwarding (matching
        the source's unguarded `addEvent` call) but keeps its existing non-interactive hover-recolor
        behavior unchanged (still guarded by the `p.symbol === 'cross'` early-return in
        `onPointOver`/`onPointOut`/`onPointEvent`).
      - `PieChart.vue`/`DonutChart.vue`: per-wedge (`dataIndex: null`, `dataKey: w.key`,
        `data: props.data`, the whole row) - wired onto each wedge's `<path>` (and PieChart's
        full-circle `<circle>` fallback for a single-slice pie), alongside the pre-existing
        `onWedgeEvent` (`active`/`activeEvent`) handler. `PieGrid.vue`/`DonutGrid.vue` do **not**
        re-forward these new emits (Vue doesn't auto-forward custom component emits through a
        wrapper the way native DOM attrs fall through) - a known, minor, separately-trackable gap,
        not silently dropped: noted here rather than expanded into this item's scope, since the
        task was explicitly scoped to the 4 named leaf components.
      **Demo**: `BarPage.vue`'s bar.html-repro chart reproduces bar.html's `event: {click: fn}`;
      `LinePage.vue`/`AreaPage.vue`/`ScatterPage.vue`/`PiePage.vue`/`DonutPage.vue` each gained a
      "Per-element event forwarding" section wiring `click`/`mouseover`/`mouseout` with a visible
      last-event log (`data-testid="last-{line,area,scatter,pie,donut}-event"`).
      **Playwright-verified** (this iteration, for the 4 newly-completed components - Bar/Line were
      already verified in the prior iteration and re-confirmed unaffected here): dispatched
      `mouseover`/`mouseout`/`click`/`dblclick` `MouseEvent`s directly on each demo's target
      element (a real click/hover on a thin donut-ring `<path>`'s bounding-box center lands in the
      arc's own "hole", not the stroke, so Playwright's hit-testing hover/click helpers
      intermittently missed it - switched to `element.dispatchEvent(new MouseEvent(...))`, the same
      technique the prior iteration's own verification notes already established as sound) and read
      back each page's last-event log:
      - `/area`: `mouseover dataIndex=<empty> dataKey="visits"` (first target, `dataIndex` empty =
        Vue's `null` text-interpolation, confirmed correct) - matches the per-target,
        always-`null`-index design.
      - `/scatter`: `mouseover dataIndex=0 dataKey="sensorA" data={"week":"W1","sensorA":12,
        "sensorB":30}` - exact match to the first row of `ScatterPage.vue`'s sample data.
      - `/pie`: `mouseover dataIndex=<empty> dataKey="chrome" data={"chrome":64,"safari":19,
        "edge":5,"firefox":3,"other":9}` - `dataIndex` empty (the deliberate `null` deviation),
        `data` is the whole row.
      - `/donut`: identical shape/values to `/pie`'s result (same source call-site shape).
      All 4 also confirmed `mouseout`/`click` fire with the same payload shape, and that
      `dblclick` (not wired on the demo pages, matching `LinePage.vue`'s own established scope of
      only demoing `click`/`mouseover`/`mouseout`) correctly does NOT update the last-event log
      (proving the demo only reacts to the events it actually listens for, not a false positive).
      **Regression check**: re-screenshotted every section of `/area`, `/scatter`, `/pie`, `/donut`
      full-page - every pre-existing demo section (curve/line=false/activeEvent/display for area;
      all 4 symbols/hide+hoverSync/hideZero/activeEvent/display for scatter; outside/inside/active/
      activeEvent/declutter/PieGrid for pie; showValue/outside/activeEvent/declutter/DonutGrid for
      donut) renders pixel-identical to before this iteration, confirming the new forwardEvent
      listeners (added alongside, never replacing, each component's pre-existing handlers) didn't
      disturb any existing hover/active-interaction behavior. Also re-screenshotted `/bar` and
      `/line` (untouched this iteration) as an explicit no-regression control - both pixel-identical
      to the prior iteration's own verified state. Zero console/page errors across all 7 router
      pages (`/bar`, `/line`, `/area`, `/pie`, `/donut`, `/scatter`, `/axis-orient`). `npm run test`
      (103/103, unchanged - no new pure logic, this is template/emit wiring), `npm run build:lib`,
      `npm run build` all clean.
- [x] Port per-axis `axis.x.line`/`axis.y.line` (`grid/core.js`'s `line`, default `false`): an
      independent-per-axis, full-length grid line at every tick (for block *and* range axis types),
      distinct from this port's existing chart-wide `showGrid` boolean (which also currently never
      draws lines for block-type axes, only range). Found during item 7's audit via `bar.html`,
      which sets `line:true` on both axes.
      **Source read**: `grid/core.js`'s `getLineOption()` normalizes `line` (bool/string/number/
      object) into a type descriptor; `draw2d.js`'s `createGridX`/`createGridY` (called once per
      tick from `drawTop`/`drawBottom`/`drawLeft`/`drawRight`) call `drawValueLine()` when it's
      truthy, which draws a line spanning `y1:0` to `y2: axis.area("height")` (x-axis ticks, full
      plot height) or `x1:0` to `x2: axis.area("width")` (y-axis ticks, full plot width) - i.e.
      "full-length" means the opposite dimension of the plot area, exactly what this port's
      existing `showGrid` gridlines already compute (`area.y`->`area.y2` / `area.x`->`area.x2`) -
      confirming no new coordinate math was needed, only broadening *when* those same lines draw.
      Confirmed `line` is declared on `CoreGrid.setup()` (shared by both `chart.grid.block` and
      `chart.grid.range`, which both `extend: "chart.grid.core"` and never override/remove it) -
      **the PORT_STATUS.md note's claim that it works for block axes too is accurate**: nothing in
      `block.js` gates `line` differently than `range.js`, both call the same inherited
      `createGridX`/`createGridY`. (Not ported: `drawValueLine`'s `checkDrawLineX`/`checkDrawLineY`
      edge-case, which skips the one tick-line that would exactly overlap the axis baseline,
      keyed off the *other* axis's `orient`/`hide` - this port's pre-existing `showGrid` gridlines
      already draw every tick including edges with no such skip, so `line` matches that existing,
      established convention rather than introducing a one-off inconsistency; documented as a
      known, minor deviation.)
      **Implementation**: `line?: boolean` added to both `BlockAxisConfig`/`RangeAxisConfig` in
      `types.ts` (nested exactly like `orient`, default `false`). `useAxis.ts` resolves it
      (`cfg.line ?? false`) into a new `line: boolean` field on `AxisResult` (both `BlockAxisResult`
      and `RangeAxisResult`), same pattern as `orient`'s `resolveAxisOrient` - no new pure function
      needed since the resolution is a one-line default, but still exercised directly by new unit
      tests (see below) rather than only indirectly via `ChartBase`. `ChartBase.vue`'s single
      `showGrid`-gated `<g>` was split into two independent `<g v-if="showXGridLines">`/
      `<g v-if="showYGridLines">` blocks, each now iterating the full `axisX.values`/`axisY.values`
      array unconditionally (previously ternary-gated to `type === 'range'` only) - `showXGridLines
      = (props.showGrid && axisX.value.type === 'range') || axisX.value.line` (and the y
      equivalent).
      **Design decision: `line` coexists with `showGrid`, does not replace it** (documented in
      `README.md`'s "What's simplified" and its axis-config section). Reasoning: (1) `showGrid` is
      a port-only convenience with no upstream equivalent (the original has no chart-wide grid
      toggle at all, only always-`false`-by-default per-axis `line`) - removing it would be a
      behavior-breaking regression to every existing demo, which all rely on its default-`true`,
      range-only-axes look; (2) `line` is additive-only by construction (`||`, never `&&`), so it
      can never suppress a line `showGrid` already draws, only add lines `showGrid` wouldn't (a
      block axis, or one axis while `show-grid="false"`) - this keeps the mental model simple
      (`line: true` always means "there is a line here", full stop) rather than requiring users to
      reason about two booleans interacting non-monotonically. Verified this `show-grid="false"`-
      override behavior explicitly (see verification below).
      **Unit tests**: `useAxis.spec.ts`'s existing block/range `useAxis()` tests extended to assert
      `line: false` by default; new dedicated test resolves `line` across all 4 combinations (block/
      range x default-false/explicit-true), confirming block-axis support isn't accidentally
      type-gated anywhere in the resolution path.
      **Demo**: extended `/axis-orient` (already showcasing axis config permutations) with a new
      "`axis.x.line` / `axis.y.line`" section, 4 `LineChart`s over the same monthly dataset: (1)
      `axis.x.line` only on a **block** x-axis (month) with the y-axis's own `line` off - proving
      block-axis support; (2) `axis.y.line` only on a **range** y-axis; (3) both together; (4)
      `axis.x.line` alone with `show-grid="false"` - proving the per-axis override wins even when
      the chart-wide default is fully disabled.
      **Playwright-verified with exact numeric proof** (same rigor as the coordinate-offset-bug
      iteration, not just screenshots): a script reading each chart's rendered SVG DOM directly
      confirmed, per demo chart: chart 1 renders exactly 6 vertical gridlines (one per month tick)
      whose `x1` values, sorted, are **byte-identical** to the x tick `<text>` labels' `x`
      positions (`[92,180,268,356,444,532]` in both, zero drift) - since both come from the same
      `axisX.values` array, this is a strong structural correctness proof, not just a visual
      spot-check; chart 1 also still shows `showGrid`'s pre-existing 6 horizontal lines (range
      y-axis, `line` off there - `showGrid`'s own behavior correctly unaffected); chart 2 (y.line
      only) shows 0 vertical / 6 horizontal; chart 3 (both) shows 6/6; chart 4 (`show-grid=false`,
      x.line only) shows 6 vertical / **0** horizontal, confirming the override semantics precisely.
      All lines on all 4 charts confirmed within the SVG's own `viewBox` bounds (no clipping).
      Zero console/page errors across all 7 router pages (`/bar`, `/line`, `/area`, `/scatter`,
      `/pie`, `/donut`, `/axis-orient`) - `/bar` and `/line` additionally re-screenshotted full-page
      and visually compared against the pre-existing (unchanged) demo sections above the new one:
      bars/points still land exactly on their gridlines, no regression (expected, since no existing
      demo sets `axis.x.line`/`axis.y.line`, so `showGrid`'s own code path - now split across two
      `<g>`s instead of one, but computing the identical `v-for` list per axis as before - is
      unchanged in output for every pre-existing chart). `npm run test` (103/103 passing, including 4
      new/extended `line`-resolution assertions in `useAxis.spec.ts`), `npm run build:lib`,
      `npm run build` all clean.
- [x] Port `bar.js`'s own `active`/`activeEvent` (an always-visible "active" tooltip plus
      `setActiveEffect()`-driven per-bar opacity dimming) to `BarChart.vue` - distinct from the
      pie/donut/line/area `active`/`activeEvent` work already shipped, which never covered bar.js.
      Found during item 7's audit (self-documented as skipped in `BarChart.vue`'s own header
      comment, but never previously tracked as a checklist item).
      **Source read**: re-read `src/brush/bar.js` in full, specifically `getBarStyle()`,
      `setActiveEffect()`, and `drawETC()`'s tail block. Confirmed `active` is a plain **number
      index** into `this.barList` (a flat, row-major list, one entry per `(row, target)` pair, in
      draw order) - the config comment literally says "Activates the bar of an applicable index" -
      genuinely different from pie/donut/line's series-*name* `active`. `setActiveEffect(r)` dims
      every bar's element opacity to `theme('barDisableBackgroundOpacity')` except the active one
      (full opacity 1), and also updates the opacity of that bar's `display` min/max marker if it
      has one (`cols[i].minmax.style(color, circleColor, opacity)`) - i.e. `active`/`activeEvent`
      and `display` compose, not just coexist. `activeEvent` wires a listener per bar (skipping
      bars with `value === 0`, matching `getBarElement()`'s own zero-value guard for core click
      forwarding) that unconditionally *sets* the triggered bar as active and shows a value-only
      tooltip (`self.active.control(position, tooltipX, tooltipY, format(value))` - no series key,
      unlike this port's own hover balloon) - **no toggle, no mouseout-reset**, both confirmed
      absent from the source (unlike pie.js's explicit toggle, or this port's own LineChart
      mouseout-reset deviation) - ported literally as a one-way overwrite.
      **Implementation**: reused `useActive.ts`'s `pieActiveOpacity(isActive, hasAnyActive,
      disabledOpacity)` as-is for the dimming math (verified its formula is identical to bar.js's
      `(cols[i]==r) ? 1 : disableOpacity`) rather than adding a new pure function - no new
      composable logic needed, so no new unit tests either (existing `pieActiveOpacity` tests in
      `useActive.spec.ts` already cover it). Added `active`/`activeEvent` props to `BarChart.vue`,
      an `activeEventIndex` ref + `effectiveActiveIndex = activeEventIndex ?? props.active`
      computed (mirroring `LineChart.vue`'s `hoveredTarget ?? props.active` precedence shape), and
      wired dimming into the bar `<path>`'s `opacity` and each `display` marker's wrapping `<g
      :opacity>`. New value-only `ChartTooltip` for the active bar, styled like the existing
      `display` markers. **Deviation (new, this port only)**: this port's pre-existing always-on
      hover balloon (itself already an addition absent from bar.js) is suppressed when it would
      coincide with the active bar, to avoid two overlapping balloons when `activeEvent="mouseover"`
      - found and fixed a real dedup bug while verifying this: comparing the hover `ref`'s stored
      object against the active `computed`'s object via `!==` never worked, because `ref()`
      auto-wraps assigned objects in a `reactive()` proxy while `computed()` doesn't, so the two
      were never referentially equal even for "the same" bar - fixed by tracking hover by flat
      index (`hoverIndex`) instead of by object, matching how `activeEventIndex` already works, and
      comparing indices instead of object identity.
      **Second, more significant bug found and fixed while verifying this** (pre-existing,
      unrelated to `active`/`activeEvent` itself): `useChartLayout.ts`'s `xInterval`/`yInterval` are
      *absolute* pixel intervals (`[area.x, area.x2]`/`[area.y, area.y2]`), confirmed by
      cross-referencing `ChartBase.vue`'s own gridlines (drawn with zero extra transform, straight
      from the same `axisX`/`axisY.value` outputs) - so `ax.scale()`/`ay.scale()` already return
      final, padding-inclusive coordinates. `BarChart.vue`'s `bars` computed builds every bar's
      `d`/`tooltipX`/`tooltipY` directly from those same calls, yet the whole rendering group was
      *also* wrapped in `<g :transform="translate(area.x, area.y)">`, double-applying the padding
      offset and shifting every bar (and every tooltip anchored to one) an extra `(area.x, area.y)`
      pixels down-right of its true, axis-correct position. Silent at a glance (every bar shifts by
      the same amount, so relative heights still look plausible) but real and precisely verifiable
      against gridlines - found because the new `activeEvent="click"` demo's active tooltip for a
      near-max-value bar rendered fully invisible, clipped past the root `<svg>`'s own `viewBox`
      boundary; tracing that back led here. Confirmed independently on the page's very first demo
      chart (default padding, nothing to do with `display`/`active`): its tallest bar (`3Q`, value
      10, domain max 12) rendered visibly *shorter* than the "8" gridline it should clear by a wide
      margin. Fixed by dropping the redundant `translate(...)` from all four `<g>`s in
      `BarChart.vue` (main bars group + 3 tooltip overlay groups) - `bars` doesn't otherwise depend
      on `area.x`/`area.y`, so `area` is no longer destructured from `useChartLayout()` there at
      all. **Not fixed** (out of this item's scope - flagged as a new, high-priority tracked item
      directly below): spot-checked `/line`'s first demo chart and confirmed
      `LineChart.vue`/`AreaChart.vue`/`ScatterChart.vue` share the *exact* same
      `<g transform="translate(area.x, area.y)">`-over-already-absolute-coordinates pattern (their
      coordinates come from `useSeries.ts`'s `toSeriesScale()`, which also calls `axis.scale()`
      directly) - almost certainly the identical bug, not yet fixed or re-verified there.
      Demo: extended `/bar` with a "`active` / `activeEvent`" section - a static `:active="2"`
      column chart and an `active-event="click"` horizontal-bar chart, both using the existing
      `display` demo's dataset so the flat bar index is easy to hand-verify.
      **Playwright-verified**: `npm run test` (102/102, unchanged - no new pure logic needed),
      `npm run build:lib`, `npm run build` all clean. Zero console/page errors across `/bar`,
      `/line`, `/area`, `/pie`, `/donut`, `/scatter`, `/axis-orient`. Confirmed via rendered
      `opacity`/tooltip-text attributes (not just screenshots): static `active="2"` dims every bar
      but index 2 to `0.4`; clicking a bar sets it active (opacity `1`, tooltip shows its raw
      value, e.g. `"9"`) and dims the rest, with no toggle (clicking a second bar just moves the
      active state, doesn't clear it) and no reset on `mouseout`; hovering a *different*,
      non-active bar shows its own independent key+value hover tooltip alongside the still-active
      bar's value-only tooltip (both visible, correctly not deduped since they're different bars).
      Re-screenshotted the pre-existing `display="max"/"min"/"all"` section and the reproduces-
      bar.html chart after the coordinate-offset fix: bars and their labels now sit exactly on
      their gridlines (previously slightly short) - a visual improvement, not a regression, and the
      section is otherwise unchanged/unaffected by this item's actual `active`/`activeEvent` work.
- [x] **HIGH PRIORITY, fixed this iteration**: `LineChart.vue`/`AreaChart.vue`/`ScatterChart.vue`
      had the same coordinate double-offset bug just found and fixed in `BarChart.vue` (see the
      `active`/`activeEvent` item above for the original writeup/evidence) - every rendered mark
      was shifted an extra `(area.x, area.y)` pixels down-right of its true, axis-correct position,
      because `useSeries.ts`'s `toSeriesScale()` (which all three call, via `axis.scale()` directly)
      already returns absolute/padding-inclusive coordinates, yet all three wrapped their
      series-drawing `<g>` (and every overlay/tooltip `<g>`) in an extra
      `<g transform="translate(area.x, area.y)">`.
      **Source re-confirmation**: re-read `useChartLayout.ts` and `useSeries.ts`'s `toSeriesScale()`
      closely before touching anything - confirmed `toSeriesScale()` is a thin wrapper around
      `axis.scale()` with no offset math of its own, and `axis.scale()` (via `useAxis.ts`) is built
      directly from `useChartLayout.ts`'s `xInterval`/`yInterval`, which are themselves the
      *absolute* `[area.x, area.x2]`/`[area.y, area.y2]` pixel intervals - i.e. there is no layer at
      which a relative-to-area-origin coordinate is ever produced; every consumer of `axis.scale()`
      (bar, line, area, scatter, and `ChartBase`'s own gridlines) gets final, already-offset pixel
      space. Re-verified `ChartBase.vue` itself as the "ground truth": its gridlines/baselines/tick
      labels are drawn straight from `area.x`/`area.y`/`area.x2`/`area.y2`/`axisX.value`/
      `axisY.value` with **zero** wrapping `<g transform>` - confirming `ChartBase` was never
      buggy and is the correct pattern the other four brush components must match (which is exactly
      what `BarChart.vue`'s prior fix already did).
      **Fixed**: removed the redundant `<g transform="translate(area.x, area.y)">` from every
      occurrence in all three files - `LineChart.vue` (main series `<g>` + hover-tooltip overlay
      `<g>`, 2 total; `area` no longer destructured from `useChartLayout()` at all, matching
      `BarChart.vue`'s fix, since nothing else in the file used it), `AreaChart.vue` (main series
      `<g>` + hover-tooltip overlay `<g>`, 2 total; **`area` IS still destructured/used here**,
      unlike Line/Bar/Scatter - `baselineY`'s non-range-y-axis fallback branch legitimately reads
      `area.value.y2` directly as an already-absolute coordinate, not as a translate offset, so it
      was left alone and only the two transform wraps were removed), `ScatterChart.vue` (main marker
      `<g>` + hover-tooltip + `activeEvent`-tooltip + `display`-tooltip overlay `<g>`s, 4 total -
      confirmed via grep this was every reference to `area` in the file, so `area` was dropped from
      the destructure entirely, same as `LineChart.vue`/`BarChart.vue`). Also checked
      `PieChart.vue`/`DonutChart.vue`/`PieGrid.vue`/`DonutGrid.vue` per this item's brief (grepped
      for `useChartLayout`/`area.x`/`translate(area`): none of the four reference `useChartLayout`
      or `area` at all (pie/donut were never axis-based, confirmed not bugged, as expected).
      **Playwright-verified, not just visually but with exact numeric proof**: rather than relying
      only on screenshots, wrote a small Playwright script (`chromium.launch()` via
      `jui-grid-vue`'s local Playwright install, since this repo has none) that reads each chart's
      rendered SVG DOM directly - extracted the true gridline pixel `y` for each `axisY` tick value
      from `ChartBase`'s own `<line>` elements (not the tick `<text>` labels, which are offset by
      `theme('gridYFontSize')/3` for baseline alignment - an early pass of this check mistakenly
      diffed against label-text `y` and saw a spurious ~3.7px "error" for every point, which
      resolved to an *exact* match once compared against the real gridline `<line>` `y` instead),
      then linearly interpolated the expected pixel for every data point's known value and diffed
      against its actual rendered `cx`/`cy` (circles) or path `d` endpoint (line/area paths).
      Result: **every single data point across `/line`'s "normal" chart (12 points, 2 targets),
      `/area`'s "startZero" chart (10 fill-path segment endpoints), and `/scatter`'s default chart
      (16 markers, 2 targets, including a zero-value point)** landed on its expected pixel position
      to the full floating-point precision returned by the DOM (e.g. visits=120/Jan: expected
      `y=164.2926829268293`, actual `cy=164.2926829268293`; sensorA W1=12: expected `y=252`, actual
      `cy=252` - zero drift in any case checked). Also confirmed via screenshots (full-page,
      `/line`, `/area`, `/scatter`, `/bar`, `/pie`, `/donut`, `/axis-orient`) that every demo section
      on each page (not just the first) visually lines up correctly - `/line`'s curve/step/active/
      activeEvent variants, `/area`'s curve+line=false/activeEvent variants, `/scatter`'s
      triangle/rectangle/cross/hide+hoverSync/hideZero/activeEvent/display variants, `/bar`'s
      column/horizontal/display/active/activeEvent variants (re-confirmed `BarChart.vue`'s own
      fix from the prior iteration is still correct and complete - no further change needed there),
      and `/axis-orient`'s x-top/y-right/combined/horizontal-bar variants (which route through
      `LineChart`/`BarChart` under these same axis paths). Zero console/page errors across all 7
      pages. **Regression-checked interactivity** (not just static position) since this item
      touches the same `<g>`s hover/click tooltips live inside: on `/line`'s
      `activeEvent="mouseover"` chart, hovering the first point (visits/Jan=120) correctly dims the
      other series' stroke-opacity to `0.3` while keeping the hovered one at `1`, and shows a
      `"visits: 120"` tooltip (correct value, correctly positioned - no longer clipped/offset); on
      `/scatter`'s default chart, hovering the first marker shows `"sensorA: 12"` (correct value);
      on `/bar`'s `activeEvent="click"` chart, clicking a bar still dims every other bar to `0.4`
      and shows its value tooltip (confirms `BarChart.vue`'s already-shipped fix is unaffected by
      this iteration's changes to the other three files, as expected since `BarChart.vue` itself
      was not touched). `npm run test` (102/102 passing, unchanged - no new pure logic, this was a
      template-only fix), `npm run build:lib`, `npm run build` all clean.
- [x] Port `line.js`/`area.js`'s `display: "max"|"min"|"all"` auto min/max tooltip (item 4 had
      ported this for bar/column only, from `bar.js`) - `LineBrush`/`AreaBrush` both declare the
      same option in their `.setup()`. Picked up as this iteration's "time remaining" Phase A item
      after the HIGH PRIORITY coordinate-offset fix above.
      **Source read**: `line.js`'s `createTooltip()` gates per-point on
      `(display=="max" && pos.max[i]) || (display=="min" && pos.min[i]) || display=="all"` -
      `pos.max[i]`/`pos.min[i]` are exactly `useSeries()`'s already-computed per-point `max`/`min`
      flags (per-target, across all rows), so `LineChart.vue`/`AreaChart.vue` read them straight
      off their existing `series` computed rather than needing `selectDisplayBars` (unlike
      `BarChart.vue`/`ScatterChart.vue`, which don't otherwise call `useSeries()`). Re-read
      `area.js` fresh rather than assuming it'd mirror `active`/`activeEvent`'s "dead config"
      finding from item 7's audit - it does NOT: `drawArea()` calls `this.createTooltip(...)`
      directly (only `active`/`activeEvent`'s wiring lives exclusively in `drawLine()`), but only
      inside its `if(this.brush.line)` branch, so `display` markers require `line: true` -
      faithfully ported as `displayPoints = computed(() => props.line ? points.value.filter(...) :
      [])` in `AreaChart.vue`.
      **Deviation** (documented in both files' header comments): the original's `createTooltip()`
      only ever creates *one* tooltip object per line for `"max"`/`"min"` mode (a `tooltip == null`
      guard prevents re-creation, so a tie only shows the first qualifying point in row order) -
      this port shows every tied point's label instead, matching this codebase's established
      convention from `BarChart.vue`/`ScatterChart.vue`'s already-shipped `display` (both of which
      show all ties via `selectDisplayBars`), for cross-component consistency rather than
      replicating that original one-tooltip-per-line quirk.
      **Implementation**: added `display?: BarDisplayMode` and `format?: (value: number) => string
      | number` props to both components (matching `BarChart`/`ScatterChart`'s existing shape);
      `points` computed now carries an `isDisplay` flag per point; a new `displayPoints` computed
      filters to just those; a new overlay `<ChartTooltip visible>` loop renders a value-only label
      per qualifying point, styled identically to `BarChart`/`ScatterChart`'s existing `display`
      markers. Also applied `formatValue()` to the existing hover tooltip in both files (previously
      unformatted, inconsistent with the new formatted `display` labels and with
      `BarChart`/`ScatterChart`'s hover tooltips, which already format).
      **Not ported** (out of this item's original scope, left for a future iteration):
      `getOpacity()`'s per-row callback form of `opacity` (`(data, rowIndex) => number`) -
      `LineChart`/`AreaChart`'s `opacity` prop remains number-only.
      Demo: extended `/line` with a `display="max"|"min"|"all"` section (3 charts, reusing the
      existing monthly visits/signups dataset - May is every target's max, Mar every target's min,
      so "max"/"min" mode each show exactly one label per series) and `/area` with the same 3 charts
      plus a 4th (`display="max"` with `line="false"`) proving the `line`-gating nesting is
      faithfully ported. Both pages needed a `displayPadding` override (`top: 44` vs. the default
      `20`) so the topmost point's balloon isn't clipped by the root `<svg>`'s viewBox - same fix
      pattern as `BarPage.vue`'s existing `displayPadding`.
      **Playwright-verified**: screenshotted `/line` and `/area` full-page - `display="max"` shows
      `190`/`61` (visits/signups May values) correctly positioned above the May points and not
      clipped; `display="min"` shows `101`/`28` (Mar values); `display="all"` shows every point's
      value; `/area`'s `line=false` chart's rendered `<text>` content confirmed programmatically to
      contain only axis tick labels (no value markers), proving the line-gating logic works. Zero
      console/page errors across all 7 pages (`/line`, `/area`, `/scatter`, `/bar`, `/pie`,
      `/donut`, `/axis-orient`) after this change. `npm run test` (102/102, unchanged - no new pure
      logic, this was template/prop wiring reusing `useSeries()`'s existing per-point flags),
      `npm run build:lib`, `npm run build` all clean.
- [x] Port `pie.js`'s outside-label collision avoidance (`drawText()`'s stateful
      `preAngle`/`preRate`/`preOpacity` fade + leader-line-length shrink when adjacent slices'
      center angles are within 2 degrees of each other) into `usePie.ts`'s `pieOutsideLabelAnchor`.
      **Source read**: `src/brush/pie.js`'s `drawText()` "outside" branch (donut.js draws no
      `drawText` of its own - it inherits pie.js's unmodified via `extend: "chart.brush.pie"`, so
      one port covers both). Ported literally as a new pure `pieOutsideLabelDeclutter(centerAngles,
      baseRate)` in `usePie.ts`: walks labels in draw order, comparing each only against the
      *previous label actually drawn* (a collision-hidden label does NOT update the comparison
      angle, so a run of tightly-packed wedges keeps shrinking/fading rather than resetting per
      pair); shrinks `rate` by `baseRate * 0.05` and fades opacity by `0.25` per collision (gap
      `<2deg`), hides the label once `rate` drops to/below a hardcoded `1.2` floor (**not** relative
      to `baseRate` - ported this literal, slightly-odd original behavior as-is, including that a
      theme with `pieOuterLineRate <= 1.2` would hide every outside label), and resets to full
      rate/opacity on the next `>=2deg` gap. Also ported literally: the original's initial
      `preAngle = 0` (not "no previous label"), so a first label whose angle happens to land within
      2deg of literal 0deg is itself treated as a collision. Unit-tested in `usePie.spec.ts` (7
      cases: no-collision baseline, single collision shrink math, hide-on-cascading-collisions,
      hidden-labels-don't-advance-the-comparison-angle, reset-after-a-gap, order-dependence, the
      `preAngle=0` initial-condition quirk, and the `baseRate<=1.2`-hides-everything quirk).
      Wired into both `PieChart.vue` and `DonutChart.vue`: a new `outsideDeclutter` computed (only
      populated in `showText === "outside"` mode) feeds each wedge's label `rate` (replacing the
      flat `theme('pieOuterLineRate')` passed to `pieOutsideLabelAnchor`), a `labelOpacity` fade
      (combined multiplicatively with the pre-existing `active`-dim opacity for pie; donut has no
      active-dim, so it's the label's only opacity source), and a `labelHidden` flag that skips
      rendering the `<text>` entirely. Demo: new "showText='outside' with tightly-clustered small
      wedges" section on `/pie` and `/donut`, a hand-crafted `{big: 900, t1..t10: 1 each}` dataset
      (10 slices at ~0.4deg apart) chosen specifically to trigger the `<2deg` collision path.
      **Playwright-verified end-to-end** (not just unit-level): hand-computed the exact expected
      `preAngle`/`preRate`/`preOpacity` walk for this dataset (target order `big,t1..t10`) and
      confirmed the rendered screenshot matches exactly - `t1` and `t8` render at full
      size/opacity (`t2`-`t7` collide and shrink/fade/hide in sequence, `t8` is far enough from the
      frozen comparison angle to reset), `t2` and `t9` render faded (`rate≈1.235`,`opacity≈0.75`),
      `t3`-`t7` and `t10` are hidden entirely. Zero console/page errors on both pages; hover
      interaction on the pre-existing `activeEvent="mouseover"` demo re-verified with no errors
      (regression check on the wedge/label rendering changes touched by this item).
      **Important finding, correcting the prior audit's framing**: this does *NOT* fix the
      `PieGrid`/`DonutGrid` small-cell label overlap that motivated picking this item (the North
      America/Europe/etc. cells' `firefox`/`other`/`edge` labels colliding) - that grid demo uses
      `showText="inside"`, and re-reading `drawText()` confirms the original **never** declutters
      inside labels at all (the `preAngle`/`preRate`/`preOpacity` walk lives entirely in the
      `else` branch, i.e. outside-only) - so this is a pre-existing, upstream-faithful gap in
      *inside*-label placement (`pieInsideLabelPosition`'s static `radius/2` position, unchanged by
      this item), not something pie.js's collision avoidance was ever meant to solve. Confirmed by
      hand-computing the grid demo's actual center angles (12-70+ degrees apart between colliding
      labels, verified via the region data in `PiePage.vue`) - even if that demo were switched to
      `showText="outside"`, the now-ported algorithm's fixed `2deg` threshold wouldn't trigger for
      it either, because pie.js's decluttering was tuned for large single pies with genuinely
      near-touching wedges, not small-radius grid cells where modest angular gaps still collide in
      screen space purely because the radius (and thus arc length per degree) is small. Filing this
      precisely as a new, separate follow-up below rather than claiming it's fixed.

- [x] **New, more precise finding from the item above**: `PieGrid`/`DonutGrid`'s small-cell label
      overlap is an *inside*-label crowding problem (`usePie.ts`'s `pieInsideLabelPosition` is a
      static `radius/2` position with zero decluttering, and neither this port nor the original
      `pie.js` ever declutters inside labels). Two independent, separately-worth-doing fixes were
      identified here, neither of which is "port an existing algorithm" (there isn't one upstream
      for this case): (1) a from-scratch inside-label decluttering heuristic; (2) make
      `pieOutsideLabelDeclutter`'s angle threshold radius/pixel-aware instead of a fixed 2deg, and
      steer small-cell pies toward `showText="outside"` instead. **Picked approach (1)** - a new
      `pieInsideLabelDeclutter(centerAngles, labelTexts, labelRadius, fontSize)` in `usePie.ts`,
      wired into both `PieChart.vue` and `DonutChart.vue`'s existing `insideDeclutter` computed
      (mirroring `outsideDeclutter`'s shape/wiring exactly, only active when `showText==="inside"`)
      - chosen over (2) because it fixes the bug for existing `showText="inside"` callers as-is
      (no demo/consumer needs to switch modes to benefit), and because inside vs. outside is a
      meaningfully different visual style users may deliberately want at small sizes (dense grid
      cells often *want* inside labels precisely because there's no room for leader lines) - (2)
      would have "fixed" the bug by steering people away from the mode they picked rather than
      making that mode work.
      **Design, and a wrong first attempt**: same sequential-walk shape as
      `pieOutsideLabelDeclutter` (each label compared only against the previous label actually
      drawn, so a hidden label doesn't reset the comparison point). A first version used only
      `fontSize` as a line-height-only collision threshold (deliberately simple, per this item's
      "don't over-engineer" brief) and looked correct in isolation - unit tests passed, and it
      visibly fixed the reported `PieGrid` North America cell (`firefox`/`other` no longer
      overlapping). But the verification pass's *own* full-size single-pie `showText="inside"`
      demo screenshot (large radius, supposedly the "not broken" control case) showed `edge: 5`
      silently overlapping `firefox: 3` - a real, previously-unnoticed bug a height-only heuristic
      structurally cannot catch, since inside labels use `text-anchor="middle"` and can overlap
      *horizontally* even when their *anchor points* are many degrees (and many pixels) apart
      radially. Rebuilt the collision test to be width-aware: each label's on-screen half-width is
      estimated from its character count (`text.length * fontSize * 0.57` - the 0.57 factor
      isn't a guess, it's back-derived from item 4's own real `getComputedTextLength()` measurement
      of `"chrome: 64"` at fontSize 12, `68.3px measured / (10 chars * 12) = 0.569`), and two labels
      collide once the chord (straight-line pixel) distance between their positions is less than
      the sum of both half-widths - a standard circle-packing approximation. A colliding label is
      hidden outright (no fade): unlike the outside case there's no leader-line "rate" to shrink
      into more room, so a partially-transparent label still directly overlapping another one
      wouldn't actually fix legibility, just make both harder to read.
      **Second finding during verification, also fixed**: even after the above, one `PieGrid` cell
      still showed a truncated label (`edge: 9` rendered as `edge: .`) - not a label-vs-label
      collision but a label being *painted over* by a later-drawn neighboring wedge, because at
      small radii a narrow wedge's own colored path is routinely narrower on-screen than its
      label's text. Fixed by splitting `PieChart.vue`/`DonutChart.vue`'s single interleaved
      per-wedge `v-for` (path then text, path then text, ...) into two passes over the same
      `wedges` array - all paths first, then all labels - so no wedge can ever paint over any
      label regardless of draw order. Pure DOM-order change, no math/position changes; verified the
      per-wedge active-pull `offsetX`/`offsetY` transform stayed on the path-only `<g>` (not the
      label `<g>`, matching the original structure where only the path moved and inside-label pull
      was already baked into position via `labelRadius`, outside-label pull was never applied to
      text at all - an early draft of this change accidentally added the offset to both and was
      caught by rereading `DonutChart.vue`'s pre-existing comment on that exact behavior).
      Unit-tested in `usePie.spec.ts` (8 new `pieInsideLabelDeclutter` cases: no-collision at large
      radius, collision at small radius, reset-after-gap, hidden-labels-don't-advance-the-
      comparison-position, never-hides-the-first-label, a dedicated width-vs-angle case proving the
      heuristic is text-length-sensitive and not just angle/radius-sensitive, a hand-computed
      reproduction of the exact `PieGrid` North America bug, and the full-size-pie
      `edge`/`firefox` overlap this same math also catches). Demo: `PiePage.vue`'s existing
      `PieGrid` section (already `showText="inside"`) now exercises the fix as-is; `DonutPage.vue`'s
      `DonutGrid` section previously had no `show-text` prop at all (so it rendered no labels,
      exercising nothing) - added `show-text="inside"` so it demonstrates the fix too. Both pages'
      description text updated to explain the fix inline.
      **Playwright-verified end-to-end**: screenshotted `/pie` and `/donut`'s `PieGrid`/`DonutGrid`
      sections before and after - before, North America's `firefox: 4`/`other: 3` labels rendered
      as illegible overlapping text and `edge: 9` was truncated by neighboring-wedge paint-over;
      after, all six grid cells across both pages render every surviving label cleanly separated,
      with `edge`/`firefox`/`other` (packed tightly by design, ~9%/4%/3% of the circle) correctly
      hidden where they'd otherwise overlap rather than rendering garbled. Also re-screenshotted the
      full-size single-pie/donut `showText="inside"` demos (large radius, not a grid) to confirm (a)
      the newly-found `edge`/`firefox` overlap there is now also fixed (firefox correctly hidden),
      and (b) nothing else on those pages regressed - `showText="outside"` sections (including the
      pre-existing outside-declutter demo), `active`/`activeEvent` sections, and `showValue` are
      all pixel-for-pixel the same shape as before. Zero console/page errors on both pages across
      every screenshot pass. `npm run test` (96/96 passing), `npm run build:lib`, `npm run build` all
      clean.

**Iteration judgment**: picked this item over item 3 (`BarChart` active/activeEvent) because it
was flagged as a visible, confirmed bug on already-shipped components, and reading the source
first (rather than assuming the fix would trivially resolve the reported symptom) paid off - it
surfaced that the actual `PieGrid` bug is a different, previously-unrecognized gap (inside-label
crowding) than what item 5 as originally scoped ("port pie.js's decluttering") could ever have
fixed, since upstream itself has no decluttering for inside labels. Given the remaining 4 items are
all independently well-scoped and none block Phase B, and this iteration's time-box favors
depth over breadth, only this one item was completed this iteration - **recommend the next
iteration pick one of the two inside-label follow-ups above (they're what actually unblocks a
clean `PieGrid`/`DonutGrid`) rather than moving to Phase B yet**, since a "just-shipped, confirmed
visible bug" is a stronger claim on the next iteration's time than starting new Phase B chart
types while it's still open.

**Iteration judgment (this iteration)**: picked up the prior iteration's recommended follow-up
directly - the inside-label crowding item above - and chose approach (1) (a from-scratch
`pieInsideLabelDeclutter`) over approach (2) (steering small cells toward `showText="outside"`),
for the reasons detailed in that item's own write-up. Two things surfaced only during the
Playwright verification pass that weren't part of the original ask, and both were fixed in scope
rather than filed away, since they're the same class of bug (illegible inside labels) surfacing in
the exact scenario this item's own verification step required checking: (a) a naive
fontSize-only collision heuristic missed a genuine pre-existing overlap on the *full-size*
single-pie demo (proving the width-aware redesign was necessary, not just a nice-to-have), and (b)
a separate paint-order bug where a small wedge's own path could occlude part of a neighboring
wedge's label text, fixed by splitting the per-wedge render loop into a paths-pass then a
labels-pass. **Phase A is now genuinely done-enough**: every item on the checklist above is either
checked off or an independently-scoped, non-blocking gap (per-element event forwarding, per-axis
grid lines, `BarChart` active/activeEvent, line/area `display`) that the prior iteration already
confirmed doesn't block Phase B. With time remaining after finishing and verifying this item,
started Phase B's first item (`scatter.js`) below rather than stopping - see that item's own entry
for status.

**Iteration judgment (this iteration)**: picked up `BarChart` `active`/`activeEvent` (this
iteration's assigned item, previously tracked but unpicked since it's not visually-broken like the
pie/donut label item was). Source-read `bar.js` fresh rather than assuming it'd match the already-
shipped pie/donut/line/area pattern, which paid off twice: (1) confirmed `active` is genuinely
index-based (not name-based) and `activeEvent` has no toggle/reset (unlike pie.js), so the
implementation correctly reused `useActive.ts`'s `pieActiveOpacity` for the dimming math (identical
formula) without needing new pure logic, while still getting the index-vs-name and no-toggle/reset
distinctions right; (2) verifying it end-to-end (not just unit tests) surfaced two real bugs
unrelated to the literal ask that would have shipped silently otherwise: a hover/active-tooltip
dedup that never actually worked (`ref`-wrapped objects vs `computed`-returned raw objects are
never referentially equal, even for "the same" data), and - far more significant - a coordinate
double-offset bug in `BarChart.vue` that was shifting every bar (and every tooltip) an extra
`(area.x, area.y)` pixels from its true, axis-correct position, silently wrong since before this
iteration and visually confirmable against `ChartBase`'s own gridlines (a value-10 bar rendering
shorter than the "8" gridline). Both were fixed in scope, with full re-verification (tests, both
builds, Playwright screenshot comparison of every existing `/bar` section before/after, zero
console/page errors) - see the checklist item above for the complete writeup. Given the
double-offset bug's pattern (`useSeries`'s `toSeriesScale()` also calling `axis.scale()` directly,
wrapped in the identical redundant `<g transform>`) was confirmed present in `LineChart.vue` too via
a spot-check, and is very likely in `AreaChart`/`ScatterChart` as well, this is now filed as a new,
explicitly HIGH PRIORITY tracked item (see above) - **recommend the next iteration fix that before
anything else**, including before more Phase A items or continuing Phase B, since it's a
correctness bug in already-"verified" Phase A/B components rather than a scoped gap. **Phase A is
not fully clear**: after this iteration, 4 independently-scoped items remain (per-element event
forwarding, per-axis grid lines, line/area `display`, and the newly-found Line/Area/Scatter
coordinate-offset bug) - none block Phase B directly, but the coordinate-offset bug affects Phase
B's `ScatterChart` (already shipped) and will affect every future axis-based Phase B component that
copies the same `useChartLayout`/`useSeries` + wrapping-`<g>` pattern, so it's worth fixing before
that pattern gets copied further.

**Iteration judgment (this iteration)**: this iteration's assignment was explicitly the HIGH
PRIORITY coordinate-offset bug flagged above - fixed and Playwright-verified with exact numeric
proof (not just visual inspection) in `LineChart.vue`, `AreaChart.vue`, and `ScatterChart.vue` (see
that checklist item, now checked off, for the complete writeup); confirmed `PieChart.vue`/
`DonutChart.vue`/`PieGrid.vue`/`DonutGrid.vue` never had the bug (they don't use
`useChartLayout`/`area` at all) and re-confirmed `BarChart.vue`'s own prior fix needed no
correction. With the priority item done and fully re-verified (tests, both builds, a 7-page
Playwright screenshot + zero-console-error sweep, plus targeted hover/click interaction checks to
rule out regressions in the same `<g>`s the fix touched) and time remaining, picked up one Phase A
"if time remains" item: `line.js`/`area.js`'s `display: "max"|"min"|"all"` auto min/max tooltip
(now also checked off above) - chosen over per-element event forwarding (cross-cutting, needs a
payload/emit shape decided once for all 5+ components) and per-axis grid lines (needs a source
re-read of block vs. range axis line behavior) as the most tractable, lowest-risk remaining item,
and because it directly reused patterns already shipped and verified in `BarChart`/`ScatterChart`.
**Phase A is now down to 2 independently-scoped, non-blocking items**: per-element event forwarding
and per-axis grid lines (`axis.x.line`/`axis.y.line`). Neither blocks Phase B. Recommend the next
iteration pick up per-axis grid lines next (smaller, self-contained - a `ChartBase.vue`-only change
reading a new `axis.x.line`/`axis.y.line` config field) before the larger cross-cutting event-
forwarding item, to keep clearing Phase A down to zero as the user requested.

**Iteration judgment (this iteration)**: picked up the recommended next item, per-axis
`axis.x.line`/`axis.y.line` grid lines, per the user's explicit instruction to keep clearing Phase
A toward zero and not start Phase B/C/D. Source-read `grid/core.js`/`draw2d.js`/`block.js`/
`range.js` fresh before touching code (rather than assuming the prior iteration's framing was
complete) - confirmed both the "full-length line" geometry and the "works for block axes too"
claim directly from source (see the checklist item above for the full writeup); the geometry
turned out to require zero new coordinate math, since this port's existing `showGrid` gridlines
already compute exactly the same full-plot-height/width lines the original's `line` option does -
the only real gap was `showGrid`'s hardcoded `type === 'range'` filter and its single
chart-wide (not per-axis) toggle. Given the double-offset coordinate bug fixed 2 iterations ago was
explicitly flagged as a risk to watch for when touching axis/gridline code, deliberately reused
`ChartBase`'s pre-existing, already-correct `area.y`/`area.y2`/`area.x`/`area.x2` gridline
coordinates unchanged (only broadening which ticks/axis-types render them), rather than
introducing any new offset math - and verified this with the same numeric rigor as that fix (exact
gridline-vs-tick-label pixel cross-check via a Playwright DOM read, not just a screenshot).
**Design decision**: `axis.x.line`/`axis.y.line` coexists with `showGrid` as an additive,
per-axis override (`||`, never suppressing) rather than replacing/deprecating it - full reasoning
in the checklist item above and `README.md`. Added `line?: boolean` to `BlockAxisConfig`/
`RangeAxisConfig` (`types.ts`), resolved it in `useAxis.ts`'s `AxisResult` (same pattern as
`orient`), split `ChartBase.vue`'s single grid-lines `<g>` into independent x/y `<g>`s, extended
`useAxis.spec.ts` with `line`-resolution tests, extended the `/axis-orient` demo with a dedicated
4-chart section, and updated `README.md`'s "What's simplified" + axis-config docs. `npm run test`
(103/103), `npm run build:lib`, `npm run build` all clean; zero console/page errors across all 7
router pages; `/bar` and `/line` re-screenshotted and confirmed pixel-identical in behavior to
before (no existing demo sets `line`, so `showGrid`'s own code path is unchanged for them).
With the grid-lines item done and fully verified, time remained in this iteration, so per this
item's own "if time remains" instruction, also started the last remaining Phase A item:
per-element event forwarding (see the checklist item above, now updated in place rather than
duplicated). **Design decided and proof-of-concept shipped for 2 of 5 components**
(`BarChart`/`LineChart`, each matching its own upstream call-site granularity - per-bar vs.
per-series - discovered by reading `bar.js`/`line.js`/`area.js`'s actual `addEvent()` call sites
rather than assuming one shape fits all brush types), fully implemented/tested/Playwright-verified
end to end (including catching and fixing a real Vue template bug in the demo page itself along
the way - see the checklist item's writeup). `AreaChart`/`ScatterChart`/`PieChart`/`DonutChart`
(and by extension `PieGrid`/`DonutGrid`) deliberately **not** touched this iteration - explicitly
scoped as a separate, clearly-described remaining sub-item (see the checklist item above) rather
than rushed into a half-verified state across all 5+ components, per this item's own brief
("scope it to what you can fully implement, test, and verify... if it's too large to finish,
implement it for 1-2 components as a proof of the pattern... leave the rest as a clearly-scoped
sub-item rather than a half-wired mess").
**Phase A is not yet fully complete**: the per-element event forwarding item remains partially
done (2/5 components). Per the user's explicit request to keep clearing Phase A rather than start
Phase B/C/D, the next iteration should finish this item (`AreaChart` first - it should be the
closest to a mechanical repeat of `LineChart`'s pattern per this iteration's source read of
`area.js`'s `addEvent(g, null, k)` call site - then `ScatterChart`, then `PieChart`/`DonutChart`,
each preceded by its own source-call-site read as this iteration's findings show granularity
genuinely varies per brush type) and, once all 5 are done and verified, explicitly declare Phase A
complete here before considering any Phase B/C/D work.

**Iteration judgment (this iteration)**: picked up the recommended next item - finishing per-element
event forwarding for the remaining 4 components (`AreaChart`, `ScatterChart`, `PieChart`,
`DonutChart`), per the user's explicit instruction that this is likely the last iteration needed
for Phase A and to stop the loop entirely once it's clear. Read each component's real
`addEvent()` call site fresh rather than assuming it would mirror `BarChart`/`LineChart`'s already-
shipped pattern, which paid off: `area.js` turned out to have a genuinely different, arguably
buggy-upstream shape (a single shared whole-chart group re-registering N sets of listeners, one per
target, rather than a per-target element like `line.js`'s `p`) that would have produced a confusing
Vue API if reproduced literally - documented and deliberately deviated from (see the checklist item
above). `scatter.js` confirmed `cross` markers DO get `addEvent` forwarding despite being otherwise
non-interactive (a distinction easy to miss without reading the actual guard placement). `pie.js`/
`donut.js` confirmed identical per-wedge call-site shapes, and both needed the same `dataIndex:
null` deviation (not upstream's literal always-`0`) since this port's `PieChart`/`DonutChart`
`data` prop is a single `DataRow`, not an array - there's no array index to forward at this layer.
All 4 components implemented, wired alongside (never replacing) their pre-existing hover/`active`/
`activeEvent` handlers, demoed on their respective pages with a visible last-event log, and
Playwright-verified end to end (payload correctness via `element.dispatchEvent(new
MouseEvent(...))` - the same technique the prior iteration's own verification already established
as reliable for this codebase - plus a full before/after screenshot comparison of every existing
demo section on `/area`/`/scatter`/`/pie`/`/donut`, and an explicit `/bar`/`/line` no-regression
control since those two files were untouched this iteration). `npm run test` (103/103 passing,
unchanged), `npm run build:lib`, `npm run build` all clean; zero console/page errors across all 7
router pages.

**Phase A is now fully complete.** See the "Phase A complete" summary at the top of the Phase A
section above for the full list of what's covered. Per the user's explicit instruction, this loop
now stops here - **no Phase B/C/D work was started or continued in this iteration**, even though
time remained after finishing and verifying this item.

## Phase B — Additional brush types (axis-based, builds on existing scale/axis/series engine)

**Phase B is fully complete (15/15)**, as of the iteration that finished `arcequalizer.js` (see
that checklist item's own entry, last in this section, for the full write-up). Every checklist item
below is checked off. In full, Phase B ported 15 additional chart types on top of Phase A's
hardened engine (scale/axis/series/theme/layout, from the MVP pilot + Phase A):

1. **Axis-based, sharing the existing scale/axis/series engine** (`useChartLayout`/`useSeries`/
   `useAxis`, the same infrastructure Line/Area/Bar/Pie/Donut already used): `ScatterChart`,
   `BubbleChart`, `RangeAreaChart`, `RangeBarChart` (bar/column via `orient`, plus `CandlestickChart`
   reusing its range-pair geometry), `RateBarChart`, `BarGaugeChart` - each confirmed from source to
   either share or deliberately NOT share code with a same-named-looking sibling (a recurring
   lesson across this phase - see item 3 below), never assumed from naming alone.
2. Cumulative-sum stacking consumers of Phase A's already-ported-but-unconsumed
   `useStackedSeries`: `stacked` prop on Line/Area/Scatter/Bar (`stackarea`/`stackline`/
   `stackscatter`/`stackbar`/`stackcolumn`), plus `BarChart`'s `normalize` (100%-normalized
   stacking, `fullstackbar`/`fullstackcolumn`) and `equalizer` (VU-meter block-train stacked
   segments, `equalizerbar`/`equalizercolumn`) props, and a standalone `EqualizerChart` for
   `equalizer.js` itself (a genuinely different, non-stacking brush despite the shared name - see
   item 3).
3. **The recurring, repeatedly-reconfirmed lesson of this whole phase**: a shared/similar name
   (`equalizer.js`/`equalizerbar.js`/`equalizercolumn.js`; `bargauge.js`/`fullgauge.js`;
   `ratebar.js`; `pyramid.js`; `arcequalizer.js`) never reliably predicts a shared `extend` chain -
   confirmed by reading every single brush's own `extend:` field from source before writing any
   code, every time, rather than assuming from naming or visual-family resemblance. Concretely:
   `equalizer.js` extends `chart.brush.core` directly while `equalizerbar.js`/`equalizercolumn.js`
   extend `stackbar.js`/`stackcolumn.js`; `bargauge.js` and `fullgauge.js` are unrelated to each
   other (`core` vs. `donut`); `ratebar.js`/`pyramid.js`/`arcequalizer.js` all independently extend
   `core` directly despite `arcequalizer.js`'s name suggesting either the `equalizer` family or the
   pie/donut family (it shares code with neither - see its own entry below).
4. **Non-axis-based, trig/geometry-only brushes** (no `axis.x`/`axis.y` scale involvement, matching
   `PieChart`/`DonutChart`'s own established non-axis precedent from the MVP): `PinChart`,
   `SelectBoxChart`, `PyramidChart`, `ArcEqualizerChart` - each with its own genuinely distinct
   geometry (map-pin teardrop path; a plain selectable rect grid; a single solid triangle sliced
   into value-proportional trapezoids; row-count-proportional angular wedges with radially-stacked
   annular-sector blocks, respectively), plus grid/density brushes `HeatmapChart`/
   `HeatmapScatterChart` (axis-based but bucket/grid-oriented rather than per-point).
5. New composables/pure-logic modules added this phase (all unit-tested with hand-traced values,
   the rigor established from Phase A's coordinate-offset-bug findings): `useScatter.ts`,
   `useBubble.ts`, `useGridLayout.ts` (shared with Phase A's `PieGrid`/`DonutGrid`),
   `useGauge.ts`, `useHeatmap.ts`, `useHeatmapScatter.ts`, `useSelectBox.ts`, `usePin.ts`,
   `usePyramid.ts`, `useArcEqualizer.ts`, plus substantial new pure functions folded into the
   already-existing `useSeries.ts` (stacking/normalize/equalizer/range-pair/candlestick/rate-bar
   geometry - see that file's own header comment for the full list).
6. Every item re-verified with this port's established rigor: hand-traced unit tests for new
   geometry math (not just visual screenshots), and Playwright passes reading rendered SVG
   attributes back and diffing against independently hand-computed expected values (vertex
   coordinates, path `d` strings, angles) - not just "does it look right." Zero console/page errors
   maintained across every demo page in `router.ts` throughout the phase.

Source: `jui-chart/src/brush/*.js`. Line counts are the original file's size, a rough complexity
signal only.

- [x] `scatter.js` (299) — ScatterChart. One marker per (row, target) pair, positioned via
      `useSeries`/`getXY()` (no new coordinate math - same generalized data model Line/Area/Bar
      already use). Symbols ported from `getSymbolType()`: `circle`/`triangle`/`rectangle`/`cross`,
      as a fixed shape name or a `(key, value) => shape` per-point callback - **not** ported: the
      original's "callback returns an arbitrary image URI" mode (`<image>` markers are out of
      scope). `cross` markers are drawn but non-interactive (no hover/click), matching the
      original's `if (symbol.uri != "cross")` guard. New pure logic extracted to
      `useScatter.ts` (`resolveScatterSymbol`, `isScatterHighlighted`, `scatterTrianglePoints`),
      unit-tested in `useScatter.spec.ts` (7 cases, including `hoverSync`'s "same row index, any
      target" vs. the non-`hoverSync` "exact (index, key) match" distinction, and the triangle
      geometry). `hide`/`hideZero`/`display`("max"/"min"/"all", reusing the already-ported
      `selectDisplayBars`)/`opacity`/`hoverSync` all ported. **Deviation**: the original always
      recolors a marker on native hover (fill->`scatterHoverColor`, stroke->its own color, doubled
      width) *and* separately shows one shared plain-text label above the chart for the
      `activeEvent`-triggered marker; this port keeps the hover recolor (faithful) but, like
      BarChart/LineChart elsewhere in this codebase, uses the shared `ChartTooltip` balloon instead
      of the original's plainer text-only marker for both hover and the persistent `activeEvent`
      label - consistent with this codebase's established convention (see item 4's `BarChart`
      `display` bullet), not a pixel-match of the original. Not ported: `clip` (no brush does
      per-brush SVG clipping in this port - pre-existing gap shared by every other component), the
      entry animation. New theme tokens `scatterBorderColor`/`scatterBorderWidth`/
      `scatterHoverColor` added to `useTheme.ts` (classic + dark), ported from
      `src/theme/classic.js`/`dark.js`.
      **Data model finding** (inherited from the original, not introduced by this port): re-reading
      `chart.brush.core`'s `getXY()` confirmed it always treats exactly one axis as
      categorical/index-based and the other as each target's own numeric value - there is no "plot
      two independent numeric fields as (x, y) pairs" mode anywhere in the original engine, so
      `ScatterChart` (like the original) is a dot/strip plot, not a free-form x/y scatter. Documented
      in `ScatterChart.vue`'s header comment. An early draft of the demo page assumed the free-form
      case (two campaigns sharing one numeric "spend" x-field) and only caught the mismatch via
      Playwright: `useSeries`' per-target `value` (not the intended shared x-field) was silently
      feeding the x-scale, visibly misaligning the two targets' markers for the same logical row -
      redesigned the demo around a categorical x-axis (matching how the original's own data model
      actually works) before finishing verification.
      Demo: new `/scatter` page (`ScatterPage.vue`), a "weekly sensor reading" dataset (categorical
      week x-axis, two sensors' readings as `target`) - sections for each symbol, the per-point
      callback, `hide`+`hoverSync`, `hideZero`, `activeEvent="click"`, and `display="max"|"min"|"all"`.
      Playwright-verified: zero console/page errors; hovering a circle recolors it and shows the
      `ChartTooltip` balloon with the correct value; the `hide`+`hoverSync` chart's markers are all
      `opacity="0"` until hover, at which point hovering one sensor's marker reveals *both* sensors'
      markers for that week (confirmed via `hoverSync`'s same-row-index-any-target semantics,
      inspected programmatically via each ellipse's `cx`/`fill`/`opacity` attributes, not just
      visually); clicking a marker in the `activeEvent="click"` chart persistently recolors it and
      shows its value until another marker is clicked; the `cross` chart's rendered `<text>` content
      is byte-identical before/after hovering a cross marker (confirmed non-interactive, matching the
      original's guard); the `hideZero` chart renders exactly 15 markers (16 total minus the one
      zero-value point). `npm run test` (102/102 passing), `npm run build:lib`, `npm run build` all
      clean. Exported from `src/index.ts`.
- [x] `bubble.js` (183) — BubbleChart. **Source-confirmed** (per this item's own brief - don't
      assume): `BubbleBrush` `extend`s `chart.brush.core` **directly**, NOT `chart.brush.scatter` -
      a separate implementation, not "scatter plus a radius", though it shares the exact same
      positioning primitive (`getXY()`/`useSeries`, same dot/strip-plot data model as
      `ScatterChart` - see that component's own header comment / "Data model finding"). Radius is
      the only new dimension: config option `scaleKey` (a field name on each raw data row,
      independent of `target`) - when set AND numeric on a row, it overrides that row's radius-
      driving value for *every* target's bubble in that row (all targets in one row share the same
      `scaleKey` value, since it's per-row, not per-target - confirmed from `getBubbleRadius()`'s
      `dataIndex` parameter always being the ROW index, never the target index). When unset, each
      bubble's own target value doubles as its own radius driver instead. Radius scaling: a linear
      `scaleValue()` (ported from `util.math`'s function of the same name into `useBubble.ts`) maps
      the raw radius-driving value from an *input* domain into the `min`/`max` **output** pixel-
      radius bounds (props, default 5/30, matching `BubbleBrush.setup()`). The input domain is the
      min/max of `scaleKey`'s raw field across every row when set, else (faithfully ported from
      `drawBefore()`) the y-axis's own *resolved* domain bounds (`axis.y.min()/max()`, post "nice"
      rounding) - the original hardcodes the assumption that y is the value/range axis (same
      baked-in assumption the whole dot/strip-plot data model already makes for `getXY()`).
      **Deviation (robustness only)**: added a fallback (raw min/max across every `target` field)
      for a non-range y-axis, a configuration upstream doesn't guard against at all (would simply
      crash calling `.min()` on a block axis) - documented in `useBubble.ts`'s
      `bubbleRadiusDomain()` doc comment, never triggers for a faithfully-configured chart.
      **Notable, easy-to-miss nuance ported literally**: `format` receives the WHOLE raw data row
      (`this.format(this.axis.data[dataIndex])`), unlike every other component's `format(value)` -
      ported as `format?: (row: DataRow) => string | number` (`bubbleFormatText()` in
      `useBubble.ts`). `active`/`activeEvent`: genuinely **index-based** (flat, target-major index
      into the nested `for(target) for(row)` draw order), exactly like `BarChart`'s own (not a
      series name like Line/Area/Pie/Donut) - reuses `useActive.ts`'s `pieActiveOpacity()` as-is
      (confirmed identical formula). **Notable nuance**: unlike `BarChart` (dedicated
      `barDisableBackgroundOpacity` token), bubble.js's dimming reuses the SAME
      `bubbleBackgroundOpacity` token as every bubble's own constant `fill-opacity`, so an inactive
      bubble (once any bubble is active) compounds both multiplicatively (~0.25 net) - ported as two
      separate attributes (`fill-opacity` constant, `opacity` = the dim factor) on the circle, and
      `opacity` only on the optional label text, matching `cols[i].get(0)`/`.get(1)`'s separate
      `.attr({opacity})` calls exactly. No toggle/reset on `activeEvent` (overwrites unconditionally,
      matching `BarChart`'s own deviation-free port of the identical bar.js pattern) - unlike
      `BarChart`, bubble.js's `activeEvent` handler shows no tooltip of its own (only dims), so none
      was added beyond the port-only hover balloon below.
      **Port-only addition (not in bubble.js at all)**: a hover `ChartTooltip` (`showTooltip`,
      default `true`) - bubble.js has no `.hover()`/default tooltip wiring whatsoever (unlike
      scatter.js's native hover recolor) - added for consistency with every other axis-based
      component in this port (Line/Area/Bar/Scatter all got the same port-only addition).
      Not ported: `clip` (bubble.js's own `.setup()` has no such option at all - unlike scatter.js),
      the entry animation, the image-URI symbol mode (N/A - bubble has no `symbol` option, always a
      plain filled circle). New pure logic in `useBubble.ts` (`scaleValue`, `bubbleRadiusDomain`,
      `bubbleRadius`, `bubbleFormatText`), unit-tested in `useBubble.spec.ts` (16 cases: the linear
      scale math including the `minValue===maxValue` zero-division guard, all 3 domain-resolution
      branches, the `scaleKey` numeric/non-numeric/missing fallback chain, and the whole-row
      `format` callback). New theme tokens `bubbleBackgroundOpacity`/`bubbleBorderWidth`/
      `bubbleFontSize`/`bubbleFontColor` (ported from `src/theme/classic.js`/`dark.js` - dark's
      `bubbleFontColor` differs, `#868686` vs classic's `#fff`, the other 3 tokens are identical
      across themes). Per-element event forwarding: `drawBubble()`'s `this.addEvent(b, j, i)` fires
      unconditionally for every (row, target) pair (no `hideZero`-style guard exists in bubble.js
      at all, unlike scatter.js) - ported the same way. Demo: new `/bubble` page (`BubblePage.vue`),
      a "monthly city temperature" dataset (categorical month x-axis, two cities' temperatures as
      `target`) plus a per-row `rainfall` field for the `scaleKey` demo - sections for the
      no-`scaleKey` default, `scaleKey="rainfall"`, `showText`+`format(row)`+custom `min`/`max`,
      `active`/`activeEvent`, and per-element event forwarding. Exported `BubbleChart` from
      `src/index.ts` (`useBubble.ts` itself is not re-exported, matching `useScatter.ts`/
      `useActive.ts`'s existing precedent of keeping some composables internal-only).
      **Playwright-verified** (dev server + a script reading rendered SVG DOM attributes directly,
      not just screenshots): default chart's radii vary continuously with each bubble's own
      temperature value; the `scaleKey="rainfall"` chart's radii are **exactly equal, programmatically
      confirmed**, for every same-month pair (tokyo vs. sydney) since both share one row's
      `rainfall` field; the custom `min=10`/`max=45` chart's radii all fall within `[10, 45]`
      inclusive (confirmed against every rendered `r` attribute) and `format(row)` labels render as
      `"Jan: rainfall 52mm"` etc. (whole-row access confirmed, not just the value); `active="2"`
      (target-major index 2 = tokyo's 3rd row, March) shows `opacity="1"` only on that circle, `0.5`
      on the other 11; `activeEvent="click"` correctly overwrites the active index on each click with
      no toggle (clicking index 0 then index 3 moves the highlight, doesn't clear it); per-element
      event forwarding's `mouseover`/`click` payloads matched the exact expected `dataIndex`/
      `dataKey`/`data` for the first bubble; hover tooltip showed `"tokyo: 6"` correctly positioned
      above the bubble (offset by its own radius, not the marker's raw y, so a large bubble's balloon
      doesn't overlap it). Zero out-of-viewBox circles across all 6 demo charts (checked
      programmatically: every circle's `cx±r`/`cy±r` bounds stay within its SVG's `viewBox`), zero
      console/page errors. `npm run test` (114/114 passing, +11 new), `npm run build:lib`, `npm run
      build` all clean.
- [x] `candlestick.js` (82) — CandlestickChart. **Source-confirmed data model** (per this item's
      brief - don't assume the common naming, and don't assume the `useRangeSeries`
      `[low, high]`-tuple groundwork carries over): `draw()` reads FOUR separate, fixed field
      names per row via `this.getValue(data, "high", 0)` / `"low"` / `"open"` / `"close"` -
      `getValue` is `chart.axis.getValue()`, which looks up `data[axis.keymap[fieldString]]`
      first (an optional per-axis rename table - the source's own `examples/candlestick.html`
      remaps `high`/`low`/`open`/`close` to `h`/`l`/`o`/`c`) and falls back to
      `data[fieldString]` directly. This is genuinely NOT `useRangeSeries`'s 2-value
      `[low, high]`-tuple-per-target model (rangearea.js/rangebar.js/rangecolumn.js) - it's 4
      independent scalar fields on the SAME row, and critically **there is no `target` array
      config at all**: `CandleStickBrush` has no `.setup()` (confirmed by reading the whole
      82-line file), so `target`/`colors`/`display`/`active` (all inherited `chart.brush.core`
      defaults) are simply never read - one candle is drawn per row, unconditionally, not
      one shape per `(row, target)` pair like every other ported brush including
      RangeArea/RangeBar. This port has no `axis.keymap` composable, so the equivalent is 4 new
      props (`openField`/`highField`/`lowField`/`closeField`, defaulting to
      `'open'`/`'high'`/`'low'`/`'close'`) read directly off each row - a port-only ergonomic
      substitute for the same remapping capability, not a new concept, demoed in `/candlestick`'s
      "Custom field names" section.
      **Separate implementation, not a `bar.js`/`rangebar.js` extension** (checked explicitly per
      this item's brief, matching Phase B's established "verify, don't assume shared code" pattern
      from bubble.js/rangearea.js/rangebar.js): `extend: "chart.brush.core"` directly - shares no
      code with bar.js, rangebar.js, or rangecolumn.js beyond the inherited core
      `eachData`/`getValue`/`offset`/`addEvent` helpers every brush gets. Its own geometry
      (`drawBefore()`'s `barWidth = axis.x.rangeBand() * 0.7`/`barPadding = barWidth / 2`,
      `draw()`'s open/close-relative rect+line shape) is unique to this brush.
      **Body + wick, two primitives per row** (source-confirmed): one `<line>` (the high-low
      "wick", `x1===x2===startX`, `axis.y(high)` to `axis.y(low)`) and one `<rect>` (the
      open-close "body") per row. `startX = this.offset("x", i)`: for the block-type x-axis this
      brush is always used with, `offset()` returns `axis.x(i)` unchanged (its `rangeBand()/2`
      addition is gated on `type != "block"`) - confirmed this is exactly this port's own
      `ax.scale(i)` for a block axis, which `createOrdinalScale` already returns as the band's
      pixel CENTER (verified by reading `useScale.ts` fresh rather than assuming), matching
      `RangeBarChart.vue`'s own `ax.scale(i)` precedent.
      **Bullish/bearish color logic, theme-driven, source-confirmed**: branches on `open > close`
      (strictly) - NOT `close >= open` vs. `close < open` as two independent conditions; an exact
      tie (`open === close`) takes the "else" (bullish) branch, not invert. `src/theme/classic.js`/
      `dark.js` carry 4 tokens not yet in this port's trimmed `ChartTheme` (added this item):
      `candlestickBorderColor`/`candlestickBackgroundColor` (bullish/non-invert - classic: `#000`
      border / `#fff` fill, a hollow candle; dark: `#14be9d` solid teal both) and
      `candlestickInvertBorderColor`/`candlestickInvertBackgroundColor` (bearish/invert - classic:
      solid `#ff0000` both; dark: `#ff4848` both). No `colors`/per-target override exists upstream
      for either pair (no `.setup()` at all) - this component has no `colors` prop (unlike every
      other ported chart, which all have a per-target `target`/`colors` pair - candlestick
      genuinely has neither).
      **Per-element event forwarding**: `this.addEvent(r, i, null)` on the BODY rect only (never
      the wick line), unconditionally (no `value === 0`-style guard). `targetIndex === null`
      resolves `dataKey = null` (confirmed from `brush/core.js`'s `addEvent`) - payload shape is
      `{dataIndex: i (real row index), dataKey: null, data: row i}`, the INVERSE of
      RangeArea/RangeBar's per-target `{dataIndex: null, dataKey: real}` shape, because a
      candlestick is one-shape-per-ROW, not one-shape-per-target.
      **New pure logic**: `candleBodyGeometry(open, close, yScale)` (`useSeries.ts`) - the
      open>close branch selection and body y/height math, factored out of `CandlestickChart.vue`'s
      `candles` computed specifically so it's unit-testable without DOM (3 new cases in
      `useSeries.spec.ts`: bearish, bullish, and the exact-tie-is-bullish edge case, each checked
      against a hand-built linear scale). The block-axis x-center/`barWidth`/`barPadding` math is
      left inline in the component, matching `RangeBarChart.vue`'s own established precedent of
      not extracting simple per-row axis-center math into a composable.
      Port-only addition (not in candlestick.js at all, matching this port's established
      precedent - see e.g. `RangeAreaChart`'s/`RangeBarChart`'s identical note): a hover
      `ChartTooltip` (`showTooltip`, `format`) showing open/high/low/close for the hovered candle -
      the source has no default tooltip wiring of its own.
      Demo: new `/candlestick` page (`CandlestickPage.vue`), two weeks (10 trading days) of a
      fictitious stock ("ACME") with a deliberate bullish/bearish mix (5 of each) for the color
      verification pass, plus a custom-field-names section (the `axis.keymap`-equivalent props),
      a per-element event forwarding section with a visible last-event log
      (`data-testid="last-candlestick-event"`), and a dark-theme section exercising the newly
      added dark tokens.
      **Playwright-verified with exact numeric proof** (same gridline-calibrated methodology as
      `RangeAreaChart`/`RangeBarChart`): derived the y-per-unit slope from the main demo chart's
      own rendered y-gridlines (96/99/102/105/108/111 at y=368/298.4/228.8/159.2/89.6/20), paired
      x-gridline `x1` values with each candle's wick `x1`/body `x - width/2`, then hand-computed
      every one of the 10 rows' wick `y1`/`y2` and body `y`/`height`/`x` from that slope and the
      row's own known open/high/low/close - **all 10 rows matched the actual rendered `<line>`/
      `<rect>` attributes to full floating-point precision, zero drift** (e.g. row 0 09/01
      open=100/high=104/low=98/close=103, bullish: expected wick y1=182.4/y2=321.6, body
      y=205.6/height=69.6/x=55.92, actual exact match on every field; row 1 09/02 open=103/
      high=105/low=101/close=101, bearish: expected wick y1=159.2/y2=252, body y=205.6/height=46.4,
      actual exact match). **Color verification, all 10 rows, both directions**: bullish rows
      (5 of 10) rendered `fill="#fff"`/`stroke="#000"` on both body and wick; bearish rows (the
      other 5) rendered `fill="#ff0000"`/`stroke="#ff0000"` on both - confirmed programmatically
      against each row's own known open/close, not just visually. Custom-field-names chart (2nd
      demo section) confirmed to render the identical 10-candle geometry from renamed
      `o`/`h`/`l`/`c` fields via the new props. Event forwarding: dispatched `mouseover` then
      `click` on the first candle's body rect (3rd demo chart), confirmed the logged payload
      `dataIndex=0 dataKey="" data={"date":"09/01","open":100,"high":104,"low":98,"close":103}` -
      `dataKey` empty (Vue's `null` text-interpolation), matching the documented inverted-shape
      deviation from RangeArea/RangeBar. Zero out-of-`viewBox` wicks/bodies across all 4 demo
      charts (checked programmatically), zero console/page errors across all 11 router pages.
      `npm run test` (124/124 passing, +3 new), `npm run build:lib`, `npm run build` all clean.
      Exported `CandlestickChart` and `candleBodyGeometry` (via `useSeries.ts`'s existing
      `export *`) from `src/index.ts`.

**Iteration judgment (this iteration)**: completed the single item assigned - `candlestick.js` -
per the brief, source-reading the full 82-line file before writing any code rather than assuming
the prior iteration's `useRangeSeries`/`[low, high]`-tuple groundwork would carry over. It didn't:
candlestick.js reads 4 independent fixed field names (`high`/`low`/`open`/`close`, via
`getValue()`'s `axis.keymap` fallback), not a 2-value tuple per `target`, and has no `target` array
at all (no `.setup()` beyond the inherited core no-ops) - confirmed by reading the whole file, not
inferred from the 82-line count or the "OHLC ~ range" naming resemblance the brief specifically
warned against assuming past. Also confirmed explicitly (per the brief's instruction to check, not
assume, given Phase B's repeated "looks similar but is separate" pattern for bubble.js/rangearea.js/
rangebar.js): `extend: "chart.brush.core"` directly, no shared code with bar.js/rangebar.js. The one
genuinely new piece of pure logic (`open > close` branch selection + body y/height pixel math) was
factored into `candleBodyGeometry()` (`useSeries.ts`) specifically so it's unit-testable without a
DOM/scale-config setup, rather than left inline in the component (as `RangeBarChart.vue`'s simpler
per-row axis-center math was) - judged worth the extraction because the tie-breaking condition
(`open > close`, not `close < open`) is exactly the kind of off-by-one-in-spirit bug a hand-picked
unit test catches and a screenshot doesn't. Added the 4 missing theme tokens
(`candlestick(Border|Background)Color`/`candlestickInvert(Border|Background)Color`) to both
`classic`/`dark` in `useTheme.ts`, copied verbatim from `src/theme/classic.js`/`dark.js` (not
guessed). `npm run test` (124/124, +3 new), `npm run build:lib`, `npm run build` all clean; zero
console/page errors on the new `/candlestick` demo page (11 router pages total). Playwright
verification specifically prioritized the bullish/bearish color check per the brief's explicit ask -
confirmed programmatically (not just visually) against all 10 rows of the demo's deliberately
5-bullish/5-bearish dataset, in addition to the usual gridline-calibrated exact-pixel proof for
wick/body geometry.

**Recommended next Phase B item**: `stackbar.js`/`stackcolumn.js` (271/117 lines - flagged across
two prior iterations now as needing its own dedicated iteration, still unblocked, still not
started - the natural remaining "big" item once candlestick's own bigger-single-item slot is now
closed) - `equalizer.js`/`equalizerbar.js`/`equalizercolumn.js` (86/77/77 lines, unblocked,
independent, likely bar.js-adjacent) is a reasonable smaller alternative if a lighter iteration is
preferred instead.

- [x] `rangearea.js` (48) — RangeAreaChart. **Source-confirmed data model** (per this item's own
      brief - don't assume): each `target` field's row value is a **2-element `[low, high]`
      tuple** (`data[j][target[i]]`, `value[0]`/`value[1]` in the source), NOT two separate
      `target` field names - genuinely different from every prior component's single-value-per-
      point model. `RangeAreaBrush extend`s `chart.brush.core` **directly**, not `area.js` - no
      shared code, confirmed from source (no `import` of `line.js`/`area.js`, no `.setup()` at
      all beyond the inherited core options). `draw()` builds one closed polygon per target: every
      row's `value[0]` (low) traced forward, then every row's `value[1]` (high) traced backward -
      a literal point-to-point band with **no curve/step interpolation option** (the source has no
      `symbol` config), no `startZero`/`line`/`opacity`-override/`display`/`active`/`activeEvent`
      (none exist in `RangeAreaBrush.setup()` - there IS no `.setup()`) - ported minimally to
      match this genuine upstream minimalism rather than inventing options the source doesn't have.
      **Also source-confirmed**: `draw()` never calls `this.addEvent(...)` anywhere (re-read the
      whole 48-line file to be sure) - unlike every other component ported so far, and unlike its
      own `rangebar.js`/`rangecolumn.js` siblings (both of which do call it) - so per-element DOM
      event forwarding has no upstream call site to port here and was deliberately NOT added
      (documented in the component's header comment as a confirmed gap, not an oversight).
      **New composable logic**: `useRangeSeries()` (`useSeries.ts`) - the two-values-per-point
      `[low, high]` model doesn't fit `SeriesPoint`'s single-value shape (`useStackedSeries` could
      reuse `useSeries`'s output as its base; this can't - `low`/`high` are two independent range-
      axis evaluations per row, not one), so it's a genuinely new function alongside `useSeries`/
      `useStackedSeries` rather than a variant of either, returning a new `RangeSeriesPoint` type
      (`xLow`/`yLow`/`xHigh`/`yHigh`/`low`/`high` arrays) - same block/range-axis generalization as
      `useSeries` (whichever axis is `"block"` is evaluated once per row, shared by low/high;
      whichever is `"range"` is evaluated twice, once per value). `rangeAreaPolygonPoints()` builds
      the SVG `<polygon points="...">` string from a `RangeSeriesPoint` (forward-low/backward-high
      trace, skipping non-numeric rows rather than emitting `NaN`, a port-only robustness addition -
      the source has no such guard). Both unit-tested in `useSeries.spec.ts` (5 new cases: block-x/
      range-y and range-x/block-y coordinate mapping, reactivity, the polygon trace against a hand-
      built point set, and the malformed-row skip).
      **Port-only addition** (not in rangearea.js at all, matching this port's established
      precedent - see e.g. `BubbleChart`'s identical note): a hover `ChartTooltip` (`showTooltip`,
      default `true`, `format` prop) showing the low/high value at each row's low/high point via
      invisible hover circles (same shape as `AreaChart`'s own per-point hover circles) - the
      source has no default tooltip wiring of its own.
      Demo: new `/rangearea` page (`RangeAreaPage.vue`), a daily temperature high/low dataset
      (`temp: [low, high]` per day) plus a two-target ("two cities") variant proving
      `useAxis.ts`'s `computeRangeDomain()` already handles an array-valued domain field with zero
      changes needed there (confirmed by reading `computeRangeDomain()` fresh: its `else` branch,
      used for a single non-array `domain` field name, already special-cases `Array.isArray(value)`
      by pushing both the row's max and min into the fold - this was written for exactly this case
      even before this item started, most likely as a side effect of a prior item's domain-folding
      generalization, not code added by this item).
      **Playwright-verified with exact numeric proof** (script reading the rendered SVG DOM
      directly, calibrated against the chart's own gridline `<line>` y-positions per this project's
      established methodology): derived the y-per-unit slope from the chart's own rendered tick
      gridlines (8/12/16/20/24/28 at y=368/298.4/228.8/159.2/89.6/20), then hand-computed every one
      of the single-target chart's 14 polygon point coordinates (7 rows x low+high) from that slope
      and confirmed **byte-identical** matches against the actual rendered `<polygon points="...">`
      string (e.g. Mon low=12 -> y=298.4 expected/actual exact match, Sun high=17 -> y=211.4 exact
      match) - zero drift on any point checked. Zero console/page errors on `/rangearea`. `npm run
      test` (121/121 passing, +7 new), `npm run build:lib`, `npm run build` all clean. Exported
      `RangeAreaChart` and `useRangeSeries`/`rangeAreaPolygonPoints` (via `useSeries.ts`'s existing
      `export *`) from `src/index.ts`.
- [x] `rangebar.js` (69) / `rangecolumn.js` (66) — RangeBarChart. **Source-confirmed** (per this
      item's own brief): unlike `bar.js`/`column.js` (where `column.js` literally `extend`s
      `bar.js`), `RangeBarBrush`/`RangeColumnBrush` both `extend: "chart.brush.core"` **directly** -
      no inheritance relationship between them either. They ARE still structurally identical
      modulo an axis swap (same `outerPadding`/`innerPadding` options - the *only* two options
      either declares - identical `drawBefore()` group/item-size formula, identical per-target
      rect-drawing shape in `draw()`) - so, following this port's own established `BarChart.vue`
      precedent (`orient` prop merging `bar.js`/`column.js` into one component specifically
      *because* the underlying math is identical modulo an axis swap, even though upstream's own
      inheritance shape differs from rangebar/rangecolumn's), this port merges them into one
      `RangeBarChart` component via `orient: "bar" | "column"` too, rather than two separate
      `RangeBarChart`/`RangeColumnChart` components (the checklist's original naming assumed
      separate components; deviated from deliberately once the source read confirmed the same
      `BarChart`-shaped precedent applies).
      **Data model**: same 2-element `[low, high]` tuple per `target` field as `RangeAreaChart`
      (`value[0]`/`value[1]` in the source).
      **Source-confirmed minimalism**: neither `.setup()` declares `size`/`minSize`/`display`/
      `active`/`activeEvent` (all present on `bar.js`) or any border-radius option - rects are
      plain `chart.svg.rect(...)` (not `pathRect`/rounded). Ported minimally to match - no rounded
      corners, no `display`/`active`/`activeEvent` props exist here (unlike `BarChart.vue`).
      **Literal, deliberately-unguarded geometry** (ported exactly, not "fixed"): both sources
      compute the rect's value-axis start as the LOW value's pixel position and width/height as
      `Math.abs(low_px - high_px)`, with no check that low's pixel position is actually "before"
      high's - assumes a typical low<high tuple on a normal (non-reversed) axis. Preserved as-is.
      **Per-element event forwarding**: ported from both sources' own `this.addEvent(r, i, j)` call
      inside the per-target loop - called **unconditionally** (no `value===0`-style guard, unlike
      `bar.js`'s `getBarElement()` - confirmed there's no such guard in either source since a range
      rect has no single "zero" value to compare against). `dataIndex`/`dataKey`/`data` match
      `BarChart.vue`'s own shape (row index, target key, whole row).
      **New composable logic**: `rangeGroupGeometry(bandSize, count, outerPadding, innerPadding)`
      (`useSeries.ts`) - the shared group/item-size formula (`groupSize = bandSize - outerPadding*2;
      itemSize = (groupSize - (count-1)*innerPadding) / count`), floored at 0 (a defensive port-only
      addition for an overly-large padding config, matching `BarChart.vue`'s own `Math.max(...,0)`
      precedent for the equivalent bar.js formula - the source itself doesn't floor). Unit-tested
      in `useSeries.spec.ts` (2 new cases: the formula against a hand-computed example, and the
      floor-at-0 defensive case). The per-target rect geometry itself (reading the `[low,high]`
      tuple, stepping the group offset across targets) is computed directly in `RangeBarChart.vue`'s
      own `rects` computed, matching `BarChart.vue`'s own precedent of NOT extracting its grouped-
      bar geometry into a separate composable (no `display`/`active` selection logic exists here to
      justify one, unlike `BarChart`'s `selectDisplayBars`).
      **Port-only addition**: a hover `ChartTooltip` (`showTooltip`, `format`) showing the low/high
      value pair, matching this port's established precedent (see `RangeAreaChart`'s identical
      note) - neither source has default tooltip wiring.
      Demo: new `/rangebar` page (`RangeBarPage.vue`), a weekly stock price low/high dataset
      (`price: [low, high]` per week) - sections for `orient="column"` (default), the same data as
      `orient="bar"`, a two-target ("two stocks") grouped variant proving `rangeGroupGeometry`'s
      side-by-side item placement, and a per-element event forwarding section with a visible
      last-event log (`data-testid="last-rangebar-event"`).
      **Playwright-verified with exact numeric proof** (same gridline-calibrated methodology as
      `RangeAreaChart` above): derived each chart's px-per-unit slope from its own rendered tick
      gridlines, then hand-computed every one of the 5-week single-target chart's rect `x`/`y`/
      `width`/`height` values for BOTH orientations (column: e.g. W1 price=[98,112] -> expected
      y=155.333/h=135.333, actual **exact** match; bar: e.g. W1 -> expected x=165.333/w=205.333,
      actual **exact** match) - all 5 weeks x 2 orientations matched to full floating-point
      precision, zero drift. Two-target grouped chart: confirmed all 8 rects (4 weeks x 2 targets)
      have identical `width` (63.5, single shared `itemSize`), non-overlapping `x` positions
      stepping by exactly `itemSize + innerPadding` (64.5), and correct per-target colors. Zero
      out-of-`viewBox` rects across all 4 demo charts (checked programmatically against each SVG's
      own `viewBox`), zero console/page errors. Event forwarding: dispatched `click` on the first
      rect of the dedicated demo chart, confirmed the logged payload
      (`dataIndex=0 dataKey="price" data={"week":"W1","price":[98,112]}`) matches exactly. Hover
      tooltip confirmed showing `"price low: 98"` / `"price high: 112"` on the first bar. `npm run
      test` (121/121 passing, shared with the `rangearea.js` count above - both items landed in the
      same `useSeries.spec.ts` file this iteration), `npm run build:lib`, `npm run build` all clean.
      Exported `RangeBarChart` and `rangeGroupGeometry` (via `useSeries.ts`'s existing `export *`)
      from `src/index.ts`.

**Iteration judgment (this iteration)**: completed the three items assigned - `rangearea.js`,
`rangebar.js`, `rangecolumn.js` - per the brief, source-reading all three in full before writing any
code as instructed. Confirmed from source, not assumed: (1) the two-values-per-point data model is a
2-element `[low, high]` tuple on each `target` field, not two separate `target` fields; (2)
`rangebar.js`/`rangecolumn.js` both `extend: "chart.brush.core"` directly - genuinely separate
implementations from `bar.js`/`column.js`, not an inheritance relationship - but structurally
identical to each other modulo an axis swap (identical `outerPadding`/`innerPadding` options,
identical group/item-size formula), so this port's own `BarChart.vue` `orient`-prop precedent still
applies and one `RangeBarChart` component was built rather than two, exactly as the brief predicted
was worth checking for; (3) `rangearea.js` is fully separate from `area.js` (no shared code, no
`symbol`/curve option, no `startZero`/`line`/`display`/`active`/`activeEvent` - the source's
`.setup()` doesn't exist), and - a finding not anticipated by the brief - `rangearea.js`'s `draw()`
never calls `addEvent()` at all, unlike its two siblings, so `RangeAreaChart` deliberately has no
per-element event forwarding (documented as a confirmed gap, not a missed port). The two-values-per-
point model didn't fit `useSeries`'s existing `SeriesPoint` shape (confirmed by checking first, per
the brief's instruction not to assume `useStackedSeries`'s wrapper approach would carry over) - built
`useRangeSeries()` as a new, independent function in `useSeries.ts` (not a `useSeries` wrapper),
alongside `rangeAreaPolygonPoints()` and `rangeGroupGeometry()`, all pure and unit-tested (7 new
cases). All 3 verified with exact numeric proof (gridline-calibrated pixel math, this project's
established methodology) rather than visual-only inspection, catching zero discrepancies in the
process (unlike some prior iterations' HIGH PRIORITY coordinate-offset findings) - both components
correctly omit the `<g transform="translate(area.x, area.y)">` pattern from the start, having been
written after that bug class was already documented as a known pitfall to avoid. `npm run test`
(121/121, +7 new), `npm run build:lib`, `npm run build` all clean; zero console/page errors on the
two new demo pages (`/rangearea`, `/rangebar`).

**Recommended next Phase B item**: `stackbar.js`/`stackcolumn.js` (already flagged in the prior
iteration's own judgment note as needing its own dedicated iteration - 271/117 lines, a near-full
reimplementation rather than the trivial 17-line stack trio already shipped; still unblocked, still
not started) or `candlestick.js` (82 lines, unblocked, OHLC-style multi-value-per-row rendering -
now that this iteration has already built the `[low, high]`-tuple-per-row composable groundwork
(`useRangeSeries`), a candlestick's open/high/low/close 4-value-per-row model is a natural, related
next step worth a fresh source read rather than an assumption that it's "just one more value").

- [x] `stackarea.js` (17, extends area) / `stackline.js` (17, extends line) / `stackscatter.js`
      (17, extends scatter) — **source-confirmed** (per this item's own brief - don't assume) each
      is a genuinely trivial wrapper, nothing more: `{ extend: "chart.brush.<base>", draw() {
      return this.draw<Base>(this.getStackXY()) } }` - no new options, no changed defaults, no
      other overridden method. This exactly matches the shape Phase A's `useStackedSeries` (a
      drop-in alternative to `useSeries`, identical `ComputedRef<SeriesPoint[]>` output) was
      already built for.
      **Design decision - prop vs. separate components (explicitly asked for in this item's brief)**:
      chose **(a) a `stacked?: boolean` prop** added to the existing `AreaChart.vue`/`LineChart.vue`/
      `ScatterChart.vue` (swapping `useSeries` for `useStackedSeries` internally), not new
      `StackAreaChart`/`StackLineChart`/`StackScatterChart` wrapper components. Reasoning, weighing
      both established precedents in this port: `BarChart`'s `orient: "bar"|"column"` prop merges
      two brush types (bar.js/column.js) into one component because the underlying math is
      identical modulo an axis swap; `PieChart`/`DonutChart` stayed separate components because they
      differ in enough real rendering specifics (ring vs. full circle, different theme tokens,
      donut's own never-dims `active` behavior) that a shared component would need pervasive
      conditional branching. Stacking is a much closer match to the `BarChart` precedent than the
      Pie/Donut one - **stronger, even, since upstream itself treats it as "same brush, different
      data source"**: stackarea.js/stackline.js/stackscatter.js don't override `drawArea()`/
      `drawLine()`/`drawScatter()` at all, only `draw()`'s point *source*. A separate-component
      approach would mean 3 new files that re-import and re-render through the exact same template/
      logic as their base component, differing only in which series composable feeds them - pure
      duplication with no independent behavior to justify it, unlike Pie/Donut's genuine divergence.
      **Implementation**: each of the 3 components now calls both `useSeries`/`useStackedSeries`
      (both stay "live" - i.e. not conditionally constructed - so toggling `stacked` at runtime
      reacts correctly) and picks between them via a `computed(() => props.stacked ?
      seriesStacked.value : seriesNormal.value)`. `LineChart`/`ScatterChart` needed **no other
      change** - `drawLine()`/`drawScatter()` never reference another target's data, so swapping the
      point source is the entire change, exactly matching the literal upstream shape.
      **`AreaChart` needed one deliberate deviation, found by re-reading `drawArea()` fresh rather
      than assuming the "trivial swap" finding from Line/Scatter would carry over**: `drawArea()`
      closes every target's fill down to the SAME fixed baseline (`y = axis.y(startZero ? 0 :
      axis.y.min())`), unchanged by stacking - with `getStackXY()`'s cumulative y-values, that would
      make every target's fill span baseline-to-its-own-cumulative-height (each fill fully covering
      the ones beneath it), not a clean non-overlapping band. Upstream makes this look right via
      `g.prepend(p)` (each target prepended, so the *first*-processed/lowest-cumulative target ends
      up LAST in DOM = painted on top) plus translucent fill-opacity - the smallest layer visually
      occludes the bottom of taller layers beneath it, leaving each layer's true "band" as the only
      unoccluded region. That's fragile (depends on z-order AND opacity blending, still shows
      blended/muddied colors in the overlap region, not clean per-band colors). **Deviated
      deliberately**: `AreaChart.vue`'s `segmentsByTarget` now computes each stacked band's fill
      bottom edge as the *previous* target's own y-curve (straight line between its start/end
      points, at the same x positions - `useStackedSeries` guarantees every target shares the same
      row/x positions) instead of always the baseline, producing a true non-overlapping band per
      target with no z-order/opacity dependency. Chosen because it's simpler, more robust, and is
      the visual any stacked-area consumer actually expects - the cumulative *math* (the part that
      actually matters for correctness) is still ported exactly via `useStackedSeries`; only the
      *fill-geometry* mechanism differs from upstream's literal occlusion trick.
      **Unit tests**: none new - `useStackedSeries` itself was already thoroughly pinned in Phase A
      (`useSeries.spec.ts`, 3 cases including a hand-computed cumulative base/top); this item is
      pure wiring (a prop + a computed swap + one template band-fill formula change), no new pure
      logic to extract.
      Demo: `/line`, `/area`, `/scatter` each gained a "stacked (same data, non-stacked vs.
      stacked)" section - two charts side by side over the exact same data/targets (a dedicated
      `axisYStacked` config with a domain wide enough for the cumulative sum, since the existing
      demo's `axisY` domain only covers each target's own independent range and would clip a
      stacked series) for a direct visual A/B contrast.
      **Playwright-verified with exact numeric proof, not just visual inspection** (a script reading
      each chart's rendered SVG DOM directly, calibrated against the chart's own gridline `<line>`
      pixels - not tick-label `<text>` y, which is offset for baseline alignment and previously
      caused a documented spurious-error false alarm in this project's own history; re-used that
      established, correct methodology here): for all 3 components' "stacked" chart, the base
      target's inferred values matched its raw data **exactly (zero drift)**, and the stacked
      target's inferred values matched the *cumulative sum* **exactly (zero drift)** - e.g. Line's
      May: visits=190 (raw), signups inferred=251 (=190+61 exactly); Scatter's W6: sensorA=27,
      sensorB inferred=60 (=27+33 exactly). The "non-stacked" control chart alongside each also
      matched its raw (unstacked) values exactly, confirming the prop correctly gates the behavior
      rather than always stacking. **Area's band-fill geometry additionally confirmed via the raw
      path `d` data**, not just point positions: the "signups" (2nd target) fill path's bottom edge
      coordinates were byte-identical to the "visits" (1st target) fill path's own top-edge
      coordinates (`L 180 185.71...` appearing in both, exactly) - direct proof the band starts
      exactly where the previous one's ends, not from the baseline; the "visits" (base target) fill
      path's own bottom edge was confirmed to still be the baseline (`368`, i.e. y=0), unaffected.
      Screenshotted both the numeric proof and a visual crop of each "non-stacked"/"stacked" pair:
      Area's stacked chart renders as a clean two-tone band chart (bottom band solid purple, top
      band solid light blue, no overlap-blending), visibly distinct from the non-stacked chart's
      translucent-overlap look; Line's stacked chart shows the signups line consistently above (and
      tracking the shape of) the visits line's cumulative total; Scatter's stacked chart shows
      sensorB's markers shifted up to `sensorA + sensorB` height. Full 8-page regression sweep
      (`/bar`, `/line`, `/area`, `/pie`, `/donut`, `/scatter`, `/bubble`, `/axis-orient`): zero
      console/page errors, every page's SVG(s) rendered (non-empty). `npm run test` (114/114
      passing, unchanged from the bubble item above - no new pure logic), `npm run build:lib`,
      `npm run build` all clean.
- [x] `stackbar.js` (271) / `stackcolumn.js` (117) — bar/column stacking, added as a `stacked?:
      boolean` prop on the existing `BarChart.vue` (matching the `LineChart`/`AreaChart`/
      `ScatterChart` `stacked`-prop precedent), **not** separate components.
      **Source-confirmed, per this item's own explicit brief not to assume**: unlike the trivial
      1-line `stackarea.js`/`stackline.js`/`stackscatter.js` trio, `stackbar.js` `extend:
      "chart.brush.bar"` but overrides almost every method (`getBarElement`, `drawBefore`, `draw`)
      and adds several with no bar.js equivalent at all (`setActiveEffect`, `setActiveEvent`,
      `setActiveEffectOption`, `setActiveEventOption`, `getTargetSize`, `drawStackTooltip`,
      `drawStackEdge`) - the `extend` keyword describes the file's *shape*, not its behavior; this
      is a near-full reimplementation. `stackcolumn.js` (117) then extends `stackbar.js` itself
      (not `column.js`), overriding only `getTargetSize`/`drawBefore`/`draw` for the axis swap -
      mirroring `column.js`/`bar.js`'s own relationship one level further down. Confirmed
      `useStackedSeries` (Phase A's `getStackXY` port) needed **no new composable** for segment
      boundaries: each target's stored cumulative pixel IS the segment's outer edge, and the
      *previous* target's own cumulative pixel (or the zero baseline, for the first target) IS the
      segment's inner edge - both already sit in `useStackedSeries`'s existing per-target arrays,
      read pairwise.
      **What the extra 271/117 lines actually are** (not "just stack the bars" - confirmed from
      source, not assumed):
      1. Segments are plain, unrounded rects (`chart.svg.rect()`, never `.round()`-ed) - genuinely
         different from bar.js's `pathRect()` + corner-rounding. Ported by reusing the existing
         `roundedRectPath()` helper with all-zero radii rather than a second rect builder.
         Playwright-confirmed: grouped bars' rendered `d` contains SVG arc (`A`) commands, stacked
         segments' never do.
      2. A value===0 segment is hidden entirely (source: `display:none` + no `addEvent()`) - ported
         as `v-if="seg.value !== 0"` (no DOM node at all, so no hit area and no event forwarding),
         matching the source's own zero-value guard shape used elsewhere in this port already.
      3. `getTargetSize()`: one thickness per ROW (no per-target division, no `innerPadding` gap -
         segments butt directly together; confirmed `draw()` never references `innerPadding` at
         all), `size > 0 ? size : max(band - outerPadding*2, minSize)`. **Real semantic shift in
         `minSize`, ported faithfully**: here it's a floor on the whole stack's cross-axis
         thickness, not bar.js's per-value near-zero-length clamp (stacked mode has no such value
         clamp anywhere in `draw()`). This component reuses the same `minSize`/`outerPadding`
         props for both modes (`innerPadding` simply unused when `stacked`).
      4. `display: "max"|"min"|"all"` selects against each row's **stack total** (`sumValue`, the
         running sum across every target - confirmed via `setActiveTooltips`/`getMinMaxValue()`-
         style scan over sums), not any single target's own value - a real behavioral difference
         from bar.js. There's also no per-segment value label at all (`drawStackTooltip` is called
         once per ROW, never per segment). Ported via a new `selectDisplayIndices(values, mode)` in
         `useSeries.ts` - a generalization of the existing `selectDisplayBars` to an arbitrary
         numeric array (row sums aren't a per-target field lookup); `selectDisplayBars` now calls
         it internally (`rows.map(row => row[key])`), confirmed behavior-identical via a new test
         (`selectDisplayBars(...) === selectDisplayIndices(...)` on equivalent inputs).
      5. `active`/`activeEvent` operate on the whole **row group** (every one of that row's
         segments + its stack-total tooltip, dimmed/revealed together), not a single segment -
         confirmed from `this.addBarElement(group)` being called once per ROW with the row's whole
         `<g>` (`barList` here is one entry per row, unlike bar.js's one entry per (row, target)
         segment). `activeEvent` here has **no value===0 guard** at all (`setActiveEventOption(group)`
         only checks `activeEvent != null` - it's wired on the row group, so there's no single
         segment value to guard against). The stack-total tooltip's visibility, read directly from
         `setActiveEffect()`'s `if (opacity == 1 || tooltipIndexes.includes(i))`: `display`-selected
         OR the row is currently active - an OR, independent of whether `display` is even set -
         ported as `row.showTotal || row.dataIndex === effectiveActiveIndex`.
      **Deliberately NOT ported** (documented gap, not silently dropped): `edge`'s
      `drawStackEdge()` - optional diagonal connector lines bridging each target's segment boundary
      between adjacent rows (a stream/flow-graph-style overlay), including its axis-`reverse`-aware
      anchor-side correction. Self-contained, default-`false`, purely cosmetic on top of the now-
      faithfully-ported core stacking geometry - left for a future iteration if requested.
      **Design decision - same as the `stacked`-prop precedent, re-justified for this item's own
      brief (don't assume it still fits)**: despite `stackbar.js` being a near-full
      reimplementation rather than a 1-line wrapper, a `stacked` prop on `BarChart.vue` was still
      the right call over separate `StackBarChart`/`StackColumnChart` components - the *rendering
      primitive* (an axis-aligned rect per segment) and the *data flow* (props in, `useSeries`-
      family composable out, template renders `Bar[]`) are unchanged from grouped mode; only the
      geometry formula and the row-vs-segment granularity of `display`/`active`/`activeEvent`
      differ, both handled with `props.stacked` branches inside the same file (a new `stackedBars()`
      function feeding the existing `bars` computed, and a new `stackedRows` computed for the
      row-scoped concerns) rather than duplicating the whole grouped-mode template/event-forwarding
      machinery into a second component.
      **Implementation**: `stacked?: boolean` prop (default `false`). `bars` computed branches to
      `stackedBars()` when `props.stacked` (segment geometry only, `isDisplay` always `false`); a
      new `stackedRows` computed groups `bars`' flat segment list into per-row chunks (`bars.value
      .slice(i*len, i*len+len)`, valid since both modes build `bars` in the same row-major order),
      each with its stack `sum`, outer-edge `tooltipX`/`tooltipY` (read directly from
      `seriesStacked`'s last-target coordinate - no separate re-scale needed), and a `showTotal`
      flag from `selectDisplayIndices`. `barOpacity(i)` now converts `i` to its owning row index
      first when `stacked` (`Math.floor(i / target.length)`) before comparing against
      `effectiveActiveIndex` - so a segment, its row's other segments, and its row's stack-total
      tooltip (called with any segment index in that row) all resolve to the same opacity, matching
      `setActiveEffect()`'s whole-group dimming. Template: a `v-if="!props.stacked"`/`v-else` split
      between the existing flat per-bar loop and a new nested `v-for="row in stackedRows"` wrapping
      `<g>` (carrying the row's opacity + `activeEvent` listener) around each row's segment
      `<path>`s (each still individually wired for hover/click/dblclick/contextmenu forwarding,
      matching `stackbar.js`'s per-segment `addEvent()` call inside `getBarElement()`, separate
      from the row-level `activeEvent`). New `onRowActiveEvent(rowIndex)` handler (row-level,
      unguarded) alongside the pre-existing `onBarActiveEvent(bar, i)` (segment-level, value-
      guarded) - both write the same `activeEventIndex` ref, since only one mode is ever active.
      `suppressHover` (replacing the old direct `hoverIndex !== effectiveActiveIndex` template
      check) is `false` whenever `stacked` - the per-segment hover balloon and the row's
      stack-total active tooltip sit at different positions in stacked mode (a segment's own
      midpoint vs. the whole stack's outer edge), unlike grouped mode where the active tooltip and
      a same-bar hover tooltip would exactly coincide.
      **Unit tests**: `selectDisplayIndices` (new, 5 cases mirroring `selectDisplayBars`'s existing
      ones, plus one cross-checking the two functions agree on equivalent inputs) in
      `useSeries.spec.ts` - no other new pure logic needed (`useStackedSeries` itself was already
      pinned in Phase A; the rest of this item is geometry/template wiring in `BarChart.vue`).
      Demo: extended `/bar` with a new "stacked (stackbar.js / stackcolumn.js)" section using
      quarterly sales across 3 product categories (electronics/apparel/grocery, chosen so every
      row's stack total is distinct - 1Q=20, 2Q=16, 3Q=22 max, 4Q=15 min) - non-stacked vs. stacked
      column charts side by side (direct A/B, same pattern as the `stacked` trio's own demos), a
      stacked horizontal (`orient="bar"`) chart, `display="max"|"min"|"all"` (now labeling row
      totals), and `active`/`activeEvent` (static `:active="2"` and `active-event="click"`).
      **Playwright-verified with exact-coordinate proof** (this project's established methodology -
      gridline-calibrated linear fit, not tick-label text, then compared against every rendered
      segment): for the stacked column chart, all 12 segments (4 rows x 3 targets) matched their
      hand-computed cumulative start/end pixel **exactly, to floating-point precision** (e.g. 1Q's
      "grocery" segment: expected `top=89.600, height=55.680`, actual `top=89.59999999999997,
      height=55.680000000000035` - within `1e-13`, pure float rounding, zero real drift); the
      stacked horizontal (bar) chart's all 12 segments matched the same way on the x-axis (max
      error `2.9e-13`); every row's 3 segments confirmed to share an identical cross-axis
      top/height (or left/width) - i.e. full band thickness, no grouping gap, matching
      `getTargetSize()`. Confirmed via rendered `d` attributes: grouped-mode bars contain SVG arc
      (`A`) commands (rounded corners), stacked segments never do (plain rects) - the source
      difference from finding #1 above, visually and structurally confirmed, not just asserted.
      `display="max"`/`"min"`/`"all"` confirmed via rendered tooltip text: exactly one extra label
      ("22") for `max`, one ("15") for `min`, four (all of "20"/"16"/"22"/"15", one per row) for
      `all` - matching the hand-computed row sums exactly, not any single target's value. `active`/
      `activeEvent` confirmed via rendered row-group `opacity` attributes and tooltip text through a
      real click sequence: static `:active="2"` dims rows 0/1/3 to `"0.4"` and row 2 to `"1"`,
      showing "22" (3Q's total); clicking a segment in row 0 of the `active-event="click"` chart
      moves the active row to 0 (opacity `1`) and reveals BOTH that row's stack-total tooltip
      ("20") AND its clicked segment's own per-segment hover tooltip ("electronics: 10")
      simultaneously (confirming the `suppressHover` deviation above is correct - they don't
      collide); clicking a different row's segment moves activation there instead (no toggle, no
      reset), matching the literal, no-toggle port already established for grouped `BarChart`.
      Full 11-page regression sweep (`/bar`, `/line`, `/area`, `/pie`, `/donut`, `/scatter`,
      `/bubble`, `/rangearea`, `/rangebar`, `/candlestick`, `/axis-orient`): zero console/page
      errors, no suspiciously-empty SVGs, every pre-existing `/bar` section screenshotted and
      visually confirmed unaffected (bar.html repro, horizontal, `display`, `active`/`activeEvent`
      - none of which pass `stacked`, so `bars`'s grouped branch is untouched code, as expected).
      `npm run test` (130/130 passing, +6 new), `npm run build:lib`, `npm run build` all clean.
- [x] `fullstackbar.js` (110) / `fullstackcolumn.js` (101) — 100%-normalized stacked variants,
      added as a `normalize?: boolean` prop on `BarChart.vue` (only meaningful when `stacked` is
      also `true`), plus a new `showText?: boolean | ((percent: number) => string)` prop for the
      per-segment percent label. **NOT** separate components.
      **Source-confirmed, per this item's own brief not to assume**: both `extend:
      "chart.brush.stackbar"`/`"chart.brush.fullstackbar"` respectively, and DO reuse real inherited
      machinery (`getBarElement`/`addBarElement`/`setActiveEffect`/`setActiveEffectOption`/
      `setActiveEvent`/`setActiveEventOption`/`getTargetSize` - all unmodified) - but `draw()` is a
      full reimplementation with a genuinely different algorithm (`axis.x.rate`/`axis.y.rate`
      against each row's own `sum`, never the cumulative-through-the-axis-domain approach
      `stackbar.js`'s own `draw()` uses), and `drawStackTooltip`/`drawStackEdge`/`stackTooltips` are
      dropped entirely - `this.brush.display` and `this.brush.edge` are never even referenced in
      `fullstackbar.js`, confirmed by reading it end-to-end. So: real inheritance of the *helper*
      layer, full reimplementation of `draw()` itself - the same "extend describes shape, not
      behavior" pattern `stackbar.js` itself showed relative to `bar.js`, one level further down the
      chain.
      **Normalization math, derived by hand (not assumed) from `util.scale.linear.js`'s
      `func.rate(value, max) = func(func.max() * (value / max))`**: since `func` is linear with a
      domain starting at `0`, `func.max()` (the domain max) cancels out algebraically, leaving a
      plain `(value / sum) * totalPixelSpan`. **This means the value axis's configured domain/scale
      has ZERO effect on the bar/segment geometry** - every row's stack always spans the full plot
      width/height, proportioned only by that row's own targets' share of its own total, regardless
      of the row's raw total or the axis's domain max. Confirmed against both `examples/
      fullstackbar.html`/`fullstackcolumn.html` (both configure the value axis `domain: [0, 100]` by
      convention, purely so the tick labels *read* like a percent scale - `normalize` does not
      enforce or compute that). **The axis is NOT auto-relabeled as percentages** - it stays exactly
      as configured; only the bar/segment geometry bypasses it. The one place the domain max still
      matters: the optional percent TEXT label, ported literally as `Math.round((value / sum) *
      axis.x.max())` (`computeStackPercent` in `useSeries.ts`) - only a true 0-100 percentage when
      the domain max is configured as `100` (unit-tested explicitly to pin this non-obvious
      coupling, since with e.g. a domain max of `4` the same ratio reads `"1"`, not `"25"`). Segment
      geometry itself uses a new pure `normalizeStackFractions(values)` (per-row cumulative `[0,1]`
      fraction boundaries, target 0 = base, matching `stackedBars`'s existing stacking order) -
      deliberately NOT `useStackedSeries` (that composable maps values *through* the range axis's
      scale, the wrong tool here since normalize bypasses the axis scale entirely).
      **`display`/`active`/`activeEvent`**: `active`/`activeEvent` behave **identically** to
      `stacked`'s existing row-level semantics (inherited `setActiveEffect`/`setActiveEventOption`,
      called the same way from `fullstackbar.js`'s own `draw()`) - reuses the exact same
      `stackedRows`/`barOpacity`/`onRowActiveEvent` wiring, only the segment geometry itself
      branches. `display` has **no effect at all** in normalize mode - not "still row-scoped against
      a normalized total," genuinely unwired: `this.brush.display` is never read in
      `fullstackbar.js`, and `drawBefore()` never initializes `this.stackTooltips`/
      `this.tooltipIndexes` (both left `undefined`), so even the inherited `setActiveEffect()`'s own
      `if (tooltips)` guard silently no-ops - the row-total balloon `stacked` shows (`display`-
      selected or active) is entirely absent here, confirmed both from source and from this port's
      own Playwright check (zero `<rect>` elements beyond the chart background, even with
      `:active="1"` set).
      **API shape decision**: `normalize?: boolean` alongside the existing `stacked` (only
      meaningful when `stacked` is also `true`), rather than widening `stacked` to a `'true' |
      'full'` union or a separate `FullStackBarChart` component - chosen because that's the shape
      the source itself expresses (`fullstackbar.js` `extend`s `stackbar.js`, a real "stacked, plus
      normalization" relationship, unlike the genuinely-separate pairs earlier in this port such as
      `bubble.js`/`scatter.js` or `area.js`/`rangearea.js`). `normalize` composes with every
      `stacked` prop that still applies (`active`, `activeEvent`, `size`, `minSize`,
      `outerPadding`), and simply disables the one (`display`) the source itself drops.
      **Implementation**: `stackedBars()` (existing) now delegates to a new `normalizedBars()` when
      `props.normalize` (both feed the same `bars` computed, `stackedRows` grouping, hover balloon,
      and row-opacity/`activeEvent` machinery unchanged). `Bar` interface gained `percentText:
      string | null` and optional `textX`/`textY` (the percent label's anchor, ported literally from
      `drawText`'s own `+5`/segment-center-`+8` offsets - deliberately distinct from `tooltipX`/
      `tooltipY`, the segment's true geometric center used for this port's own hover balloon).
      `stackedRows`'s `showFlags` is forced all-`false` when `normalize` (no `selectDisplayIndices`
      call), and `stackRowTooltipVisible` short-circuits to `false` for the same reason. `area`
      (previously undestructured from `useChartLayout` in this file - nothing needed it) is now
      destructured for `normalizedBars()`'s `area.width`/`area.height`/`area.x`/`area.y2` pixel-span
      math.
      **Unit tests** (new, in `useSeries.spec.ts`): `normalizeStackFractions` (5 cases - always
      spans `[0,1]` regardless of row total, proportions match raw ratios for a very different row
      total, zero-sum guard, NaN-defaulting, empty input) and `computeStackPercent` (3 cases - true
      percentage at domain max 100, non-percentage at a different domain max showing the coupling is
      real, `NaN` on a zero sum). 8 new tests total (138/138 passing, was 130).
      Demo: extended `/bar` with a "normalize / 100% stacked" section - deliberately wildly
      different row totals (17, 450, 55, 1 - roughly a 450x spread) so normalization is visually
      obvious, both orientations, `showText` with both a custom formatter (matching
      `fullstackcolumn.html`'s own `p => p + "%%"` demo config) and the default `true` (matching
      `fullstackbar.html`'s own config), plus an `active`-only chart confirming row dimming still
      works with no row-total tooltip appearing.
      **Playwright-verified with exact-coordinate proof, not just visual**: read every rendered
      segment's `d` attribute directly and computed `x`/`y`/`width`/`height` from it. For the column
      (vertical) chart, every one of the 4 rows' segment heights summed to **exactly** the plot
      area's pixel height (348.0px, `area.y2 - area.y`) - confirmed for all 4 rows despite raw sums
      of 17, 450, 55, and 1 (e.g. row 2Q, sum 450: heights 77.333 + 232 + 38.667 = 348.0 exactly; row
      4Q, sum 1, single nonzero segment: height 348.0 alone, i.e. one segment filling the *entire*
      row on its own, still exactly 100%). Every segment's height-as-fraction-of-348 matched its raw
      `value/sum` ratio to floating-point precision (e.g. 2Q's first segment: 77.333/348 =
      0.222222... = 100/450 exactly). The horizontal (bar) chart showed the identical property on
      width against the plot area's pixel width (528.0px) for all 4 rows. Segments within a row
      confirmed contiguous (each segment's leading edge exactly equals the previous segment's
      trailing edge, no gaps/overlaps) and correctly ordered (target 0 = base). Rendered percent-text
      values cross-checked against hand-computed `Math.round(value/sum*100)` for every segment in
      every row (e.g. 2Q: 22%/67%/11%, hand-computed from 100/450, 300/450, 50/450 - matched
      exactly, including the `"%%"` custom-formatter suffix on the column chart vs. the default
      `"%"` suffix on the bar chart, per each demo's own `showText` config). `active=1` dimmed rows
      0/2/3 to opacity `0.4` and left row 1 at `1`, exactly like `stacked`'s own row-level dimming -
      and confirmed via `querySelectorAll('rect')` returning only the single chart-background
      `<rect>` (no row-total tooltip balloon), matching the "genuinely unwired" `display`/tooltip
      finding above. Full regression sweep across all 11 router pages (`/bar`, `/line`, `/area`,
      `/scatter`, `/bubble`, `/rangearea`, `/rangebar`, `/candlestick`, `/pie`, `/donut`,
      `/axis-orient`): zero console/page errors. Re-read the pre-existing (non-normalize) `stacked`
      chart's first-row segment `d` values and confirmed byte-identical to what the cumulative-
      through-the-axis-scale math would produce (untouched code path, confirmed not just assumed).
      `npm run test` (138/138, +8 new), `npm run build:lib`, `npm run build` all clean.

- [x] `equalizer.js` (86) / `equalizerbar.js` (77) / `equalizercolumn.js` (77) — equalizer-style
      (VU-meter/audio-level) bars. **Source-confirmed relationship, don't assume from the name**
      (per this item's own brief, and the general lesson from `stackbar`/`fullstackbar`): the three
      files are NOT one shared family. `equalizer.js` `extend`s `chart.brush.core` **directly** -
      shares no code with the bar family at all, has no `active`/`activeEvent`/`display`/`format`/
      `size`/`minSize` options (no inherited `.setup()` from `bar.js`). `equalizerbar.js`/
      `equalizercolumn.js` instead `extend: "chart.brush.stackbar"`/`"chart.brush.stackcolumn"`
      respectively - genuinely a *different pair*, despite the shared "equalizer" name, confirmed
      by reading each file's `extend:` field directly rather than assuming the naming implied a
      shared base. Built as: `EqualizerChart.vue`, a standalone new component for `equalizer.js`
      (only one orientation exists upstream - x=block category, y=range value, no "equalizerrow"
      sibling); and an `equalizer?: boolean` + `equalizerUnit?: number` prop pair added to the
      existing `BarChart.vue` for `equalizerbar.js`/`equalizercolumn.js` (only meaningful when
      `stacked` is also `true`), matching the single-component-with-orient-prop precedent already
      established for `bar`/`column`/`stacked`/`normalize`.
      **What "equalizer-style" rendering actually is** (confirmed from both `draw()`s, not
      assumed): NOT one continuous rect per bar - each `(row, target)` pair (or, for
      `equalizerbar`/`equalizercolumn`, each stacked segment) renders as a train of small
      fixed-size blocks with gaps between them. The two files use genuinely different
      algorithms for this, confirmed by reading both loops side by side:
      - `equalizer.js`: blocks grow from the zero baseline toward the value's pixel position,
        `unit`px tall each (default 5, a literal pixel height), separated by a **hardcoded 1.5px
        gap** (`var padding = 1.5` - a magic number in the source, not a configurable option). The
        block nearest the value's edge is clipped short instead of overshooting
        (`(eY - unit < valueY) ? abs(eY-valueY) : unit`), so the stack always lands exactly on the
        value. Ported as pure `equalizerBlocks(zeroY, valueY, unit, gap)` in `useSeries.ts`.
      - `equalizerbar.js`/`equalizercolumn.js`: blocks fill a stacked segment's length, stopping as
        soon as the *remaining* length can't fit another full block+gap step - any leftover
        shorter than one step is simply unfilled (no clipped final block, unlike `equalizer.js`).
        Block pixel size is a non-obvious formula, confirmed from `util.scale.linear.js`:
        `unit = band / (brush.unit * padding)`, where `band = axis.<x|y>.rangeBand()` **on the
        VALUE/range axis** (the pixel spacing between two adjacent ticks, set as a side effect of
        `ticks()` - a fundamentally different quantity from a block axis's per-category band
        width) and `padding = innerPadding` (inherited default `1` from `bar.js`, NOT
        `equalizer.js`'s own unrelated default of `10` - the two brushes never share a setup
        chain). `RangeAxisResult.band` is hardcoded `0` for a range axis in this port (no prior
        component needed a range axis's tick-pixel-spacing before this item), so this needed two
        new pure functions: `rangeAxisTickBand(values)` (derives it from the already-resolved tick
        pixel array) and `equalizerUnitSize(tickBand, equalizerUnit, innerPadding)`.
      - **Source-confirmed block-train quirk in `equalizerbar`/`equalizercolumn`**: the running
        pixel position is a single variable shared across a WHOLE ROW (declared once before the
        per-target loop, never reset between targets) - only each target's own remaining capacity
        resets per target. So block runs chain end-to-end from the row's zero-axis position, not
        realigned to each segment's own true cumulative boundary - a later segment's blocks can
        start slightly "early" relative to its true edge if the previous segment left an unfilled
        remainder. Ported faithfully (not smoothed over) as pure `equalizerStackedBlocks
        (segmentLengths, unitSize, gapSize)`, which threads one running offset across the whole
        `segmentLengths` array - unit-tested against a hand-traced 2-segment case showing the
        resulting drift, an exact-multiple case showing no drift, and the guard/edge cases. A
        whole-group post-hoc `translate` in the source (`(is_reverse) ? -unit : 0` for bar,
        `(is_reverse) ? 0 : -unit` for column) corrects an off-by-one-step placement quirk from
        rects being placed at the pre-step running position - derived by hand (traced both the
        reverse and non-reverse cases to confirm which needs the correction) and folded directly
        into `BarChart.vue`'s block `x`/`y` formula rather than a literal SVG `translate`.
      **Color**: `equalizer.js` bands color by `Math.floor(eIndex / gap)` (`eIndex` counting blocks
      outward from zero) - every `gap` (default 5) consecutive blocks share one theme color, then
      the next `gap` cycle to the next color - a genuine VU-meter color-zone effect. `equalizerbar`/
      `equalizercolumn` inherit `getBarElement()` from `stackbar.js` unmodified - uniform color per
      *target*, no per-block banding at all. Confirmed these are genuinely different, not a
      naming coincidence.
      **Events**: `equalizer.js` calls `addEvent(barGroup, i, j)` once per (row, target) block
      stack - ported 1:1 onto each stack's wrapping `<g>`. `equalizerbar.js`/`equalizercolumn.js`
      call `addEvent` **twice** per segment upstream - once per individual block (inherited
      `getBarElement()`'s own call) AND once more on the whole segment `<g>` - since a block is a
      DOM child of that group, a real click would bubble and fire twice. **Deviation (not
      replicated)**: matching this port's own established precedent for an upstream indiscriminate
      multi-fire quirk (`AreaChart.vue`'s per-target `addEvent`), wired forwarding once per segment
      only (same granularity as `BarChart.vue`'s existing non-equalizer stacked-segment handlers).
      **No theme tokens needed**: confirmed via grep that none of the three files call
      `chart.theme()` directly; `arcEqualizerXxx` belongs to the separate, out-of-scope
      `arcequalizer.js` (a radial gauge brush), and `equalizerColumnErrorXxx` belongs to the also
      out-of-scope `brush/canvas/equalizercolumn.js` (a **different**, canvas-based file, per this
      item's own explicit warning - confirmed the SVG `src/brush/equalizercolumn.js` was read, not
      the canvas one).
      **Unit tests** (new, `useSeries.spec.ts`): `equalizerBlocks` (5 - hand-traced upward/downward
      branches, color-banding cycle, zero-value, non-positive-`unit` guard), `equalizerStackedBlocks`
      (4 - the cross-segment drift case, an exact-multiple no-drift case, a too-short segment, the
      non-positive-step guard), `equalizerUnitSize` (2), `rangeAxisTickBand` (3) - 14 new tests
      (152/152 total, was 138).
      Demo: new `/equalizer` page (`equalizer.js` - default config, a `gap=2` color-banding variant,
      a `unit=10` larger-block variant, per-element event forwarding, dark theme) using audio-level
      data (bass/mid/treble per channel, L/R/C) with clearly distinct per-target magnitudes so the
      block train and color banding both read unambiguously; extended `/bar` with an "equalizer"
      section (column, bar, and a reversed-y-axis variant, `innerPadding=4`/`equalizerUnit=3`
      overridden from the defaults - which alone produce one ~tick-wide block, too coarse to read
      as discrete).
      **Playwright-verified with exact-coordinate proof, not just visual**: wrote a script reading
      each rendered chart's gridline pixel positions (correcting for the y-tick `<text>`'s own
      `+fontSize/3` baseline nudge, read off each label's own `font-size` attribute) to build a
      value->pixel interpolator, then hand-simulated each pure function against the real axis
      geometry and diffed against the actual rendered `<rect>` `x`/`y`/`width`/`height`/`fill`
      attributes. Every one of `/equalizer`'s first chart's 9 block stacks (3 rows x 3 targets, 11
      to 47 blocks each, 265 blocks total) matched `equalizerBlocks()`'s hand-simulated y/height to
      the full floating-point precision returned by the DOM, including color-band boundaries. All
      three `/bar` equalizer charts (column, bar, reversed-y-axis column) had every non-zero
      segment's block count and every block's `x`/`y` position match `equalizerStackedBlocks()` +
      the reverse-axis translate-correction formula exactly (36 segments checked total) - **one
      real discrepancy found and resolved during this check**: the initial demo data (`bass: 8` on
      the "R" row) landed a segment length almost exactly on an integer multiple of the block step
      (`12.8px`), and the verification script's independent 2-point interpolation rounded that
      floating-point boundary differently than the app's own scale-computation chain, producing a
      spurious 1-block mismatch - confirmed this was a floating-point-boundary artifact (not a
      logic bug) by checking the pure function's own exact-multiple unit test passes deterministically
      for round numbers, then changed the demo value to `8.3` (clear of the boundary) to keep the
      demo itself unambiguous; re-ran and got zero mismatches across all 36 segments. Also confirmed:
      the reversed-y-axis chart's axis genuinely maps larger values to larger pixel y (sanity check
      on the interpolator itself before trusting it); `gap=2` cycles color bands every 2 blocks vs.
      every 5 by default; `unit=10` renders fewer/taller blocks (25 vs. 43 for the same value, every
      block height <=10, last block clipped); per-element click forwarding on `/equalizer` returns
      the correct `dataIndex=0 dataKey="bass"` payload; hovering an equalizer-mode block on `/bar`
      shows the pre-existing segment hover tooltip (`BarChart.vue`'s tooltip machinery is otherwise
      completely unmodified - reused as-is for the block-rendering branch). **Full regression
      sweep**: zero console/page errors across all 12 router pages (`/bar`, `/line`, `/area`,
      `/pie`, `/donut`, `/scatter`, `/bubble`, `/rangearea`, `/rangebar`, `/candlestick`,
      `/equalizer`, `/axis-orient`); screenshotted `/bar`'s pre-existing `stacked`/`normalize`/
      `active`/`activeEvent` sections above the new equalizer section and confirmed unchanged
      (no regression from the new `Bar.blocks`-optional-field/template branch). `npm run test`
      (152/152), `npm run build:lib`, `npm run build` all clean.

- [x] `ratebar.js` (212) — RateBarChart. **Source-confirmed, don't assume from the name** (per this
      item's own brief, and the recurring lesson from `stackbar`/`fullstackbar`/`equalizer`): `extend:
      "chart.brush.core"` **directly** - shares NO code with `bar.js`/`stackbar.js`/`fullstackbar.js`
      (`RateBarBrush` writes its own `createBarElement`/`draw`/`setActiveBarElement` from scratch, no
      inherited `getBarElement`/`addBarElement`/`setActiveEffect`). Only ONE orientation exists
      upstream (no "ratecolumn" sibling) - x is always the range/value axis, y always the block/
      category axis (the reverse of `equalizer.js`), confirmed from `draw()`'s `this.offset("y", i)`/
      `axis.x.rate(...)` calls.
      **What "rate" actually means, confirmed from `draw()` - genuinely NOT a single value against a
      separate max/goal field** (the plausible guess from the name, checked and ruled out): each ROW
      renders as ONE pill-shaped horizontal bar, split into contiguous colored segments, one per
      `target` key whose value is `> 0` (`nonZeroKeys = keys.filter(k => data[k] > 0)` - a zero/
      negative value's target is skipped entirely, no zero-width placeholder). Each segment's width
      is that key's share of the ROW's OWN total (`sumValues`, only that row's nonzero targets) -
      i.e. a per-row 100%-composition bar, closer to `fullstackbar.js`'s `normalize` mode than to any
      single-value "progress toward a goal" widget. There is no separate background "track" bar - the
      segments themselves (always summing to 100% of the row) ARE the whole visible bar, and every
      row always fills the chart's full plot width regardless of its raw total.
      **Geometry derivation**: same algebra as `fullstackbar.js`'s `normalize` mode (see that item's
      own writeup and `normalizeStackFractions`'s doc comment) - the source's `axis.x.rate(data[key],
      sumValues)` is `util.scale.linear.js`'s `func(func.max() * (value/max))`, linear from a domain
      starting at 0, so the domain max cancels out algebraically, leaving a plain `(value / sum) *
      totalPixelSpan`. So the x-axis's configured domain has ZERO effect on segment geometry - only
      on the optional percent label, and only when that domain's max is configured as `100`
      (`computeStackPercent`, reused as-is from the `fullstackbar` item - same formula, confirmed by
      re-reading `ratebar.js`'s own `Math.round((data[key] / sumValues) * this.axis.x.max())` line
      against it). Ported the row/segment math as new pure `rateBarSegments()` in `useSeries.ts`
      (nonzero-key filtering, pixel `x`/`width`, percent, `isFirst`/`isLast` for the rounded pill
      ends) and `rateBarRowLayout()` (the row's vertical placement: `height = band - tooltipSize -
      padding/2`, `y = offset("y", i) - height/2 + tooltipSize/2` - nudged down by half the reserved
      tooltip gap so the flag callout has room above the bar).
      **Distinguishing visual features, each checked against source rather than assumed present**:
      (1) rounded pill ends - `theme('rateBarBorderRadius')` (default `5`) applies ONLY to the first/
      last *nonzero* segment of each row (interior boundaries always square, contiguous, no gap);
      confirmed the source's own `rightRadius` condition also checks `keys.length == 1`, but since
      `nonZeroKeys` is always a subset of `keys`, that clause is dead (hand-traced, not ported as a
      separate condition - see `rateBarSegments`'s doc comment). Extracted `roundedRectPath()` out of
      `BarChart.vue` (was private there) into `useSeries.ts` so both components share the same arc-
      path helper instead of a second hand-written copy. (2) An unconditional percent-or-custom TEXT
      label centered in every segment - **`showText` is a formatter, not a togglable boolean**,
      despite the plausible-looking name: `_.typeCheck("function", this.brush.showText) ? ... :
      \`${percent}%\`` means a non-function `showText` (including literal `true`/`false`) always
      falls through to the default text - there is no way to hide the label upstream. Kept this
      port's prop the same non-boolean shape (`(value, percent, key) => string | number`) rather than
      inventing a toggle. (3) A small dashed-line "flag" tooltip floating above each segment (in the
      reserved `tooltipSize`px gap), showing the raw value or a custom format (`showTooltip`, same
      non-boolean shape as `showText`), rendered only when the tooltip text's REAL measured pixel
      width is narrower than the segment's own width (`getTextSize(tooltip).width < width`) - ported
      via `measureTextWidth()`, extracted out of `ChartTooltip.vue` (was private there) into
      `tooltipMeasure.ts` so both components share one offscreen-`<text>` measurer rather than a
      second copy of the same DOM-measurement code. (4) NO color-banding-by-value (checked
      specifically since `equalizer.js` has this and the name "rate" plausibly suggested a
      speedometer-style red/yellow/green effect - ruled out: color is a plain per-TARGET
      `this.color(dataIndex, targetIndex)`, i.e. `pickColor(targetIndex)`, same convention as every
      other multi-target component in this port). (5) no animation-only features anywhere in the 212
      lines (checked, none exist).
      **`active`/`activeEvent` - a genuinely new, third shape in this port** (checked against both
      existing precedents - pie/donut/line's series-name dimming and `bar.js`'s flat-index dimming -
      and found to match neither): re-read `setActiveBarElement(activeIndex, activeTarget)`'s nested
      loop closely - `if (activeIndex != null && activeIndex == index && activeTarget != null &&
      activeTarget != key)` dims; every other case (including the exact matching segment itself) goes
      to the `else` branch (opacity `1`). This means dimming is scoped to segments in the SAME row as
      `activeIndex` whose own key differs from `activeTarget` - a segment in ANY OTHER row is never
      dimmed, and the matching segment is never dimmed either. So the visible effect is "dim this ONE
      row's other segments" (highlighting one segment within its own row), not `bar.js`'s whole-chart
      flat-index highlight or `stackbar.js`'s whole-row dimming. Ported as pure `rateBarActiveOpacity
      (rowIndex, key, activeIndex, activeTarget, disabledOpacity)` in `useSeries.ts`. `activeEvent` (a
      DOM event name) wires a listener per segment that unconditionally OVERWRITES the active pair on
      that event - no toggle, no mouseout-reset (same one-way-overwrite shape as `bar.js`'s own later-
      shipped `activeEvent`), and sets `cursor:pointer`, only when `activeEvent != null`.
      **Events**: `this.addEvent(g, dataIndex, targetIndex)` once per segment, unconditionally (no
      `value === 0` guard needed - the `nonZeroKeys` pre-filter already means a zero-value target has
      no group to attach a listener to). **No native hover balloon beyond the always-on flag callout**
      - unlike `EqualizerChart.vue`/`RangeBarChart.vue`'s port-only hover additions, no redundant extra
      `ChartTooltip` was added here, since the flag already surfaces the value without hovering.
      **Theme tokens**: 10 new `rateBar*` tokens added to `ChartTheme`/`classicTheme`/`darkTheme`
      (`useTheme.ts`), confirmed by reading `getBarStyle()` directly against `theme/classic.js`/
      `dark.js` - the source theme also carries an unused `rateBarBorderOpacity` (dropped here, never
      read by `getBarStyle()`, matching this file's own "trimmed to tokens actually used" convention).
      **Component design decision**: standalone new `RateBarChart.vue` + composable functions, NOT a
      new prop on `BarChart.vue` - matching the `equalizer.js` precedent (also `extend:
      "chart.brush.core"` directly) rather than the `fullstackbar`/`equalizerbar` precedent (both
      `extend` a bar-family brush and reuse its inherited helpers). Chose this because `ratebar.js`
      shares literally zero inherited machinery with `BarChart.vue`'s existing rendering (own
      geometry, own active/activeEvent shape, own tooltip widget, own fixed orientation) - forcing it
      into `BarChart.vue` would mean branching nearly every part of that file's template for no code
      reuse, unlike `normalize`/`equalizer`, which genuinely share the stacked-segment rendering
      primitive.
      **Unit tests** (new, `useSeries.spec.ts`): `roundedRectPath` (2 - hand-traced left-rounded-only
      path string, all-zero-radii plain rect), `rateBarSegments` (5 - nonzero-key filtering/skip,
      single-segment isFirst-and-isLast, all-zero row renders nothing, negative value excluded like
      zero, domain-max percent coupling), `rateBarRowLayout` (3 - hand-traced height/y formula, a
      barPadding variant, a zero-tooltipSize/zero-barPadding edge case), `rateBarActiveOpacity` (5 -
      same-row dimming, exact-match never dims, different-row never dims even with a matching key,
      null defaults, only-one-of-two-set defaults) - 15 new tests (167/167 total, was 152).
      Demo: new `/ratebar` page - storage usage per volume (system/apps/media/free, each row summing
      to exactly 100 so percent labels double as a sanity check, several zero-value targets to
      exercise the skip/rounded-end-shift logic), sales pipeline value per rep (wildly different row
      totals - 160/180/25/300 - proving the always-100%-width claim), a small domain-max=4 chart
      demonstrating the percent-label coupling directly, static `active-index`/`active-target` and
      dynamic `active-event="click"` variants (both using the pipeline data so the row-scoped-only
      dimming is easy to hand-verify), a tooltip-width-fit-check chart (a 0.4%-of-row segment next to
      a long custom-formatted tooltip string), per-element event forwarding with a last-event log, and
      a dark theme variant.
      **Playwright-verified with exact-coordinate proof, not just visual**: read every rendered
      segment's `<g transform="translate(x,y)">` + its `<path>`'s real `getBBox()` directly and
      compared against hand-computed values for the storage-usage chart's 4 rows (11 segments total,
      after 3 zero-value targets were correctly skipped) - every `x`/`y`/`width`/`height` matched to
      full floating-point precision (e.g. `/data` row: `translate(48, 34)`, widths `42.24`/`116.16`/
      `290.4`/`79.2` summing to exactly `528` = the plot area's pixel width; `/backup` row's skipped
      `apps=0` correctly shifted the rounded left end onto the `system` segment's `10.56`px sliver,
      not a phantom zero-width `apps` segment). Percent labels (`8%`/`22%`/`55%`/`15%` etc.) matched
      the raw data exactly (each row's values were chosen to sum to 100). Confirmed the domain-max=4
      chart's percent labels read `1%`/`3%` (not `25%`/`75%`) while segment widths stayed exactly
      `25%`/`75%` of the plot width - the coupling finding, numerically pinned. Confirmed the static
      `active-index=1 active-target="committed"` chart: Bob's `committed` segment stayed `opacity: 1`,
      Bob's `closed`/`pipeline` segments dimmed to exactly `0.7` (`theme('rateBarDisableBackgroundOpacity')`),
      and Alice/Cara/Dee's segments ALL stayed at `opacity: 1` - direct proof of the row-scoped-only
      (not whole-chart) dimming finding. Live-clicked the `activeEvent="click"` chart's DOM (via
      `dispatchEvent(new MouseEvent('click'))`, this port's established technique for elements below
      the fold - a first attempt using raw viewport `page.mouse.click()` coordinates silently missed
      because the target segment was below `page.mouse`'s un-scrolled viewport, a tooling pitfall
      rather than an app bug, caught by re-verifying against an explicit before/after baseline rather
      than trusting a single after-only read): before any click every segment was `opacity: 1`
      (correct - no static `active` props on this chart); clicking Cara's `committed` (80%) segment
      set exactly Cara's `pipeline` (20%) segment to `opacity: 0.7`, Cara's own `committed` stayed `1`,
      and every other row stayed `1` - live proof the click handler resolves the correct
      `(rowIndex, key)` pair and applies the same row-scoped rule as the static case. Confirmed the
      tooltip-fit-check chart: Erin's `closed` segment (2 of 500 = `0%` rounded, a few px wide) shows
      NO tooltip flag (`hasTooltipFlag: false`) while `committed` (98%, `490k in this stage`, the long
      custom format) shows its flag with the exact formatted text - direct proof of the width-gated
      fit check, not just a visual guess. **Full regression sweep**: zero console/page errors across
      all 13 router pages (`/bar`, `/line`, `/area`, `/pie`, `/donut`, `/scatter`, `/bubble`,
      `/rangearea`, `/rangebar`, `/candlestick`, `/equalizer`, `/ratebar`, `/axis-orient`); re-
      screenshotted `/bar` full-page (its `roundedRectPath` now imported from `useSeries.ts` instead
      of a private copy) and `/equalizer` (its `measureTextWidth`-adjacent `ChartTooltip.vue` refactor
      unrelated but touched the same file) - both pixel-identical to before this iteration, confirming
      neither shared-helper extraction changed any existing rendering. `npm run test` (167/167, +15
      new), `npm run build:lib`, `npm run build` all clean.

**Iteration judgment (this iteration)**: completed the one item assigned - `ratebar.js` - source-
reading it in full before writing any code, per the brief's explicit budget-real-time instruction (at
212 lines, bigger than every single Phase B entry so far except `stackbar.js`). The source read paid
off immediately and repeatedly: the plausible "value against a max/goal" reading of the name was
wrong (it's a per-row 100%-composition bar, not a single-value gauge); the plausible "speedometer
color-banding" guess (primed by `equalizer.js`'s real color-banding) was also wrong (plain per-target
color, no banding); and `setActiveBarElement`'s dimming condition, read carefully rather than
pattern-matched against `bar.js`'s or `stackbar.js`'s already-shipped `active`/`activeEvent` shapes,
turned out to be a third, genuinely different (row-scoped-only) rule neither precedent predicted -
this was the single most load-bearing finding, confirmed both by hand-tracing the nested-loop
condition and then re-confirmed live via a click-interaction Playwright sequence (not just the static
case) after an initial verification attempt gave a false negative from off-screen mouse coordinates,
not a real bug - re-verified against an explicit before/after baseline rather than trusting one
after-only read, which is what caught the tooling mistake. Chose a standalone `RateBarChart.vue`
(matching `equalizer.js`'s own precedent) over a new `BarChart.vue` prop specifically because the
source's `extend: "chart.brush.core"` directly means zero inherited-machinery reuse is available,
unlike `normalize`/`equalizer`'s genuine partial inheritance from `stackbar.js`/`stackcolumn.js` -
confirmed this distinction from source rather than assuming "extends core" always means "new
component" (it doesn't automatically - `equalizer.js` and `ratebar.js` both extend core directly and
both got new components, but that's a discovered pattern here, not a rule applied a priori). Extracted
two small pieces of genuinely-shared logic (`roundedRectPath()`, `measureTextWidth()`) out of their
previously-private homes in `BarChart.vue`/`ChartTooltip.vue` into `useSeries.ts`/`tooltipMeasure.ts`
rather than duplicating either - both re-verified via full regression screenshots to confirm the
extraction changed no existing behavior. `npm run test` (167/167, +15 new), `npm run build:lib`,
`npm run build` all clean; zero console/page errors across all 13 router pages.

**Recommended next Phase B item**: `bargauge.js` (79) / `fullgauge.js` (138) - both unblocked and
independent of everything just shipped; worth a source read first per this port's now-well-established
pattern (the "gauge" name plausibly suggests a shared `extend` chain or a shared radial-vs-linear
split, which should be confirmed rather than assumed, exactly like `ratebar`/`equalizer`/`fullstackbar`
all turned out to have non-obvious real relationships). `pin.js` (69) and `selectbox.js` (72) are also
unblocked, smaller items - `pin.js` in particular looks like a good small/quick follow-on if a shorter
iteration is wanted. `heatmap.js` (84) / `heatmapscatter.js` (152) and `pyramid.js` (165) are unblocked
but likely need their own new value->color gradient scale groundwork (doesn't exist in this port yet)
- worth sizing that up with a source read before picking either. `arcequalizer.js` (168) remains
better grouped with a future Pie/Donut-adjacent iteration (pie-family/radial, not axis-based) than
this axis-based cluster.

**Iteration judgment (this iteration)**: completed the one item assigned - `equalizer.js`/
`equalizerbar.js`/`equalizercolumn.js` - source-reading all three in full before writing any code,
per the brief (which explicitly flagged this as the load-bearing lesson from `stackbar`/
`fullstackbar`: don't assume a shared name means a shared `extend` chain). That check paid off
immediately: `equalizerbar.js`/`equalizercolumn.js` extend `stackbar.js`/`stackcolumn.js`, NOT
`equalizer.js` - the three files are a 2+1 split, not a family of three, confirmed by reading each
`extend:` field directly rather than inferring from the file names. This drove the architecture
directly: `equalizer.js` became its own new `EqualizerChart.vue` (matching this port's
`RangeBarChart`/`CandlestickChart` precedent for a brush that's genuinely distinct), while
`equalizerbar.js`/`equalizercolumn.js` became new props on the already-existing `BarChart.vue`
(matching the `stacked`/`normalize` precedent for a brush that's a real, if heavily-overridden,
extension of a sibling already living there). The two block-geometry algorithms turned out to be
genuinely different on close reading (one clips its last block to the value edge and bands color
by block index; the other leaves any remainder unfilled and never bands color, but has a subtler
cross-segment "shared running position" quirk instead) - ported each faithfully as its own pure,
unit-tested function rather than trying to unify them under one shared abstraction, since forcing
a shared shape would have hidden the real behavioral difference documented above. The
`RangeAxisResult.band` gap (hardcoded `0`, never needed until this item) was the one piece of new
engine-level work required - resolved by deriving a range axis's tick-pixel-spacing from the
already-computed `values[]` array (linear scales are affine, so any two adjacent ticks give the
same spacing `util.scale.linear.js`'s own `rangeBand()` would) rather than reimplementing
`ticks()`'s internal side effect. One real floating-point-boundary artifact was found and resolved
during Playwright verification (see the item's own writeup) - traced to the verification script's
own interpolation rounding differently than the app's scale chain at an exact block-step multiple,
confirmed via the pure function's own exact-multiple unit test that the underlying logic is
correct, and resolved by nudging the demo data off that boundary rather than the code. `npm run
test` (152/152, +14 new), `npm run build:lib`, `npm run build` all clean; zero console/page errors
across all 12 router pages.

**Recommended next Phase B item**: `ratebar.js` (212) or `bargauge.js` (79) / `fullgauge.js` (138)
- both unblocked and independent of everything just shipped. `pin.js` (69) and `selectbox.js` (72)
are also unblocked, smaller items. `heatmap.js` (84) / `heatmapscatter.js` (152) and `pyramid.js`
(165) are unblocked but likely need their own new axis/color-scale groundwork (a value->color
gradient scale doesn't exist in this port yet) - worth a source read first to size that up before
picking either. `arcequalizer.js` (168) is unblocked too but is pie-family (radial, not axis-based)
- better grouped with a future Pie/Donut-adjacent iteration than the axis-based cluster this and
the last several iterations have focused on.

**Iteration judgment (this iteration)**: completed the one item assigned - `fullstackbar.js`/
`fullstackcolumn.js` - source-reading both in full before writing any code, per the brief. Confirmed
the `extend: "chart.brush.stackbar"` relationship is real for the *helper* layer (`getBarElement`/
`setActiveEffect`/etc. genuinely inherited unmodified) but `draw()` itself is a full reimplementation
with a different algorithm (`axis.x.rate(value, sum)` against each row's own total, not the
cumulative-through-the-domain approach `stackbar.js` uses) - by hand-deriving `util.scale.linear.js`'s
`rate()` formula, found the domain max cancels out algebraically, meaning the segment geometry is
completely axis-domain-independent (only the optional percent *text* label still depends on the
domain max) - this was the single most load-bearing finding of the iteration, since it meant reusing
`useStackedSeries` (the obvious-looking reuse candidate) would have been wrong; a new
`normalizeStackFractions` pure function was the right tool instead. Also confirmed `display`/`edge`
are genuinely unwired in normalize mode (not merely "still applies, differently") by checking
`drawBefore()` never initializes `stackTooltips`, so the inherited `setActiveEffect()`'s own
`if (tooltips)` guard silently no-ops - verified this experimentally too (zero tooltip `<rect>`s
rendered even with `active` set). Chose `normalize?: boolean` alongside `stacked` (not a `stacked:
'true'|'full'` union or a new component) since that's the relationship the source itself expresses.
All numeric claims (100%-sum-regardless-of-raw-total, segment-proportion-matches-raw-ratio, percent-
label values, active-row dimming, absent row-total tooltip) Playwright-verified against hand-computed
expectations by reading rendered SVG `d`/`opacity` attributes directly, not just screenshots. `npm run
test` (138/138, +8 new), `npm run build:lib`, `npm run build` all clean; zero console/page errors
across all 11 router pages.

**Recommended next Phase B item**: `equalizer.js` (86) / `equalizerbar.js` (77) /
`equalizercolumn.js` (77) or `ratebar.js` (212) - both unblocked and independent of everything just
shipped. `bargauge.js` (79) / `fullgauge.js` (138) are also unblocked. Every other Phase B stacking/
range/candlestick item is now done (`scatter`, `bubble`, `candlestick`, `rangearea`,
`rangebar`/`rangecolumn`, `stackarea`/`stackline`/`stackscatter`, `stackbar`/`stackcolumn`,
`fullstackbar`/`fullstackcolumn`) - the equalizer/gauge/ratebar family is a reasonable next cluster
since none of them build on the stacking work, worth a source read first to check for shared shape
the way this iteration and its predecessor both did.

**Iteration judgment (this iteration)**: completed the two items assigned - `bubble.js` and the
`stackarea.js`/`stackline.js`/`stackscatter.js` trio - in that order, per the brief. Both source
reads paid off exactly as anticipated: bubble.js turned out to be a genuinely separate
`chart.brush.core` implementation (not scatter+radius, confirmed rather than assumed), and the
stack* trio turned out to be exactly the trivial 1-line `draw()` swap the brief predicted - *except*
that `drawArea()`'s shared-baseline fill geometry meant a literal port of stackarea.js would have
produced a fragile, occlusion-dependent overlapping visual rather than a clean stacked band; this
was caught by re-reading `drawArea()` fresh instead of assuming stackline/stackscatter's "trivial"
finding would carry over uniformly, and fixed with a deliberate, documented band-fill deviation
(see that item's own writeup). Chose the `stacked` boolean-prop design (not separate
`StackAreaChart`/etc. components) after explicitly comparing both of this port's existing
precedents (`BarChart`'s `orient` prop vs. `PieChart`/`DonutChart`'s separate-component split) -
stacking matches the `orient` precedent more strongly than either original candidate, since
upstream itself implements it as "same brush, different data source" (no method override beyond
`draw()`'s point source). `stackbar.js`/`stackcolumn.js` remain unchecked - **not** because they're
blocked (Phase A's `getStackXY`/`useStackedSeries` port already covers them too), but because they
weren't part of this iteration's explicit assignment; note `stackbar.js` at 271 lines is NOT the
same "thin wrapper" shape as the 17-line trio just completed (it's a near-full reimplementation, not
a 1-line `draw()` override) - source-read it fresh before assuming it's more of the same. **Also
not started**: `candlestick.js`/`rangearea.js`/`rangebar.js`/`rangecolumn.js` (unblocked, independent
of this iteration's work) and `fullstackbar.js`/`fullstackcolumn.js` (depend on `stackbar.js`/
`stackcolumn.js` first). **Recommended next Phase B item**: `stackbar.js`/`stackcolumn.js` (natural
continuation of the stacking work just finished, reuses the same `useStackedSeries`, but - per the
line-count flag above - needs its own fresh source read, likely closer in shape to `BarChart.vue`'s
own `active`/`activeEvent`-plus-`display` complexity than to the trivial trio just shipped) or
`rangearea.js`/`rangebar.js`/`rangecolumn.js` (independent, likely a moderate-complexity axis-based
addition - min/max-per-row bands rather than a single value per row) - either is a reasonable next
pick; `candlestick.js` is also unblocked but a bigger single item (OHLC-style multi-value-per-row
rendering) worth its own dedicated iteration rather than a "if time remains" add-on.

**Iteration judgment (this iteration)**: completed the one item assigned - `stackbar.js`/
`stackcolumn.js` - per the brief, source-reading both in full before writing any code as instructed
(the brief flagged this explicitly, twice, across two prior iterations' own recommendations: don't
assume the 271/117-line pair is "more of the trivial stackarea/stackline/stackscatter trio").
Confirmed from source, not assumed: (1) despite `extend: "chart.brush.bar"`, `stackbar.js`
overrides nearly every method and adds several bar.js has no equivalent of at all - a near-full
reimplementation, not a thin wrapper; (2) `stackcolumn.js` extends `stackbar.js` (not `column.js`),
mirroring `column.js`/`bar.js`'s own relationship one level further down; (3) `useStackedSeries`
(Phase A's `getStackXY` port) needed no new composable for per-segment start/end boundaries - each
target's cumulative pixel is the segment's outer edge, the previous target's is the inner edge,
both already sit in `useStackedSeries`'s existing output, confirming the brief's own hunch that this
was worth checking before assuming a new composable was needed. The real extra logic turned out to
be five distinct things, none of them "just stack the bars": plain unrounded rects (no
`.round()`), value===0 segments hidden with no event forwarding, a `getTargetSize()` whose `minSize`
means something different (a thickness floor, not a value clamp) than bar.js's own `minSize`,
`display` selecting against each row's stack *total* rather than any single target's value (needing
a new `selectDisplayIndices()` generalization of the existing `selectDisplayBars`), and `active`/
`activeEvent` operating on a whole row GROUP rather than a single segment (confirmed from
`addBarElement(group)` being called once per row upstream). Chose to extend `BarChart.vue`'s
existing `stacked` prop rather than build new components - even though the source is a near-full
reimplementation, the Vue-side rendering primitive (an axis-aligned rect per segment) and data flow
are unchanged from grouped mode, so the mode-dependent geometry/granularity differences fit cleanly
as `props.stacked` branches in the same file, avoiding duplicating the whole event-forwarding/
template machinery into new components. Deliberately did not port `edge` (`drawStackEdge()`'s
diagonal connector lines between adjacent rows' segment boundaries) - a self-contained, default-off,
purely cosmetic addition, documented as a known gap rather than silently dropped. All numeric claims
(segment boundaries, row-total labels, active-row dimming, hover/active tooltip coexistence)
Playwright-verified against hand-computed expectations, including a live click-interaction sequence
(not just static screenshots) confirming the row-level `activeEvent` moves correctly with no
toggle/reset, matching the literal source semantics and this port's own established grouped-`BarChart`
precedent. `npm run test` (130/130, +6 new), `npm run build:lib`, `npm run build` all clean; zero
console/page errors across all 11 router pages.

**Recommended next Phase B item**: `fullstackbar.js` (110) / `fullstackcolumn.js` (101) - a natural
follow-on now that `stackbar.js`/`stackcolumn.js`'s stacking geometry exists to normalize (100%-
stacked, each segment's height/width becomes a *percentage* of its row's stack total rather than an
absolute value) - worth a source read first to confirm how much of `stackedBars()`/`stackedRows`
can be reused vs. needs its own normalization pass before the cumulative-sum step. `equalizer.js`
(86)/`equalizerbar.js` (77)/`equalizercolumn.js` (77) or `ratebar.js` (212) are also unblocked,
independent alternatives if `fullstackbar`/`fullstackcolumn` turn out to need more than expected.
`candlestick.js`-adjacent items are already done (see above); `rangearea.js`/`rangebar.js`/
`rangecolumn.js` are also already done. `equalizer.js`/`equalizerbar.js`/`equalizercolumn.js` are
now also done (see above) - not, as this stale note once guessed, a trivial one-item follow-on.
`ratebar.js` is now also done (see above). `bargauge.js`/`fullgauge.js` are now also done (see
below).
- [x] `bargauge.js` (79) / `fullgauge.js` (138) — BarGaugeChart / FullGaugeChart. **Source-
      confirmed, don't assume from the name** (per this item's own brief, and the single most
      recurring lesson in this whole port - see `ratebar.js`'s entry above for the most recent
      prior instance): read both files in full before writing any code. Confirmed `bargauge.js`
      `extend`s `chart.brush.core` **directly** (no relation to `bar.js`) and `fullgauge.js`
      `extend`s `chart.brush.donut` (literally, `import DonutBrush from './donut.js'` +
      `jui.use(DonutBrush)`) - the two files are **not** variants of each other and share no
      `extend` relationship at all, despite both having "gauge" in the name. They also turned out
      to be two *different* answers to "is a gauge radial or linear": `bargauge.js` is linear (a
      list of horizontal fill bars), `fullgauge.js` is radial (a donut-style progress ring) - the
      opposite of what the name pairing ("bar" = linear, "full" = ambiguous) might suggest in
      isolation.
      **`bargauge.js`'s actual model, confirmed from `draw()`**: reads `axis.c(0)` exactly once
      (`chart.grid.panel`'s cell - confirmed by reading `panel.js`: `scale(i)` always returns the
      *whole chart plot area* regardless of `i`, with zero padding by default since no shipped
      usage configures `axis.padding`) - **never touches `axis.x`/`axis.y`, so despite the "bar"
      half of its name it is not axis-scale-based at all**, unlike every other bar-family component
      in this port. It then stacks ONE horizontal bar per DATA ROW underneath that single cell
      (`y += brush.size + brush.cut` per row inside `eachData`) - so a single `BarGaugeChart`
      instance renders a *list* of independent value-vs-range bars (own `value`/`title`/`max`/`min`
      per row), not a gauge for one value; multiple rows need no grid/small-multiples support at
      all (unlike `fullgauge.js`/`pie.js`/`donut.js` below), since the source's own loop already
      stacks them within one shared cell. **Two literal quirks found and ported as-is, not
      "fixed"**: (1) `value = (width / (max - min)) * v` - `min` is used only as part of the fill-
      width divisor, never subtracted from `v` as a baseline offset, so `v === min` does NOT render
      a zero-width bar the way a conventional value-vs-range gauge would (demoed explicitly on
      `/bargauge`, hand-verified via Playwright: `v=20` against `[20,100]` renders 75px wide, not
      0px). (2) the background "track" rect (`x: x+cut, width: <cell width>`) and the foreground
      "fill" rect (`x: x, width: value`) are not drawn from the same left edge - preserved exactly,
      not re-aligned. No threshold/color-banding, no needle/pointer, no clamp on `v > max` (renders
      a bar wider than the track, uncapped) - confirmed absent from all 79 lines.
      **`fullgauge.js`'s actual model, confirmed from `drawUnit()`**: a genuine radial speedometer-
      style progress ring - reuses the inherited `DonutBrush.drawDonut()` (the exact stroked-arc
      path builder `DonutChart.vue` already ports as `donutSlicePath()` in `usePie.ts`) to draw a
      background TRACK arc (the configured `[startAngle, startAngle+endAngle]` range, minus the
      value arc and a `paddingAngle` gap on each side) plus a foreground VALUE arc (sweep
      proportional to `(value-min)/(max-min)`, a *real* baseline-offsetting fraction here - unlike
      `bargauge.js`'s divisor-only `min` quirk, confirmed by re-reading `drawUnit()`'s `rate =
      (value - min) / (max - min)` line directly). Positioned via `axis.c(index)` (the same
      per-row-needs-its-own-grid-cell architecture as `pie.js`/`donut.js`'s small-multiples, not
      `bargauge.js`'s single-shared-cell stacking). **Radius math deviates from `DonutBrush
      .getProperty()`'s own convention** - `fullgauge.js` computes its own inline `outerRadius = w
      - size` / `innerRadius = outerRadius - size` (`w = min(width,height)/2`) rather than calling
      (or overriding) the inherited `getProperty()`, leaving the ring's true visual outer edge at
      `w - size/2` (a deliberate-looking visible gap from the bounding circle), vs. donut's own
      flush-to-the-edge `min/2 - size/2` centerline - confirmed by re-deriving both formulas by
      hand, not assumed from the shared `extend` chain. Also unguarded (no `size` vs. available-
      radius clamp, unlike donut's `if (brush.size >= min/2) brush.size = min/4`).
      **Three more confirmed-from-source quirks, all deliberately handled explicitly rather than
      silently**: (1) the background track's `drawDonut()` call sets no `stroke-linecap` (defaults
      to SVG's initial `"butt"`) - only the foreground value arc's attr sets `'stroke-linecap':
      brush.symbol`, so a `symbol="round"` gauge always has a flat-capped track with only its
      value arc rounded (Playwright-confirmed: background `<path>`'s `stroke-linecap` attribute is
      literally absent from the DOM, foreground's is present and equals `symbol`). (2)
      `getValue(data, 'title')` has no default argument (a real JS `undefined`, confirmed by
      reading `axis.getValue()`'s actual implementation - its own JSDoc's `[defaultValue='']` claim
      is misleading/wrong), so `if (title != '')` is `true` even when `title` is `undefined`,
      meaning an omitted title would upstream literally attempt to render the string `"undefined"`
      - this port intentionally does NOT reproduce that (renders the title only for a real, non-
      empty string), matching this port's established precedent of not reproducing a nonsensical-
      looking upstream gap. (3) `gaugeArrowColor` and `gaugeFontColor` exist in the original theme
      files but are dead/unreferenced by `fullgauge.js` (the value text's fill is `this.color
      (index)`, the series color, not `gaugeFontColor`; no needle/pointer exists for
      `gaugeArrowColor` to color) - both dropped from `useTheme.ts` per its own "tokens actually
      used" convention, confirmed via grep before adding any gauge tokens. **No `addEvent()` call
      anywhere in `fullgauge.js`** (checked all 138 lines) - a genuine, confirmed upstream absence,
      so `FullGaugeChart` has no per-element event forwarding (unlike every other previously-ported
      brush here) and no `defineEmits` at all.
      **Structural precedent chosen, one per component, for different reasons**: neither matches
      precedent (a) (extending `BarChart`/`DonutChart` with a new prop) - `bargauge.js` shares no
      code with `bar.js` at all, and while `fullgauge.js` *does* `extend: 'chart.brush.donut'`,
      adding gauge-arc rendering as a mode of `DonutChart.vue` would conflate two different visual
      grammars (N wedges around a circle vs. one value-vs-range progress ring) behind one prop,
      unlike e.g. `BarChart`'s `stacked`/`normalize`/`equalizer` props, which stay within the same
      "one rect per (row,target)" rendering primitive. Both became new standalone components
      instead, but for different structural reasons: `BarGaugeChart` is precedent (b)-*adjacent*
      but not really axis-based in the sense that precedent implies (`RateBarChart` still reads a
      real `axis.y.scale()` for row position; `BarGaugeChart` reads neither `axis.x` nor `axis.y`
      at all, only the padding-free `axis.c(0)` plot-area rect, reusing the exact same `{x, y,
      width, height}` shape `BarChart.vue`'s own `area` computed already produces) - genuinely a
      fourth shape in this port (linear, non-radial, non-axis-scale-based), not a clean fit for
      either established precedent, and documented as such in `BarGaugeChart.vue`'s header. Its
      list-of-rows/no-grid-needed model is unlike `pie.js`/`donut.js`; a `colorIndex` prop mirrors
      `this.color(index)`/`this.format(value, index)` for a caller placing several standalone
      instances. `FullGaugeChart` matches precedent (c) (Pie/Donut's non-axis trig approach)
      squarely - it directly reuses `donutSlicePath()` from `usePie.ts` (passing `fullgauge.js`'s
      own `outerRadius = w - size` as the `radius` argument, not donut's `min/2 - size/2`), the
      same "compute center/radius from the available chart area, draw with trig, no `axis.x`/
      `axis.y`" shape `PieChart`/`DonutChart` already established. Takes a single `data: DataRow`
      row (matching `PieChart`/`DonutChart`'s single-row convention, since `fullgauge.js`'s
      `axis.c(index)`-per-row geometry is architecturally identical to pie/donut's small-multiples
      model) - **no `FullGaugeGrid` wrapper built this iteration** (not needed to satisfy this
      item's scope; a future iteration could add one following `PieGrid`/`DonutGrid`'s exact
      pattern, tracked in README's "What's simplified").
      **New composable** `useGauge.ts` (pure logic only, not re-exported from `src/index.ts`,
      matching `useBubble.ts`/`useScatter.ts`'s precedent): `barGaugeFillWidth()`/`barGaugeRowY()`/
      `barGaugeRowInput()` for `BarGaugeChart`; `fullGaugeEndAngleLimit()`/`fullGaugeRate()`/
      `fullGaugeCurrentAngle()`/`fullGaugePaddingAngle()`/`fullGaugeRadii()`/`fullGaugeRowInput()`
      for `FullGaugeChart`. Reused (not duplicated) `scaleValue()` from `useBubble.ts` for
      `fullgauge.js`'s own `textScale = math.scaleValue(w, 40, 400, 1, 1.5)` font-scaling formula,
      and `radian`/`rotate` transitively via the existing `donutSlicePath()`. 20 new unit tests in
      `useGauge.spec.ts`, hand-traced (including the `min`-is-divisor-only quirk, the uncapped-
      overflow case, the upper-only currentAngle clamp, the two distinct `359.99999`/`359.9999`
      constants at their two separate call sites, and the deliberately-unguarded negative-
      `innerRadius` case). New theme tokens: `bargaugeBackgroundColor`/`bargaugeFontSize`/
      `bargaugeFontColor` (all 3 confirmed actually used) and `gaugeBackgroundColor`/
      `gaugeFontSize`/`gaugeFontWeight`/`gaugeTitleFontSize`/`gaugeTitleFontWeight`/
      `gaugeTitleFontColor`/`gaugePaddingAngle` (7 of the original theme's 9 gauge tokens - see the
      dead-token finding above), classic + dark values ported from `src/theme/classic.js`/`dark.js`.
      Demo: new `/bargauge` page (server resource usage %, the `min`-quirk demo, an uncapped-
      overflow demo, a custom-`format` demo, per-element event forwarding, dark theme) and new
      `/fullgauge` page (a literal `examples/fullgauge.html` repro - the only other concrete example
      in jui-chart's repo besides `bar.html`, confirmed via grep before assuming `bar.html` was the
      only one, correcting a since-updated stale claim in README's "What wasn't validated" section
      - plus a configured-180°-sub-range demo, a nonzero-`min` demo, and two deliberately-crafted
      edge-case demos: value clamped at/above max, driving the background arc's own sweep negative;
      value below min, driving it past 360deg and exercising `donutSlicePath`'s own internal
      `>=360` clamp on top of `fullGaugeEndAngleLimit`'s already-clamped input - two independent,
      stacked safety nets at two different layers, both exercised by one demo).
      **Playwright-verified with exact-coordinate proof, not just visual**: `/bargauge`'s primary
      chart's 4 rows (CPU/Memory/Disk/Network = 42/78/15/95 against a 300px-wide, zero-padding
      area) matched hand-computed fill widths exactly (126/234/45/285px) and background-track
      `x`/`width` (5/300 per row, the ported left-edge-offset quirk) via the rendered `<rect>`
      attributes directly; the `min`-quirk demo's two rows matched 75px/225px exactly; the
      overflow demo matched 450px (wider than its own 300px chart, confirmed clipped by the SVG
      viewBox, not an error); the `format` demo matched 261px width and `"87%"` text; per-element
      `click`/`mouseover` forwarding confirmed via a dispatched DOM event returning `dataIndex=0
      dataKey=<null> data={"title":"CPU","value":42}`, exactly matching the source's `addEvent(g,
      i, null)` shape. `/fullgauge`'s `examples/fullgauge.html`-repro chart matched every hand-
      computed value to full DOM floating-point precision: `w=150`, `outerRadius=130`,
      `textScale=1.1527777777777777`, arc start point `(20, 150.00000000000003)` (computed
      independently by hand-rotating `(0,-130)` by 270°, matching to 13 significant figures), value
      text `"140k"` at `translate(150, 137) scale(1.1527777777777777)`, title `"Overall Visits"` at
      `translate(150, 167)` (the configured `titleY=30` offset). The 180°-sub-range/nonzero-`min`/
      both edge-case demos' `outerRadius`/`textScale`/arc-start-point values all independently
      matched their own hand-computed numbers the same way; the "value at/above max" edge case's
      background arc rendered as a real, tiny (not crashing) degenerate arc near its start/end
      points (start/end ~6px apart in `y`, consistent with a computed `-4°` sweep); the "value
      below min" edge case's background arc rendered with `largeArc=1` and nearly-coincident
      start/end points, confirming `donutSlicePath`'s own internal `>=360 -> 359.9999` clamp
      engaged on the 467.999987° raw sweep, and its *foreground* arc's own arc-flag/sweep-sign
      interaction was cross-checked directly against `drawDonut()`'s own identical, equally
      unguarded `(endAngle > 180) ? 1 : 0` + hardcoded sweep-flag `1` formula - confirmed a byte-
      for-byte match to upstream's own (equally undefined-looking) behavior for this edge case, not
      a rendering bug introduced by this port. `stroke-linecap` presence/absence on background vs.
      foreground `<path>`s confirmed via direct attribute inspection across all 3 checked charts
      (`symbol="round"`/`"butt"`/`"round"`), matching the quirk above exactly. **Full regression
      sweep**: `npm run test` (187/187, +20 new), `npm run build:lib`, `npm run build` all clean;
      zero console/page errors across all 15 router pages (`/bar`, `/line`, `/area`, `/pie`,
      `/donut`, `/scatter`, `/bubble`, `/rangearea`, `/rangebar`, `/candlestick`, `/equalizer`,
      `/ratebar`, `/bargauge`, `/fullgauge`, `/axis-orient`) - every page's SVG(s) confirmed
      rendered (not empty), and every pre-existing page's screenshot/DOM shape unaffected (no
      regression, expected: this item touched no existing component file, only added new ones plus
      additive theme-token/README/index.ts entries). `src/index.ts` exports `BarGaugeChart`/
      `FullGaugeChart` (not `useGauge.ts`, matching `useBubble.ts`/`useScatter.ts`'s precedent of
      keeping pure-logic-only composables un-exported). README.md updated: component count (12->14),
      new `BarGaugeChart`/`FullGaugeChart` bullets in "Components", `useGauge` bullet in
      "Composables", a new "What's simplified" bullet (`FullGaugeChart`'s single-row scope, and why
      `BarGaugeChart` does NOT share that limitation), and a correction to "What wasn't validated
      against a real example" (it previously claimed `bar.html` was jui-chart's *only* concrete
      example - `fullgauge.html` is a second one, now noted, including the one thing it configures
      that this port intentionally doesn't reproduce: a chart-level `style: {gaugeFontSize: 30}`
      theme-token override, since no component in this port supports per-instance theme overrides).

**Recommended next Phase B item**: `pin.js` (69) or `selectbox.js` (72) - both small, unblocked,
and independent of everything just shipped; `pin.js` in particular looks like a good quick
follow-on if a shorter iteration is wanted. `heatmap.js` (84) / `heatmapscatter.js` (152) and
`pyramid.js` (165) are unblocked but likely need their own new value->color gradient scale
groundwork (doesn't exist in this port yet) - worth a source read first to size that up before
picking either. `arcequalizer.js` (168) remains better grouped with a future Pie/Donut-adjacent
iteration (pie-family/radial, not axis-based) than this axis-based cluster - and, per this item's
own finding, should NOT be assumed to share an `extend` chain with `equalizer.js`/`bargauge.js`/
`fullgauge.js` just because of the shared "-gauge"/"equalizer" naming pattern, until its own
`extend:` field is actually read.
- [x] `pin.js` (69) / `selectbox.js` (72) — PinChart / SelectBoxChart. **Source-confirmed, read
      both files in full before writing any code, per this item's own brief** (grouped only for
      being similarly small and both unblocked - treated as two fully independent items, per the
      brief's own instruction, since they share no code or behavior). Both confirmed `extend:
      "chart.brush.core"` **directly** - no relation to each other or to any previously-ported
      brush.

      **`pin.js`'s actual model, confirmed from `draw()`**: NOT one marker per data point, and NOT
      a map-style pin with a click popup - a single reference-line widget at ONE x-axis position
      (`brush.split`, default `0`): a full-plot-height vertical line, a small downward-pointing
      triangle "flag" near the top of that line, and an optional centered text label above the
      flag. The label's very EXISTENCE (not just its text) is gated by whether `brush.format` is a
      function (`showText = typeCheck("function", brush.format)`) - an omitted/non-function
      `format` hides the label entirely, not a togglable boolean. **No interaction and no
      per-element events** - `addEvent()` is never called anywhere in the 69 lines (checked the
      whole file), so `PinChart` has no `defineEmits` at all, matching `FullGaugeChart`'s identical
      finding for `fullgauge.js`.
      **The label value, confirmed from `self.format(self.axis.x.invert(d))` - not simply
      `brush.split` echoed back**: the source round-trips `d = axis.x(split)` through
      `axis.x.invert(d)` rather than reusing `split` directly, which matters for two reasons found
      by re-deriving both formulas by hand rather than assuming: (1) for an out-of-domain `split`,
      `d` is already domain-CLAMPED (this port's `range`-axis default `clamp: true`) before the
      invert, so the label shows the CLAMPED value, not the raw input - demoed explicitly
      (`split=15` against a `[0,10]` domain shows `"Day 10"`, not `"Day 15"`); (2) `axis.x` is
      generic - works whether the x-axis is `"block"` (an index into the category domain, since
      this port's `OrdinalScale` already treats "a numeric argument is a literal index" - see
      `useScale.ts`) or `"range"` (a raw numeric value) - and `invert()` behaves differently per
      type: for `"range"` it round-trips to the real (possibly clamped) value; for `"block"` it
      recovers the (floored) domain INDEX, not the category label (ported from `util.scale.ordinal
      ()`'s own `invert()` formula, added to this port's `OrdinalScale` this iteration, since it
      didn't exist before - unit-tested in `useScale.spec.ts` with hand-traced round-trip, clamp,
      and single-item-domain-NaN-quirk cases). `PinChart.vue` demos both axis types plus the raw
      undisguised index quirk (a `format` that returns the index directly, no lookup).
      **Structural precedent**: matches precedent (b) squarely (a standalone axis-based component +
      composable, extending `chart.brush.core` directly with genuine `axis.x`/`axis.area()` reads)
      - unlike `BarGaugeChart`'s precedent-(d) finding, `PinChart` reads real, generic `axis.x`
      scale values (block OR range), not just a padding-free plot-area rect. New pure `usePin.ts`
      (`pinGeometry()`/`pinTrianglePoints()`, hand-derived from the source's literal translate
      chain - see the file's own doc comment for the point-by-point algebra), unit-tested with two
      hand-traced full-geometry cases plus an isolated line-span check (5 tests). Not ported:
      `clip` (no brush in this port does per-brush SVG clipping - established, pre-existing gap).

      **`selectbox.js`'s actual model, confirmed from `drawBefore()`/`draw()`**: a row of cells
      spanning the full plot height, bucketed along the x-axis by a constant interval - each cell
      starts invisible (`fill-opacity`/`stroke-opacity: 0`) and only becomes visible via a native
      `elem.hover(...)` swap to `theme('selectBoxBackgroundOpacity')`/`theme('selectBoxBorderOpacity'
      )` on hover. **Confirmed DECLARATIVE, not interactive drag-to-select** - there is no
      mousedown/drag tracking anywhere in the 72 lines; bucket boundaries come entirely from
      config. **No z-ordering concern versus other brushes** - it's a single `chart.svg.group()`
      like any other brush layer (moot in this port anyway, since each Vue component is its own
      independent `<svg>`, not a layer composed into a shared canvas the way upstream's
      multi-brush chart builder works).
      **The real, substantial finding this item surfaced**: `drawBefore()` calls
      `this.axis.x.ticks("milliseconds", this.axis.get("x").interval)` - a method signature that
      ONLY exists on `util.scale.time` (jui-chart's date/time scale, backing its `chart.grid.date`/
      `chart.grid.dateblock` axis types) - `chart.grid.block`'s ordinal scale and `chart.grid.range`'s
      linear scale both lack a `.ticks(unit, interval)` method with this shape (confirmed by reading
      `grid/block.js`, `util/scale/ordinal.js`, `util/scale/linear.js` - none define it). This port
      has **no date/time axis type at all** (confirmed via grep across `types.ts`/`useAxis.ts`/
      `useScale.ts` before assuming otherwise) - a real, previously-undocumented gap. Building one
      properly would mean a new `AxisConfig` variant, new `useAxis.ts` resolution, and new
      `ChartBase.vue` tick/label rendering - a separately-scoped undertaking, not something to
      fold into "port a 72-line brush." **Deliberate scope decision, made after re-reading
      `util/scale/time.js`'s `ticks(type, interval)` and `util/time.js`'s `add()` closely rather
      than assuming the gap was unbridgeable**: the unit argument this call site ALWAYS passes is
      the literal string `"milliseconds"` (hardcoded, not read from any config), and adding
      milliseconds via `util/time.js`'s `add()` is plain numeric addition (`setMilliseconds(x +
      interval)`) with none of `"months"`/`"years"`'s real calendar-arithmetic complexity. So this
      specific call's actual behavior reduces to "step from the domain start by a constant ms
      `interval` until passing the domain end, pushing the final overshooting step unclamped" - a
      pure linear-stepping function with zero date-specific behavior. Ported that exact stepping
      math (`selectBoxTicks()` in new `useSelectBox.ts`) directly against this port's EXISTING
      `"range"`-type (linear numeric) x-axis - the caller supplies a numeric domain field (e.g.
      "days since start") and a new `interval` prop (default `1000`, matching `chart.grid.date`'s
      own `interval: 1000` default) - rather than building a whole new date-axis subsystem for one
      brush. Documented as a deliberate, load-bearing deviation in both `SelectBoxChart.vue`'s
      header comment and README.md's "What's simplified", not silently narrowed.
      **Also deliberately NOT reproduced**: the source reads `width = this.axis.x.rangeBand()`
      BEFORE calling `this.axis.x.ticks(...)` in the same `drawBefore()` - only valid upstream
      because the SHARED axis-grid scale object had already called `.ticks()` once during its own
      earlier grid-render pass (a mutable side-effect populating `_rangeBand`, confirmed by
      re-reading `util/scale/time.js`'s `ticks()` setting `_rangeBand` as a side effect). This port
      computes `width` directly from its own freshly-computed `ticks` array instead
      (`selectBoxCells()`'s `scaleX(ticks[1]) - scaleX(ticks[0])`) - the identical numeric result
      (pixel distance between the first two ticks) without depending on that call-order coupling
      with a shared external scale object, a robustness improvement not a behavior change.
      **The overshoot quirk, faithfully preserved, not "fixed"**: `draw()`'s loop
      (`for (i=0; i<ticks.length-1; i++)`) uses the SAME (first-pair) `width` for every cell, even
      the last one - so when `interval` doesn't evenly divide the domain span, the final cell's own
      tick-to-tick span differs from `interval` but still gets the same rendered width as every
      other cell, which can visibly overshoot past the axis's own domain-max pixel position (`clip:
      false` in `.setup()`, matching `pin.js` - no brush in this port clips). Demoed explicitly
      (`interval=3` over a `[0,10]` domain: ticks `0,3,6,9,12` - the last cell spans `9-12`, past
      the domain's configured max of `10`, but renders the same 158.4px width as the first three).
      **Events, confirmed from `draw()`'s loop**: `this.addEvent(r, { start: ticks[i], end:
      ticks[i+1] })` - the 2nd argument is an OBJECT (not a number/index), which `brush/core.js`'s
      `addEvent()` special-cases: `obj.data = dataIndex` (here, the `{start,end}` object itself),
      `dataIndex`/`dataKey` are never set (`undefined` upstream) - ported as `null` for both,
      matching `ChartElementEventPayload`'s documented "not tied to one row" meaning (a cell isn't
      a row of `props.data`, so there's no array index to forward). All 5 events wired
      (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), same shape as every other
      component's forwarding in this port. The native hover-opacity toggle is a SEPARATE,
      unconditional mechanism on the same rect (not gated by whether a listener is attached) -
      ported as an internal `hoverIndex` ref, wired alongside (not instead of) the `mouseover`/
      `mouseout` event forwarding, both firing from the same handler.
      **Structural precedent**: precedent (b) again (standalone axis-based component + composable),
      with the load-bearing caveat above (runs over this port's `"range"` axis, not a literal
      date/time axis - a deliberate substitution for real math, not a different structural shape).
      New pure `useSelectBox.ts` (`selectBoxTicks()`/`selectBoxCells()`), unit-tested with 9
      hand-traced cases (even-division, overshoot, nonzero domain-min offset, interval-exceeds-span,
      non-positive-interval guard, and the constant-width-across-cells property, including the
      overshoot case specifically).
      **Port-only defensive addition**: `selectBoxTicks()` returns `[]` for a non-positive
      `interval` (the source's `while (start < end)` loop would be infinite for `interval <= 0`,
      since `setMilliseconds(x + 0)` never advances `start` - a real, unreachable-in-practice
      upstream bug, guarded here rather than reproduced).

      **New theme tokens**: `pinFontColor`/`pinFontSize`/`pinBorderColor`/`pinBorderWidth` and
      `selectBoxBackgroundColor`/`selectBoxBackgroundOpacity`/`selectBoxBorderColor`/
      `selectBoxBorderOpacity` (all confirmed actually read from each source's `draw()`), classic +
      dark values ported from `src/theme/classic.js`/`dark.js` (pin tokens are identical between
      themes upstream; selectBox swaps `#666` for `#fff` in dark, opacities unchanged).

      Demo: new `/pin` page (`PinPage.vue`) - block-axis month data (`split=2`, format with a real
      month-label lookup, then the same chart with the raw-index quirk undisguised), range-axis
      day data (`split=7`, a raw value), the out-of-domain-clamp edge case (`split=15`), a
      no-`format` chart (label hidden), and a custom-`size`/dark-theme chart. New `/selectbox` page
      (`SelectBoxPage.vue`) - the primary `interval=3`-over-`[0,10]` overshoot demo, a per-element
      event-forwarding demo with a visible last-event log, a default-`interval`(`1000`)-over-
      `[0,5000]` evenly-dividing demo, and a dark-theme chart.

      **Playwright-verified with exact-coordinate proof, not just visual** (dev server + a script
      reading the rendered SVG DOM directly, this project's established methodology): `/pin`'s
      block-axis chart (6 months, `interval` implicit via `createOrdinalScale`, `split=2`) matched
      hand-computed geometry exactly - pin line/triangle centered at `x=268` (`unit=88`,
      `range[2]=92+2*88=268`), triangle top/bottom at `y=25`/`31` (`paddingY=5`, `size=6`), label
      `"Mar"` at `(268, 20)` (the real month, via the demo's own lookup `format`); the raw-index
      variant showed `"2"` at the identical position, confirming the undisguised-quirk demo;
      the range-axis chart (`split=7`, domain `[0,10]`, area width `528`) matched `x=417.6` exactly
      (`48 + 528*7/10`), label `"Day 7"`; the clamped chart (`split=15`) matched `x=576` (the
      domain-max pixel, NOT a `split=15` position) with label `"Day 10"` (the clamped value) -
      direct proof of the clamp-then-invert behavior; the no-`format` chart rendered zero
      `pinFontColor`-filled `<text>` elements (confirmed via DOM query, not just "no visible text"
      - proves the label is absent, not just empty-stringed). `/selectbox`'s primary chart's 4
      cells matched hand-computed `x`/`width` exactly (`x=[48, 206.4, 364.8, 523.2]`,
      `width=158.4` constant across all 4 including the overshooting last one); hovering cell index
      1 (dispatched `mouseover`) showed `fill-opacity=0.1`/`stroke-opacity=0.2` (the theme tokens)
      on ONLY that cell (the other 3 confirmed to stay at `0`/`0` simultaneously), and `mouseout`
      reverted it to `0`/`0`; the default-`interval` chart's 5 cells matched `x=[48, 153.6, 259.2,
      364.8, 470.4]`/`width=105.6` exactly (`528/5000*1000`); clicking the 3rd cell (index 2) of
      the event-forwarding demo logged `data={"start":6,"end":9}` with `dataIndex`/`dataKey` both
      empty (Vue's `null` interpolation) - exact match to the hand-computed bucket boundaries.
      **Full regression sweep**: `npm run test` (202/202 passing, +21 new: 3 `OrdinalScale.invert`
      cases in `useScale.spec.ts`, 5 `pinGeometry`/`pinTrianglePoints` cases in `usePin.spec.ts`, 9
      `selectBoxTicks`/`selectBoxCells` cases in `useSelectBox.spec.ts`, and one corrected during
      this iteration's own first test run - see below), `npm run build:lib`, `npm run build` all
      clean with no type errors. Zero console/page errors across all 17 router pages (`/bar`,
      `/line`, `/area`, `/pie`, `/donut`, `/scatter`, `/bubble`, `/rangearea`, `/rangebar`,
      `/candlestick`, `/equalizer`, `/ratebar`, `/bargauge`, `/fullgauge`, `/pin`, `/selectbox`,
      `/axis-orient`), no empty/near-empty SVGs on any page (checked programmatically, not just by
      screenshot).
      **Self-correction caught during this iteration's own first test run** (worth noting per this
      port's convention of recording how a mistake was caught, not just that it was fixed): one
      `selectBoxTicks` test's hand-traced expectation was itself wrong (`selectBoxTicks(0, 100,
      500)` was asserted to be `[500]`, but the actual algorithm - matching the source's own
      `while(start<end){push(start); ...}` loop shape - pushes the domain-min `0` FIRST, then the
      single overshooting step `500`, i.e. `[0, 500]`) - caught immediately by the failing test
      itself (not by a later Playwright pass), fixed by correcting the test's own expectation
      against a careful re-trace of the loop, not by changing the implementation (which was
      correct).
      Exported `PinChart`/`SelectBoxChart` from `src/index.ts` (not `usePin.ts`/`useSelectBox.ts`,
      matching `useBubble.ts`/`useScatter.ts`/`useGauge.ts`'s established "pure-logic-only
      composables stay un-exported" precedent). README.md updated: new `PinChart`/`SelectBoxChart`
      bullets in "Components", `usePin`/`useSelectBox` bullets in "Composables", `useScale`'s own
      bullet updated to mention the new `OrdinalScale.invert()`, a new "What's simplified" bullet
      on `SelectBoxChart`'s no-genuine-date-axis scope decision, and a "What wasn't validated"
      addition noting neither brush has a real example anywhere in `jui-chart`'s `examples/`
      directory (confirmed via grep, including a targeted check of "guideline"/"zoomselect"-named
      examples whose names suggested a possible match but didn't pan out).

- [x] `heatmap.js` (84) / `heatmapscatter.js` (152) — HeatmapChart / HeatmapScatterChart.
      **Source-confirmed, read both files in full before writing any code, per this item's own
      brief and the prior iteration's flag that new color-gradient infrastructure might be needed**.
      Both confirmed `extend: "chart.brush.core"` **directly** - no relation to each other despite
      the shared file-naming pattern, matching this port's now-dominant "looks related, isn't"
      finding (same as `pin.js`/`selectbox.js` the iteration before).

      **The color-mapping model, confirmed from source - the headline finding this item set out to
      check**: re-read `heatmap.js`'s `this.color(i, null)` and `heatmapscatter.js`'s
      `this.color(dataIndex, targetIndex)` against `brush/core.js`'s `color(key1, key2)` and
      `base/builder.js`'s `chart.color(key, colors)` line by line. **There is no gradient/
      interpolation primitive anywhere in the engine** (grepped the whole `juijs-graph` source for
      "interpolate"/"gradient"/"lerp"/"rgb(" - none exist) - both brushes use the exact same flat
      per-index-or-function palette lookup every other brush in this port already uses. Also
      confirmed from `src/theme/classic.js`/`dark.js`: no min/max-color pair, no palette array, only
      solid `heatmap*`/`heatmapscatter*` background/border/font tokens (8 + 2 respectively, all
      confirmed actually read from each `draw()`, ported 1:1 into `useTheme.ts`). Concretely: with
      no explicit `colors` config, `heatmap.js`'s own default cell color resolves to a genuinely
      broken `undefined` SVG fill (traced the exact branch: `this.color(i, null)` -> `colorIndex =
      null` -> `chart.color(null, null)` -> `nextColor()` -> `c[null]` -> `undefined`) - only usable
      via a caller-supplied `colors` FUNCTION, confirmed from the one real sibling example
      (`examples/heatmapscatter.html`'s `colors: function(d) { if (d.level==0) return "#ff0000";
      ... }`, a plain per-row threshold function, not interpolation). This port's established
      `colors?: string[]` convention (every other component already dropped the function form - see
      `ScatterChart.vue`'s `pickColor()`) is kept for both new components too, with the source's own
      `"none"` sentinel preserved (`heatmap.js`'s `if (color=="none") color=theme
      ("heatmapBackgroundColor")`) and a missing array entry falling back to the theme palette cycle
      (a deliberate improvement over the source's own broken zero-config default, documented as a
      deviation in both files' header comments). A genuinely CONTINUOUS gradient (this item's own
      "day-of-week x hour-of-day activity heatmap" demo) needed real, new infrastructure since none
      exists upstream - built as `useColorScale.ts` (`interpolateColor()`/`createColorScale()`, hex
      RGB linear interpolation over 2+ stops), a proper reusable composable (exported from
      `src/index.ts`, unlike the component-specific `useHeatmap.ts`/`useHeatmapScatter.ts`) per this
      item's own brief, since color interpolation is generically useful - `HeatmapPage.vue`'s demo
      precomputes a `colors[]` array from it and feeds it into `HeatmapChart`'s existing,
      un-special-cased plain-array prop, keeping the component itself gradient-agnostic. Unit-tested
      with 13 hand-traced cases in `useColorScale.spec.ts` (0%, 50%, 100%, and non-round percentages
      for both a 2-stop and a 3-stop scale, plus clamping/degenerate-domain/edge cases) - **and**
      re-verified end-to-end against the real rendered DOM (not just the isolated unit tests): hand-
      computed the exact interpolated hex for 3 real demo cells (values 5/8/42 against domain
      `[0,100]`, stops `#ebedf0`->`#216e39`) and confirmed the rendered `fill` attribute matched all
      3 exactly (`#e1e7e7`/`#dbe3e1`/`#96b8a3`).

      **`heatmap.js`'s data/grid model, confirmed from `draw()`'s loop**: one cell per DATA ROW, NOT
      per (row, target) pair - `heatmap.js` never reads `this.brush.target` anywhere in the 84
      lines. Both axes' cell position comes from `axis.x(i)`/`axis.y(i)`, which - re-reading
      `grid/block.js`'s `wrapper(scale, key)` closely - only makes sense as "one cell per row,
      positioned on a shared diagonal" UNLESS the x/y axis configs have a `key` option set, in which
      case `new_scale(i)` resolves to `old_scale(axis.data[i][key])`: a FIELD lookup on row `i`,
      then a value-based scale call - i.e. `xField`/`yField` config, not literal index positioning
      (the naive reading that seemed to make heatmap.js draw everything on a diagonal was wrong -
      catching this required re-reading `grid/block.js`'s wrapper, not just `heatmap.js` itself).
      This port's `OrdinalScale` (`useScale.ts`) already resolves a *string* argument via
      `domain.indexOf(value)` (confirmed unchanged, needed zero edits) - so `useHeatmap.ts`'s
      `heatmapCells()` just calls that existing primitive directly with `row[xField]`/`row[yField]`
      instead of replicating `grid/block.js`'s generic per-brush indirection layer, which has no
      purpose once the field lookup happens at the component level instead. **Faithfully-preserved
      upstream limitation, documented not silently worked around**: since this port's `OrdinalScale`
      (like the raw `util.scale.ordinal.js` it's ported from) treats a *numeric* argument as a
      literal range INDEX, a NUMERIC `xField`/`yField` value only resolves correctly when the axis's
      `domain` array is exactly `[0,1,...,N-1]` in that order; a STRING field value always works via
      `domain.indexOf()` regardless of domain order - the demo sidesteps this entirely by using
      string category labels for both axes. Cell size is `axis.x.rangeBand() - borderWidth` x
      `axis.y.rangeBand() - borderWidth` (both constant across the whole grid). Events, confirmed
      from `this.addEvent(group, i, null)`: per-CELL, `dataIndex` REAL (the row index), `dataKey`
      ALWAYS `null`, `data` = the whole row - no new payload type needed. Hover, confirmed from
      `group.hover(...)`: swaps only `fill-opacity` between `heatmapBackgroundOpacity`/
      `heatmapHoverBackgroundOpacity` - no tooltip/balloon of any kind exists upstream, so none was
      added.

      **`heatmapscatter.js`'s data/color model, confirmed from `draw()`/`drawScatter()`/
      `createScatter()`/`getTableData()` - genuinely NOT a scatter chart with heatmap-style point
      coloring**: it's a coarse 2D DENSITY grid over ordinary `(row, target)` scatter points -
      every point is positioned EXACTLY like `ScatterChart`'s own points (`axis.x(i)` row-index-
      driven, `axis.y(value)` value-driven - reused this port's existing, unmodified `useSeries()`
      directly, zero new coordinate math needed for point positioning), then BINNED into one of
      `xDist x yDist` buckets; one `<rect>` is drawn per OCCUPIED bucket, not per point. Color,
      confirmed from `this.color(dataIndex, targetIndex)`: since the 2nd arg here is a REAL target
      index (not `null` like `heatmap.js`'s own call), this takes the SAME per-TARGET branch every
      other multi-target component already uses - so `colors?: string[]` here is target-indexed,
      matching `ScatterChart.vue`'s `pickColor()` precedent exactly (a genuine, confirmed difference
      from `heatmap.js`'s own per-ROW indexing - the two brushes' color models are NOT the same
      shape despite both being "heatmap-flavored"). **A real, faithfully-preserved quirk, confirmed
      from `createScatter()`**: `tableObj.color = color` is reassigned on EVERY point landing in a
      bucket, but the rendered `<rect>`'s `fill` (and the `addEvent`-registered `dataIndex`/
      `dataKey`/`data`) is only ever set once, when the bucket's element is FIRST created (`if
      (tableObj.element == null)`) - later points update `tableObj.color`/push onto `tableObj.data`
      but neither is ever read by anything else in the 152-line file (confirmed: `tableObj.data`'s
      accumulated array is returned by `createScatter()` but never consulted beyond the `obj.draw`
      flag) - so a bucket's rendered color and forwarded event payload are always its FIRST point,
      reproduced exactly (tracks only the first point per bucket, doesn't bother replicating the
      dead accumulation).

      **Axis substitution, matching `selectbox.js`'s already-established precedent for the same
      gap**: the real example (`examples/heatmapscatter.html`) uses a `type: "date"` x-axis; this
      port has no date/time axis type. Re-derived from source: `drawScatter()`'s point x-position
      (`axis.x(i)`, row-index-driven) needs a `"block"`-type axis (matching this port's existing
      index convention), while `drawBefore()`'s grid-boundary math treats the same axis as a genuine
      continuous VALUE domain (`axis.x.max()-axis.x.min()`) - upstream reconciles this because a
      date-type axis's own wrapper supports both an index-shortcut AND real date-value lookups on
      the SAME scale object, a dual nature this port's plain block `OrdinalScale` doesn't have. Made
      a clean, explicit adaptation instead of forcing that ambiguity through: x-axis stays
      `"block"`-type (so `axis.x(i)` positions correctly), and bucketing runs over the axis's own
      TICK-INDEX space - `xInterval` means "ticks per bucket column" here, not "domain units per
      bucket" like the source's literal (millisecond) meaning. The y-axis needed no adaptation
      (always `"range"` in both source and port). `xInterval`/`yInterval` are REQUIRED props with no
      default, deliberately diverging from the source's own `.setup()` default of `0` (which
      produces `Infinity`/`NaN` - the source's own real example always overrides both explicitly).

      **A real geometry bug found and fixed during this item's own Playwright verification pass -
      not a quirk to preserve**: a first implementation used `axisX.value.scale(xVal)` directly as
      each bucket's left edge, copying the source's `xPos = axis.x(xVal)` literally. That's only
      correct for a continuous scale (no "tick" concept); this port's substituted block `OrdinalScale`
      returns a tick's CENTER, not a left edge (this port's own established `rangePoints()`
      semantics, same as every other block-axis consumer) - so every bucket rendered shifted right
      by exactly half a tick-band width, and the last column overshot the plot area's right edge by
      that same amount (caught immediately: a Playwright bounds check flagged 4 buckets rendering
      past `area.x2`). Fixed by subtracting `axisX.value.band / 2` from the scaled position -
      confirmed by hand (tick spacing `528/30=17.6px`, half-band `8.8px`, matching the exact
      overshoot) and re-verified: all 24 rendered buckets landed with byte-exact hand-computed
      `x`/`y`/`width`/`height` (e.g. first bucket `x=48` exactly `= area.x`, column-to-column edges
      exactly contiguous, no bucket outside `[area.x, area.x2] x [area.y, area.y2]`).

      **New theme tokens** (`useTheme.ts`): `heatmapBackgroundColor`/`heatmapBackgroundOpacity`/
      `heatmapHoverBackgroundOpacity`/`heatmapBorderColor`/`heatmapBorderWidth`/
      `heatmapBorderOpacity`/`heatmapFontSize`/`heatmapFontColor` and `heatmapscatterBorderColor`/
      `heatmapscatterBorderWidth`, classic + dark values ported 1:1 from `src/theme/classic.js`/
      `dark.js`. **Not ported**: `heatmapscatterActiveBackgroundColor` (present in both theme files
      but confirmed unused anywhere in `heatmapscatter.js`'s 152 lines - grepped the whole file for
      `theme(` calls; no `active`/hover-recolor concept exists in this brush at all) - dropped per
      `useTheme.ts`'s own "trimmed to tokens actually used" convention (matching `fullgauge.js`'s/
      `bargauge.js`'s own precedent for the same kind of unused token).

      **Structural precedent**: precedent (b) again (standalone axis-based components + composables,
      `extend`ing `chart.brush.core` directly, genuine `axis.x`/`axis.y`/`axis.area()` reads) - new
      `useHeatmap.ts` (`heatmapCells()`, unit-tested with 4 hand-traced cases including a 3x2-grid
      position/size trace, `format` vs `textField` precedence, and an out-of-domain-field skip) and
      `useHeatmapScatter.ts` (`heatmapScatterGrid()`/`heatmapScatterBucketIndex()`, unit-tested with
      9 hand-traced cases including even/uneven division, offset `yMin`, round-half-up-at-.5, and
      negative/overflow clamping) - both un-exported from `src/index.ts` (matching `usePin.ts`/
      `useSelectBox.ts`'s "pure component-logic composables stay un-exported" precedent);
      `useColorScale.ts` IS exported, being genuinely reusable rather than component-specific (see
      above).

      Demo: new `/heatmap` page (`HeatmapPage.vue`) - a deterministic (hand-traceable, not random)
      7-day x 8-time-bucket activity heatmap with the `useColorScale` gradient, a 3x3 `colors`-
      array-fallback demo (explicit hex / `"none"` sentinel / omitted-entry palette-cycle, one
      behavior per shift column), and a per-element-event-forwarding + dark-theme chart with a
      visible last-event log. New `/heatmapscatter` page (`HeatmapScatterPage.vue`) - a
      transaction-delay-style density grid (30 one-minute x-axis ticks grouped 5-per-column, 2
      targets, deterministic data) plus an event-forwarding + dark-theme variant.

      **Playwright-verified with exact-coordinate AND exact-color proof, not just visual** (dev
      server + a script reading the rendered SVG DOM directly, this project's established
      methodology): `/heatmap`'s activity grid - 56 cells confirmed; first 3 cells' geometry matched
      hand-computed values exactly (`x=48.25`/`y=20.25`/`width=74.929`/`height=43` for cell 0, etc.,
      derived from `createOrdinalScale`'s own `unit`/`range[0]` formulas) and all 3 cells' rendered
      `fill` matched hand-computed gradient hex exactly (see color-mapping section above); the
      `colors`-fallback demo's 9 cells matched expected fill exactly per column (AM=`#4caf50`
      explicit, PM=`#fff` = `heatmapBackgroundColor` via the `"none"` sentinel, Night=theme palette
      entries `#FFC000`/`#1DA8A0`/`#0298D5` at indices 2/5/8, confirmed against `classicColors[2/5/
      8]`); dispatching `mouseover`/`click` on cell index 5 of the dark-theme chart logged
      `dataIndex=5 dataKey=null data={"day":"Mon","hour":"15","value":70}` - exact match to the
      demo's own data (`activityMatrix[0][5] = 70`); dark theme's rendered `stroke` confirmed
      `#fff` (`heatmapBorderColor` dark override) while gradient `fill` stayed unaffected by theme
      (as expected, `colors[]` is theme-independent). `/heatmapscatter`'s density grid - 24 occupied
      buckets out of 60 possible `(row,target)` points (confirming the dedup/first-wins binning
      genuinely collapses multiple points per bucket, not a coincidence of the demo data); zero
      buckets outside plot-area bounds after the half-band-width geometry fix (4 were out-of-bounds
      before it - see that section above); one bucket's geometry hand-verified exactly (`x=48`,
      `y=228.8`, matching `axisY.scale(200)-ySize = 368+(20-368)*0.2-69.6 = 228.8` by hand); dark-
      theme event forwarding confirmed `dataIndex=0 dataKey="delayA"
      data={"time":"09:00","delayA":100,"delayB":900}` on hovering the first bucket. **Full
      regression sweep**: re-ran every one of the 19 router pages (`/bar` through `/axis-orient`,
      including the 2 new ones) through the same Playwright pass - zero console/page errors, zero
      empty SVGs on any page, confirming the new components and theme-token additions didn't disturb
      anything pre-existing. `npm run test` (228/228 passing, +26 new: 13 `useColorScale` cases, 4
      `heatmapCells` cases, 9 `heatmapScatterGrid`/`heatmapScatterBucketIndex` cases), `npm run
      build:lib`, `npm run build` all clean with no type errors.

      Exported `HeatmapChart`/`HeatmapScatterChart` from `src/index.ts`, plus `useColorScale.ts`
      (see above). README.md updated: new `HeatmapChart`/`HeatmapScatterChart` bullets in
      "Components", `useHeatmap`/`useHeatmapScatter`/`useColorScale` bullets in "Composables", a new
      "What's simplified" bullet on the axis-substitution/required-props/no-gradient-primitive
      findings, a "What wasn't validated" update noting `examples/heatmapscatter.html` IS a real
      example (used to validate `xInterval`/`yInterval`/color-function usage) while `heatmap.js` has
      none, and the top-of-file chart-type count/list updated (18 types, was stale at 14 - hadn't
      been updated since before `pin.js`/`selectbox.js` either).

- [x] `pyramid.js` (165) — PyramidChart. **Source-confirmed**: `extend: "chart.brush.core"`
      directly - unrelated to `bar.js`/`fullstackbar.js`/any other brush despite plausible visual
      association with "bar"/"funnel" charts (this port's now-recurring lesson, re-confirmed once
      again - see `PinChart.vue`'s/`BarGaugeChart.vue`'s/`HeatmapChart.vue`'s own header comments
      for the most recent instances before this one).

      **The data model, like `PieChart`/`DonutChart`**: a single `data` ROW, one segment per
      `target` key (`obj = axis.data.length > 0 ? axis.data[0] : {}` - only the FIRST data row is
      ever read). **The actual visual model, confirmed from `draw()` - genuinely NOT what "funnel
      chart" usually implies**: this is not a set of independently-sized rows (a typical funnel
      computes each row's own width as `value / max`) - the whole shape is a single solid triangle
      (apex at top-center, full-width base at the bottom, by default) inscribed in the plot area,
      and each target's segment is a trapezoid SLICE of that one triangle, sized by `rate = value /
      total` (share of the row's OWN total, not `value / max`) and sorted value-DESCENDING before
      drawing (largest = widest = the base; smallest = narrowest, nearest the apex). Because every
      segment's rate is a share of one fixed total distance (the triangle's apex-to-base-corner
      hypotenuse) and rates sum to 1, segments are geometrically CONTIGUOUS slices of one continuous
      triangle (each one's wide edge is exactly the previous segment's narrow edge) and the LAST
      segment's narrow edge always lands exactly on the apex point - verified exactly, not just
      visually, with a hand-traced 45-degree case in `usePyramid.spec.ts` (rates `[0.5,0.3,0.2]`
      converge the third segment's `sx`/`ex` to precisely `halfWidth`, `y=0`). `reverse` (default
      `false`) flips which end is the wide base: `false` = literal upright pyramid (apex top,
      largest segment at the bottom); `true` = inverted funnel (apex bottom, largest segment at the
      top) - a real geometry flip (`dy` starts at `0` instead of `height`, and the per-segment `y`
      update adds instead of subtracts), not a CSS-transform trick, ported and unit-tested for both
      orientations.

      **Structural precedent**: a genuinely new blend, not a clean fit for any prior single
      precedent - confirmed by checking both candidates before writing code: (1) like `BarGaugeChart`
      (precedent (d)), NOT axis-based at all - the only positioning input is `this.axis.area()` (the
      plot-area rect), consumed with the brush's own trig, never a shared `axis.x`/`axis.y`
      `.scale()` call, so `PyramidChart.vue` is a standalone `<svg>` root (no `ChartBase`), same
      `titleReserve`/`area` port-only convention as `BarGaugeChart.vue`; (2) like `PieChart`/
      `DonutChart` (precedent (a)), the data model is a single row's `target` keys turned into
      colored segments (`this.color(i)`, sorted-draw-order index, not the target's declared
      position - a real, easy-to-miss subtlety confirmed by re-reading the loop order), with
      per-element event forwarding using the same `dataIndex: null` deviation `PieChart.vue`
      established (upstream's literal always-`0` `dataIndex` carries no real information once
      `data` is already a single row, not an array). Neither precedent alone covers "rect-positioned
      + single-row-multi-target japanese-precedent", so `PyramidChart.vue` combines both.

      **New pure geometry module** (`usePyramid.ts`, unit-tested with 11 hand-traced cases in
      `usePyramid.spec.ts`): `pyramidSegments()` (value/total rate + value-descending sort, ported
      from `getCalculatedData()` - reimplemented iterating `target` directly rather than the
      source's `for (key in obj)` row-key iteration, confirmed behaviorally equivalent since the
      final list is sorted anyway and iteration order only ever affected the row's OWN key
      enumeration order upstream, moot here since JS `Array.sort` is stable; **deviation**: `rate`
      is `0` instead of `NaN` when `total` is `0`, matching `usePieSlices`'s own established
      precedent for the identical edge case), `pyramidTrapezoids()` (the trapezoid-vertex/divider-
      line trig, hand-verified exactly per the 45-degree case above - `cos(-startRad)` and
      `cos(startRad)` are ported as one shared `cosR` since cosine is even, a numerically-identical
      simplification, not a behavior change), and `pyramidLabelPlacements()`/`pyramidLabelY()` (the
      leader-line label-dodge math, a sequential walk over draw-order label anchors - same shape as
      `usePie.ts`'s `pieOutsideLabelDeclutter`/`pieInsideLabelDeclutter`). **Literal upstream quirk,
      preserved not "fixed"** (matching this port's established precedent for odd-but-intentional-
      looking source formulas, e.g. `useGauge.ts`'s `barGaugeFillWidth` min-divisor note):
      `createText()`'s dodge formula is `y = cy + (cy - dist/2)` when a previous label lands within
      `pyramidTextLineSize`px, i.e. `2*cy - dist/2` - NOT the more "obviously intended"
      `cy - (lineSize - dist)`-style nudge a fresh implementation might guess at; ported exactly and
      pinned with a hand-traced test (`cy=10, dist=25, lineSize=30 -> 7.5`). Also preserves the
      source's literal initial condition (the dodge state starts at literal `0`, not "no previous
      label" - matching `pieOutsideLabelDeclutter`'s own preserved `preAngle = 0` quirk).

      **New theme tokens** (`useTheme.ts`): `pyramidLineColor`/`pyramidLineWidth`/
      `pyramidTextLineColor`/`pyramidTextLineWidth`/`pyramidTextLineSize`/`pyramidTextFontSize`/
      `pyramidTextFontColor`, all 7 ported 1:1 from `src/theme/classic.js`/`dark.js` (dark only
      overrides the 3 color tokens, matching the source theme files exactly - `pyramidLineWidth`/
      `pyramidTextLineWidth`/`pyramidTextLineSize`/`pyramidTextFontSize` are numerically identical
      in both). No fill-color token - segment fill is `this.color(i)`, the palette cycle, same as
      `PieChart`/`BarGaugeChart`.

      No `<g transform>` wrapper anywhere in `PyramidChart.vue` - all geometry functions work in
      LOCAL (untranslated) coordinates and the component adds `area.x`/`area.y` exactly once, when
      building final render attributes, deliberately avoiding the double-offset bug class this port
      has repeatedly found in axis-based components (see PORT_STATUS.md's Phase A item 10/the
      `BarChart`/`Line`/`Area`/`Scatter` write-ups) - not applicable here in the same form since
      `Pyramid` was never axis-scale-based, but the general "add the offset exactly once, not via a
      wrapping `<g transform>` over already-positioned coordinates" discipline was applied
      proactively.

      Demo: new `/pyramid` page (`PyramidPage.vue`) - a sales/conversion funnel (visitors -> signups
      -> trials -> purchases, total 1600 for clean fractions: 62.5%/25%/9.375%/3.125%) shown plain,
      with `showText` value labels, with a custom `format(key,value,rate)` percentage formatter,
      `reverse`, a non-45-degree (220x320) shape to confirm the geometry generalizes beyond the
      unit-test's clean-angle case, per-element event forwarding with a visible last-event log, and
      dark theme with a title.

      **Playwright-verified with exact-coordinate proof, not just visual** (dev server + a script
      that independently reimplements `pyramidTrapezoids()`/`pyramidLabelPlacements()` in plain JS
      from the source derivation - not by importing this port's own compiled code - then diffs
      against the rendered DOM, this project's established methodology): the basic funnel chart's
      all 4 `<polygon points>` matched the hand-derived trig **string-byte-identical** (zero
      floating-point drift on this 360x280 case); the `reverse` chart's all 4 polygons also matched
      byte-identical, and its first (largest/widest) segment's points were confirmed to start/end at
      `y=0` (the top), proving the orientation flip renders correctly, not just computes correctly;
      3 divider `<line>`s confirmed present (n-1 for 4 segments) with no separate group/transform;
      all 4 `showText` labels' rendered `<text>` `x`/`y`/`dx`/`dy` attributes AND text content
      matched the independently-computed leader-line/dodge math exactly (including the apex-adjacent
      4th label, which the independent reference confirms was NOT dodge-triggered for this specific
      dataset - `dist` fell outside `(0, lineSize)` at that point, a genuine finding about this
      dataset's shape, not an untested code path, since `pyramidLabelY`'s dodge branch itself IS
      covered by `usePyramid.spec.ts`'s dedicated hand-traced unit test). The dark-theme+title
      chart's polygon points matched the same independent reference (max floating-point discrepancy
      `2.8e-14`, i.e. representation noise, not a real offset) after accounting for `titleReserve`
      (dark `titleFontSize=14` -> `area.y=28`), confirming the title-reserve offset math is correct
      for this component too; its divider/leader-line `<line>` `stroke` colors confirmed alternating
      `#464646`/`#B2A6A6` (dark `pyramidLineColor`/`pyramidTextLineColor`), and both the title and
      all 4 value labels' text content rendered correctly. Event forwarding: hovering/clicking the
      2nd rendered segment (`signups`, sorted-order index 1) logged `dataIndex=<empty>
      dataKey="signups" data={"visitors":1000,"signups":400,"trials":150,"purchases":50}` - `null`
      `dataIndex` matching the documented `PieChart`-style deviation, `data` the whole row. Zero
      out-of-viewBox polygon points across all 7 demo charts on the page (no clipping). Zero
      console/page errors. `npm run test` (239/239 passing, +11 new `usePyramid` cases), `npm run
      build:lib`, `npm run build` all clean with no type errors.

      Exported `PyramidChart` from `src/index.ts`, plus `usePyramid.ts`'s public functions
      (`pyramidSegments`/`pyramidTrapezoids`/`pyramidLabelPlacements`/`pyramidLabelY`, matching this
      port's convention of exporting reusable pure-logic composables). README.md updated: new
      `PyramidChart` bullet in "Components" and a `usePyramid` bullet in "Composables".

- [x] `arcequalizer.js` (168) — ArcEqualizerChart. **This was the final Phase B item - Phase B is
      now fully complete (15/15).**

      **Source read, in full, before writing any code**: `extend: "chart.brush.core"` **directly**
      - confirmed, per this file's own long-tracked warning, it does NOT extend `chart.brush.pie`/
      `chart.brush.donut` (it hand-rolls its own private `polarToCartesian()`/`describeArc()`, not
      a call into either), nor `equalizer.js`/`bargauge.js`/`fullgauge.js` (all of which
      independently extend `core` too, per this phase's now-thoroughly-established lesson - see the
      Phase B completion summary above). PORT_STATUS.md's own earlier placeholder note ("pie-family
      (not axis-based) — group with pie/donut's trig approach") was directionally right about "not
      axis-based" but wrong to imply a shared `extend` chain - flagged in this file's own past
      entries as something to verify, not assume, and now verified false.

      **The actual visual model** (confirmed from `drawBefore()`/`draw()`/`calculateData()`, a
      genuine hybrid, not a clean fit for either its "pie-family" placeholder grouping or a literal
      port of `equalizer.js`): unlike `PieChart`/`DonutChart`/`PyramidChart` (always exactly ONE
      `data` row), `arcequalizer` iterates potentially MANY rows (`this.listData().length`) - one
      full angular WEDGE per row, each spanning an EQUAL `360 / rowCount` degrees (a row-COUNT
      split, unlike `PieChart`'s value-weighted slice angles). Within each row's wedge, every
      `target` key stacks radially outward from a fixed inner-hole radius (`textRadius`, default
      `50`, left empty for the center total-value label) to the outer bounding radius, in small
      fixed-thickness arc-band "blocks" - the direct radial/angular analog of `equalizer.js`'s
      straight-line pixel blocks, except: (1) each block is a small **annular-sector** ("thick arc
      segment"/curved trapezoid) shape, not a straight rectangle - the same two-arcs-plus-two-
      radial-lines construction as a donut ring slice (`donutSlicePath`), just closed into a solid
      filled band instead of a single stroked centerline; (2) the per-target block COUNT is a flat
      `Math.ceil(stackCount * (value / maxValue))` ratio (like `fullGaugeRate`), NOT
      `equalizer.js`'s zero-baseline pixel-fill-and-clip math, and NOT `equalizerbar.js`/
      `equalizercolumn.js`'s remaining-capacity-with-leftover-gap math either - there is no
      leftover/partial-block case here at all; (3) blocks are stacked and colored BY TARGET
      (`this.color(j)`, one solid color per target, like `equalizerbar`/`equalizercolumn`'s
      per-segment stacking), not color-banded by block index like `equalizer.js`'s own zone-
      coloring; (4) there is no explicit gap between adjacent blocks (radially or angularly) -
      visual separation comes only from each block's own stroke border, unlike `equalizer.js`'s
      hardcoded 1.5px pixel gap.

      **Composable reuse decision**: built genuinely new radial-block logic in new
      `useArcEqualizer.ts`, rather than reusing `useSeries.ts`'s `equalizerBlocks`/
      `equalizerStackedBlocks` (pixel/linear formulas, wrong shape and wrong count-derivation
      entirely for this brush) or `usePie.ts`'s `usePieSlices` (value-weighted angles, a
      fundamentally different formula from this brush's row-COUNT-weighted wedge angles). It DOES
      reuse `usePie.ts`'s underlying polar-coordinate primitives (`radian`/`rotate` from
      `mathUtil.ts`) for the actual point math: confirmed algebraically that the source's own
      `polarToCartesian(cx,cy,r,deg)` (a `(deg-90)`-phase-shifted `cos`/`sin` pair) produces the
      exact same point as `{x: cx + rotate(0,-r,radian(deg)).x, y: cy + rotate(0,-r,radian(deg)).y}`
      - the same "0deg = 12 o'clock, clockwise" convention `usePieSlices`/`pieSlicePath`/
      `donutSlicePath` already use, just hand-rolled independently in the original source (no
      `extend` chain to share it through). `useArcEqualizer.ts` exports: `arcEqualizerLayout`
      (center/radius/block-thickness from width/height/`textRadius`/`stackCount`, mirroring
      `drawBefore()`'s own non-square-area centering math), `arcEqualizerStackAngle`
      (`360/(rowCount||1)`), `arcEqualizerMaxValue` (plain number or per-row callback resolution,
      matching the source's own `maxValue` option shape), `arcEqualizerRows` (per-target block
      counts, plus the empty-`data` synthetic-placeholder-row fallback - see below),
      `arcEqualizerBlockPath` (one block's `d` path), `arcEqualizerWedgeBlocks` (stacks a row's
      per-target counts radially, continuing each target from where the previous one's running
      offset left off - the polar analog of `equalizerStackedBlocks`'s row-shared running position,
      notably simpler here since there's no remainder/leftover case).

      **No-data placeholder**: `calculateData()`'s `stackData.length == 0` branch fires only when
      `data` is an empty array - synthesizes a single full-circle wedge (target `0` gets ALL
      `stackCount` blocks, every other target `0`) rendered entirely in `arcEqualizerBackgroundColor`
      regardless of target (`draw()`'s separate `dataCount == 0 ? backgroundColor : this.color(j)`
      fill guard) - analogous to `pieNoDataBackgroundColor`. Ported as `arcEqualizerRows`'
      `isPlaceholder` flag, consumed by `ArcEqualizerChart.vue` to force every block's fill.

      **Theme tokens**: confirmed via grep of `jui-chart/src/theme/classic.js`/`dark.js` - exactly
      5 `arcEqualizer*` tokens exist and all 5 are read from `draw()`: `arcEqualizerBorderColor`/
      `Width` (per-block stroke), `arcEqualizerFontSize`/`FontColor` (center total text),
      `arcEqualizerBackgroundColor` (the no-data placeholder fill - see above). No per-target fill
      token - target fill is `this.color(j)`, the series color cycle, same convention as
      `PieChart`/`BarGaugeChart`/`PyramidChart`. Added to `ChartTheme` in `useTheme.ts` (classic:
      `#fff`/`1`/`13`/`#333`/`#a9a9a9`; dark: `#222222`/`1`/`13`/`#868686`/`#222222`, i.e. only
      `BorderColor`/`FontColor`/`BackgroundColor` actually differ from classic, matching the source
      theme files exactly).

      **Component** (`ArcEqualizerChart.vue`): NOT axis-based (like `PieChart`/`PyramidChart`) -
      `titleReserve`/`area` follow `PyramidChart.vue`'s/`BarGaugeChart.vue`'s own established
      port-only convention (no upstream title concept here either). Props: `data: DataRow[]`
      (genuinely an array, unlike `PieChart`/`PyramidChart`'s single row), `target`, `maxValue`
      (number or per-row callback, default `100`), `stackCount` (default `25`), `textRadius`
      (default `50`), `format` (center total label formatter, defaults to identity per this port's
      established `BarChart`-style convention for a `format` prop with no meaningful non-function
      source default), `colors`, `showTooltip` (port-only addition, see below), `title`. **No
      native tooltip exists in the source** (confirmed via grep - only `addEvent`, no `display`, no
      hover marker) - port-only addition matching `EqualizerChart.vue`'s/`CandlestickChart.vue`'s/
      `RangeBarChart.vue`'s identical precedent: a hover `ChartTooltip` (default `true`) showing the
      target key/value, anchored at the (row, target) block group's own angular/radial midpoint (a
      port-only convenience field, `innerRadius`/`outerRadius`, added to `useArcEqualizer.ts`'s
      `ArcEqualizerTargetBlocks` return shape for this).

      **Events**: `this.addEvent(p, i, j)` once per `<path>` - i.e. once per (row, target) block
      group (`i` = row index, `j` = target index), NOT per individual block (multiple blocks share
      one `<path>`'s `d`, concatenated subpaths). **Deviation from `PieChart.vue`'s/
      `PyramidChart.vue`'s own established `dataIndex: null` precedent, deliberately**: since
      `ArcEqualizerChart`'s `data` prop is genuinely `DataRow[]` (one row per wedge), unlike
      `PieChart`/`PyramidChart`'s single-row `data`, the row index `i` carries real meaning here -
      exactly like `BarChart.vue`'s/`EqualizerChart.vue`'s own per-row `dataIndex` (both also
      `extend: "chart.brush.core"` directly with a real `DataRow[]` shape). `dataIndex` is the real
      row index, NOT `null`. The synthetic no-data placeholder row has no real row to index into -
      no event listeners are attached to its blocks at all (nothing meaningful could be forwarded).

      **Unit tests** (new, `useArcEqualizer.spec.ts`, 18 cases, all hand-traced): `arcEqualizerLayout`
      (3 - square area, wider-than-tall, taller-than-wide, each with hand-computed `r`/`cx`/`cy`/
      `stackSize`), `arcEqualizerStackAngle` (2), `arcEqualizerMaxValue` (3 - plain number, callback
      running-max, empty-rows-with-callback edge case), `arcEqualizerRows` (3 - per-target
      `ceil(stackCount*rate)` hand-computed against 2 real rows, a missing-target-field guard, the
      empty-`data` placeholder), `arcEqualizerBlockPath` (4 - a hand-traced quarter-circle block with
      every one of its 4 key points checked against independently-computed trig, a >180deg large-arc
      flag case, the exact-360deg clamp-to-359.9 case confirmed genuinely non-coincident, and a
      non-origin-center offset case), `arcEqualizerWedgeBlocks` (3 - radial stacking continuity
      between two targets verified via the second target's inner-radius distance from origin, a
      0-count target producing an empty path, and the empty-counts case).

      **Demo**: new `/arcequalizer` page (`ArcEqualizerPage.vue`, wired into `router.ts`) - a
      6-band stereo audio-equalizer-style level display (left/right channel levels per frequency
      band, arranged radially, the requested "realistic audio-equalizer-style multi-band level
      display" data shape), plus sections for custom `stackCount`/`textRadius`, `maxValue` as a
      per-row callback, custom `format`, the no-data placeholder, per-element event forwarding (with
      a `data-testid="last-arcequalizer-event"` log), custom colors + title, and dark theme.

      **Playwright-verified with exact-coordinate proof, matching `pyramid.js`'s own established
      rigor** (an independently-written-from-scratch verification script - its own separate
      `polarToCartesian`/`describeArc`/`blockPath` reimplementation in plain JS, not a call into the
      port's own composable, so it can't share a bug with it): for the default 6-band/2-target demo
      chart (`width=height=360` -> `r=180`, `cx=cy=180`, `stackSize=(180-50)/25=5.2`,
      `stackAngle=60deg`), **all 12 rendered (row, target) block-group `<path>` `d` attributes
      matched the independently hand-computed expected path byte-for-byte** (max floating-point
      diff `1e-6`, i.e. representation noise) - e.g. row 0 (`Bass`, `left=82`) hand-computed
      `ceil(25*0.82)=ceil(20.5)=21` blocks, confirmed against the rendered path's actual block
      count. Center total text confirmed `"660"` (hand-summed: `82+78+65+70+55+52+40+45+60+58+25+30
      = 660`) at `(180,180)`, matching `(cx,cy)` exactly. No-data placeholder chart confirmed exactly
      1 rendered `<path>` (target 0 fully filled, `stackCount=25` blocks) with `fill="#a9a9a9"`
      (classic `arcEqualizerBackgroundColor`). Event forwarding confirmed via dispatched
      `mouseover`/`click` on the first rendered block group: `dataIndex=0 dataKey=left
      data={"band":"Bass","left":82,"right":78}` - **`dataIndex=0`, not empty/null**, confirming the
      documented deviation from `PieChart`/`PyramidChart`'s own `dataIndex: null` precedent.
      Screenshotted all 8 demo sections full-page: default, finer-resolution (`stackCount=40`,
      `textRadius=70`), `maxValue` callback (visibly different per-wedge scaling), custom `format`
      center label, no-data placeholder (solid gray ring), event-forwarding hover tooltip
      (`"left: 82"` balloon visible over the hovered block group), custom colors + title, and dark
      theme - all render correctly with no clipping, no overlap, no visual regressions. Zero
      console/page errors. `npm run test` (257/257 passing, +18 new `useArcEqualizer` cases),
      `npm run build:lib`, `npm run build` all clean with no type errors.

      Exported `ArcEqualizerChart` from `src/index.ts`, plus `useArcEqualizer.ts`'s public functions
      (matching this port's convention of exporting reusable pure-logic composables). Added the 5
      `arcEqualizer*` tokens to `useTheme.ts`'s `ChartTheme` (classic + dark). README.md updated:
      new `ArcEqualizerChart` bullet in "Components", a `useArcEqualizer` bullet in "Composables",
      chart-type count bumped 19 -> 20, and the Phase B item list in "Scope" updated to reflect
      Phase B being fully done.

## Phase C — Complex / specialized brush types

**Phase C is fully complete (5/5)**, as of the iteration that finished `topologynode.js` (see that
checklist item's own entry, last in this section, for the full write-up). Every checklist item below
is checked off. In full, Phase C ported 5 of this engine's most structurally distinct brushes -
`timeline.js`, `selectbox.js`, `flame.js`, `treemap.js`, `topologynode.js` - each requiring its own
new, non-axis-series data model rather than reusing `useSeries`/`useChartLayout` off the shelf:

1. `TimelineChart` (Gantt-style: a flat event array keyed against a block-axis lane domain by
   VALUE, not row position) and `SelectBoxChart` (draws its own `<svg>` chrome instead of wrapping
   `ChartBase`, like `TimelineChart` - both needed for the same confirmed reason: they render a
   complete custom axis chrome that would double-render against `ChartBase`'s own unconditional
   tick-label text).
2. `flame.js`/`treemap.js` share one real data-model pattern, confirmed from source and reused
   directly: both consume the SAME flat, dot-separated-index-path tree-row shape (a row's `key`
   like `"0.2.1"` encodes its position in the hierarchy with no separate parent-pointer or
   nested-children field), factored into one shared hierarchy-building layer rather than two
   parallel implementations.
3. `topologynode.js` is a genuinely different data model from either of the above - real graph
   nodes+edges (`{ key, outgoing: string[] }`, edges derived from `outgoing`, no shared tree/path
   shape at all) - confirmed by explicitly checking rather than assuming a third variant of the
   flame/treemap pattern. Its layout grid (`grid/topologytable.js`) turned out to be genuinely
   required (the brush never computes a position itself) while its control widget
   (`widget/topologyctrl.js`, drag/zoom/pan) turned out to be genuinely optional - the brush renders
   and is fully interactive (click/hover/tooltip/active-cascading) standalone, with zero awareness
   of whether that widget exists. `topologyctrl.js` is now Phase D's first item (see below).

All 5 items are Playwright-verified with exact-value (not just visual) DOM checks, matching the bar
this port has held since Phase A's coordinate-double-offset bug. `npm run test`/`build:lib`/`build`
are clean after each. See each item's own entry below for its full write-up.

- [x] `timeline.js` (395) — TimelineChart. **Source-confirmed, don't assume from the name** -
      `extend: "chart.brush.core"` **directly** (no relation to any other brush); read all 395
      lines plus `brush/core.js`, `base/axis.js`, `grid/block.js`, `base/builder.js`'s `chart.
      color()` before writing anything, per this item's own budgeted "2-4x a typical Phase B item"
      sizing.

      **The data/visual model, confirmed from `drawBefore()`/`drawGrid()`/`drawLine()`/
      `drawData()`, NOT assumed from the "timeline" name**: a Gantt-style schedule, not a `rangebar`
      variant. The y-axis is a `"block"` axis whose domain is the set of LANE labels
      (`axis.y.domain()`); `data` is a FLAT array of EVENTS (not one row per lane), each reading
      exactly 3 fields via `getValue()` - `key` (which lane, matched against the y-domain by VALUE
      via a `keyToIndex` map, not by row position, so multiple events legitimately share one lane),
      `stime`/`etime` (a start/end value pair on a plain numeric x-axis, defaulting to `0`/
      `axis.x.max()` when omitted). **Confirmed NOT a fit for `useRangeSeries`** despite the
      superficial [low,high]-pair resemblance to `rangebar.js`/`rangecolumn.js`: `useRangeSeries`
      reads one block-axis coordinate per ROW (the row's own position, `i`) plus a 2-ELEMENT-ARRAY
      value per `target` field; timeline's lane position is instead a VALUE LOOKUP against the
      block domain (an event's row position is unrelated to its lane index), and `stime`/`etime`
      are two SEPARATE scalar fields, not one `[low,high]` array field - a genuinely different
      shape. New pure logic lives entirely in `useTimeline.ts` (`timelineKeyIndex`/
      `timelineRowIndex`/`timelineBarGeometry`/`timelineRowFillKind`/`timelineConnectors`/
      `timelineActiveBarLayout`/`timelineOverlayStyle`/`timelineBarFillMode`), each unit-tested
      with hand-traced values (22 new test cases in `useTimeline.spec.ts`).

      **Axis-type decision, checked exactly as this item's own instructions asked, not assumed**:
      `drawBefore()`'s ticks call is `this.axis.x.ticks(this.axis.get("x").step)` - the plain
      SINGLE-ARGUMENT `ticks(step)` form this port's existing `"range"` (linear numeric) x-axis
      already implements. **Unlike `selectbox.js`** (which called the date/time-scale-ONLY
      two-argument `ticks(unit, interval)` overload - see that item's own PORT_STATUS.md entry),
      grepping this entire 395-line file confirms there is NO call into any date/time-specific
      scale method anywhere - `timeline.js` is already axis-agnostic. So, unlike `selectbox.js`,
      there was no substitution or scope deviation to make here at all: the caller just represents
      time as plain numbers (e.g. day offsets) on a `"range"` x-axis like any other numeric axis in
      this port, and a new port-only `xFormat` prop renders those numbers as date-like labels for a
      realistic-looking demo (see below) - a cleaner outcome than `selectbox.js`'s item, confirmed
      by actually re-reading the whole file rather than assuming the same gap would recur.

      **Why this component builds its own `<svg>` root instead of wrapping `ChartBase`** (a
      genuine, confirmed-from-source reason): `drawGrid()`/`drawLine()` draw a COMPLETE custom axis
      chrome of their own - a lane-title column (replacing a standard y-axis label column) and a
      column-header row embedded inside the plot with its own tick labels (replacing a standard
      bottom x-axis) - which only coexists cleanly with the engine's own default axis-grid
      rendering because a real usage would set `axis.x.hide`/`axis.y.hide: true` (`grid/core.js`'s
      `hide` option, confirmed via grep) to suppress it. This port's `AxisConfig`/`ChartBase.vue`
      has no per-axis `hide` - `ChartBase`'s X/Y tick-label `<text>` elements render unconditionally,
      independent of `showGrid` - so wrapping it here would genuinely double-render axis text (a
      real visual bug, not hypothetical), unlike e.g. `HeatmapChart.vue` (also a block y-axis, but
      never draws its own separate row-label text, so no clash). Matches `PyramidChart.vue`'s/
      `ArcEqualizerChart.vue`'s precedent for a non-`ChartBase` component - `useChartLayout`/
      `useAxis` still used for all scale/tick/band math.

      **Row index 0 is a conventional HEADER row, not a real lane** - confirmed from `drawGrid()`'s
      `fill = (j==0) ? columnColor : ...` and `drawLine()`'s column-tick labels being positioned at
      `axis.y(0)` (rendered INSIDE row 0), plus the final baseline line sitting at row 0's own
      bottom edge. Demoed with an explicit `''` domain entry at index 0 in `TimelinePage.vue` -
      **no real example of `timeline.js` exists anywhere in `jui-chart`'s `examples/` directory**
      (confirmed via grep), so this convention was inferred from source, not cross-checked - see
      README's "What wasn't validated" for the same caveat.

      **The default per-event color, confirmed from `drawData()`'s `this.color(i, 0)` re-read
      against `brush/core.js`'s `color(key1,key2)`/`base/builder.js`'s `chart.color(key,colors)`
      line by line**: `key2=0` is NOT `undefined`, so `colorIndex` is the CONSTANT `0` - with the
      source's own default (`colors: null`), EVERY event gets the exact same single color
      (`theme.colors[0]`), not a per-row cycle - the SAME shape `HeatmapChart.vue` already found
      and deliberately deviated from for `heatmap.js`'s analogous `this.color(i, null)`. Ported the
      same deviation: `colors?: string[]` indexed by event, falling back to `theme('colors')`'s
      per-index cycle - not the source's literal monotone default (which would defeat the point of
      a visually-scannable schedule).

      **Interaction model, confirmed from `setActiveRect`/`setHoverRect`/`setActiveBar`/
      `setHoverBar` re-read line by line and reduced to one steady-state formula per mode** (see
      `useTimeline.ts`'s doc comments for the full algebraic derivation): the click handler sets
      BOTH `activeIndex` AND `hoverIndex` to the clicked event together, which is what makes
      `timelineOverlayStyle`/`timelineBarFillMode` correct drop-in replacements for the source's 4
      separate imperative functions without a separate "just clicked" code path. **A real bug this
      exact equivalence caught during this iteration's own Playwright verification, not assumed
      correct**: the component's INITIAL `activeIndex` (from the `active` prop) was set without
      also initializing `hoverIndex` to match, so the initial active row rendered merely
      hover-tinted instead of active-tinted (`isHovered && isActive` failing because `hoverIndex`
      started `null`) - fixed by initializing both refs together, matching the click handler's own
      contract. **A second, genuine (not "fixed") upstream quirk found and preserved**: every
      overlay rect (`activeType="rect"`'s hit-target) spans nearly the FULL plot height regardless
      of its own lane (`bg_height = axis.area("height")`, ported literally, not a per-row band) -
      confirmed by hitting it directly while writing the Playwright verification script: a click
      aimed at one event's bar was intercepted by a LATER, X-overlapping event's still-on-top
      overlay and activated that one instead. This is faithful to source (same full-height rect +
      paint-order z-stacking), not a port bug - documented in the verification script and in
      `TimelineChart.vue`'s own header comment. `activeType="rect"`'s hit-target is `r2` (the
      overlay), not the visible bar - `r2` is only rendered in `"rect"` mode (in `"bar"` mode the
      source sets it `visibility:hidden` with no listeners, so this port skips creating it there
      instead of rendering an inert element). `activeEvent` narrowed to `'click' | 'dblclick'` from
      the source's fully-dynamic any-DOM-event-name config (documented deliberate simplification -
      both already in this port's forwarded set, and the source's own default/every realistic use
      is `'click'`). The lane-title's own `mouseover` (`timeline.title` upstream) and the per-event
      active click (`timeline.active` upstream) are ported as `titleHover`/`active` emits - **the
      first brush in this port whose source calls `chart.emit()` with a non-standard event name**
      (every earlier component only ever forwards the 5 standard DOM events).

      **New theme tokens**: all 20 `timeline*` tokens (confirmed actually read from `draw()`/
      `drawGrid()`/`drawLine()`/`drawData()`), classic + dark values ported from `src/theme/
      classic.js`/`dark.js` verbatim - including the confirmed-dead-by-default
      `timelineHoverBarBackgroundColor: null` in BOTH themes (a real, flagged-not-silently-dropped
      no-op path in `activeType="bar"` mode's hover recolor - see `timelineBarFillMode`'s doc
      comment).

      **Not ported**: `clip`/`useEvent` (pre-existing, established gap, matching `PinChart.vue`/
      `RangeBarChart.vue`). No synthetic generic `ChartTooltip` added (unlike `RangeBarChart.vue`/
      `ArcEqualizerChart.vue`'s own port-only tooltip additions) - the source already ships a rich,
      multi-layered hover/label system of its own (row stripe, overlay tint, lane-title mouseover,
      `activeTooltip` text); a second generic tooltip would be redundant. `active`'s initial-value
      indexing is a documented, deliberate simplification: this port always indexes the raw `data`
      array position, not the source's `cacheRect`-compacted (rendered-events-only) index space -
      see `TimelineChart.vue`'s header comment for the exact, narrow case where this would differ.

      Demo: new `/timeline` page (`TimelinePage.vue`) - a 30-day, 4-lane project schedule (Design
      -> Development -> Testing -> Launch, with sequential same-lane AND cross-lane connector
      chains) demoing: the primary `activeType="rect"` mode with per-event-type `colors` and an
      initial `:active="0"`, an `activeType="bar"` mode with `activeTooltip`, the default
      (no-`colors`-prop) per-index palette cycle, `hideTitle`, and dark theme. `xFormat` renders
      day-offset ticks as realistic date labels (`Sep 4`, `Oct 1`, ...) purely cosmetically - the
      axis itself stays a plain numeric `"range"` axis throughout.

      **Playwright-verified with exact-coordinate proof** (dev server + an independently-written
      verification script reading the rendered SVG DOM directly, this project's established
      methodology - script written fresh against hand-derived expected geometry, not copied from
      the component's own math): every row background's `y`/`height` matched
      `laneY(i) ± band/2`/`band` exactly (`band = 69.6` for 5 lanes over a 348px plot height); row
      0/1/2 fills matched `timelineColumnBackgroundColor`/`timelineEvenRowBackgroundColor`/
      `timelineOddRowBackgroundColor` exactly; all 10 vertical divider `x` positions matched
      `scaleX(0..27 step 3)` exactly (domain `[0,30]`, `step=10` default -> `unit=3` -> 11 ticks);
      tick labels matched hand-computed calendar dates (`Sep 4` for day 3, `Oct 1` for day 30);
      event bar `x`/`width`/`y` matched `scaleX(stime)`/`scaleX(etime)-scaleX(stime)`/
      `laneY(lane)-barSize/2` exactly for both the first and last event; per-event-type `colors`
      matched exactly; connector line endpoints matched `scaleX(etime)`/`scaleX(stime)` of the
      adjoining events exactly, stroke matching the origin event's own color; the initial
      `:active="0"` row's overlay matched `fill-opacity=0.15`/`fill=timelineActiveLayerBackgroundColor`
      (the exact bug described above was caught and fixed via this check failing first); clicking a
      different event's overlay correctly deactivated the old one and active-tinted the new one,
      with the emitted `active` event's payload matching the clicked row's real data; hovering a
      third event's overlay while another stayed active confirmed BOTH stay visible simultaneously,
      both hover-tinted (not active-tinted) - the documented `setHoverRect` subtlety; hovering a
      lane title emitted `titleHover` with the correct lane key; the `activeType="bar"` demo's
      active bar matched the full row-band height (`69.6`) with its `activeTooltip` text visible,
      the inactive bar matched the plain `barSize` height (`7`) with its text hidden;
      `hideTitle=true` produced zero row-title `<text>` elements and a `visibility="hidden"` first
      divider line. Zero console/page errors across all 5 demo sections. `npm run test` (279/279
      passing, +22 new `useTimeline` cases), `npm run build:lib`, `npm run build` all clean with no
      type errors.

      Exported `TimelineChart` from `src/index.ts`, plus `useTimeline.ts`'s public functions
      (matching this port's "reusable pure-logic composables get exported" convention). Added the
      20 `timeline*` tokens to `useTheme.ts`'s `ChartTheme` (classic + dark), and removed
      "timeline" from that file's header-comment list of out-of-scope brush types. README.md
      updated: new `TimelineChart` bullet in "Components", `useTimeline` bullet in "Composables",
      chart-type count bumped 20 -> 21, Phase C's `timeline.js` line marked done in "Scope", a new
      "What's simplified" bullet covering all 4 deliberate deviations, and a "What wasn't
      validated" addition noting no real `timeline.js` example exists anywhere upstream.

- [x] `focus.js` (98) — FocusChart. **Source-confirmed, don't assume from the name**: `extend:
      "chart.brush.core"` directly; read all 98 lines before writing anything.

      **Dependency check, done BEFORE starting per this item's own PORT_STATUS.md note**: does
      `focus.js` need `widget/zoom.js`/`widget/zoomscroll.js`/`widget/zoomselect.js` (all unported
      Phase D) to function meaningfully? Grepped the whole file - it reads only `this.axis`/
      `this.chart`/`this.svg`/`this.brush`, all supplied by `chart.brush.core` itself; no
      widget-namespaced call anywhere. Also read `widget/zoomselect.js` and `widget/dragselect.js`
      in full (the two widgets that DO implement real drag gestures) - neither one ever looks up a
      brush by type `"focus"` or writes to a brush's `start`/`end` fields; both draw their own
      separate overlay groups entirely, disjoint from `focus.js`. Grepped every
      `jui-chart/examples/*.html` for `"focus"` - **zero matches**, confirming no reference example
      pairs it with anything either. Conclusion: `focus.js` is a genuinely passive, fully
      self-contained renderer given nothing but `start`/`end` config - it just has no drag/click
      logic of ITS OWN (no `this.on(...)` anywhere in the file, and it never calls `addEvent()`
      either, unlike most other brush types already ported). Cleared for a standalone port.

      **The data/visual model, confirmed from `drawBefore()`/`draw()`/`drawFocus()`**: a translucent
      rect with a solid border line on each of its two edges, spanning the full plot area in the
      perpendicular dimension, positioned between two config INDICES (`start`/`end`, both `-1` by
      default - `draw()` returns an empty `<g>` when either is unset). `drawBefore()` picks which
      axis the selection runs along once per render: `grid = (axis.y.type == "range") ? "x" : "y"` -
      `"x"` for the common vertical-chart case, `"y"` when the y-axis is itself `"block"`
      (horizontal-chart case). For a `"block"` grid axis, the two edges are expanded outward by half
      a `rangeBand()` each (`scale(start) - band/2`, `scale(end) + band/2`) so the overlay spans
      full category cells; for a `"range"` grid axis the indices pass straight through the scale
      with no adjustment. Pure logic ported unmodified into `useFocus.ts`'s `focusGridAxis`/
      `focusPixelRange`, unit-tested with hand-traced values including a **faithfully-preserved
      source quirk**: the `±band/2` is applied to whichever index is literally passed as
      `start`/`end`, not to whichever pixel position ends up smaller - so a REVERSED selection
      (`start` index numerically after `end` index) produces a genuinely different (narrower,
      differently-positioned) rect than the same two indices in order, not a mirror image. Not
      fixed here (no ordering guard exists upstream either) - demoed explicitly in `/focus`.

      **Structural shape**: `ChartBase`-wrapped overlay-only brush (no data series of its own) -
      same shape as `SelectBoxChart.vue`, not a standalone-`<svg>` component like
      `TimelineChart`/`PyramidChart`/`ArcEqualizerChart` (`focus.js` draws nothing without another
      brush's axis/chrome underneath it - it's always layered over one in real usage upstream, even
      though no example actually does so).

      **One deliberate addition, clearly separated from the faithful port**: since `focus.js` has no
      interaction of its own and this port has no zoom widget yet to drive `start`/`end`
      externally, `FocusChart.vue` adds an opt-in `selectEvent` prop (a DOM event name, e.g.
      `"click"`) that arms a 2-click range picker (`resolveFocusSelection` in `useFocus.ts`) over
      invisible per-category hit-target cells - deliberately modeled on the ALREADY-established
      "discrete SVG shape + node-level DOM listener" convention every interactive element in this
      port already uses (see `SelectBoxChart.vue`'s hover cells), not a newly-invented free-drag/
      pixel-inversion gesture (no precedent for that anywhere in this port, and it would have added
      real complexity - SVG `viewBox` coordinate transforms - for no established payoff). Only
      offered when the grid axis is block-typed (an index only identifies one discrete category on
      a block axis). Emits `change` with the resolved `{start, end, data}` (`data` = the inclusive
      slice of `props.data`), letting the demo page pair a `FocusChart` overview with a separate
      `BarChart` "detail" view via plain Vue reactivity - satisfying "a self-contained demo, no
      dependency on an unported zoom widget" genuinely, not just nominally.

      **New theme tokens**: all 4 `focus*` tokens (confirmed actually read from `drawFocus()` - see
      `useFocus.ts`), identical between `classic.js`/`dark.js` upstream, so `darkTheme` doesn't
      override any of them (same convention as every other unchanged token left out of that
      object's spread-override list).

      **Not ported**: no `addEvent()`/per-element event forwarding on the overlay rect itself
      (matches source - `focus.js` never calls it either); no date/time axis substitution needed
      (unlike `selectbox.js`) since `focus.js` never calls a date/time-scale-only method anywhere.

      Demo: new `/focus` page (`FocusPage.vue`) - a 6-month sales overview (block x-axis, the "x"
      grid branch) with a static `start=1,end=3` selection, the same data with a REVERSED
      `start=3,end=1` selection demonstrating the quirk above, a 4-team horizontal-orientation demo
      (block y-axis, the "y" grid branch), an unset (`-1`/`-1`) demo rendering nothing, the
      interactive `selectEvent="click"` 2-click picker paired with a computed-slice detail
      `BarChart`, and dark theme.

      **Playwright-verified with exact-coordinate proof, not just visual** (dev server + an
      independently-written-from-scratch verification script reading the rendered SVG DOM directly):
      static "x" branch rect `x=136` (`scale(1)-44`), `width=264` (`scale(3)+44` minus that),
      `y=20`/`height=348` (full plot height), both border `<line>` x-positions at `136`/`400`,
      `fill=#FF7800`/`fill-opacity=0.1`/border `stroke=#FF7800` all matched exactly; the reversed
      demo's rect matched the DIFFERENT `x=224`/`width=88` predicted by the quirk (not `136`/`264`);
      the horizontal "y" branch rect matched `y=20`/`height=174`/`x=48`/`width=528` exactly; the
      unset demo rendered zero overlay elements; the interactive flow - no overlay after page load,
      still no overlay after exactly one cell click (pending, unresolved), then after a second cell
      click the overlay matched the SAME `x=136`/`width=352` a static `start=1,end=4` would produce,
      the readout text and emitted `change` payload's computed total (`230`) matched hand-summed
      data, and the paired detail `BarChart` rendered with exactly the 4 sliced bars; the dark-theme
      instance's overlay matched the identical `#FF7800` fill (confirmed same value in both theme
      files upstream) even though its background differed (`#222222`). Zero console/page errors
      across all sections. `npm run test` (291/291 passing, +12 new `useFocus` cases), `npm run
      build:lib`, `npm run build` all clean with no type errors.

      Exported `FocusChart` from `src/index.ts` (not `useFocus.ts`'s functions - matching
      `useSelectBox.ts`/`useActive.ts`/etc.'s existing precedent of NOT every composable being
      re-exported from the package root, only the earlier Phase A/B core ones). Added the 4
      `focus*` tokens to `useTheme.ts`'s `ChartTheme`. README.md updated: new `FocusChart` bullet in
      "Components", chart-type count bumped 21 -> 22, Phase C's `focus.js` line marked done in
      "Scope", a new "What's simplified" bullet for the added `selectEvent` click-to-select
      capability.

- [x] `flame.js` (390) — FlameChart (flame graph). **Source-confirmed, don't assume from the
      name**: `extend: "chart.brush.core"` directly - it only REUSES `treemap.js`'s
      `chart.brush.treemap.nodemanager` as a data-structure helper (`jui.use(TreemapBrush)`), no
      `extend` relationship to `chart.brush.treemap` itself. Read all 390 lines plus
      `treemap.js`'s `chart.brush.treemap.node`/`nodemanager` and `brush/core.js`'s `addEvent()`/
      `color()` before writing anything - this port's FIRST genuinely hierarchical brush.

      **The data model, confirmed from `drawBefore()`'s `nodes.insertNode(k,{...})` loop and
      `examples/resources/flamedata.js`'s real sample data (no shipped `.html` example exists) -
      NOT a nested/children-array input**: a FLAT array of `{index, text, value}` rows, `index` a
      dot-separated tree-path string (`"0"` root, `"0.1.0"` = root's 2nd child's 1st child).
      Rebuilt into a plain object tree with real `children`/`parent` pointers
      (`buildFlameTree()` in `useFlame.ts`) rather than porting `chart.brush.treemap.node`'s own
      imperative `Node`/`NodeManager` classes verbatim - a deliberate, documented
      re-implementation, not a literal line-by-line port, since the pure-tree shape is far easier
      to hand-test.

      **The layout formula, re-derived from `drawNodeAll()`'s recursion and hand-traced (a 4-level,
      8-node tree, `useFlame.spec.ts`) before being trusted**: the ROOT always spans the full plot
      width regardless of its own `value`; each child's width is `parentWidth * (child.value /
      parent.value)` - a share of its OWN PARENT's width, **never normalized against a
      children-value-sum** (a faithfully-preserved quirk: mismatched child values produce a visible
      gap or overflow, not an error or a rescale). Depth maps to a FIXED row height
      (`plotHeight / maxDepth`, `maxDepth` computed once from the full unfiltered tree and held
      fixed across zoom). `nodeOrient: "bottom"` (source default) anchors the root at the BOTTOM
      row, depth increasing upward (the conventional flame-graph look); `"top"` anchors at the top,
      though depths start at `1` so the very first row (`y` in `[0,rowHeight)`) is always empty -
      ported literally, not "fixed" (hand-traced and Playwright-confirmed: `tokenize`, the deepest
      node in the reference tree, lands at `y=200`, never `y=0`, at height=200/rowHeight=50).
      `nodeAlign: "start"` vs. `"end"` (source default) are two genuinely different accumulation
      algorithms that land on the SAME final positions for well-formed (evenly-dividing) values -
      ported as both, faithfully, rather than collapsed to one (hand-traced equivalence test in
      `useFlame.spec.ts`).

      **Color, confirmed from `drawNodeAll()`'s `self.color(0)` re-read against `brush/core.js`'s
      `color(key1)`**: `FlameBrush.setup()` declares no `colors` option at all (unlike
      `heatmap.js`/`timeline.js`, which do) - every node gets the exact same CONSTANT palette color
      unless the caller supplies `nodeColor` (source's own real per-node customization hook, called
      AFTER the node's geometry is set). Ported as a `nodeColor?: (node) => string` prop taking the
      positioned node - **no `colors[]`-cycling deviation invented here** (unlike
      `TimelineChart`/`HeatmapChart`'s own precedent for an analogous constant-color source),
      because `nodeColor` already IS the intended real-world hook (a typical flame graph hashes a
      frame name to a color - demoed exactly that way in `FlamePage.vue`).

      **Labels, confirmed from `createTextElement()`**: rendered only when `format` is supplied
      (`if (!_.typeCheck("function", self.brush.format)) return null`). **Checked explicitly per
      this item's own task brief and confirmed absent**: no width-vs-text-length check exists
      anywhere in `createTextElement()` - a label always renders at full size regardless of how
      narrow its node is. This port does NOT invent narrow-rect truncation/hiding either - a
      caller wanting that effect supplies a `format` that shortens the label itself, demoed in
      `FlamePage.vue`'s "narrow rects with a caller-supplied truncating `format`" section
      (Playwright-confirmed: at least one label renders with a `…` ellipsis there).

      **Zoom (`activeIndex`), confirmed from `draw()`'s `createFilteredNodes()`/
      `setCacheParents()`/`setCacheChildren()`/`sortingCacheNodes()`/`createIndexData()`/
      `createChildIndexData()` dance - re-derived as a MUCH simpler equivalent, not a literal
      port**: source rebuilds a fresh, re-indexed `NodeManager` on every draw call (with an
      `axis.cacheNodes` fallback for indices from an already-zoomed view) purely because its
      imperative rendering has no stable tree to walk between renders. This port's tree is a
      stable `computed()`, so `filterFlameActive()` in `useFlame.ts` instead just walks
      `activeNode`'s real `parent` pointers, cloning each ancestor with its `value` forced to
      `activeNode.value` (making every ancestor-to-child rate exactly `1`, i.e. full width) while
      `activeNode`'s own real subtree is carried over untouched - **algebraically verified
      equivalent to source's own math by hand-tracing both a 1-ancestor and a 2-ancestor zoom case
      before trusting it** (see `filterFlameActive()`'s own doc comment for the full derivation,
      and `useFlame.spec.ts` for both traced cases, including the exact dimmed/full-opacity split
      at each depth). Every node's depth (and therefore row Y) stays identical between zoomed and
      unzoomed views - only widths change. Source has NO click-to-zoom logic of its own
      (`activeIndex` is a passive config value, exactly like `focus.js`'s `start`/`end`) - **this
      component adds an opt-in `zoomEvent` prop** (`'click' | 'dblclick' | false`, default
      `'click'`), clearly flagged as a deliberate addition matching `FocusChart.vue`'s own
      `selectEvent` precedent exactly: clicking ANY rendered node (including a dimmed ancestor)
      re-zooms to it, so clicking the true root zooms all the way back out - no separate "reset"
      mechanism needed (though `FlamePage.vue` also demos an explicit reset button via the
      `activeIndex` prop + a `watch`, for a controlled-component use case). A bad/unknown
      `activeIndex` renders the full unfiltered tree instead of throwing - a deliberate, flagged
      deviation from source's own unguarded `null.value` crash in this situation.

      **Structural shape**: standalone `<svg>` root (no `ChartBase`/axis concept at all, like
      `PyramidChart`/`ArcEqualizerChart`) - matches source's own `this.axis.area()`-only
      positioning (never a `.scale()` call anywhere in the file). `titleReserve`/`area` follow
      those two components' own established port-only convention.

      **Per-element events, confirmed from `this.addEvent(r, node)`/`this.addEvent(t, node)`** (the
      rect AND its label text, when rendered) - source passes the NODE OBJECT itself, not an
      index, so `addEvent()`'s `_.typeCheck("object", dataIndex)` branch fires and `dataIndex`/
      `dataKey` are never set upstream. Ported as `dataIndex: null`, `dataKey: node.index` (the
      node's own hierarchical path string), `data` = `{index, text, value, depth}`.

      **New theme tokens**: all 5 `flame*` tokens (confirmed actually read from
      `createNodeElement()`/`createTextElement()`/`drawBefore()`), classic + dark values ported
      from `src/theme/classic.js`/`dark.js` verbatim.

      **Not ported**: `clip`/`useEvent` (pre-existing, established gap, matching `PinChart.vue`/
      `RangeBarChart.vue`/`FocusChart.vue`).

      Demo: new `/flame` page (`FlamePage.vue`) - the EXACT 4-level, 8-node tree hand-traced in
      `useFlame.spec.ts` (at the same 300x200 area, so its rendered coordinates are directly
      checkable against that same by-hand table) in both `nodeOrient` modes, a realistic 13-node
      5-level call-stack sample with name-hash `nodeColor`, the click-to-zoom flow with a
      breadcrumb + reset button, a narrow-rect caller-truncated `format`, `textAlign` variants, a
      no-`format` (no labels) case, per-element event forwarding, and dark theme.

      **Playwright-verified with exact-coordinate proof** (dev server + an independently-written
      verification script reading the rendered SVG DOM directly, this project's established
      methodology): all 8 reference-tree node rects matched the hand-traced table exactly - `main`
      `x=0,y=150,w=300`; `processRequest`/`backgroundJob` `y=100,w=180`/`w=120`; `parseInput`/
      `validate`/`flushQueue` `y=50,w=120`/`w=60`/`w=120`; `tokenize`/`normalize` `y=0,w=75`/`w=45`
      (every `height=50`); `nodeOrient="top"` matched `y = 50/100/.../200` per depth (never `0`);
      clicking `runQuery()` (value 200, nested 2 levels under `main()`) zoomed it to full width
      (`640`) at full opacity, its ancestor `handleRequest()` became full-width AND dimmed
      (`fill-opacity=0.4`), and its own child `readRows()` (value 150) scaled correctly to
      `640*150/200=480` at full opacity - confirming the hand-derived zoom-filter equivalence
      exactly, not just visually; the reset button returned the breadcrumb to unzoomed; the
      truncating-`format` demo produced at least one `…`-shortened label; the no-`format` demo
      rendered zero `<text>` elements; a clicked node's forwarded event payload matched
      `dataIndex=null`/`dataKey="0"`/the expected node data; dark theme background matched
      `#222222`. Zero console/page errors across all 10 demo sections. `npm run test` (308/308
      passing, +17 new `useFlame` cases), `npm run build:lib`, `npm run build` all clean with no
      type errors.

      Exported `FlameChart` from `src/index.ts`, plus `useFlame.ts`'s public functions (matching
      `useTimeline.ts`'s precedent of exporting a Phase C composable's functions, not
      `useFocus.ts`'s/`useSelectBox.ts`'s precedent of keeping them internal - the split isn't
      strictly size-based, but this item's tree-building/layout functions are generically reusable
      the same way `useTimeline`'s are). Added the 5 `flame*` tokens to `useTheme.ts`'s
      `ChartTheme` (classic + dark). README.md updated: new `FlameChart` bullet in "Components",
      `useFlame` bullet in "Composables", chart-type count bumped 22 -> 23, Phase C's `flame.js`
      line marked done in "Scope", a new "What's simplified" bullet covering the zoom-filter
      re-derivation, the `zoomEvent` addition, and the bad-`activeIndex` guard.

- [x] `treemap.js` (774) — TreemapChart. **Source-confirmed, don't assume from the name**:
      `extend: "chart.brush.core"` directly - this brush DEFINES `chart.brush.treemap.nodemanager`
      (the tree-building helper `flame.js` only BORROWS, per its own entry above - the dependency is
      one-way in the other direction than that entry's "recommended next item" note guessed: reading
      this file confirmed `useFlame.ts`'s `buildFlameTree()` was right to stay flame-specific rather
      than generalized, since treemap's own tree shape needs genuinely different bookkeeping - see
      below). Read all 774 lines, including `chart.brush.treemap.node`/`nodemanager`/`container`/
      `calculator`, before writing anything.

      **The data model, confirmed from `drawBefore()`'s `nodes.insertNode(k, {...})` loop**: the
      SAME flat, dot-separated-index-path row shape as `flame.js` (`{index, text, value}`).
      **Genuinely different from `flame.js` in one load-bearing way, confirmed by reading
      `nodemanager`'s real `root`**: it's a SYNTHETIC, never-rendered wrapper, so `root.children` can
      hold MANY top-level siblings (e.g. several disk folders) - NOT `flame.js`'s own port
      (`buildFlameTree()`) assumption that the first row is unconditionally the single root (a call
      stack has one root frame; a treemap usually doesn't). `useTreemap.ts`'s `buildTreemapForest()`
      returns an ARRAY of top-level nodes for exactly this reason - a genuine structural difference
      from `useFlame.ts`, not a stylistic one, caught by actually reading `nodemanager` rather than
      assuming its shape from `flame.js`'s own reuse of it.

      **The layout algorithm, confirmed from `chart.brush.treemap.calculator`'s `squarify()`/
      `improvesRatio()`/`calculateRatio()` + `chart.brush.treemap.container`'s `getCoordinates()`/
      `cutArea()`**: the SQUARIFIED treemap algorithm (Bruls, Huizing, van Wijk, "Squarified
      Treemaps"), NOT slice-and-dice - confirmed by `calculateRatio()`'s explicit worst-aspect-ratio
      computation and a source comment noting a direction fix vs. the original paper's own pseudocode
      (`currentratio >= newratio`). Values are processed in the GIVEN order - **no descending sort
      anywhere in the whole `calculator` object**, confirmed by reading it in full; reproduced as-is
      (a caller wanting the paper's typical good-aspect-ratio behavior must pre-sort their own data
      descending by value - not something this port adds automatically).

      **The nested-grouping algorithm - the single most involved piece of analysis in this port so
      far, exactly as this item's own task brief predicted**: naive reading of
      `treemapMultidimensional()`'s own recursive shape suggests it nests arbitrarily deep to match
      the source tree's real depth. **It does not.** `convertNodeToArray()` (the function that turns
      the node tree into the array `treemapMultidimensional()` consumes) always produces a flat
      `number[][]` - an array of GROUPS, each group a plain array of numbers - **exactly 2 levels
      deep, regardless of the source tree's real depth**: at any level, each LEAF sibling's value is
      pushed into one shared running array; each NON-LEAF sibling instead triggers an immediate
      recursive call that pushes ITS OWN flattened leaf-descendant array as a separate, sibling entry
      in the SAME shared result list (not nested inside the running array); the running array (that
      level's "leaf run") is only pushed at the very end of that level's loop, so it always ends up
      LAST among that level's groups regardless of where the actual leaf siblings sat in the input.
      Since `treemapMultidimensional()` only ever checks ONE level of array-ness on its input, this
      flat shape means its recursion is ALWAYS exactly 2 calls deep: an outer squarify of each
      group's value-SUM (one rectangle per group), then an inner squarify of each group's own raw
      leaf values within that group's rectangle. `collectTreemapGroups()`/`layoutTreemapForest()` in
      `useTreemap.ts` reproduce this exact grouping directly on the tree (not via index-string
      round-tripping) and perform exactly those 2 squarify passes - **an algebraic equivalence,
      re-derived and hand-traced against BOTH a 2-level mixed-sibling case (`useTreemap.spec.ts`,
      values [5,15] grouped separately from a top-level leaf sibling of value 10) and a 3-level
      single-child-chain case, before being trusted**, not a simplification of behavior.

      **A real, confirmed-by-hand-trace quirk this preserves, not fixes**: a chain of single-child
      non-leaf ancestors (e.g. a folder containing exactly one sub-folder containing the real files)
      is geometrically HARMLESS - the intermediate levels' own "leaf run" groups are empty, which
      squarify handles as zero-value entries that consume no area (verified: `calculateRatio()`
      divides by the row's min value, so a 0 produces `Infinity`, which always fails
      `improvesRatio()`'s comparison and just forces an immediate, area-free row break). **But
      siblings 3+ levels apart that are NOT part of a simple single-child chain lose their
      intermediate grouping boundary entirely** - demoed explicitly in `TreemapPage.vue`'s
      "Exact-coordinate reference #2" section (a top-level leaf `readme.txt` next to a top-level
      folder `Archive` containing `old1.txt`/`old2.txt`): `readme.txt` and `Archive`'s own two files
      render as 3 separate, non-adjacent-looking rectangles at the same visual level, with no
      rectangle representing "Archive as a whole" - Playwright-confirmed at `readme.txt`
      x=160,y=0,w=80,h=200 and `old1.txt`/`old2.txt` x=0,y=0/50,w=160,h=50/150, exactly matching the
      hand trace. This is why the realistic demo dataset is kept strictly 2 levels deep (folder ->
      file, no sub-folders) - a genuinely mixed leaf+non-leaf-with-its-own-non-leaf-children input
      would NOT render as a normal-looking nested treemap in this source, and this port does not
      "fix" that, only documents and demos it clearly.

      **Rendering, confirmed from `mergeArrayToNode()`/`isDrawNode()`**: only LEAF nodes ever receive
      real `x`/`y`/`width`/`height` - non-leaf nodes keep their `drawBefore()`-time default geometry
      (`0,0,0,0`) and `isDrawNode()` explicitly skips drawing any node whose x/y/width/height are ALL
      zero, so non-leaf nodes are NEVER drawn as rectangles, only used as invisible grouping
      containers and, per `titleDepth` (default `1`), a title label. `getMinimumXY()` (used to place
      a non-leaf's title label) is confirmed **not a true bounding-box minimum** - it always descends
      via `node.children[0]` (first child) until it hits a leaf and uses THAT leaf's real position;
      ported literally as `treemapTitleAnchor()`, not replaced with a true min().

      **Color, confirmed from `draw()`'s `this.color(getRootNodeSeq(nodeList[i]))`**: every leaf's
      default fill cycles the theme palette by its TOP-LEVEL ancestor's sibling position (all
      descendants of one top-level branch share a color) - `getRootNodeSeq()` walks `node.parent` on
      every call; this port precomputes the equivalent (`topAncestorIndex`, inherited down the tree
      at build time) once instead, same "real object references over source's own index-string
      bookkeeping" choice `useFlame.ts` made for `parent`. `nodeColor` (per-leaf override, called
      AFTER geometry is set) overrides this exactly like `flame.js`'s own `nodeColor` hook.

      **Labels, confirmed from `draw()`'s per-node text block**: `showText` (default `true` - unlike
      `flame.js`'s format-gated labels) shows `format(node)` or `node.text` for every leaf not
      already title-labeled (`titleKeys` tracking, ported exactly). `textAlign`
      (`"start"|"middle"|"end"`, default `"middle"`) and `textOrient` (`"top"|"center"|"bottom"`,
      default `"top"`) are two INDEPENDENT axes (`treemapTextX()`/`treemapTextY()` in
      `useTreemap.ts`), each computed from its own separate config value, not one combined position
      setting.

      **Interaction, checked explicitly against this item's own task brief**: source has NO
      click-to-drill-down (or any other interaction) of its own - `draw()`'s only event wiring is
      `this.addEvent(elem, nodeList[i])` on the drawn RECT alone; title and per-leaf text never get
      `addEvent` (confirmed by re-reading `draw()` in full - a genuine difference from `flame.js`,
      which attaches to both rect AND text). **This port does NOT invent a drill-down/zoom addition**
      (unlike `FlameChart.vue`'s deliberate, clearly-flagged `zoomEvent` addition) - per-element event
      forwarding only, matching source's real interaction surface exactly. `dataIndex: null`,
      `dataKey: node.index`, `data` = `{index, text, value, depth}` - matching `FlameChart.vue`'s own
      precedent (source passes the node object, not an index, so `addEvent()`'s own
      `_.typeCheck("object", dataIndex)` branch fires upstream too).

      **Structural shape**: standalone `<svg>` root (no `ChartBase`/axis concept), matching source's
      own `this.axis.area()`-only positioning - `titleReserve`/`area` follow `FlameChart.vue`'s own
      established port-only convention.

      **New theme tokens**: all 6 `treemap*` tokens (confirmed actually read from
      `createTitleDepth()`/`draw()`), classic + dark values ported from `src/theme/classic.js`/
      `dark.js` verbatim.

      **Not ported**: `clip` (pre-existing, established gap - matches `FlameChart.vue`/
      `FocusChart.vue`/`PinChart.vue`/`RangeBarChart.vue`'s own header comments).

      Demo: new `/treemap` page (`TreemapPage.vue`) - two dedicated exact-coordinate reference
      sections (a flat 4-sibling case, values [4,3,2,1] at 300x300; and the 2-level mixed-sibling
      "readme.txt next to Archive folder" case at 240x200, doubling as the grouping-quirk demo), a
      realistic strictly-2-level "disk usage by folder" dataset (4 folders, 13 files,
      `titleDepth`-labeled folders, default per-folder `nodeColor` cycling, a `format` distinguishing
      folder titles from file labels), `textAlign`/`textOrient` variants, a no-title-labels variant,
      per-element event forwarding, and dark theme.

      **Playwright-verified with exact-coordinate proof** (dev server + an independently-written
      verification script reading the rendered SVG DOM directly - `playwright` isn't a project
      dependency, so this ran via a scratch script using a locally-installed `playwright` package
      against the system's already-cached Chromium, same methodology as every other Phase C item just
      without the package pre-installed): the 4-sibling reference section's rects matched the by-hand
      table exactly (Box A x=0,y=0,w=210,h=1200/7; Box B x=0,y=1200/7,w=210,h=900/7; Box C
      x=210,y=0,w=90,h=200; Box D x=210,y=200,w=90,h=100) and tiled the full 300x300 area with zero
      gap (summed leaf area = exactly 90000); the 2-level reference section matched its own by-hand
      table exactly (set-wise, since render order follows `collectTreemapGroups()`'s grouping order,
      not input row order) and also tiled its full 240x200 area with zero gap; the realistic
      disk-usage demo rendered exactly 13 leaf rects with zero pairwise overlap, tiled its title-
      adjusted plot area exactly (640 x (360-27) = 213120, matching the rendered total to within
      floating-point rounding), showed all 4 expected folder titles, and used exactly 4 distinct fill
      colors (one per top-level folder, confirming the `topAncestorIndex` color-cycling); clicking a
      leaf in the event-forwarding section produced `dataIndex=null`/`dataKey="0.0"`/
      `data={"index":"0.0","text":"Reports.pdf","value":120,"depth":2}`; dark theme background
      matched `#222222`. Zero console/page errors across all 8 chart instances on the page. A full-
      page screenshot was also reviewed for visual sanity (no clipping, no empty charts, consistent
      squarified subdivision). `npm run test` (324/324 passing, +16 new `useTreemap` cases), `npm run
      build:lib`, `npm run build` all clean with no type errors.

      Exported `TreemapChart` from `src/index.ts`, plus `useTreemap.ts`'s public functions (matching
      `useFlame.ts`'s/`useTimeline.ts`'s precedent of exporting a Phase C composable's generically
      reusable functions). Added the 6 `treemap*` tokens to `useTheme.ts`'s `ChartTheme` (classic +
      dark). README.md updated: new `TreemapChart` bullet in "Components", `useTreemap` bullet in
      "Composables", chart-type count bumped 23 -> 24, Phase C's `treemap.js` line marked done in
      "Scope", a new "What's simplified" bullet covering the nested-grouping re-derivation and the
      deliberate NON-addition of a drill-down interaction, and a "What wasn't validated against a
      real example" note (no shipped `.html` example or data resource exists for `treemap.js`
      either).

- [x] `topologynode.js` (711) — TopologyChart. **The last Phase C item - see the paragraph right
      after this entry for what that means for the port's phase status** (this file leaves the
      formal Phase C completion write-up/Phase D transition for the next iteration, per explicit
      instruction, rather than doing it as a rushed tail-end of this one).

      **The real dependency graph, confirmed from source (not carried forward as a guess)**:
      `extend: "chart.brush.core"` directly. Two files this brush's own task brief flagged as
      possible dependencies were both read in full and resolved differently:
      - `grid/topologytable.js` (191 lines) - **genuinely required, not optional**. The brush never
        computes a node position itself; every position comes from `self.axis.c(index)`, and in the
        real engine the only thing that ever answers that call is this grid, wired via
        `axis: [{ c: { type: "topologytable" }, data }]` (confirmed from `examples/topology.html`,
        the only shipped example for this brush - see below). Ported directly as pure functions
        (`layoutTopologyLinear`/`layoutTopologyRandom` in `useTopology.ts`) rather than the generic
        `chart.grid.c`/`chart.grid.core` indirection around them - same choice `usePie.ts` made for
        `axis.c`'s pie/donut center math, `useTreemap.ts`/`useFlame.ts` made for the tree engine.
      - `widget/topologyctrl.js` (191 lines) - **confirmed genuinely OPTIONAL, like `focus.js`
        turned out not to need `zoom.js`**: read in full, it only ever calls
        `axis.c(key).setX/setY/setScale/setView(...)` (mutators the grid itself exposes for drag/
        zoom/pan) and forces a re-render - the brush renders and is fully interactive (node/edge
        click, hover, tooltip, active cascading) with zero awareness of whether this widget exists.
        Not ported this iteration (it's a Phase D item) - see its own checklist entry below.
      - `grid/topologytable.js`'s own name suggested a link to a `chart.brush.topologytable`
        cousin, but there is no such brush - the "table" is only ever this one grid type, already
        covered above.

      **The data model, confirmed from `draw()`'s `this.eachData()`/`setDataEdges()`**: real graph
      nodes+edges - genuinely DIFFERENT from `treemap.js`/`flame.js`'s shared flat
      dot-separated-index-path tree-row shape, not a variant of it (this iteration's task brief
      explicitly asked to check this). Each row is `{ key: string, outgoing: string[], ...fields }`;
      `outgoing` lists other rows' `key`s this row has a directed edge to - there is no separate
      top-level edges/links array for the topology itself. The optional `edgeData` prop
      (confirmed from `examples/topology.html`) is a SEPARATE, purely-metadata array
      (`{ key: "start:end", ...fields }`) consulted only for an existing edge's label/tooltip/
      opacity - an edge with no matching row still renders (line + endpoint dot), just unlabeled at
      the theme's default opacity.

      **Layout, confirmed by reading both of `grid/topologytable.js`'s sort functions in full - the
      key scope-deciding question this item's task brief flagged**: NEITHER is force-directed
      physics, and NEITHER reads caller-supplied x/y from the data rows (the shipped example's own
      `data2` sample has `x`/`y` fields that are never looked at) - both are purely procedural
      placements within the axis area (`"random"`: `Math.random()` for both axes; `"linear"`
      (default): a deterministic-X/random-Y zigzag column scan). **A real, hand-traced quirk of
      "linear", re-derived and verified against a full 4-node hand trace in `useTopology.spec.ts`
      before being trusted**: a row's rendered position is generally NOT its own computed point -
      the loop writes each row's point into a "slot" index from separate `left`/`right` running
      pointers, not the row's own loop index, and the brush later reads a row's position by
      indexing DIRECTLY with the row number - see `layoutTopologyLinear`'s doc comment in
      `useTopology.ts` for the exact slot-mapping formula. This resolved the task brief's central
      "physics vs. practicality" concern in the simple direction: no physics simulation exists to
      make a scope call about at all.

      **Edge geometry, confirmed from `getDistanceXY()`/`setDataEdges()`, hand-traced (a clean-
      integer 2-node case, a self-loop-skip case, a differing-node-scale case) in
      `useTopology.spec.ts`**: each line runs from just outside the SOURCE node's own circle to
      just outside the TARGET's (pulled back by that endpoint's own radius + a theme-driven marker
      radius + 1), not center-to-center, and BOTH pull-back distances scale by the SOURCE's own
      node scale, never the target's - a real, preserved asymmetry. A small filled circle (the one
      real bit of directionality this brush draws, no literal arrowhead) sits at the TARGET end.
      **Reciprocal edges (A->B and B->A both present), hand-traced against this exact graph shape**:
      only the first-built direction renders the actual `<line>` (`ownsLine`); the second reuses it
      instead of drawing an exactly-overlapping duplicate, but both directions still get their own
      end-marker circle and their own edge label. The shared line's opacity ends up being the
      SECOND (reciprocal) edge's own opacity, not the first's - source's own last-write-wins paint-
      order quirk, reproduced via a direct lookup. **Active-cascading has a real, order-dependent
      asymmetry, also preserved (not symmetrized)**: activating a node/edge only pulls in its
      reciprocal when THAT SPECIFIC direction's own `connect` flag is true - demoed explicitly (and
      Playwright-verified via exact DOM `fill` attribute checks on both end-marker dots, not just
      visual inspection) in `TopologyPage.vue`'s "Reciprocal edge sharing" section.

      **Interaction, confirmed from `draw()`'s full event-wiring**: `activeEvent` (default
      `"click"`) gates both node and edge activation; an edge's tooltip only shows, and only then
      emits `edgeclick`, when BOTH `tooltipTitle` and `tooltipText` are supplied (`showTooltip()`'s
      own early-return, a real gate, not assumed). Hover recoloring is independent of `activeEvent`
      and a no-op on an already-active edge. Per-node generic DOM event forwarding
      (`ChartElementEventPayload`) is ported from `this.addEvent(node, index, null)` - **confirmed
      edges get none** (`self.addEvent` is only ever called for nodes in this file), so none was
      invented for edges either; edges only ever emit `nodeclick`/`edgeclick` (renamed from
      `topology.nodeclick`/`edgeclick` - Vue can't parse a literal `.` in an event name).
      **One deliberate, flagged fix, not a preserved quirk**: source's only call site to
      `showTooltip(edge)` omits its own `e` parameter, so upstream's `edgeclick` payload's event
      argument is always `undefined` in practice - this port passes the real `MouseEvent` instead,
      since preserving `undefined` here would only lose information with no compensating behavior
      to document (unlike e.g. treemap's grouping quirk, which has real visual consequences).

      **What's simplified**: layout is a reactive `computed()`, not source's own compute-once
      `axis.cacheXY` cache (recomputed forever after first use, even across later data changes in
      source - an artifact of the imperative re-render lifecycle, not a documented algorithm
      feature). `activeNode`/`activeEdge` apply immediately/reactively from first render, unlike
      source's own `this.on("render", (init) => { if (!init) ... })` gate (skips the very first
      render) - preserving that literally would make the demo's own active-node/active-edge
      sections look broken on load, with no real Vue-reactive equivalent to preserve. Tooltip
      balloon width is really measured (`getComputedTextLength()`, shared with `ChartTooltip.vue`);
      height is a `fontSize`-based approximation, matching `ChartTooltip.vue`'s own already-
      documented approximation. `widget/topologyctrl.js` (drag/zoom/pan) and the node-front-z-order
      it alone triggers (`axis.cache.nodeKey`/`node.order`) are not ported this iteration - see the
      dependency-graph section above.

      **New theme tokens**: all 19 `topology*` tokens (confirmed actually read from
      `getNodeRadius()`/`createNodes()`/`createEdgeLine()`/`createEdgeText()`/
      `onNodeActiveHandler()`/`onEdgeMouseOverHandler()`/`showTooltip()`/`drawBefore()`), classic +
      dark values ported from `src/theme/classic.js`/`dark.js` verbatim.

      Demo: new `/topology` page (`TopologyPage.vue`) - **unlike every other Phase C item, this
      brush DOES have a real shipped example** (`examples/topology.html`), reproduced directly as
      the "Realistic dataset" section (the WAS/server/DB call graph, `edgeData`, all 7 callback
      props, including the self-referencing `outgoing` entry that exercises the self-loop skip);
      plus a dedicated reciprocal-edge-sharing + active-cascading-asymmetry section (hand-traceable
      3-node graph), a `sort="random"` variant, per-element node event forwarding, and dark theme.

      **Playwright-verified** (dev server + an independently-written verification script reading
      the rendered SVG DOM directly, same methodology as every other Phase C item): node
      count/radii/colors/titles matched expectations exactly (W2/W3 at radius 25 via `nodeScale`,
      others at the theme default 12.5; 5 distinct cycled palette colors); edge `<line>` count was
      exactly 4 for 5 real directed edges with one reciprocal pair sharing a line, confirmed by
      reading the raw rendered markup (5 per-edge groups, one with an empty `<!--v-if-->` in place
      of its own `<line>`, 5 end-marker circles, 5 text labels); clicking an edge line showed a
      tooltip with exactly the hand-expected content (`"W2 → W3"` / `"Total time/count: 1000/3"`,
      balloon `points` starting `"0,7 ..."` confirming the "bottom" balloon variant for that edge's
      `align="end"`) and the `edgeclick` payload matched (`1000_2:1000_3 time=1000`); clicking the
      background reset the tooltip (polygon count 0) and clicking a node produced the expected
      `nodeclick` payload (`W1 (1000_1)`); the reciprocal-pair section's exact `fill` colors on
      both end-marker dots matched the hand-derived cascading-asymmetry table in both scenarios
      (`active-node="A"`: `[A:B active, A:C active, B:A default]`; `active-node="B"`:
      `[A:B active, A:C default, B:A active]`); a pull-back-distance check on that same section's
      rendered line endpoints matched the `radius + pointRadius(3) + 1` formula exactly (16.5) in
      both scenarios; dark theme background matched `#222222`. Zero console/page errors across all
      6 chart instances on the page; a full-page screenshot was also reviewed for visual sanity (no
      clipping, no empty charts, visibly distinct active/default coloring). `npm run test` (350/350
      passing, +26 new `useTopology` cases), `npm run build:lib`, `npm run build` all clean with no
      type errors.

      Exported `TopologyChart` from `src/index.ts`, plus `useTopology.ts`'s public functions
      (matching every other Phase C composable's own precedent). Added the 19 `topology*` tokens to
      `useTheme.ts`'s `ChartTheme` (classic + dark). README.md updated: new `TopologyChart` bullet
      in "Components", `useTopology` bullet in "Composables", chart-type count bumped 24 -> 25,
      Phase C's `topologynode.js` line marked done in "Scope", a new "What's simplified" bullet
      covering the reactive-layout/render-gate/tooltip-height deviations, and a "What wasn't
      validated against a real example" note flagging this as the one Phase C item that WAS
      grounded in a real shipped example.

This was Phase C's last unstarted item - every Phase C checklist item above is now checked off. Per
explicit instruction for this iteration, the formal "Phase C is fully complete" write-up and the
Phase D transition are deliberately left for the next iteration to do properly, the same way Phase A
and Phase B each got their own dedicated completion summary rather than having one tacked onto the
tail end of their last item's own entry.

## Phase D — Widgets

Source: `jui-chart/src/widget/*.js`.

**Phase D is fully complete (8/8)**, as of the iteration that finished `zoomscroll.js` (see that
checklist item's own entry below for its full write-up). Phase D covers - across many iterations,
layered on top of the Phase A-C chart types:

1. `legend.js` — the standalone `ChartLegend` component (series color-key/toggle list).
2. `guideline.js`/`cross.js` — `LineChart`'s `guideline` (snapped per-row value guide) and
   `crosshair` (raw-position axis-value readout) props - two genuinely different interaction
   models, both ported rather than one subsuming the other.
3. `zoom.js` — `LineChart`'s `zoomable` prop (drag-a-rectangle real axis-domain zoom).
4. `dragselect.js` — `LineChart`'s `dragSelect`/`dragSelectMode` props (passive multi-point drag
   selection, non-domain-mutating).
5. `scroll.js`/`vscroll.js` — `LineChart`'s `scrollable`/`verticalScrollable` props (fixed-size-
   window scrollbar, panning a `visibleCount`-row window).
6. `topologyctrl.js` — `TopologyChart`'s `pannable`/`zoomable` props (viewport transform pan/zoom -
   this phase's FIRST widget, and the one that set the "opt-in prop vs. separate component"
   precedent every later widget was judged against).
7. `raycast.js` — investigated in full and resolved as transitively out of scope for this SVG-based
   port (a canvas-rendering click hit-testing shim with no real consumer among this port's SVG
   brushes), not silently dropped - see its own entry below (its sole real consumer,
   `equalizercolumn.js`'s canvas variant, is tracked under Phase E below).
8. `zoomscroll.js` — `LineChart`'s `zoomScrollable` prop (dual-edge-resize + center-pane-pan
   control strip, backed by a real embedded thumbnail chart) - the last item, deliberately deferred
   across two prior iterations pending a real architecture decision on the thumbnail mechanism.

**`zoomselect.js` (220 lines) is the one widget in `widget/*.js` deliberately NOT tracked as its own
Phase D checklist line** - investigated as part of `zoom.js`'s own three-way zoom-widget comparison
and found to be a passive select-and-emit widget with ZERO chart-mutating effect of its own
(confirmed via a full source read: it never calls `axis.zoom()`/`chart.render()`), near-redundant
with `FocusChart`'s already-shipped `selectEvent` prop (Phase C) - both are "select a range, emit
it, let external reactivity do something with it" patterns, with `zoomselect.js`'s only genuinely
distinct value being a free-drag (pixel-based) gesture vs. `FocusChart`'s 2-click discrete-cell
picker. Deprioritized as low-value, not deferred as remaining work - see `zoom.js`'s own entry for
the full source-grep evidence.

**The widget-integration precedent this phase established, and confirmed consistently across all 8
items**: every widget was judged against the same two-question test (first articulated in
`legend.js`'s own entry, re-applied explicitly in `guideline.js`/`cross.js`'s and `zoom.js`'s) -
does it draw independent visual real estate OUTSIDE the host chart's own plot area/SVG bounds, and
does it need to read another component's config/state to do so? A widget whose effect reduces to a
pure transform/state mutation on an existing chart, with no separate visual surface, becomes an
OPT-IN PROP on that chart's existing component (`topologyctrl.js`'s `pannable`/`zoomable`;
`guideline`/`crosshair`/`zoomable`/`dragSelect`/`scrollable`/`verticalScrollable`/`zoomScrollable`
on `LineChart`) - this was true for 7 of the 8 items, since every `LineChart` widget needs LIVE
access to that chart's own already-computed axis scale/series (`useChartLayout()`/`useSeries()`),
which no sibling component could reach into without recomputing from scratch. Only `legend.js` drew
independent visual real estate with no natural "sibling brush" to introspect in this port's
per-type-component model (no shared chart instance the way upstream's plugin-registry engine has
one) - so it alone became a real standalone component (`ChartLegend`), taking an explicit `items`
prop instead of introspecting a paired chart. `zoomscroll.js`'s own embedded thumbnail is a partial
exception worth noting explicitly: it DOES draw independent visual content (a small preview chart),
but rather than becoming ANOTHER standalone top-level component like `ChartLegend`, it was built as
a chart component NESTED inside `LineChart.vue`'s own template (a small `AreaChart`/`LineChart`
instance) - because unlike `legend.js`'s key list, the thumbnail's content IS itself an ordinary
chart over data this component already owns (`props.data`), so composing an existing,
already-verified component inline was simpler than either introspecting a sibling OR building a
new bespoke rendering primitive; see that item's own entry for the full design writeup.

**This also completes the whole SVG-based port**: Phases A, B, C, and now D are all fully done -
every jui-chart/juijs-graph brush and widget that renders via SVG is ported. The only remaining
unported surface is canvas/3D rendering, tracked separately as **Phase E** below (a different
rendering architecture entirely - a second backend alongside `ChartBase`/`useChartLayout`, not more
components on top of it) - originally scoped out of this effort entirely, then promoted to a real,
tracked phase per an explicit user request to continue beyond Phase D. Phase E has not been started
(0 items checked) as of this iteration; this iteration's own scope was finishing Phase D, not
starting Phase E.

- [x] `legend.js` (324) — series color-key legend. **`extend: "chart.widget.core"`, confirmed from
      source** (matches `topologyctrl.js`'s own chain).

      **Data model, confirmed from source, and why it forced a different Vue-integration shape
      than `topologyctrl.js`'s**: `LegendWidget` never takes its own explicit label/color list -
      `getLegendIcon()`/`getBrushAll()` introspect a *sibling brush* on the same shared `chart`
      instance (`chart.get("brush", index)`, reading that brush's own `target` array for labels and
      `chart.color(i, widget.colors || brush.colors)` for colors). That's only possible because the
      original engine attaches a widget and the brush(es) it decorates to one shared chart object
      with a live `get("brush", i)` accessor - this port's chart types (`LineChart`, `BarChart`,
      `ScatterChart`, ...) are independent Vue components with **no shared chart instance a widget
      component could reach into**. So `ChartLegend.vue` was built as a genuinely separate,
      reusable component taking an explicit `items: {label, color}[]` prop instead - the caller
      (a demo page, or any consuming app) builds that list from the SAME `target`/`colors` values
      it already passes to the paired chart component, bridging the two explicitly where the
      original relied on implicit shared state. **This is the deliberate architectural precedent
      this item sets for the rest of Phase D**, completing the split `topologyctrl.js`'s own entry
      already flagged: `topologyctrl.js`'s effect reduced to one derived transform applied as a
      prop on the existing chart component (no separate visual surface); `legend.js` draws its OWN
      key/swatch list, entirely outside any chart's own SVG bounds, and (per the point above) has
      no natural "sibling brush" to introspect in this port's per-type-component model even if it
      wanted to - both properties push it to a real standalone component. Any future widget should
      be judged against this same pair of questions: does it draw independent visual real estate,
      and does it need to read another component's config/state to do so.

      **Layout, confirmed from `draw()`**: items are placed left-to-right, wrapping to a new row
      once the next item would cross the boundary (`orient: "top"/"bottom"`), or stacked in a
      single column with no wrapping at all (`orient: "left"/"right"`); the whole laid-out block is
      then positioned via `align: "start"/"center"/"end"` relative to a *chart's plot-area edge*
      (`chart.area()`/`chart.padding()`). Since a standalone `ChartLegend` has no plot area to hug,
      only its own box, this port's `orient` collapses source's four values to two -
      `"horizontal"` (source's `top`/`bottom`) and `"vertical"` (source's `left`/`right`) - with
      `align` still choosing start/center/end within the box on the wrap axis. New pure logic in
      `useLegend.ts`'s `computeLegendLayout()` ports the wrap/stack bookkeeping itself faithfully
      (including the "never wrap the first item of a row" edge case implicit in source's own `x +
      width > area.x2` check), unit-tested with 12 hand-traced cases in `useLegend.spec.ts`
      (no-wrap, wrap-every-item, align start/center/end on both orients, `hidden`-as-array vs.
      `hidden`-as-Set, and the fontSize-scaling case below). Text width is injected via a `measure`
      callback (`ChartLegend.vue` passes `measureTextWidth`, shared with `ChartTooltip.vue`/
      `RateBarChart.vue`) rather than measured inside the pure function, matching
      `tooltipMeasure.ts`'s own established "layout math is pure and testable, DOM measurement
      isn't" split.

      **One deliberate fix, not a preserved quirk** (matching `topologyctrl.js`'s own precedent for
      calling this out explicitly): source's per-item height is a hardcoded constant (`HEIGHT +
      PADDING/2 = 15.5px`) regardless of `fontSize` - a legend with a larger custom `fontSize` would
      render visibly cramped rows against source's own font metrics. This port's `itemHeight` scales
      with `fontSize` (`fontSize + LEGEND_PADDING`) instead - verified in `useLegend.spec.ts`.

      **Interaction, confirmed from source**: click-to-toggle exists ONLY in `filter: true` mode -
      `getLegendIcon()`'s click handler flips `columns[brush.index][key]`, recolors the swatch in
      place (a sliding pill `<line>` + `<circle>` knob, `x` sliding from `WIDTH` to `0`), then calls
      `changeTargetOption()`, which **rewrites the sibling brush's own `target`/`colors` arrays** to
      only the still-enabled keys, calls `chart.render()`, and emits `legend.filter`. Ported as a
      `toggleable` prop: `ChartLegend` emits `toggle: {label, index}` (it has no sibling brush to
      mutate directly) and stays a controlled component over "what's toggled off" via a `hidden:
      string[]` prop (dims the swatch/text to `legendSwitchDisableColor` - the SAME token source
      uses for its own disabled-state recolor), matching the `active`/`activeEvent`
      controlled-prop convention `LineChart`/`BarChart` already use elsewhere in this codebase.
      **Checked before assuming a new prop was needed**: `ScatterChart`/`LineChart`'s existing
      `hide` prop is a whole-chart boolean (invisible except while hovered/active), not a
      per-series toggle, so it doesn't fit here. Instead, the demo page filters the paired
      `LineChart`'s own `target: string[]` prop by the same `hidden` list - which is actually a
      closer semantic match to source's own `changeTargetOption()` (which also works by rewriting
      the brush's `target` array to the enabled subset) than inventing a new `hide`-per-series prop
      would have been.

      **One documented swatch-shape deviation**: source draws two entirely different swatch shapes
      depending on `filter` (a sliding pill/switch when `true`, a plain circle with zero click
      wiring when `false`). This port always renders a plain circle, colored normally when active
      and recolored to `legendSwitchDisableColor` (dimmed text too) when toggled off via
      `toggleable` - one shape that works whether or not toggling is enabled, and verifiable via a
      single `fill` attribute rather than a `<circle cx>` slide position. `legendSwitchCircleColor`
      (the pill's own knob-fill token, only meaningful for that unported slide visual) is dropped
      from `ChartTheme`, matching this file's established "trimmed to tokens actually used"
      convention; `legendFontColor`/`legendFontSize`/`legendSwitchDisableColor` are kept (all 3
      confirmed actually read).

      Demo: new `/legend` page (`ChartLegendPage.vue`) with 4 sections - a basic horizontal legend
      (default `align="center"`) paired with a `BarChart`, a wrapping legend (narrow `width` forces
      multiple rows), a vertical legend beside a `BarChart`, and a `toggleable` legend paired with a
      `LineChart` wiring `toggle` -> a `hiddenSeries` ref -> both `ChartLegend`'s own `hidden` prop
      and a filtered `target` array passed to `LineChart`.

      **Playwright-verified, exact-coordinate checks** (dev server + a script reading rendered
      `<circle>`/`<text>` attributes directly, not just visual): basic legend's 3 swatches all
      share `cy=8.5` (hand-computed `itemHeight/2 = (12+5)/2`, single row) and `r=6`
      (`fontSize/2`); svg auto-sizes to `height=27` (`17 + PADDING*2`) at `width=600`; `align=
      "center"` visibly offsets the block off the left edge. Wrapping legend (6 items, `width=220`)
      produces exactly 3 rows at `cy` values `8.5/25.5/42.5` (17px apart, matching `itemHeight`).
      Vertical legend (3 items, `height=400`, `align="center"`) shares one `cx=6` column with the
      first item's `cy` exactly matching the hand-derived `floor((400-51)/2) + 17/2 = 182.5`, each
      subsequent item exactly 17px below. Click-to-toggle: before any click, `LineChart` renders 18
      point markers (6 rows x 3 targets - `showPoints`); clicking the `refunds` legend item sets
      `data-legend-active="false"`, recolors its swatch to exactly `#c8c8c8`
      (`legendSwitchDisableColor`), updates the page's own hidden-series readout, AND drops
      `LineChart` to exactly 12 point markers (6 rows x 2 remaining targets - `refunds` fully
      removed via the filtered `target` array, not just dimmed); clicking it again restores all 18.
      A non-toggleable legend's item was clicked and confirmed to leave its swatch `fill`
      byte-for-byte unchanged (toggling correctly gated behind the `toggleable` prop). Zero
      console/page errors throughout. `npm run test` (376/376 passing, +12 new `useLegend` cases),
      `npm run build:lib`, `npm run build` all clean with no type errors.

      Exported `ChartLegend.vue` and `useLegend.ts`'s public functions/types from `src/index.ts`.
      README.md updated: new `ChartLegend` bullet in "Components", new `useLegend` bullet in
      "Composables", Phase D's `legend.js` line and the top summary/Scope paragraph marked done.
- [x] `guideline.js` (256) / `cross.js` (164) — hover guide + crosshair. **Both read in full
      before writing anything, per this item's own task brief to check their overlap first -
      `extend: "chart.widget.core"` for both, confirmed from source (matches `topologyctrl.js`'s/
      `legend.js`'s own chain).**

      **Overlap finding, confirmed from source, NOT a redundant pair - both checklist lines are
      checked off because BOTH are fully ported, not because one subsumed the other**:
      `guideline.js` SNAPS a single vertical line to the NEAREST DATA ROW along x
      (`Math.floor((time - domain[0]) / (domainRange / data.length))`, then `axis.x(index)`) and
      pairs it with a rich per-series content tooltip (`brush.target.forEach(...)`, one colored dot
      + `"key: value"` line per target, positioned at each target's own y at that row -
      `stackPoint` sums cumulatively for a stacked overlay). It only ever draws an x-axis line.
      `cross.js` tracks the RAW, un-snapped pointer position on either/both axes independently
      (`xline`/`yline`, each gated by whether `xFormat`/`yFormat` is set) and pairs each line with
      a single plain axis-value-readout balloon (`axis.x.invert(e.chartX)`/`axis.y.invert(e.chartY)`)
      - no per-series tooltip, no snapping at all, no `brush`/`target` concept. Genuinely different
      interaction models (discrete row-snap + full-row readout vs. continuous position + single
      axis-value readout), not `guideline.js` with both axes forced on - a `cross.js` line's
      existence/format has nothing to do with row data at all.

      **Vue integration decision**: both ported as opt-in props on `LineChart.vue` itself
      (`guideline: boolean`, `crosshair: boolean | "x" | "y" | "both"`), matching
      `topologyctrl.js`'s "opt-in prop" precedent rather than `legend.js`'s "separate component"
      one - confirmed by applying `legend.js`'s own two-question test (does it draw independent
      visual real estate outside the host chart's own bounds, and does it need another component's
      config/state to do so): both DO draw new visual marks (a line, a tooltip), unlike
      `topologyctrl.js` - but that visual surface lives entirely WITHIN this chart's own plot
      area/SVG bounds (the same overlay layer `ChartTooltip`'s existing hover/`display` balloons
      already use), never outside it like `legend.js`'s standalone key list. And critically, both
      need LIVE access to THIS chart's own already-computed axis scale/series
      (`axis.x.invert()`/`axis.y.invert()`, row pixel positions) - there's no sibling chart
      instance a standalone component could reach into without duplicating this file's own
      `useChartLayout()`/`useSeries()` call from scratch, the same reason `topologyctrl.js`'s
      pan/zoom became `TopologyChart` props instead of a wrapper component. Scoped to `LineChart`
      only this iteration (not `ScatterChart`/`BarChart`) - `guideline`'s rich per-series tooltip
      in particular is a natural fit for a multi-series line chart; a generic version for other
      axis-based chart types is a reasonable future item but out of scope here.

      **Snapping/positioning, deliberately NOT a literal port of `guideline.js`'s own math**:
      `guideline.js`'s domain/interval snap (`Math.floor((time - domain[0]) / (domainRange /
      data.length))`) assumes a `range`-type (numeric) x axis with rows evenly spaced across it -
      this port's x axis is at least as often `block`-type (categorical), where that formula
      doesn't apply. `nearestIndexByPosition()` (new `useHoverGuide.ts`) snaps directly off each
      row's own ALREADY-RENDERED x pixel (`series.value[0].x`, since every target shares the same
      per-row x position whenever x is `block`-type - see `useSeries.ts`'s own doc comment)
      instead, which works identically for either axis type, generalizing the original rather than
      special-casing it. `cross.js`'s `axis.x.invert()`/`axis.y.invert()` readout is ported as-is
      via `invertAxisValue()` (same file), with one addition: `OrdinalScale.invert()` (a `block`
      axis - see `useScale.ts`) has no upper clamp of its own (it can run past the last tick beyond
      the axis's far edge), so `invertAxisValue()` clamps into the valid tick range before mapping
      back to a label - `cross.js` has no equivalent guard since its own `axis.x`/`axis.y` are
      always `range`-type in the original engine's crosshair usage. Both hand-traced in
      `useHoverGuide.spec.ts` (16 new tests: `toSvgPoint`'s client-to-SVG-space mapping incl. the
      `max-width: 100%` shrink case, `clamp`, `nearestIndexByPosition` incl. the empty-array `-1`
      case, `invertAxisValue` for both a `block` axis, including its clamp-past-the-last-tick case,
      and a `range` axis).

      **Reused rather than re-ported**: both original widgets draw their own tooltip box/balloon
      from scratch with their own `guidelineTooltip*`/`crossBalloon*` theme tokens (11 tokens
      total upstream). This port reuses the EXISTING `ChartTooltip.vue` component (already used for
      `LineChart`'s hover/`display` tooltips) for both instead - `guideline`'s content box is a
      `ChartTooltip` with one `{key, value}` item per target (reusing the existing `format` prop,
      no new `tooltipFormat` callback prop needed); `crosshair`'s readout is a `ChartTooltip` with
      a single unkeyed value per axis. Only the LINE/POINT-MARKER tokens are newly ported
      (`guidelineBorder(Color|Width|Opacity|DashArray)`, `guidelinePoint(Radius|BorderColor|
      BorderWidth)`, `crossBorder(Color|Width|Opacity)` - 10 tokens, added to `ChartTheme`/
      `classicTheme` in `useTheme.ts`; confirmed identical between `classic.js`/`dark.js` upstream
      for all 10, so no `darkTheme` override needed, matching this file's "leave out of `darkTheme`
      spread if unchanged" convention). The `guidelineTooltip*`/`crossBalloon*` tokens are
      deliberately NOT ported - redundant with the existing `tooltip*` tokens `ChartTooltip`
      already reads, documented deviation for consistency rather than a second, near-identical
      token set. One further simplification: `guideline.js`'s separate under-axis x-value balloon
      (`xTooltip`, distinct from its content tooltip) is dropped - the content tooltip already
      carries every target's value at the snapped row, and the x position/category is already
      visible via the existing bottom-axis tick labels for a `block` x axis.

      **One bug found and fixed while building this, not a preserved quirk**: `ChartTooltip.vue`'s
      root `<g>` had no `pointer-events` of its own (default `auto`). Every EXISTING caller
      anchors it near a small point/bar that's the actual mouse target, so this never mattered -
      but `guideline`/`crosshair`'s own tooltip can render directly UNDER the still-hovering
      pointer (its balloon tracks the same wide hover area it's triggered from). Without a fix,
      the balloon's own `<text>`/`<rect>` becomes the topmost hit-test target at that pixel,
      firing a native `mouseleave` on the hover-tracking element underneath even though the
      pointer never physically moved - a self-covering flicker loop (tooltip appears -> covers
      cursor -> "leave" fires -> tooltip disappears -> repeat), confirmed via Playwright's
      `document.elementFromPoint()`/a `relatedTarget` dump showing the spurious `mouseleave`
      resolved to the tooltip's own `<text>`. Fixed by adding `pointer-events: none` to
      `ChartTooltip.vue`'s root `<g>` (harmless for every other caller - a value readout has no
      interactive content of its own to lose).

      Demo: two new sections on the existing `/line` page (`LinePage.vue`) - `guideline` (paired
      with the page's existing monthly visits/signups data) and `crosshair` (same data,
      `crosshairYFormat` rounds the continuous y-axis readout to the nearest integer for a clean
      exact-value Playwright check).

      **Playwright-verified, exact-coordinate checks** (dev server + a script reading rendered
      `<line>`/`<text>` attributes directly, hand-derived against the page's own rendered tick
      positions): `guideline` hovered near x=185 (between Feb's tick at x=180 and Mar's at x=268)
      snaps to exactly `x1=x2=180` (Feb, the nearer tick) with tooltip text exactly `["visits:
      132", "signups: 45"]` (Feb's raw row values) and exactly 2 point-marker circles
      (`r=3`/`guidelinePointRadius`, distinct from the unrelated `showPoints` circles at `r=5`);
      moving the mouse off the plot entirely drops the guideline `<line>` count to exactly 0.
      `crosshair` hovered at raw pixel (500, 300) (deliberately NOT aligned to any row) produces a
      vertical line at exactly `x1=x2=500` and a horizontal line at exactly `y1=y2=300`, with
      readout balloons reading exactly `"Jun"` (`invertAxisValue` on the `block` x axis, hand-
      derived: `floor(|500-48|/88)=5` -> `ticks[5]`) and `"40"` (`invertAxisValue` on the `range` y
      axis, hand-derived: `(300-368)/(20-368) * 205 ≈ 40.06`, rounded by the demo's
      `crosshairYFormat`); moving off the plot drops both crosshair `<line>`s to 0. A regression
      check confirmed the existing point-hover tooltip (an unrelated `LineChart` demo elsewhere on
      the page) still renders and clears correctly after the `ChartTooltip` `pointer-events: none`
      fix. Zero console/page errors across the full `/line` page. `npm run test` (392/392 passing,
      +16 new `useHoverGuide` cases), `npm run build:lib`, `npm run build` all clean with no type
      errors.

      Exported `useHoverGuide.ts`'s public functions/types from `src/index.ts`. README.md updated:
      `LineChart`'s own bullet notes `guideline`/`crosshair`, new `useHoverGuide` bullet in
      "Composables".
- [x] `zoom.js` (296) — `LineChart`'s `zoomable` prop. **All three zoom widgets read in full before
      writing anything, per this item's own task brief** (`zoom.js` 296, `zoomscroll.js` 294,
      `zoomselect.js` 220 lines) - confirmed they are three genuinely INDEPENDENT triggers, not a
      shared base beyond `extend: "chart.widget.core"` (same chain as `topologyctrl.js`/
      `guideline.js`/`cross.js`, confirmed from source for all three): `zoom.js` is a drag-a-
      rectangle-over-the-plot-area gesture; `zoomscroll.js` (**source-confirmed the name is
      misleading - no `wheel`/`mousewheel` listener anywhere in the file**) is a persistent
      scrollbar/brush control BELOW the chart, with left/right resize handles and a draggable
      center pane, rendering an embedded thumbnail chart (`createChartImage()` calls
      `chart.builder` to build a whole SEPARATE chart instance and serializes it to a
      `data:image/svg+xml` `<image>` - this port has no equivalent "build a standalone sub-chart to
      an image data-URI" mechanism at all, a real architectural gap, not just missing code);
      `zoomselect.js` is structurally near-identical to `zoom.js` (same drag-rectangle + close-icon
      UI, same `axis.mousedown`/`mousemove`/`mouseup` wiring) but its `endZoomAction()`/
      `renderChart()`/`rollbackZoom()` never call `axis.zoom()`/`axis.updateGrid()`/`chart.render()`
      anywhere - confirmed via a full read that it ONLY updates its own overlay's visibility/size
      and emits `"zoomselect.end"`/`"zoomselect.close"` with the computed `{start,end}` (or
      `{stime,etime}`) indices - a passive select-and-notify widget with zero chart-mutating effect
      of its own, not a zoom widget in the same sense as the other two despite the name/file-group.

      **Real (domain-rescaling) vs. transform-based, confirmed by tracing into the engine, not
      assumed**: `zoom.js`'s drag gesture calls `axis.zoom(start, end)` for a `"block"` x-axis (the
      `updateDateObj()` branch, gated on a `"date"`/`"dateblock"` x type, is dead for this port -
      see below) - traced through `juijs-graph/src/base/axis.js`'s `zoom()` -> `setZoom()`
      (`self.data = self.origin.slice(start, end)`) and `grid/core.js`'s `this.data()` helper
      (confirmed it reads `this.axis.data`, NOT `this.axis.origin` - i.e. every grid's own
      `initDomain()`, both `grid/block.js`'s and `grid/range.js`'s, recomputes its domain from the
      CURRENTLY WINDOWED array on every render). So a real zoom narrows BOTH axes' domains (the
      x-axis's category list AND any "range" axis's min/max), not merely the visible pixel range -
      genuinely different from `topologyctrl.js`'s pan/zoom (a pure `scale()`/`translate()` SVG
      transform over already-rendered marks, no domain change at all - see `useTopologyZoom.ts`'s
      header comment). This made integration MUCH simpler than initially budgeted for: this port's
      `useAxis`/`useChartLayout`/`useSeries` already take a reactive `data: Ref<DataRow[]>` and
      recompute everything from it - so the entire mechanism is "slice `props.data` by row index,
      feed the slice into the SAME `useChartLayout()`/`useSeries()` calls `LineChart.vue` already
      makes" (`windowedData`, a new computed in `LineChart.vue`, replaces the plain `dataRef` used
      everywhere it used to be, including the template's own `ChartBase :data` binding so the axis
      chrome and the series marks never disagree). Zero new axis/scale primitives were needed - only
      the pure slice/clamp math (`useZoomWindow.ts`'s `computeDragZoomWindow`/`clampZoomWindow`,
      ported from `updateBlockGrid()`/`setZoom()`'s own two-step clamp split).

      **Scope decision, confirmed from source before writing anything**: only `zoom.js` is ported
      this iteration. `zoomscroll.js` needs an embedded-thumbnail-chart mechanism this port doesn't
      have (a real, nontrivial piece of new infrastructure, not just more widget code) plus a
      dual-handle scrollbar UI - clearly the larger of the two real-zoom widgets, and `zoom.js`'s
      `axis.zoom()` call is the more foundational mechanism (`zoomscroll.js`'s own `endZoomAction()`
      calls the exact same `axis.zoom(start, end)`, just from a different UI trigger - so this
      port's `useZoomWindow.ts` clamp/apply logic is already the right building block for a future
      `zoomscroll.js` port, only the drag-to-window-index math and the thumbnail-chart rendering
      would be new). `zoomselect.js` was deliberately skipped as LOW VALUE, not merely deferred for
      size: since it has no chart-mutating effect of its own, it's functionally close to
      `FocusChart`'s already-shipped `selectEvent` prop (Phase C's `focus.js` - see that entry) -
      both are "select a range, emit it, let external Vue reactivity do something with it" patterns;
      `zoomselect.js`'s only genuinely distinct value is its free-drag (pixel-based) gesture vs.
      `FocusChart`'s 2-click discrete-cell picker, a real but narrow difference not judged worth a
      fourth interaction pattern on `LineChart` this iteration.

      **Confirmed disjoint from `focus.js`, not a hidden pairing** (re-confirmed now that all three
      zoom widgets have actually been read, closing the loop `focus.js`'s own PORT_STATUS.md entry
      left open): none of `zoom.js`/`zoomscroll.js`/`zoomselect.js` ever looks up a brush by type
      `"focus"` or writes to a brush's `start`/`end` config fields: `zoom.js`/`zoomscroll.js` call
      `axis.zoom()` (a totally different mechanism, actual data-windowing vs. `focus.js`'s pure
      `start`/`end` config-index rectangle overlay), and `zoomselect.js` only ever emits its own
      events. Still zero `jui-chart/examples/*.html` matches for `"focus"` (re-grepped). `focus.js`
      and this iteration's `zoomable` prop remain fully independent features in both the original
      and this port.

      **Vue integration decision**: `zoomable` is an opt-in `boolean` prop on `LineChart.vue`
      itself, same reasoning as `guideline`/`crosshair`/`topologyctrl.js` before it (live access to
      this chart's own `axisX`/`area`/`windowedData` needed - no sibling component could reach in
      without duplicating this file's own `useChartLayout()`/`useSeries()` calls). Only meaningful
      when `axisX.type === "block"` (silently a no-op otherwise) - confirmed from source:
      `updateBlockGrid()`'s branch is the only one that applies to this port, since the other
      branch needs a `"date"`/`"dateblock"` x-axis type, which doesn't exist anywhere in this port
      (`useAxis.ts`'s `AxisConfig['type']` is only ever `'block' | 'range'` - same conclusion
      `focus.js`'s/`cross.js`'s own entries already reached for the same reason).

      **A real bug found and fixed while building this, a NEW instance of the exact class of z-order/
      `pointer-events` issue `guideline`/`cross`'s own entry flagged as likely to recur with other
      overlay-drawing widgets**: the drag hit-rect is the SAME element `guideline`/`crosshair` use
      (kept below the line paths/point markers in z-order so hovering a line/point still fires ITS
      OWN hover behavior, not swallowed by the rect - see that entry). Initially, `zoomable`'s drag
      was finalized on the rect's own `mouseleave` too (mirroring `zoom.js`'s `bg.mouseout ->
      endZoomAction()`). Playwright caught this immediately: a drag toward the far edge would
      terminate early and produce a much narrower window than dragged, because a native
      `mouseleave` fires on the rect the instant the pointer's hit-test target changes to a
      DIFFERENT element painted on top of it (a line's invisible 16px stroke-hit corridor, or a
      `showPoints` circle) - not only when the pointer geometrically leaves the plot area. Fixed by
      dropping the "finalize on mouseleave" behavior entirely for `zoomable` (kept only for clearing
      `guideline`/`crosshair` hover state) - finalization now relies solely on a `window`-level
      `mouseup` listener (added on drag-start, removed on finalize/unmount), which computes the
      final pixel position directly from the mouseup event's own `clientX` (target-independent), so
      it's correct regardless of which element the pointer happens to be over when the button is
      released. This is architecturally closer to source anyway: `zoom.js`'s own drag tracking is
      wired to `axis.mousedown`/`axis.mousemove`/`axis.mouseup` - core AXIS-level events sourced
      from the engine's own always-on-top interaction layer, not per-element DOM listeners on
      whatever happens to be topmost - so source never had this failure mode to begin with.

      **New theme tokens**: `zoomBackgroundColor`/`zoomFocusColor` (both confirmed actually read
      from `drawSection()` - the drag-thumb fill and the reset-icon fill respectively), added to
      `useTheme.ts`'s `ChartTheme`. Identical across all 4 theme files upstream (classic/dark/
      pattern/gradient), so `darkTheme` doesn't override either (same convention as `focus*`/
      `guideline*`/`cross*`). The 11 `zoomScroll*` tokens (`zoomscroll.js`-only) are deliberately
      NOT ported this iteration.

      Demo: new "zoomable" section on the existing `/line` page (`LinePage.vue`), reusing the same
      6-month `visits`/`signups` dataset and exact geometry (`width=600`, default padding =>
      `area.x=48`, `area.x2=576`, `area.width=528`, band=88 for 6 rows) already established by the
      `guideline`/`crosshair` demos, so the drag coordinates are hand-traceable against the SAME
      already-verified tick positions. `@zoom` event wired to a `data-testid="last-zoom-event"`
      readout.

      **Playwright-verified, exact-coordinate checks** (dev server + a script driving real
      `mouse.down()`/`mouse.move()`/`mouse.up()` sequences, reading rendered `<text>` tick labels
      and the `zoom-thumb`/`zoom-reset` elements' own attributes directly - NODE_PATH-borrowed
      `playwright` from `../jui-grid-vue/node_modules` since this package has no local `playwright`
      devDependency): dragging from SVG x=136 to x=400 (hand-traced: `tick=528/6=88`,
      `lo=136-48=88`, `hi=400-48=352`, `start=floor(88/88)+0=1`, `end=ceil(352/88)+0=4`) produced a
      live thumb rect at exactly `x=136 width=264` mid-drag, then on release the x-axis ticks
      changed to exactly `["Feb","Mar","Apr"]` (from the full `["Jan".."Jun"]`) and the y-axis ticks
      re-derived to a narrower nice-domain (`["0","32","64","96","128","160"]`, down from
      `["0","41","82","123","164","205"]`) - confirming a REAL domain rescale on BOTH axes, not a
      visual crop - with the reset icon appearing and the `@zoom` readout reading exactly
      `[1, 4)`. A second, NESTED drag on that already-zoomed 3-row view (band now `528/3=176`, local
      x=224->400, hand-traced: `start=floor(176/176)+1=2`, `end=ceil(352/176)+1=3`) narrowed further
      to exactly `["Mar"]` with y-ticks `["19","38","57","76","95","114"]` and `@zoom` reading
      `[2, 3)`, confirming the `currentStart` composition math. Clicking the reset icon restored the
      full `["Jan".."Jun"]` ticks, the original `["0","41","82","123","164","205"]` y-domain, hid the
      reset icon, and the `@zoom` readout read "none". A plain click (mousedown+mouseup with zero
      movement) produced no zoom at all (degenerate-drag rejection confirmed). A regression check
      confirmed the separate `guideline` demo section on the same page still renders lines while
      hovering (unaffected by the `mouseleave` fix), and that a `showPoints` circle's own hover
      tooltip still fires normally when `zoomable` is on but idle. Zero console/page errors across
      the whole `/line` page. `npm run test` (404/404 passing, +12 new `useZoomWindow` cases),
      `npm run build:lib`, `npm run build` all clean with no type errors.

      Exported `useZoomWindow.ts`'s public functions/types from `src/index.ts` (matching
      `useHoverGuide.ts`/`useTopologyZoom.ts`'s precedent). Added `zoomBackgroundColor`/
      `zoomFocusColor` to `useTheme.ts`. README.md updated: `LineChart`'s own bullet notes
      `zoomable`, new `useZoomWindow` bullet in "Composables", "Scope" section updated to record
      `zoom.js` done and `zoomscroll.js`/`zoomselect.js` as the remaining zoom widgets, and a new
      "What wasn't validated" note (no real `zoom.js` example exists upstream - the one zoom-related
      example, `examples/zoom_scroll_bigdata.html`, uses the unported `zoomscroll.js` instead).

      **Remaining work, deliberately NOT started this iteration (see scope decision above)**:
      - `zoomscroll.js` (294) - needs (1) an embedded-thumbnail-chart rendering mechanism (this
        port has nothing like `chart.builder`'s "build a whole separate chart, serialize to an
        image" trick - the natural Vue equivalent is probably just nesting a second, small
        `LineChart`/`AreaChart` instance directly as inline SVG instead of an `<image>` data-URI,
        but that's a real design decision, not yet made), and (2) a dual-handle + center-pane
        scrollbar UI below the chart. Its own `axis.zoom(start, end)` call at drag-end is already
        covered by this iteration's `useZoomWindow.ts` (`clampZoomWindow` in particular - it clamps
        against `count = axis.origin.length` exactly like `zoomscroll.js`'s own `count` variable).
      - `zoomselect.js` (220) - low priority (see scope decision above): a passive select-and-emit
        widget nearly redundant with `FocusChart`'s existing `selectEvent` prop. If ever ported, the
        UI (drag-rectangle + close icon) is structurally identical to `zoom.js`'s own - could likely
        reuse `zoomThumb`/the reset-icon markup this iteration added to `LineChart.vue` nearly as-is,
        swapping only the "apply" step for "just emit."
- [x] `zoomscroll.js` (294) — `LineChart`'s `zoomScrollable`/`zoomScrollKey`/`zoomScrollSymbol`/
      `zoomScrollColor` props. **The final Phase D item, deliberately deferred across the two prior
      iterations that ported `zoom.js` and `scroll.js`/`vscroll.js` pending a real architecture
      decision (see those entries above for the groundwork) - read in full a SECOND time this
      iteration, per this item's own task brief not to trust the prior analysis alone.** `extend:
      "chart.widget.core"`, confirmed from source - same chain as every other Phase D widget.

      **Three interaction zones, confirmed from `setDragEvent()`/`dragZoomAction()` - exact math,
      not assumed**: two independent EDGE-RESIZE handles (`l_ctrl`/`r_ctrl`) and a CENTER-PANE drag
      (`c_rect`). Dragging the LEFT handle keeps `end` FIXED and recomputes `start = Math.floor(tw /
      tick)` from the handle's new pixel width `tw = bgWidth + dis` (`bgWidth` the left region's
      width captured once at `mousedown`, `dis` the CUMULATIVE `clientX` delta since - not a
      per-tick incremental delta); dragging the RIGHT handle keeps `start` FIXED and recomputes `end
      = count - Math.floor(tw / tick)` from `tw = bgWidth - dis`. Both are gated by
      `preventDragAction()`, which blocks the handles from crossing (checked against the OTHER
      side's current width, with a `tick / 2` slop) - but only in the "closing" direction. The
      CENTER pane (`isCenter` branch) captures its own fixed pixel width once at `mousedown` and
      pans: `tw = centerStart + dis` applied only if `tw > 0 && tw + bgWidth < w`, with `start`/`end`
      both shifting by the SAME delta (`val = Math.floor(tw / tick) - start`) - confirmed, per the
      `scroll.js`/`vscroll.js` entry's own finding, to be structurally the exact same fixed-width-pan
      math `useScrollWindow.ts`'s `computeScrollStart` already implements, just reached via a
      user-resized pane instead of a fixed `visibleCount` ratio. All three converge, on `mouseup`
      (`endZoomAction()`), on the IDENTICAL `axis.zoom(start, end)` call `zoom.js`'s own entry already
      traced into `setZoom()`/`grid/core.js`'s `this.data()` - a REAL domain-rescaling zoom, reusing
      `useZoomWindow.ts`'s `clampZoomWindow` as the final commit step (confirmed to already clamp
      against `originLength` exactly like `zoomscroll.js`'s own `count = axis.origin.length`).

      **Live-chrome-vs-committed-window split, confirmed from source, not invented for this port**:
      `dragZoomAction()` (every `mousemove` tick) only redraws the widget's own SVG rects/handles and
      updates local tracking variables - it NEVER calls `axis.zoom()` itself. Only `endZoomAction()`
      (`mouseup`) applies the accumulated `start`/`end` and re-renders. So, like `zoom.js`'s own
      drag-thumb, only the widget's own chrome needs to update on every tick - the full chart only
      recomputes once, on release. This is closer to `zoom.js`'s/`dragselect.js`'s "resolve-on-
      release" shape than to `scroll.js`'s "continuous commit" one, despite the surface resemblance
      to a scrollbar - a finding that simplified the Vue port considerably versus what was budgeted.

      **Deliberate simplification over source's own crossing-guard mechanism, not a behavior
      change**: rather than porting `preventDragAction()`'s literal "read back the last-rendered DOM
      width, reject the whole tick (freeze) if crossing" mechanism (this port has no equivalent
      "last-rendered imperative geometry" memory to read back from), `computeLeftEdgeWidth`/
      `computeRightEdgeWidth`/`computeCenterPanLeftWidth` (new `useZoomScroll.ts`) HARD-CLAMP the
      live pixel width to the same crossing boundary instead. Since the dragged width is always
      recomputed from a FIXED `mousedown`-anchor each tick (never incrementally from the previous
      tick, confirmed from source), a clamp and a freeze-at-the-boundary converge to the exact same
      rendered value once the boundary is first reached, and both un-clamp identically once the
      pointer moves back past it - verified equivalent by hand-tracing both against the same drag
      sequence in `useZoomScroll.spec.ts` (including a dedicated "un-clamps immediately, not sticky"
      case) and confirmed live via Playwright (see below).

      **The embedded thumbnail (`createChartImage()`), the item's real remaining blocker from the
      prior two iterations - resolved with the design decision below**: source builds a WHOLE
      SEPARATE `chart.builder()` instance over `axis.origin` (the FULL, un-windowed dataset, NOT the
      currently zoomed/windowed one) for a SINGLE target (`widget.key`), serializes it to a
      `data:image/svg+xml;utf8,...` string, and renders it as an `<image>` sized to the widget's own
      track, BEHIND the resize/pan chrome. **Confirmed genuinely load-bearing for usability, not
      merely decorative**: without it, the resize/pan chrome has ZERO visual reference to the data's
      own shape - unlike `zoomable`'s live thumb (which at least previews against the ALREADY-VISIBLE
      chart underneath it), `zoomscroll` is designed to sit as a persistent control strip BELOW a
      chart that may itself already be a narrower zoomed/scrolled view, so a user resizing/panning
      the window would otherwise be doing so blind.

      **Design decision (this iteration's real work): Option 1, a full faithful port, built as a
      real embedded small chart component rather than source's own SVG-to-`<image>` trick.** Three
      paths were on the table (full faithful port with a real nested chart; a scoped port skipping
      the thumbnail; or finding it redundant with existing props). The third was ruled out
      immediately - the edge-resize behavior is genuinely new (not covered by `zoom.js`'s
      any-rectangle drag or `scroll.js`'s fixed-width thumb), so this is not a `zoomselect.js`-style
      redundancy call. Between the other two, the full port was chosen: this port has no
      `chart.builder()`-equivalent "build and serialize a whole separate chart to an image"
      mechanism, but it doesn't need one - SVG natively supports a NESTED `<svg>` viewport, so
      `LineChart.vue`'s template just nests a small `AreaChart` (`zoomScrollSymbol="area"`, the
      default, matching source's own `symbol: "area"` default) or `LineChart` (`"line"`, via Vue
      3.2+'s automatic `<script setup>` recursive self-reference - no explicit import needed) sized
      to the track, `pointer-events: none`, showing `props.data` (the full, un-windowed prop - never
      `windowedData`) for `zoomScrollKey` (defaults to `target[0]`). This is LESS work than inventing
      a serialize-to-image mechanism would have been, not a shortcut - confirmed by actually building
      it: no new rendering primitive was needed, only wiring an existing component into a translated
      `<g>`. This is a natural extension of this port's own precedent from `legend.js`'s entry
      (`ChartLegend` became a standalone component rather than introspecting a shared chart instance)
      - here the "component" is nested rather than standalone, but the underlying principle is the
      same: compose an existing, already-verified chart component rather than reach into another
      chart's internals or replicate a serialization trick this port's architecture doesn't need.

      **One genuinely additive infrastructure change, needed for the thumbnail's suppressed y-axis,
      not scope creep**: `AxisConfig` gained a new `hide?: boolean` field (`types.ts`), resolved in
      `useAxis.ts`'s `AxisResult` (default `false`, matching source's own `hide` option), and gated
      in `ChartBase.vue`'s x/y baseline + tick-label rendering (wrapped in `<template v-if>`, not
      `v-if`+`v-for` on the same element - Vue 3's `v-if`/`v-for` precedence-on-one-node ambiguity).
      No existing demo needed to suppress an axis's chrome before this, so it was never plumbed
      through - a small, surgical, purely additive change (default `false` preserves every existing
      chart's behavior unchanged, confirmed via the full 27-page Playwright sweep below finding zero
      regressions). The thumbnail's x-axis is forced `hide: false` (always shows its tick labels,
      inheriting `type`/`domain`/`orient`/`line` as-is from `props.axisX`); its y-axis is forced
      `hide: true, line: false` unconditionally (the track is too short for a meaningful y scale).
      **One documented merge-semantics simplification**: source's own `_.extend(defaults,
      axis.get("x"), true)` lets the HOST's already-resolved x-axis object override the forced
      `hide:false`/`line:"solid"` defaults for any key it defines (so upstream's own thumbnail x-axis
      chrome isn't unconditionally force-visible either, depending on the host's config) - this port
      always forces `hide: false` on the thumbnail's x-axis instead, a simpler and more predictable
      rule for a component library than replicating that upstream precedence quirk. No tick-label
      `format` callback (`widget.format`'s equivalent) is threaded through - `ChartBase.vue` has no
      chart-wide axis tick-format mechanism anywhere yet, not just for this widget, so there's no
      existing hook to plug one into without a larger, unrelated infrastructure change; ticks render
      raw, same as every other chart in this port.

      **Shares `zoomable`'s own `zoomWindow` ref, not a parallel state**: both widgets ultimately
      compute a `{start, end}` row window fed into the identical `windowedData.slice()` - confirmed
      the right design from the `scroll.js`/`vscroll.js` entry's own finding that `zoomscroll.js`'s
      `endZoomAction()` calls the exact same `axis.zoom()` endpoint. `zoomScrollActive` requires
      `!props.zoomable` - `zoomable` takes precedence if both are enabled, the same documented,
      low-stakes tie-break `dragSelect`/`scrollable` already established for this pair-of-widgets
      pattern. Only meaningful for a `"block"` x-axis (silently a no-op otherwise), same constraint/
      reasoning as `zoomable` (the widget's own `tick = w / count` geometry assumes evenly-index-
      spaced rows, the same assumption `computeDragZoomWindow` makes).

      **Reused rather than duplicated**: found, while implementing the dimmed-zone rounded-rect
      corners, that `useSeries.ts` already exports a `roundedRectPath()` helper (built for
      `RateBarChart`/`BarChart`'s own rounded segments, ported from `svg.pathRect().round()`) with
      the EXACT shape this widget needs (4 independent per-corner radii) - reused directly rather
      than duplicated (the build even caught this via a real `TS2308` duplicate-export error on the
      first `npm run build:lib`, which is what surfaced the existing helper). That shared function is
      deliberately left un-clamped (no existing `BarChart`/`RateBarChart` caller needs a radius clamp,
      and changing its numeric output wasn't worth risking an unrelated, already-Playwright-verified
      regression) - instead, a new `clampCornerRadius()` in `useZoomScroll.ts` clamps the radius
      locally before each call, since `zoomscroll`'s own dimmed zones (unlike any bar) can legitimately
      shrink to just a few pixels wide mid-drag.

      **New theme tokens**: all 11 `zoomScroll*` tokens (`zoomScrollBackgroundSize`/
      `zoomScrollButtonSize`/`zoomScrollAreaBackgroundColor`/`zoomScrollAreaBackgroundOpacity`/
      `zoomScrollAreaBorderColor`/`zoomScrollAreaBorderWidth`/`zoomScrollAreaBorderRadius`/
      `zoomScrollGridFontSize`/`zoomScrollGridTickPadding`/`zoomScrollBrushAreaBackgroundOpacity`/
      `zoomScrollBrushLineBorderWidth`, all confirmed actually read from `drawBefore()`/`draw()`/
      `createChartImage()`), already flagged as deliberately deferred in `zoom.js`'s own entry, now
      added to `useTheme.ts`. Identical across all 4 theme files upstream (re-confirmed via grep), so
      `darkTheme` doesn't override any (same convention as `zoom*`/`dragSelect*`). The handle-button
      fill (`#e0e0e0`)/stroke (`#616161`) are hardcoded literals in source itself (no token governs
      them) - kept as literals in `LineChart.vue` rather than invented as new tokens, matching source
      exactly. **Not ported**: `widget.dx`/`dy` position offsets (this port has no consumer/demo
      needing a non-default widget position - dropped as a deliberate, disclosed simplification,
      matching this file's "trimmed to what's actually used" convention).

      Demo: new "zoomScrollable" section on `/line` (`LinePage.vue`), reusing the same 6-row
      dataset/`width=600` geometry already established by every other `/line` drag-interaction demo
      (`area.x=48, area.x2=576`, track width after the 1px border = `526`, `count=6` rows -> `tick =
      526/6 = 87.6667` - deliberately NOT a round number like the `useScrollWindow.spec.ts`
      contrived example, which made this item's own hand-traced Playwright checks a genuine,
      non-cherry-picked exercise of the floor-division math), extra bottom padding for the widget's
      own 45px track plus its thumbnail's tick labels underneath. `@zoomscroll` wired to a
      `data-testid="last-zoomscroll-event"` readout.

      **Playwright-verified, exact-coordinate checks** (dev server + a script driving real
      `mouse.down()`/`mouse.move()`/`mouse.up()` sequences, reading rendered attributes directly -
      NODE_PATH-borrowed `playwright` from `../jui-grid-vue/node_modules`, same as every other Phase
      D drag widget): initial (unzoomed) geometry confirmed exactly - widget group `transform=
      "translate(48, 309)"` (`area.x`, `area.y2 - b`), left handle at `x=-9`, right handle at
      `x=517`, center pane `x=0 width=526` (full track); exactly one nested thumbnail `<svg>` renders
      with a stroked line/area path (the full 6-row `visits` series, unwindowed - confirmed
      independently of the main chart's own, separately-windowed rendering above it). Dragging the
      LEFT handle by a cumulative `+100px` produced `start = floor(100 / 87.6667) = 1` with `end`
      unchanged at `6` (readout `[1, 6)`), and the handle's RESTING position after commit snapped to
      the tick-derived `x = 1*87.6667 - 9 = 78.667` (not the raw drag pixel `100-9` - confirming the
      drag snaps to the nearest committed tick boundary on release, not an arbitrary pixel).
      Following with a RIGHT-handle drag of cumulative `-100px` (narrowing from the right, using the
      already-nonzero committed `start=1`) produced `end = 6 - floor(100/87.6667) = 5` (readout `[1,
      5)`); a SECOND right-handle drag of `-300px` (this time against a nonzero resting `rightWidth`
      from the first) produced `tw = 87.6667 - (-300) = 387.6667` and `end = 6 - floor(387.6667 /
      87.6667) = 2` (readout `[1, 2)`) - both hand-derivations independently cross-checked against
      the live DOM before commit. A CENTER-PANE drag of `+150px` (deliberately NOT an exact
      tick-multiple, which is float-precision-fragile for ANY floor-division scrollbar including
      this one - same reasoning `useScrollWindow.ts`'s own `+1` edge-correction test targets a NAMED
      boundary rather than stumbling into one) produced a mid-drag live `x` matching the hand-derived
      `leftWidth(87.6667) + 75 = 162.667` exactly, and on release `start = floor(237.6667/87.6667) =
      2, end = 2+1 = 3` (readout `[2, 3)`) - confirmed the MAIN chart above (a separate, already-
      windowed `LineChart`) re-rendered to show exactly its `[2,3)` row (`"Mar"`), proving the
      `windowedData` commit path actually reaches the host chart, not just the widget's own chrome.
      A full 27-route Playwright sweep (every page in `router.ts`, matching this port's standing
      "zero console/page errors" bar) confirmed the new `AxisConfig.hide`/`ChartBase.vue` change
      caused zero regressions anywhere else in the app. `npm run test` (456/456 passing, +19 new
      `useZoomScroll` cases), `npm run build:lib`, `npm run build` all clean with no type errors (one
      real `TS2308` duplicate-export caught and fixed - see the `roundedRectPath` reuse note above -
      and two `useHoverGuide.spec.ts` object literals needed the new `AxisResult.hide` field added,
      both caught by `vue-tsc` during `npm run build`, not by `npm run test`/vitest, which doesn't
      type-check spec files as strictly).

      Exported `useZoomScroll.ts`'s public functions/types from `src/index.ts` (matching every other
      Phase D composable's own precedent). Added all 11 `zoomScroll*` tokens to `useTheme.ts`.
      README.md updated: `LineChart`'s own bullet notes `zoomScrollable`/`zoomScrollKey`/
      `zoomScrollSymbol`/`zoomScrollColor`, new `useZoomScroll` bullet in "Composables", a new
      `axis.x.hide`/`axis.y.hide` bullet, the top "Scope" summary marked Phase D fully done, and the
      `examples/zoom_scroll_bigdata.html` "what wasn't validated" note updated now that this item
      actually used that example to confirm the widget's real-world config shape.

      **This is the last Phase D item - Phase D is now fully complete, 8/8** (`legend.js`,
      `guideline.js`/`cross.js`, `zoom.js`, `dragselect.js`, `scroll.js`/`vscroll.js`,
      `topologyctrl.js`, `raycast.js` (resolved out of scope), `zoomscroll.js`) - see the Phase D
      completion summary at the top of this section.
- [x] `dragselect.js` (237) — `LineChart`'s `dragSelect`/`dragSelectMode` props. **Read in full
      before writing anything, per this item's own task brief. `extend: "chart.widget.core"`,
      confirmed from source - same chain as `topologyctrl.js`/`guideline.js`/`cross.js`/`zoom.js`.**

      **Exact interaction model, confirmed from source, not assumed from the "drag-to-select range"
      PORT_STATUS.md summary that seeded this item**: `dragselect.js` drags a rectangle over the
      plot area (`axis.mousedown`/`axis.mousemove`/`axis.mouseup`, plus `chart.mouseup`/`bg.mouseup`
      as redundant fallbacks - the same multi-source-mouseup shape `zoom.js`'s own entry already
      flagged) and, on release, does ONE of two things gated by its own `dataType` setup option
      (`"list"` default / `"area"`): `"list"` walks every row and, for each `brush.target` key,
      tests whether that (row, key) VALUE falls inside the dragged rectangle - but only for an
      axis-type pairing of one `date`/`block` (discrete) axis crossed with one `range` (continuous)
      axis; any other pairing is a confirmed silent no-op (`emitDataList()`'s two `if` branches
      simply don't match). Emits `"dragselect.end"` with the array of matches
      (`{brush, dataIndex, dataKey, data}`). `"area"` skips the per-point search entirely and just
      emits the dragged rectangle's own two corners run through `axis.x.invert()`/`axis.y.invert()`
      - a passive range notification with no per-point matching. Draws a live rubber-band `thumb`
      rect while dragging (themed via `dragSelect{Border,Background}*`), cleared on release either
      way - confirmed via a full read that neither mode ever calls `axis.zoom()`/
      `axis.updateGrid()`/`chart.render()` - **zero chart-mutating effect of its own**, genuinely
      different from `zoom.js`'s drag (a real axis-domain rescale).

      **Confirmed genuinely distinct from everything already built** (this item's own task brief's
      explicit ask - checked against all three, not assumed from the "near-redundant" precedent
      `zoomselect.js` set): `FocusChart`'s `selectEvent` is a 2-click DISCRETE-CELL picker (one
      rectangle snapped to axis cell boundaries, a single `{start,end}` pair - Phase C's `focus.js`
      entry); `zoom.js`'s drag rewrites the axis's own domain (a real zoom, not a passive
      notification); `SelectBoxChart` (`selectbox.js`, Phase B) is a static per-cell HOVER strip
      with no drag gesture at all (see `useSelectBox.ts`'s header comment). `dragSelect`'s `"list"`
      mode is the only one of these four that does a free-pixel drag and emits the actual matched
      MULTIPLE data rows themselves (not a single range/cell) - a genuinely new capability, not a
      `zoomselect.js`-style redundancy call.

      **Deliberate simplification over source's own per-axis-type value comparison**: rather than
      porting `emitDataList()`'s four separate `date`+`range`/`range`+`date`/`block`+`range`/
      `range`+`block` branches (this port's `AxisConfig['type']` is only ever `'block' | 'range'` -
      the same conclusion `zoom.js`'s/`cross.js`'s/`focus.js`'s own entries already reached, so only
      the `block`+`range`/`range`+`block` pair can ever apply here anyway), `useDragSelect.ts`'s
      `pointsInDragRect()` hit-tests directly in already-computed PIXEL space (`LineChart.vue`'s own
      per-point `x`/`y`, the exact pixels the line paths/point markers themselves render from)
      instead of re-deriving axis values via `invert()` and comparing those. Every scale this port
      has (`useScale.ts`) is a monotonic (order-preserving or -reversing) bijection between value
      and pixel space, so this is an equivalent, simpler, axis-type-agnostic reformulation, not a
      behavior change - the same kind of generalization `nearestIndexByPosition()` in
      `useHoverGuide.ts` already made for `guideline`'s snap math, for the same reason.

      **Vue integration decision**: `dragSelect`/`dragSelectMode` are opt-in props on `LineChart.vue`
      itself, same reasoning as `guideline`/`crosshair`/`zoomable` before it (live access to this
      chart's own `axisX`/`axisY`/`series`/`points` needed). **Shares the existing guideline/
      crosshair/zoomable hit-rect** rather than adding a second one, but tracks its OWN drag state
      (`dragSelectStartX/Y`/`dragSelectCurrentX/Y`) since it's a genuinely 2-D drag (both x AND y),
      unlike `zoomable`'s 1-D (x-only) one - a new `Point.dataIndex` field (the row index) was added
      to the existing `points` computed so `dragSelect`'s hit-testing can reuse it directly instead
      of a second, near-duplicate points computed. **Mutually exclusive with `zoomable` on the same
      physical drag** (both listen on the same mousedown): if both props are enabled together,
      `zoomable` wins (`onDragSelectStart` no-ops while `zoomActive` is true) - a real domain
      rewrite is the more surprising of the two to silently skip, and enabling both together isn't a
      realistic combination in practice (the demo page only ever shows one at a time), so this is a
      documented, low-stakes tie-break, not a load-bearing design decision.

      **Reused, not reintroduced, the exact bug class `zoom.js`'s own entry found and fixed**:
      finalization happens via the SAME `window`-level `mouseup` pattern (`onDragSelectWindowUp`,
      added in `onDragSelectStart`, computing the final pixel position from the mouseup event's own
      `clientX`/`clientY`, target-independent) rather than the hit-rect's own `mouseleave`/`mouseup`
      - the shared hit-rect sits below the line paths/point markers, so a native `mouseleave` still
      fires whenever the pointer crosses onto one of those covering elements mid-drag, not only when
      it truly leaves the plot area. Playwright-verified this specific case still resolves correctly
      (see below).

      **New theme tokens**: `dragSelectBorderColor`/`dragSelectBorderWidth`/
      `dragSelectBackgroundColor`/`dragSelectBackgroundOpacity` (all 4 confirmed actually read from
      `draw()`), added to `useTheme.ts`'s `ChartTheme`. Identical across all 4 theme files upstream
      (classic/dark/pattern/gradient), so `darkTheme` doesn't override any (same convention as
      `zoom*`/`focus*`/`guideline*`).

      Demo: two new sections on the existing `/line` page (`LinePage.vue`) - `dragSelect` (list
      mode, the default) and `dragSelect="area"` - reusing the same 6-month `visits`/`signups`
      dataset and exact geometry (`width=600`, default padding => `area.x=48`, `area.x2=576`,
      `area.width=528`, band=88 for 6 rows) already established by the `guideline`/`crosshair`/
      `zoomable` demos. `@dragselect` wired to `data-testid="last-dragselect-list-event"`/
      `"last-dragselect-area-event"` readouts.

      **Playwright-verified, exact-coordinate checks** (dev server + a script driving real
      `mouse.down()`/`mouse.move()`/`mouse.up()` sequences, reading rendered `<circle>` cx/cy
      attributes and the `dragselect-thumb` element's own attributes directly - NODE_PATH-borrowed
      `playwright` from `../jui-grid-vue/node_modules`, same as `zoom.js`'s own verification):
      confirmed the 12 rendered `show-points` circles (6 rows × 2 targets) land at exactly the
      hand-traced x ticks (Jan=92 ... Jun=532, matching the already-verified `guideline`/`crosshair`/
      `zoomable` geometry) and read their actual y pixels directly off the DOM (Feb/visits=143.92,
      Mar/visits=196.55, etc. - matching this port's own linear-scale hand-derivation exactly, cross-
      confirming `useScale.ts`'s range-scale math independently). A tight drag rectangle
      (x:136→300, y:128.9→211.5, released INSIDE the chart) produced a live rubber-band thumb with
      nonzero `width=16 height=9` mid-drag, then on release emitted EXACTLY `visits[1], visits[2]`
      (Feb+Mar visits only - Jan/Apr excluded by x, both signups points correctly excluded by y) and
      the thumb rect was removed from the DOM. A regression check confirmed hovering the Feb/visits
      point immediately after the drag still shows its hover tooltip (drag state doesn't get stuck).
      A second drag with the SAME start point but released far OUTSIDE the `<svg>` entirely (below
      the whole page element) still finalized correctly via the `window`-level `mouseup` listener,
      this time correctly widening the match set to `visits[1], visits[2], signups[1], signups[2]`
      (the taller rectangle now also spans the signups row) - confirming the reused zoom.js bug fix
      actually works for this widget's own drag, not just copied in. A plain click (zero movement)
      left the readout completely unchanged (degenerate-drag guard confirmed). `dragSelectMode="area"`
      on the identical rectangle emitted `x: [Feb, Mar]` (the two nearest block-axis tick labels) and
      a numeric y-range consistent with the dragged pixels' inverted values, confirming the "area"
      payload shape is a range, not a point list. Zero console/page errors across the whole `/line`
      page. `npm run test` (417/417 passing, +13 new `useDragSelect` cases), `npm run build:lib`,
      `npm run build` all clean with no type errors.

      Exported `useDragSelect.ts`'s public functions/types from `src/index.ts` (matching
      `useZoomWindow.ts`'s precedent). README.md updated: `LineChart`'s own bullet notes
      `dragSelect`/`dragSelectMode`, new `useDragSelect` bullet in "Composables".

      **What wasn't validated**: no real `dragselect.js` example ships in `jui-chart/examples/*.html`
      (grepped the whole directory - zero matches, same conclusion `zoom.js`'s own entry reached for
      itself). The `"date"`/`"dateblock"` axis-type branches of `emitDataList()` are unported (same,
      already-established reason every other widget this phase gives: this port has no date/time
      axis kind at all).
- [x] `scroll.js` (125) / `vscroll.js` (125) — `LineChart`'s `scrollable`/`verticalScrollable`/
      `visibleCount`/`scrollOrient`/`verticalScrollOrient` props. **Both read in full before writing
      anything, per this port's established rigor for drag-interaction widgets.** `extend:
      "chart.widget.core"` for both, confirmed from source - same chain as `topologyctrl.js`/
      `guideline.js`/`cross.js`/`zoom.js`/`dragselect.js`. **NOT one extending the other** (unlike a
      hypothetical `bar.js`/`column.js`-style shared base) - they are two independent,
      near-duplicate files: a full line-by-line read confirms `vscroll.js` is exactly `scroll.js`
      with every `x`/`width`/`bgX`/`thumbWidth` swapped for `y`/`height`/`bgY`/`thumbHeight`, no
      shared "scroll core" module either reaches into.

      **Exact interaction model, confirmed from source, not assumed from the "scrollable axis
      widget" placeholder name**: a classic scrollbar (fixed background track + draggable thumb)
      that PANS a FIXED-SIZE window of row indices through the data - distinct from `zoom.js`'s
      variable-size drag-any-rectangle zoom and from `topologyctrl.js`'s view-transform pan. What
      enables it: `axis.buffer` (confirmed in `juijs-graph/src/base/axis.js`, `@cfg buffer: 10000` -
      "Limits the number of elements shown on a chart"), a per-axis "visible window size" cap - the
      thumb's SIZE is fixed by the ratio `axis.buffer / axis.origin.length`
      (`thumbWidth = trackWidth * (bufferCount / dataLength) + 2`), and dragging the thumb calls
      `axies[i].zoom(start, start + bufferCount)` on every chart axis, on every `mousemove` tick -
      the window's WIDTH never changes, only its start. This port has no `buffer` axis config
      anywhere - `visibleCount` on `LineChart.vue` is the new, explicit equivalent.

      **Relationship to `zoomscroll.js` (still deferred - see that item below, now expanded with
      this finding)**: confirmed from a full source read that this pair is a SIMPLER sibling of the
      exact same mechanism, not an unrelated widget. `zoomscroll.js`'s own `endZoomAction()` ends by
      calling the IDENTICAL `axis.zoom(start, end)` this item's drag math feeds, just reached via a
      resizable dual-handle range UI plus an embedded thumbnail-chart `<image>` instead of a
      fixed-size thumb. This item's row-window math is the plain, fixed-width special case of that
      same `axis.zoom()` endpoint - it does NOT unblock `zoomscroll.js`'s remaining real blocker (the
      embedded-thumbnail-chart rendering mechanism), but it DOES confirm `zoomscroll.js`'s
      center-pane drag (`isCenter` branch of `dragZoomAction()`, which PANS a fixed-width selection
      exactly like this item's thumb, as opposed to its two edge-handle branches which RESIZE it)
      would reuse this exact drag-math shape once ported, and that `LineChart.vue`'s existing
      `windowedData`/`props.data.slice(start, end)` plumbing (built for `zoom.js`, reused as-is by
      this item too) is already the right endpoint for it.

      **Reused, not re-derived**: `zoomable`'s existing `windowedData` slicing mechanism -
      `scrollStart` (a new ref) feeds the SAME `props.data.slice(start, end)` computed `zoomWindow`
      already established, just via a fixed-size window instead of a variable one. `zoomable` takes
      precedence when both are enabled on the same chart (same documented, low-stakes tie-break
      `dragSelect`'s own entry already established for that pair).

      **Deliberate simplification, documented as a real deviation**: the scrollbar only renders when
      `data.length > visibleCount` (`canScroll()` in `useScrollWindow.ts`) - source instead always
      draws a (possibly oversized, effectively undraggable) thumb even when there's nothing to
      scroll; this port skips that dead-weight visual entirely rather than reproducing a thumb that
      can never move.

      **`scrollable`/`verticalScrollable` share ONE underlying row-index window** (`scrollStart`),
      not two independent ones - confirmed correct from source: even used together upstream, both
      widgets drive the exact same `axis.zoom()` call on the exact same chart axes, so there is only
      ever one window to track regardless of how many scrollbar UIs are showing it.

      **New pure logic, hand-traced against LinePage's real demo geometry** (`useScrollWindow.ts`,
      20 new tests in `useScrollWindow.spec.ts`): `canScroll()`; `computeThumbSize()` (ported from
      `drawBefore()`'s `thumbWidth`/`thumbHeight`, e.g. `computeThumbSize(528, 3, 6) === 266` for the
      demo's 6-row/3-visible/528px-track geometry); `clampThumbGap()` (the `mousemove()` clamp);
      `computeScrollStart()` (ported from `mousemove()`'s `start` derivation - algebraically
      `rate/piece` collapses to `dataLength/trackSize` regardless of `bufferCount`, so this
      simplifies to `floor(gap * dataLength / trackSize)`, with source's own `+1` edge correction
      preserved exactly: `computeScrollStart(262, 266, 528, 6, 3) === 3`, reaching the TRUE last page
      [3,6) - without the correction, `floor(262*6/528) = 2` would land one row short); and
      `computeThumbGapFromStart()`, the inverse used to render the thumb's RESTING position from the
      committed `scrollStart` (a port-specific addition - source's own `thumbLeft`/`thumbTop` is
      itself the single source of truth, continuously updated by live drag deltas with `start` only
      ever derived FROM it; this port instead treats the row-index `start` as canonical, the same
      shape as `zoom.js`'s own `zoomWindow` ref, so the thumb's rest position must be derived the
      other way).

      **`window`-level mousemove AND mouseup** (not just `mouseup` like `zoomable`/`dragSelect`
      above) - a deliberate, documented extension of this port's established drag-interaction
      pattern: dragging a scrollbar thumb is a CONTINUOUS, live-updating gesture in source too
      (`chart.mousemove`/`bg.mousemove` immediately call `axis.zoom()` and re-render on every tick,
      unlike `zoomable`/`dragSelect`'s "resolve only on release"), and the pointer routinely leaves
      the thin ~7px track strip mid-drag, so anchoring only to the thumb element's own `mousemove`
      would reintroduce the exact element-relative-pointer-events bug class `zoomable`'s own
      `window`-level `mouseup` fix was written to avoid, just for `mousemove` instead of `mouseup`.
      Live drag state (`scrollDragAxis`/`scrollDragGap`) renders the thumb directly during a drag,
      same precedent as `zoomThumb`/`dragSelectThumb`'s own live-vs-committed split.

      New theme tokens (`scrollBackgroundSize`/`scrollBackgroundColor`/`scrollThumbBackgroundColor`/
      `scrollThumbBorderColor` in `useTheme.ts`) - confirmed from source that BOTH `scroll.js` AND
      `vscroll.js` read the same 4 keys (no separate `vscroll*` family exists upstream). **Unlike
      `zoom*`/`dragSelect*`, these DO differ in `darkTheme`** (checked all 4 theme files upstream -
      `scrollBackgroundSize` is `7` everywhere, but the 3 color tokens each have a distinct dark
      value), so `darkTheme` overrides those 3.

      **A real bug found and fixed via Playwright, not a preserved quirk**: the natural prop name
      for the vertical variant, `vScrollable`, silently breaks Vue's boolean-shorthand template
      syntax - a bare `v-scrollable` attribute parses as an attempt to resolve a custom DIRECTIVE
      named `scrollable` (Vue reserves the `v-` prefix), not as the `vScrollable` prop, so the prop
      quietly stayed `false` with a console warning and no visible error. Caught immediately by the
      Playwright verification script (`Failed to resolve directive: scrollable`) - renamed the
      public prop to `verticalScrollable`/`verticalScrollOrient` (internal identifiers like
      `canVScroll`/`vThumbSize` keep the short "v" form; only the public, template-facing prop name
      needed to change) so the natural bare-boolean-attribute form works like every other boolean
      prop on this component.

      Demo: new "scrollable"/"verticalScrollable" sections on `/line` (`LinePage.vue`), reusing the
      same 6-row dataset/default-width geometry as the `zoomable`/`dragSelect` demos above with
      `visibleCount=3`, plus extra bottom/left padding (matching the `displayPadding` precedent) so
      each scrollbar has room without overlapping axis tick labels.

      **Playwright-verified with exact-coordinate DOM checks** (dev server + an independently-
      written verification script driving real mouse events, using `playwright` from
      `../jui-grid-vue/node_modules`, same as every other Phase D drag widget): 17/17 assertions
      passed - initial thumb `x=48`/`width=266` (horizontal) and `y=20`/`height=176`/`x=58`
      (vertical, matching each demo's own padding-derived track size), initial 6-row dataset
      correctly pre-windowed to `[0,3)` (Jan/Feb/Mar, 6 `<circle>`s = 2 targets × 3 rows) even before
      any drag; a live +100px drag showed the thumb at the LIVE (undamped) `x=148` mid-drag, then
      snapped to the floor-consistent RESTING `x=136` after release with x-axis ticks reading
      exactly `Feb,Mar,Apr`; a full drag to the track's far right landed on `x=310`/ticks
      `Apr,May,Jun` for the horizontal scrollbar and `y=192`/ticks `Apr,May,Jun` for the vertical
      one - both confirming the `+1` edge-correction reaches the TRUE last page. Zero console/page
      errors and zero Vue warnings on the final run (after the `verticalScrollable` rename fixed the
      one warning the script itself caught). One test-script-only gotcha worth recording: the
      scrollbar sits far down a tall demo page, and Playwright's raw `page.mouse.move/down` does NOT
      auto-scroll an element into view (unlike `locator.click()`) - the drag silently no-ops against
      off-viewport coordinates until `locator.scrollIntoViewIfNeeded()` is called first; not a
      component bug, but worth flagging for whoever verifies the next drag-interaction widget this
      way.

      `npm run test` (437/437, +20 new), `npm run build:lib`, `npm run build` all clean, no type
      errors. Exported `useScrollWindow.ts`'s public functions from `src/index.ts` (matching every
      other Phase C/D composable). README.md updated: `scrollable`/`verticalScrollable` noted on
      `LineChart`'s own bullet, `useScrollWindow` added to "Composables".
- [x] `topologyctrl.js` (191) — `TopologyChart`'s `pannable`/`zoomable` props. **This port's FIRST
      widget - `extend: "chart.widget.core"`, confirmed from source** (a widget attaches alongside a
      brush and mutates its axis/grid state rather than drawing marks of its own; `draw()` even
      returns an empty `this.chart.svg.group()`). Read in full before writing anything, per this
      item's own task brief.

      **Three genuinely separate interactions, confirmed from `draw()`/`setup()`, not assumed from
      the "drag/zoom/pan" bucket name**: (1) `initDragEvent()` drags an INDIVIDUAL NODE - always
      wired, unconditional, not gated by any `widget.setup()` flag; **hand-traced quirk, confirmed
      algebraically**: `xy.setX(startX + (dragX - startX))` - `startX` cancels out of its own
      formula, so a dragged node snaps its position to the raw (scale-corrected) pointer coordinate
      on every move, with no offset-from-grab-point preservation. (2) `initMoveEvent()`, opt-in via
      `widget.move` - drags the WHOLE VIEWPORT (background mousedown, not a node) via a running
      `boxX`/`boxY` pair, algebraically simplified here to a closed-form incremental-pan formula
      (`computeTopologyPan`, hand-traced/chained across 2 gestures in `useTopologyZoom.spec.ts`).
      (3) `initZoomEvent()`, opt-in via `widget.zoom` - mousewheel nudges a shared `scale` by `±0.1`
      clamped `[0.6, 2]`, starting at `1`.

      **The shared coordinate math, confirmed from `grid/topologytable.js`'s `scale()` getter**
      (already read for Phase C's `topologynode.js` item): a node's final position is
      `(base + view) * scale`, and source separately multiplies radius/font-size/stroke-width by
      that same `scale` at each of their own draw call sites (no container-transform concept in this
      engine). **Confirmed mathematically equivalent, not just visually close**: wrapping this
      port's already-rendered edges+nodes+tooltip `<g>` in one
      `transform="scale(s) translate(viewX, viewY)"` produces the exact same coordinate for every
      x/y (SVG's transform composition works out to `s*(p+view)` - see `topologyViewportTransform`'s
      doc comment for the derivation) and gets radius/stroke-width/font-size scaling for free from
      native SVG rendering.

      **Vue integration decision - this iteration's precedent-setting call for the rest of Phase
      D**: exposed as two opt-in boolean PROPS on `TopologyChart.vue` itself (`pannable` for
      `widget.move`, `zoomable` for `widget.zoom`), not a separate wrapper/widget component -
      consistent with this port's established "one component, opt-in props" pattern (`BarChart`'s
      `stacked`/`normalize`/`equalizer`). This fit specifically because the widget's entire effect
      reduces to one derived `{scale, viewX, viewY}` triple applied as a single wrapping
      `<g transform>` - there's no separate visual surface a standalone component would need to own.
      **Not a blanket precedent**: a future widget with its own independent visual real estate (e.g.
      `legend.js`, which draws its own key/swatch list, possibly outside the host chart's own SVG
      bounds) may well warrant a real separate component - only "a widget whose effect is a pure
      transform/state mutation on an existing brush" generalizes to "prop."

      **Deliberately NOT ported this iteration**: individual-node dragging (interaction (1) above) -
      a genuinely separate feature (repositioning a node) from panning/zooming the viewport, with its
      own non-offset-preserving drag semantics (and the drag-to-front z-order
      `axis.cache.nodeKey`/`node.order` it alone triggers, already flagged in `topologynode.js`'s own
      entry) deserving a dedicated design pass - left for a future item.

      **One deliberate fix, not a preserved quirk**: source's raw `scale += 0.1`/`-= 0.1` on a plain
      JS float accumulates drift over repeated wheel events (e.g. `1.1 + 0.1 ===
      1.2000000000000002`) with no behavioral/visual feature to preserve - `clampTopologyZoomScale`
      rounds to 1 decimal place after every step, keeping this item's own exact-value Playwright
      verification non-flaky too.

      New pure logic in `useTopologyZoom.ts` (`clampTopologyZoomScale`/`topologyZoomDirection`/
      `computeTopologyPan`/`topologyViewportTransform`), unit-tested with hand-traced values
      including a chained-drag-gesture case and a "zoom-then-pan produces exact expected
      coordinates" case (14 new tests in `useTopologyZoom.spec.ts`). `TopologyChart.vue` adds
      `svgRoot`/`viewportScale`/`viewportView` state, a `toViewportPoint()` helper (converts
      `clientX`/`clientY` to this SVG's own viewBox user-unit space, so panning stays 1:1 with the
      pointer even under the component's own `max-width: 100%` responsive CSS - a concern source's
      fixed-pixel layout never had), background-mousedown-starts-pan / window-mousemove-updates-pan /
      window-mouseup-ends-pan handlers, and a `@wheel` handler (only `preventDefault()`s when
      `zoomable`, so the page still scrolls normally otherwise).

      Demo: new "Pannable + zoomable viewport" section on `/topology` (the reciprocal A/B/C graph),
      instructing readers to activate an edge then pan/zoom to see the tooltip track it.
      **Playwright-verified, exact numeric checks** (dev server + a script reading the rendered `<g
      transform>` attribute directly): identity transform (`scale(1) translate(0, 0)`) at mount;
      3x zoom-in wheel -> exactly `scale(1.3)`; 1x zoom-out wheel -> exactly `scale(1.2)`; a
      70x35px background drag -> exactly `translate(70, 35)` mid-drag AND unchanged after mouseup; a
      second, smaller drag chains correctly onto the first (`translate(50, 55)`, matching the hand-
      derived closed-form pan formula); dragging that STARTS on a node produces zero viewport change
      (individual-node drag correctly not wired); clicking an edge after pan+zoom still activates it
      (stroke color changes exactly as expected); a full page reload re-verified 7 `TopologyChart`
      instances render with zero console/page errors and the fresh mount is back at the identity
      transform. A prior no-op regression check (clicking a node/background in the untouched
      "Realistic dataset" section) confirmed wrapping existing content in an identity-transform `<g>`
      changed nothing observable. `npm run test` (364/364 passing, +14 new `useTopologyZoom` cases),
      `npm run build:lib`, `npm run build` all clean with no type errors.

      Exported `useTopologyZoom.ts`'s public functions from `src/index.ts` (matching every other
      Phase C/D composable's own precedent). README.md updated: `pannable`/`zoomable` noted on
      `TopologyChart`'s own bullet, `useTopologyZoom` added to "Composables", Phase D's
      `topologyctrl.js` line marked done in "Scope".
- [x] `raycast.js` (68) — **investigated in full, then deliberately NOT implemented as a feature in
      this port; resolved as transitively out of scope, not silently dropped.** Read in full before
      writing anything, per this item's own task brief not to trust the placeholder description.
      Confirmed from source this is NOT a nearest-point / ray-intersection / spatial-index hit-test
      of any kind: `extend: "chart.widget.core"` (matches every other Phase D widget's chain). Its
      `draw()` wires the engine-level, chart-wide `axis.click`/`axis.dblclick`/`axis.rclick` events
      (confirmed emitted only by `juijs-graph`'s `base/axis.js`, NOT by any brush - unrelated to the
      per-element DOM events Phase A item 14 already ported) for each configured `brush` index. The
      handler resolves a block index via `blockAxis.invert(e.chartX) - 1`, then does a plain
      axis-aligned point-in-rectangle test (`e.chartX`/`e.chartY` against a cached `x1/x2/y1/y2`)
      against `this.chart.getCache('raycast_area_' + blockIndex)`, re-emitting
      `raycast.click`/`dblclick`/`rclick` with `{brush, data, dataIndex}` only on a hit - simple
      cache-and-compare, no geometry beyond that.

      **The finding that changes the scope call**: grepped the entire `jui-chart` + `juijs-graph`
      source tree and every `examples/*.html`. The ONLY writer of the `raycast_area_*` cache key
      anywhere is `jui-chart/src/brush/canvas/equalizercolumn.js`, and its
      `examples/equalizercolumn.html` (`widget: [{type: "raycast"}]` + an `event: {"raycast.click":
      ...}` handler on the `canvas.equalizercolumn` brush) is raycast.js's ONLY real-world usage in
      the whole codebase. That canvas brush is out of scope for this SVG-based port (canvas 2D, not
      SVG - tracked separately under Phase E below, not started as of this writing). The
      already-ported SVG sibling of that
      same visual (`equalizerbar.js`/`equalizercolumn.js`, this port's `BarChart` `equalizer` prop)
      confirmed via grep to never write `raycast_area_*` - it renders real per-block SVG `<rect>`
      elements, so it already gets ordinary per-element DOM events, a strictly more precise and
      simpler hit-test than raycast.js's manual mechanism. No other brush, ported or not, writes
      that cache key either. **raycast.js exists specifically to compensate for canvas rendering's
      lack of individually-addressable DOM nodes** - it is not a chart-agnostic hover/hit-testing
      utility, and shares no mechanism, cache key, or event name with `guideline.js`/`cross.js`'s
      continuous pointer-tracking or `ChartTooltip.vue`'s positioning (both already work directly off
      real SVG elements' own `mouseover`/`mousemove`, solving a different problem entirely - hover
      readout, not click hit-testing of an off-DOM canvas rendering).

      With its sole real consumer out of scope and zero other brush ever populating its required
      cache, porting raycast.js here would ship dead code: a widget whose cache lookup is
      permanently `null` under every brush this port supports, that can never emit a `raycast.*`
      event in real usage. Building a demo wiring it into `ScatterChart`/`BubbleChart` (as this
      item's task brief initially suggested, before the source investigation) would have fabricated
      a usage with no upstream basis - those charts already have precise SVG per-element hover/click
      (Phase A item 14) and no `raycast_area_*` producer to hit-test against, so nothing would
      actually flow through raycast.js's cache-lookup path; it'd be a facade, not a real
      integration. **Decision: transitively out of scope, moved to that section below rather than
      built as a facade** - no new `.ts`/`.vue` files, no new export, no new prop on any component,
      no test suite (there is no non-trivial pure logic to hand-trace beyond the one-line rect
      containment check, which has no caller in this port to exercise it). `npm run test` (still
      437/437, unchanged), `npm run build:lib`, `npm run build` re-run clean to confirm this
      investigation-only iteration didn't regress anything.

      This resolves Phase D's last "normal" item. Only the deliberately-deferred `zoomscroll.js`
      remains before Phase D is complete. (Update: now done too - see that item's own entry below
      and the Phase D completion summary at the top of this section - Phase D is fully complete.)

      (Update: `raycast.js`'s sole producer, `brush/canvas/equalizercolumn.js` (canvas), is now
      ported too - see Phase E's `equalizercolumn.js` entry below, which folds a full re-
      investigation and the actual hand-port of `raycast.js`'s own logic into itself, since
      `raycast.js` was never tracked as its own separate checklist line. This entry's own
      investigation above - NOT a nearest-point/spatial-index hit-test, a plain rectangle test -
      turned out to still be accurate; only the "transitively out of scope" conclusion is now
      superseded.)

## Phase E — Canvas/3D rendering (new backend, user-requested extension beyond the original A-D scope)

**Phase E is fully complete (every checklist item below is checked off)**, as of the iteration that
finished `widget/polygon/rotate3d.js` (see that checklist item's own entry, last in this section,
for its full write-up). Across many iterations, Phase E stood up a second rendering backend
alongside Phases A-D's SVG-based `ChartBase`/`useChartLayout` engine and ported every canvas/3D
brush and widget in `jui-chart`/`juijs-graph`:

1. **Shared canvas infrastructure** (`useCanvasChart.ts`/`ChartCanvasBase.vue`) — the
   `ChartBase.vue`-equivalent for the canvas backend: DPI-scaled backing-store sizing, a
   `requestAnimationFrame` loop (`useAnimationFrameLoop`) with delta-clamping for physics, and a
   per-frame `@frame(ctx, frameInfo)` event a consuming component draws into (no `<slot/>`
   composition possible - canvas drawing is imperative, unlike SVG's declarative child elements).
   Established this phase's own Playwright pixel-readback verification pattern (`getImageData()` at
   hand-computed coordinates) and caught a real initial-paint race bug via it (see that item's own
   entry).
2. **`base/kinetic.js` vendored, not hand-ported** — this phase's own precedent-setting policy
   decision: rather than Phases A-D's blanket "zero runtime dependency on jui-chart/juijs-graph"
   rule, a small self-contained physics/utility file with no chart-domain logic of its own gets
   imported as-is + a `.d.ts` declaration, permanently (not a stopgap). The actual test settled on
   (after correcting an earlier, wrong framing): "is this code recognizably lifted from/
   characteristic of a domain outside chart-rendering logic itself" — checked via a license header
   or a web search for distinctive names — not "does it look generic" or "does it avoid referencing
   `this.axis`" (`usePolygon3d.ts`'s rotation-matrix math looks equally "generic" but IS
   chart-engine logic, hand-ported like everything else, per this same test).
3. **`base/bubble.js`+`base/mortalbubble.js`** → `activebubble.js` (kinetic, force-directed
   physics) and **`bubblecloud.js`** (a whole population's mutual repulsion, settling to rest) —
   both real physics-driven canvas brushes built on the vendored `kinetic.js` + the new
   `useAnimationFrameLoop`.
4. **`activecircle.js`** — this phase's first canvas brush confirmed to reuse the EXISTING
   axis-based pattern (`useChartLayout`/`useAxis`/`toSeriesScale`) rather than needing new
   axis infrastructure - the precedent every later axis-based canvas/3D component (`dot3d.js`,
   `equalizercolumn.js`) also followed: a canvas brush's *drawing* is imperative and new, but its
   *axis/scale* math is the same engine every SVG brush already uses.
5. **`dot3d.js`** — the first REAL 3D brush: built `usePolygon3d.ts`, a from-scratch, hand-ported
   4x4 homogeneous-matrix rotation + depth-based perspective-scale engine (`rotatePolygonVertices`,
   `rotate3dx/y/z` matrices, `move3d`/`scale3d` composition), confirmed via web search to be
   bespoke `jui-chart`/`juijs-graph` chart-engine code (no external library match), matching the
   EXACT pipeline `chart.polygon.core`'s `PolygonCore.rotate()` uses - every later 3D component
   (`column3d.js`/`line3d.js`/`rotate3d.js`) funnels through this same engine, not a parallel
   reimplementation.
6. **`equalizercolumn.js`** (canvas variant) **+ `widget/canvas/picker.js` + `widget/raycast.js`**
   — investigated together after Phase D had left `raycast.js` "transitively out of scope" for
   lack of a real consumer; `equalizercolumn.js` turned out to be that consumer, and `picker.js`'s
   real (and only) consumer turned out to be the already-shipped `bubblecloud.js`, retrofitted to a
   genuine port instead of its prior stand-in. Confirmed NOT 3D despite this phase's own prior
   speculation - a plain 2D stacked-bar/level-meter visual with no `chart.polygon.*` dependency.
7. **`column3d.js`+`line3d.js`** — a genuine architectural surprise, confirmed only by reading
   source directly rather than trusting this project's own earlier "canvas 3D" planning framing:
   both render REAL SVG `<polygon>` elements, not a canvas raster - the 3D-ness is entirely in the
   vertex math (`usePolygon3d.ts`, extended here with `cubeVertices()`/`CUBE_FACES`/
   `computePolygon3dProjection()`/`darkenColor()`), while the actual DOM output composes
   `ChartBase.vue` (this port's SVG scaffolding) exactly like any Phase A-D SVG brush, not
   `ChartCanvasBase.vue`.
8. **`widget/polygon/rotate3d.js`** — the generic mouse-drag-to-rotate widget every polygon-based
   3D brush above is meant to opt into (drags a plot area to mutate `degree.x/y`, redrawing live) -
   the last Phase E item. Not vendored in `node_modules/juijs-graph` at all (only exists in
   `jui-chart/src`); hand-ported as `useRotate3d.ts` and wired into `Dot3DPage.vue`/
   `Column3DPage.vue`/`Line3DPage.vue` alongside (not replacing) their existing ad-hoc rotation
   buttons.

**Key architectural notes**: (a) the canvas backend is a genuinely separate rendering path from the
SVG one - `ChartCanvasBase.vue`/`useCanvasChart.ts` parallel `ChartBase.vue`/`useChartLayout.ts`
but share nothing at the rendering layer, only reusing axis/scale composables where a canvas brush
happens to be axis-based; (b) the `kinetic.js` vendoring decision is this phase's only permanent
exception to the "hand-port everything" rule from Phases A-D, and the test for when it applies
(recognizably-external-in-kind, not merely generic-looking) is the main policy legacy this phase
leaves for Phase F's retroactive audit; (c) `usePolygon3d.ts` is the one shared 3D engine every
`dot3d.js`/`column3d.js`/`line3d.js`/`rotate3d.js` funnels through, mirroring how
`chart.polygon.core` is the one real engine every `juijs-graph` 3D brush shares upstream; (d) not
every "3D" brush is canvas - `column3d.js`/`line3d.js` are SVG, a distinction only confirmed by
reading source, not assumed from this project's own prior file-organization guesses.

`npm run test` finishes this phase at **643/643** (up from 0 at Phase D's completion). Phase F (the
retroactive external-library audit of Phases A-D) can now begin - see below.

Everything below was previously tracked as "explicitly out of scope" (see the git history of this
file for that section's original text) because it uses the HTML canvas 2D context or a hand-rolled
3D projection instead of SVG — porting it means standing up a SECOND rendering backend alongside
the existing SVG-based `ChartBase`/`useChartLayout` engine Phases A-D are built on, not just new
Vue components on top of it. The user explicitly asked to continue into this work rather than stop
at Phase D, so it's promoted to a real phase.

**Before porting any brush/widget below**, establish the shared canvas infrastructure first (this
is genuinely new architecture, analogous to what Phase A's `useChartLayout`/`useAxis`/`useScale`
were for the SVG side) — a `<canvas>` ref + `watchEffect`-driven imperative draw loop, likely a
`useCanvasChart.ts` composable and/or a `ChartCanvasBase.vue` wrapper component providing sizing/
DPI-scaling/redraw-scheduling that every canvas brush below can share, mirroring `ChartBase.vue`'s
role for the SVG components. Read `jui-chart/node_modules/juijs-graph/src/util/canvas/base.js`
(`util.canvas.base`, imported by several files below) first — it's the original's own shared
canvas-drawing helper layer and the most direct source for what this composable needs to cover.

Source: `jui-chart/src/brush/canvas/*`, `jui-chart/src/brush/polygon/*`,
`jui-chart/src/widget/canvas/*`, `jui-chart/src/widget/polygon/*`.

**Policy exception for generic (non-chart) utility code, per explicit user instruction**: Phases
A-D held a strict "zero runtime dependency on jui-chart/juijs-graph" rule — every file, however
low-level, was hand-reimplemented from scratch in idiomatic Vue/TS. That rule now has a carved-out
exception for Phase E files that are pure generic algorithm/utility code with no chart-specific or
Vue-specific logic of their own (the clearest example: `base/kinetic.js`, a standalone mass/
friction/velocity physics object with `extend: null` - it isn't "our" chart code, it's a small
self-contained physics library that happens to live inside jui-chart's source tree). For files like
that: **do not hand-port the logic.** Instead, add `juijs-graph` (or vendor the specific unmodified
`.js` file, whichever import path is cleaner - judgment call per file, document which) as a real
runtime dependency, import the original file as-is, and write a `.d.ts` declaration file to give it
proper TypeScript types for consumption from Vue - no reimplementation, no hand-traced unit tests
of logic you didn't write, just types + an integration-level sanity check that it behaves as
expected. This exception does NOT apply to anything chart/rendering/Vue-specific in this phase
(`useCanvasChart.ts`/`ChartCanvasBase.vue`, the actual brush/widget components, any drawing logic
that maps chart data to canvas primitives) - those remain genuine from-scratch Vue/TS work, same as
every prior phase. When in doubt for a given file, ask: "is this generic math/utility code that
happens to live in jui-chart's tree, or is it actually chart-rendering logic?" - only the former
gets the import+`.d.ts` treatment.

**Clarified scope of the exception (the user corrected an earlier, wrong framing of this note -
read this version, not the file's git history)**: this is NOT about which npm package a file
happens to live in, and it is NOT a blanket "temporary until juijs-graph gets ported" stopgap for
everything under `jui-chart`/`juijs-graph`. The actual engine logic that genuinely IS
`juijs-graph`/`juijs-chart` - axis/scale/grid computation, the brush/widget rendering pipeline, the
stuff Phases A-D already fully reimplemented for the SVG side - is planned to eventually get a
complete from-scratch Vue/TS port too (mirroring jui-ui-vue/jui-grid-vue/this project's own
Phases A-D), and that future work supersedes anything hand-ported today.

But a file like `kinetic.js` is different in kind, not just in current priority: it's a small,
independently-named, self-contained generic utility (a physics/kinetics object with no chart
domain logic in it at all - it would be equally at home in a completely unrelated project) that
merely happens to be vendored inside `jui-chart`'s source tree. **Files like this get the
import+`.d.ts` treatment PERMANENTLY** - they are not queued for a future rewrite just because they
live near real chart-engine code, and they stay this way even after `juijs-graph`'s actual engine
logic eventually gets its own Vue port. The test for "which bucket does this file fall in" is:
does this file implement chart/axis/rendering domain logic (→ future real port), or is it a
generically-named, self-contained utility that isn't really "about charts" at all (→ permanent
import+`.d.ts`, like `kinetic.js`)? Each such file's PORT_STATUS.md entry should say explicitly
which bucket it's in and why, so this distinction isn't lost later.

**The actual test (settled after back-and-forth with the user - use THIS version): is the code
recognizably lifted from an existing published open-source library/algorithm** (check the file for
a license/attribution header first; if none, recognize the pattern or do a web search for
distinctive function/variable names before assuming it's original) **, not "is it generic-looking"
or "does it avoid referencing `this.axis`."** Those two properties often correlate with the real
test but aren't it - see `util.canvas.base` below for a case where they diverge.

**Confirmed via web search to be lifted from known external libraries (permanent `.d.ts` bucket)**:
- `jui-chart/src/brush/canvas/base/kinetic.js` (`util.canvas.base.kinetic`, `extend: null`) - a
  small, self-contained mass/friction/velocity physics object. No license header found and no
  single exact-match library confirmed via search, but it's straightforward boilerplate Euler-
  integration physics with no jui-chart-specific behavior - low value to hand-port; treat the same
  as the two confirmed cases below unless a future check finds it's actually more bespoke than it
  looks.
- `juijs-graph/src/util/canvas/hidpi.js` (`util.canvas.hidpi`, `extend: null`) - **confirmed via web
  search**: matches `jondavidjohn/hidpi-canvas-polyfill` (MIT, npm `hidpi-canvas`) - same
  `backingStorePixelRatio` detection + `CanvasRenderingContext2D.prototype`/
  `HTMLCanvasElement.prototype` monkey-patching approach. **However**: `useCanvasChart.ts` (see
  below) does NOT reimplement this polyfill - it solves the same DPI problem with the modern,
  simpler `canvas.width = cssSize*dpr` + `ctx.setTransform(dpr,0,0,dpr,0,0)` technique (which
  supersedes hidpi.js's older prototype-patching hack), so it's genuinely original work solving the
  same problem differently, not a duplicate port of hidpi.js's actual code. No action needed there.
- The `getCurvePoints` function inside `juijs-graph/src/util/canvas/base.js` (`util.canvas.base`) -
  **confirmed via web search**: matches the well-known `cardinal-spline-js` (Catmull-Rom/Cardinal
  spline) library almost exactly (same function name, same `tension`/`isClosed`/`numOfSegments`
  parameters). **Don't reimplement this a second time**: this exact algorithm was ALREADY ported in
  Phase A as `curvePoints()` in `src/composables/useSeries.ts` (used by `LineChart`'s
  `symbol="curve"`). Any Phase E code needing curve interpolation should reuse/adapt that existing
  function, not hand-port Catmull-Rom again from `util.canvas.base` and not import
  `util.canvas.base` wholesale just for this one function.

**`util.canvas.base` as a WHOLE FILE is NOT simply "external" - it's a mix**: besides
`getCurvePoints` (handled above), the rest of it (`drawLine`/`drawCircle`/`drawRoundRect`/
`drawTriangle`/`drawSquare`/`drawFreeRect(Stroke)`/`drawDashedLine`/`drawPage`/`drawBullet`) is
trivial, few-line imperative wrappers over standard `CanvasRenderingContext2D` calls (e.g.
`drawCircle` is just `arc()`+`fill()`) - boilerplate with no traceable external source and no real
"reimplementation risk" the way a physics engine or spline algorithm has. **These are fine to
hand-write fresh, as-needed, when actual brush components need them** - don't import the whole file
just to get a one-line `drawCircle` wrapper, and don't feel obligated to pre-build a comprehensive
drawing-primitives library up front either; build what each brush actually uses, following this
port's established "extract to a composable once 2+ consumers need the same thing" convention.

**Confirmed genuine chart-engine/rendering domain logic (real port target, like every SVG
component in Phases A-D), NOT external**: every actual brush/widget file (`activebubble.js`,
`activecircle.js`, `bubblecloud.js`, `dot3d.js`, `equalizercolumn.js` (canvas), `column3d.js`,
`line3d.js`, `widget/canvas/picker.js`, `widget/polygon/rotate3d.js` - all reference `this.axis`/
`this.chart`/`this.brush`, confirmed by grep). `base/bubble.js`/`base/mortalbubble.js`,
`juijs-graph/src/polygon/{core,cube,line,point,grid}.js` (`chart.polygon.*`, 3D vertex/matrix
math), `juijs-graph/src/util/transform.js`, and `juijs-graph/src/base/vector.js` (`chart.vector`)
reference no `this.axis`/chart state either, but no license header or exact known-library match was
found for them either (unlike hidpi.js/getCurvePoints) - treat these as a genuinely open judgment
call per the actual test above (check for a license header or recognizable algorithm match before
importing vs. hand-porting), not a settled bucket either way. Do the check when you actually get to
each one rather than assuming from this note alone.

- [x] Shared canvas infrastructure (`useCanvasChart.ts` / `ChartCanvasBase.vue` or equivalent) —
      prerequisite for every item below, do this first. If its DPI-scaling logic was hand-written,
      check the `hidpi.js` note above and swap to import+`.d.ts` instead.

      **`util.canvas.base` (330 lines, full read) confirmed to provide ONLY drawing primitives**:
      `clearContext`/`drawLine`/`drawDashedLine`/`drawLines`/`drawCurve`+`getCurvePoints` (a
      Catmull-Rom spline, structurally the same algorithm as this port's own `useSeries.ts`
      `curvePoints()`)/`drawRoundRect`/`drawFreeRect(Stroke)`/`drawTriangle`/`drawSquare`/
      `drawPage`/`drawCircle`/`drawBullet` (gradient stub) - all imperative shape helpers over an
      already-open `CanvasRenderingContext2D`. It provides **NONE** of: devicePixelRatio/retina
      handling (every coordinate is raw/unscaled), `requestAnimationFrame`/animation-loop
      scheduling (confirmed absent by grepping the ENTIRE `jui-chart` + `juijs-graph` tree for
      `requestAnimationFrame`/`setInterval` - zero matches outside two unrelated
      `examples/*.html` scripts; `chart.brush.canvas.activebubble`'s kinetic physics only
      advances when something external calls the brush's `draw()` again, which nothing in the
      source does on a schedule), or resize/redraw scheduling beyond "caller clears and redraws
      everything itself." In short: `util.canvas.base` is this port's `useSeries.ts`-equivalent (a
      drawing-helper bag), NOT a `useChartLayout.ts`-equivalent - there is no session/lifecycle/
      sizing/animation layer in the original to port from at all.

      **Built from scratch** (no direct precedent anywhere in Phases A-D's SVG world - genuine new
      architecture, confirmed chart-engine/rendering-domain code per this file's own Phase E policy
      test above, same bucket as every SVG component, NOT the generic-utility import+`.d.ts`
      bucket):
      - `useCanvasChart.ts` - `computeCanvasBackingSize(cssWidth, cssHeight, dpr)` (device-pixel
        backing-store size, `Math.round`ed, floored at 1x1) + `resolveDevicePixelRatio()` (falls
        back to `1` for missing/non-positive/SSR-unavailable) + `useCanvasChart(canvasRef,
        {width, height, dpr?})`, a `watchEffect` that sets `canvas.width`/`canvas.height` to the
        DPR-scaled backing size, `canvas.style.width`/`height` to the CSS size, and
        `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so every draw call downstream works in plain CSS
        pixels - the standard modern HiDPI-canvas technique, scoped per-canvas.
      - `useAnimationFrameLoop(onFrame)` - a generic `requestAnimationFrame` loop
        (`start()`/`stop()`/`running`, auto-`stop()` on `onBeforeUnmount`), with
        `computeFrameDelta(previousTimestamp, timestamp, maxDelta=250)` clamping a resumed-tab's
        huge gap so a physics callback (kinetic.js's `update()`, a fixed-per-tick Euler step with
        no `dt` of its own) never sees a multi-second jump. Deliberately NOT canvas-specific - a
        future `rotate3d.js` widget can use it with no `<canvas>` involved.
      - `ChartCanvasBase.vue` - the `ChartBase.vue`-equivalent wrapper: owns the `<canvas>` +
        sizing + RAF-loop lifecycle, exposes a per-frame `@frame(ctx, frameInfo)` event for a
        consuming component to draw into. **Cannot mirror `ChartBase.vue`'s `<slot/>`-based
        composition** - SVG lets a child declare its own elements inside the parent's `<svg>` via
        Vue's diffing; canvas drawing is imperative, so there's nothing a `<slot/>` could contain.
        `animate: false` (default) mode draws exactly once per reactive change (`width`/`height`/
        `theme`/`animate`, or a manual `redraw()` for a caller's own prop changes this wrapper
        can't see); `animate: true` runs the RAF loop continuously, for kinetic-driven brushes.
      - **Bug found and fixed via the pixel-readback Playwright pattern below**: an earlier version
        drove the very first static paint from an `immediate: true` Vue `watch()` callback, which
        fires synchronously during `setup()` - before `canvasEl.value` is bound to the real DOM
        node and therefore before `useCanvasChart`'s own context-creation `watchEffect` has had a
        chance to run. The result: the canvas stayed silently, permanently blank until *something
        else* (a prop change, a later `redraw()` call) happened to retrigger a paint. A
        pixel-readback check at t=0 caught this directly: `getImageData()` at the ball's supposed
        center returned fully transparent `[0,0,0,0]`, not even the background fill. **Fix**:
        route every paint - static or animated - through the SAME `requestAnimationFrame`-scheduled
        callback (`paintFrame`), which self-stops after one tick in static mode instead of being
        invoked directly; a RAF callback only ever runs after the browser's next paint, by which
        point Vue's mount (and `useCanvasChart`'s post-mount sizing effect) has unconditionally
        already completed. Re-verified after the fix: initial-paint pixel readback now correct on
        the very first check, no retrigger needed.

      **Playwright verification pattern established for the rest of Phase E** (documented here so
      later items follow the same approach, since canvas has no DOM attributes to inspect the way
      this port's SVG components have all along): read back actual pixel colors via
      `canvas.getContext('2d').getImageData(x, y, 1, 1).data` at known CSS-pixel coordinates
      (converted to device-pixel coordinates via the page's own `devicePixelRatio` before calling
      `getImageData`, since the backing store is DPR-scaled - see `useCanvasChart.ts` above),
      comparing against the exact expected RGBA. `canvas.toDataURL()` is the whole-canvas-snapshot
      alternative when a single-pixel check isn't enough. Checks actually performed against the
      `/canvas-demo` demo (below, alongside kinetic.js): (1) initial static paint - pixel at the
      ball's center equals its fill color `[123,186,231,255]` (`#7BBAE7`), a pixel 50px above
      (outside its radius) and a corner pixel both equal the theme background
      `[255,255,255,255]`; (2) DPR-scaled backing store - `canvas.width`/`height` equal
      `Math.round(cssSize * devicePixelRatio)`; (3) after ~600ms of `animate` running, the pixel
      at the ORIGINAL center reverted to background (ball moved away) and the pixel at its NEW
      reported position (read from the demo's own on-page readout) now matches the ball color -
      confirms `force()`/`update()` actually drove real per-frame movement, not just a static
      redraw; (4) reset - center pixel returns to the ball color at the original position; (5) a
      paused "kick" (`force()` + one manual `update()` + `redraw()`) changes the on-page
      velocity/position readout with no RAF loop running, confirming `redraw()`'s manual
      single-frame path also works; (6) a small route sweep incl. `/canvas-demo` with zero
      console/page errors.

      **`hidpi.js` - read in full, evaluated against the note above, deliberately NOT adopted.**
      Confirmed from source: it's a GLOBAL polyfill that monkey-patches
      `CanvasRenderingContext2D.prototype`/`HTMLCanvasElement.prototype` draw methods (`fillRect`,
      `arc`, `stroke`, `fillText`, ...) at **module-import time**, scaling every argument by a
      `pixelRatio` computed via a top-level IIFE that synchronously calls
      `document.createElement('canvas')`. Two concrete problems disqualify it for a published
      component library, independent of the general chart-vs-utility bucket test: (1) it mutates
      shared, GLOBAL browser prototypes - every canvas on a host page this library gets embedded
      into would be silently patched, not just this library's own; a component library should
      never reach outside its own DOM subtree like that. (2) its import-time
      `document.createElement()` call breaks any non-browser (SSR) evaluation of the module graph,
      whereas `useCanvasChart.ts`'s own `resolveDevicePixelRatio()` explicitly guards `typeof
      window !== 'undefined'`. On top of both: its actual 2026 behavior degenerates to a plain
      `window.devicePixelRatio` read anyway, since the legacy `backingStorePixelRatio`/
      `webkitBackingStorePixelRatio`/etc. vendor-prefixed properties it exists to compensate for
      (circa-2013 Safari) are `undefined` in every current browser - so adopting it would trade a
      scoped, SSR-safe, non-mutating, already-correct implementation for a global-side-effect one
      with no remaining functional upside. **Decision: kept the hand-written
      `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` approach in `useCanvasChart.ts`** (the modern,
      non-monkey-patching standard technique for exactly this problem) rather than swapping to the
      import+`.d.ts` treatment for this specific file - flagging this explicitly as a considered,
      documented deviation from the mid-iteration instruction, not an oversight, in case a human
      reviewer wants to revisit it.

      `npm run test` (471/471), `npm run build:lib`, `npm run build` all clean. `ChartCanvasBase`
      exported from `src/index.ts`; `useCanvasChart.ts`'s exports are all named (no default).

- [x] `base/kinetic.js` (86) — `util.canvas.base.kinetic`, `extend: null`: a standalone physics
      object (mass/friction/position/velocity/acceleration, `force()`/`accelScalar()` etc.) with no
      chart-specific logic at all.

      **Handled via the Phase E "generic (non-chart) utility code" policy exception above, per
      explicit user instruction mid-iteration - NOT hand-ported, and this is the PERMANENT
      treatment for this file** (not a stopgap pending a future `juijs-graph` Vue port - see the
      policy section's "which bucket" test and its "known permanent-`.d.ts` files" list, which
      names this exact file: kinetic.js is a small, independently-named, self-contained physics
      value object with zero chart-domain logic, confirmed by a full read - it references
      `this.mass`/`this.pos`/etc. only, never `this.chart`/`this.axis`/a canvas context except the
      no-op `draw(context, n)` stub meant to be overridden by a future subclass - it would be
      equally at home in a completely unrelated project, unlike e.g. `base/bubble.js`/
      `base/mortalbubble.js` next iteration, which DO carry real chart-rendering logic and get a
      genuine hand-port like everything else in this project - confirmed explicitly NOT in this
      bucket by the policy section's own list).

      **What was built**: the real, unmodified implementation is vendored byte-for-byte at
      `src/vendor/kinetic.js` (copied directly from `jui-chart/src/brush/canvas/base/kinetic.js`,
      diffed against the original to confirm identical apart from one added top-of-file provenance
      comment and a trailing newline) - not sourced from the `juijs-graph` npm package, since this
      particular file lives in `jui-chart`'s own source tree, not inside `juijs-graph` itself (the
      package added to `package.json` covers the general policy for any FUTURE Phase E utility file
      that genuinely does live inside `juijs-graph`). `src/vendor/kinetic.d.ts` hand-writes full
      types for it (`Vec2`, the `KineticObject` instance shape, the `KineticModule` descriptor
      shape) - no logic, purely type annotations over the vendored file. `src/composables/
      kinetic.ts` is a thin, non-logic instantiation shim: the vendored default export is a jui
      "module descriptor" (`{name, extend: null, component}`), not a directly-`new`-able class -
      the original engine's `JUI.include("util.canvas.base.kinetic")` would call `.component()`
      for a caller; this port has no such loader, so that single call happens once here (`export
      const KineticObject = kineticModule.component()`), re-exported so `new KineticObject()` and
      `field: KineticObject` (type position) both work exactly like a real TS class import, via a
      `const`/`type` same-name merge (confirmed to typecheck cleanly under this project's
      `verbatimModuleSyntax: true` - note a `export type { X as Y }` RE-EXPORT of an identically-
      named value does NOT typecheck under that flag, "Cannot redeclare exported variable" - a
      plain `export const X = ...` + `export type X = ...` side by side in the same file does).

      **Runtime dependency**: added `juijs-graph` to `package.json`'s `dependencies` (was
      previously absent from this project entirely, dev or runtime) pinned to `1.1.4`, the exact
      version `jui-chart/package.json` itself pins as its own `juijs-graph` devDependency -
      documented via a `_dependencyNotes` field in `package.json` (JSON has no comment syntax) as a
      deliberate, PERMANENT exception to the zero-runtime-dependency rule, scoped only to generic
      non-chart utility files. `npm install` re-run clean, lockfile updated.

      **Testing** - per the policy, no hand-traced physics-correctness suite (there is no
      reimplementation of the math for this port to have introduced bugs into). `kinetic.spec.ts`
      is instead a small integration-level sanity check: the vendored module loads/instantiates
      through the real `.component()` chain, default field values match what's documented, one
      `force()`+`update()` call moves the object in the expected direction, and the full method
      surface (`distance`/`direction`/`speed`/`draw`) is present and callable. The fuller,
      real end-to-end check is the `/canvas-demo` Playwright pixel-readback verification above
      (a genuine `force()` -> multi-frame `update()` -> visible on-canvas movement chain).

      `npm run test` (471/471, +3 from the prior 468), `npm run build:lib`, `npm run build` clean.
- [x] `base/bubble.js` (43) / `base/mortalbubble.js` (76) — extend `util.canvas.base.kinetic`
      (confirmed from source). Shared bubble-rendering primitives (radius/text/color, birth/age/
      active lifecycle for `mortalbubble.js`) consumed by `activebubble.js`/`activecircle.js`/
      `bubblecloud.js` below - ported here, before the brushes that need them.

      **Classification, re-verified from source (not just taken on the prior note's word)**:
      genuine chart-rendering-domain code, hand-ported like every SVG component in Phases A-D, NOT
      vendored. No license/attribution header in either file. A web search for the most
      distinctive terms (`"MortalBubble"`/`"birthtime"`, `"animSpeed" "birthtime"` canvas bubble
      radius fade) turned up nothing resembling a published library or algorithm - only generic
      canvas-bubble-animation tutorials unrelated to this exact math. Unlike `kinetic.js`/
      `hidpi.js`/`getCurvePoints` (all confirmed external matches), this is original jui-chart
      bubble-rendering logic.

      **Composition with the vendored `KineticObject`**: `class Bubble extends KineticObject` /
      `class MortalBubble extends KineticObject` (`src/composables/bubble.ts`/`mortalBubble.ts`) -
      `KineticObject` (`src/composables/kinetic.ts`) is a plain `function` constructor (vendored
      as-is), and ES2015 `extends`/`super()` works with any constructor function, so this is the
      direct TS equivalent of the original's `extend: "util.canvas.base.kinetic"` module-loader
      inheritance. Confirmed to typecheck cleanly (`vue-tsc -p tsconfig.lib.json --noEmit`, zero
      errors) against the untyped-at-the-source vendored JS + hand-written `.d.ts` - the extends
      clause resolves against `KineticModule.component()`'s `{ new (): KineticObject }` construct-
      signature type (a standard TS mixin-extends pattern), no `any`/casts needed anywhere in
      either class.

      **A real gotcha this composition surfaced (not just a hypothetical "does it work cleanly"
      check - an actual bug caught by the hand-traced tests before being fixed)**: `draw` CANNOT be
      a normal ES2015 class-body method on either class. `KineticObject`'s vendored constructor
      (run by `super()`) sets `this.draw` to a no-op stub as an OWN property on the instance
      (because the vendored source defines it that way, not as a prototype method) - and a JS
      property lookup always finds an instance-own property before a same-named prototype method.
      A first attempt used `draw(context, now) {}` class-body methods for both classes; every
      `draw()`-dependent test failed with an empty call log / `active` never flipping to `false`,
      because `instance.draw` was permanently resolving to kinetic.js's inherited no-op stub, not
      the subclass method. **Fix, and the actually-faithful port** (not merely a workaround):
      assign `this.draw = (context, now) => {...}` as the LAST statement in each constructor, after
      `super()` and after the other fields - this exactly mirrors the ORIGINAL `Bubble`/
      `MortalBubble` constructors' own last statement (`this.draw = function(context, now) {...}`),
      which only makes sense in the first place because the original jui module loader also runs
      the kinetic "parent" constructor first, then lets the subclass constructor body overwrite the
      inherited `this.draw`. Same shadow-then-overwrite order, just expressed via `super()` +
      constructor-body assignment instead of a module-loader-mediated one.

      **Exact draw/animation logic ported** (both 1:1 from source, hand-traced): `Bubble.draw()` -
      drop shadow (fixed 10px blur, 10px down offset, no horizontal offset), a filled circle at
      `this.pos` sized `this.radius`/`this.color`, then centered text 5px below `pos[1]` (the
      original's own fixed vertical-centering fudge, preserved as-is) in `this.textColor`/a closed-
      over `textStyle` (the original captures `textStyle` as a constructor-local closure variable,
      never assigned to `this.textStyle`, unlike every other constructor argument - ported as a
      `private readonly` field instead, behaviorally identical); `now` is accepted but never read
      (confirmed from source) - `Bubble` has no lifecycle. `MortalBubble.draw()`'s age/radius/
      cross-fade math is extracted into a pure `computeMortalBubbleFrame(birthtime, age, baseRadius,
      now, animSpeed=3)` (`mortalBubble.ts`) for hand-traceable testing without a canvas context -
      same "extract the pure math" split as `useCanvasChart.ts`'s `computeCanvasBackingSize`/
      `computeFrameDelta`. Hand-traced control flow, preserved exactly: (1) `d = age - (now -
      birthtime)` (remaining lifetime); `d <= 0` -> dead, returning immediately WITHOUT undoing the
      shadow properties `draw()` already set on the context just before this check - a slightly odd
      but faithfully-preserved original behavior, not "fixed". (2) Once `d <= 100 * animSpeed` (the
      last 300ms of life at the default `animSpeed=3`), `radius` inflates linearly from 1x (at
      `d===300`) toward 2x (as `d->0`). (3) Once `d <= 80 * animSpeed` (a SUBSET of window 2, so
      `radius` there already reflects the inflation), the bubble switches from a filled circle to a
      4-armed cross: `x` sweeps 0->1 over this window; `sd` (arm start distance) grows LINEARLY
      with `x`, `ed` (arm end distance) grows via a sine ease, sharing the same `radius/3 - 2`
      amplitude plus a `+2` floor (so `sd===ed===2` at `x=0`); stroke width grows linearly 2->5.
      Every numeric case in `mortalBubble.spec.ts` was hand-traced by hand AND cross-checked against
      an isolated Node evaluation of the same formula before being hardcoded as an expected value
      (e.g. `d=120`/`x=0.5` -> `radius=48` (not itself exposed) -> `sd=9`, `ed≈11.899494936611664`,
      `stroke=3.5`).

      **Trivial canvas primitives** (`drawFilledCircle`/`drawStrokedLine`,
      `src/composables/canvasPrimitives.ts`): hand-written fresh rather than importing
      `util.canvas.base` wholesale, matching that file's own `drawCircle(x,y,d,color)`/
      `drawLine(x1,y1,x2,y2,color,lineWidth=1)` signatures exactly (per this phase's policy: no
      traceable external source, boilerplate `arc()+fill()`/`moveTo()+lineTo()+stroke()` wrappers -
      fine to hand-write as-needed). Extracted to a shared file since both `Bubble` and
      `MortalBubble` need `drawFilledCircle` (2+ consumers - this port's established extraction
      threshold).

      **Testing**: `bubble.spec.ts` (7 tests) - constructor defaults/overrides, `KineticObject`
      inheritance (`pos`/`force()`/`update()` work), and `draw()`'s exact ordered call sequence via
      a small Proxy-based recording `CanvasRenderingContext2D` stand-in (jsdom's own canvas context
      is a no-op stub, useless for asserting draw calls) - including the `dim` alpha toggle.
      `mortalBubble.spec.ts` (14 tests) - every hand-traced `computeMortalBubbleFrame` case above
      (birth/inflation-threshold/mid-inflation/cross-threshold/mid-cross/death/birthtime-relativity/
      custom `animSpeed`), `MortalBubble`'s constructor defaults and its birth-time constant
      `force([30,0])`, and `draw()`'s circle-vs-cross dispatch (including the death-frame's "shadow
      set but nothing drawn" quirk) via the same recording-context approach. 21 new tests total.

      **`/bubble-demo` Playwright verification** (new page + route, alongside `/canvas-demo`; same
      pixel-readback pattern - `getImageData()` at known CSS-pixel coordinates, DPR-converted, via
      a temporary `npx playwright` script since this project has no Playwright devDependency of its
      own): a static `Bubble` (25px radius, `#22aa55`) and a `MortalBubble` (base radius 30,
      `#c04dd9`, `birthtime=0`/`age=1000` - the exact numbers `mortalBubble.spec.ts` already hand-
      traced) whose `now` is driven by 4 deterministic preset buttons rather than a real clock, so
      pixel checks aren't timing-flaky. 16 checks, all passing: (1) Bubble circle-interior pixel
      (sampled off the text column to avoid a glyph-edge blend) = exact fill color; pixels outside
      its radius and at a page corner = background. (2) `now=0`: center = fill color; a point 32px
      above center (outside radius 30, on the side away from the shadow's `+10` Y offset so it's an
      uncontaminated read) = background. (3) `now=750` (radius grows to 35): the SAME
      previously-background point is now solid fill color - direct proof the radius actually grew,
      not just a different static frame; a point far outside even the inflated radius stays
      background. (4) `now=880` (cross mode): the exact center is NOT the solid fill color (proving
      a hollow cross, not a filled disc) though it IS faintly shadow-tinted (`shadowBlur=10` bleeds
      that close to the nearby arms - expected/faithful, not a bug); points 10px out along the +x
      and +y arms (within `[sd≈9, ed≈11.9]`) ARE the fill color; a point 30px out (beyond any arm)
      is background. (5) `now=1000` (dead): center is background and the point that was a cross arm
      at `now=880` is background too - confirms `active` truly stops all drawing, not just the
      shape. (6) DPR-scaled backing store size. (7) zero console/page errors across a route sweep
      incl. `/bar`, `/canvas-demo`, `/bubble-demo`. **One real bug this caught in the TEST SCRIPT
      itself, not the port**: `ChartCanvasBase`'s `redraw()` schedules its repaint via
      `requestAnimationFrame` (see that component's own doc comment), so a synchronous
      `page.click()` immediately followed by `getImageData()` can read a STALE frame painted before
      the new one lands; fixed by awaiting two chained `requestAnimationFrame` ticks (plus a short
      settle) after every preset click before reading pixels.

      `npm run test` (492/492, +21 from the prior 471), `npm run build:lib`, `npm run build` all
      clean. `Bubble`/`MortalBubble`/`canvasPrimitives` exported from `src/index.ts`.
- [x] `activebubble.js` (206) — canvas bubble brush, `import ... from './base/mortalbubble.js'`

      **`extend` chain confirmed from source**: `extend: "chart.brush.canvas.core"` ->
      `chart.brush.core` (`juijs-graph/src/brush/canvas/core.js` / `src/brush/core.js`) - the SAME
      SVG-side brush base Phases A-D's axis-based components all inherit `this.color()`/
      `this.getValue()`/`this.axis`/`this.brush`/`this.chart` from. `chart.brush.canvas.core` only
      adds `addPolygon()`/a depth-sorting `drawAfter()`, both purely for the hand-rolled-3D brushes
      (`dot3d.js`/`column3d.js`/`line3d.js`) - confirmed NEITHER is referenced anywhere in
      `activebubble.js`'s 206 lines, so for this brush the canvas core adds nothing over the plain
      SVG core; the only real difference is drawing to a `CanvasRenderingContext2D` instead of
      building SVG elements, and nothing in the engine itself ever calls `draw()` on a schedule
      (confirmed absent again, per the canvas-infra entry above) - `ChartCanvasBase.vue`'s
      `animate: true` RAF loop supplies that external driver in this port.

      **Genuinely non-axis-based despite living in the axis-based engine, confirmed from source**:
      never touches `axis.x`/`axis.y` at all - only `axis.area('width'/'height')` for the plot
      rectangle bounds and `axis.data` as a plain queue of rows to DRAIN (`while
      (this.axis.data.length > 0) { ...; this.axis.data.shift(); ... }`) into `MortalBubble`s whose
      position comes entirely from physics, never from any data-value-to-coordinate mapping - the
      same "non-axis-based brush in an axis-based engine" shape `BarGaugeChart` turned out to have
      in Phase B. So `ActiveBubbleChart.vue` needs none of `useChartLayout.ts`'s axis/scale
      machinery: `props.width`/`props.height` (minus an optional, port-only `title` reserve,
      matching `BarGaugeChart`/`PieChart`/`RateBarChart`'s own convention, drawn via `ctx.fillText`
      since canvas has no `<ChartTitle>` to reuse) directly ARE the plot rectangle the ported
      `ActiveBubble` physics class needs.

      **Exact spawn/lifecycle algorithm, confirmed from source (`drawBefore()` + `draw()`)**:
      `drawBefore()` lazily creates ONE `ActiveBubble` instance, cached on the chart
      (`chart.getCache`/`setCache`) for the chart's whole lifetime - `contextWidth`/`contextHeight`/
      `gravity` are fixed at that one-time creation and never re-read afterward. `draw()` drains
      `axis.data` COMPLETELY, in the same call, into new `MortalBubble`s - `this.brush.radius`/
      `opacity` (unlike `gravity`) ARE re-read from the current brush config on every spawn, and
      each row's `startTime`/`duration` resolve via `this.getValue(data, field, default)` (fallback
      `Date.now()`/`1000`). **A genuinely subtle, easy-to-miss detail confirmed by re-reading
      `draw()` closely**: the color index (`this.color(index)`) is a `let index = 0` local to THAT
      `draw()` call, not a running count across the bubble's whole lifetime - two rows drained in
      the SAME batch get different palette colors (0, 1, 2, ...), but a row drained in a LATER,
      separate `draw()` call also starts back at color index 0. **Spawning is NOT staggered by the
      brush itself** - every row present in `axis.data` when `draw()` runs becomes a bubble in that
      same tick, and (confirmed via `computeMortalBubbleFrame`, already hand-traced for the prior
      `mortalbubble.js` entry) a bubble renders from the very first frame it exists regardless of
      its own `startTime` - a future `birthtime` only delays when its DEATH countdown starts, never
      its first paint. Real staggering can only come from the CALLER adding rows over time, or from
      rows sharing one spawn tick but carrying deliberately different `duration`/`startTime` so they
      DIE at different times - exactly what those field names are designed for. **No maximum
      concurrent count and no auto-respawn anywhere in source**: `ActiveBubble.preCheck()` (run
      first thing every `step()`) splices out bubbles whose `MortalBubble.active` has flipped
      `false`; once dead, a bubble is gone for good unless the caller supplies more rows - this runs
      once per data load (a burst spawns, animates, fully dies out), not a continuous emitter.

      **Gravity, confirmed from `ActiveBubble.draw()`**: a CONTINUOUS per-frame force
      (`bubble.force([...])` + `bubble.update()` inside the same loop every `step()`/animation
      frame), not a one-time impulse. **Real, source-confirmed quirk, preserved literally, NOT
      "fixed"**: the original's own `gDirection` is hardcoded `[1, 0]`, not `[0, 1]` - so despite
      the name, the resulting force is always purely HORIZONTAL (rightward for positive `gravity`),
      never vertical/downward. Combined with `MortalBubble`'s own constructor already applying a
      one-time rightward `force([30, 0])` kick and every bubble starting at `pos = [0, 0]`
      (`KineticObject`'s default), the whole simulation drifts bubbles rightward from the top-left
      corner, vertically bounded to `[0, contextHeight]` rather than "falling" the way "gravity"
      would normally suggest - confirmed end-to-end by the Playwright pixel scan below (a "rightmost
      visible bubble pixel" scan along a near-top row moves right over time; y never drifts down).

      **Another preserved source bug, confirmed by hand-tracing `preCheck()`**: its splice loop does
      NOT decrement its own loop index after removing a dead bubble - since splicing shifts later
      elements down by one, the element that slides into the just-vacated slot is silently skipped
      THAT pass (the loop's own `i++` moves past it unchecked). A run of 2+ consecutive dead bubbles
      only has some of them removed per `preCheck()` call; the rest linger (still rendered, since
      `render()` doesn't itself check `.active`) until a LATER call. Ported literally in
      `useActiveBubble.ts`'s `ActiveBubble.preCheck()` - `useActiveBubble.spec.ts` hand-traces a
      4-consecutive-dead-bubble case through 3 full `preCheck()` calls to confirm the exact survivor
      sequence, not just "eventually clears."

      **One documented deviation**: the original's `ActiveBubble` constructor took and cached a
      `renderContext` once, for the chart's whole lifetime; `useCanvasChart.ts`'s context can be
      recreated (e.g. on a `width`/`height` change), so this port's `ActiveBubble` class never
      stores one - the original's single `draw()` is split into `step()` (physics: gravity/
      collision/bounds, no `now` parameter needed) and `render(ctx, now)` (drawing only), called
      back-to-back every frame by `ActiveBubbleChart.vue`. Changes nothing about the physics itself,
      same order/quirks throughout, including `meForce`/`otherForce` in the collision-resolution
      step being computed from `me.accel`/`other.accel` AFTER `update()` already reset them to
      `[0, 0]` earlier in the same call (so they're `[0, 0]` unless an EARLIER pair in the same loop
      already called `.force()` on the same bubble) - preserved, not "fixed."

      **Pure logic extracted and hand-traced** (`src/composables/useActiveBubble.ts`, matching this
      port's established split): `hexToRgba` (thin wrapper reusing the existing `hexToRgb` from
      `useColorScale.ts` - confirmed identical to `util.color.rgb()`'s `#`-prefixed parse branch,
      the only branch this brush ever exercises), `computeGravityForce(mass, gravity)` (the `[1,0]`
      quirk above, pure), and `buildSpawnQueue(items, colorFor, now)` (the batch-local color index +
      `startTime`/`duration` fallback resolution). The O(n²) collision-detection/resolution and
      bounds-clamp logic stayed inside the `ActiveBubble` class itself (unlike `mortalbubble.js`'s
      `computeMortalBubbleFrame`, it mutates a whole population's mutual state, not one object's own
      fields from scalar inputs - less naturally isolable into a single pure function) but is
      covered by integration-style tests against real `MortalBubble` instances instead: gravity-only
      single-bubble movement (with the constructor's own one-time `[30,0]` kick explicitly zeroed
      out first so the numbers are hand-traceable), the asymmetric x-max-only/y-both-edges bounds
      clamp, `isArrange` flipping true/false, and an exact two-bubble overlap-resolution trace
      (`radiusSum=40, dist=10 -> size=30, normal=[1,0]` -> both centers pushed apart by 15px).
      `useActiveBubble.spec.ts`: 23 tests.

      **`ActiveBubbleChart.vue`**: `props.data: DataRow[]` plays the role of `axis.data` - a
      `consumedCount` cursor drains only rows APPENDED since the last frame (`props.data.
      slice(consumedCount)`) each `@frame`, so a caller can spawn a genuinely staggered burst by
      appending rows across multiple ticks (a timer, user clicks, etc.), not just an instant dump;
      `ActiveBubble.isArrange` is force-reset `false` whenever a frame drains ≥1 new row, mirroring
      `drawBefore()`'s own `activeBubbleCount != dataCount` check. `gravity` is read once (creating/
      recreating the simulation on a `width`/`height`/`gravity`/`title` change); `radius`/`opacity`
      are re-read from props on every spawn - matching the source's own once-vs.-per-spawn split.
      `activeCount` (live population size) is exposed via `defineExpose` for demo readouts/
      Playwright, since canvas has no per-bubble DOM element to query. No click/hover event
      forwarding - confirmed `activebubble.js` itself never calls `this.addEvent(...)` anywhere.

      **`/activebubble` demo + Playwright verification** (new page + route, same pixel-readback
      pattern as `/canvas-demo`/`/bubble-demo` via a temporary `npx playwright` script): "Spawn
      burst of 8" appends 8 rows in one tick, each with a randomized `duration` (600-2600ms,
      staggering DEATH times, not spawn - see above) so the burst visibly thins out rather than all
      dying in the same frame; a live `spawned rows=/batches=/activeCount=` text readout. 12 checks,
      all passing: (1) initial state - 0 rows/batches/active, canvas corner is background. (2) after
      spawning 8: `activeCount` jumps to 8 almost immediately (no spawn staggering by the brush
      itself, confirmed) and a near-origin pixel (bubbles start at `pos=[0,0]`) is non-background.
      (3) **movement**: a helper scans a near-top canvas row (y=0-40) for the RIGHTMOST non-
      background pixel rather than guessing one fixed coordinate - confirmed `280px -> 478px` over
      900ms in one run, i.e. real rightward drift, not a static redraw (and never downward - the
      scan is capped at y=40, close to the spawn height). (4) **death**: after ~3s total (past the
      max 2600ms duration), `activeCount` returns to `0`, the near-origin pixel reverts to
      background, and `rows`/`batches` stay unchanged (confirms no auto-respawn). (5) spawning one
      more AFTER full death still works (`rows=9, batches=2, active=1`) - proves the drain-queue
      mechanism survives a full empty-out, not just a one-shot demo wiring quirk. (6) DPR-scaled
      backing store. (7) zero console/page errors across a route sweep incl. `/bar`, `/canvas-demo`,
      `/bubble-demo`, `/activebubble`.

      `npm run test` (515/515, +23 from the prior 492), `npm run build:lib`, `npm run build` all
      clean. `ActiveBubbleChart` and `useActiveBubble.ts`'s exports added to `src/index.ts`.
- [x] `bubblecloud.js` (196) — canvas bubble-cloud brush, `import BubbleMod from './base/bubble.js'`
      (the PLAIN `Bubble`, confirmed - `MortalBubble` never referenced)

      **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`, the exact
      same chain as `activebubble.js` - see `useActiveBubble.ts`'s header comment for the full
      derivation (adds only `addPolygon()`/a depth-sorting `drawAfter()`, both for the 3D brushes,
      neither referenced here either). Genuinely non-axis-based, confirmed from source: never
      touches `axis.x`/`axis.y`, only `axis.area('width'/'height')` for the plot rect and
      `axis.data` both as the row source (`this.eachData(...)`, hardcoded `"title"`/`"capacity"`
      field names, not a configurable `domain`/`target`) and as a REFERENCE-equality cache key.

      **The caching mechanism, confirmed from `component.draw()` - exactly the "avoid rebuilding
      on every render when data hasn't changed" the task anticipated, confirmed reference-based
      (`==`), not value-based**: two layers. Outer (`chart.getCache('bubble_cloud'/'bubble_data')`):
      same `axis.data` reference as last time -> skip rebuild, just re-run the physics/render step
      on the cached `BubbleCloud`; different reference (even a brand-new array with IDENTICAL row
      values) -> construct a BRAND NEW `BubbleCloud` from scratch and re-scatter every bubble to a
      random position. Inner (`BubbleCloud.processData()`'s mark-and-sweep-by-`name` diff, only
      updating a surviving bubble's `radius` past a `>20` deadband, position untouched): confirmed
      DEAD CODE in this brush's actual call pattern (the outer layer always hands `start()` an
      empty `bubbles` map on every real rebuild) - ported faithfully anyway as real, intentional
      `BubbleCloud`-class behavior, unit-tested by calling `processData()` twice on one instance
      directly (never how the actual brush exercises it).

      **Exact layout algorithm, confirmed from `BubbleCloud.draw()`** - NOT a kinetic force sim,
      despite `Bubble extends KineticObject`: (1) every bubble's `pos` is LERPED a fraction
      `animationAlpha` toward the canvas center every frame (direct position arithmetic, no
      `force()` call); `animationAlpha` starts `0.1`, decays `*= 0.99`/frame, reset to `0.1` on any
      data change. (2) an O(n²) pairwise collision-separation pass runs EVERY frame regardless of
      `animationAlpha`'s decay - confirmed real difference from `activebubble.js`: this loop is an
      ordered `(i,j)`-with-`i≠j` double loop with NO dedupe (unlike `ActiveBubble.step()`'s
      explicit collect-then-dedupe), mutating `pos` in place mid-pass so later pairs see earlier
      pairs' already-applied pushes. Hand-traced: two 10px-radius bubbles 10px apart resolve to
      EXACTLY `minDist` (24px, with `collisionPadding=4`) apart after processing ordered pair
      `(0,1)` alone (`jitter=0.5` fully closes a single pairwise overlap in one application), which
      is also confirmed by why the very next ordered pair `(1,0)` in the same pass is then a no-op.
      Because this pass never decays, the cloud converges to and then HOLDS a non-overlapping
      packed layout once gravity has faded - genuinely "settle and stay," not a continuous jitter
      loop and not a death/respawn cycle (there is no `MortalBubble` here at all). (3) `Bubble.
      update()` is called every frame for fidelity but confirmed a NO-OP: `force()` is never called
      anywhere in this file, so `veloc`/`accel` stay `[0,0]` forever and `update()`'s own `|veloc| >
      2` movement gate never opens - **this is the core physics difference from `activebubble.js`**:
      that brush is a genuine continuous kinetic force simulation (`force()`+`update()` every
      frame, drifting/never settling until death); this one only borrows `KineticObject` for
      `pos`/`radius`/`distance()`/`distancePos()`/`draw()` and does ALL its movement via direct
      position arithmetic. (4) hover (`pick(x,y)`, a `distancePos(...) < radius` hit-test, first
      match wins) dims every OTHER bubble to 50% alpha.

      **Pure logic extracted and hand-traced** (`src/composables/useBubbleCloud.ts`):
      `computeBubbleRadius(count, totalCount, w, h)` (confirmed NOT guarded against
      `totalCount === 0` - preserved, not fixed) and `computeCenterGravityStep(pos, center,
      alpha)`. `processData()`'s mark-and-sweep diff and `step()`'s collision loop stayed as
      `BubbleCloud` class methods (same rationale as `ActiveBubble.step()`'s collision logic in
      Phase E's prior entry - mutates a whole population's mutual state, tested via real `Bubble`
      instances instead of a standalone pure function). `hexToRgba` reused from
      `useActiveBubble.ts` rather than re-declared (an actual duplicate export broke the
      `export *` barrel in `src/index.ts` during this port - caught by `build:lib`). 21 new tests
      in `useBubbleCloud.spec.ts`.

      **`BubbleCloudChart.vue`**: same non-axis-based shape as `ActiveBubbleChart.vue` -
      `props.width`/`height` (minus an optional `title` reserve) directly are the plot rect.
      Renders via `ChartCanvasBase.vue`'s `animate: true` RAF loop (the settle needs several
      frames to decay, and collision-separation must keep running every frame to hold the layout).
      The reference-equality cache ports for free: comparing `props.data` by `!==` across frames
      reproduces the exact "new array ref, same values, still rebuilds" quirk since Vue hands a
      prop array through by reference. Hover wired directly via native `mousemove`/`mouseleave`
      listeners falling through `ChartCanvasBase`'s single-root `<canvas>` (source's own
      `chart.setCache('picker', ...)` mechanism routes through the still-unported generic
      `widget/canvas/picker.js` - documented as a deliberate stand-in, not assumed equivalent).

      **`/bubblecloud` demo + Playwright verification** (new page + route, same pixel-readback
      pattern as `/activebubble`, RAF-tick-awaited via a temporary `npx playwright` script): 8
      labeled "popular pages" bubbles sized by a random `capacity`; "Shuffle values" (new data,
      new array), "Same values, new array" (identical content, new reference), and "Touch cache"
      (same reference) buttons exercise all three cache paths; a live
      `rows=/rebuildClicks=/hovered=` readout. 11 checks, all passing: initial render (8 bubbles,
      non-background pixels present); the settled layout's non-background pixel count stabilizes
      within 15% across 30 frames (holds a packed layout, doesn't keep growing/shrinking); Shuffle
      and Same-values-new-array both produce a large pixel-classification diff against the
      previously-settled frame (~52k-64k px changed of ~280k total - confirmed full rescatter,
      confirmed reference equality not deep equality); Touch-cache produces a diff over 10x
      smaller (192 vs. 52001 in one run - residual settle jitter only, no rescatter) and does NOT
      bump the `rebuildClicks` readout; hovering the canvas center (where gravity clusters the
      settled cloud) sets `hovered=` to a real page name, and moving off-canvas clears it back to
      `none`; zero console/page errors across a route sweep incl. `/bar`, `/canvas-demo`,
      `/bubble-demo`, `/activebubble`, `/bubblecloud`.

      `npm run test` (536/536, +21 from the prior 515 - final count includes 2 fewer than a raw
      +23 since a duplicate `hexToRgba` test pair was dropped when that helper was reused instead
      of re-declared), `npm run build:lib`, `npm run build` all clean. `BubbleCloudChart` and
      `useBubbleCloud.ts`'s exports added to `src/index.ts`; `bubbleCloudFontColor`/
      `bubbleCloudFontSize`/`bubbleCloudFontWeight` theme tokens added to `useTheme.ts`
      (`classicTheme` only - identical across every upstream theme, `darkTheme` inherits via its
      `...classicTheme` spread, matching source having no per-theme override at all).
- [x] `activecircle.js` (174) — canvas circle brush, uses `util.canvas.base`/`util.color` directly

      **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`, the SAME
      chain as `activebubble.js`/`bubblecloud.js` (see `useActiveBubble.ts`'s header comment for
      the full derivation - the canvas core adds only 3D-polygon-sorting machinery, unused here
      too). Confirmed `util.canvas.base`/`util.color` are imported DIRECTLY (`jui.include(...)`),
      NOT `./base/bubble.js`/`./base/mortalbubble.js` - no `KineticObject` involved anywhere in
      this file; `Circle` is a wholly separate, bespoke inline physics object.

      **Genuinely AXIS-BASED, confirmed from source - the first canvas brush in this phase that
      is** (per the task's own hypothesis, verified rather than assumed): `checkWallCollision()`
      calls `this.axis.x.min()`/`.max()`/`this.axis.y.min()`/`.max()`, and `draw()`'s spawn loop
      positions every circle at `[this.axis.x(data.x), this.axis.y(data.y)]` - a real data-value-
      to-pixel mapping, not the "plot rect + data queue" shape `activebubble.js`/`bubblecloud.js`
      turned out to have (confirmed: neither of THOSE two ever touches `axis.x`/`axis.y` at all).
      `.min()`/`.max()` are confirmed only ever meaningful for a "range" grid (`grid/range.js`'s
      scale) - `grid/block.js` has no such methods, matching this port's own `LinearScale` (has
      `.min()`/`.max()`) vs. `OrdinalScale` (doesn't) split in `useScale.ts`.

      **Confirmed the hypothesis in the task prompt: `useAxis.ts`/`useChartLayout.ts` are reused
      AS-IS, no new axis/layout composable needed.** `ActiveCircleChart.vue` calls
      `useChartLayout()` - the EXACT same composable every axis-based SVG component in Phases A-D
      already calls - then feeds its computed `axisX.value`/`axisY.value` (via `toSeriesScale()`,
      already built for `ScatterChart.vue`/`HeatmapScatterChart.vue`'s own free-form per-row-field
      scale application) to `CanvasRenderingContext2D` calls instead of `<circle>` SVG elements.
      This confirms the axis/scale MATH this port already has is genuinely rendering-backend-
      agnostic - only the final draw call (`ctx.arc()`+`fill()` vs. `<circle>`) differs. No grid/
      tick chrome is drawn by this component (`activecircle.js`'s own `draw()` renders circles
      only, nothing else - grid is a separately-composited widget in the original engine, out of
      scope for a single brush's port, same as every other Phase E canvas brush so far).

      **Exact spawn algorithm, confirmed from `CanvasActiveCircleBrush.draw()` - a REAL, source-
      confirmed quirk unlike either sibling brush's own lifecycle**: `if (circles.length == 0) {
      this.eachData(...) }` via `chart.getCache("active_circle", [])`/`setCache`, with **no
      `drawBefore()` hook at all** (unlike `activebubble.js`, which resets on a data-count change)
      and **no removal/death logic anywhere in the file** (no `.active` flag, no `preCheck()`-
      equivalent). Net effect: the chart's very first frame's data permanently decides the circle
      population for the component's entire remaining lifetime - a later change to `props.data`
      (new reference, more/fewer rows) has ZERO effect once circles exist. Ported literally as
      `ActiveCircleField.step()`'s own `if (this.circles.length === 0)` gate, hand-traced directly
      in `useActiveCircle.spec.ts` (a later `step()` call with completely different rows confirmed
      to change nothing). `ActiveCircleChart.vue` exposes a port-only `reset()` (not in source, via
      `defineExpose`) that recreates the field so a caller CAN force a re-seed from current data -
      demonstrated live on the `/activecircle` demo page's "Add 2 more (no effect until reset)" /
      "Reset" buttons.

      **`Circle`'s physics, confirmed from source - NOT `KineticObject`-based, a bespoke incline-
      plane (mass/friction/gravity/normal-force) model, unlike `Bubble`/`MortalBubble`**: only
      `move()`/`stop()`/`draw()` are ever actually CALLED by the brush's `draw()` - `checkForMotion
      ()`/`calcAcceleration()` exist on every instance but their only call site is commented out
      (`// if(circle.checkForMotion(30, 1)) { circle.acceleration[1] = circle.calcAcceleration(90,
      1); circle.move(fps, tpf); // }`), confirmed dead code. Ported anyway (same rationale as
      `BubbleCloud.processData()`'s confirmed-dead mark-and-sweep diff in the prior entry) and
      unit-tested directly, never how the actual brush exercises them. **A real, preserved bug in
      `calcAcceleration()`, confirmed from source, NOT fixed**: `massToWeight(mass)` takes exactly
      ONE parameter and always multiplies by `this.gravity` internally - `calcAcceleration()`'s own
      call site passes a SECOND argument (`this.massToWeight(this.mass, this.acceleration[1])`,
      clearly intending to substitute a custom "gravity" for that one calculation) that JavaScript
      silently discards; the result always uses `this.gravity` regardless. Hand-traced in
      `useActiveCircle.spec.ts` by setting `acceleration = [0, 999]` and confirming the result is
      unchanged from the default-gravity case. `updateAcceleration()` is also ported with its
      missing `0.5` factor on the `a*t²` term preserved (physically should be `0.5*a*t²`) - not
      "fixed". `checkWallCollision()` (brush-level, also confirmed dead code - its only call site
      is commented out too) preserves a real swapped-bounds quirk: its 3rd/4th conditions compare
      `position[1]` against `maxY`/`minY` SWAPPED relative to the 1st/2nd (x) conditions, which is
      CORRECT (not a typo) given a "range" y-axis's pixel interval is reversed (`useChartLayout.ts`'s
      `yInterval` - data-min maps to the larger/bottom pixel Y) - hand-traced with realistic
      inverted bounds (`minY=300` bottom, `maxY=0` top) confirming "well inside" -> no collision and
      all four edges -> collision.

      **`move(fps, tpf)`, confirmed from source**: `fps` is accepted but never referenced in the
      body (dead parameter, kept as `_fps` for signature fidelity, matching this port's established
      `_now`-style convention). `if (tpf === 1) return` skips ALL movement - sourced from a
      SEPARATE, NOT-ported `juijs-graph/src/base/animation.js` (`chart.animation`) polling wrapper:
      its `run()` computes `tpf = (currentTime - prevTime) / 1000` clamped to a max of `1`, with
      `prevTime` starting at `0` - so `chart.animation`'s very FIRST tick always computes exactly
      `tpf === 1` (a huge `Date.now()`-sized value clamped to the ceiling), making
      `activecircle.js`'s first animated frame a deliberate no-op (avoiding a first-frame jump).
      **Documented deviation**: `chart.animation` itself isn't ported this iteration (no
      PORT_STATUS.md item requests it - it's a chart-wide real-time wrapper, not part of
      `activecircle.js` itself); `ActiveCircleChart.vue` instead drives `tpf` from
      `ChartCanvasBase.vue`'s already-built `@frame` `FrameInfo.delta` (ms, clamped to 250ms max, 0
      on the very first RAF tick), converted to seconds. This never naturally produces `tpf === 1`
      under this port's own timing, so the literal guard is kept for fidelity but is effectively
      inert - the first-frame-no-op INTENT is satisfied for free by `tpf === 0` on that same first
      frame instead (same outcome, different mechanism, not a functional gap).

      **Deviation, same rationale as `ActiveBubble`/`MortalBubble`'s own**: the original `Circle`
      constructor took and cached a `context` argument for `draw()` to close over; this port's
      `Circle.draw(ctx)` takes `ctx` as an explicit parameter instead, since `useCanvasChart.ts`'s
      context can be recreated. Likewise `scaleX`/`scaleY` are plain `(value) => number` functions
      rather than a cached `axis` object - `ActiveCircleChart.vue` passes small wrapper closures
      that read the CURRENT `axisX.value`/`axisY.value` on every call, so a circle's position still
      reflects a live resize/axis-config change exactly like the original's one persistent
      `this.axis` reference, not a one-time snapshot.

      **Pure logic hand-traced** (`src/composables/useActiveCircle.ts`): every `Circle` method
      (`checkForMotion`/`calcAcceleration`/`poundToWeight`/`weightToPound`/`massToWeight`/
      `weightToMass`/`updateAcceleration`/`move`/`stop`/`draw`) called and asserted directly against
      hand-computed values cross-checked via an isolated Node evaluation before being hardcoded
      (e.g. `checkForMotion(30, 1)` with default mass/gravity -> `perpForce(-4.9) >
      staticFriction(-8.4870489570875)` -> `true`; `move()` position math traced through two
      sequential `tpf=0.5` calls to `runtime=1.0`). `draw()` verified via a small Proxy-style
      recording `CanvasRenderingContext2D` stand-in (same technique as `bubble.spec.ts`) asserting
      the exact ordered call sequence (shadow properties, then `beginPath`/`arc`/`fillStyle`/
      `fill`). `checkWallCollision` and `ActiveCircleField`'s spawn-once/step/render behavior
      (including radius/velocity/acceleration `||`-fallback quirks) covered directly. 24 new tests
      in `useActiveCircle.spec.ts`.

      **`ActiveCircleChart.vue`**: `props.data`/`axisX`/`axisY`/`width`/`height`/`theme`/`padding`/
      `radius` (default `20`, matching `CanvasActiveCircleBrush.setup()`)/`colors`/`title` (the last
      a port-only addition, matching every other Phase E canvas component's own convention). Renders
      via `ChartCanvasBase.vue`'s `animate: true` RAF loop (continuous physics stepping, like
      `activebubble.js`/`bubblecloud.js`). No `showGrid` prop - see the "no grid chrome" note above.

      **`/activecircle` demo + Playwright verification** (new page + route, same pixel-readback
      pattern as prior Phase E demos via a temporary `npx playwright` script): axis config pinned to
      `{min: 0, max: 10, unit: 10}` (bypasses `computeRangeDomain`'s "nice" auto-step search
      entirely, matching `useAxis.spec.ts`'s own documented technique) so every circle's spawn pixel
      position is exactly hand-computable - for the demo's 480x280 canvas + default padding
      (top:20/right:24/bottom:32/left:48): `scaleX(v) = 48 + 40.8*v`, `scaleY(v) = 248 - 22.8*v`.
      Three rows: two static (`vx`/`vy` omitted, zero by default) at hand-computed positions
      `(252, 179.6)` and `(129.6, 65.6)`, one with `vx=5` (axis-domain units/second, NOT pixels -
      confirmed by `updateAcceleration()` scaling `xValue + vx*runtime` through the axis scale every
      frame) at initial position `(374.4, 202.4)`. 12 checks, all passing: (1) pre-spawn canvas
      corner is background. (2) after "Spawn": the two static rows' exact hand-computed centers
      match their exact expected theme color (`classicColors[0]` `#7977C2` / `classicColors[1]`
      `#7BBAE7`) at the exact expected pixel - direct proof the axis-scale positioning math is
      correct, not just "some circle appeared"; the moving row's color is confirmed present in a
      small window around its hand-computed initial x (exact-pixel timing is inherently fuzzy here
      since `ChartCanvasBase`'s `animate: true` RAF loop is already running continuously before the
      spawn click, so a few px of drift accumulates before the very next readable frame -
      documented, not a bug); `circleCount` readout is `3`. (3) after ~700ms: the moving row's
      initial position has reverted to background (proving real movement) and a row-scan finds its
      new rightmost visible pixel well past the initial center; the static rows are UNCHANGED at
      their exact original pixel/color. (4) "Add 2 more" grows `rows` to `5` in the readout but
      `circleCount` stays `3` - the spawn-once quirk confirmed live. (5) "Reset" then brings
      `circleCount` to `5` - confirms `reset()`'s re-seed-from-current-data path. (6) DPR-scaled
      backing store. (7) zero console/page errors across a route sweep incl. `/bar`,
      `/canvas-demo`, `/bubble-demo`, `/activebubble`, `/bubblecloud`, `/activecircle`.

      `npm run test` (558/558, +24 from the prior 536 - includes 0 duplicate-export tests dropped
      since `hexToRgba`/`drawFilledCircle` were reused, not re-declared, matching this phase's
      established convention), `npm run build:lib`, `npm run build` all clean. `ActiveCircleChart`
      and `useActiveCircle.ts`'s exports (`Circle`, `checkWallCollision`, `ActiveCircleField`,
      `ActiveCircleRow`) added to `src/index.ts`.
- [x] `dot3d.js` (166) — canvas 3D dot/point-cloud/line/area projection brush

      **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`, the SAME
      chain as every other Phase E canvas brush - this is the FIRST canvas brush in this phase
      that actually EXERCISES `chart.brush.canvas.core`'s `addPolygon()`/`drawAfter()` (a real
      back-to-front z-order sort across every dot/line/area drawn in one frame), which every prior
      sibling (`activebubble.js`/`bubblecloud.js`/`activecircle.js`) left dead.

      **Relationship to `jui-chart/src/widget/polygon/*` (the flagged check) - CONFIRMED, and more
      interesting than "unrelated" or "related"**: `dot3d.js` does NOT import anything from
      `widget/polygon/` (that directory only holds `rotate3d.js`, the interactive mouse-drag-to-
      rotate WIDGET, unrelated and still unported). But it DOES depend, essentially, on
      `chart.polygon.core`/`point`/`line` (via `jui.include`) and inline-defines a 4th,
      `chart.polygon.face`, extending `chart.polygon.core` - and **these all live in the SEPARATE
      `juijs-graph` npm package** (`jui-chart/node_modules/juijs-graph/src/polygon/{core,point,
      line,cube,grid}.js`), not in `jui-chart/src` at all. `dot3d.js` is a thin canvas-drawing
      adapter over `juijs-graph`'s real 3D vertex/matrix engine, confirmed NOT self-contained -
      exactly the check the task flagged, resolved by reading `juijs-graph/src/polygon/core.js`
      (`PolygonCore.rotate()`), `util/transform.js`, `util/math.js`, and `base/vector.js` in full.

      **REAL 3D projection math, confirmed from source - NOT a 2D shading/gradient effect**:
      `PolygonCore.rotate(depth, degree, cx, cy, cz)` builds genuine homogeneous 4x4 rotation
      matrices around all three axes (`rotate3dx`/`y`/`z`, from `axis.degree`), composed with
      `move3d`s that translate to/from a rotation center, THEN applies a separate, per-vertex
      depth-based PERSPECTIVE SCALE (`scaleValue(far, 0, depth, perspective, 1)`, shrinking a
      vertex toward `axis.perspective` as its rotated z nears the far plane). `dot3d.js` ALSO
      applies a second, independent linear depth-cue directly to a dot's RADIUS (`createDot`'s
      `tr = r * scaleValue(rawZ, 0, axis.depth, 1, perspective)`, using the dot's raw PRE-rotation
      z - unrelated to the rotated-vertex scale). No 2D-only shading path exists anywhere.

      **A real, non-obvious wrinkle found only by reading the ACTUAL caller
      (`juijs-graph/src/base/draw.js`'s `calculate3d()`), not just `PolygonCore.rotate()` in
      isolation**: the `depth` parameter `rotate()` receives is **NOT `axis.depth` directly** -
      it's `Math.max(plotAreaWidth, plotAreaHeight, axis.depth)`, and the rotation center's z is
      `axis.depth / 2` (a DIFFERENT value in general from the `depth` parameter's own `/2` used
      for the scale-step center). Both formulas are reproduced exactly in `usePolygon3d.ts`'s
      `rotatePolygonVertices()` doc comment and `Dot3DChart.vue`'s `projection` computed. Getting
      this wrong (e.g. assuming `depth` param === `axis.depth`) would have silently produced wrong
      perspective-shrink amounts whenever the plot area is larger than the configured depth - the
      common case at default padding/size.

      **External-library-match check (per Phase E policy) - NO match found, hand-ported**: no
      license header in `chart.polygon.{core,point,line}.js`, `util/transform.js`, `util/math.js`,
      or `base/vector.js`. Web search for the distinctive names (`"rotate3dx" "rotate3dy"
      "matrix3d" javascript polygon perspective scaleValue`, and separately `"PointPolygon"
      "LinePolygon" "FacePolygon" "CubePolygon"`) found no matching published library - the
      rotation matrices are the standard textbook Euler-angle formulas (conceptually similar to
      CSS's own `rotate3d()`/`matrix3d()` naming, but a bespoke same-named reimplementation, not a
      port of any specific library's code), and the per-vertex perspective-scale step is
      `juijs-graph`-specific. Resolves PORT_STATUS.md's own prior "open judgment call" note on
      these exact files (Phase E's policy section) - now settled: same bucket as `activecircle.js`'s
      bespoke `Circle` physics, hand-ported, NOT vendored+`.d.ts`'d.

      **Genuinely AXIS-BASED, confirmed from source, same pattern as `activecircle.js`**:
      `createDot`/`createLine`/`createArea` all call `this.axis.x(data[0])`/`axis.y(data[1])`/
      `axis.z(data[2])`. `Dot3DChart.vue` reuses `useChartLayout`/`toSeriesScale()` for x/y exactly
      as every axis-based SVG component does. **Deliberate, documented scope boundary**: `axis.z`
      in the original is a REAL third `chart.axis` grid (its own block/range scale, ticks,
      `"center"`-orient chrome, `isFull3D()` positioning) - porting that FULL system (plus the
      interactive `rotate3d.js` widget) is out of THIS iteration's scope, the same boundary that
      leaves `column3d.js`/`line3d.js`/`widget/polygon/rotate3d.js` for a future iteration (they'd
      all need this identical shared z-axis/rotation engine). This port therefore builds the z
      SCALE with the existing `createLinearScale()` (data z-domain -> `[0, depth]` pixels, the
      same primitive every axis composable already uses) and hand-reproduces `calculate3d()`'s
      depth/center formula, but renders NO z-axis tick/grid chrome (matching `activecircle.js`'s
      own "no grid chrome drawn" precedent) and does not port the rotation widget - `Dot3DChart.vue`
      exposes plain `degreeX`/`degreeY`/`degreeZ` props instead, demonstrated via button-driven
      rotation on the demo page.

      **Two real, preserved bugs found via careful source reading, confirmed NOT fixed here**:
      (1) `draw()`'s loop computes `isLast` as `i == data.length-1` where `data` is `datas[i]` -
      THE CURRENT ROW ITSELF (shadowing the outer `datas` array), not the row count - since every
      row ends up length 3 after the 2D-row `z`-push, `isLast` is actually `i === 2` REGARDLESS of
      how many rows exist, true exactly once (at the 3rd row), never at the series' true end unless
      it happens to have exactly 3 rows. This gates the `"poly"` symbol's closing-fill logic.
      (2) `firstCacheData` (the poly-fill's anchor point) is a `var` scoped to the WHOLE brush
      instance, set only once ever and NEVER reset - so a `"poly"` chart's fill triangle keeps
      closing back to whatever point its FIRST-ever `draw()` call cached, even after completely
      different data replaces it on a later redraw. Ported via a caller-supplied, mutable
      `PolyFillCache` object (`useDot3d.ts`) that `Dot3DChart.vue` creates ONCE for the component's
      lifetime (same "created once, no prop-watch reset" pattern as `ActiveCircleChart.vue`'s
      `field`) - the staleness-across-redraws behavior is preserved, not fixed. Both hand-traced
      directly in `useDot3d.spec.ts` (4/2/3/4-row cases confirming `isLast` fires only at index 2,
      and a cross-call test confirming a stale cached anchor survives a full data replacement).
      **A third, smaller preserved quirk**: the `"poly"` fill itself only fills the LAST segment's
      triangle back to the cached point (one continued canvas path, `stroke()` then one more
      `lineTo()`+`fill()`) - not the interior of the whole polygonal line strip (each earlier
      segment's path was already discarded by its own `beginPath()`). **A fourth, in
      `createArea`**: `FacePolygon`'s two baseline vertices (and the current-point vertex) all
      share the CURRENT point's z, not each vertex's own - Node-cross-checked in
      `useDot3d.spec.ts` (baseline verts landing at the same projected z, differing from the
      lone previous-point vertex's own).

      **`radiusDepthScale()`'s preserved `axis.depth === 0` NaN pitfall**: `chart.axis`'s own
      `depth` config defaults to `0` - at that default, `scaleValue(z, 0, 0, 1, perspective)`
      divides by zero (`0/0` when `z` is also `0`, as it always is for 2D-only data), yielding
      `NaN` radii for every dot, not guarded in the original either. `Dot3DChart.vue`'s `depth`
      prop default matches `chart.axis`'s own `0` for config fidelity, but the `/dot3d` demo page
      (like any real-world usage of this brush) sets a meaningful non-zero `depth`. Hand-traced
      directly as its own test (`radiusDepthScale(10, 0, 0, 0.9)` -> `NaN`).

      **Pure logic extracted to two composables**: `src/composables/usePolygon3d.ts` (the
      `juijs-graph` 3D engine slice `dot3d.js` needs - `Vertex4`/`Matrix4` types,
      `move3dMatrix`/`scale3dMatrix`/`rotate3dx/y/zMatrix`, `multiplyMatrixMatrix4`/
      `multiplyMatrixVector4` (split from the original's single polymorphic `matrix3d(a,b)` into
      two clearly-typed functions, same output either way), `rotatePolygonVertices()`
      (`PolygonCore.rotate()`), `maxZ()`) and `src/composables/useDot3d.ts` (the brush logic:
      `buildDot3dDraws()`/`sortDot3dDraws()`/`radiusDepthScale()`, `Dot3dRow`/`Dot3dSymbol`/
      `Dot3dDraw`/`PolyFillCache` types). `scaleValue()` added to `mathUtil.ts` (`math.js`'s
      generic linear-interpolation helper, reused by both composables).

      **Hand-traced AND Node-cross-checked** (`usePolygon3d.spec.ts`, 16 tests): matrix builders
      against source's literal branches; `rotate3dyMatrix(90)` on `(1,0,0)` -> `(0,0,-1)`
      (standard right-handed Y-rotation, perspective=1 to isolate rotation from scaling);
      `rotatePolygonVertices` identity-rotation-at-z=0 (unchanged, `s=1` exactly) and
      identity-rotation-at-z=depth (`s=0.9` exactly, hand-computed scale-center arithmetic); a
      non-origin rotation center staying fixed under its own rotation. A standalone Node
      reimplementation of the same formulas was run against these exact inputs before writing the
      assertions (values match to floating-point precision). `useDot3d.spec.ts` (13 tests):
      `radiusDepthScale` hand-traced at z=0/depth/depth-2 plus the NaN-at-depth-0 quirk; `"dot"`
      mode's full position/radius/order computed by hand for a two-point scene and confirmed
      `sortDot3dDraws` paints the farther-shrunk point first; the `isLast`/`firstCacheData`
      bugs (above); the `"area"` baseline-z quirk (Node-cross-checked coordinates).

      **`Dot3DChart.vue`**: `props.data`/`axisX`/`axisY`/`width`/`height`/`theme`/`padding`/
      `symbol` (default `"dot"`)/`size` (default `4`)/`colorIndex` (default `0` - ONE color for
      the whole series, matching `this.color(this.brush.color)` being called once, not per-row)/
      `depth`/`degreeX`/`degreeY`/`degreeZ`/`perspective` (defaults `0`/`0`/`0`/`0`/`0.9`, matching
      `chart.axis`'s own config defaults exactly)/`zDomain` (port-only, since no z-axis grid is
      ported - see above)/`title`. Renders via `ChartCanvasBase`'s `animate: false` mode (this
      brush has no physics loop of its own, unlike `activebubble`/`bubblecloud`/`activecircle` -
      `ChartCanvasBase.vue`'s own header comment already names `dot3d` as a "static per render"
      example) - since that wrapper only auto-redraws on its OWN `width`/`height`/`theme`/`animate`
      props, every other prop this component's `@frame` handler reads is watched explicitly to
      call `redraw()`.

      **`/dot3d` demo + Playwright verification** (same temporary `npx playwright` pixel-readback
      pattern as every prior Phase E demo): axis pinned to `{min:0,max:10,unit:10}` on both x/y;
      `depth=500` DELIBERATELY exceeds the 480x300 canvas's plot area (408x248 at default padding)
      so `effectiveDepth = Math.max(408, 248, 500) = 500 = depth` exactly, making the "far plane"
      land exactly at `zDomain=[0,10]`'s own max. Point "A" (`x:5,y:5,z:0`) -> hand-computed pixel
      `(252,144)` (the plot-area center, coincidentally) with `s=1` exactly (z=0 -> `far=depth` ->
      no perspective shrink at all) and radius `8` (size 16). Point "B" (`x:2,y:8,z:10`) -> pixel
      `(141.84,77.04)`, radius `7.2` (`far=0` -> `s=perspective=0.9` exactly). Checks, all passing:
      (1) both points' exact hand-computed center pixels match the theme color; a point just
      inside each computed radius is filled, just outside is background. (2) clicking "Rotate Y
      +15deg" moves point A's pixel away from `(252,144)` (now background there) - confirms live
      rotation actually redraws through the real projection math, not a static snapshot. (3)
      "Reset rotation" returns point A's pixel to its exact original position/color - confirms the
      prop-watch `redraw()` wiring. (4) cycling every `symbol` value (`line`/`poly`/`area`/`dot`)
      and a route sweep (`/dot3d`, `/activecircle`, `/bubblecloud`, `/canvas-demo`) both produced
      zero console/page errors.

      `npm run test` (587/587, +29 from the prior 558), `npm run build:lib`, `npm run build` all
      clean. `Dot3DChart` and `usePolygon3d.ts`/`useDot3d.ts`'s exports added to `src/index.ts`.
- [x] `equalizercolumn.js` (256, canvas version - distinct from the already-shipped SVG
      `equalizerbar.js`/`equalizercolumn.js` behind `BarChart`'s `equalizer` prop from Phase B),
      together with `widget/raycast.js` (68, folded into this entry - not tracked as its own
      checklist line) - this iteration also revisited `widget/canvas/picker.js` alongside these
      two (see its own entry below), per this bullet's own prior note to do so together.

      **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"` -> `"chart.
      brush.core"`, the same chain as `activecircle.js`/`activebubble.js`/`bubblecloud.js` -
      `addPolygon()`/3D depth-sorting `drawAfter()` are dead here too (grepped the full 256 lines:
      zero references).

      **NOT 3D - confirmed by a full read, correcting this bullet's own prior speculation**:
      "equalizer" here is a plain 2D stacked bar/column visual (canvas `rect()`/`fill()`) with an
      animated level-meter bounce overlay (`moveTo`/`lineTo`/`stroke()`/`fillText`) - it never
      references `chart.polygon.*`, `usePolygon3d.ts`, or any vertex/matrix math. The task brief's
      hypothesized chain (`equalizercolumn -> picker.js -> raycast.js`, raycast doing 3D hit-testing
      against `chart.polygon.core`) was investigated and found wrong on every count - see the real
      dependency graph below.

      **Real dependency graph, confirmed by grepping the FULL `jui-chart` + `juijs-graph` tree for
      every cache key either widget reads**: `equalizercolumn.js` writes `raycast_area_${i}`/
      `equalizer_${i}`/`equalizer_move_${i}` - `raycast_area_*` has exactly ONE reader anywhere,
      `widget/raycast.js`. `widget/canvas/picker.js` reads a COMPLETELY DIFFERENT cache key
      (`'picker'`), whose sole writer is `brush/canvas/bubblecloud.js` (already ported).
      `equalizercolumn.js` and `picker.js` have NO relationship at all - confirmed against both
      brushes' own example HTML (`examples/equalizercolumn.html` wires `widget: [{type:
      "raycast"}]` only; `examples/bubblecloud.html` wires `widget: [{type: "canvas.picker"}]`
      only). So: `equalizercolumn.js` gives `raycast.js` its real consumer (superseding Phase D's
      "transitively out of scope" call on `raycast.js`, now that its sole producer exists);
      `picker.js`'s real consumer was `bubblecloud.js` all along, already ported as a direct-call
      stand-in - see that entry below for how this iteration gave it a genuine port instead.

      **`raycast.js` itself, confirmed NOT 3D / NOT a nearest-point or spatial-index hit-test** (re-
      investigated per this bullet's own task brief, superseding Phase D's now-stale
      "transitively out of scope" writeup above): a plain axis-aligned point-in-rectangle test
      against the cached area, gated by resolving a block-axis category index from the click's x
      position. `rangeAxis` (the "one block + one range axis" pair `setRayCastEvent` requires) is a
      confirmed-DEAD parameter of the hit-test itself - only a presence gate. Internal class name
      `DragSelectWidget` - a copy-paste leftover, not a naming hint. **No license header, and a web
      search for its own distinctive names (`emitBlockAndRangeEvent`, `blockAxis.invert`) found no
      external library match** - bespoke jui-chart code, hand-ported (not vendored), per Phase E's
      "recognizably lifted from a real library" test.

      **Block-index resolution, Node-cross-checked (not assumed)**: source's own `grid/block.js`
      `invert(x) = Math.ceil(x/rangeBand)` (1-indexed, plot-local) plus `raycast.js`'s own `- 1`.
      This port's existing `OrdinalScale.invert()` (`useScale.ts`, already used by `cross.js`'s
      port) computes `floor(...)` in this port's own canvas-absolute frame; a 1428-sample sweep
      (a scratch Node script during this port, non-boundary-aligned step) found these algebraically
      equal for every non-exact-boundary pixel, differing only at an exact category-boundary pixel
      (an inherent floor-vs-ceil tie-break, unreachable with real click coordinates).
      **Conclusion: `axis.scale.invert(canvasX)` already reproduces `blockAxis.invert(chartX) - 1`
      with no extra `-1`** - see `useRaycast.ts`'s header comment for the full derivation.

      **Block-train stacking math reused, not re-derived**: `equalizerStackedBlocks`/
      `equalizerUnitSize`/`rangeAxisTickBand` (`useSeries.ts`, extracted from the already-ported SVG
      sibling `equalizerbar.js`/`equalizercolumn.js` behind `BarChart`'s `equalizer` prop) - the
      block-train algorithm is byte-identical between the SVG and canvas siblings (confirmed by
      diffing both `draw()` methods), so this canvas brush is the "extract once 2+ consumers need
      the same thing" convention's second payoff.

      **Two confirmed-dead fields dropped from the port (zero rendered-pixel effect, not a
      behavior change)**: `getBarElement()`'s `stroke`/`stroke-width`/`stroke-opacity` are computed
      and assigned to the canvas context but `.stroke()` is never called in the block-drawing loop
      (only `.fill()`) - border config is inert. `hidden: value == 0` is computed but never read
      anywhere after `getBarElement()` returns.

      **Two confirmed, PRESERVED source bugs**: (1) the error-flag draw calls `save()` TWICE but
      `restore()` only ONCE - a real, unbalanced canvas-state-stack leak, ported literally (not
      fixed to a balanced pair). (2) the animated total-label's `font` is set to `` `${barFontSize}
      px` `` with NO font-family (contrast the error flag's own font, which correctly includes one)
      - ported literally.

      **A confirmed, source-accurate SIMPLIFICATION (byte-identical output)**: for an error column,
      source's flag-draw sits inside the per-target loop and nothing advances the row's shared `y`
      in that branch, so an N-target row draws the IDENTICAL flag N times at the same coordinates -
      this port draws it once per error row instead (same pixels, since the fill is opaque).

      **Pure logic extracted and hand-traced** (`src/composables/useEqualizerColumn.ts`):
      `isDisabledIndex`/`isErrorColumn` (the `active`/`error` array-or-integer-or-null index
      checks), `getTargetColumnWidth`, `computeErrorFlagGeometry` (the error-flag's derived
      geometry), `stepEqualizerBounce` (the level-meter's sawtooth bounce - `UP_SEC_PER_MOVE=20`/
      `DOWN_SEC_PER_MOVE=30`, hand-traced through a full 14-step cycle back to the exact starting
      state, Node-cross-checked). `src/composables/useRaycast.ts`: `resolveRaycastBlockIndex`/
      `raycastHitTest`/`raycastPick`, hand-traced against a 4-category/600px axis matching the
      demo's own config. 27 new tests across both files (`useEqualizerColumn.spec.ts`,
      `useRaycast.spec.ts`).

      **`EqualizerColumnChart.vue`**: axis-based like `activecircle.js` (reuses `useChartLayout()`/
      `useAxis.ts` as-is, column mode only). `animate: true` (continuous - source recomputes the
      full stacked layout every `draw()` call with no cache-hit skip, unlike `bubblecloud.js`, AND
      the bounce animation needs per-frame ticking). **Vue integration shape for the raycast click
      wiring**: `raycast.js`'s own `draw()` has no independent visual surface (an empty `<g>`, pure
      event-remapping) - matches this port's established "opt-in behavior on the host component"
      bucket (same reasoning as `bubblecloud.js`'s own direct `pick()` call), so
      `EqualizerColumnChart.vue` calls `resolveRaycastBlockIndex`/`raycastPick` directly from its
      own native `@click` handler and exposes `pickedRow`/`pickedIndex`, rather than introducing a
      standalone widget component or a new `ChartCanvasBase.vue` prop/event.

      **`/equalizercolumn` demo + Playwright verification** (new page + route, RAF-tick-awaited):
      4 date categories, 3 stacked targets (normal/warning/fatal, matching source's own
      `examples/equalizercolumn.html`), `active: [0, 2]`, toggleable `error: [0]`. 14 checks, all
      passing: column 0 (error on) renders the red flag (solid-fill pixel confirmed via a 5px grid
      probe, `dist<30` from pure red); column 2 (active, index 2) renders an EXACT full-opacity
      palette color; column 1 (dimmed, excluded from `active`) renders a BLENDED (non-exact) color,
      confirming `barDisableBackgroundOpacity` is real; **interactive picking**: clicking column 2's
      rendered pixel sets `pickedIndex=2`, clicking column 1's sets `pickedIndex=1`, clicking empty
      background leaves the prior pick UNCHANGED (matching source's own "only emits on a hit, never
      clears" behavior), `reset()` clears it back to `none`; toggling error off replaces the red
      flag with real stacked blocks; "Update values" changes the rendered totals; zero console/page
      errors across a route sweep incl. `/bar`, `/equalizer`, `/bubblecloud`, `/activecircle`,
      `/dot3d`, `/canvas-demo`.

      `npm run test` (614/614, +27 from the prior 587), `npm run build:lib`, `npm run build` all
      clean. `EqualizerColumnChart` and `useEqualizerColumn.ts`/`useRaycast.ts`'s exports added to
      `src/index.ts`; `equalizerColumnErrorBackgroundColor`/`equalizerColumnErrorFontColor` theme
      tokens added to `useTheme.ts` (`classicTheme` only, identical across every upstream theme -
      `darkTheme` inherits via its `...classicTheme` spread, matching source having no per-theme
      override, same convention as `bubbleCloudFont*`).
- [x] `column3d.js` (89) / `line3d.js` (82) — `chart.brush.polygon.column3d`/`line3d`, 3D bar/line
      charts via the shared `chart.polygon.*` rotation/perspective engine.

      **`extend` chain, confirmed from source**: BOTH `extend: "chart.brush.polygon.core"` ->
      `"chart.brush.core"` (`juijs-graph/src/brush/polygon/core.js`) - a DIFFERENT Phase E base
      from every prior canvas brush's `chart.brush.canvas.core`. `chart.brush.polygon.core` adds
      exactly one method, `createPolygon(polygon, callback)`: calls the shared `chart.draw`
      method `this.calculate3d(polygon)` (confirmed IDENTICAL to the one `dot3d.js` already uses -
      not brush-specific), invokes `callback`, then stamps `element.order = axis.depth -
      polygon.max().z` on its return value for a real per-element z-sort - the SVG-side analog of
      `chart.brush.canvas.core`'s `addPolygon()`/`drawAfter()`, confirmed via
      `juijs-graph/src/util/svg.js`'s `appendAll()`, which sorts a `<g>`'s children by `.order`
      before appending to the DOM whenever any child's `order > 0`.

      **A real surprise, confirmed by a full read - renders SVG, NOT canvas**: both files live
      under `jui-chart/src/brush/polygon/`, not `brush/canvas/`, and build
      `this.svg.group()`/`this.svg.polygon()` - literal SVG output, never touching a
      `CanvasRenderingContext2D`. The "3D" is entirely in the VERTEX MATH; once projected to 2D,
      vertices are drawn as ordinary painter's-algorithm-sorted SVG polygons. Ported as
      `Column3DChart.vue`/`Line3DChart.vue` composing `ChartBase.vue` (this port's SVG
      scaffolding, same as `BarChart.vue`), NOT `ChartCanvasBase.vue` - correcting this task's own
      "canvas 3D" framing.

      **Real 3D via the SAME `chart.polygon.*` engine `dot3d.js` already wraps, confirmed from
      source**: `column3d.js`'s `createColumn` builds a `new CubePolygon(x, yy, z, w, y-yy, h)`
      (`chart.polygon.cube`, 8 vertices/6 faces, `extend: "chart.polygon.core"` - the exact same
      `PolygonCore.rotate()` pipeline `usePolygon3d.ts`'s `rotatePolygonVertices()` already ports).
      `line3d.js`'s `createLine` instead makes 4 separate calls each wrapping a single-vertex
      `PointPolygon` (`chart.polygon.point` - the SAME primitive `dot3d.js`'s own `createDot`
      already uses). **`usePolygon3d.ts` needed exactly one addition**: `cubeVertices()` +
      `CUBE_FACES` (ported from `chart.polygon.cube` - `dot3d.js` only ever built 1-4-vertex
      point/line/face polygons, never a full 8-vertex/6-face box). Also added: a generic
      `computePolygon3dProjection()` (the `calculate3d()` center/effectiveDepth derivation,
      shared by both new components rather than duplicated) and `darkenColor()` (ported from
      `juijs-graph/src/util/color.js`'s `lighten`/`darken` - needed by both brushes' stroke color,
      no prior Phase E brush needed it). `dot3d.js`'s own `Dot3dProjection`/inline projection logic
      was deliberately left untouched (zero risk to that already-verified component) rather than
      retrofitted onto the new shared helper.

      **column3d.js and line3d.js are closely related but NOT identical structure, confirmed by
      reading both in full** (per this task's own explicit instruction not to assume): same
      `extend` chain, same engine, same axis-based/z-block-axis shape, but the actual per-cell
      GEOMETRY differs genuinely - one `CubePolygon` (8 vertices, 6 faces) per (row, target) cell
      for columns vs. a flat 4-point ribbon quad per (row-to-row segment, target) cell for lines
      (built from 4 separate single-vertex `PointPolygon` calls, whose `createPolygon()` callbacks
      never `return` anything, so `order` is instead computed BY HAND after the loop - ported as
      `useLine3d.ts`'s own batch `maxZ()` call, behaviorally identical to source's incremental
      `maxPoint` tracking). Built as two separate composables (`useColumn3d.ts`/`useLine3d.ts`)
      and two separate components rather than a forced shared one - no shared composable would
      have been the right shape for genuinely different geometry.

      **Genuinely AXIS-BASED, with a REAL third (z) axis - unlike `dot3d.js`'s deliberately
      scope-limited linear z**: both call `this.axis.x(dataIndex)`/`this.axis.y(...)`/
      `this.axis.z(targetIndex)`, and `juijs-graph/src/base/axis.js`'s `drawGridType()` confirms
      `axis.z` is a REAL `chart.grid.block` (ordinal) grid - same TYPE as an x-axis category axis,
      just `orient: "center"` forcing `chart.grid.core`'s `getGridSize()` into its `isFull3D()`
      branch (`start=0, size=depth, end=depth`, confirmed from source) instead of a plot-edge
      pixel span. This means the z-axis's real upstream domain IS the `target`/series list itself
      (one z-slot per target, confirmed from `createColumn`/`createLine`'s own `targetIndex`
      parameter) - so the SAME `createOrdinalScale()` primitive `useAxis.ts` already uses for x/y
      block axes is directly reusable for z, just with domain=`target` and range `[0, depth]`.
      Built inline in each component (a 3-line `createOrdinalScale` call, not enough to warrant a
      `useZAxis.ts`). **Deliberately NOT ported**: real z-axis tick/grid CHROME - matching
      `dot3d.js`'s own already-documented scope boundary (this file's own prior entry named these
      two files as sharing that exact boundary).

      **`padding` DEFAULTS genuinely differ between the two - confirmed from each file's own
      `setup()`, not a copy-paste slip**: `column3d.js` defaults `padding: 20`; `line3d.js`
      defaults `padding: 10`. Ported as each component's own independent default
      (`cubePadding`/`ribbonPadding`).

      **Color, confirmed from source**: `column3d.js`'s `this.color(targetIndex)` and
      `line3d.js`'s `this.color(dataIndex, targetIndex)` (2 args) both reduce to the SAME
      per-TARGET color in this port's supported (non-function `colors`) mode - confirmed from
      `brush/core.js`'s own `this.color(key1, key2)`: with `key2` given, `colorIndex=key2`,
      `rowIndex=key1` is read but never used for the plain-array/undefined `colors` path
      (`this.chart.color(colorIndex, colors)`). Ported as the same `pickColor(targetIndex)` shape
      `BarChart.vue` already uses. Fill/stroke: `fill-opacity: theme("polygon{Column,Line}
      BackgroundOpacity")` (0.6/0.6); stroke = `ColorUtil.darken(color,
      theme("polygon{Column,Line}BorderOpacity"))` (0.5/0.7) WITH `stroke-opacity` set to that
      SAME number again - a real, preserved quirk (the same theme number reused as both a
      darken-RATE and a stroke-OPACITY), ported literally via `darkenColor()`, not "fixed" to two
      independent values. 4 new theme tokens (`polygonColumnBackgroundOpacity`/
      `polygonColumnBorderOpacity`/`polygonLineBackgroundOpacity`/`polygonLineBorderOpacity`) -
      confirmed identical across all 4 upstream theme files, so only `classicTheme` sets them
      (`darkTheme` inherits via its spread, same convention as `bubbleCloudFont*`).

      **Per-element event forwarding - column3d.js only, confirmed by a full read**:
      `createColumn`'s own `if(data[target] != 0) this.addEvent(g, dataIndex, targetIndex)`,
      wired on the column's whole 6-face `<g>` (matching source calling `addEvent` on `g`, not
      per-face). `line3d.js` never calls `addEvent` anywhere - `Line3DChart.vue` emits nothing,
      matching this port's "only wire what source actually wires" convention.

      **External-library-match check (per Phase E policy)**: no license header in either brush
      file (bespoke jui-chart code, already in this file's own "confirmed genuine chart-engine"
      list) or in `chart.polygon.cube`/`point`/`core` (already checked as part of `dot3d.js`'s own
      engine audit - that web search for "PointPolygon" "LinePolygon" "FacePolygon" "CubePolygon"
      explicitly included the cube name and found no matching published library). `darkenColor()`
      (`util/color.js`'s `lighten`/`darken`): no license header; a web search for "lighten"
      "darken" hex color javascript `c + (c * rate)` found no single matching published library -
      same bespoke/hand-ported bucket as `rotatePolygonVertices`, not vendored+`.d.ts`'d.

      **Pure logic extracted and hand-traced**: `usePolygon3d.ts`'s new `cubeVertices()`/
      `CUBE_FACES`/`computePolygon3dProjection()`/`darkenColor()`; `useColumn3d.ts`'s
      `resolveColumnSize()`/`buildColumn3dDraws()`/`sortColumn3dDraws()`; `useLine3d.ts`'s
      `buildLine3dDraws()`/`sortLine3dDraws()`. 18 new tests, using the same
      "perspective=1 + degree={0,0,0} forces a pure passthrough" isolation technique
      `usePolygon3d.spec.ts`'s own non-origin-rotation-center test established, to test each
      file's own cube/ribbon-assembly and z-order logic independently of the (separately,
      exhaustively tested) `rotatePolygonVertices()` math itself. `darkenColor()` Node-cross-checked
      against a standalone reimplementation of the same per-channel formula.

      **`Column3DChart.vue`/`Line3DChart.vue`**: both compose `ChartBase.vue` for real x/y axis
      chrome (`useChartLayout()`, exactly like `BarChart.vue`), with a z ordinal scale (no
      chrome). `props.target: string[]` doubles as the z-axis domain (its real upstream meaning -
      see above), plus `depth`/`degreeX/Y/Z`/`perspective` matching `chart.axis`'s own config
      defaults exactly (`0`/`0`/`0`/`0`/`0.9`). `Column3DChart` additionally exposes
      `colWidth`/`colHeight`/`cubePadding` (source `width`/`height`/`padding`) and forwards
      `click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` per column; `Line3DChart` exposes
      `ribbonPadding` and emits nothing (see above).

      **`/column3d` + `/line3d` demos, Playwright-verified with EXACT SVG geometry cross-check
      (stronger than pixel-readback - these brushes render real SVG, not canvas)**: 480x300,
      default padding (plot area 408x248), `depth=500` (dominates `effectiveDepth`, same trick as
      `/dot3d`). Rather than hand-deriving every one of 2 columns' 8 rotated/perspective-scaled
      vertices by hand (intractable to do reliably for a full cube face), expected geometry was
      computed independently via a Node script calling the SAME exported, already-unit-tested
      `buildColumn3dDraws`/`buildLine3dDraws`/`computePolygon3dProjection`/`createOrdinalScale`/
      `createLinearScale` functions from the built `dist-lib` output with the demo's own
      axis/prop values, then compared BYTE-FOR-BYTE against the live page's rendered `<polygon
      points="...">` attributes - this checks the Vue component's own WIRING (props ->
      scale/projection assembly -> rendered markup), the one thing unit tests alone can't catch,
      while the underlying projection formula itself stays covered by `usePolygon3d.spec.ts`'s
      existing exhaustive tests. Checks, all passing: (1) all 4 rendered column groups' front face
      (`CUBE_FACES[4]`) points match the independent computation exactly (e.g. column
      (dataIndex=0,target='a')'s face: `[68.736,267.504] [232.08,267.504] [232.08,168.7008]
      [68.736,168.7008]`), including z-sort DOM order (`(0,'b')`/`(1,'b')` before `(0,'a')`/
      `(1,'a')`, matching each pair's own `order` value); (2) clicking "Rotate Y +15deg" changes
      that same face's rendered points (confirms live re-projection, not a static snapshot); (3)
      "Reset rotation" restores the EXACT original points string; (4) `/line3d` renders exactly 4
      polygons (`(rows-1)*targets = 2*2`), the first matching the independent computation exactly
      (`123.072,120.4896 129.328,121.6304 252,188.7392 252,191.0208`); (5) rotation changes
      `/line3d`'s geometry too; (6) clicking a rendered column fires `@click` with the correct
      `{dataKey, dataIndex}`; (7) zero console/page errors across a route sweep incl. `/column3d`,
      `/line3d`, `/dot3d`, `/bar`, `/equalizercolumn`. Also visually confirmed via screenshot: at
      degree (0,0,0) both charts render their genuine "flat until rotated" projection (z
      contributes nothing to x/y with no rotation applied - the same, correct, orthographic-camera
      behavior `dot3d.js`'s own hand-trace already established, not a bug); at a nonzero rotation,
      real 3D cubes/depth are visible.

      `npm run test` (632/632, +18 from the prior 614), `npm run build:lib`, `npm run build` all
      clean. `Column3DChart`/`Line3DChart` and `useColumn3d.ts`/`useLine3d.ts`'s exports added to
      `src/index.ts`; `usePolygon3d.ts`'s new exports (`cubeVertices`/`CUBE_FACES`/
      `computePolygon3dProjection`/`darkenColor`) already flow through its existing `export *`.
- [x] `widget/canvas/picker.js` (64) — canvas click hit-testing widget, revisited alongside
      `equalizercolumn.js`/`raycast.js` above (per that entry's own note), though it turned out to
      be unrelated to either - see the real dependency graph in the `equalizercolumn.js` entry
      above: `picker.js`'s own `'picker'` cache key's sole writer is `bubblecloud.js` (already
      ported), not `equalizercolumn.js`.

      **`extend` chain, confirmed from source**: `extend: "chart.widget.core"`, same as every
      other Phase D/E widget. **The entire mechanism** (confirmed by a full read): wires
      `axis.click`/`axis.dblclick` (always) + `axis.mousemove` (only when `widget.hover`, default
      `false`) listeners that read `chart.getCache('picker')` and call the registered
      `checker.func.call(checker.obj, x, y)`, re-emitting `picker.click`/`picker.dblclick` with
      `{brush, data}` only on a non-`null` result. No geometry of its own - a generic "map a
      pointer event to a brush's already-registered `pick(x,y)`, gate on hover/click/dblclick"
      dispatch layer, unlike `raycast.js`'s self-contained rectangle test.

      **Vue integration shape, same reasoning as `raycast.js`**: no independent visual surface -
      opt-in behavior on the host component, not a standalone widget. `runPickerCheck`
      (`src/composables/usePickerWidget.ts`) is the whole reusable mechanism (a thin null-checked
      dispatch, hand-traced with 3 tests in `usePickerWidget.spec.ts`).

      **Real, non-fabricated consumer**: `BubbleCloudChart.vue` (`bubblecloud.js`'s own `pick()`
      call, previously a documented "deliberate stand-in" for this not-yet-ported widget) was
      retrofitted to route its existing hover through `runPickerCheck`, AND gained NEW `@click`/
      `@dblclick` handlers (source's own `examples/bubblecloud.html` wires `widget: [{type:
      "canvas.picker"}]` + a `picker.dblclick` handler - click/dblclick support didn't exist in
      this port before this iteration). Exposes `pickedRow`/`pickedLabel`/`pickedVia` (`'click'` |
      `'dblclick'`), only updated on an actual hit (matching source's own "only emits on a hit,
      never clears" behavior - same as `EqualizerColumnChart.vue`'s `pickedIndex`).

      **`/bubblecloud` demo, Playwright-verified** (existing page, new readout line added): 5
      checks, all passing - hovering near the settled cloud's center finds a real bubble name;
      clicking that same point sets `picked=<same name> via=click`; double-clicking EMPTY space
      leaves the pick unchanged (`via=click` still, confirming the miss-leaves-unchanged behavior);
      double-clicking the SAME bubble updates to `via=dblclick`; zero console/page errors.

      `npm run test` (614/614, shared count with the `equalizercolumn.js` entry above - both
      landed in the same iteration), `npm run build:lib`, `npm run build` all clean.
      `usePickerWidget.ts`'s exports added to `src/index.ts`.
- [x] `widget/polygon/rotate3d.js` (92) — 3D rotation control widget (interactive mouse-drag-to-
      rotate), pairs with `column3d.js`/`line3d.js`/`dot3d.js` (all three previously ported with
      plain `degreeX`/`degreeY`/`degreeZ` props driven only by ad-hoc "+15deg" demo buttons, since
      this widget - the REAL mouse-drag control the source engine expects any of them to use -
      hadn't landed yet). **This was the last remaining Phase E checklist item - Phase E is now
      100% complete** (see the completion summary at the top of this section).

      **Not vendored in `node_modules/juijs-graph` at all** - unlike every other Phase E file so
      far, this widget's directory (`widget/polygon/`) only exists in `jui-chart/src` itself;
      `node_modules/juijs-graph/src/widget/` has no `polygon/rotate3d.js` (confirmed: only
      `core.js`/`canvas/core.js`/`map/core.js`/`polygon/core.js` exist there). No license header
      anywhere in the chain, and a web search for its own distinctive identifiers
      (`PolygonRotate3DWidget`, `"chart.widget.polygon.rotate3d"`, the `dx % unit != 0 && dy % unit
      != 0` guard shape) found no matching published library - bespoke `jui-chart` widget code,
      hand-ported per this phase's own external-library-match policy, not vendored+`.d.ts`'d.

      **Extend chain, confirmed from source**: `chart.widget.polygon.rotate3d` extends
      `chart.widget.polygon.core` (a two-line pass-through - empty `drawAfter()` override, nothing
      else) extends `chart.widget.core` (`getIndexArray`/`getScaleToValue`/`getValueToScale`/
      `on()`/default `drawAfter()`) extends `chart.draw`. `rotate3d.js` itself only ever uses
      `chart.widget.core`'s `on(type, callback, axisIndex)` wrapper - nothing else from the chain.

      **Confirmed: the generic, reusable drag-to-rotate interaction every polygon-based 3D brush is
      meant to opt into**, not a per-brush ad-hoc control - `draw()` just wires `setScrollEvent()`
      per configured `widget.axis` index (default `[0]`); nothing in it is dot/column/line-specific.
      Interaction model, confirmed from a full read of `setScrollEvent()`: listens for
      `axis.mousedown`/`axis.mousemove` plus three redundant mouseup sources
      (`axis.mouseup`/`bg.mouseup`/`chart.mouseup`, the same "finalize from multiple mouseup
      sources" shape this port's own `LineChart.vue` drag widgets already use a `window`-level
      mouseup for) - purely mouse-driven, no click/keyboard/wheel handling anywhere. `mousemove`
      computes `dx = sdx + floor((gapY/h)*180)`, `dy = sdy - floor((gapX/w)*180)` (`gapX/Y` = live
      pointer delta since mousedown, `w`/`h` = the PLOT area, `180` a hardcoded `DEGREE_LIMIT`) -
      vertical drag rotates X, horizontal drag rotates Y (SUBTRACTED, ported exactly, not
      re-signed). **Z is never touched** - confirmed, only `degree.x`/`degree.y` are read/written;
      `jui-chart` has no mouse widget for Z at all, so the ad-hoc button remains the only Z control
      in this port too. **Mutates `axis.degree.x/y` via `axis.set("degree", {x,y})`** - the exact
      shape `chart.polygon.core`'s `PolygonCore.rotate()` already reads on every draw (see
      `usePolygon3d.ts`'s `rotatePolygonVertices`) - fully covered by the already-ported engine and
      the `degreeX`/`degreeY` props all three chart components already expose; no new
      engine/axis infrastructure needed. **Redraws itself** - `mousemove` calls `self.chart.
      render()` directly after every accepted tick, does NOT wait for a host-triggered redraw.
      A real, preserved throttle quirk: `if(dx % unit != 0 && dy % unit != 0) return` skips a tick
      only when NEITHER new angle lands on a `unit`-multiple boundary (default `unit: 5`), not
      "unless BOTH match" - ported faithfully as `shouldSkipRotate3dTick`.

      **`src/composables/useRotate3d.ts`**: `computeRotate3dDegree`/`shouldSkipRotate3dTick` (pure,
      directly ported formulas) plus `useRotate3dDrag()`, the Vue-side `setScrollEvent()`
      equivalent - owns reactive `degreeX`/`degreeY` refs, wires native `mousedown` on a caller's
      element + `window`-level `mousemove`/`mouseup` (same pattern as `LineChart.vue`'s
      `onZoomDragStart`/`onScrollDragStart` families), and converts `clientX/Y` via the existing
      `toSvgPoint()` (`useHoverGuide.ts` - CSS-scaling-aware, works for an `<svg>` OR `<canvas>`
      root alike). Source's own imperative `chart.render()` call has no equivalent here - Vue's
      reactivity re-renders any component whose bound `degree-x`/`degree-y` prop changed
      automatically, the same "reactivity replaces an imperative render() call" simplification this
      port's other widgets already made. Source's own `cacheXY` string-dedup (guarding a redundant
      `chart.render()` for an unchanged degree) also has no equivalent needed: Vue's `ref` setter
      already no-ops an assignment of an unchanged primitive value. Deliberate simplification over
      source's `widget.axis` array (one widget instance driving several `chart.axis`es at once):
      this port has exactly one x/y axis pair per chart component, so `useRotate3dDrag` only ever
      drives one `{degreeX, degreeY}` pair - the single-axis case of the original, not a behavior
      change.

      **Vue integration decision: a shared composable, not a retrofit of the three components'
      internal prop plumbing.** `Dot3DChart.vue`/`Column3DChart.vue`/`Line3DChart.vue` already
      accept `degreeX`/`degreeY`/`degreeZ` as plain controlled props - the same shape every other
      prop in this port uses - so there was no missing capability inside those components to
      retrofit. What was missing is exactly what `rotate3d.js` provides: the drag gesture that
      COMPUTES new degree values. So `Dot3DPage.vue`/`Column3DPage.vue`/`Line3DPage.vue` (all
      three) were retrofitted to wire a REAL mouse drag over their chart (`ref` + `@mousedown` on
      the chart root, fallthrough-forwarded to its single `<canvas>`/`<svg>` root element) using
      `useRotate3dDrag`'s returned `degreeX`/`degreeY` refs bound straight into the existing
      `:degree-x`/`:degree-y` props - ALONGSIDE (not replacing) each page's existing ad-hoc
      "+15deg" buttons, which remain the only Z control (matching source having no Z widget
      either) and a deterministic fallback. No new demo page/route was added - a 4th page would
      have been redundant when the real payoff is proving this ONE widget genuinely drives all
      three already-ported 3D brush types through the same engine.

      **Testing**: `useRotate3d.spec.ts` (11 tests) - `computeRotate3dDegree` hand-traced across a
      pure-vertical drag (X only), pure-horizontal drag (Y only, confirming the sign is SUBTRACTED
      not added), a diagonal drag composing both axes from a non-zero starting degree, a
      whole-plot-area drag hitting exactly +/-90 degrees, and a zero-delta no-op - every expected
      value independently cross-checked via a standalone `node -e` repro of the exact source
      formula BEFORE this file was written (not derived from the implementation). `
      shouldSkipRotate3dTick` hand-traced across "both multiples" (no skip), "only X a multiple"
      (no skip), "only Y a multiple" (no skip), and "neither a multiple" (skips - the real,
      preserved quirk), plus one case cross-checked through `computeRotate3dDegree` itself.

      **Playwright verification** (temporary script, real pointer events via `page.mouse.down()`/
      `.move()`/`.up()`, not calling an exposed method - `npx playwright` per this phase's
      established no-devDependency pattern), 13 checks, all passing:
      - `/dot3d` (canvas pixel-readback, same pattern as the existing `/dot3d` entry): point "A"
        sits at its hand-computed center `(252,144)` before any drag; a real drag
        (`mouseStartX/Y` at canvas center, one `steps:1` move to `+102,+0` - the exact
        `gapX=102,gapY=0` case hand-verified in `useRotate3d.spec.ts`) produces readout
        `degree=(0,-45,0)` exactly and the `(252,144)` pixel changes color (live re-projection, not
        a stale frame); "Reset rotation" still works afterward and returns the pixel to its exact
        original color (no regression to the existing button).
      - `/column3d` and `/line3d` (real SVG `<polygon>` `points` geometry, cross-checked against an
        independent Node computation of `buildColumn3dDraws`/`buildLine3dDraws`/
        `rotatePolygonVertices` run against the actual built `dist-lib` output, not re-derived by
        hand from scratch): the first column's face-0 / first ribbon's points match the
        Node-computed degree-`(0,0,0)` geometry before dragging, then match the Node-computed
        degree-`(0,-45,0)` geometry (to floating-point tolerance) after the SAME real `+102,+0`
        drag also produces readout `degree=(0,-45,0)`; `column3d`'s existing click-forwarding AND
        "Rotate Z" button both still work after a drag (`degree=(0,-45,15)`) - no regression.
      - Full route sweep across all 37 routes: zero console/page errors.

      `npm run test` (643/643, +11 from the prior 632), `npm run build:lib`, `npm run build` all
      clean. `useRotate3d.ts`'s exports added to `src/index.ts`.

## Phase F — Retroactive external-library audit of Phases A-D (user-requested, do after Phase E)

**Phase F is fully complete (every checklist item below is checked off)**, as of the iteration that
audited the last 9 files: `useFlame.ts`, `useGauge.ts`, `useGridLayout.ts`, `useLegend.ts`,
`usePin.ts`, `usePyramid.ts`, `useScatter.ts`, `useTimeline.ts`, `useTopology.ts`,
`useTopologyZoom.ts`. Across many iterations, Phase F applied the evidence-based "hand-port vs.
vendor" test (below) retroactively to every non-trivial algorithm in every Phase A-D composable/
utility file:

- **Files audited: 26 total** - `useSeries.ts` (`curvePoints()`), `useAxis.ts`/`mathUtil.ts`
  (`nice()` + `getFixed`/`fixed`/`div`/`radian`/`rotate`), `useColorScale.ts`, `usePie.ts`,
  `useScale.ts`, `useChartLayout.ts`, `useTreemap.ts`, `tooltipMeasure.ts`, `useBubble.ts`,
  `useActive.ts`, `useFocus.ts`, `useHoverGuide.ts`, `useArcEqualizer.ts`, `useDragSelect.ts`,
  `useSelectBox.ts`, `useZoomScroll.ts`, `useZoomWindow.ts`, `useScrollWindow.ts`, `useFlame.ts`,
  `useGauge.ts`, `useGridLayout.ts`, `useLegend.ts`, `usePin.ts`, `usePyramid.ts`, `useScatter.ts`,
  `useTimeline.ts`, `useTopology.ts`, `useTopologyZoom.ts` (Phase E's own composables were
  out-of-scope for Phase F - see the note at the end of this section for why).
- **Result: 25 files stayed hand-port, 1 file (`useTreemap.ts`) got a real vendored dependency.**
  `useTreemap.ts`'s squarify core (`squarifyRects`) was swapped to delegate to
  `src/vendor/treemap-squared.js` (a vendored copy of `imranghory/treemap-squared`, MIT, confirmed
  via matching function names, structure, AND a specific "fixed a bug in the paper's pseudocode"
  comment reproduced verbatim - see that item's own two-part entry below for the full trace,
  differential test, and swap). Every other audited file was checked against its jui-chart/
  juijs-graph source for a license header (none had one anywhere in this codebase) and, where the
  code had any distinctive tell (unusual naming, a cited paper/algorithm, an idiosyncratic bugfix-
  vs-a-known-source), a web search for corroborating evidence - none of those searches found a real
  library match (the closest non-matches, `curvePoints()` and `nice()`, both traced to well-known
  *published algorithms* independently reimplemented by many unrelated small libraries, not to one
  traceable library's code - the "well-known algorithm in your own idiom" bucket the policy
  explicitly carves out as hand-port).
- **Final settled policy** (for future phases/auditors to reuse without re-deriving it): the test is
  never "does this look generic/simple" or "does it avoid chart-specific state" - it's **"is this
  code verifiably/recognizably lifted from one specific existing published library"**, checked via
  (1) a license/attribution header in the original jui-chart/juijs-graph source file (none was ever
  found anywhere in this codebase, across all of Phases A-F), or (2) a web search for distinctive
  function/variable names or an idiosyncratic comment, but a match only counts when the search
  surfaces **real corroborating evidence** - matching function names AND structure AND (ideally) a
  specific idiosyncratic detail (a cited paper, a named bugfix, an unusual constant) reproduced
  together, the way `useTreemap.ts`'s `improvesRatio()` comment matched `treemap-squared` almost
  word-for-word. "Does something similar" is never sufficient. A universal/textbook technique
  (linear interpolation, trig/rotation math, rect/grid layout, flow-wrap layout, drag/pan/zoom
  transform arithmetic, scrollbar thumb math, hit-testing) or a well-known published algorithm
  independently reimplemented by multiple unrelated libraries in their own idioms (Thomas-algorithm
  spline control points, Heckbert/Glassner "nice numbers", the squarified-treemap paper's algorithm
  itself as distinct from `treemap-squared`'s specific *code*) stays a hand-port even with no header,
  because "implementing a known technique/algorithm in your own idiom" and "copying a specific
  library's code" are different things and only the latter warrants vendoring. When genuinely
  unsure after a real search, the conclusion is "checked, no confirmed match, kept as a hand-port" -
  never a guess in either direction. Graph/network layout and pan/zoom code (`useTopology.ts`/
  `useTopologyZoom.ts`) got specific extra scrutiny for d3-force/d3-zoom patterns per this batch's
  own instructions - none found (jui-chart's topology placement is a procedural zigzag/random scan,
  not force-directed physics; its pan/zoom is uncomposed drag-delta accumulation and a fixed-step
  wheel clamp, not d3-zoom's composed transform-matrix object).

Phase E's policy work found that the REAL test for "hand-port vs. vendor+`.d.ts`" isn't "does it
reference chart/axis state" - it's "is this code verifiably/recognizably lifted from an existing
published library or algorithm" (checked via a license header, or by recognizing the pattern/
function names and confirming with a web search). That test was only ever applied going forward,
to Phase E's new files. The user explicitly asked that it be applied RETROACTIVELY to everything
Phases A-D already hand-ported too, once Phase E's own checklist is done (not before - finish
Phase E first).

**RE-VERIFIED (this iteration) - the candidate below does NOT hold up; correcting the record.** The
paragraph originally here claimed `curvePoints()` (Phase A) was "the exact same algorithm" as
`util.canvas.base`'s `getCurvePoints`, and therefore a `cardinal-spline-js` vendoring candidate.
Independent re-verification (re-reading both implementations side by side, plus a fresh web search)
found this premise wrong on two counts:

1. **`curvePoints()` never lived in `mathUtil.ts`** - it has always been in `src/composables/
   useSeries.ts` (own doc comment: "Ported from `chart.brush.core`'s `curvePoints()`"). Confirmed
   against the real `chart.brush.core.js` (`juijs-graph/src/brush/core.js` lines 118-176): variable
   names (`a`/`b`/`c`/`r` tridiagonal coefficients, `p1`/`p2` control points), comments ("left most
   segment"/"internal segments"/"right segment", "solves Ax=b with the Thomas algorithm (from
   Wikipedia)") match jui-chart's source exactly - `useSeries.ts`'s port is faithful.
2. **It is a genuinely different algorithm from `cardinal-spline-js`/`getCurvePoints`.**
   `curvePoints()` solves a tridiagonal linear system (Thomas algorithm) for two cubic-Bezier
   *control points* `p1`/`p2` per segment through a set of knots `K`. `getCurvePoints` (the actual
   `cardinal-spline-js` match, confirmed via `github.com/epistemex/cardinal-spline-js`: same
   `tension`/`isClosed`(`close`)/`numOfSegments`(`numOfSeg`) parameter shape, same duplicate-
   endpoint-then-Hermite-blend technique) is a Catmull-Rom/cardinal-spline *point interpolator* with
   a tension parameter - a different curve family entirely, only superficially similar because both
   produce "smooth curves through points". They are not interchangeable and one is not a re-port of
   the other.
   Web search traced `curvePoints()`'s actual origin: Lubos Brieda's "Smooth Bézier Spline Through
   Prescribed Points" (particleincell.com, 2012) - the same `a`/`b`/`c`/`r`/`p1`/`p2` naming and
   "left/internal/right segment" + Thomas-algorithm structure, and jui-chart's own comment
   attributes the technique to Wikipedia (the Thomas/tridiagonal-matrix algorithm), not to a
   specific library. Multiple small, mutually-independent npm packages exist that also implement
   this same blog algorithm (`@geoway/bezier-spline`, `freder/bezier-spline`, both explicitly "based
   on" the same blog post) - but each uses its own different variable/function names
   (`getControlPoints`/`combinePoints`/`getSegments`, not jui-chart's `a`/`b`/`c`/`r`/`p1`/`p2`),
   confirming there is no single canonical *library* jui-chart's code was copied from. This is the
   "well-known published algorithm, implemented in your own idiom" case the Phase F policy
   explicitly carves out (same bucket as Phase C's treemap/Bruls-et-al port) - **not** a
   copy-pasted-library case. **Conclusion: `curvePoints()` in `useSeries.ts` stays a hand-port. No
   vendoring done.** `useSeries.ts`'s doc comment, and the stale cross-references to this in
   `useCanvasChart.ts`/`canvasPrimitives.ts`, have been corrected to stop asserting the (incorrect)
   equivalence.

   Separately: `util.canvas.base`'s `getCurvePoints` *is* still a real, confirmed `cardinal-spline-js`
   match - but that function (and its caller `drawCurve`) was never actually ported into
   `jui-chart-vue` at all (Phase E built `useCanvasChart.ts`/`canvasPrimitives.ts` from a full read
   of `util.canvas.base` and found no canvas widget in this port's scope needs curve drawing - grep
   for `getCurvePoints`/`drawCurve` in `src/` today only turns up doc-comment mentions, no
   implementation). There is currently no call site to vendor `cardinal-spline-js` for. If a future
   phase adds canvas curve rendering, vendor `cardinal-spline-js` fresh then, following the
   `kinetic.js` pattern - don't resurrect this paragraph's mistaken premise.

**Audit process for the rest of Phases A-D** (this is real, unscoped research work - budget
multiple iterations, don't rush): go through each already-ported composable/utility file (not
component files - Vue components are inherently "our" integration code, not candidates) and, for
any non-trivial algorithm (more than a few lines of straightforward, unremarkable logic - interval/
tick "nice domain" math, color interpolation, polar/trig geometry, matrix transforms, physics,
spline/curve interpolation, hit-testing/geometry algorithms are all worth checking; simple
CRUD-ish prop plumbing or straightforward unit conversion is not), check the corresponding original
`jui-chart`/`juijs-graph` source file for a license/attribution header, and if none, try to
recognize the pattern and confirm with a web search for distinctive function/variable names before
concluding it's original. Strong candidates to check first (not yet verified, don't assume the
answer): `useColorScale.ts` (color interpolation - many published color libraries exist),
`useAxis.ts`'s "nice domain" algorithm (interval-niceing is a very common technique in
axis/charting libraries, e.g. d3-scale's `.nice()` - check if jui-chart's specific implementation
matches a known one, though tick-niceing algorithms are also commonly independently (re)invented,
so a match here is less certain than the spline case), `usePie.ts`'s polar/arc math (likely
original/jui-specific, but check), and any physics/animation timing code beyond what Phase E
already found.

**Important distinction to preserve while auditing**: implementing a well-known PUBLISHED ALGORITHM
(e.g. Phase C's `treemap.js` port already faithfully implements the squarified-treemap algorithm
from the Bruls et al. paper, following the ORIGINAL's own implementation of that paper) is NOT the
same thing as vendoring copy-pasted LIBRARY CODE (specific function/variable names/structure
matching a specific existing JS implementation, like `cardinal-spline-js`/`hidpi-canvas-polyfill`).
Implementing a known algorithm from its description/an existing implementation, in your own idiom,
is normal engineering practice and should stay a hand-port. Only concrete, checkable code-level
matches to an existing library warrant the vendor+`.d.ts` treatment. When genuinely unsure, note it
as "checked, no confirmed match, kept as a hand-port" rather than guessing either way.

- [x] `useSeries.ts`'s `curvePoints()` (not actually in `mathUtil.ts` - see the corrected writeup
      above) → **re-verified, does NOT match `cardinal-spline-js`; stays a hand-port, nothing
      vendored.** It matches a different published algorithm (particleincell.com's "Smooth Bézier
      Spline Through Prescribed Points" / Thomas-algorithm tridiagonal solve for Bezier control
      points), implemented in jui-chart's own idiom with no single traceable library source - the
      "well-known algorithm, not copy-pasted library code" bucket. The real `cardinal-spline-js`
      match (`util.canvas.base`'s `getCurvePoints`) has no call site in this port at all (never
      ported - no canvas widget needs curve drawing), so there is nothing to vendor there either,
      for now. Doc comments in `useSeries.ts`/`useCanvasChart.ts`/`canvasPrimitives.ts`/`README.md`
      corrected to stop asserting the two are the same algorithm.
- [x] Audit `useAxis.ts`'s nice-domain/tick algorithm (`mathUtil.ts`'s `nice()`, which
      `useScale.ts`'s `ticks()` calls into) for a known match → **checked, no confirmed library
      match - stays a hand-port.** jui-chart's `util.math.js` (`node_modules/juijs-graph/src/util/
      math.js`) has no license/attribution header anywhere in the file. `nice()`'s inner `niceNum()`
      (exponent = `Math.floor(Math.log(range)/Math.LN10)`, fraction thresholds 1.5/3/7 when
      rounding and 1/2/5 when not, `niceFraction * 10^exponent`) is a textbook match for the classic
      Heckbert/Glassner "Nice Numbers for Graph Labels" algorithm (Graphics Gems I, 1990) - but that
      is a published algorithm/paper, not a single library: a web search turns up many mutually
      independent reimplementations of the exact same thresholds (a "nice-ticks" npm package, an
      often-copied gist, Swift's `SwiftNiceScale`, R's `labeling` package, etc.), each with its own
      variable names, confirming jui-chart's version isn't traceable to one specific existing
      library's source the way `kinetic.js`/`cardinal-spline-js`/`hidpi-canvas-polyfill` were. Same
      bucket as Phase C's treemap/Bruls-et-al port. **Conclusion: `mathUtil.ts`'s `nice()` (and
      `useAxis.ts`'s use of it) stays a hand-port.** Not yet done: `useColorScale.ts`'s color-
      interpolation audit (next natural Phase F item - not started this iteration).
- [x] Audit `useColorScale.ts` for a known color-library match → **checked, no match on any of its
      4 functions - stays hand-port/original, nothing vendored.** Recap of `useColorScale.ts`'s own
      header comment (re-verified, still accurate): this file is NOT a port of anything in
      `jui-chart`/`juijs-graph` - it was built from scratch because a grep of the whole engine
      (`heatmap.js`, `heatmapscatter.js`, `brush/core.js`'s `color()`, `base/builder.js`'s
      `chart.color()`) found no gradient/interpolation primitive wired into any chart feature. That
      said, `juijs-graph/src/util/color.js` (`util.color`) DOES exist as a separate, unused-for-this-
      purpose utility with its own color-scale-shaped functions, so each was checked individually
      against it and against known external color libraries:
      - **`hexToRgb`/`rgbToHex`** (hex↔0-255-channel bit-shift/pad-string conversion): the standard,
        universally-taught technique (`parseInt(hex,16)` then `>>16 & 255`/`>>8 & 255`/`&255`, or the
        reverse `.toString(16).padStart(2,'0')` per channel) - appears near-identically in countless
        independent tutorials/gists/SO answers. Structurally it is NOT even the same technique as
        `util.color.js`'s own `rgb()` hex branch (which parses each channel with a per-character
        `substr()`+`parseInt()` loop, no bit-shifting at all, and manual `"0"+c` padding instead of
        `padStart`) - so this isn't a match to jui-chart's own code either, let alone an external
        library's. `util.color.js` has no license/attribution header (confirmed: the file opens
        directly with `import`/`jui.use()`, no copyright block anywhere).
      - **`interpolateColor`** (per-channel linear RGB lerp, `r1+(r2-r1)*t`, `t` clamped to `[0,1]`):
        this is *the* formula for linear RGB interpolation - there is no other way to express it, so
        it cannot by itself be distinctive to any one library. `util.color.js`'s own `scale()` inner
        `func(t,type)` does the conceptually same lerp but differs in every implementation detail
        (`parseInt(...,10)` truncation vs. this port's `Math.round`, no `t` clamping, needs a
        `.domain()` builder call first, returns via a separate `format()` helper) - not a code-level
        match to jui-chart's own version, and a web search for chroma.js/d3-color/d3-interpolate
        confirms both use entirely different interpolation architecture (Lab/Lch color-space
        conversion, `interpolateRgb` as one of many pluggable interpolators) rather than this file's
        direct hex-pair lerp.
      - **`createColorScale`** (evenly-spaced multi-stop domain→color sampling function): conceptually
        similar to `util.color.js`'s `map()`/`scale().ticks()` (both do "evenly divide N color stops"),
        but architecturally different - `util.color.js`'s version is a discrete-list *builder*
        (`domain(c1,c2).ticks(n)` returns a static array of swatches, always over `t∈[0,1]`, no
        numeric domain concept), while this port's version returns a *continuous sampling function*
        taking a real `[min,max]` numeric `domain` and computing the right segment/local-`t` per
        call - not a structural match. Also confirmed via `grep`: `util.color.js`'s `scale`/`map`/
        `HSVtoRGB`/`RGBtoHSV`/`colorHash` are never called anywhere in the `juijs-graph` engine source
        (only `ColorUtil.parse`, for `linear()`/`radial()` gradient-string parsing, is used, in
        `base/builder.js`) - confirming the header comment's "dead for chart purposes" claim is
        accurate for the whole file, not just the brushes originally checked.
      No function in `useColorScale.ts` reproduces distinctive naming/structure from chroma.js,
      d3-color/d3-scale-chromatic, tinycolor2, or color-convert (checked via web search - all use
      substantially different internal architecture for the equivalent feature). **Conclusion: all
      of `useColorScale.ts` stays hand-written/original, no vendoring.** (Not audited here, out of
      scope for this file: `util.color.js`'s `colorHash`/`generateHash` - a distinctive string-to-
      color hash function with its own `weight *= 0.70`/`max_char=6` scheme - has no call site
      anywhere in `jui-chart-vue` today, same "never actually ported, nothing to vendor for" status
      as `cardinal-spline-js`'s `getCurvePoints`; worth a first-class look only if some future item
      actually ports it.)
- [x] Audit `usePie.ts`'s polar/arc math for a known match → **checked, confirmed original/jui-
      specific - stays a hand-port.** `usePieSlices`/`pieSlicePath`/`donutSlicePath`/
      `pieInsideLabelPosition`/`pieOutsideLabelAnchor`/`pieOutsideLabelDeclutter` are all ported from
      `jui-chart/src/brush/pie.js` (and its `chart.brush.donut` sibling) - `pie.js` opens with a bare
      `import jui from '../main.js'`, no license/attribution header anywhere in the file. The SVG arc-
      path construction (`rotate()`+`radian()` from `mathUtil.ts`, large-arc-flag from `sweepAngle >
      180`) is the standard, generic "point on circle via trig rotation" technique used by every SVG
      pie-chart implementation - not distinctive to any library. What IS distinctive here is
      `pieOutsideLabelDeclutter`'s exact stateful quirks, and they match `pie.js`'s own
      `drawText()` "outside" branch precisely, not any external library: the literal `preAngle`
      starting at `0` (not "no previous label"), the hardcoded `2`deg collision-gap threshold, the
      hardcoded `1.2` hide-floor (not relative to `baseRate`), the `5%`-of-`baseRate` shrink step, and
      the flat `0.25` opacity step - all preserved 1:1 from the original's own magic numbers, per
      this file's doc comments. `pieInsideLabelDeclutter` is explicitly documented as NOT a port at
      all (`pie.js` never declutters inside labels - own doc comment: "From-scratch, NOT a port"),
      built new for this port using a standard circle-packing chord-distance approximation (generic
      geometry, no library match to check). **Conclusion: `usePie.ts` stays entirely hand-port/
      original, nothing vendored.**
- [x] Audit `useScale.ts`'s remaining scale types (linear + ordinal; `nice()`/ticks was already
      covered above) → **checked, no external-library match on either - stays hand-port.**
      `createLinearScale` is ported from `juijs-graph`'s `util.scale.linear()` (confirmed against
      both `node_modules/juijs-graph/src/util/scale.js` lines 490-684 AND the newer version actually
      bundled into `jui-chart/dist/jui-chart.js`, which is what's authoritative when the two differ -
      see the ordinal note below): same `domainMin`/`domainMax`/`distDomain`/`rate`-based
      extrapolation-outside-domain-without-clamp behavior, same asymmetric `_range[0] +
      Math.abs(x-domain[0])*rate` formula on the high side vs. `_range[0] - Math.abs(...)*rate` on the
      low side. This is min-max/linear-interpolation arithmetic - the standard, universally-taught
      technique, not distinctive to any library regardless of the exact variable-name match to jui-
      chart's own code (which itself has no license/attribution header - `util/scale.js` opens with a
      bare `import`). `createOrdinalScale` is ported from `util.scale.ordinal().rangePoints()` +
      its `invert()`. Note for future auditors: the checked-in `node_modules/juijs-graph/src/util/
      scale.js`'s `ordinal().invert()` (`Math.ceil(x/_rangeBand)`, no `rangePoints`-mode branch) does
      NOT match `useScale.ts`'s `OrdinalScale.invert` at first read - the actual match is in `jui-
      chart/dist/jui-chart.js` (the real webpack bundle, apparently built from a newer `util.scale.js`
      than the `node_modules` copy on disk), whose `ordinal().invert()` has the exact `_isRangePoints`
      branch `useScale.ts` ports: `min -= _rangeBand/2` when in `rangePoints` mode, clamp `x` to
      `min`, `Math.floor(Math.abs(x-min)/_rangeBand)` - **when the two candidate sources disagree,
      `dist/jui-chart.js` is the one that's actually authoritative** (it's the real compiled output,
      `node_modules/juijs-graph` may be a different/older checkout). Both are the standard "evenly
      divide N points across an interval, floor pixel-offset back to an index" techniques - no
      external-library naming/structure found in either. `dist/jui-chart.js` has no license header
      (just webpack bootstrap boilerplate). `useScale.ts` has no `log`/`pow`/`time`/`circle` scale -
      confirmed by grep those were never ported (no call site needs them in this port's scope, same
      "never actually ported, nothing to check" status as `getCurvePoints`). **Conclusion: all of
      `useScale.ts` stays hand-port, nothing vendored.**
- [x] Audit `useChartLayout.ts` → **checked, no external-library match - stays hand-port.** Three
      pieces of math: (1) `padding` defaults (`top:20, right:24, bottom:32, left:48`) - these are
      this port's OWN chosen values, not ported at all (the original's `base/builder.js`/`base/
      axis.js` both default every side to a uniform `50`, per their own `@cfg` doc comments at lines
      1070-1073/627-630) - a design decision, not an algorithm, nothing to check. (2) `area` (plot-
      rect from padding) - `x:left, y:top, x2:width-right, y2:height-bottom` matches `base/axis.js`'s
      `calculatePanel()` (`a.x += padding.left; a.y += padding.top; a.x2 -= padding.right; a.y2 -=
      padding.bottom`) - plain rect-margin subtraction, the standard technique, not distinctive to
      any library. (3) `yInterval`'s range-axis-reverses-but-block-axis-never-does asymmetry -
      confirmed against `grid/range.js`'s `drawBefore()` (`if (orient=="left"||"right") arr =
      [obj.end, obj.start] else [obj.start, obj.end]`) and `grid/block.js`'s `drawBefore()`
      (`range = [obj.start, obj.end]`, no orient check at all) - matches exactly, per-file no license
      header on either (`grid/range.js`/`grid/block.js` both open with a bare `import`). This is
      jui-chart's own orientation-convention logic, not an algorithm sourced from anywhere external.
      **Conclusion: `useChartLayout.ts` stays hand-port, nothing vendored.**
- [x] Audit `useTreemap.ts`'s squarify core (`sumArray`/`shortestEdge`/`getRowCoordinates`/
      `cutArea`/`calculateRatio`/`improvesRatio`/`squarifyRects`) - picked as this iteration's "one
      more item" per the Phase F process. **Result: a REAL, confirmed external-library match found -
      the first one since `kinetic.js`/`hidpi.js`. Not yet acted on - flagging as a new, actionable
      follow-up item rather than rushing a rewrite of load-bearing, already-verified layout math in
      the same iteration that also had to do the `useScale.ts`/`useChartLayout.ts` work above.**
      `jui-chart/src/brush/treemap.js`'s `chart.brush.treemap.calculator` module (`normalize`/
      `treemapMultidimensional`/`treemapSingledimensional`/`squarify`/`flattenTreemap`/
      `improvesRatio`/`calculateRatio`/`sumMultidimensionalArray`) plus `chart.brush.treemap.
      container`'s `Container`/`getCoordinates`/`cutArea`/`shortestEdge` has NO license header (bare
      `import jui from '../main.js'` at the top) but its comments cite "the Bruls paper" by name and
      - critically - include the exact phrase **"the pseudocode in the Bruls paper has the direction
      of the comparison wrong, this is the correct one"** on `improvesRatio`'s `currentratio >=
      newratio` check. A web search for this specific detail (not just "squarified treemap", which
      would only prove the well-known-algorithm case like `curvePoints()`/`nice()`) turned up
      **`imranghory/treemap-squared`** (`treemap-squarify.js`, MIT, copyright 2012 Imran Ghory, GitHub-
      only - never published to npm, confirmed via `npm view treemap-squared` → 404): same exact
      function set (`Container`, `normalize`, `treemapSingledimensional`, `treemapMultidimensional`,
      `squarify`, `improvesRatio`, `calculateRatio`, `flattenTreemap`, `sumMultidimensionalArray`),
      same `Container` methods (`getCoordinates`, `cutArea`, `shortestEdge`), and fetching the actual
      upstream source (`raw.githubusercontent.com/imranghory/treemap-squared/master/treemap-
      squarify.js`) confirmed line-level matches to `treemap.js`'s own comments, including the same
      "note the error in the original paper; fixed here" / wrong-direction-pseudocode framing. This
      is NOT the "well-known published algorithm, independently reimplemented in different idioms"
      bucket `curvePoints()`/`nice()` landed in (where multiple mutually-independent implementations
      with different names/structure were found) - this is one specific, singular, non-npm-published
      library whose function names, structure, AND a specific idiosyncratic bugfix-vs-the-paper are
      all reproduced together, which is exactly the "genuine traceable code-level match" bar this
      audit is supposed to catch. **`useTreemap.ts`'s current `squarifyRects`/`calculateRatio`/
      `improvesRatio`/`cutArea`/`getRowCoordinates`/`shortestEdge` are a faithful, independently-
      restructured (iterative array-threading instead of a `Container` class, TypeScript-idiomatic
      names) hand-port of jui-chart's copy of this library - one level removed from the original
      `treemap-squared` source, but the lineage is real.** Per this project's `kinetic.js` precedent
      (vendor generic non-domain logic wholesale rather than re-derive it by hand), this is a
      legitimate vendoring candidate. **Not vendored this iteration** - deliberately deferred, see
      the follow-up item below, rather than rewriting `useTreemap.ts`'s squarify core (which has its
      own 258-line spec suite and sits underneath the separately-verified "re-derived 2-pass grouping
      form" documented in this file's own header comment) without a dedicated pass to verify
      byte-identical output first.
- [x] **Follow-up resolved (this iteration): executed option (a) - vendored `treemap-squared`'s real
      squarify core and swapped `useTreemap.ts`'s `squarifyRects()` over to it.** Full trace, per the
      process this file's `kinetic.js` entry established:
      1. **Located and fetched the real upstream source** - `raw.githubusercontent.com/imranghory/
         treemap-squared/master/treemap-squarify.js` (245 lines, HTTP 200, still live) and its
         `README.md`'s "Licence" section (no separate `LICENSE` file upstream) confirmed: MIT,
         Copyright (c) 2012 Imran Ghory. Function-for-function match to the prior iteration's finding
         (`Container`/`normalize`/`squarify`/`improvesRatio`/`calculateRatio`/`flattenTreemap`/
         `treemapMultidimensional`/`sumMultidimensionalArray`, same `getCoordinates`/`cutArea`/
         `shortestEdge` `Container` methods, same "the pseudocode in the Bruls paper has the direction
         of the comparison wrong, this is the correct one" comment verbatim) - the confirmed match now
         has the actual source in hand, not just a description of it.
      2. **Determined the "re-derived 2-pass grouping form" is a genuine algebraic equivalence, not an
         algorithmic addition, and traced it to upstream's OWN generic recursion**: `treemapMultidimensional()`
         already natively handles an array-of-arrays input by squarifying the outer groups' sums first,
         then recursing into each group's own rect with its own (possibly-nested) sub-array - when fed
         EXACTLY the 2-level `number[][]` shape `useTreemap.ts`'s `collectTreemapGroups()` always
         produces, this native recursion takes the identical code path `layoutTreemapForest()`'s two
         explicit `squarifyRects()` calls already hand-code (outer squarify of group sums, inner
         squarify of each group's own values) - confirmed by hand-tracing `treemapMultidimensional()`'s
         `isArray(data[0])` branch against `useTreemap.spec.ts`'s own hand-derived 2-level tree example.
         This made a clean swap possible WITHOUT touching `collectTreemapGroups()`/`layoutTreemapForest()`
         at all - only `squarifyRects()`'s internal implementation changed, keeping its exact public
         signature (`(values: number[], rect: Rect) => Rect[]`), so every caller is unaffected.
      3. **Vendored the real source** at `src/vendor/treemap-squared.js` (byte-for-byte, with exactly
         ONE addition - a trailing `export default Treemap;`, since the upstream file predates ES
         modules and has no `export` of its own; documented explicitly in the file's own header
         comment as the only non-original line) + hand-written `src/vendor/treemap-squared.d.ts`
         (typed per the `kinetic.d.ts` pattern). Sourced directly from upstream GitHub rather than
         from `jui-chart/src/brush/treemap.js`'s own copy (unlike `kinetic.js`) because jui-chart
         already restructured this library into its own `calculator`/`container` module split - it
         isn't kept in one droppable file there, so the confirmed upstream project is the more
         faithful vendoring source.
      4. **Differential-tested BEFORE swapping** (temporary spec, deleted after use): the vendored
         library is **byte-identical** to the pre-swap hand-port on every exact fixture
         `useTreemap.spec.ts` already hand-traces ([4,3,2,1]@300x300, [42], [5,15]@4x5, [20,10]@6x5,
         confirmed via strict `.toEqual`), and within **sub-1e-9 relative error** (floating-point
         rounding-order noise only - `Math.pow(x,2)` vs `x*x` and differently-grouped division, not an
         algorithmic divergence) on 400 randomized fuzz trials and non-integer/real-world-shaped
         values. **One real upstream bug found and worked around**: `squarify()`'s `data.length===0`
         base case does a bare `return;` instead of `return stack;`, so `flattenTreemap(undefined)`
         throws for an empty values array - `squarifyRects()` special-cases `values.length===0` client-
         side (unchanged from the pre-swap version) rather than delegating that one case, documented
         both in `squarifyRects()`'s own doc comment and in a dedicated regression test
         (`src/vendor/treemap-squared.spec.ts`) that pins the bug down explicitly so a future re-copy
         of the vendored file from upstream doesn't silently "fix" it and break the guard's premise.
      5. **Swapped the caller**: `squarifyRects()` now delegates to `treemapSquared.generate(values,
         rect.width, rect.height, rect.x, rect.y)`, mapping its `[x1,y1,x2,y2]` tuples to this port's
         `{x,y,width,height}` `Rect` shape. The now-dead private helpers it used to contain
         (`getRowCoordinates`/`cutArea`/`calculateRatio`/`improvesRatio`/`shortestEdge`) were removed;
         `sumArray()` was kept (still used by `layoutTreemapForest()`'s group-sum step, unrelated to
         the swap). `useTreemap.ts`'s header comment and `squarifyRects()`'s own doc comment updated to
         describe the vendored-delegation architecture in place of the old "ported from `calculator.
         squarify()`" framing.
      6. **Added permanent regression coverage**: `src/vendor/treemap-squared.spec.ts` (4 tests) - an
         integration-level sanity check directly against the vendored file (same spirit as `kinetic.js`'s
         "types + sanity check, no reimplemented-logic unit tests"), covering the hand-traced 4-value
         fixture, a single-value fill, the multidimensional/nested-array call path
         `layoutTreemapForest()` relies on, and the documented empty-array upstream bug. Also added 3
         new cases to the existing `useTreemap.spec.ts` (now 19 tests, up from 16): a 20-value array
         (structural invariants: full tiling, no zero/negative dimensions), a zero-value entry (NaN-
         degenerate box, reproduced as-is per this port's own convention), and a larger mixed tree (10
         rows, multiple top-level nodes, one 3-level branch) checked for structural invariants (every
         leaf positioned, no non-leaf positioned, full container tiling, all rects within bounds) rather
         than by-hand numbers. All of `useTreemap.spec.ts`'s PRE-EXISTING exact-value assertions
         (unchanged) still pass after the swap, confirming the byte-identical result from step 4 held
         for the real production code path, not just the throwaway differential-test harness.
      7. **Full verification, zero regressions**: `npm run test` - **650/650** (up from 643; +7 new:
         3 in `useTreemap.spec.ts`, 4 in `treemap-squared.spec.ts`). `npm run build:lib` and
         `npm run build` both clean. Playwright check of the `/treemap` demo page (all 7 on-page
         examples: the two hand-traced fixtures, the realistic disk-usage dataset, textAlign/textOrient
         variants, no-title-labels, per-element event forwarding, dark theme) - 93 non-zero-area
         `<rect>` elements rendered, the page's own first example's rendered pixel coordinates
         (`210`, `1200/7`≈`171.428...`, `900/7`≈`128.571...`, `90×200`, `90×100`) match the hand-traced
         values exactly, zero console/page errors, screenshot confirms correct visual tiling across
         every example section.
      **`package.json`'s `_dependencyNotes`** documents `treemap-squared` alongside the existing
      `juijs-graph` note: not a `dependencies` entry (never published to npm, so nothing installable to
      reference - same situation as `kinetic.js`), vendored as a raw file instead, with a summary of
      the license/provenance and a pointer to the full writeup here and in `useTreemap.ts`/`src/vendor/
      treemap-squared.js`'s own doc comments.
- [x] **Remaining Phase A-D composables/utilities not yet given a dedicated Phase F check** - **all
      items below are now checked off; this was the last open Phase F bullet (see the Phase F
      completion summary at the top of this section).** Audited across many iterations: `useSeries.
      ts`'s `curvePoints()`, `useAxis.ts`/`mathUtil.ts`'s `nice()`, `useColorScale.ts`, `usePie.ts`,
      `useScale.ts`, `useChartLayout.ts`, `useTreemap.ts`'s squarify core (see above - vendored and
      swapped in, resolved), `mathUtil.ts`'s remaining helpers (`getFixed`/`fixed`/`div`/`radian`/
      `rotate`), `tooltipMeasure.ts`, `useBubble.ts`, `useActive.ts`, `useFocus.ts`,
      `useHoverGuide.ts`, `useArcEqualizer.ts`, `useDragSelect.ts`, `useSelectBox.ts`,
      `useZoomScroll.ts`, `useZoomWindow.ts`, `useScrollWindow.ts`, and (this iteration, the final
      batch) `useFlame.ts`, `useGauge.ts`, `useGridLayout.ts`, `useLegend.ts`, `usePin.ts`,
      `usePyramid.ts`, `useScatter.ts`, `useTimeline.ts`, `useTopology.ts`, `useTopologyZoom.ts`:
      - [x] `mathUtil.ts` → **checked (this iteration)**: audited every remaining function not
            already cleared by the earlier `nice()`/`scaleValue()` passes - `getFixed()`, `fixed()`
            (with its `.plus`/`.minus`), `div()`, `radian()`, `rotate()`. Read `node_modules/juijs-
            graph/src/util/math.js` in full (the whole file, not just the already-audited `nice`/
            `scaleValue` members): same bare `import jui from '../base/base.js'` opening, no license/
            attribution header, as every other `util.*` file checked elsewhere in this audit (`util.
            svg.js`, `util.color.js` etc.). Function-by-function: (1) `getFixed(a,b)` - counts decimal
            places via `String(x).split('.')[1].length`, takes the max of the two - a plain string-
            length trick, not an algorithm with a canonical external source. (2) `fixed(fixedValue)` -
            returns a closure that scales by `10^getFixed(fixedValue,0)`, rounds, and un-scales, to
            dodge float drift (the classic "multiply by a power of 10, round, divide back" pattern for
            `0.1+0.2`-style errors) - this exact technique is taught in virtually every "JavaScript
            floating point" tutorial/Stack Overflow answer and has no single canonical source; original
            `math.js` also has `.multi`/`.remain` variants of the same trick that `mathUtil.ts` didn't
            even port (only `.plus`/`.minus` made it over, confirming this was a selective hand-port,
            not a wholesale copy of an external module). (3) `div(a,b)` - same scale/round/unscale
            pattern applied to division, matches `math.js`'s standalone `div()` exactly in structure.
            (4) `radian(degree)` - `degree * Math.PI / 180`, the textbook degree-to-radian conversion
            formula, universal since trigonometry itself. (5) `rotate(x,y,radians)` - the standard 2D
            rotation-matrix formula (`x·cos θ − y·sin θ`, `x·sin θ + y·cos θ`), taught in every
            linear-algebra/computer-graphics course and already independently reimplemented dozens of
            times across every graphics library in existence (canvas/SVG libraries, game engines,
            CAD tools) - not distinctive to any one of them. None of these five functions have any
            idiosyncratic tell (unusual variable names, a distinctive bugfix-vs-a-named-paper, a
            comment citing a specific source) the way `useTreemap.ts`'s `improvesRatio()` did with its
            "the pseudocode in the Bruls paper has the direction of the comparison wrong" comment - no
            web search was warranted for any of them, matching the `curvePoints()`/`nice()` precedent
            of "universal technique, stays hand-port" rather than needing the `useTreemap.ts`-style
            deep-dive. **Conclusion: `mathUtil.ts`'s remaining helpers (`getFixed`, `fixed`, `div`,
            `radian`, `rotate`) all stay hand-port - nothing to vendor.**
      - [x] `tooltipMeasure.ts` → **checked (this iteration)**: found the original counterpart at
            `jui-chart/src/widget/tooltip.js`'s `chart.widget.tooltip` module (bare `import jui from
            '../main.js'` opening, no license header) plus the underlying DOM-measurement primitive
            it calls, `getTextSize()` in `node_modules/juijs-graph/src/util/svg.js` (also no license
            header, bare `import JUI from "../base/base.js"` opening). `getTextSize()` builds a
            throwaway offscreen `<svg><text>` pair positioned at `x=-20000,y=-20000`, appends it to
            `document.body`, reads `getBoundingClientRect()`, then removes it - a one-shot
            create/measure/destroy cycle. The Vue port's `measureTextWidth()` in `tooltipMeasure.ts`
            uses the same "offscreen SVG text element" idea but a different concrete technique: a
            single module-level `<text>` element created once and reused across calls (avoiding
            per-measurement DOM churn), positioned off-canvas via `left:-9999px` rather than
            `x=-20000`, and reads `getComputedTextLength()` (a value in user-space SVG units) instead
            of `getBoundingClientRect()` (a screen-space pixel rect) - a deliberate, documented
            divergence, not a byte-level copy. "Measure text by rendering it into a hidden/offscreen
            SVG or canvas element and reading back its real dimensions" is one of the most common,
            multiply-independently-reimplemented DOM techniques in front-end charting/text-layout code
            (every SVG-based charting library needs some version of it, since CSS alone can't report
            glyph-accurate widths) - not distinctive to jui-chart or traceable to one external source.
            Also checked `tooltip.js`'s own box-sizing math (`printTooltip()`: `width + PADDING * 3`,
            `PADDING=7`) against the port's `computeBoxWidth()` (`longest + padding*2`, floored at a
            `MIN_BOX_WIDTH` of 36 the original has no equivalent for) - same "longest line + padding"
            shape but a different constant/formula, confirming independent hand-derivation for the
            Vue port's own balloon layout rather than a transcription. `lineText()`'s `"key: value"`
            formatting is trivial string interpolation with no external source to check. **Conclusion:
            `tooltipMeasure.ts` stays hand-port - nothing to vendor.**
      - [x] `useActive.ts`, `useFocus.ts`, `useHoverGuide.ts` → **checked (this iteration)**. All
            three already carry extremely thorough source-derivation header comments from their
            original Phase C/D porting (full `extend` chain confirmation, line-by-line source
            tracing) - this pass specifically re-checked them for license headers and external-match
            distinctiveness, the two things Phase C/D porting wasn't itself checking for.
            `useActive.ts` ports `chart.brush.pie`'s `setActiveEvent()`/`setActiveTextEvent()`
            (`node_modules/juijs-graph/src/brush/pie.js`, no license header) and `chart.brush.line`'s
            `setActiveEffect()`/`setActiveEffects()` (`src/brush/line.js`, no license header) -
            `toActiveKeySet` (Set-from-string-or-array normalization), `pieActivePullOffset`
            (`cos`/`sin` of an already-cleared `radian()` call - reuses, doesn't reimplement, the
            trig already audited in `mathUtil.ts`'s entry above), `pieActiveOpacity`/
            `lineActiveOpacity` (plain ternary opacity toggling) - all trivial, no distinctive tell.
            `useFocus.ts` ports `chart.brush.focus` (`src/brush/focus.js`, no license header,
            confirmed bare `export default {...}` opening with no `import` line at all even) -
            `focusGridAxis` (one ternary on axis type), `focusPixelRange` (index-to-pixel via an
            existing scale, plus a half-band-width expand/contract for block axes - a plain "expand a
            point into its cell" convention, not a named technique). `resolveFocusSelection` is
            explicitly a NEW addition (see the file's own header comment - `focus.js` has no
            interaction logic of its own to match against at all). `useHoverGuide.ts` ports
            `widget/guideline.js` and `widget/cross.js` (`node_modules/juijs-graph/src/widget/`, no
            license headers - both open with a bare `import jui from '../main.js'`) -
            `toSvgPoint` (viewBox-scale pointer-to-SVG-space conversion, the same
            `clientX - rect.left) * (targetWidth / rect.width)` formula every SVG-interaction library
            needs and reimplements independently - d3, Observable Plot, Chart.js all have some
            version of this), `clamp` (textbook `min(max(v,lo),hi)`), `nearestIndexByPosition` (a
            linear-scan nearest-neighbor search - the single most standard possible technique, and
            per the file's own header comment this port DELIBERATELY diverges from `guideline.js`'s
            own domain-interval-division snap formula rather than copying it), `invertAxisValue`
            (calls this port's own already-built scale `.invert()`, plus a defensive clamp `cross.js`
            itself doesn't have). None of the three files' underlying jui-chart sources have a
            license header, a named-paper citation, or any other tell distinguishing them from
            ordinary jui-chart application code - all are standard hit-testing/coordinate-conversion
            techniques implemented independently in essentially every interactive charting/graphics
            library. **Conclusion: `useActive.ts`, `useFocus.ts`, `useHoverGuide.ts` all stay
            hand-port - nothing to vendor.**
      - [x] `useArcEqualizer.ts` → **checked (this iteration)**. Ported from `chart.brush.
            arcequalizer` (`src/brush/arcequalizer.js`, bare `import jui from '../main.js'` opening,
            no license header). Confirmed (per the file's own already-thorough header comment,
            written during original porting) to hand-roll its own `polarToCartesian()`/
            `describeArc()` trig rather than delegating to `pie.js`/`donut.js` - but algebraically
            equivalent to, and in this port actually implemented by calling straight through to, the
            same already-cleared `radian()`/`rotate()` primitives from `mathUtil.ts`'s entry above
            (see `arcPoint()`'s one-line body: `rotate(0, -radius, radian(angleDeg))`) plus the same
            "two arcs plus two radial lines" annular-sector SVG path construction `donutSlicePath`
            already uses (0deg=12-o'clock-clockwise convention, `largeArc` sweep-flag selection,
            `359.9`-short full-circle clamp) - this is the standard SVG donut/ring-segment path
            recipe, documented in dozens of independent blog posts and D3 arc-generator
            implementations, not attributable to one specific external source. The row/target
            block-count math (`Math.ceil(stackCount * value/maxValue)`) and radial-stacking loop
            (`arcEqualizerWedgeBlocks`) are jui-chart's own equalizer-family bookkeeping (a simpler,
            no-remainder cousin of `useSeries.ts`'s already-hand-port `equalizerStackedBlocks`), not
            trigonometry, and have no external-library shape to check against. No license header, no
            named-paper citation, no idiosyncratic bugfix-vs-a-cited-source anywhere in
            `arcequalizer.js`. **Conclusion: `useArcEqualizer.ts` stays hand-port - nothing to
            vendor.**
      - [x] `useBubble.ts` → **checked (this iteration) - the prior "likely nontrivial, circle-packing/
            d3-force-collision" flag does NOT hold up; correcting the record.** That flag was a
            speculative guess from the word "bubble," made without reading the actual source. Full
            read of both `useBubble.ts` (91 lines) and jui-chart's real `src/brush/bubble.js` (the
            file it's ported from - the SVG `BubbleChart`'s brush) confirms: **there is no collision/
            circle-packing math anywhere in this file at all.** `BubbleBrush` `extend`s `chart.brush.
            core` directly (not a physics/force-simulation base) and does exactly three things: (1)
            `getBubbleRadius`/`util.math.scaleValue()` - a plain linear interpolation, `range*per +
            minScale` where `per=(value-mn)/(maxValue-mn)` - the SAME well-known min-max linear-
            interpolation technique already checked and cleared for `useScale.ts`'s
            `createLinearScale` earlier in this Phase F audit (see that entry above) - not distinctive
            to any library; (2) `getFormatText` - trivial callback-or-fallback label logic; (3)
            `drawBubble`/`createBubble` - draws one non-overlapping-checked circle per data point at
            its already-computed axis `(x,y)` position (from the same `getXY()` dot/strip-plot model
            `ScatterChart` uses), sized by the scaled radius - bubbles are free to overlap, nothing
            here ever detects or resolves a collision between them. `util.math.js` (`node_modules/
            juijs-graph/src/util/math.js`) has no license/attribution header (bare `import`, same as
            every other already-checked `util.*` file in this audit). **Conclusion: `useBubble.ts`
            stays entirely hand-port/original, nothing to vendor - there was never a collision-math
            candidate here to check.** (Real collision/kinetic-physics code DOES exist in jui-chart,
            but lives in `base/bubble.js`/`base/mortalbubble.js` - the CANVAS bubble base classes for
            Phase E's `useBubbleCloud.ts`/`useActiveBubble.ts` etc., which extend `base/kinetic.js`'s
            mass/velocity physics. Those files are explicitly OUT OF SCOPE for Phase F per this file's
            own Phase E-composables note a few paragraphs below - Phase E already applied the
            evidence-based external-library test to them live, at build time.)
      - [x] `useDragSelect.ts`, `useSelectBox.ts`, `useZoomScroll.ts`, `useZoomWindow.ts`,
            `useScrollWindow.ts` → **checked (this iteration)**. All five already carry unusually
            thorough source-derivation header comments (written during original Phase D porting,
            each explicitly noting a full read of its own source plus, in several cases, cross-
            checks against sibling widgets read in the same pass - `zoom.js`/`zoomscroll.js`/
            `zoomselect.js` compared three-way, `scroll.js`/`vscroll.js` confirmed line-by-line
            identical modulo an x/y axis swap). This pass specifically re-checked each for a license
            header and any external-library tell, which Phase D's own porting process wasn't
            checking for. Verified no license header on any of the underlying sources: `src/widget/
            dragselect.js`, `src/widget/zoom.js`, `src/widget/zoomscroll.js` (all bare `import jui
            from "../main.js"`), `src/brush/selectbox.js` (bare `import jui from '../main.js'`), and
            `src/widget/scroll.js`/`src/widget/vscroll.js` (bare `export default {...}`, no `import`
            line at all). Content-wise: `useDragSelect.ts`'s `pointsInDragRect`/`normalizeDragRect`/
            `isDegenerateDragRect` are a textbook axis-aligned-bounding-box point-in-rect test plus
            min/max coordinate normalization - the single most common 2D hit-testing primitive there
            is, reimplemented independently in essentially every graphics/UI/game library.
            `useSelectBox.ts`'s `selectBoxTicks` is a plain fixed-step domain-stepping loop (already
            explicitly traced, per the file's own header comment, to `util/scale/time.js`'s
            millisecond-only call site reducing to nothing more than repeated addition - not a
            calendar-aware date library feature at all); `selectBoxCells` is a consecutive-tick-pair
            bucketing loop. `useZoomWindow.ts`'s `computeDragZoomWindow`/`clampZoomWindow` are pixel-
            to-row-index conversion plus a min/max domain clamp - standard drag-to-zoom arithmetic
            shared conceptually with d3-brush/d3-zoom's own drag handlers, but the actual formula
            (the `currentStart` composing offset, the `originLength` clamp shape) is traced directly
            to jui-chart's own `updateBlockGrid()`/`setZoom()`, not to any external implementation.
            `useZoomScroll.ts`'s edge-handle/center-pane width computations are jui-chart's own
            idiosyncratic clamp-vs-freeze reformulation (explicitly justified algebraically in the
            file's own header comment) of `dragZoomAction()`'s literal DOM-readback-and-reject
            mechanism - a bespoke formula with jui-chart-specific fudge constants (`tick/2` slop, a
            `+2`px thumb fudge shared with `useScrollWindow.ts`), not a generic technique borrowed
            from elsewhere. `useScrollWindow.ts`'s `computeThumbSize`/`computeScrollStart`/
            `clampThumbGap` are classic scrollbar thumb-size/position math (`trackSize * visible/
            total` ratio, thumb-gap-to-row-index inverse) - the standard scrollbar formula taught in
            any "build a custom scrollbar" tutorial, but again reproduced here with jui-chart's own
            specific fudge constants (`+2`px, the `+1` edge-page correction, hand-traced and verified
            in `useScrollWindow.spec.ts`) rather than any traceable external source. None of the six
            source files have a license header, a named-paper/library citation, or any other
            distinctiveness tell like `useTreemap.ts`'s Bruls-paper comment - all read as jui-chart's
            own original interaction-widget code. **Conclusion: `useDragSelect.ts`, `useSelectBox.ts`,
            `useZoomScroll.ts`, `useZoomWindow.ts`, `useScrollWindow.ts` all stay hand-port - nothing
            to vendor.**
      - [x] `useFlame.ts` → **checked (this iteration)**. Ported from `jui-chart/src/brush/flame.js`
            (bare `import jui from '../main.js'; import TreemapBrush from './treemap.js';` opening,
            no license/attribution header). `buildFlameTree`/`getFlameMaxDepth`/`findFlameNode` are
            plain tree-construction/traversal (dot-path parent lookup, DFS/depth scan) - generic data-
            structure code, not an algorithm to check externally. `filterFlameActive` is explicitly
            documented (per its own doc comment, from original porting) as a from-scratch re-derivation
            of `flame.js`'s own `setCacheParents`/`setCacheChildren` re-indexing dance, not a port of
            any external technique. `layoutFlameNodes` (ported from `drawNodeAll()`) is the classic
            "icicle"/flame-graph partition layout - each child's width is a plain proportional share
            (`parent.width * child.value/parent.value`) of its parent's box, stacked left-to-right or
            right-to-left, stacked by depth into rows - the standard, textbook flame-graph/icicle-chart
            layout technique popularized by Brendan Gregg's original Perl `flamegraph.pl` and
            reimplemented independently in dozens of tools (d3-flame-graph, speedscope, pyflame, etc.),
            each with its own variable names/structure - not a code-level match to any one of them, and
            jui-chart's own implementation (single recursive `place()`-style walk, `nodeAlign`
            start/end variants) doesn't reproduce any of their distinctive internals. `flameNodeOpacity`/
            `flameTextX`/`flameTextY` are trivial ternary/arithmetic label positioning. **Conclusion:
            `useFlame.ts` stays hand-port - nothing to vendor.**
      - [x] `useGauge.ts` → **formally audited (this iteration)**, superseding the prior "quick-
            checked" note - read the full file plus both `jui-chart/src/brush/bargauge.js` (bare
            `export default {...}`, no `import` line at all, no license header) and `jui-chart/src/
            brush/fullgauge.js` (bare `import jui from '../main.js'; import DonutBrush from './donut.
            js';`, no license header). `barGaugeFillWidth`/`barGaugeRowY` are one-line arithmetic
            (a width fraction, a per-row stacking offset) with no distinctive shape to check.
            `fullGaugeEndAngleLimit`/`fullGaugeRate`/`fullGaugeCurrentAngle`/`fullGaugePaddingAngle`/
            `fullGaugeRadii` are all direct ports of `fullgauge.js`'s `drawUnit()` - confirmed (per the
            file's own already-thorough doc comments) to be `chart.brush.donut`'s already-audited
            `usePie.ts`/`donutSlicePath` arc-drawing math reused at a different radius formula, not new
            trigonometry - already cleared under `usePie.ts`'s own Phase F entry above (generic SVG
            arc-path construction, not distinctive to any library). `barGaugeRowInput`/
            `fullGaugeRowInput` are plain field-default extraction. **Conclusion: `useGauge.ts` stays
            hand-port - nothing to vendor.**
      - [x] `useGridLayout.ts`, `useLegend.ts` → **checked (this iteration)**. `useGridLayout.ts` is
            ported from `node_modules/juijs-graph/src/grid/table.js`'s `chart.grid.table` (bare
            `export default {...}`, no license header) - row-major grid-cell math (`r =
            floor(i/columns)`, `c = i % columns`, each cell an equal fraction of available space minus
            evenly-spread gaps): the standard, universally-taught "divide a rect into an N-row x
            M-column grid" technique, identical in spirit to CSS Grid's own row/column-major placement
            algorithm and reimplemented independently in essentially every UI/charting toolkit - not
            distinctive to any one library. `useLegend.ts` is adapted (per its own header comment, a
            non-literal port) from `jui-chart/src/widget/legend.js`'s `chart.widget.legend` (bare
            `import jui from '../main.js'`, no license header) - a left-to-right flow-wrap layout
            (place items until the next one would cross the boundary, wrap to a new row/column) with
            `start`/`center`/`end` block alignment: the same generic technique as CSS flexbox's
            `flex-wrap` line-breaking or any classic "flow layout" (Java AWT's `FlowLayout`, wx's
            `WrapSizer`, etc.) - no idiosyncratic constant, named citation, or distinctive structure in
            either source file to warrant a web search. **Conclusion: `useGridLayout.ts`/`useLegend.ts`
            stay hand-port - nothing to vendor.**
      - [x] `usePin.ts` → **checked (this iteration)**. Ported from `jui-chart/src/brush/pin.js` (bare
            `import jui from '../main.js'`, no license header, `extend: "chart.brush.core"` directly).
            `pinGeometry`/`pinTrianglePoints` are pure fixed-offset arithmetic (a label y-position, a
            3-point triangle inscribed at a computed top/bottom, a vertical line to the plot-area
            bottom) - the file's own header comment already documents this as hand-derived from
            source's literal SVG-`translate()` chain, algebraically simplified to absolute coordinates.
            No trig, no physics, no reusable named technique - a bespoke, jui-chart-specific marker
            shape with no library-shaped internals to check. **Conclusion: `usePin.ts` stays hand-port -
            nothing to vendor.**
      - [x] `usePyramid.ts` → **checked (this iteration)**. Ported from `jui-chart/src/brush/pyramid.js`
            (bare `import jui from '../main.js'`, no license header, `extend: "chart.brush.core"`
            directly - confirmed NOT related to `bar.js`, per the file's own header comment). The core
            geometry (`pyramidTrapezoids`) walks a fixed-slope line (`atan2`/`sqrt` for the triangle's
            constant angle/hypotenuse length) proportionally by each segment's `rate` - basic
            trigonometry, but assembled into a genuinely idiosyncratic, jui-chart-specific shape (a
            single inscribed triangle sliced into trapezoids by value share, sorted descending,
            `reverse` flipping which end is the base) with no equivalent in any well-known chart-library
            funnel/pyramid implementation (most funnel charts use independently-sized rows, not one
            sliced triangle - explicitly noted as the actual, non-obvious visual model in this file's
            own header comment). `pyramidLabelY`'s dodge formula (`cy + (cy - dist/2)` when a previous
            label sits too close) is an odd, clearly ad hoc pixel-nudge preserved literally per the
            file's own doc comment precisely because it does NOT match what a "sensible" implementation
            would do - the opposite of a library-quality reusable formula, and further evidence this is
            bespoke jui-chart application code, not adapted from anywhere external. **Conclusion:
            `usePyramid.ts` stays hand-port - nothing to vendor.**
      - [x] `useScatter.ts` → **checked (this iteration)**. Ported from `jui-chart/src/brush/scatter.js`
            (bare `import jui from '../main.js'`, no license header, `extend: "chart.brush.core"`
            directly). `resolveScatterSymbol` is a trivial function-or-literal resolver;
            `isScatterHighlighted` is plain index/key equality bookkeeping for hover-sync;
            `scatterTrianglePoints` is a fixed 3-point isoceles triangle inscribed in a `size`x`size`
            box - the same basic shape-inscribing technique as `usePin.ts`'s triangle, no distinctive
            structure. **Conclusion: `useScatter.ts` stays hand-port - nothing to vendor.**
      - [x] `useTimeline.ts` → **checked (this iteration)**. Ported from `jui-chart/src/brush/
            timeline.js` (bare `import jui from '../main.js'`, no license header, `extend: "chart.
            brush.core"` directly). Every function here is bookkeeping/interaction-state logic, not
            geometry or a named algorithm: `timelineKeyIndex`/`timelineRowIndex` (a plain string-keyed
            lookup map), `timelineBarGeometry` (a rect from two x-pixel positions and a validity
            guard), `timelineRowFillKind` (a 3-way ternary on row index), `timelineConnectors` (an
            adjacent-pair line-building loop with a source-confirmed, faithfully-preserved validity-
            gating quirk), `timelineActiveBarLayout`/`timelineOverlayStyle`/`timelineBarFillMode`
            (hover/active-state ternary/boolean logic, two of which are explicitly documented as
            algebraically-verified collapses of two separate upstream functions into one, done during
            original porting, not sourced from anywhere external). None of this has any geometric or
            physics content to check against a library at all. **Conclusion: `useTimeline.ts` stays
            hand-port - nothing to vendor.**
      - [x] `useTopology.ts` → **formally audited (this iteration)**, completing the partial check
            flagged in the prior note. Read `jui-chart/src/brush/topologynode.js` (bare `import jui
            from '../main.js'; jui.define("chart.topology.edge", ...)`, no license header),
            `jui-chart/src/grid/topologytable.js` (bare `import jui from "../main.js"`, no license
            header), and re-confirmed `jui-chart/src/widget/topologyctrl.js` (bare `import jui from
            "../main.js"`, no license header) in full, specifically hunting for force-simulation
            physics per this task's own instruction to look hard here. **Found none**: `chart.topology.
            sort.linear`/`chart.topology.sort.random` (`layoutTopologyLinear`/`layoutTopologyRandom`)
            are, as this file's own pre-existing header comment already established, a purely
            procedural zigzag column-scan and `Math.random()` placement - no velocity, no
            iterative/tick-based settling, no charge/link/collision force terms or spring-constant-style
            magic numbers anywhere in either sort function. `getDistanceXY` (`topologynode.js`'s edge
            pull-back math) is `atan2`/`cos`/`sin` point-along-a-line-toward-a-target arithmetic - the
            standard "shorten a line by a fixed distance from each endpoint" technique every graph/
            diagramming library needs for arrowheads/node-radius clearance, with entirely generic
            naming (`getDistanceXY`, `x1`/`y1`/`x2`/`y2`/`dist`) that doesn't echo any specific library
            (checked against d3-force's `d3.forceLink`/`d3.forceManyBody`/`d3.forceCollide` API and
            internal Verlet-style position-Verlet integration - structurally unrelated: d3-force has no
            "pull back along the line by a fixed pixel amount" step at all, that's a rendering-time line-
            clipping concern, not a physics term). `buildTopologyEdges`/`topologyActiveEdgeKeysForNode`/
            `topologyActiveEdgeKeysForEdge` are reciprocal-edge-key bookkeeping (`Map`/`Set` lookups by
            a `"start:end"` string key), `topologyEdgeAlign`/`topologyEdgeTextPosition`/
            `topologyBalloonPoints`/`topologyTooltipPosition`/`topologyTooltipTitleNames` are
            tooltip/label placement arithmetic, `findTopologyNode`/`findTopologyEdgeData` are linear
            array scans - none of it is physics or force-simulation-shaped. **Conclusion:
            `useTopology.ts` stays hand-port - nothing to vendor. No d3-force (or any other
            graph-layout library) match found.**
      - [x] `useTopologyZoom.ts` → **checked (this iteration)**, with specific attention to d3-zoom's
            transform conventions per this task's own instruction. Ported from `jui-chart/src/widget/
            topologyctrl.js` (bare `import jui from "../main.js"`, no license header, confirmed - per
            this file's own already-thorough header comment from original porting - to be a WIDGET that
            mutates a sibling brush's grid state, not a physics/drag library). `clampTopologyZoomScale`
            is a fixed `±0.1`-step wheel zoom clamped to `[0.6, 2]` - source's own literal `scale +=/-=
            0.1` with hardcoded bounds, not `d3.scaleExtent()` or any generalized zoom-transform object.
            `topologyZoomDirection` is a one-line wheel-delta sign check (with a documented, deliberate
            sign flip for the legacy-vs-modern `wheel`/`mousewheel` event convention difference -
            jui-chart-specific browser-compat trivia, not a library pattern). `computeTopologyPan` is a
            plain drag-delta-from-start accumulation (`viewAtDragStart + (pointerNow -
            pointerAtDragStart)`), algebraically simplified (per this file's own doc comment) from
            source's own running `boxX`/`boxY` totals - not d3-zoom's `d3.zoomIdentity`/composed
            `{k,x,y}` transform-matrix object (which supports arbitrary transform composition,
            `translateExtent`, and pointer-anchored scaling so the point under the cursor stays fixed
            while zooming); this file's zoom and pan are two entirely independent, uncomposed
            operations - zooming here does NOT re-anchor around the pointer position at all (confirmed:
            `clampTopologyZoomScale` takes only a `current`/`direction`, no pointer coordinate).
            `topologyViewportTransform` emits a plain SVG `scale(s) translate(viewX, viewY)` string -
            confirmed (via its own doc comment's from-scratch algebraic derivation against `grid/
            topologytable.js`'s per-coordinate `(base+view)*scale` getter formula) to be this port's own
            group-transform equivalent of source's per-property multiplication, not copied from
            anywhere. No d3-zoom-shaped API surface (`transform.apply`/`transform.rescaleX`/
            `translateExtent`/`scaleExtent`/pinch-touch handling) exists anywhere in `topologyctrl.js`
            or this port. **Conclusion: `useTopologyZoom.ts` stays hand-port - nothing to vendor. No
            d3-zoom (or any other pan/zoom library) match found.**
      Phase E's own composables (`useActiveBubble.ts`, `useActiveCircle.ts`, `useBubbleCloud.ts`,
      `useCanvasChart.ts`, `useColumn3d.ts`, `useDot3d.ts`, `useEqualizerColumn.ts`, `useLine3d.ts`,
      `usePickerWidget.ts`, `usePolygon3d.ts`, `useRaycast.ts`, `useRotate3d.ts`, `bubble.ts`,
      `mortalBubble.ts`, `kinetic.ts`/`kinetic.js`, `canvasPrimitives.ts`) are OUT OF SCOPE for Phase
      F - Phase E already applied the evidence-based test live, at build time (see Phase E's own
      section of this file for `kinetic.js`/`hidpi.js`/`cardinal-spline-js`/`getCurvePoints` writeups)
      rather than needing a retroactive pass.

## Done (MVP pilot, verified)

- [x] `LineChart.vue`, `AreaChart.vue`, `BarChart.vue` (bar+column via `orient`), `PieChart.vue`,
      `DonutChart.vue`, `ChartTitle.vue`, `ChartTooltip.vue`
- [x] `useScale.ts`, `useAxis.ts`, `useSeries.ts`, `usePie.ts`, `useTheme.ts`, `useChartLayout.ts`
- [x] Playwright-verified rendering for all 5 types, pie/donut outside-label clipping bug found
      and fixed
