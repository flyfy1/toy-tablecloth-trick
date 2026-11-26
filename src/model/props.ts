// The props' friction and rocking model (tablecloth.md 5.3 and 5.4), a port of sim/table_model.py.
// One-way coupling: it reads the cloth's velocity under each prop and never pushes back.
// Pure TypeScript, no DOM, so node can run the unit test.

export const G = 9.81
export const MU_TABLE = 0.45

export type PropId = 'cup' | 'bowls' | 'fish' | 'vase' | 'thermos' | 'heirloom' | 'cat'

export interface PropConst {
  rb: number // base radius
  hc: number // centre of mass height
  muS: number
  muK: number
  w: number // painted width (m)
  h: number // painted height (m)
}

export const PROPS: Record<PropId, PropConst> = {
  cup: { rb: 0.055, hc: 0.03, muS: 0.18, muK: 0.1, w: 0.11, h: 0.07 },
  bowls: { rb: 0.03, hc: 0.06, muS: 0.26, muK: 0.16, w: 0.13, h: 0.12 },
  fish: { rb: 0.09, hc: 0.02, muS: 0.2, muK: 0.12, w: 0.26, h: 0.06 },
  vase: { rb: 0.035, hc: 0.14, muS: 0.4, muK: 0.3, w: 0.09, h: 0.3 },
  thermos: { rb: 0.05, hc: 0.17, muS: 0.4, muK: 0.31, w: 0.12, h: 0.36 },
  heirloom: { rb: 0.03, hc: 0.14, muS: 0.42, muK: 0.32, w: 0.1, h: 0.32 },
  cat: { rb: 0.15, hc: 0.08, muS: 0.6, muK: 0.5, w: 0.34, h: 0.2 },
}

/** the largest tilt the hem kick alone may give (rad) */
const DEG = Math.PI / 180
export const KICK_CAP: Record<PropId, number> = { cup: 10 * DEG, bowls: 8 * DEG, fish: 6 * DEG, vase: 10 * DEG, thermos: 10 * DEG, heirloom: 10 * DEG, cat: 0 }

/** The cloth as the prop model sees it, sampled under a prop's base circle. */
export interface ClothProbe {
  /** writes the mean cloth velocity (table plane) under the circle into out; returns false if no cloth is there */
  sample(x: number, y: number, r: number, out: Float64Array): boolean
}

export class Prop {
  id: PropId
  c: PropConst
  x: number
  y: number
  x0: number
  y0: number
  vx = 0
  vy = 0
  th = 0 // tilt
  om = 0
  thc: number
  R2: number
  phi: number // precession angle of the tilt direction (pi/2 = away from the viewer)
  phiDir: number
  stuck = true
  on = true // cloth under it
  toppled = false
  off = false // base centre past an edge
  peak = 0
  slid = 0
  rideTravel = 0
  /** filtered cloth velocity and its previous value */
  private cvx = 0
  private cvy = 0
  private pvx = 0
  private pvy = 0
  private primed = false
  hemKick = true
  /** set by the world: no flick is under way, the prop rides the cloth (stays stuck, follows it smoothly) */
  ride = false
  touches = 0 // rock touch-downs (the rattle)
  onTouch: ((p: Prop, g: number) => void) | null = null

  constructor(id: PropId, x: number, y: number, rnd: () => number) {
    this.id = id
    this.c = PROPS[id]
    this.x = this.x0 = x
    this.y = this.y0 = y
    this.thc = Math.atan2(this.c.rb, this.c.hc)
    this.R2 = this.c.hc * this.c.hc + this.c.rb * this.c.rb
    this.phi = Math.PI / 2
    this.phiDir = rnd() < 0.5 ? -1 : 1
  }

  get moved() {
    return Math.hypot(this.x - this.x0, this.y - this.y0)
  }

  get resting() {
    return this.off || (Math.hypot(this.vx, this.vy) < 0.003 && (this.toppled || (this.th === 0 && this.om === 0)))
  }

  /** the hem kick (tablecloth.md 5.4) for a cloth speed v; also the cat's landing thump (v = 0).
   *  Capped (lead, phase 2): the kick alone never rocks a plate past about 6 degrees or a cup past about 10. */
  kick(v: number) {
    if (this.toppled || this.off || !KICK_CAP[this.id]) return
    const { rb, hc } = this.c
    const j = Math.max(0.15, Math.min(0.7, 0.9 - 0.14 * v))
    const k = j * this.thc * Math.sqrt((0.75 * G * rb) / this.R2)
    const dh = (t: number) => rb * Math.sin(t) + hc * Math.cos(t) - hc
    const cap = Math.min(KICK_CAP[this.id], this.thc * 0.9)
    const omMax = Math.sqrt(Math.max(0, (2 * 0.75 * G * (dh(cap) - dh(this.th))) / this.R2))
    if (this.om < omMax) this.om = Math.min(this.om + k, omMax)
  }

