/**
 * Pure logic for `TimelineChart.vue`, ported from `timeline.js` (395 lines) - see that file's own
 * header comment for the full source-confirmed data model and design decisions. Kept out of the
 * component so the row-lookup, bar-validity, row-fill and interaction-state math can be
 * unit-tested with hand-traced values, matching this port's established convention (see
 * `usePin.ts`/`useSelectBox.ts`/`useArcEqualizer.ts`).
 */

/**
 * Ported from `drawBefore()`'s `keyToIndex` map: `for(i) keyToIndex[domains[i]] = i`. JS object
 * keys are always strings, so both the domain labels and the event `key` field values that get
 * looked up against this map are compared as strings here too (`String(x)`), matching the
 * source's own implicit coercion exactly (a numeric domain label `5` and the string `"5"` collide,
 * same as upstream).
 */
export function timelineKeyIndex(domain: (string | number)[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 0; i < domain.length; i++) {
    map[String(domain[i])] = i
  }
  return map
}

/** `keyToIndex[key]` - `undefined` when the event's `key` field doesn't match any row label (a
 * real, unguarded upstream possibility - see `TimelineChart.vue`'s header comment on what happens
 * downstream when this is `undefined`). */
export function timelineRowIndex(key: string | number, keyIndex: Record<string, number>): number | undefined {
  return keyIndex[String(key)]
}

export interface TimelineBarGeometry {
  /** Bar rect's left edge (`x1`, the `stime` pixel position). */
  x: number
  /** Bar rect's top edge (`y - height/2`, `y` already the row-centered pixel position). */
  y: number
  width: number
  height: number
  /**
   * `!(x2 - x1 < 0) && !isNaN(x2)` - ported from `drawData()`'s `if(x2-x1<0||isNaN(x2)) continue`
   * (negated). `false` means no bar/text is rendered for this event (matching the source's
   * `continue`, which skips creating `r1`/`t1`/`r2` and this event's own outgoing connector line -
   * see `timelineConnectors`'s doc comment for what's NOT skipped).
   */
  valid: boolean
}

/**
 * Ported from `drawData()`'s per-event rect math: `x1 = axis.x(stime)`, `x2 = axis.x(etime)`,
 * `r1 = {width: x2-x1, height: h, x: x1, y: y-h/2}`. Takes already-resolved pixel `x1`/`x2`/`yCenter`
 * (the row's own centered pixel position, `axis.y(rowIndex)`) rather than raw domain values/scale
 * functions, so it's pure and trivially hand-traceable - axis scaling itself is exercised by
 * `useAxis.spec.ts`, not re-tested here.
 */
export function timelineBarGeometry(x1: number, x2: number, yCenter: number, barSize: number): TimelineBarGeometry {
  const width = x2 - x1
  const valid = !(width < 0) && !Number.isNaN(x2)
  return { x: x1, y: yCenter - barSize / 2, width, height: barSize, valid }
}

export type TimelineRowFillKind = 'header' | 'even' | 'odd'

/**
 * Ported from `drawGrid()`'s `fill = (j==0) ? columnColor : ((j%2) ? evenColor : oddColor)`. Row
 * index `0` is the source's own convention for a header row (see `TimelineChart.vue`'s header
 * comment) - not a "first data lane", a distinct fill kind entirely.
 */
export function timelineRowFillKind(rowIndex: number): TimelineRowFillKind {
  if (rowIndex === 0) return 'header'
  return rowIndex % 2 ? 'even' : 'odd'
}

export interface TimelinePoint {
  x: number
  y: number
}

export interface TimelineConnector {
  from: TimelinePoint
  to: TimelinePoint
}

/**
 * Ported from `drawData()`'s inter-event connector line: `for(i<len-1) { l = line(x2[i],y[i] ->
 * x1[i+1],y[i+1]) }`, drawn INSIDE the same `if(x2-x1<0||isNaN(x2)) continue` guard as event `i`'s
 * own bar - **source-confirmed subtlety, easy to get backwards**: the connector from event `i` to
 * `i+1` is gated by event `i`'s OWN validity (skipped when `i` is invalid, exactly like `i`'s bar/
 * text), but NOT by event `i+1`'s validity - event `i+1`'s raw `x1`/`y` (its `stime` pixel
 * position, computed independently of whether `i+1` itself later turns out invalid) is used as the
 * connector's endpoint regardless. So a connector can visibly end at a position where no bar is
 * actually drawn, a faithfully-preserved upstream quirk, not "fixed" here. `ends[i]` = event `i`'s
 * own `(x2, y)`; `starts[i]` = event `i`'s own `(x1, y)` (the value used as the PREVIOUS event's
 * connector target) - same length arrays, one entry per event.
 */
export function timelineConnectors(starts: TimelinePoint[], ends: TimelinePoint[], valid: boolean[]): TimelineConnector[] {
  const n = valid.length
  const result: TimelineConnector[] = []

  for (let i = 0; i < n - 1; i++) {
    if (!valid[i]) continue
    result.push({ from: ends[i], to: starts[i + 1] })
  }

  return result
}

