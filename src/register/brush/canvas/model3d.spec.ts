import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Builder } from 'jui-graph-ts'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from './testCanvasStub'
import { getPolygonModel, registerPolygonModel } from './model3d'
import { PolygonCore } from 'jui-graph-ts'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

describe('canvas.model3d brush', () => {
  it('registers the real site\'s "f16" model (2537 source vertices, resolvable via getPolygonModel)', () => {
    const Model = getPolygonModel('f16')
    expect(Model).toBeDefined()

    const instance = new Model!()
    expect(instance.sources.length).toBe(2537)
    expect(instance.faces.length).toBeGreaterThan(0)
    expect(instance.vertices).toEqual([])
  })

  it('draws a stroked wireframe (moveTo/lineTo/stroke) for a small registered test model', () => {
    patch = installStubCanvasContext()

    class TinyModel extends PolygonCore {
      sources = [new Float32Array([0, 0, 0, 1]), new Float32Array([1, 1, 1, 1]), new Float32Array([2, 0, 0, 1])]
      faces = [new Float32Array([0, 1, 2])]

      constructor() {
        super()
        this.vertices = []
      }
    }
    registerPolygonModel('__test_tiny__', TinyModel as never)

    const wrapper = mount(Chart, {
      props: {
        width: 300,
        height: 300,
        canvas: true,
        axis: [
          {
            x: { type: 'range', domain: [-5, 5] },
            y: { type: 'range', domain: [-5, 5] },
            z: { type: 'range', domain: [-5, 5] },
            depth: 100,
            degree: { x: 10, y: 10, z: 0 },
            perspective: 0.8,
            data: [],
          },
        ],
        brush: [{ type: 'canvas.model3d', model: '__test_tiny__' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('moveTo')
    expect(buffer.calls).toContain('lineTo')
    expect(buffer.calls).toContain('stroke')
  })

  it('draw() is a safe no-op when brush.model resolves to nothing (setup() default: null)', () => {
    patch = installStubCanvasContext()

    expect(() =>
      mount(Chart, {
        props: {
          width: 200,
          height: 200,
          canvas: true,
          axis: [{ x: { type: 'range', domain: [-5, 5] }, y: { type: 'range', domain: [-5, 5] }, z: { type: 'range', domain: [-5, 5] }, depth: 50, data: [] }],
          brush: [{ type: 'canvas.model3d' }],
        },
      }),
    ).not.toThrow()
  })
})
