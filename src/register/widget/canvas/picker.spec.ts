import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Builder } from 'jui-graph-ts'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from '../../brush/canvas/testCanvasStub'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

describe('canvas.picker widget', () => {
  it('emits "picker.click" with the hit-tested row when a chart.emit("click", ...)-style axis.click fires over a hit bubble', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [{ data: [{ title: 'Only', capacity: 1 }] }],
        brush: [{ type: 'canvas.bubblecloud' }],
        widget: [{ type: 'canvas.picker', brush: [0] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder() as unknown as {
      getCache(key: string, def?: unknown): { obj: unknown; func: (this: unknown, x: number, y: number) => unknown }
      emit(type: string, args?: unknown[]): unknown
      on(type: string, cb: (...a: unknown[]) => void): unknown
    }

    const cache = builder.getCache('picker')
    const bubble = Object.values(
      (
        builder as unknown as { getCache(key: string, def?: unknown): { bubbles: Record<string, { pos: [number, number] }> } }
      ).getCache('bubble_cloud').bubbles,
    )[0] as { pos: [number, number] }

    let received: unknown = null
    builder.on('picker.click', (payload: unknown) => {
      received = payload
    })

    // `canvas.picker` wires its handler via `CoreWidget.on('axis.click', cb, brush.axis)`
    // (`widget/core.ts`), which only invokes `cb` when the SECOND emitted arg equals that
    // `axisIndex` - so triggering it here means `chart.emit('axis.click', [event, axisIndex])`,
    // not a plain brush-level `'click'` (a different event family, `CoreBrush.addEvent()`'s own).
    builder.emit('axis.click', [{ chartX: bubble.pos[0], chartY: bubble.pos[1] }, 0])

    expect(received).not.toBeNull()
    expect((received as { data: { title: string } }).data.title).toBe('Only')

    void cache
  })

  it('setup() defaults hover:false and brush:[0]', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [{ data: [{ title: 'Only', capacity: 1 }] }],
        brush: [{ type: 'canvas.bubblecloud' }],
        widget: [{ type: 'canvas.picker' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const widget = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('widget', 0)

    expect(widget.hover).toBe(false)
    expect(widget.brush).toEqual([0])
  })
})
