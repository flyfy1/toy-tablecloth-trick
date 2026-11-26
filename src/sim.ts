// The world of the tablecloth trick: the table, the cloth, the hand and the props, stepped together.
// Pure TypeScript (no DOM or GL) so node can run the numeric checks on the same code the game runs.
import { Cloth, floorPlane, roundedBox } from './cloth/solver.ts'
import { ClothMesh } from './cloth/mesh.ts'
import { Prop, type ClothProbe, type PropId } from './model/props.ts'

// ---------- the table (metres; z = 0 is the top, y = 0 the near edge) ----------
export const TABLE = { x0: -0.4, x1: 0.4, y0: 0, y1: 1.1, apron: 0.075, r: 0.012 }
export const FLOOR = -0.75
export const NU = 28
export const NV = 47
export const SP = 0.034 // 27 x 0.034 = 0.92 m across, 46 x 0.034 = 1.56 m along
export const BACK = 1.13 // the back hem when laid, 0.03 m over the far edge
const PULL_TILT = (20 * Math.PI) / 180
const HAND_FLOOR = FLOOR + 0.05 // the hand slides toward the viewer once it is this low
export const HAND_CAP = 9
/** The hanging part of the cloth flares by up to 14 % toward the near hem (as a laid cloth is never quite square):
 *  without it a drape off a straight edge hangs dead flat and the satin has no folds to catch the light. */
const FLARE = (j: number) => {
  const t = Math.min(1, Math.max(0, (j - 33) / 13))
  return 1 + 0.14 * t * t * (3 - 2 * t)
}
// Cloth on table friction. The spec's 0.16 / 0.12 cannot hold a 0.42 m drape at rest (hang / on-table = 0.38
// needs mu over 0.3 even with the edge's capstan), nor stop a slow drag where the hand stops. So the cloth grips
// (0.7 / 0.5) at rest and under a slow hand, and slides on the spec's silk values once the hand moves faster than
// about 1.8 m/s (blended from 0.6). Props never read this: their model is separate.
const SILK_MU_S = 0.16
const SILK_MU_K = 0.12
const REST_MU_S = 0.7
const REST_MU_K = 0.5
/** below this hand speed (m/s) nobody is flicking: the props ride the cloth */
export const RIDE_V = 1.2

export type Layout = { id: PropId; x: number; y: number }[]

/** the six tables (tablecloth.md 5.7); a few props moved a little so the larger pictures (VIS) do not overlap */
export const LAYOUTS: Layout[] = [
  [{ id: 'cup', x: 0, y: 0.75 }],
  [
    { id: 'bowls', x: -0.12, y: 0.78 },
    { id: 'cup', x: 0.18, y: 0.88 },
    { id: 'fish', x: 0.04, y: 0.62 },
  ],
  [
    { id: 'thermos', x: -0.18, y: 0.9 },
    { id: 'bowls', x: 0.14, y: 0.7 },
    { id: 'cup', x: -0.05, y: 0.55 },
  ],
  [
    { id: 'vase', x: 0.22, y: 0.88 },
    { id: 'fish', x: -0.1, y: 0.6 },
    { id: 'bowls', x: 0.2, y: 0.72 },
    { id: 'cup', x: -0.22, y: 0.4 },
  ],
  [
    { id: 'heirloom', x: 0, y: 0.9 },
    { id: 'thermos', x: -0.24, y: 0.92 },
    { id: 'bowls', x: 0.2, y: 0.66 },
    { id: 'cup', x: 0, y: 0.42 },
  ],
  [
    { id: 'heirloom', x: 0.02, y: 0.8 },
    { id: 'thermos', x: -0.26, y: 0.94 },
    { id: 'vase', x: 0.27, y: 0.93 },
    { id: 'fish', x: -0.03, y: 0.5 },
    { id: 'bowls', x: -0.25, y: 0.68 },
    { id: 'cup', x: 0.24, y: 0.38 },
  ],
]

/** how hard each table grips its props (multiplies every prop's μ_s and μ_k): the difficulty curve of tablecloth.md 5.8,
 *  each table needing a faster, cleaner flick than the last. Tuned with work/thresholds.mjs; env GRIP overrides for tuning. */