/**
 * Ported from `setActiveBar()`'s per-target geometry swap: the active bar grows to the FULL row
 * band height (`height`, `axis.y.rangeBand()`), centered the same as any other bar
 * (`y - height/2`); every other bar keeps its own `barSize`-based height (`cacheRect[k].height`).
 * Takes the row's centered pixel position (`yCenter`) and returns the same `{x,y,width,height}`
 * shape as `timelineBarGeometry` minus `x`/`width` (unaffected by active state - only vertical
 * extent changes), so the component only needs to override `y`/`height` when active.
 */
export function timelineActiveBarLayout(yCenter: number, rowBandHeight: number): { y: number; height: number } {
  return { y: yCenter - rowBandHeight / 2, height: rowBandHeight }
}

export interface TimelineOverlayStyle {
  /** `fill-opacity`/`stroke-width` on - ported from `setHoverRect`'s `(isTarget ||
   * cacheRectIndex==k)` visibility gate (also true, unconditionally, right after a click via
   * `setActiveRect`'s own `isTarget` branch - see `TimelineChart.vue`). */
  visible: boolean
  /** Uses the "active" tint (vs. the "hover" tint) - `setActiveRect`'s `isTarget` branch always
   * uses active tint; `setHoverRect`'s only does when hovering the row that's ALSO the active one
   * (`isTarget && cacheRectIndex==k`) - see this function's own doc comment below. */
  active: boolean
}

/**
 * Ported from `activeType: "rect"` mode's `setHoverRect(target)`, re-read line by line: for row
 * `k`, `visible = isTarget || cacheRectIndex==k` (the row under the cursor AND the currently-active
 * row are BOTH kept visible at once - not mutually exclusive), while `active` (the tint choice) is
 * ONLY true when hovering directly over the active row itself (`isTarget && cacheRectIndex==k`) -
 * hovering any OTHER row, active or not, uses the plain hover tint.
 *
 * **Algebraically verified equivalence, used to collapse `setActiveRect`/`setHoverRect` into one
 * formula instead of porting both separately**: evaluating this function at `hoverIndex ===
 * activeIndex === rowA` reduces, for every row `k`, to `visible = (k===rowA)`, `active =
 * (k===rowA)` - EXACTLY `setActiveRect(rowA)`'s own per-row result (its `isTarget` branch has no
 * hover concept at all). So `TimelineChart.vue`'s click handler sets BOTH `activeIndex` AND
 * `hoverIndex` to the clicked row together (not just `activeIndex`) - that single extra assignment
 * makes this one steady-state formula correct for both "just clicked" and "hovering the active
 * row" without a separate code path, and still lets a later real `mouseover` on a DIFFERENT row
 * move `hoverIndex` independently, exactly like the source's separate `setHoverRect` calls.
 * `hoverIndex`/`activeIndex` of `null` never match any row (mirrors `target`/`cacheRectIndex`
 * defaulting to no match).
 */
export function timelineOverlayStyle(rowIndex: number, hoverIndex: number | null, activeIndex: number | null): TimelineOverlayStyle {
  const isHovered = hoverIndex !== null && rowIndex === hoverIndex
  const isActive = activeIndex !== null && rowIndex === activeIndex
  return { visible: isHovered || isActive, active: isHovered && isActive }
}

export type TimelineBarFillMode = 'own' | 'hover' | 'active'

/**
 * Ported from `activeType: "bar"` mode's `setHoverBar(target)`: for row `k`, `fill = (isTarget &&
 * cacheRectIndex!=k) ? hoverColor||color : (cacheRectIndex==k) ? activeColor||color : color`.
 * **Source-confirmed dead-by-default path, worth flagging, not silently dropped**:
 * `timelineHoverBarBackgroundColor` is `null` in BOTH `classic.js` and `dark.js` (grepped both
 * theme files) - so with the default theme, `hoverColor||color` always falls through to the bar's
 * OWN color, meaning hovering a non-active bar produces NO visible recolor at all by default; only
 * the persistent active-row recolor (`cacheRectIndex==k`, independent of what's currently hovered)
 * is ever visible with stock themes. A caller-supplied `timelineHoverBarBackgroundColor` override
 * would make the hover branch visible again - ported faithfully as a real 3-way mode rather than
 * collapsed to 2, so that override still works. Mirrors `timelineOverlayStyle`'s own algebraically-
 * verified equivalence: evaluated at `hoverIndex === activeIndex === rowA`, this reduces to
 * `rowA -> 'active'`/every other row `-> 'own'`, exactly `setActiveBar(rowA)`'s own per-row fill
 * choice (no hover concept there either) - so the same "click sets both refs together" contract
 * documented on `timelineOverlayStyle` makes this one formula correct for both call sites. Bar
 * height/grow (`timelineActiveBarLayout`) is a SEPARATE, hover-independent gate (`setHoverBar`
 * never touches height, only `setActiveBar` does) - components apply it from `activeIndex` alone.
 */
export function timelineBarFillMode(rowIndex: number, hoverIndex: number | null, activeIndex: number | null): TimelineBarFillMode {
  const isHovered = hoverIndex !== null && rowIndex === hoverIndex
  const isActive = activeIndex !== null && rowIndex === activeIndex
  if (isHovered && !isActive) return 'hover'
  if (isActive) return 'active'
  return 'own'
}
