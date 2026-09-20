/**
 * Hand-ported from `jui-chart/src/widget/canvas/picker.js` (64 lines, `chart.widget.canvas.
 * picker`). `extend: "chart.widget.core"`, the same chain as every other Phase D/E widget
 * (including `raycast.js` - see `useRaycast.ts`).
 *
 * **Real dependency graph, confirmed by grep (see `useRaycast.ts`'s header comment for the full
 * writeup) - this file is NOT chained through `equalizercolumn.js`/`raycast.js` at all**: its own
 * `'picker'` cache key (`chart.getCache('picker')`) has exactly ONE writer anywhere in the source
 * tree - `brush/canvas/bubblecloud.js` (`chart.setCache('picker', { obj: bubbleCloud, func:
 * bubbleCloud.pick })`), already ported as `BubbleCloudChart.vue`/`useBubbleCloud.ts`'s `BubbleCloud.
 * pick(x, y)`. `examples/bubblecloud.html` confirms this is real, demo-level usage: `widget: [{type:
 * "canvas.picker"}]` + a `'picker.dblclick'` event handler on the chart. `equalizercolumn.js` never
 * writes the `'picker'` cache key (it writes `raycast_area_*`/`equalizer_*` instead - a completely
 * separate mechanism, see `useEqualizerColumn.ts`), so this file and `raycast.js` are two
 * independent, parallel brush<->widget pairs, not a chain.
 *
 * **The entire mechanism, confirmed by a full read**: `draw()` just wires
 * `axis.click`/`axis.dblclick` (always) and `axis.mousemove` (only when `widget.hover` is `true`,
 * default `false`) listeners that read `chart.getCache('picker')` and, if a checker is registered,
 * call `checker.func.call(checker.obj, e.chartX, e.chartY)` - re-emitting `picker.click`/
 * `picker.dblclick` with `{brush, data}` only when that call returns non-`null` (`mousemove`
 * doesn't re-emit anything itself - it just drives the checker's own internal hover-highlight side
 * effect, e.g. `BubbleCloud.pick()`'s own `this.hoverBubble = ...` write). No geometry of its own at
 * all - purely a generic "map a pointer event to a brush's already-registered `pick(x, y)`
 * function, gate on hover/click/dblclick" event-dispatch layer, unlike `raycast.js`'s own
 * self-contained rectangle hit-test.
 *
 * **Vue integration shape, same reasoning as `raycast.js`**: `draw()` returns an empty `<g>` and
 * has no independent visual surface - this is opt-in behavior on the host component, not a
 * standalone widget component. `runPickerCheck` below is the whole reusable mechanism;
 * `BubbleCloudChart.vue` calls it directly from its own native `@mousemove`/`@click`/`@dblclick`
 * handlers (retrofitted in this iteration to add real click/dblclick support alongside its
 * pre-existing hover, giving this file a genuine, exercised consumer instead of remaining, in that
 * component's own prior words, "a deliberate stand-in, not assumed equivalent").
 */

/** A brush's registered pick function - the port equivalent of `chart.getCache('picker')`'s
 *  `{obj, func}` pair (irrelevant in TS, where a bound closure replaces the `obj`/`func`.call split). */
export type PickerCheck<T> = (x: number, y: number) => T | null

/**
 * Ported from `emitActiveEvent`'s null-checked dispatch (`checker != null` -> call it -> `data !=
 * null` -> real hit) and `setCanvasEvents`'s hover branch (same call, no `data != null` gate - the
 * checker's own side effect, e.g. updating a hover-highlight field, is what matters there, not the
 * return value). `check` is `null` when no brush has registered a picker for this event yet
 * (source: `chart.getCache('picker')` returning its default `null`).
 */
export function runPickerCheck<T>(check: PickerCheck<T> | null, x: number, y: number): T | null {
  if (check == null) return null
  return check(x, y)
}
