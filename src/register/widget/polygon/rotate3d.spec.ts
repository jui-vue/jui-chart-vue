import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'

function mount3d(widget: Record<string, unknown>) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'block', domain: ['Q1', 'Q2'] },
          y: { type: 'range', domain: [0, 30] },
          z: { type: 'block', domain: ['sales'] },
          data: [{ sales: 10 }, { sales: 15 }],
          depth: 100,
          degree: { x: 30, y: 20, z: 0 },
          perspective: 0.6,
        },
      ],
      brush: [{ type: 'polygon.column3d', target: ['sales'] }],
      widget: [widget],
    },
  })
}

describe('polygon.rotate3d widget', () => {
  it('a mousedown -> mousemove drag over the axis rotates axis.degree.x/.y and re-renders', () => {
    // `unit: 1` guarantees the snapped angle is always a multiple of the grid step (every
    // `Math.floor(...)` result is already an integer), so this drag's re-render always actually
    // applies - the default `unit: 5` would make whether `dx % unit == 0`/`dy % unit == 0` (per
    // `setScrollEvent()`'s own "skip unless snapped" guard) depend on this test's exact
    // width/height, which is unrelated to what this test is verifying.
    const wrapper = mount3d({ type: 'polygon.rotate3d', unit: 1 })

    const builder = (wrapper.vm as unknown as {
      getBuilder(): {
        axis(i: number): { degree: { x: number; y: number; z: number }; area(key: string): number }
        emit(type: string, args?: unknown[]): unknown
      }
    }).getBuilder()

    const axis = builder.axis(0)
    const startDegree = { ...axis.degree }

    // `PolygonRotate3DWidget.setScrollEvent()` wires `axis.mousedown`/`axis.mousemove`/
    // `axis.mouseup` via `CoreWidget.on(type, cb, axisIndex)` - same `[event, axisIndex]`
    // dispatch shape `canvas.picker`'s own spec already exercises.
    builder.emit('axis.mousedown', [{ chartX: 0, chartY: 0 }, 0])
    builder.emit('axis.mousemove', [{ chartX: 200, chartY: 200 }, 0])

    const w = axis.area('width')
    const h = axis.area('height')
    const expectedDx = startDegree.x + Math.floor((200 / h) * 180)
    const expectedDy = startDegree.y - Math.floor((200 / w) * 180)

    expect(axis.degree.x).toBe(expectedDx)
    expect(axis.degree.y).toBe(expectedDy)
  })

  it('setup() defaults unit:5 and axis:[0]', () => {
    const wrapper = mount3d({ type: 'polygon.rotate3d' })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const widget = builder.get('widget', 0)

    expect(widget.unit).toBe(5)
    expect(widget.axis).toEqual([0])
  })
})
