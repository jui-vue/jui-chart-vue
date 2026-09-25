import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('scatter brush', () => {
  it('renders one <ellipse> per data point by default (symbol: "circle")', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 50 },
              { name: 'C', value1: 90 },
            ],
          },
        ],
        brush: [{ type: 'scatter', target: ['value1'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-scatter')
    expect(group).not.toBeNull()

    const ellipses = group!.querySelectorAll('ellipse')
    expect(ellipses.length).toBe(3)
  })

  it('renders a <rect> when symbol: "rectangle"', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', value1: 30 }],
          },
        ],
        brush: [{ type: 'scatter', target: ['value1'], symbol: 'rectangle' }],
      },
    })

    const rects = wrapper.element.querySelectorAll('g.brush-scatter rect')
    expect(rects.length).toBe(1)
  })

  it('renders a <polygon> when symbol: "triangle"', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', value1: 30 }],
          },
        ],
        brush: [{ type: 'scatter', target: ['value1'], symbol: 'triangle' }],
      },
    })

    const polygons = wrapper.element.querySelectorAll('g.brush-scatter polygon')
    expect(polygons.length).toBe(1)
  })

  it('renders two <line>s (an X) when symbol: "cross", with no fill/stroke/hover styling applied', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', value1: 30 }],
          },
        ],
        brush: [{ type: 'scatter', target: ['value1'], symbol: 'cross' }],
      },
    })

    const lines = wrapper.element.querySelectorAll('g.brush-scatter line')
    expect(lines.length).toBe(2)
  })

  it('skips a zero-value point entirely when hideZero: true', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 0 },
              { name: 'B', value1: 40 },
            ],
          },
        ],
        brush: [{ type: 'scatter', target: ['value1'], hideZero: true }],
      },
    })

    const ellipses = wrapper.element.querySelectorAll('g.brush-scatter ellipse')
    expect(ellipses.length).toBe(1)
  })
})
