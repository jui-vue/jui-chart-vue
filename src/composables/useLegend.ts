/**
 * Pure layout math for `ChartLegend.vue`. Adapted (not a literal line-for-line port) from
 * `chart.widget.legend` (`jui-chart/src/widget/legend.js`) - see that component's own header
 * comment, and `PORT_STATUS.md`'s "legend.js" entry, for the full architectural reasoning: the
 * original widget introspects a *sibling brush* on a shared chart instance (`chart.get("brush",
 * index)`, reading its `target`/`colors` to build swatches automatically) - this port's chart
 * types are independent Vue components with no shared chart object to introspect, so
 * `ChartLegend.vue` instead takes an explicit `items: {label, color}[]` prop and a caller (the
 * paired chart's own `target`/`colors`) supplies them.
 *
 * What IS kept faithful: the flow-layout algorithm itself (`draw()`'s x/y bookkeeping - place
 * items left-to-right, wrap to a new row when the next item would cross the boundary, or stack in
 * a single column when `orient` is vertical) and the `align` semantics (`start`/`center`/`end`
 * positions the whole laid-out block within the available box). Source's `orient` had four values
 * (`top`/`bottom`/`left`/`right`) because it positioned the legend group relative to a *chart's
 * plot area* (which edge to hug); a standalone `ChartLegend` has no plot area to hug, only its own
 * box, so that collapses to two values here: `'horizontal'` (source's `top`/`bottom` - a
 * left-to-right wrapping row) and `'vertical'` (source's `left`/`right` - a single stacked
 * column), with `align` still choosing start/center/end within the box on the wrap axis.
 */

export interface LegendItem {
  label: string
  color: string
}

export interface LegendLayoutItem extends LegendItem {
  index: number
  /** `true` unless `label` is in `options.hidden` - drives the toggled-off (dimmed) visual. */
  active: boolean
  x: number
  y: number
  width: number
  height: number
}

export type LegendOrient = 'horizontal' | 'vertical'
export type LegendAlign = 'start' | 'center' | 'end'

export interface LegendLayoutResult {
  items: LegendLayoutItem[]
  /** Bounding width of the laid-out content (widest row for horizontal, widest item for vertical). */
  contentWidth: number
  /** Bounding height of the laid-out content (summed row heights for horizontal, summed item heights for vertical). */
  contentHeight: number
}

export interface LegendLayoutOptions {
  /** Box width. Horizontal orient: the wrap boundary. Vertical orient: only used by `align`. */
  width: number
  /** Box height. Vertical orient: only used by `align` (horizontal orient ignores it - content just flows top-down). */
  height: number
  orient: LegendOrient
  align: LegendAlign
  fontSize: number
  /** Labels currently toggled off (controlled by the caller - see `ChartLegend.vue`'s `hidden` prop). */
  hidden?: ReadonlySet<string> | readonly string[]
  /** Pixel width of `label` at `fontSize`. Injected (rather than measured internally) so this stays
   * pure/unit-testable - `ChartLegend.vue` passes `measureTextWidth` from `tooltipMeasure.ts` at
   * runtime; tests pass a deterministic fake, matching `tooltipMeasure.ts`'s own established
   * "the surrounding math is pure, DOM measurement isn't" split (see that file's header comment). */
  measure: (label: string) => number
  dx?: number
  dy?: number
}

/** Swatch-to-text gap and outer per-item margin. Reused from `legend.js`'s own `PADDING` constant
 * for a similar visual density, not a literal ported pixel value (this component's own box model
 * differs from source's, so the surrounding geometry is already an adaptation - see this file's
 * header comment). Exported so `ChartLegend.vue` positions its swatch/text at exactly the offsets
 * this layout assumed (`swatchSize` wide, then `LEGEND_PADDING` gap, then the label) - one
 * constant shared between the layout math and the render template, so they can't drift apart. */
export const LEGEND_PADDING = 5
/** Horizontal gap between adjacent items in a wrapped row. */
const ITEM_GAP = LEGEND_PADDING * 2

