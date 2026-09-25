import { describe, expect, it } from 'vitest'
import { MapMinimapWidget } from './minimap'

// See `control.spec.ts`'s identical note - `MapMinimapWidget.drawBefore()` also unconditionally
// needs a working `axis.map`, which jsdom's lack of real synchronous-XHR/geo-SVG support can't
// provide; real thumbnail-map rendering is Playwright-verified against the live site instead.
describe('map.minimap widget', () => {
  it('setup() defaults align:"end", orient:"top", scale:0.2, dx:-1, dy:1', () => {
    const defaults = MapMinimapWidget.setup()

    expect(defaults.align).toBe('end')
    expect(defaults.orient).toBe('top')
    expect(defaults.scale).toBe(0.2)
    expect(defaults.dx).toBe(-1)
    expect(defaults.dy).toBe(1)
  })
})
