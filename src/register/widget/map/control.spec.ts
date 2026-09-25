import { describe, expect, it } from 'vitest'
import { MapControlWidget } from './control'

// `MapControlWidget.drawBefore()` unconditionally calls `axis.map.scale()`/`.view()`/`.size()`
// (not gated behind any data-row loop, unlike the map.* brushes) - jsdom has no real synchronous-
// XHR/geo-SVG support at all (confirmed via the map.* brush specs' own notes), so a full <Chart>
// mount against a map axis can't reach a working `axis.map` here the way it can for the brushes
// (which only ever call `axis.map(id)` per data row, skipped entirely for `data: []`). Real pan/
// zoom control rendering is Playwright-verified against the live site instead; this file checks
// only the one thing safely testable in jsdom - the static setup() defaults.
describe('map.control widget', () => {
  it('setup() defaults orient:"top", align:"start", min:1, max:3, dx:5, dy:5', () => {
    const defaults = MapControlWidget.setup()

    expect(defaults.orient).toBe('top')
    expect(defaults.align).toBe('start')
    expect(defaults.min).toBe(1)
    expect(defaults.max).toBe(3)
    expect(defaults.dx).toBe(5)
    expect(defaults.dy).toBe(5)
  })
})
