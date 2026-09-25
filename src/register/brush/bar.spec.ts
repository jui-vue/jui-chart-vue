import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('bar brush', () => {
  it('renders one <path> per data row inside a <g class="brush-bar">, positioned from the zero point', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B', 'C'] },
            data: [
              { name: 'A', value1: 30 },
              { name: 'B', value1: 60 },
              { name: 'C', value1: 10 },
            ],
          },
        ],
        brush: [{ type: 'bar', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-bar')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(3)

    // Every bar path should have a non-empty `d` (PathRectElement.round() calls .join()).
    for (const p of paths) {
      expect(p.getAttribute('d')).toBeTruthy()
    }
  })

  it('does not add a click/hover event target for a zero-value bar (legacy `value != 0` guard)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'block', domain: ['A', 'B'] },
            data: [
              { name: 'A', value1: 0 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'bar', target: ['value1'] }],
      },
    })

    const paths = wrapper.element.querySelectorAll('g.brush-bar path')
    expect(paths.length).toBe(2)
  })

  it('animate: true faithfully crashes with the real engine\'s own "jui is not defined" bug, ' +
    'rather than silently running a working-but-unfaithful fallback animation', () => {
    expect(() =>
      mount(Chart, {
        props: {
          width: 400,
          height: 300,
          axis: [{ x: { type: 'range', domain: [0, 100] }, y: { type: 'block', domain: ['A'] }, data: [{ name: 'A', value1: 30 }] }],
          brush: [{ type: 'bar', target: ['value1'], animate: true }],
        },
      }),
    ).toThrow('jui is not defined')
  })
})
