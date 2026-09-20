/**
 * Ported verbatim from `jui-chart/src/pattern/classic.js`'s `component()` return value - 12
 * `<pattern>` defs (each a 12x12 tiled base64 PNG texture), keyed `"01"`..`"12"`, one per
 * `patternTheme.colors`/`patternColors` entry in `useTheme.ts` (`"pattern-jennifer-01"`..`"-12"`).
 *
 * `pattern/classic.js` itself registers this object under the module name
 * `"chart.pattern.classic"`, and upstream's `createPattern()` (`dist/jui-chart.js:11869-11924`)
 * resolves a `"pattern-jennifer-NN"` token by splitting on `"-"`, popping the LAST segment off as
 * the method key (`"NN"`), and looking up the REMAINING prefix as a registry path:
 * `jui.include("chart." + arr.join("."))` = `jui.include("chart.pattern.jennifer")` for this
 * token - which does NOT match the actually-registered `"chart.pattern.classic"` module name.
 * Confirmed by reading `dist/jui-chart.js`'s `include()`/`getModules()` (plain exact-string
 * registry lookup, no aliasing) - this is a genuine, real upstream naming mismatch, meaning
 * `theme="pattern"` likely never actually resolved to a real pattern fill upstream either (it
 * falls through `createPattern()` returning `false`, then `parseGradient()` not matching, so
 * `createColor()` returns the raw `"pattern-jennifer-NN"` string unchanged - the same "invalid
 * SVG fill -> browser default black" failure this port's own pre-parser state had). Per this
 * port's explicit scope decision (see `useColorResolver.ts`'s `resolvePattern()`), we don't
 * reproduce that broken prefix-registry lookup - there is only ever one pattern source in this
 * port's scope, so resolution just indexes directly into this object by the trailing method key.
 */
export interface PatternImageDescriptor {
  type: 'image'
  attr: {
    'xlink:href': string
    width: number
    height: number
  }
}

export interface PatternDescriptor {
  type: 'pattern'
  attr: {
    id: string
    width: number
    height: number
    patternUnits: string
  }
  children: PatternImageDescriptor[]
}

function pattern(id: string, href: string): PatternDescriptor {
  return {
    type: 'pattern',
    attr: { id, width: 12, height: 12, patternUnits: 'userSpaceOnUse' },
    children: [{ type: 'image', attr: { 'xlink:href': href, width: 12, height: 12 } }],
  }
}

export const patternClassic: Record<string, PatternDescriptor> = {
  '01': pattern(
    'pattern-jennifer-01',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABVJREFUCNdjKC9g+P+B4e4FIImLDQBPxxNXosybYgAAAABJRU5ErkJggg==',
  ),
  '02': pattern(
    'pattern-jennifer-02',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABNJREFUCNdj6GhgAAIlBSCBiw0AUpID3xszyekAAAAASUVORK5CYII=',
  ),
  '03': pattern(
    'pattern-jennifer-03',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAA9JREFUCNdj+P+BAQzwMACirge9PFNsFQAAAABJRU5ErkJggg==',
  ),
  '04': pattern(
    'pattern-jennifer-04',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAgMAAAArG7R0AAAACVBMVEUAAAAaGRkWFhUIIaslAAAAAXRSTlMAQObYZgAAACFJREFUCNdj6HBpYQABjw4wDeS7QPgtENrFxQNCe3SAKAC36AapdMh8ewAAAABJRU5ErkJggg==',
  ),
  '05': pattern(
    'pattern-jennifer-05',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAALCwvdFFZtAAAAAXRSTlMAQObYZgAAAA1JREFUCNdjWLWAIAIAFt8Ped1+QPcAAAAASUVORK5CYII=',
  ),
  '06': pattern(
    'pattern-jennifer-06',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAALCwvdFFZtAAAAAXRSTlMAQObYZgAAAA9JREFUCNdj+P+BAQjwkgDijAubMqjSSAAAAABJRU5ErkJggg==',
  ),
  '07': pattern(
    'pattern-jennifer-07',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAgMAAAArG7R0AAAACVBMVEUAAAAAAAAMDAwvehODAAAAAXRSTlMAQObYZgAAAA5JREFUCNdjmDJlCikYAPO/FNGPw+TMAAAAAElFTkSuQmCC',
  ),
  '08': pattern(
    'pattern-jennifer-08',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjKC9gePeA4e4Fht0bcLEBM1MRaPwhp7AAAAAASUVORK5CYII=',
  ),
  '09': pattern(
    'pattern-jennifer-09',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjePeAobyAYfcGhrsXcLEBOSARaPIjMTsAAAAASUVORK5CYII=',
  ),
  '10': pattern(
    'pattern-jennifer-10',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjEBRg6GhgcHFgUFLAxQYAaTkFzlvDQuIAAAAASUVORK5CYII=',
  ),
  '11': pattern(
    'pattern-jennifer-11',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABJJREFUCNdjMDZgOHOAAQxwsQF00wXOMquS/QAAAABJRU5ErkJggg==',
  ),
  '12': pattern(
    'pattern-jennifer-12',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABBJREFUCNdj+P8BioAABxsAU88RaA20zg0AAAAASUVORK5CYII=',
  ),
}
