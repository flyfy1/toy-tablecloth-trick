// The cloth kit's per-frame mesh measures (README 3.4): vertex normals, thread tangents,
// crease and bunching. Pure TypeScript; the renderer uploads `attr` as one interleaved buffer.

/** floats per vertex in `attr`: position 3, normal 3, Tu 3, Tv 3, crease 1, bunching 1 */
export const STRIDE = 14

export class ClothMesh {
  readonly nu: number
  readonly nv: number
  readonly index: Uint16Array
  readonly uv: Float32Array
  attr: Float32Array
  private fn: Float32Array
  private restA: number

  constructor(nu: number, nv: number, spacing: number) {
    this.nu = nu
    this.nv = nv
    const n = nu * nv
    this.attr = new Float32Array(n * STRIDE)
    this.fn = new Float32Array(n * 3)
    this.restA = spacing * spacing
    const idx: number[] = []
    for (let j = 0; j < nv - 1; j++)
      for (let k = 0; k < nu - 1; k++) {
        const a = j * nu + k
        const b = a + 1
        const c = a + nu
        const d = c + 1
        // alternate the diagonal so folds have no grain
        if ((j + k) % 2) idx.push(a, c, b, b, c, d)
        else idx.push(a, c, d, a, d, b)
      }
    this.index = new Uint16Array(idx)
    this.uv = new Float32Array(n * 2)
    for (let j = 0; j < nv; j++)
      for (let k = 0; k < nu; k++) {
        const i = j * nu + k
        this.uv[i * 2] = k / (nu - 1)
        this.uv[i * 2 + 1] = j / (nv - 1)
      }
  }

  /** recompute everything from positions x; normals also written into nrmOut (the solver's air term) */
  update(x: Float32Array, nrmOut: Float32Array, spacing: number) {
    const { nu, nv, attr, fn, index } = this
    fn.fill(0)
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3
      const b = index[t + 1] * 3
      const c = index[t + 2] * 3
      const ux = x[b] - x[a]
      const uy = x[b + 1] - x[a + 1]
      const uz = x[b + 2] - x[a + 2]
      const vx = x[c] - x[a]
      const vy = x[c + 1] - x[a + 1]
      const vz = x[c + 2] - x[a + 2]
      // area-weighted face normal
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      for (const o of [a, b, c]) {
        fn[o] += nx
        fn[o + 1] += ny
        fn[o + 2] += nz
      }
    }
    const inv = 1 / spacing
    for (let j = 0; j < nv; j++)
      for (let k = 0; k < nu; k++) {
        const i = j * nu + k
        const a = i * 3
        const o = i * STRIDE
        let nx = fn[a]
        let ny = fn[a + 1]
        let nz = fn[a + 2]
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
        nx /= nl
        ny /= nl
        nz /= nl
        nrmOut[a] = nx
        nrmOut[a + 1] = ny
        nrmOut[a + 2] = nz
        // tangents by central differences
        const k0 = (j * nu + Math.max(k - 1, 0)) * 3
        const k1 = (j * nu + Math.min(k + 1, nu - 1)) * 3
        const j0 = (Math.max(j - 1, 0) * nu + k) * 3
        const j1 = (Math.min(j + 1, nv - 1) * nu + k) * 3
        let ux = x[k1] - x[k0]
        let uy = x[k1 + 1] - x[k0 + 1]
        let uz = x[k1 + 2] - x[k0 + 2]
        const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
        ux /= ul
        uy /= ul
        uz /= ul
        let vx = x[j1] - x[j0]
        let vy = x[j1 + 1] - x[j0 + 1]
        let vz = x[j1 + 2] - x[j0 + 2]
        const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1
        vx /= vl
        vy /= vl
        vz /= vl
        // crease: (mean of the 4 neighbours - x) . n / spacing, positive in a valley
        const mx = (x[k0] + x[k1] + x[j0] + x[j1]) / 4 - x[a]
        const my = (x[k0 + 1] + x[k1 + 1] + x[j0 + 1] + x[j1 + 1]) / 4 - x[a + 1]
        const mz = (x[k0 + 2] + x[k1 + 2] + x[j0 + 2] + x[j1 + 2]) / 4 - x[a + 2]
        const edge = k === 0 || k === nu - 1 || j === 0 || j === nv - 1
        const kc = edge ? 0 : Math.max(-1, Math.min(1, (mx * nx + my * ny + mz * nz) * inv * 4))
        // bunching: rest area over the area projected on the reference plane (the table top while on it,
        // the plane of the table's front for the hanging part)
        const su = ul / (k === 0 || k === nu - 1 ? 1 : 2)
        const sv = vl / (j === 0 || j === nv - 1 ? 1 : 2)
        const cu = ux * su
        const cuy = uy * su
        const cuz = uz * su
        const cv = vx * sv
        const cvy = vy * sv
        const cvz = vz * sv
        const onTop = x[a + 2] > -0.02
        const area = onTop ? Math.abs(cu * cvy - cuy * cv) : Math.abs(cu * cvz - cuz * cv)
        const b = Math.max(1, Math.min(4, this.restA / Math.max(area, 1e-6)))
        attr[o] = x[a]
        attr[o + 1] = x[a + 1]
        attr[o + 2] = x[a + 2]
        attr[o + 3] = nx
        attr[o + 4] = ny
        attr[o + 5] = nz
        attr[o + 6] = ux
        attr[o + 7] = uy
        attr[o + 8] = uz
        attr[o + 9] = vx
        attr[o + 10] = vy
        attr[o + 11] = vz
        attr[o + 12] = kc
        attr[o + 13] = b
      }
  }
}
