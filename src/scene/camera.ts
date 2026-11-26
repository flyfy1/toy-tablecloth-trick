// The camera (tablecloth.md 3.1): on the table's centre line, 38 degrees down, aimed at (0, 0.42, 0),
// vertical field of view 34 degrees, distance solved so the near edge is W_t = min(0.80 w, 0.40 h, 460) css px wide.
// A lens shift puts the near edge at 0.50 h. World: metres, z up, y away from the viewer.

const EL = (38 * Math.PI) / 180
const FOV = (34 * Math.PI) / 180
const AIM = [0, 0.42, 0]

export interface Cam {
  w: number // css px
  h: number
  Wt: number
  U: number
  eye: [number, number, number]
  /** column-major view-projection (clip space) */
  vp: Float32Array
  /** world to css px (y down) and view depth */
  project(x: number, y: number, z: number, out?: number[]): number[]
  /** css px per metre at view depth d */
  scale(d: number): number
}

export function makeCam(w: number, h: number): Cam {
  const Wt = Math.min(0.8 * w, 0.4 * h, 460)
  const f = h / 2 / Math.tan(FOV / 2) // css px focal length
  const fwd = [0, Math.cos(EL), -Math.sin(EL)]
  const up = [0, Math.sin(EL), Math.cos(EL)]
  // the near edge corner (0.4, 0, 0): its view depth z and screen half-width f * 0.4 / z = Wt / 2
  // z(d) = (corner - eye) . fwd = d + (corner - aim) . fwd
  const cornerF = (0 - AIM[1]) * fwd[1] + (0 - AIM[2]) * fwd[2]
  const zNear = (0.4 * f) / (Wt / 2)
  const d = zNear - cornerF
  const eye: [number, number, number] = [AIM[0], AIM[1] - d * fwd[1], AIM[2] - d * fwd[2]]
  const right = [1, 0, 0]
  // lens shift: the near edge's centre lands at 0.50 h
  const rel = [0 - eye[0], 0 - eye[1], 0 - eye[2]]
  const zc = rel[1] * fwd[1] + rel[2] * fwd[2]
  const yc = rel[1] * up[1] + rel[2] * up[2]
  const shiftPx = (f * yc) / zc // near edge is this far above the centre (css px, y up)
  const sy = shiftPx // move it down to the middle (css px, y down)
  const near = 0.05
  const far = 20
  const A = (2 * f) / w
  const B = (2 * f) / h
  const cy = (2 * sy) / h // NDC shift
  // view matrix rows: right, up, -fwd ; clip = P * V
  const V = [
    [right[0], right[1], right[2], -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2])],
    [up[0], up[1], up[2], -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2])],
    [-fwd[0], -fwd[1], -fwd[2], fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2]],
    [0, 0, 0, 1],
  ]
  const P = [
    [A, 0, 0, 0],
    [0, B, cy, 0],
    [0, 0, -(far + near) / (far - near), (-2 * far * near) / (far - near)],
    [0, 0, -1, 0],
  ]
  // (P * V) with the lens shift: clip.y = B*vy + cy*vz_view, with vz_view = -depth, and clip.w = depth
  // so ndc.y = B*vy/depth - cy: on screen (y down) a constant shift of +sy css px
  const M = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => P[r].reduce((s, _v, k) => s + P[r][k] * V[k][c], 0)))
  const vp = new Float32Array(16)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) vp[c * 4 + r] = M[r][c]
  const project = (x: number, y: number, z: number, out: number[] = [0, 0, 0]) => {
    const rx = x - eye[0]
    const ry = y - eye[1]
    const rz = z - eye[2]
    const dz = ry * fwd[1] + rz * fwd[2]
    const vy = ry * up[1] + rz * up[2]
    out[0] = w / 2 + (f * rx) / dz
    out[1] = h / 2 - (f * vy) / dz + sy
    out[2] = dz
    return out
  }
  return { w, h, Wt, U: Wt / 10, eye, vp, project, scale: (dd) => f / dd }
}
