import { describe, expect, it } from 'vitest'
import {
  buildTopologyEdges,
  findTopologyEdgeData,
  findTopologyNode,
  getDistanceXY,
  layoutTopologyLinear,
  layoutTopologyRandom,
  topologyActiveEdgeKeysForEdge,
  topologyActiveEdgeKeysForNode,
  topologyBalloonPoints,
  topologyEdgeAlign,
  topologyEdgeTextPosition,
  topologyTooltipPosition,
  topologyTooltipTitleNames,
  type TopologyPositionedNode,
} from './useTopology'

describe('layoutTopologyRandom', () => {
  it('places each node with floor(rng()*(dim-space)) inset by space, offset by area origin', () => {
    const seq = [0.5, 0.25, 0.1, 0.9]
    let i = 0
    const rng = () => seq[i++]
    const area = { x: 10, y: 20, width: 200, height: 100 }
    const points = layoutTopologyRandom(2, area, 50, rng)
    // node 0: x = 10 + floor(0.5*(200-50)) = 10 + floor(75) = 85; y = 20 + floor(0.25*(100-50)) = 20 + 12 = 32
    expect(points[0]).toEqual({ x: 85, y: 32 })
    // node 1: x = 10 + floor(0.1*150) = 10 + 15 = 25; y = 20 + floor(0.9*50) = 20 + 45 = 65
    expect(points[1]).toEqual({ x: 25, y: 65 })
  })
})

describe('layoutTopologyLinear', () => {
  // Hand-traced: count=4, area {x:0,y:0,width:200,height:100}, space=50.
  // rowCount = floor(100/50) = 2, colCount = floor(200/50) = 4, colStep = floor(4/4) = 1.
  // X is a deterministic zigzag over SLOTS (not row index `i` - see this test's second case):
  //   i=0 (even): x=0*50=0  -> final x=0+0+50=50,  slot = left(-1+1)=0
  //   i=1 (odd):  x=(4-0)*50+50=250? -- careful: colIndex is 0 when i=1 is processed (colIndex
  //               only advances on EVEN iterations, and i=0 already advanced it to 1 by the time
  //               i=1 runs) -> x=(4-1)*50+50=200 -> final x=0+200+50=250, slot = right(4-1)=3
  //   i=2 (even): colIndex is 1 -> x=1*50=50 -> final x=100, slot = left(0+1)=1
  //   i=3 (odd):  colIndex is 2 (advanced again at i=2) -> x=(4-2)*50+50=150 -> final x=200,
  //               slot = right(3-1)=2
  // rng sequence [0.1, 0.9, 0.2, 0.8] with rowCount=2 (floor(x*2)): 0, 1, 0(cache full->reset), 1
  //   -> y offsets (row*space + space/2): i0 y=0*50+25=25, i1 y=1*50+25=75, i2 y=0*50+25=25 (cache
  //   reset after being full, so 0 is allowed again), i3 y=1*50+25=75
  // Final slots: [0]=(50,25) from i0, [1]=(100,25) from i2, [2]=(200,75) from i3, [3]=(250,75) from i1
  const seq = [0.1, 0.9, 0.2, 0.8]
  function rng() {
    return seq[callIndex++]
  }
  let callIndex = 0

  it('matches the full hand-traced 4-node slot array', () => {
    callIndex = 0
    const area = { x: 0, y: 0, width: 200, height: 100 }
    const points = layoutTopologyLinear(4, area, 50, rng)
    expect(points).toEqual([
      { x: 50, y: 25 },
      { x: 100, y: 25 },
      { x: 200, y: 75 },
      { x: 250, y: 75 },
    ])
  })

  it('demonstrates the real row-shuffle quirk: row 1 and row 2 do not get their own computed point', () => {
    // Row 1 (odd, i=1) computed x=250 itself, but that landed in slot 3, not slot 1 - so
    // `points[1]` (what row 1 is actually drawn at) is really row 2's computation (x=100), not
    // row 1's own (x=250). This is the source's own real behavior, not a bug in this port.
    callIndex = 0
    const area = { x: 0, y: 0, width: 200, height: 100 }
    const points = layoutTopologyLinear(4, area, 50, rng)
    expect(points[1].x).toBe(100) // row 2's own computed x, not row 1's (250)
    expect(points[3].x).toBe(250) // row 1's own computed x ended up at slot 3
  })

  it('respects an area offset (x/y added on top of the space-based grid position)', () => {
    callIndex = 0
    const area = { x: 1000, y: 2000, width: 200, height: 100 }
    const points = layoutTopologyLinear(4, area, 50, rng)
    expect(points[0]).toEqual({ x: 1050, y: 2025 })
  })
})

