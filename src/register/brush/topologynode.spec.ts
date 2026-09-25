import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

function mountTopology(brushExtra: Record<string, unknown> = {}) {
  return mount(Chart, {
    props: {
      width: 500,
      height: 400,
      axis: [
        {
          c: { type: 'topologytable' },
          data: [
            { key: 'a', outgoing: ['b'] },
            { key: 'b', outgoing: ['c'] },
            { key: 'c', outgoing: [] },
          ],
        },
      ],
      brush: [{ type: 'topologynode', ...brushExtra }],
    },
  })
}

describe('topologynode brush', () => {
  it('renders one node <circle class="circle"> per row, using the real chart.grid.topologytable axis-c grid', () => {
    const wrapper = mountTopology()
    const group = wrapper.element.querySelector('g.brush-topologynode')
    expect(group).not.toBeNull()

    expect(group!.querySelectorAll('circle.circle').length).toBe(3)
  })

  it('draws one edge line per outgoing connection (a->b, b->c = 2 edges), plus one endpoint circle per edge', () => {
    const wrapper = mountTopology()
    const group = wrapper.element.querySelector('g.brush-topologynode')!

    expect(group.querySelectorAll('line').length).toBe(2)
    // 2 edge endpoint circles + 3 node circles = 5 total circles.
    expect(group.querySelectorAll('circle').length).toBe(5)
  })

  it('skips a self-referencing outgoing entry (key === targetKey) without creating an edge for it', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 500,
        height: 400,
        axis: [
          {
            c: { type: 'topologytable' },
            data: [{ key: 'a', outgoing: ['a'] }],
          },
        ],
        brush: [{ type: 'topologynode' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-topologynode')!
    expect(group.querySelectorAll('line').length).toBe(0)
    expect(group.querySelectorAll('circle.circle').length).toBe(1)
  })

  it('renders a nodeTitle/nodeText label when the corresponding callbacks are configured, resolving `{key}` icon-font placeholders via the now-registered classic icon map', () => {
    const wrapper = mountTopology({
      nodeTitle: (d: { key: string }) => `Title:${d.key}`,
      // `{check}` - `chart.text()`'s `parseIconInText()` resolves this to the real registered
      // "classic" icon codepoint (see `register/icon/classic.ts`) - ``.
      nodeText: () => '{check}',
    })

    const group = wrapper.element.querySelector('g.brush-topologynode')!
    const nodeTextEl = group.querySelector('text.text')
    expect(nodeTextEl?.textContent).toBe('')

    const texts = Array.from(group.querySelectorAll('text.title')).map((t) => t.textContent)
    expect(texts).toContain('Title:a')
    expect(group.querySelectorAll('text.text').length).toBe(3)
  })

  // NOT a faithful-rendering config - see `topologynode.ts`'s own header comment. Deliberately
  // configuring the WRONG axis-c grid type (the auto-registered default "panel", which never
  // initializes `axis.cache`) reproduces the exact real crash this brush would hit in the true
  // original engine if it were ever wired up without its required `chart.grid.topologytable` grid
  // - kept as a regression test for that faithful failure mode, now that the correct grid exists
  // and is exercised by every other test in this file.
  it('crashes on axis.cache.nodeKey when misconfigured with an incompatible axis-c grid (e.g. the default "panel")', () => {
    expect(() =>
      mount(Chart, {
        props: {
          width: 400,
          height: 300,
          axis: [{ data: [{ key: 'a', outgoing: ['b'] }, { key: 'b', outgoing: [] }] }],
          brush: [{ type: 'topologynode' }],
        },
      }),
    ).toThrow(/nodeKey/)
  })
})
