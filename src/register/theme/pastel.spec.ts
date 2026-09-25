import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import { pastelTheme } from './pastel'

describe('pastel theme', () => {
  it('has all 318 keys extracted from the real site engine (lib/jui/js/chart.min.js\'s chart.theme.pastel)', () => {
    expect(Object.keys(pastelTheme).length).toBe(318)
  })

  it('a couple of representative values match the extraction byte-for-byte', () => {
    expect(pastelTheme.fontFamily).toBe('Caslon540BT-Regular,Times,New Roman,serif')
    expect(pastelTheme.backgroundColor).toBe('#fff')
    expect(pastelTheme.colors).toEqual([
      '#73e9d2', '#fef92c', '#ff9248', '#b7eef6', '#08c4e0', '#ffb9ce', '#ffd4ba', '#14be9d', '#ebebeb', '#666666', '#cdbfe3', '#bee982', '#c22269',
    ])
    expect(pastelTheme.barBorderColor).toBe('none')
    expect(pastelTheme.lineSplitBorderColor).toBeNull()
  })

  it('registers under "pastel" - a <Chart theme="pastel"> mount reads it back via chart.theme(key)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        theme: 'pastel',
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 30 },
              { name: 'B', value1: 60 },
            ],
          },
        ],
        brush: [{ type: 'column', target: ['value1'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { theme(key: string): unknown } }).getBuilder()

    expect(builder.theme('fontFamily')).toBe('Caslon540BT-Regular,Times,New Roman,serif')
    expect(builder.theme('barBorderColor')).toBe('none')

    // `column` (`register/brush/column.ts`) reads `chart.theme('barBorderColor')` for its
    // rendered `<path>`'s `stroke` - same cross-check `column.spec.ts` already does for the
    // `classic` theme, here proving `pastel`'s own value flows through the real render pipeline.
    const path = wrapper.element.querySelector('g.brush-column path')!
    expect(path.getAttribute('stroke')).toBe('none')
  })
})