export const GRIP: number[] = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.GRIP?.split(',').map(Number) ?? [1, 1.6, 1.6, 1.75, 2, 2.55]
/** the heirloom's grip is capped lower: it is the tall, narrow one, and toppling it should only need a firm pull, not a fast one
 *  (table 6: below about 3.4 m/s it goes; the other props set how fast a perfect pull must be) */
export const HEIR_GRIP = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.HG ?? 1.5)

/** the phase 1 gate's wobble table: the three phase 1 props, the vase at the back with nothing in front of it */
export const WOBBLE_LAYOUT: { id: PropId; x: number; y: number }[] = [
  { id: 'vase', x: 0.02, y: 0.86 },
  { id: 'bowls', x: -0.2, y: 0.7 },
  { id: 'cup', x: 0.22, y: 0.66 },
]

/** seeded random (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type HandMode = 'none' | 'held' | 'follow'

export class World {
  cloth: Cloth
  mesh: ClothMesh
  props: Prop[] = []
  S = 10
  private flickT = -1
  time = 0
  rnd: () => number
  // the hand
  hand: HandMode = 'none'
  g0 = [0, 0, 0] // grab point at pointerdown
  pull = 0 // metres along the pull path
  side = 0 // metres along x
  handV = 0 // m/s along the path (follow-through)
  followT = 0
  pinchT = 0
  private patch: { i: number; ox: number; oy: number; oz: number; f: number }[] = []
  private prevPull = 0
  private prevSide = 0
  handHist: { t: number; p: number }[] = []
  peakHandV = 0
  followed = false
  grabTime = -1
  clothOffTime = -1
  asleep = false
  private calm = 0
  private probe: ClothProbe
  private tmp = new Float64Array(2)
  private h = 1 / 600

  constructor(seed = 7) {
    this.rnd = rng(seed)
    this.cloth = new Cloth({ nu: NU, nv: NV, spacing: SP, shear: 0.15, bend: 6, damp: 0.4, air: 6, muS: 0.16, muK: 0.12, structIters: 2, flare: FLARE })
    this.cloth.colliders.push(
      { f: roundedBox(0, (TABLE.y0 + TABLE.y1) / 2, -TABLE.apron / 2, 0.4, 0.55, TABLE.apron / 2, TABLE.r), muS: REST_MU_S, muK: REST_MU_K },
      // on the floor the back of the cloth lands last, on top: rows sit up to 12 mm apart so the heap's layers never z-fight
      { f: floorPlane(FLOOR, (i) => 0.012 * (1 - Math.floor(i / NU) / (NV - 1))), muS: 0.5, muK: 0.4 },
    )
    this.mesh = new ClothMesh(NU, NV, SP)
    const c = this.cloth
    const x = c.x
    this.probe = {
      sample: (px, py, r, out) => {
        const rr = (r + SP * 0.5) ** 2
        let n = 0
        let sx = 0
        let sy = 0
        const h = this.h
        for (let i = 0; i < c.n; i++) {
          const a = i * 3
          const z = x[a + 2]
          if (z < -0.003 || z > 0.012) continue
          const dx = x[a] - px
          const dy = x[a + 1] - py
          if (dx * dx + dy * dy > rr) continue
          sx += (x[a] - c.p[a]) / h
          sy += (x[a + 1] - c.p[a + 1]) / h
          n++
        }
        if (!n) return false
        out[0] = sx / n
        out[1] = sy / n
        return true
      },
    }
  }

  /** lay a flat cloth in the air: tablecloth.md 3.6 step 2 (0.10 m up, 0.08 m back, moving forward at 0.6 m/s) */
  layFlat(lift = 0.1, back = 0.08, vy = -0.6) {
    const c = this.cloth
    const h = this.h
    for (let j = 0; j < NV; j++)
      for (let k = 0; k < NU; k++) {
        const i = j * NU + k
        const x = (k - (NU - 1) / 2) * SP
        const y = BACK + back - j * SP
        c.set(i, x, y, lift)
        c.p[i * 3 + 1] = y - vy * h
      }
    c.dw.fill(0)
    this.hand = 'none'
    this.asleep = false
    this.calm = 0
    this.clothOffTime = -1
    this.grabTime = -1
    this.updateMesh()
  }

  setProps(list: { id: PropId; x: number; y: number }[]) {
    this.props = list.map((p) => new Prop(p.id, p.x, p.y, this.rnd))
  }

  updateMesh() {
    this.mesh.update(this.cloth.x, this.cloth.nrm, SP)
  }

  /** where the hand target is for a pull p and side offset s */
  handTarget(p: number, s: number, out: number[]) {
    const dy = -Math.sin(PULL_TILT)
    const dz = -Math.cos(PULL_TILT)
    let x = this.g0[0] + s
    let y = this.g0[1] + p * dy
    let z = this.g0[2] + p * dz
    if (z < HAND_FLOOR) {
      const p1 = (HAND_FLOOR - this.g0[2]) / dz
      y = this.g0[1] + p1 * dy - (p - p1)
      z = HAND_FLOOR
    }
    out[0] = x
    out[1] = y
    out[2] = z
  }

  /** the drape's hem point nearest to (x, z) on the plane of the front; returns its index */
  nearestHem(wx: number): number {
    const x = this.cloth.x
    let best = 0
    let bd = 1e9
    for (let k = 0; k < NU; k++) {
      const i = (NV - 1) * NU + k
      const d = Math.abs(x[i * 3] - wx)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }

  grab(i: number) {
    const c = this.cloth
    const x = c.x
    this.g0 = [x[i * 3], x[i * 3 + 1], x[i * 3 + 2]]
    this.pull = this.prevPull = 0
    this.side = this.prevSide = 0
    this.handV = 0
    this.pinchT = 0
    this.hand = 'held'
    this.asleep = false
    this.calm = 0
    this.handHist = [{ t: this.time, p: 0 }]
    if (this.grabTime < 0) this.grabTime = this.time
    this.patch = []
    c.dw.fill(0)
    for (let j = NV - 1; j >= NV - 1; j--)
      for (let k = 0; k < NU; k++) {
        const q = j * NU + k
        const dx = x[q * 3] - this.g0[0]
        const dy = x[q * 3 + 1] - this.g0[1]
        const dz = x[q * 3 + 2] - this.g0[2]
        const r = Math.hypot(dx, dy, dz)
        if (r > 0.07) continue
        // the centre follows exactly; the patch edge follows at 40 %
        const f = j === NV - 1 && r < 0.02 ? 1 : 0.4 + 0.5 * (1 - r / 0.07)
        this.patch.push({ i: q, ox: dx, oy: dy, oz: dz, f })
      }
    c.tetherCol = i % NU
  }

  /** the finger moved: new pull and side offset (metres); a pull cannot push the cloth back up */
  moveHand(p: number, s: number) {
    this.pull = Math.max(-0.05, p)
    this.side = s
  }

  /** release with the mean hand speed over the last 60 ms; follow-through from 1.0 m/s */
  release() {
    if (this.hand !== 'held') return
    const v = this.releaseSpeed()
    this.cloth.dw.fill(0)
    if (v >= 1) {
      this.hand = 'follow'
      this.followed = true
      this.handV = Math.min(v, HAND_CAP)
      this.followT = 0
    } else this.hand = 'none'
  }

  releaseSpeed() {
    const hs = this.handHist
    if (hs.length < 2) return 0
    const last = hs[hs.length - 1]
    let first = hs[0]
    for (const e of hs) if (last.t - e.t <= 0.06) {
      first = e
      break
    }
    return last.t > first.t ? (last.p - first.p) / (last.t - first.t) : 0
  }

  /** back hem: how far it is past the near edge, along the cloth path (m) */
  backHemPast(): number {
    const x = this.cloth.x
    let m = 1e9
    for (let k = 0; k < NU; k++) {
      const a = k * 3
      const past = Math.max(0, -x[a + 1]) + Math.max(0, -x[a + 2]) - Math.max(0, x[a + 1])
      if (past < m) m = past
    }
    return m
  }

  /** is any of the cloth still lying on the table top */
  clothOnTable(): boolean {
    const x = this.cloth.x
    for (let i = 0; i < this.cloth.n; i++) {
      const a = i * 3
      if (x[a + 2] > -0.005 && x[a + 1] > 0.005 && x[a + 1] < 1.1 && Math.abs(x[a]) < 0.4) return true
    }
    return false
  }

  /** advance by dt (seconds), S substeps */
  step(dt: number) {
    if (!(dt > 0)) return // a zero or negative frame (rAF time before the last stamp) would divide by zero
    dt = Math.min(dt, 1 / 30)
    const S = this.S
    const h = (this.h = dt / S)
    if (this.hand === 'follow') {
      // v(t) = v_r * exp(-t / 0.5) until 1.2 s, or the back hem is 0.3 m past the edge
      this.followT += dt
      this.handV *= Math.exp(-dt / 0.5)
      this.pull += this.handV * dt
      if (this.followT > 1.2 || this.backHemPast() > 0.3) this.hand = 'none'
    }
    const driven = this.hand !== 'none'
    if (this.hand === 'held') {
      this.pull = Math.min(this.pull, this.prevPull + HAND_CAP * dt) // the hand's speed is capped at 9 m/s
      this.handHist.push({ t: this.time + dt, p: this.pull })
      while (this.handHist.length > 2 && this.time + dt - this.handHist[0].t > 0.12) this.handHist.shift()
      const v = (this.pull - this.prevPull) / dt
      if (v > this.peakHandV) this.peakHandV = v
    }
    if (driven) {
      this.pinchT += dt
      this.asleep = false
    }
    if (this.asleep) {
      this.time += dt
      return
    }
    const c = this.cloth
    const tc = c.colliders[0]
    // the spec's silk friction for a real pull; a slow drag or no hand grips (see the constants)
    const hv = this.hand === 'follow' ? this.handV : this.hand === 'held' ? Math.abs(this.pull - this.prevPull) / dt : 0
    const f = Math.min(1, Math.max(0, (hv - 0.6) / 1.2))
    tc.muS = REST_MU_S + (SILK_MU_S - REST_MU_S) * f
    tc.muK = REST_MU_K + (SILK_MU_K - REST_MU_K) * f
    // no flick (a slow drag, or the cloth sliding off under its own weight): the props ride it like a conveyor
    // (tablecloth.md 5.3: a gentle pull carries everything). The cloth itself surges a little as it goes (its
    // stretch against the table's grip); the props must not each slip on those by their own friction.
    if (hv >= RIDE_V) this.flickT = this.time
    const ride = this.time - this.flickT > 0.3
    const t = [0, 0, 0]
    const pinch = 1 - 0.65 * Math.min(1, this.pinchT / 0.04)
    for (let s = 0; s < S; s++) {
      if (driven) {
        const f = (s + 1) / S
        const p = this.prevPull + (this.pull - this.prevPull) * f
        const sd = this.prevSide + (this.side - this.prevSide) * f
        this.handTarget(p, sd, t)
        for (const q of this.patch) {
          const a = q.i * 3
          c.dt[a] = t[0] + q.ox * pinch
          c.dt[a + 1] = t[1] + q.oy
          c.dt[a + 2] = t[2] + q.oz * (0.5 + 0.5 * pinch)
          c.dw[q.i] = q.f
        }
      }
      c.substep(h)
      for (const p of this.props) {
        p.ride = ride
        p.step(h, this.probe, this.tmp)
      }
    }
    this.prevPull = this.pull
    this.prevSide = this.side
    if (!driven) {
      c.dw.fill(0)
      c.tetherCol = -1
    }
    this.time += dt
    this.updateMesh()
    if (this.grabTime >= 0 && this.clothOffTime < 0 && !this.clothOnTable()) this.clothOffTime = this.time
    // sleep
    if (!driven) {
      let sum = 0
      const x = c.x
      for (let i = 0; i < c.n * 3; i += 3) sum += Math.hypot(x[i] - c.p[i], x[i + 1] - c.p[i + 1], x[i + 2] - c.p[i + 2])
      const mean = sum / c.n / h
      const busy = this.props.some((p) => !p.resting && !p.off)
      if (mean < 0.002 && !busy) {
        this.calm += dt
        if (this.calm > 0.5) this.asleep = true
      } else this.calm = 0
    }
  }

  /** a scripted steady pull: hand speed ramps to v over `ramp`, `travel` metres of finger, then release */
  scriptPull(v: number, ramp: number, travel = 1.0) {
    let t = 0
    return (dt: number) => {
      if (this.hand !== 'held') return
      t += dt
      const vv = Math.min(v, (v * t) / ramp)
      this.moveHand(this.pull + vv * dt, this.side)
      if (this.pull >= travel) {
        // the step pushes the history first; release after this frame's step
        return 'release'
      }
    }
  }
}
