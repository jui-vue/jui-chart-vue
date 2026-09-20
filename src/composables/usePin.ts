/**
 * Pure geometry for `PinChart.vue`, ported from `pin.js`'s `draw()` (69 lines, `extend:
 * "chart.brush.core"` directly - see `PinChart.vue`'s header comment for the full source
 * derivation). A pin is a single marker at one x-axis position (`brush.split`, an index for a
 * block axis or a raw value for a range axis - `PinChart.vue` works with either, same as the
 * source's generic `axis.x(...)`/`axis.x.invert(...)` calls): an optional centered text label at
 * the very top of the plot area, a small downward-pointing triangle "flag" just below it, and a
 * thin vertical line continuing from the triangle down to the bottom of the plot area.
 *
 * Hand-derived from the source's literal translate chain (see this file's own doc comment in
 * PORT_STATUS.md for the full point-by-point derivation): the untranslated triangle points
 * `(size, startY)`/`(size/2, size+startY)`/`(0, startY)` translated by `(x, paddingY)` where
 * `x = d - size/2` algebraically simplify to a triangle centered on `centerX` (`d`), with a flat
 * top edge at `areaTop + paddingY` and its apex `size` px below that - this module returns those
 * already-simplified absolute coordinates directly rather than re-deriving the translate chain at
 * render time.
 */

export interface PinGeometry {
  /** Pixel x position of the pin (the source's `d = axis.x(brush.split)`) - shared by the label, triangle, and line. */
  x: number
  /** Y position of the optional text label (`axis.area("y")`, the very top of the plot area - text has no baseline offset, so it renders just above this). */
  textY: number
  /** Y of the triangle's flat top edge (`startY + paddingY`, half a font-size below the plot top). */
  triangleTop: number
  /** Y of the triangle's apex (`triangleTop + size`). */
  triangleBottom: number
  /** X of the triangle's top-left corner (`centerX - size/2`). */
  triangleLeftX: number
  /** X of the triangle's top-right corner (`centerX + size/2`). */
  triangleRightX: number
  /** Y where the vertical line starts (same as `triangleTop` - the line overlaps the triangle's top edge, matching the source drawing the line last/on top). */
  lineY1: number
  /** Y where the vertical line ends (`axis.area("y") + axis.area("height")`, i.e. the plot area's bottom edge). */
  lineY2: number
}

/**
 * @param centerX Pixel x position of the pin (`axis.x(brush.split)`).
 * @param areaTop Plot area's top edge (`axis.area("y")`).
 * @param areaBottom Plot area's bottom edge (`axis.area("y") + axis.area("height")`, i.e. `area.y2`).
 * @param size `brush.size` (default 6 in the source's `.setup()`).
 * @param fontSize `theme('pinFontSize')` - only used to derive `paddingY = fontSize / 2`, matching the source.
 */
export function pinGeometry(centerX: number, areaTop: number, areaBottom: number, size: number, fontSize: number): PinGeometry {
  const paddingY = fontSize / 2
  const triangleTop = areaTop + paddingY

  return {
    x: centerX,
    textY: areaTop,
    triangleTop,
    triangleBottom: triangleTop + size,
    triangleLeftX: centerX - size / 2,
    triangleRightX: centerX + size / 2,
    lineY1: triangleTop,
    lineY2: areaBottom,
  }
}

/** SVG `<polygon points="...">` string for the pin's downward-pointing triangle. Vertex order
 * doesn't matter for a filled 3-point polygon (no self-intersection is possible), so this uses a
 * simple left-top/right-top/apex-bottom order rather than replicating the source's own
 * right-top/apex-bottom/left-top order. */
export function pinTrianglePoints(g: PinGeometry): string {
  return `${g.triangleLeftX},${g.triangleTop} ${g.triangleRightX},${g.triangleTop} ${g.x},${g.triangleBottom}`
}
