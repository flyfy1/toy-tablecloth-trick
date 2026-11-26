// The cloth kit's solver (README 3.1 to 3.3): XPBD on a quad grid with small steps.
// Pure TypeScript, no DOM or GL, so node can run it for the numeric checks.
// Grid index i = j * nu + k: k across (thread u, world x), j along the pull (thread v).

export interface ClothParams {
  nu: number
  nv: number
  spacing: number
  shear: number // softness ratio rho
  bend: number
  damp: number // c_damp, 1/s
  air: number // c_air, 1/s
  muS: number // on the table
  muK: number
  structIters: number // extra structural-only passes per substep (stretch control near the hand)
  /** rest length across (u) per row j as a multiple of the spacing: a slight flare toward a hem makes it hang in folds */
  flare?: (j: number) => number
}

/** Analytic collider: returns signed distance and writes the outward normal into n. */
export type Collider = (x: number, y: number, z: number, n: Float32Array, i: number) => number

const SKIN = 0.002

export class Cloth {
  readonly P: ClothParams
  readonly n: number
  x: Float32Array
  p: Float32Array
  w: Float32Array
  nrm: Float32Array // unit normals (from the mesh, once per frame) for the air term
  /** driven particles: weight 0 (free) .. 1 (follows target exactly) */
  dw: Float32Array
  dt: Float32Array // targets
  private ci: Int32Array
  private cr: Float32Array
  private ck: Float32Array // 1 / (1 + rho)
  private nStruct: number
  private flip = false
  private cn = new Float32Array(3)
  colliders: { f: Collider; muS: number; muK: number }[] = []
  /** cap: max displacement per substep (0.6 of the spacing) */
  private cap: number
  contact: Uint8Array // 1 = touched the table this substep

  constructor(P: ClothParams) {
    this.P = P
    const n = (this.n = P.nu * P.nv)
    this.x = new Float32Array(n * 3)
    this.p = new Float32Array(n * 3)
    this.w = new Float32Array(n).fill(1)
    this.nrm = new Float32Array(n * 3)
    this.dw = new Float32Array(n)
    this.dt = new Float32Array(n * 3)
    this.contact = new Uint8Array(n)
    this.cap = 0.6 * P.spacing
    const ci: number[] = []
    const cr: number[] = []
    const ck: number[] = []
    const { nu, nv, spacing: s } = P
    const id = (k: number, j: number) => j * nu + k
    const fu = P.flare ?? (() => 1)
    // structural, ordered from the near hem (j = nv-1, where the hand is) toward the back, so one sweep carries the pull
    for (let j = nv - 1; j >= 0; j--)
      for (let k = 0; k < nu; k++) {
        if (j > 0) ci.push(id(k, j), id(k, j - 1)), cr.push(s), ck.push(1)
        if (k < nu - 1) ci.push(id(k, j), id(k + 1, j)), cr.push(s * fu(j)), ck.push(1)
      }
    this.nStruct = cr.length
    const ks = 1 / (1 + P.shear)
    const kb = 1 / (1 + P.bend)
    for (let j = nv - 1; j > 0; j--)
      for (let k = 0; k < nu - 1; k++) {
        const dg = s * Math.hypot(1, (fu(j) + fu(j - 1)) / 2)
        ci.push(id(k, j), id(k + 1, j - 1)), cr.push(dg), ck.push(ks)
        ci.push(id(k + 1, j), id(k, j - 1)), cr.push(dg), ck.push(ks)
      }
    for (let j = nv - 1; j >= 0; j--)
      for (let k = 0; k < nu; k++) {
        if (j > 1) ci.push(id(k, j), id(k, j - 2)), cr.push(2 * s), ck.push(kb)
        if (k < nu - 2) ci.push(id(k, j), id(k + 2, j)), cr.push(2 * s * fu(j)), ck.push(kb)
      }
    this.ci = new Int32Array(ci)
    this.cr = new Float32Array(cr)
    this.ck = new Float32Array(ck)
  }

  /** place particle i, at rest */
  set(i: number, x: number, y: number, z: number) {
    const a = i * 3
    this.x[a] = this.p[a] = x
    this.x[a + 1] = this.p[a + 1] = y
    this.x[a + 2] = this.p[a + 2] = z
  }

  /** one substep of length h; f in [0,1] is how far through the frame (for target interpolation done by the caller) */
  tetherCol = -1 // a driven hem column: the stretch limit runs from it (set by the hand, -1 = none)
  tetherLim = 1.1
  tetherIters = 4

