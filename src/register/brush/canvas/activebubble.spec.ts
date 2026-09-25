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

describe('canvas.activebubble brush', () => {
  it('draws each data row as a MortalBubble on the canvas buffer context (records beginPath/arc calls via base/mortalbubble.ts -> CanvasBase.drawCircle)', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
        axis: [{ data: [{ startTime: Date.now(), duration: 1000 }, { startTime: Date.now(), duration: 1000 }] }],
        brush: [{ type: 'canvas.activebubble', radius: 10 }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('arc')
    expect(buffer.calls).toContain('fill')
  })

  it('consumes axis.data (draining it via Array.shift) so a re-render with fresh data starts an equal-length active_bubble_count cache entry', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ data: [{ startTime: Date.now(), duration: 500 }] }],
        brush: [{ type: 'canvas.activebubble' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const cache = (builder as unknown as { getCache(key: string, def?: unknown): unknown }).getCache('active_bubble_count', -1)

    expect(cache).toBe(1)
  })

  it('setup() defaults gravity/radius/opacity, applied when brush omits them', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ data: [{ startTime: Date.now(), duration: 500 }] }],
        brush: [{ type: 'canvas.activebubble' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.gravity).toBe(0.2)
    expect(brush.radius).toBe(20)
    expect(brush.opacity).toBe(1)
  })
})
