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

describe('canvas.activecircle brush', () => {
  it('draws one circle per data row onto the canvas buffer context (CanvasBase.drawCircle -> arc/fill)', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { x: 10, y: 20 },
              { x: 50, y: 60 },
            ],
          },
        ],
        brush: [{ type: 'canvas.activecircle', radius: 5 }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('arc')
    expect(buffer.calls).toContain('fill')
  })

  it('caches the built Circle objects under "active_circle" so a second render reuses them instead of rebuilding', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [
          {
            x: { type: 'range', domain: [0, 100] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ x: 10, y: 20 }],
          },
        ],
        brush: [{ type: 'canvas.activecircle' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const cache = (builder as unknown as { getCache(key: string, def?: unknown): unknown[] }).getCache('active_circle', [])

    expect(cache.length).toBe(1)
  })

  it('setup() defaults radius to 20', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ x: { type: 'range', domain: [0, 100] }, y: { type: 'range', domain: [0, 100] }, data: [{ x: 1, y: 1 }] }],
        brush: [{ type: 'canvas.activecircle' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.radius).toBe(20)
  })
})