describe('getDistanceXY', () => {
  it('walks the full distance to (x2,y2) when dist=0 (a 3-4-5 triangle)', () => {
    const r = getDistanceXY(0, 0, 3, 4, 0)
    expect(r.distance).toBeCloseTo(5)
    expect(r.x).toBeCloseTo(3)
    expect(r.y).toBeCloseTo(4)
    expect(r.angle).toBeCloseTo(Math.atan2(4, 3))
  })

  it('stops short of (x2,y2) by |dist| when dist is negative', () => {
    const r = getDistanceXY(0, 0, 3, 4, -2)
    // effective distance = 5 - 2 = 3, same direction (0.6, 0.8)
    expect(r.x).toBeCloseTo(1.8)
    expect(r.y).toBeCloseTo(2.4)
  })
})

describe('buildTopologyEdges', () => {
  function node(key: string, outgoing: string[], x: number, y: number, radius: number, scale = 1): TopologyPositionedNode {
    return { key, data: { key, outgoing }, x, y, radius, scale }
  }

  it('hand-traced reciprocal pair (equal radius, pointRadius=3): clean integer in/out points', () => {
    // A=(0,0) r10, B=(100,0) r10, both scale 1, pointRadius 3.
    // inDist = outDist = (10+3+1)*1 = 14 for every leg here (equal radii).
    const nodes = [node('A', ['B'], 0, 0, 10), node('B', ['A'], 100, 0, 10)]
    const edges = buildTopologyEdges(nodes, 3)
    expect(edges).toHaveLength(2)

    const ab = edges.find((e) => e.key === 'A:B')!
    // near source A, pulled back 14 toward B along the x-axis -> (14, 0)
    expect(ab.inXY.x).toBeCloseTo(14)
    expect(ab.inXY.y).toBeCloseTo(0)
    // near target B, pulled back 14 toward A -> (86, 0)
    expect(ab.outXY.x).toBeCloseTo(86)
    expect(ab.outXY.y).toBeCloseTo(0)
    expect(ab.connect).toBe(false)
    expect(ab.ownsLine).toBe(true)

    const ba = edges.find((e) => e.key === 'B:A')!
    expect(ba.inXY.x).toBeCloseTo(86) // near source B
    expect(ba.outXY.x).toBeCloseTo(14) // near target A
    expect(ba.connect).toBe(true)
    expect(ba.ownsLine).toBe(false)
    expect(ba.reverseKey).toBe('A:B')
  })

  it('skips a self-referencing outgoing entry', () => {
    const nodes = [node('A', ['A'], 0, 0, 10)]
    expect(buildTopologyEdges(nodes, 3)).toEqual([])
  })

  it('skips an outgoing key with no matching node', () => {
    const nodes = [node('A', ['ghost'], 0, 0, 10)]
    expect(buildTopologyEdges(nodes, 3)).toEqual([])
  })

  it('scales both in/out pull-back distances by the SOURCE node\'s own scale, never the target\'s', () => {
    // A scale=2, radius 10; B scale=1, radius 10. pointRadius 0.
    // Edge A->B: inDist = (A.r + 0 + 1) * A.scale = 11*2 = 22; outDist = (B.r + 0 + 1) * A.scale = 11*2 = 22 too.
    const nodes = [node('A', ['B'], 0, 0, 10, 2), node('B', [], 100, 0, 10, 1)]
    const edges = buildTopologyEdges(nodes, 0)
    const ab = edges[0]
    expect(ab.inXY.x).toBeCloseTo(22) // pulled back 22 from A toward B
    expect(ab.outXY.x).toBeCloseTo(78) // pulled back 22 from B toward A (100 - 22)
  })
})

describe('active-edge cascading', () => {
  function node(key: string, outgoing: string[], x: number, y: number, radius: number): TopologyPositionedNode {
    return { key, data: { key, outgoing }, x, y, radius, scale: 1 }
  }

  // A<->B reciprocal (A:B built first -> connect=false; B:A built second -> connect=true), plus
  // A->C one-way (no reciprocal at all).
  const nodes = [node('A', ['B', 'C'], 0, 0, 10), node('B', ['A'], 100, 0, 10), node('C', [], 50, 50, 5)]
  const edges = buildTopologyEdges(nodes, 3)

  it('node A: A:B has connect=false, so activating A does NOT cascade to B:A', () => {
    const active = topologyActiveEdgeKeysForNode({ key: 'A', outgoing: ['B', 'C'] }, edges)
    expect(active).toEqual(new Set(['A:B', 'A:C']))
  })

  it('node B: B:A has connect=true, so activating B DOES cascade to A:B', () => {
    const active = topologyActiveEdgeKeysForNode({ key: 'B', outgoing: ['A'] }, edges)
    expect(active).toEqual(new Set(['B:A', 'A:B']))
  })

  it('activating edge A:C directly (no reciprocal) yields just itself', () => {
    expect(topologyActiveEdgeKeysForEdge('A:C', edges)).toEqual(new Set(['A:C']))
  })

  it('activating edge B:A directly cascades to A:B (connect=true)', () => {
    expect(topologyActiveEdgeKeysForEdge('B:A', edges)).toEqual(new Set(['B:A', 'A:B']))
  })

  it('an unknown edge key yields an empty set', () => {
    expect(topologyActiveEdgeKeysForEdge('X:Y', edges)).toEqual(new Set())
  })
})

