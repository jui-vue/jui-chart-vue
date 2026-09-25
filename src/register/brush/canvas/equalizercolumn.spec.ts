import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Builder } from 'jui-graph-ts'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from './testCanvasStub'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

describe('canvas.equalizercolumn brush', () => {
  it('draws stacked unit-cell rects up each column onto the canvas buffer context', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
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
        brush: [{ type: 'canvas.equalizercolumn', target: ['value1'], unit: 10 }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('rect')
    expect(buffer.calls).toContain('fill')
  })

  it('coexists with the already-registered, unrelated SVG "equalizercolumn" type (same display name, different registration string, different class)', () => {
    patch = installStubCanvasContext()

    // `equalizercolumn` (SVG, `extend: chart.brush.stackcolumn`) renders `<path>` elements into a
    // `g.brush-equalizercolumn`; `canvas.equalizercolumn` (this file) draws directly to canvas and
    // renders no SVG brush group at all - mounting both side by side on two axes confirms they're
    // genuinely independent registrations, not one silently shadowing the other.
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
        axis: [
          { x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value1: 30 }] },
          { x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value1: 30 }] },
        ],
        brush: [
          { type: 'equalizercolumn', axis: 0, target: ['value1'] },
          { type: 'canvas.equalizercolumn', axis: 1, target: ['value1'] },
        ],
      },
    })

    expect(wrapper.element.querySelector('g.brush-equalizercolumn')).not.toBeNull()

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer
    expect(buffer.calls).toContain('rect')
  })

  it('an errored column (brush.error matching the row index) skips the stacked cells and instead sets a text label', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
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
        brush: [{ type: 'canvas.equalizercolumn', target: ['value1'], error: 0, errorText: 'Down' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('fillText')
  })

  it('setup() defaults', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value1: 10 }] }],
        brush: [{ type: 'canvas.equalizercolumn', target: ['value1'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.unit).toBe(1)
    expect(brush.errorText).toBe('Stopped')
    expect(brush.outerPadding).toBe(15)
  })
})