/**
 * Lays out `items` into rows (horizontal, wraps at `options.width`) or a single column
 * (vertical), then positions the whole block within the box per `options.align`.
 *
 * **Deliberate fix, not a preserved quirk** (see `PORT_STATUS.md`'s note on this, matching the
 * `topologyctrl.js` item's own precedent for calling out non-literal ports): source's item height
 * is a hardcoded constant (`HEIGHT + PADDING/2 = 15.5`) regardless of `fontSize` - a legend with a
 * larger custom `fontSize` would render visibly cramped rows. Here `itemHeight` scales with
 * `fontSize` (`fontSize + PADDING`) instead.
 */
export function computeLegendLayout(items: readonly LegendItem[], options: LegendLayoutOptions): LegendLayoutResult {
  const hiddenSet = options.hidden instanceof Set ? options.hidden : new Set(options.hidden ?? [])
  const swatchSize = options.fontSize
  const itemHeight = options.fontSize + LEGEND_PADDING
  const dx = options.dx ?? 0
  const dy = options.dy ?? 0

  const raw: Array<{ item: LegendItem; index: number; width: number; localX: number; localY: number }> = []

  let contentWidth = 0
  let contentHeight = 0

  if (options.orient === 'horizontal') {
    let x = 0
    let y = 0
    let rowContentWidth = 0
    let firstInRow = true
    const rowWidths: number[] = []

    items.forEach((item, index) => {
      const itemWidth = swatchSize + options.measure(item.label) + LEGEND_PADDING * 2

      // Wrap to a new row if placing this item (after the inter-item gap) would cross the
      // boundary - but never wrap the first item of a row (an over-wide single item still gets
      // placed, just overflowing), matching source's own `x + arr[k].width > chart.area("x2")`
      // check (only ever reached once a row already has content, since a fresh row starts at
      // x=0 and 0 + width > boundary would otherwise wrap forever without placing anything).
      if (!firstInRow && x + ITEM_GAP + itemWidth > options.width) {
        rowWidths.push(rowContentWidth)
        x = 0
        y += itemHeight
        rowContentWidth = 0
        firstInRow = true
      }

      const placeX = firstInRow ? 0 : x + ITEM_GAP
      raw.push({ item, index, width: itemWidth, localX: placeX, localY: y })

      x = placeX + itemWidth
      rowContentWidth = x
      firstInRow = false
    })

    rowWidths.push(rowContentWidth)

    contentWidth = Math.max(...rowWidths, 0)
    contentHeight = rowWidths.length * itemHeight
  } else {
    let y = 0
    let maxWidth = 0

    items.forEach((item, index) => {
      const itemWidth = swatchSize + options.measure(item.label) + LEGEND_PADDING * 2
      raw.push({ item, index, width: itemWidth, localX: 0, localY: y })
      y += itemHeight
      if (itemWidth > maxWidth) maxWidth = itemWidth
    })

    contentWidth = maxWidth
    contentHeight = y
  }

  // Origin offset: for horizontal orient, `align` positions the block along X within `options.width`
  // (content always starts at the top, y=0, since there's no more "above/below the plot area"
  // distinction to preserve - see this file's header comment); for vertical orient, `align`
  // positions the block along Y within `options.height` (content always starts at the left, x=0).
  let originX = 0
  let originY = 0

  if (options.orient === 'horizontal') {
    if (options.align === 'center') originX = (options.width - contentWidth) / 2
    else if (options.align === 'end') originX = options.width - contentWidth
  } else {
    if (options.align === 'center') originY = (options.height - contentHeight) / 2
    else if (options.align === 'end') originY = options.height - contentHeight
  }

  originX = Math.floor(originX) + dx
  originY = Math.floor(originY) + dy

  const laidOut: LegendLayoutItem[] = raw.map(({ item, index, width, localX, localY }) => ({
    label: item.label,
    color: item.color,
    index,
    active: !hiddenSet.has(item.label),
    x: localX + originX,
    y: localY + originY,
    width,
    height: itemHeight,
  }))

  return { items: laidOut, contentWidth, contentHeight }
}
