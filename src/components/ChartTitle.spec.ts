import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartTitle from './ChartTitle.vue'

// `measureTextSize` needs real font metrics (getBBox()), not meaningful under vitest/jsdom - see
// `tooltipMeasure.ts`'s own header comment on the same split for `measureTextWidth`. Stubbed to a
// deterministic value so the rotation-center math (which DOES need to be pinned exactly) is
// testable independent of real glyph metrics - real measurement is verified in the Playwright pass
// (see PORT_STATUS.md's `title.js` entry).
vi.mock('../composables/tooltipMeasure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/tooltipMeasure')>()
  return { ...actual, measureTextSize: vi.fn(() => ({ width: 60, height: 14 })) }
})

// Same fixture as `useChartTitle.spec.ts`: width=400, height=300,
// padding={top:20,right:24,bottom:32,left:48} -> area {x:48,y:20,x2:376,y2:268,width:328,height:248}.
const WIDTH = 400
const HEIGHT = 300
const PADDING = { top: 20, right: 24, bottom: 32, left: 48 }

describe('ChartTitle', () => {
  it('orient="top" (default), align="middle" (default): renders at (width/2, PADDING=20), anchor=middle', () => {
    const wrapper = mount(ChartTitle, { props: { text: 'Revenue', width: WIDTH, height: HEIGHT, padding: PADDING } })
    const text = wrapper.get('text')
    expect(text.attributes('x')).toBe('212')
    expect(text.attributes('y')).toBe('20')
    expect(text.attributes('text-anchor')).toBe('middle')
    expect(text.text()).toBe('Revenue')
  })

  it('orient="bottom", align="start"', () => {
    const wrapper = mount(ChartTitle, {
      props: { text: 'Revenue', width: WIDTH, height: HEIGHT, padding: PADDING, orient: 'bottom', align: 'start' },
    })
    const text = wrapper.get('text')
    expect(text.attributes('x')).toBe('48')
    expect(text.attributes('y')).toBe('280')
    expect(text.attributes('text-anchor')).toBe('start')
  })

  it('orient="center", align="end"', () => {
    const wrapper = mount(ChartTitle, {
      props: { text: 'Revenue', width: WIDTH, height: HEIGHT, padding: PADDING, orient: 'center', align: 'end' },
    })
    const text = wrapper.get('text')
    expect(text.attributes('x')).toBe('376')
    expect(text.attributes('y')).toBe('144')
    expect(text.attributes('text-anchor')).toBe('end')
  })

  it('dx/dy offset the rendered position, applied AFTER orient/align positioning', () => {
    const wrapper = mount(ChartTitle, {
      props: { text: 'Revenue', width: WIDTH, height: HEIGHT, padding: PADDING, dx: 5, dy: -3 },
    })
    const text = wrapper.get('text')
    expect(text.attributes('x')).toBe('217')
    expect(text.attributes('y')).toBe('17')
  })

  it('no rotation transform for orient="top"/orient="bottom" regardless of align', () => {
    const top = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT, orient: 'top', align: 'start' } })
    expect(top.get('text').attributes('transform')).toBeUndefined()

    const bottom = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT, orient: 'bottom', align: 'end' } })
    expect(bottom.get('text').attributes('transform')).toBeUndefined()
  })

  it('no rotation transform for orient="center", align="middle" - NOT a general vertical-mode flag', () => {
    const wrapper = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT, orient: 'center', align: 'middle' } })
    expect(wrapper.get('text').attributes('transform')).toBeUndefined()
  })

  it('orient="center", align="start": rotate(-90) around (x+dx+halfTextWidth, y+dy+halfTextHeight)', () => {
    const wrapper = mount(ChartTitle, {
      props: { text: 'Vertical', width: WIDTH, height: HEIGHT, padding: PADDING, orient: 'center', align: 'start' },
    })
    const text = wrapper.get('text')
    // x=48, y=144 (no dx/dy); measured half-width=30, half-height=7 (stub: 60x14)
    expect(text.attributes('transform')).toBe('rotate(-90 78 151)')
  })

  it('orient="center", align="end": rotate(90) around (x+dx-halfTextWidth, y+dy+halfTextHeight)', () => {
    const wrapper = mount(ChartTitle, {
      props: { text: 'Vertical', width: WIDTH, height: HEIGHT, padding: PADDING, orient: 'center', align: 'end' },
    })
    const text = wrapper.get('text')
    // x=376, y=144; half-width=30, half-height=7
    expect(text.attributes('transform')).toBe('rotate(90 346 151)')
  })

  it('color/size fall back to their own defaults when not provided; explicit props override', () => {
    const defaults = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT } })
    expect(defaults.get('text').attributes('fill')).toBe('#333')
    expect(defaults.get('text').attributes('font-size')).toBe('13')

    const overridden = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT, color: '#f00', size: 22 } })
    expect(overridden.get('text').attributes('fill')).toBe('#f00')
    expect(overridden.get('text').attributes('font-size')).toBe('22')
  })

  it('font-weight always renders the passed weight verbatim (source never lets widget.color/size-style override apply to weight)', () => {
    const wrapper = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT, weight: 'bold' } })
    expect(wrapper.get('text').attributes('font-weight')).toBe('bold')
  })

  it('with no padding prop (matching every current <ChartTitle> caller), defaults reduce to (width/2, 20)', () => {
    const wrapper = mount(ChartTitle, { props: { text: 'T', width: WIDTH, height: HEIGHT } })
    const text = wrapper.get('text')
    expect(text.attributes('x')).toBe('200')
    expect(text.attributes('y')).toBe('20')
  })
})
