import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('column brush', () => {
  it('renders one <path> per data row inside a <g class="brush-column">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 30 },
              { name: 'B', value1: 60 },
              { name: 'C', value1: 10 },
            ],
          },
        ],
        brush: [{ type: 'column', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-column')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(3)

    for (const p of paths) {
      expect(p.getAttribute('d')).toBeTruthy()
    }
  })

  it('reuses BarBrush.getBarStyle() styling (border color from the classic theme)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
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

    const path = wrapper.element.querySelector('g.brush-column path')!
    // classic theme: barBorderColor: "none"
    expect(path.getAttribute('stroke')).toBe('none')
  })

  it('animate: true faithfully crashes with the real engine\'s own "jui is not defined" bug (see ' +
    '`bar.spec.ts`\'s identical test for the full rationale)', () => {
    expect(() =>
      mount(Chart, {
        props: {
          width: 400,
          height: 300,
          axis: [{ x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value1: 30 }] }],
          brush: [{ type: 'column', target: ['value1'], animate: true }],
        },
      }),
    ).toThrow('jui is not defined')
  })
})
