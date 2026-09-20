import { describe, expect, it } from 'vitest'
import { useColorResolver } from './useColorResolver'

/**
 * `useColorResolver()` is this port's `createColor()`/`createGradient()`/`createPattern()`
 * equivalent (see `useColorResolver.ts`'s header doc comment for the full dispatch-order
 * writeup, hand-traced from `jui-graph/src/base/builder.js:286-390`). One instance = one chart's
 * worth of `<defs>` state (hash caches + registered defs list) - see `ChartBase.vue`'s wiring.
 */
describe('useColorResolver', () => {
  it('returns a plain (non-gradient, non-pattern) color string unchanged and registers no defs', () => {
    const { resolve, defs } = useColorResolver()
    expect(resolve('#ff0000')).toBe('#ff0000')
    expect(defs.value).toEqual([])
  })

  it('returns "none" for undefined/null input (createColor()\'s first branch)', () => {
    const { resolve } = useColorResolver()
    expect(resolve(undefined as unknown as string)).toBe('none')
    expect(resolve(null as unknown as string)).toBe('none')
  })

  it('resolves a gradient string to url(#gradient-0) and registers one linearGradient def', () => {
    const { resolve, defs } = useColorResolver()
    const result = resolve('linear(top) #9694e0,0.9 #7977C2')

    expect(result).toBe('url(#gradient-0)')
    expect(defs.value).toHaveLength(1)
    expect(defs.value[0]).toEqual({
      id: 'gradient-0',
      descriptor: {
        type: 'linearGradient',
        attr: { x1: 0, y1: 0, x2: 0, y2: 1, direction: 'top', id: 'gradient-0' },
        children: [
          { type: 'stop', attr: { 'stop-color': '#9694e0' } },
          { type: 'stop', attr: { offset: '0.9', 'stop-color': '#7977C2' } },
        ],
      },
    })
  })

  it('assigns sequential gradient-N ids per distinct raw gradient string, in first-seen order', () => {
    const { resolve, defs } = useColorResolver()
    expect(resolve('linear(top) #111,0.9 #222')).toBe('url(#gradient-0)')
    expect(resolve('linear(top) #333,0.9 #444')).toBe('url(#gradient-1)')
    expect(resolve('linear(top) #555,0.9 #666')).toBe('url(#gradient-2)')
    expect(defs.value.map((d) => d.id)).toEqual(['gradient-0', 'gradient-1', 'gradient-2'])
  })

  it('dedups: resolving the exact same raw gradient string twice returns the same url(#id) and registers only one def', () => {
    const { resolve, defs } = useColorResolver()
    const first = resolve('linear(top) #9694e0,0.9 #7977C2')
    const second = resolve('linear(top) #9694e0,0.9 #7977C2')

    expect(second).toBe(first)
    expect(defs.value).toHaveLength(1)
  })

  it('resolves a "pattern-jennifer-NN" string to url(#pattern-jennifer-NN) and registers one pattern def', () => {
    const { resolve, defs } = useColorResolver()
    const result = resolve('pattern-jennifer-01')

    expect(result).toBe('url(#pattern-jennifer-01)')
    expect(defs.value).toHaveLength(1)
    expect(defs.value[0].id).toBe('pattern-jennifer-01')
    expect(defs.value[0].descriptor.type).toBe('pattern')
  })

  it('dedups pattern resolution the same way as gradients', () => {
    const { resolve, defs } = useColorResolver()
    resolve('pattern-jennifer-05')
    resolve('pattern-jennifer-05')
    expect(defs.value).toHaveLength(1)
  })

  it('two different resolver instances (two different chart instances) number their gradients independently, not off a shared/global counter', () => {
    const chartA = useColorResolver()
    const chartB = useColorResolver()

    // chart B resolves colors first - if ids were a shared global counter this would NOT be gradient-0.
    expect(chartB.resolve('linear(top) #aaa,0.9 #bbb')).toBe('url(#gradient-0)')
    expect(chartA.resolve('linear(top) #ccc,0.9 #ddd')).toBe('url(#gradient-0)')
    expect(chartA.defs.value).toHaveLength(1)
    expect(chartB.defs.value).toHaveLength(1)
  })

  it('mixed palette: cycling gradient colors and re-resolving an earlier one dedups correctly amid others', () => {
    const { resolve, defs } = useColorResolver()
    const a = resolve('linear(top) #111,0.9 #222')
    resolve('linear(top) #333,0.9 #444')
    const aAgain = resolve('linear(top) #111,0.9 #222')

    expect(aAgain).toBe(a)
    expect(defs.value).toHaveLength(2)
  })
})
