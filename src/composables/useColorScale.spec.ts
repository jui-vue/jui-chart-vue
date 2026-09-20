import { describe, expect, it } from 'vitest'
import { createColorScale, hexToRgb, interpolateColor, rgbToHex } from './useColorScale'

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a 6-digit hex color', () => {
    expect(hexToRgb('#336699')).toEqual([0x33, 0x66, 0x99])
    expect(rgbToHex(0x33, 0x66, 0x99)).toBe('#336699')
  })

  it('expands a 3-digit shorthand hex color', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
  })

  it('clamps out-of-range channels when re-encoding', () => {
    expect(rgbToHex(-10, 300, 127.5)).toBe('#00ff80')
  })
})

describe('interpolateColor', () => {
  // Hand-traced: black (0,0,0) -> white (255,255,255).
  it('returns the "from" color exactly at t=0', () => {
    expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('returns the "to" color exactly at t=1', () => {
    expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('hand-traces the midpoint (t=0.5): 0 + (255-0)*0.5 = 127.5, rounds to 128 = 0x80', () => {
    expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('hand-traces a non-round percentage (t=0.25) between two non-grayscale colors', () => {
    // from = blue (0,0,255), to = red (255,0,0).
    // r: 0   + (255-0)   * 0.25 = 63.75  -> round 64  = 0x40
    // g: 0   + (0-0)     * 0.25 = 0                    = 0x00
    // b: 255 + (0-255)   * 0.25 = 191.25 -> round 191 = 0xbf
    expect(interpolateColor('#0000ff', '#ff0000', 0.25)).toBe('#4000bf')
  })

  it('clamps t below 0 and above 1 instead of extrapolating', () => {
    expect(interpolateColor('#000000', '#ffffff', -0.5)).toBe('#000000')
    expect(interpolateColor('#000000', '#ffffff', 1.5)).toBe('#ffffff')
  })
})

describe('createColorScale', () => {
  it('hand-traces a 2-stop scale at 0%, 50%, 100%, and a non-round percentage', () => {
    const scale = createColorScale([0, 10], ['#000000', '#ffffff'])
    expect(scale(0)).toBe('#000000')
    expect(scale(10)).toBe('#ffffff')
    expect(scale(5)).toBe('#808080') // t=0.5, same math as interpolateColor's own midpoint case
    // value=2.5 -> t=0.25 -> 0 + 255*0.25 = 63.75 -> round 64 = 0x40 per channel
    expect(scale(2.5)).toBe('#404040')
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
    // r: 255 + (0-255)*0.5 = 127.5 -> 128 = 0x80; g: 0 + (255-0)*0.5 = 127.5 -> 128 = 0x80; b: 0
    expect(scale(25)).toBe('#808000')
    // value=75 -> t=0.75, scaledT=1.5, segment 1, localT=0.5: green->blue midpoint
    // r: 0; g: 255 + (0-255)*0.5 = 127.5 -> 128 = 0x80; b: 0 + (255-0)*0.5 = 127.5 -> 128 = 0x80
    expect(scale(75)).toBe('#008080')
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
