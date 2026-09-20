/**
 * Pure helpers for `ChartTooltip.vue`'s balloon sizing. The actual text-width measurement is real
 * DOM work (`SVGTextElement.getComputedTextLength()` against an offscreen `<text>` element, see
 * `ChartTooltip.vue`) and isn't meaningful to unit test under vitest's jsdom (no real font
 * metrics - every string would measure the same, defeating the point of the test); this module
 * holds the surrounding padding/formatting math that *is* pure and worth pinning.
 */

export interface TooltipItem {
  key?: string
  value: string | number
}

/** `"key: value"` when `key` is present, else just `"value"` - matches `chart.widget.tooltip`'s label format. */
export function lineText(item: TooltipItem): string {
  return item.key ? `${item.key}: ${item.value}` : `${item.value}`
}

// Lazily-created, module-level offscreen `<svg><text>` reused across measurements (avoids
// creating/destroying DOM nodes on every hover/mousemove) - positioned off-canvas rather than
// `display:none` so the browser still lays out real font metrics for it. `document` is guarded
// for non-browser environments (this library is Vue SFC components with no SSR entry point in
// this codebase today, but the guard costs nothing and avoids a hard crash if that ever changes).
// Shared by `ChartTooltip.vue` (hover balloons) and `RateBarChart.vue` (the "does the tooltip flag
// fit this segment's width" check ported from `ratebar.js`'s `getTextSize(tooltip).width < width`
// guard) - both need the same real `getComputedTextLength()` measurement, so this lives here
// rather than being duplicated per component.
let measureText: SVGTextElement | null = null

function getMeasureText(): SVGTextElement | null {
  if (typeof document === 'undefined') return null
  if (!measureText) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.style.width = '0'
    svg.style.height = '0'
    svg.style.overflow = 'hidden'
    svg.style.left = '-9999px'
    svg.style.top = '-9999px'
    measureText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    svg.appendChild(measureText)
    document.body.appendChild(svg)
  }
  return measureText
}

/** Real pixel width of `text` at `fontSize`, via a detached `<text>` element's `getComputedTextLength()`.
 * Not unit-testable under vitest's jsdom (no real font metrics - see this module's own header
 * comment on `ChartTooltip.vue`'s originally-private copy of this function). */
export function measureTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  const el = getMeasureText()
  if (!el) return 0
  el.setAttribute('font-size', String(fontSize))
  el.textContent = text
  try {
    return el.getComputedTextLength()
  } catch {
    return 0
  }
}

const MIN_BOX_WIDTH = 36

/**
 * Balloon box width from each line's measured pixel width: the longest line plus padding on both
 * sides, floored at `MIN_BOX_WIDTH` so a short/empty tooltip still renders a visible box.
 */
export function computeBoxWidth(lineWidths: number[], padding: number): number {
  const longest = lineWidths.reduce((max, w) => Math.max(max, w), 0)
  return Math.max(longest + padding * 2, MIN_BOX_WIDTH)
}
