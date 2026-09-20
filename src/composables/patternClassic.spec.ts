import { describe, expect, it } from 'vitest'
import { patternClassic } from './patternClassic'

/**
 * `patternClassic` is ported verbatim from `jui-chart/src/pattern/classic.js`'s `component()`
 * return value - 12 entries keyed `"01"`..`"12"`, each a `{type:"pattern", attr:{id, width:12,
 * height:12, patternUnits:"userSpaceOnUse"}, children:[{type:"image", attr:{"xlink:href", width,
 * height}}]}` def wrapping a small base64 PNG texture. See `useColorResolver.ts` for the
 * `createPattern()`-equivalent that looks these up by the trailing method key of a
 * `"pattern-jennifer-NN"` theme token.
 */
describe('patternClassic', () => {
  it('has exactly the 12 "01".."12" keys, each id-matching "pattern-jennifer-NN"', () => {
    const keys = Object.keys(patternClassic).sort()
    expect(keys).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])

    for (const key of keys) {
      expect(patternClassic[key].attr.id).toBe(`pattern-jennifer-${key}`)
    }
  })

  it('each def is a {type:"pattern", attr:{width:12,height:12,patternUnits:"userSpaceOnUse"}} wrapping a single base64 PNG <image> child', () => {
    for (const key of Object.keys(patternClassic)) {
      const def = patternClassic[key]
      expect(def.type).toBe('pattern')
      expect(def.attr.width).toBe(12)
      expect(def.attr.height).toBe(12)
      expect(def.attr.patternUnits).toBe('userSpaceOnUse')
      expect(def.children).toHaveLength(1)
      expect(def.children[0].type).toBe('image')
      expect(def.children[0].attr.width).toBe(12)
      expect(def.children[0].attr.height).toBe(12)
      expect(def.children[0].attr['xlink:href']).toMatch(/^data:image\/png;base64,/)
    }
  })

  it('matches jui-chart/src/pattern/classic.js\'s "01" entry\'s exact base64 payload (spot check)', () => {
    expect(patternClassic['01'].children[0].attr['xlink:href']).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABVJREFUCNdjKC9g+P+B4e4FIImLDQBPxxNXosybYgAAAABJRU5ErkJggg==',
    )
  })
})
