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

describe('canvas.bubblecloud brush', () => {
  it('builds one Bubble per data row, keyed by its "title", and draws them onto the canvas buffer context', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        canvas: true,
        axis: [
          {
            data: [
              { title: 'Alpha', capacity: 30 },
              { title: 'Beta', capacity: 70 },
            ],
          },
        ],
        brush: [{ type: 'canvas.bubblecloud' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('arc')
    expect(buffer.calls).toContain('fillText')

    const cloud = (builder as unknown as { getCache(key: string, def?: unknown): { bubbles: Record<string, unknown> } }).getCache('bubble_cloud')
    expect(Object.keys(cloud.bubbles)).toEqual(['Alpha', 'Beta'])
  })

  it('registers a "picker" cache entry ({obj, func}) so canvas.picker can hit-test hover/click positions', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [{ data: [{ title: 'Only', capacity: 1 }] }],
        brush: [{ type: 'canvas.bubblecloud' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const picker = (builder as unknown as { getCache(key: string, def?: unknown): { obj: unknown; func: unknown } | undefined }).getCache('picker')

    expect(picker).toBeDefined()
    expect(typeof picker!.func).toBe('function')
  })

  it('picking a position inside a bubble\'s radius returns its origin data row', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [{ data: [{ title: 'Only', capacity: 1 }] }],
        brush: [{ type: 'canvas.bubblecloud' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const cache = (builder as unknown as { getCache(key: string, def?: unknown): { obj: unknown; func: (this: unknown, x: number, y: number) => unknown } }).getCache('picker')
    const bubble = Object.values((builder as unknown as { getCache(key: string, def?: unknown): { bubbles: Record<string, { pos: [number, number] }> } }).getCache('bubble_cloud').bubbles)[0] as {
      pos: [number, number]
    }

    const hit = cache.func.call((cache as unknown as { obj: unknown }).obj, bubble.pos[0], bubble.pos[1])
    expect((hit as { title: string }).title).toBe('Only')
  })
})
