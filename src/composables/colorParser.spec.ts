import { describe, expect, it } from 'vitest'
import { parseAttr, parseGradient, parseStop } from './colorParser'

/**
 * Hand-traced directly against jui-core's unminified `src/util/color.js` (`ColorUtil.parseGradient`/
 * `parseAttr`/`parseStop`, lines ~381-490) and cross-checked against jui-chart's compiled
 * `dist/jui-chart.js` (`:6065-6190`, same logic post-minification) - see this port's `colorParser.ts`
 * header comment and PORT_STATUS.md for the full writeup, including a confirmed-real upstream quirk
 * this suite locks in: `parseStop`'s boundary-default/gap-interpolation second pass reads/writes a
 * `stop.offset` field that is NEVER the same field as the rendered `stop.attr.offset` - so the
 * "first stop defaults to offset 0 / last defaults to 1" writes never reach the actual SVG attribute,
 * and multi-stop gap interpolation is effectively unreachable for well-formed gradients (any 4+-stop
 * gradient with an un-offset interior run makes `parseStop` throw, exactly as it does upstream).
 */
describe('parseAttr', () => {
  it('maps each named linear direction to jui-chart\'s exact x1/y1/x2/y2 table', () => {
    expect(parseAttr('linear', '')).toEqual({ x1: 0, y1: 0, x2: 1, y2: 0, direction: 'left' })
    expect(parseAttr('linear', 'left')).toEqual({ x1: 0, y1: 0, x2: 1, y2: 0, direction: 'left' })
    expect(parseAttr('linear', 'right')).toEqual({ x1: 1, y1: 0, x2: 0, y2: 0, direction: 'right' })
    expect(parseAttr('linear', 'top')).toEqual({ x1: 0, y1: 0, x2: 0, y2: 1, direction: 'top' })
    expect(parseAttr('linear', 'bottom')).toEqual({ x1: 0, y1: 1, x2: 0, y2: 0, direction: 'bottom' })
    expect(parseAttr('linear', 'top left')).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1, direction: 'top left' })
    expect(parseAttr('linear', 'top right')).toEqual({ x1: 1, y1: 0, x2: 0, y2: 1, direction: 'top right' })
    expect(parseAttr('linear', 'bottom left')).toEqual({ x1: 0, y1: 1, x2: 1, y2: 0, direction: 'bottom left' })
    expect(parseAttr('linear', 'bottom right')).toEqual({ x1: 1, y1: 1, x2: 0, y2: 0, direction: 'bottom right' })
  })

  it('parses an unnamed linear direction as a raw x1,y1,x2,y2 list, parseFloat-ing non-percent entries', () => {
    expect(parseAttr('linear', '0,0.5,1,50%')).toEqual({ x1: 0, y1: 0.5, x2: 1, y2: '50%' })
  })

  it('parses radial args as cx,cy,r,fx,fy, parseFloat-ing non-percent entries', () => {
    expect(parseAttr('radial', '50%,50%,50%,50,50')).toEqual({ cx: '50%', cy: '50%', r: '50%', fx: 50, fy: 50 })
  })
})

