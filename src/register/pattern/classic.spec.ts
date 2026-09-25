import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import { patternJenniferMap } from './classic'

describe('pattern.jennifer map (chart.pattern.classic)', () => {
  it('has all 12 real pattern keys ("01".."12"), each a pattern descriptor with the matching id', () => {
    const keys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    expect(Object.keys(patternJenniferMap).sort()).toEqual(keys.sort())

    for (const k of keys) {
      const entry = patternJenniferMap[k] as { type: string; attr: { id: string } }
      expect(entry.type).toBe('pattern')
      expect(entry.attr.id).toBe(`pattern-jennifer-${k}`)
    }
  })

  it('a brush colored with a "pattern-jennifer-NN" string resolves to a real <pattern> def with an <image> child, not a literal invalid fill', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        axis: [{ data: [{ key: 'A', value: 40 }] }],
        brush: [{ type: 'pie', target: ['value'], colors: ['pattern-jennifer-10'] }],
      },
    })

    // A single-target pie (100% share) renders its one "slice" as a plain <circle>, not a <path> -
    // confirmed by inspecting the actual rendered output (the other <path> in this markup is the
    // unrelated outer-line label-leader, always `fill="transparent"`).
    const slice = wrapper.element.querySelector('g.brush-pie circle')
    expect(slice).not.toBeNull()

    const fill = slice!.getAttribute('fill')
    expect(fill).toBe('url(#pattern-jennifer-10)')

    const patternDef = wrapper.element.querySelector('pattern#pattern-jennifer-10')
    expect(patternDef).not.toBeNull()
    expect(patternDef!.getAttribute('width')).toBe('12')
    expect(patternDef!.getAttribute('patternUnits')).toBe('userSpaceOnUse')

    const image = patternDef!.querySelector('image')
    expect(image).not.toBeNull()
    expect(image!.getAttribute('xlink:href')).toContain('data:image/png;base64,')
  })
})
