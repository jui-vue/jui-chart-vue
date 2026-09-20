import { describe, expect, it } from 'vitest'
import { createColorScale, hexToRgb } from './useColorScale'

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#336699')).toEqual([0x33, 0x66, 0x99])
  })

  it('expands a 3-digit shorthand hex color', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
  })
})

// Since Phase G, per-segment interpolation delegates to jui-graph-ts's `colorUtil.scale()`, whose
// real formula is `parseInt(String(a + (b-a)*t), 10)` - TRUNCATION, not rounding (a faithful port
// of the original engine's own quirk). This is a deliberate, documented behavior change from this
// port's prior `Math.round`-based formula - see `useColorScale.ts`'s Phase G doc comment.
describe('createColorScale', () => {
  it('hand-traces a 2-stop scale at 0%, 50%, 100%, and a non-round percentage', () => {
    const scale = createColorScale([0, 10], ['#000000', '#ffffff'])
    expect(scale(0)).toBe('#000000')
    expect(scale(10)).toBe('#ffffff')
    // value=5 -> t=0.5 -> 0 + 255*0.5 = 127.5 -> truncate 127 = 0x7f per channel
    expect(scale(5)).toBe('#7f7f7f')
    // value=2.5 -> t=0.25 -> 0 + 255*0.25 = 63.75 -> truncate 63 = 0x3f per channel
    expect(scale(2.5)).toBe('#3f3f3f')
  })

  it('clamps values outside the domain to the nearest endpoint color', () => {
    const scale = createColorScale([0, 10], ['#000000', '#ffffff'])
    expect(scale(-5)).toBe('#000000')
    expect(scale(15)).toBe('#ffffff')
  })

  it('hand-traces a 3-stop (multi-segment) scale', () => {
    // domain [0,100], stops red -> green -> blue, 2 equal segments ([0,50] and [50,100]).
    const scale = createColorScale([0, 100], ['#ff0000', '#00ff00', '#0000ff'])
    expect(scale(0)).toBe('#ff0000')
    expect(scale(50)).toBe('#00ff00') // exact segment boundary, localT=0 into segment 1
    expect(scale(100)).toBe('#0000ff')
    // value=25 -> t=0.25, scaledT=0.5, segment 0, localT=0.5: red->green midpoint
    // r: 255 + (0-255)*0.5 = 127.5 -> truncate 127 = 0x7f; g: 0 + (255-0)*0.5 = 127.5 -> 127 = 0x7f; b: 0
    expect(scale(25)).toBe('#7f7f00')
    // value=75 -> t=0.75, scaledT=1.5, segment 1, localT=0.5: green->blue midpoint
    // r: 0; g: 255 + (0-255)*0.5 = 127.5 -> 127 = 0x7f; b: 0 + (255-0)*0.5 = 127.5 -> 127 = 0x7f
    expect(scale(75)).toBe('#007f7f')
  })

  it('returns a constant color for a zero-width domain instead of dividing by zero', () => {
    const scale = createColorScale([5, 5], ['#000000', '#ffffff'])
    expect(scale(5)).toBe('#000000')
    expect(scale(999)).toBe('#000000')
  })

  it('handles a single color stop (no interpolation) and zero stops (defensive fallback)', () => {
    expect(createColorScale([0, 10], ['#336699'])(7)).toBe('#336699')
    expect(createColorScale([0, 10], [])(7)).toBe('#000000')
  })
})