describe('parseStop', () => {
  it('parses bare-color (1-part) stops with no offset attr at all', () => {
    expect(parseStop('#fff,#000')).toEqual([
      { type: 'stop', attr: { 'stop-color': '#fff' } },
      { type: 'stop', attr: { 'stop-color': '#000' } },
    ])
  })

  it('parses a 2-part "offset color" stop with an explicit offset attr', () => {
    expect(parseStop('#9694e0,0.9 #7977C2')).toEqual([
      { type: 'stop', attr: { 'stop-color': '#9694e0' } },
      { type: 'stop', attr: { offset: '0.9', 'stop-color': '#7977C2' } },
    ])
  })

  it('parses a 3-part "offset color opacity" stop', () => {
    expect(parseStop('0 red 0.5,1 blue 1')).toEqual([
      { type: 'stop', attr: { offset: '0', 'stop-color': 'red', 'stop-opacity': '0.5' } },
      { type: 'stop', attr: { offset: '1', 'stop-color': 'blue', 'stop-opacity': '1' } },
    ])
  })

  it('preserved upstream quirk: a 3-stop list with only the MIDDLE stop offset explicit does NOT get its gap interpolated - the boundary-default pass writes to a field the SVG builder never reads, so the middle stop keeps only its own already-explicit offset, and the first/last stops end up with no offset attr at all', () => {
    // "linear(right) #fff,50% yellow,black" per jui-core's own `parseGradient` doc comment example.
    expect(parseStop('#fff,50% yellow,black')).toEqual([
      { type: 'stop', attr: { 'stop-color': '#fff' } },
      { type: 'stop', attr: { offset: '50%', 'stop-color': 'yellow' } },
      { type: 'stop', attr: { 'stop-color': 'black' } },
    ])
  })

  it('degenerate single-stop input (no comma) still parses (used by candlestickBackgroundColor: "linear(top) #fff")', () => {
    expect(parseStop('#fff')).toEqual([{ type: 'stop', attr: { 'stop-color': '#fff' } }])
  })

  it('preserved upstream bug: an empty stop string produces one stop with an empty stop-color (String.split(" ") on "" yields [""], length 1, not 0)', () => {
    expect(parseStop('')).toEqual([{ type: 'stop', attr: { 'stop-color': '' } }])
  })

  it('preserved upstream bug: 4+ stops with an un-offset interior run throws (gap-fill interpolation keys off a field that is always undefined for interior stops, so `stops[end].offset.indexOf` reads a property of undefined)', () => {
    expect(() => parseStop('#a,#b,#c,#d')).toThrow()
  })
})

describe('parseGradient', () => {
  it('returns the input string unchanged when it is not a linear(...)/radial(...) string (the createColor()-level "is this a gradient?" signal)', () => {
    expect(parseGradient('#ff0000')).toBe('#ff0000')
    expect(parseGradient('pattern-jennifer-01')).toBe('pattern-jennifer-01')
  })

  it('parses "linear(top) #fff,#000" into a full linearGradient descriptor', () => {
    expect(parseGradient('linear(top) #fff,#000')).toEqual({
      type: 'linearGradient',
      attr: { x1: 0, y1: 0, x2: 0, y2: 1, direction: 'top' },
      children: [
        { type: 'stop', attr: { 'stop-color': '#fff' } },
        { type: 'stop', attr: { 'stop-color': '#000' } },
      ],
    })
  })

  it('parses "linear(right) #fff,50% yellow,black" into a full linearGradient descriptor (the 3-stop, unset-boundary-offsets case)', () => {
    expect(parseGradient('linear(right) #fff,50% yellow,black')).toEqual({
      type: 'linearGradient',
      attr: { x1: 1, y1: 0, x2: 0, y2: 0, direction: 'right' },
      children: [
        { type: 'stop', attr: { 'stop-color': '#fff' } },
        { type: 'stop', attr: { offset: '50%', 'stop-color': 'yellow' } },
        { type: 'stop', attr: { 'stop-color': 'black' } },
      ],
    })
  })

  it('parses "radial(50%,50%,50%,50,50)" into a full radialGradient descriptor (empty stop list)', () => {
    expect(parseGradient('radial(50%,50%,50%,50,50)')).toEqual({
      type: 'radialGradient',
      attr: { cx: '50%', cy: '50%', r: '50%', fx: 50, fy: 50 },
      children: [{ type: 'stop', attr: { 'stop-color': '' } }],
    })
  })

  it('parses a real shipped theme token verbatim ("linear(top) #9694e0,0.9 #7977C2", gradientTheme.colors[0])', () => {
    expect(parseGradient('linear(top) #9694e0,0.9 #7977C2')).toEqual({
      type: 'linearGradient',
      attr: { x1: 0, y1: 0, x2: 0, y2: 1, direction: 'top' },
      children: [
        { type: 'stop', attr: { 'stop-color': '#9694e0' } },
        { type: 'stop', attr: { offset: '0.9', 'stop-color': '#7977C2' } },
      ],
    })
  })
})
