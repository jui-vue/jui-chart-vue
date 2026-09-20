import { radian } from './mathUtil'

/**
 * Shared `active`/`activeEvent` hover-interaction math, ported from `chart.brush.pie`'s
 * `setActiveEvent()`/`setActiveTextEvent()` (pie/donut wedge-pull + dim) and `chart.brush.line`'s
 * `setActiveEffect()`/`setActiveEffects()` (line/area highlight-on-hover + dim). Pure functions
 * only - components own the reactive `active`-key state and wire these into template bindings.
 */

/** Normalizes the `active` prop (`string | string[] | null`) into a lookup Set, per both
 * pie.js's `_.inArray(target[i], active) != -1` and line.js's `active === target || active.includes(target)`
 * key-matching (both compare against the target's *name*, not an index, despite line.js's `active`
 * doc comment saying "index"). */
export function toActiveKeySet(active: string | string[] | null | undefined): Set<string> {
  if (!active) return new Set()
  return new Set(Array.isArray(active) ? active : [active])
}

/**
 * Pie/donut wedge pull-out translation, ported from `setActiveEvent()`:
 * `tx = cos(radian(centerAngle)) * dist; ty = sin(radian(centerAngle)) * dist`, applied only
 * when the wedge is active (inactive wedges stay at their un-translated center).
 */
export function pieActivePullOffset(centerAngle: number, distance: number): { dx: number; dy: number } {
  return {
    dx: Math.cos(radian(centerAngle)) * distance,
    dy: Math.sin(radian(centerAngle)) * distance,
  }
}

/**
 * Pie wedge/label fill-opacity, ported from `setActiveEvent()`'s `useOpacity` branch:
 * `opacity = isDisableAll || data.active ? 1 : disabledOpacity`. `donut.js` calls
 * `setActiveEvent(cache, false)` (useOpacity=false) so donut wedges/labels never dim - only
 * pull out (see `pieActivePullOffset`) - components should just skip calling this for donut.
 */
export function pieActiveOpacity(isActive: boolean, hasAnyActive: boolean, disabledOpacity: number): number {
  return !hasAnyActive || isActive ? 1 : disabledOpacity
}

/**
 * Line/area per-target stroke/fill opacity, ported from `line.js`'s `setActiveEffects()` (the
 * `active` prop's static state - "opacity = disableOpacity unless active===null||active===target
 * ||active.includes(target)") and reused for `setActiveEffect()`'s single-element hover highlight
 * by passing the hovered target as a singular `active` override.
 */
export function lineActiveOpacity(target: string, active: string | string[] | null, activeOpacity: number, disableOpacity: number): number {
  if (active === null || active === undefined) return activeOpacity
  const isActive = Array.isArray(active) ? active.includes(target) : active === target
  return isActive ? activeOpacity : disableOpacity
}