  substep(h: number, gz = -9.81) {
    const { x, p, w, nrm, dw, dt } = this
    const n = this.n
    const damp = 1 - this.P.damp * h
    const air = this.P.air * h
    const cap = this.cap
    // 1. integrate
    for (let i = 0; i < n; i++) {
      const a = i * 3
      let vx = (x[a] - p[a]) / h
      let vy = (x[a + 1] - p[a + 1]) / h
      let vz = (x[a + 2] - p[a + 2]) / h + gz * h
      const vn = vx * nrm[a] + vy * nrm[a + 1] + vz * nrm[a + 2]
      vx = (vx - air * vn * nrm[a]) * damp
      vy = (vy - air * vn * nrm[a + 1]) * damp
      vz = (vz - air * vn * nrm[a + 2]) * damp
      let dx = vx * h
      let dy = vy * h
      let dz = vz * h
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 > cap * cap) {
        const s = cap / Math.sqrt(d2)
        dx *= s
        dy *= s
        dz *= s
      }
      p[a] = x[a]
      p[a + 1] = x[a + 1]
      p[a + 2] = x[a + 2]
      if (dw[i] >= 1) {
        x[a] = dt[a]
        x[a + 1] = dt[a + 1]
        x[a + 2] = dt[a + 2]
        w[i] = 0
      } else {
        x[a] += dx
        x[a + 1] += dy
        x[a + 2] += dz
        w[i] = 1
      }
    }
    // 2. constraints, alternating direction
    this.flip = !this.flip
    this.solve(0, this.cr.length, this.flip)
    for (let it = 0; it < this.P.structIters; it++) this.solve(0, this.nStruct, it % 2 === 0)
    // partially driven particles at the edge of the grab patch
    for (let i = 0; i < n; i++) {
      const f = dw[i]
      if (f > 0 && f < 1) {
        const a = i * 3
        x[a] += (dt[a] - x[a]) * f
        x[a + 1] += (dt[a + 1] - x[a + 1]) * f
        x[a + 2] += (dt[a + 2] - x[a + 2]) * f
      }
    }
    if (this.tetherCol >= 0) {
      // under a hard pull: limit the stretch from the hand, push out of the table, then let a structural pass
      // share the stretch of the link that straddles the table edge between both its ends, and push out again
      for (let it = 0; it < this.tetherIters; it++) {
        this.tether(this.tetherCol, this.tetherLim)
        this.collide()
      }
    }
    this.collide()
  }

  /** Stretch limit swept outward from a driven hem column kc (a follow-the-leader pass): along the hem row,
   *  then up every column, each particle is pulled to within `lim` of its rest length from its leader.
   *  It carries a hard pull through the whole cloth in one sweep, where one Gauss-Seidel pass halves it per link. */
  tether(kc: number, lim: number) {
    const { nu, nv, spacing } = this.P
    const { x, w } = this
    const L = spacing * lim
    const pull = (i: number, l: number, L: number) => {
      if (w[i] === 0) return
      const a = i * 3
      const b = l * 3
      const dx = x[a] - x[b]
      const dy = x[a + 1] - x[b + 1]
      const dz = x[a + 2] - x[b + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d <= L) return
      const s = L / d
      x[a] = x[b] + dx * s
      x[a + 1] = x[b + 1] + dy * s
      x[a + 2] = x[b + 2] + dz * s
    }
    const r = (nv - 1) * nu
    const Lh = L * (this.P.flare?.(nv - 1) ?? 1)
    for (let k = kc + 1; k < nu; k++) pull(r + k, r + k - 1, Lh)
    for (let k = kc - 1; k >= 0; k--) pull(r + k, r + k + 1, Lh)
    for (let k = 0; k < nu; k++) for (let j = nv - 2; j >= 0; j--) pull(j * nu + k, (j + 1) * nu + k, L)
  }

  private solve(from: number, to: number, fwd: boolean) {
    const { x, w, ci, cr, ck } = this
    const m = to - from
    for (let q = 0; q < m; q++) {
      const c = fwd ? from + q : to - 1 - q
      const i = ci[c * 2]
      const j = ci[c * 2 + 1]
      const wi = w[i]
      const wj = w[j]
      const ws = wi + wj
      if (ws === 0) continue
      const a = i * 3
      const b = j * 3
      const dx = x[a] - x[b]
      const dy = x[a + 1] - x[b + 1]
      const dz = x[a + 2] - x[b + 2]
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len < 1e-9) continue
      const C = len - cr[c]
      const s = (-C * ck[c]) / (ws * len)
      x[a] += dx * s * wi
      x[a + 1] += dy * s * wi
      x[a + 2] += dz * s * wi
      x[b] -= dx * s * wj
      x[b + 1] -= dy * s * wj
      x[b + 2] -= dz * s * wj
    }
  }

  private collide() {
    const { x, p, w, cn } = this
    const n = this.n
    const cols = this.colliders
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue
      const a = i * 3
      this.contact[i] = 0
      for (let c = 0; c < cols.length; c++) {
        const sd = cols[c].f(x[a], x[a + 1], x[a + 2], cn, i)
        if (sd >= SKIN) continue
        const d = SKIN - sd
        x[a] += cn[0] * d
        x[a + 1] += cn[1] * d
        x[a + 2] += cn[2] * d
        // friction on the tangential part of this substep's displacement
        let tx = x[a] - p[a]
        let ty = x[a + 1] - p[a + 1]
        let tz = x[a + 2] - p[a + 2]
        const dn = tx * cn[0] + ty * cn[1] + tz * cn[2]
        tx -= dn * cn[0]
        ty -= dn * cn[1]
        tz -= dn * cn[2]
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz)
        const { muS, muK } = cols[c]
        // friction depth capped at 1 mm: a deep push-out comes from a constraint dragging the particle
        // round the table edge, not from weight, and must not lock it there
        const df = Math.min(d, 0.001)
        let f = 0
        if (tl < muS * df) f = 1
        else if (tl > 0) f = Math.min(1, (muK * df) / tl)
        x[a] -= tx * f
        x[a + 1] -= ty * f
        x[a + 2] -= tz * f
        // inelastic contact: the push-out must not turn into an outward velocity (it would pop the cloth up)
        if (dn > 0) {
          p[a] += cn[0] * dn
          p[a + 1] += cn[1] * dn
          p[a + 2] += cn[2] * dn
        }
        if (c === 0) this.contact[i] = 1
      }
    }
  }

  /** velocity of particle i over the last substep */
  vel(i: number, h: number, out: Float32Array) {
    const a = i * 3
    out[0] = (this.x[a] - this.p[a]) / h
    out[1] = (this.x[a + 1] - this.p[a + 1]) / h
    out[2] = (this.x[a + 2] - this.p[a + 2]) / h
  }

  /** worst structural stretch (len / rest) */
  maxStretch(): number {
    const { x, ci, cr } = this
    let m = 0
    for (let c = 0; c < this.nStruct; c++) {
      const a = ci[c * 2] * 3
      const b = ci[c * 2 + 1] * 3
      const l = Math.hypot(x[a] - x[b], x[a + 1] - x[b + 1], x[a + 2] - x[b + 2]) / cr[c]
      if (l > m) m = l
    }
    return m
  }
}

