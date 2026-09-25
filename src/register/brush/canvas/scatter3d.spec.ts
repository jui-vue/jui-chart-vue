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

describe('canvas.scatter3d brush', () => {
  it('draws a radial-gradient-filled circle per (row, target) cell', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [
          {
            x: { type: 'range', domain: [0, 10] },
            y: { type: 'range', domain: [0, 10] },
            z: { type: 'range', domain: [0, 10] },
            depth: 100,
            degree: { x: 10, y: 20, z: 0 },
            perspective: 0.8,
            data: [{ v: 3 }, { v: 7 }],
          },
        ],
        brush: [{ type: 'canvas.scatter3d', target: ['v'], size: 10 }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls.filter((c) => c === 'arc').length).toBe(2)
    expect(buffer.calls).toContain('createRadialGradient')
    expect(buffer.calls).toContain('fill')
  })

  it('setup() defaults size:7', () => {
    patch = installStubCanvasContext()

    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        canvas: true,
        axis: [
          {
            x: { type: 'range', domain: [0, 10] },
            y: { type: 'range', domain: [0, 10] },
            z: { type: 'range', domain: [0, 10] },
            depth: 50,
            data: [{ v: 1 }],
          },
        ],
        brush: [{ type: 'canvas.scatter3d', target: ['v'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.size).toBe(7)
  })
})
