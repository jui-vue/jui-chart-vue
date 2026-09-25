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

describe('canvas.scatter brush', () => {
  it('symbol: "circle" (the default) draws one arc/fill per (row, target) cell', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'range', domain: [0, 10] }, data: [{ v: 3 }, { v: 7 }] }],
        brush: [{ type: 'canvas.scatter', target: ['v'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls.filter((c) => c === 'arc').length).toBe(2)
    expect(buffer.calls).toContain('fill')
  })

  it('symbol: "cross" strokes two crossing lines per cell', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'range', domain: [0, 10] }, data: [{ v: 3 }] }],
        brush: [{ type: 'canvas.scatter', target: ['v'], symbol: 'cross' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls.filter((c) => c === 'stroke').length).toBe(2)
  })

  it('setup() defaults symbol:"circle", size:7', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'range', domain: [0, 10] }, data: [{ v: 1 }] }],
        brush: [{ type: 'canvas.scatter', target: ['v'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.symbol).toBe('circle')
    expect(brush.size).toBe(7)
  })
})
