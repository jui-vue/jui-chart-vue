/**
 * NOT a hand-port. `kinetic.js` (`util.canvas.base.kinetic`, `extend: null`) is a small,
 * self-contained, generically-named physics utility with zero chart-domain logic - it would be
 * equally at home in a completely unrelated project, so per PORT_STATUS.md's Phase E policy
 * (explicit user instruction) it's exempt from this project's "hand-reimplement everything in
 * idiomatic Vue/TS" rule that every actual chart/axis/rendering-engine file otherwise follows.
 * That exception is PERMANENT for this file (not a stopgap pending a future `juijs-graph` Vue
 * port - see PORT_STATUS.md's kinetic.js entry for the "which bucket does this file fall in"
 * test and why `kinetic.js` lands in the permanent-import bucket, not the future-real-port one).
 *
 * The real, unmodified physics implementation lives at `src/vendor/kinetic.js` (vendored
 * byte-for-byte from `jui-chart/src/brush/canvas/base/kinetic.js`), typed by the hand-written
 * `src/vendor/kinetic.d.ts`. This file is ONLY the thin instantiation shim the original jui
 * module loader would otherwise provide: the vendored module's default export is a "module
 * descriptor" (`{ name, extend: null, component }`), not a directly-`new`-able class - the
 * original engine's `JUI.include("util.canvas.base.kinetic")` calls `.component()` for you and
 * caches the result; this port has no such loader, so that single call happens once here instead.
 * No physics math is reimplemented, extended, or otherwise touched in this file.
 */
import kineticModule from '../vendor/kinetic'
import type { KineticObject as KineticObjectInstance, Vec2 } from '../vendor/kinetic'

export type { Vec2 }

/** The real, vendored `util.canvas.base.kinetic` constructor - `new KineticObject()` gives an
 * instance with the exact shape documented in `src/vendor/kinetic.d.ts`. Declared as both a
 * value (the constructor itself) and a type (the instance shape, via the `export type` alias
 * below) so callers can write `new KineticObject()` and `field: KineticObject` exactly like
 * importing a real TS class, even though it's actually a runtime-resolved binding. */
export const KineticObject = kineticModule.component()
export type KineticObject = KineticObjectInstance