describe('topologyEdgeAlign / topologyEdgeTextPosition', () => {
  it('"end" when the outgoing point is to the right of the incoming point', () => {
    expect(topologyEdgeAlign({ x: 10, y: 0 }, { x: 90, y: 0 })).toBe('end')
    expect(topologyEdgeAlign({ x: 90, y: 0 }, { x: 10, y: 0 })).toBe('start')
  })

  it('"end" branch anchors on outXY, rotates by outXY.angle', () => {
    const inXY = { x: 0, y: 0, angle: 0.1, distance: 10 }
    const outXY = { x: 100, y: 50, angle: 0.5, distance: 10 }
    const pos = topologyEdgeTextPosition('end', inXY, outXY)
    expect(pos).toEqual({ x: 91, y: 63, rotateDeg: (0.5 * 180) / Math.PI, cx: 100, cy: 50, textAnchor: 'end' })
  })

  it('"start" branch anchors on outXY too, but rotates by inXY.angle', () => {
    const inXY = { x: 0, y: 0, angle: 0.1, distance: 10 }
    const outXY = { x: 100, y: 50, angle: 0.5, distance: 10 }
    const pos = topologyEdgeTextPosition('start', inXY, outXY)
    expect(pos.rotateDeg).toBeCloseTo((0.1 * 180) / Math.PI)
    expect({ ...pos, rotateDeg: undefined }).toEqual({ x: 108, y: 43, rotateDeg: undefined, cx: 100, cy: 50, textAnchor: 'start' })
  })
})

describe('topologyBalloonPoints', () => {
  it('"top" matches the hand-computed hexagon-with-bottom-tail points', () => {
    expect(topologyBalloonPoints('top', 40, 20, 6)).toBe('0,0 40,0 40,20 23,20 20,26 17,20 0,20 0,0')
  })

  it('"bottom" matches the hand-computed hexagon-with-top-tail points', () => {
    expect(topologyBalloonPoints('bottom', 40, 20, 6)).toBe('0,6 17,6 20,0 23,6 40,6 40,26 0,26 0,6')
  })
})

describe('topologyTooltipPosition', () => {
  it('"end" align sits below outXY', () => {
    const pos = topologyTooltipPosition('end', { x: 100, y: 50 }, 40, 20, 6, 3)
    // x = 100 - 20 + 3 + 1.5 = 84.5 ; y = 50 + 3 + 3 = 56
    expect(pos.x).toBeCloseTo(84.5)
    expect(pos.y).toBeCloseTo(56)
  })

  it('"start" align sits above outXY', () => {
    const pos = topologyTooltipPosition('start', { x: 100, y: 50 }, 40, 20, 6, 3)
    // y = 50 - 6 - 20 + 3 = 27
    expect(pos.y).toBeCloseTo(27)
  })
})

describe('topologyTooltipTitleNames / findTopologyNode / findTopologyEdgeData', () => {
  const nodes = [
    { key: 'A', outgoing: ['B'], name: 'Alpha' },
    { key: 'B', outgoing: [], name: 'Beta' },
  ]

  it('resolves both endpoint display names via nodeTitle, falling back to the raw key', () => {
    const names = topologyTooltipTitleNames('A:B', nodes, (d) => d.name as string)
    expect(names).toEqual(['Alpha', 'Beta'])
  })

  it('falls back to the node key when nodeTitle is not supplied', () => {
    expect(topologyTooltipTitleNames('A:B', nodes)).toEqual(['A', 'B'])
  })

  it('returns the raw key string when neither endpoint matches any node', () => {
    expect(topologyTooltipTitleNames('X:Y', nodes)).toBe('X:Y')
  })

  it('findTopologyNode / findTopologyEdgeData do a plain linear lookup by key', () => {
    expect(findTopologyNode(nodes, 'B')?.name).toBe('Beta')
    expect(findTopologyNode(nodes, 'Z')).toBeNull()
    const edgeData = [{ key: 'A:B', count: 3 }]
    expect(findTopologyEdgeData(edgeData, 'A:B')?.count).toBe(3)
    expect(findTopologyEdgeData(edgeData, 'B:A')).toBeNull()
  })
})