  /** one substep; cloth gives the velocity under the base */
  step(h: number, cloth: ClothProbe, tmp: Float64Array) {
    if (this.off) return
    // the cat (tablecloth.md 5.6): under a flick the cloth leaves from under it and it does not move at all;
    // it only rides a slow pull (and the game has it step off before an edge)
    if (this.id === 'cat' && !this.ride) {
      this.vx = this.vy = 0
      this.stuck = false
      if (this.on) this.on = cloth.sample(this.x, this.y, this.c.rb, tmp)
      return
    }
    const { rb, hc, muS, muK } = this.c
    const R2 = this.R2
    const wasOn = this.on
    const has = this.on && cloth.sample(this.x, this.y, rb, tmp)
    let aEff = 0
    if (has) {
      // low-pass the sampled velocity (about 15 ms): PBD velocities are noisy per substep
      const k = this.primed ? Math.min(1, h / 0.015) : 1
      this.primed = true
      this.cvx += (tmp[0] - this.cvx) * k
      this.cvy += (tmp[1] - this.cvy) * k
      const ax = (this.cvx - this.pvx) / h
      const ay = (this.cvy - this.pvy) / h
      this.pvx = this.cvx
      this.pvy = this.cvy
      const ac = Math.hypot(ax, ay)
      const clothV = Math.hypot(this.cvx, this.cvy)
      if (this.ride && (this.stuck || Math.hypot(this.cvx - this.vx, this.cvy - this.vy) < 0.3)) {
        // riding: the cloth's surges are smoothed (about 60 ms) and taken whole, so everything on the cloth
        // moves together with it; rocking sees at most the grip's limit
        const k2 = Math.min(1, h / 0.06)
        this.stuck = true
        this.vx += (this.cvx - this.vx) * k2
        this.vy += (this.cvy - this.vy) * k2
        aEff = Math.min(ac, muS * G) * ((ax * this.cvx + ay * this.cvy) > 0 ? 1 : 0)
      } else if (this.stuck && ac <= muS * G) {
        this.vx = this.cvx
        this.vy = this.cvy
        // rocking torque while stuck: the base accelerates with the cloth (the script's max(a_c, 0))
        aEff = (ax * this.cvx + ay * this.cvy) / Math.max(clothV, 1e-6) > 0 ? ac : 0
      } else {
        this.stuck = false
        const rx = this.cvx - this.vx
        const ry = this.cvy - this.vy
        const rl = Math.hypot(rx, ry)
        if (rl < 0.02 && ac <= muS * G) {
          this.stuck = true
          this.vx = this.cvx
          this.vy = this.cvy
        } else if (rl > 0) {
          const dv = Math.min(rl, muK * G * h)
          this.vx += (rx / rl) * dv
          this.vy += (ry / rl) * dv
          aEff = muK * G
        }
      }
    } else {
      this.on = false
      const s = Math.hypot(this.vx, this.vy)
      if (s > 0) {
        const ns = Math.max(0, s - MU_TABLE * G * h)
        this.vx *= ns / s
        this.vy *= ns / s
      }
    }
    // the hem kick: a visible, safe rock as the back hem passes under
    if (wasOn && !this.on && this.hemKick && this.primed) this.kick(Math.hypot(this.pvx, this.pvy))
    // rocking
    if (!this.toppled) {
      const c = Math.cos(this.th)
      const s = Math.sin(this.th)
      let al: number
      if (this.on) {
        al = (0.75 * (aEff * (hc * c + rb * s) - G * (rb * c - hc * s))) / R2
        if (this.th <= 0 && al < 0) {
          al = 0
          this.om = Math.max(this.om, 0)
        }
      } else {
        al = (-0.75 * G * (rb * c - hc * s)) / R2
        // standing flat with no swing left: gravity holds it down (it must not bounce on its own weight)
        if (this.th <= 0 && this.om <= 0) {
          al = 0
          this.om = 0
        }
      }
      this.om += al * h
      this.th += this.om * h
      if (this.th < 0) {
        this.th = 0
        // a touch-down slower than one substep of gravity is the end of the rock (no bouncing on the spot)
        if (this.om < -Math.max(0.05, 1.5 * Math.abs(al) * h)) {
          this.touches++
          this.onTouch?.(this, -this.om)
          this.om = -0.75 * this.om
        } else this.om = 0
      }
      if (this.th > this.peak) this.peak = this.th
      if (this.th > this.thc) this.toppled = true
      if (this.th > 0) this.phi += 2.2 * this.phiDir * h
    }
    const dx = this.vx * h
    const dy = this.vy * h
    this.x += dx
    this.y += dy
    this.rideTravel += Math.hypot(dx, dy)
    if (this.x < -0.4 || this.x > 0.4 || this.y < 0 || this.y > 1.1) this.off = true
  }
}