/** Signed distance to an axis-aligned rounded box (centre c, half extents e, corner radius r); normal into n. */
export function roundedBox(cx: number, cy: number, cz: number, ex: number, ey: number, ez: number, r: number): Collider {
  const bx = ex - r
  const by = ey - r
  const bz = ez - r
  return (x, y, z, n) => {
    const px = x - cx
    const py = y - cy
    const pz = z - cz
    const qx = Math.abs(px) - bx
    const qy = Math.abs(py) - by
    const qz = Math.abs(pz) - bz
    const ox = Math.max(qx, 0)
    const oy = Math.max(qy, 0)
    const oz = Math.max(qz, 0)
    const ol = Math.sqrt(ox * ox + oy * oy + oz * oz)
    if (ol > 0) {
      n[0] = (ox / ol) * Math.sign(px)
      n[1] = (oy / ol) * Math.sign(py)
      n[2] = (oz / ol) * Math.sign(pz)
      return ol - r
    }
    // inside the core: push out along the nearest face
    if (qx >= qy && qx >= qz) {
      n[0] = Math.sign(px) || 1
      n[1] = n[2] = 0
      return qx - r
    }
    if (qy >= qz) {
      n[1] = Math.sign(py) || 1
      n[0] = n[2] = 0
      return qy - r
    }
    n[2] = Math.sign(pz) || 1
    n[0] = n[1] = 0
    return qz - r
  }
}

/** A horizontal plane z = h, normal up; `lift(i)` raises it per particle (layers of a heap without self-collision). */
export function floorPlane(h: number, lift: (i: number) => number = () => 0): Collider {
  return (_x, _y, z, n, i) => {
    n[0] = n[1] = 0
    n[2] = 1
    return z - h - lift(i)
  }
}
