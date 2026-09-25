// Port of legacy `src/brush/canvas/base/kinetic.js` ("util.canvas.base.kinetic", extend: null) -
// a plain physics-vector helper class (mass/friction/position/velocity/acceleration), shared by
// `base/bubble.js` ("util.canvas.base.bubble") and `base/mortalbubble.js`
// ("util.canvas.base.mortalbubble"), both of which `extend: "util.canvas.base.kinetic"`. Not part
// of any `chart.*` `extend` chain (`jui-graph-ts` doesn't register/export it, since it's a
// `jui-chart`-OWN canvas-brush helper, not a `juijs-graph` engine primitive) - ported here as a
// real ES class per this project's own established convention (Phase 0 rule 2 in `jui-graph-ts`,
// followed throughout this project's `register/` tree), imported directly by `base/bubble.ts`/
// `base/mortalbubble.ts` rather than looked up through any registry.
export class KineticObject {
  mass = 10
  friction = 0.1
  pos: [number, number] = [0, 0]
  veloc: [number, number] = [0, 0]
  accel: [number, number] = [0, 0]

  force(f: [number, number]): void {
    this.accel = [this.accel[0] + f[0] / this.mass, this.accel[1] + f[1] / this.mass]
  }

  accelScalar(): number {
    return Math.sqrt(this.accel[0] * this.accel[0] + this.accel[1] * this.accel[1])
  }

  velocScalar(): number {
    return Math.sqrt(this.veloc[0] * this.veloc[0] + this.veloc[1] * this.veloc[1])
  }

  velocityForce(): [number, number] {
    const xDir = this.veloc[0] < 0 ? -1 : 1
    const yDir = this.veloc[1] < 0 ? -1 : 1
    return [xDir * 0.5 * this.mass * this.veloc[0] * this.veloc[0], yDir * 0.5 * this.mass * this.veloc[1] * this.veloc[1]]
  }

  distancePos(pos: [number, number]): number {
    return Math.sqrt(Math.pow(this.pos[0] - pos[0], 2) + Math.pow(this.pos[1] - pos[1], 2))
  }

  distance(other: { pos: [number, number] }): number {
    return this.distancePos(other.pos)
  }

  direction(pos: [number, number]): [number, number] {
    const distance = this.distancePos(pos)
    if (distance == 0) return [0, 0]
    return [(this.pos[0] - pos[0]) / distance, (this.pos[1] - pos[1]) / distance]
  }

  speed(): number {
    return Math.sqrt(Math.pow(this.veloc[0], 2) + Math.pow(this.veloc[1], 2))
  }

  update(): void {
    this.veloc = [this.veloc[0] + this.accel[0], this.veloc[1] + this.accel[1]]

    let x = this.pos[0]
    let y = this.pos[1]

    if (Math.abs(this.veloc[0]) > 2) {
      x = this.pos[0] + this.veloc[0]
    }
    if (Math.abs(this.veloc[1]) > 2) {
      y = this.pos[1] + this.veloc[1]
    }

    this.pos = [x, y]
    this.accel = [0, 0]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  draw(_context: CanvasRenderingContext2D, _now: number): void {}
}
