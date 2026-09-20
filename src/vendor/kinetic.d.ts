/**
 * Hand-written types for the vendored, unmodified `kinetic.js` (see that file's own header
 * comment and PORT_STATUS.md's Phase E policy note / kinetic.js entry for the full writeup on why
 * this generic physics utility is imported as-is rather than hand-ported like every chart-domain
 * file in this project). No logic lives here - this file exists purely so `../composables/
 * kinetic.ts` (and anything downstream of it) gets full type safety over the real, original
 * implementation.
 *
 * Shape traced directly from the vendored source: the default export is a jui "module descriptor"
 * object (`{ name, extend: null, component }`), NOT a directly-usable class - the original jui
 * module loader would normally call `.component()` for you (`JUI.include("util.canvas.base.
 * kinetic")`); this port has no such loader, so `../composables/kinetic.ts` calls it once itself.
 */

/** A 2D `[x, y]` tuple - every position/velocity/acceleration/force in the original is this
 *  shape, never a `{x, y}` object. */
export type Vec2 = [number, number];

/** Instance shape of the real `KineticObject` constructor `kinetic.js`'s `component()` factory
 *  returns. Every member here is a literal, unmodified original method/field - see kinetic.js
 *  itself for the actual implementation this merely describes the type of. */
export declare class KineticObject {
  mass: number;
  /** Never read by any method on this class (confirmed from source) - present only because the
   *  original declares it; harmless to leave typed and unused. */
  friction: number;
  pos: Vec2;
  veloc: Vec2;
  accel: Vec2;

  /** F = ma -> accel += f / mass. Accumulates into any already-pending `accel` (does not
   *  overwrite) - multiple calls before the next `update()` sum. */
  force(f: Vec2): void;
  accelScalar(): number;
  velocScalar(): number;
  /** A drag-like force magnitude (0.5 * mass * veloc^2 per axis, signed by veloc's own
   *  direction). Not called internally by anything else on this class. */
  velocityForce(): Vec2;
  distancePos(pos: Vec2): number;
  distance(other: KineticObject): number;
  /** Unit vector from `pos` TOWARD `this.pos` (i.e. `this.pos - pos`, normalized). `[0, 0]` at
   *  zero distance. */
  direction(pos: Vec2): Vec2;
  speed(): number;
  /** One Euler-integration tick: `veloc += accel` unconditionally, `pos += veloc` per axis only
   *  once `|veloc|` on that axis exceeds `2` (preserved literally, including the resulting
   *  "stuck at small nonzero velocity forever" quirk on an axis that never crosses the gate -
   *  `friction` is never consulted to decay it). `accel` resets to `[0, 0]` every call. Meant to
   *  be called once per animation frame by the caller - the original engine has no built-in
   *  scheduler of its own (this port's `useAnimationFrameLoop` in `useCanvasChart.ts` is what
   *  calls this repeatedly here). */
  update(): void;
  /** No-op in the original too - a stub meant to be overridden by a subclass (`base/bubble.js`/
   *  `base/mortalbubble.js`, a future Phase E item). */
  draw(context: CanvasRenderingContext2D, n: number): void;
}

export interface KineticModule {
  name: string;
  extend: null;
  /** Returns the real `KineticObject` constructor - call once and reuse, same as the original
   *  jui module loader's own `JUI.include()` would resolve to a single shared constructor. */
  component(): { new (): KineticObject };
}

declare const kineticModule: KineticModule;
export default kineticModule;
