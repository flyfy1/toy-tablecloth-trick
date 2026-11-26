// The tablecloth's pattern texture (tablecloth.md 3.4), baked once with Canvas 2D: a jade satin with a woven
// damask of cloud scrolls on a 0.11 m repeat, a pale gold fret border 0.03 m in from every hem, a rolled hem.
// Painted in cloth metres (non-uniform scale into 512 x 1024) so the motifs come out round on the cloth.

export const CLOTH_W = 0.918
export const CLOTH_L = 1.564

export interface Weave {
  base: string
  damask: string
  gold: string
  hem: string
}
export const JADE: Weave = { base: '#1F7A6D', damask: '#2A8E80', gold: '#D8B866', hem: '#145a50' }
export const RED: Weave = { base: '#B3261E', damask: '#C93A2E', gold: '#D8B866', hem: '#7e1712' }

/** one 祥云 cloud, centred on 0,0, about 0.08 m wide: a bumpy silhouette of overlapping puffs with a spiral
 *  curled into each, and a sweeping tail. Drawn in the damask colour; `fill` and `line` are the two alphas. */
const PUFFS: [number, number, number, number][] = [
  // x, y, radius, spiral direction
  [-0.014, 0.0, 0.016, 1],
  [0.012, 0.004, 0.012, -1],
  [0.004, -0.014, 0.01, 1],
  [0.028, -0.006, 0.007, -1],
]
function cloud(g: CanvasRenderingContext2D, fill: number, line: number) {
  g.globalAlpha = fill
  g.beginPath()
  for (const [x, y, r] of PUFFS) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  // the tail
  g.moveTo(-0.03, 0.012)
  g.bezierCurveTo(-0.044, 0.016, -0.05, 0.024, -0.046, 0.03)
  g.bezierCurveTo(-0.036, 0.022, -0.02, 0.02, -0.008, 0.014)
  g.fill()
  g.globalAlpha = line
  g.lineWidth = 0.0032
  for (const [x, y, r, d] of PUFFS) {
    g.beginPath()
    for (let t = 0; t <= 1.001; t += 0.04) {
      const a = d * t * Math.PI * 3.2 - Math.PI / 2
      const rr = r * (0.92 - 0.72 * t)
      const px = x + Math.cos(a) * rr
      const py = y + Math.sin(a) * rr
      t ? g.lineTo(px, py) : g.moveTo(px, py)
    }
    g.stroke()
  }
  g.beginPath()
  g.moveTo(-0.004, 0.016)
  g.bezierCurveTo(-0.022, 0.024, -0.038, 0.02, -0.046, 0.03)
  g.stroke()
}

export function bakePattern(wv: Weave): HTMLCanvasElement {
  const W = 512
  const H = 1024
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const sx = W / CLOTH_W
  const sy = H / CLOTH_L
  g.fillStyle = wv.base
  g.fillRect(0, 0, W, H)
  g.setTransform(sx, 0, 0, sy, 0, 0)
  // a fine weave: threads along both directions, very faint (gives the sheen something to sit on)
  g.globalAlpha = 0.025
  g.lineWidth = 0.0012
  for (let x = 0; x < CLOTH_W; x += 0.004) {
    g.strokeStyle = (Math.round(x / 0.004) & 1) ? '#000' : '#fff'
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, CLOTH_L)
    g.stroke()
  }
  g.globalAlpha = 1
  // damask: cloud scrolls on a 0.11 m half-drop repeat, one shade lighter, filled and outlined
  const R = 0.11
  const inset = 0.03 + 0.05 + 0.012
  g.save()
  g.beginPath()
  g.rect(inset, inset, CLOTH_W - inset * 2, CLOTH_L - inset * 2)
  g.clip()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let row = -1; row * R < CLOTH_L + R; row++)
    for (let col = -1; col * R < CLOTH_W + R; col++) {
      const cx = col * R + (row & 1 ? R / 2 : 0)
      const cy = row * R
      g.save()
      g.translate(cx, cy)
      if ((row + col) & 1) g.scale(-1, 1)
      g.fillStyle = wv.damask
      g.strokeStyle = wv.base
      cloud(g, 0.75, 0.9)
      g.restore()
      // a small four-petal lozenge between the clouds
      g.save()
      g.translate(cx + R / 2, cy + R / 2)
      g.fillStyle = wv.damask
      g.globalAlpha = 0.7
      g.beginPath()
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2
        g.ellipse(Math.cos(a) * 0.006, Math.sin(a) * 0.006, 0.006, 0.0035, a, 0, Math.PI * 2)
      }
      g.fill()
      g.restore()
    }
  g.restore()
  g.globalAlpha = 1
  // the gold border band: 0.05 m wide, 0.03 m in from every hem, with a fret (回纹) in it
  const b0 = 0.03
  const bw = 0.05
  g.fillStyle = wv.gold
  const band = (x: number, y: number, w: number, h: number) => g.fillRect(x, y, w, h)
  band(b0, b0, CLOTH_W - 2 * b0, bw)
  band(b0, CLOTH_L - b0 - bw, CLOTH_W - 2 * b0, bw)
  band(b0, b0, bw, CLOTH_L - 2 * b0)
  band(CLOTH_W - b0 - bw, b0, bw, CLOTH_L - 2 * b0)
  // fine lines either side of the band
  g.strokeStyle = wv.gold
  g.lineWidth = 0.003
  g.strokeRect(b0 + bw + 0.007, b0 + bw + 0.007, CLOTH_W - 2 * (b0 + bw + 0.007), CLOTH_L - 2 * (b0 + bw + 0.007))
  g.strokeRect(b0 - 0.008, b0 - 0.008, CLOTH_W - 2 * (b0 - 0.008), CLOTH_L - 2 * (b0 - 0.008))
  // the fret: a square spiral key repeated along the band, in the base colour
  g.strokeStyle = wv.base
  g.lineWidth = 0.0035
  g.lineCap = 'square'
  const key = (x: number, y: number, s: number) => {
    // a 回 key: spiral in from the outer corner
    g.beginPath()
    g.moveTo(x, y + s)
    g.lineTo(x, y)
    g.lineTo(x + s, y)
    g.lineTo(x + s, y + s * 0.75)
    g.lineTo(x + s * 0.25, y + s * 0.75)
    g.lineTo(x + s * 0.25, y + s * 0.25)
    g.lineTo(x + s * 0.6, y + s * 0.25)
    g.lineTo(x + s * 0.6, y + s * 0.5)
    g.stroke()
  }
  const ks = 0.03
  const pad = (bw - ks) / 2
  for (let x = b0 + pad; x < CLOTH_W - b0 - ks; x += ks * 1.25) {
    key(x, b0 + pad, ks)
    key(x, CLOTH_L - b0 - bw + pad, ks)
  }
  for (let y = b0 + bw + pad; y < CLOTH_L - b0 - bw - ks; y += ks * 1.25) {
    key(b0 + pad, y, ks)
    key(CLOTH_W - b0 - bw + pad, y, ks)
  }
  // the rolled hem: a darker edge with a stitch line
  g.strokeStyle = wv.hem
  g.lineWidth = 0.016
  g.strokeRect(0, 0, CLOTH_W, CLOTH_L)
  g.setLineDash([0.006, 0.004])
  g.lineWidth = 0.0018
  g.strokeStyle = wv.gold
  g.globalAlpha = 0.6
  g.strokeRect(0.011, 0.011, CLOTH_W - 0.022, CLOTH_L - 0.022)
  g.setLineDash([])
  g.globalAlpha = 1
  g.setTransform(1, 0, 0, 1, 0, 0)
  return cv
}
