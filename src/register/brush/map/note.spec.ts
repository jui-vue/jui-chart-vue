import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubMapXhr } from './testMapXhrStub'

describe('map.note brush', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('mounts without throwing against a map axis (real note-balloon placement is Playwright-verified against the live site)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.note', active: ['KR'] }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()
  })

  it('setup() defaults active:[], activeEvent:null, format:null', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.note' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.active).toEqual([])
    expect(brush.activeEvent).toBeNull()
    expect(brush.format).toBeNull()
  })
})
