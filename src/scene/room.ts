// The room (layer L0, tablecloth.md 3.3), baked once per size with Canvas 2D in true perspective:
// a warm plaster wall with window light and the bottom of a wall calendar, a terrazzo floor, and the
// rosewood table (grain along y, a window reflection, a moulded lip, an apron with a cloud band, legs).
// `mask` is white where the floor is visible: the cloth's floor shadow multiplies only there.
import type { Cam } from './camera'
import { FLOOR, TABLE } from '../sim'

const WALL_Y = 2.2 // the wall plane behind the table

export function bakeRoom(cam: Cam, dpr: number, rnd: () => number): { room: HTMLCanvasElement; mask: HTMLCanvasElement } {
  const W = Math.round(cam.w * dpr)
  const H = Math.round(cam.h * dpr)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const P = (x: number, y: number, z: number) => {
    const p = cam.project(x, y, z)
    return [p[0] * dpr, p[1] * dpr] as [number, number]
  }
  const poly = (pts: [number, number][]) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])))
    g.closePath()
  }
  const quad = (a: number[], b: number[], c: number[], d: number[]) => poly([P(a[0], a[1], a[2]), P(b[0], b[1], b[2]), P(c[0], c[1], c[2]), P(d[0], d[1], d[2])])

  // ---- floor (everything first), then the wall over it above the skirting line
  const fg = g.createLinearGradient(0, H * 0.35, 0, H)
  fg.addColorStop(0, '#A9A296')
  fg.addColorStop(1, '#BDB6AA')
  g.fillStyle = fg
  g.fillRect(0, 0, W, H)
  // terrazzo chips: 1,400 per megapixel, 2 to 6 px
  const wallLine = P(0, WALL_Y, FLOOR)[1]
  const chips = Math.round(((W * (H - wallLine)) / 1e6) * 1400)
  const cols = ['#8E877A', '#D8D2C6', '#A0564A', '#8E877A', '#D8D2C6']
  for (let i = 0; i < chips; i++) {
    const x = rnd() * W
    const y = wallLine + rnd() ** 0.8 * (H - wallLine)
    const persp = 0.5 + (0.5 * (y - wallLine)) / (H - wallLine)
    const s = (2 + rnd() * 4) * persp * (dpr / 2 + 0.5)
    g.fillStyle = cols[i % cols.length]
    g.globalAlpha = 0.55 + rnd() * 0.4
    g.beginPath()
    const a = rnd() * Math.PI
    g.ellipse(x, y, s * 0.6, s * 0.4 * (0.5 + persp * 0.5), a, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  // wall
  const wl = P(-6, WALL_Y, FLOOR)
  const wr = P(6, WALL_Y, FLOOR)
  const wg = g.createLinearGradient(0, 0, 0, wallLine)
  wg.addColorStop(0, '#E9DCC8')
  wg.addColorStop(1, '#D9C6AA')
  g.fillStyle = wg
  g.fillRect(0, 0, W, Math.max(wl[1], wr[1]))
  // skirting board
  g.fillStyle = '#B79F80'
  quad([-6, WALL_Y, FLOOR], [6, WALL_Y, FLOOR], [6, WALL_Y, FLOOR + 0.08], [-6, WALL_Y, FLOOR + 0.08])
  g.fill()
  // window light: a soft parallelogram from the upper left
  g.save()
  g.globalAlpha = 0.5
  const wlg = g.createLinearGradient(0, 0, W * 0.6, H * 0.3)
  wlg.addColorStop(0, '#FFF6E2')
  wlg.addColorStop(1, 'rgba(255,246,226,0)')
  g.fillStyle = wlg
  g.filter = `blur(${Math.round(6 * dpr)}px)`
  quad([-1.0, WALL_Y, 0.5], [-0.1, WALL_Y, 0.5], [-0.3, WALL_Y, -0.45], [-1.2, WALL_Y, -0.45])
  g.fill()
  g.restore()
  // the wall calendar's lower edge at the top right, a red date block (no readable date)
  {
    const a = P(0.30, WALL_Y, 0.580)
    const b = P(0.80, WALL_Y, 0.580)
    const c = P(0.80, WALL_Y, -0.200)
    const d = P(0.30, WALL_Y, -0.200)
    g.save()
    g.shadowColor = 'rgba(80,50,20,0.25)'
    g.shadowBlur = 6 * dpr
    g.shadowOffsetX = 2 * dpr
    g.shadowOffsetY = 3 * dpr
    poly([a, b, c, d])
    g.fillStyle = '#F7F1E4'
    g.fill()
    g.restore()
    // the red block and faint grid lines
    const bl = P(0.35, WALL_Y, 0.280)
    const br = P(0.75, WALL_Y, 0.280)
    const bb = P(0.75, WALL_Y, -0.020)
    const bd = P(0.35, WALL_Y, -0.020)
    poly([bl, br, bb, bd])
    g.fillStyle = '#C0392B'
    g.fill()
    g.strokeStyle = 'rgba(120,90,60,0.25)'
    g.lineWidth = Math.max(1, dpr * 0.75)
    for (let i = 1; i < 4; i++) {
      const z = -0.02 - i * 0.045
      const l = P(0.47, WALL_Y, z)
      const r = P(0.87, WALL_Y, z)
      g.beginPath()
      g.moveTo(l[0], l[1])
      g.lineTo(r[0], r[1])
      g.stroke()
    }
    // the bottom curl of the pad
    const cl = P(0.30, WALL_Y, -0.200)
    const cr = P(0.80, WALL_Y, -0.200)
    g.strokeStyle = 'rgba(120,90,60,0.35)'
    g.beginPath()
    g.moveTo(cl[0], cl[1])
    g.lineTo(cr[0], cr[1])
    g.stroke()
  }

  // ---- the floor under the table: a soft dark pool (the table's own shadow)
  g.save()
  g.filter = `blur(${Math.round(14 * dpr)}px)`
  g.fillStyle = 'rgba(40,25,15,0.45)'
  quad([-0.36, 1.2, FLOOR], [0.5, 1.25, FLOOR], [0.48, 0.02, FLOOR], [-0.34, 0.04, FLOOR])
  g.fill()
  g.restore()
  // floor mask into alpha: everything so far below the wall line is floor
  const mask = document.createElement('canvas')
  mask.width = W
  mask.height = H
  const mg = mask.getContext('2d')!
  mg.fillStyle = '#fff'
  mg.fillRect(0, Math.max(wl[1], wr[1]), W, H)

  // ---- the table
  const { x0, x1, y0, y1, apron } = TABLE
  const legW = 0.055
  const legs = [
    [x0 + 0.02, y1 - 0.06],
    [x1 - 0.02 - legW, y1 - 0.06],
    [x0 + 0.02, y0 + 0.02],
    [x1 - 0.02 - legW, y0 + 0.02],
  ]
  legs.forEach(([lx, ly], i) => {
    const back = i < 2
    const lg = g.createLinearGradient(P(lx, ly, -0.3)[0], 0, P(lx + legW, ly, -0.3)[0], 0)
    lg.addColorStop(0, back ? '#2a110b' : '#5c2619')
    lg.addColorStop(0.35, back ? '#38170e' : '#6B2E1F')
    lg.addColorStop(1, back ? '#1f0c07' : '#3a160e')
    g.fillStyle = lg
    quad([lx, ly, -apron], [lx + legW, ly, -apron], [lx + legW, ly, FLOOR], [lx, ly, FLOOR])
    g.fill()
    mg.globalCompositeOperation = 'destination-out'
    mg.fillStyle = '#000'
    mg.beginPath()
    const pts = [P(lx, ly, -apron), P(lx + legW, ly, -apron), P(lx + legW, ly, FLOOR), P(lx, ly, FLOOR)]
    pts.forEach((p, k) => (k ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])))
    mg.fill()
    mg.globalCompositeOperation = 'source-over'
    if (!back) {
      // a highlight down the lit side and a foot
      g.fillStyle = 'rgba(255,210,170,0.12)'
      quad([lx + 0.006, ly, -apron], [lx + 0.014, ly, -apron], [lx + 0.014, ly, FLOOR], [lx + 0.006, ly, FLOOR])
      g.fill()
    }
  })
  // apron (front face y = 0, z from 0 down to -apron)
  const apronPts = [P(x0, y0, -0.012), P(x1, y0, -0.012), P(x1, y0, -apron), P(x0, y0, -apron)]
  poly(apronPts)
  const ag = g.createLinearGradient(0, apronPts[0][1], 0, apronPts[2][1])
  ag.addColorStop(0, '#4f2116')
  ag.addColorStop(1, '#3a170f')
  g.fillStyle = ag
  g.fill()
  // the carved cloud band in low relief: a row of scrolls, light on the upper left of each groove
  {
    const top = P(0, y0, -0.03)[1]
    const bot = P(0, y0, -apron + 0.01)[1]
    const cy = (top + bot) / 2
    const rr = (bot - top) * 0.32
    const xa = P(x0 + 0.03, y0, 0)[0]
    const xb = P(x1 - 0.03, y0, 0)[0]
    const n = Math.max(6, Math.round((xb - xa) / (rr * 4.2)))
    for (const [dx, dy, col] of [
      [-0.6, -0.6, 'rgba(255,200,160,0.16)'],
      [0.8, 0.8, 'rgba(20,6,3,0.5)'],
    ] as const) {
      g.strokeStyle = col
      g.lineWidth = Math.max(1, rr * 0.28)
      g.lineCap = 'round'
      for (let i = 0; i < n; i++) {
        const cx = xa + ((i + 0.5) / n) * (xb - xa) + dx * dpr
        const yy = cy + dy * dpr
        g.beginPath()
        const dir = i & 1 ? 1 : -1
        for (let t = 0; t <= 1.001; t += 0.06) {
          const a = dir * t * Math.PI * 2.1 + (dir > 0 ? Math.PI : 0)
          const r = rr * (1 - 0.65 * t)
          const px = cx + Math.cos(a) * r
          const py = yy + Math.sin(a) * r * 0.85
          t ? g.lineTo(px, py) : g.moveTo(px, py)
        }
        g.stroke()
        // the connecting wave to the next scroll
        if (i < n - 1) {
          g.beginPath()
          g.moveTo(cx + rr, yy)
          g.quadraticCurveTo(cx + ((xb - xa) / n) * 0.5, yy + rr * 1.1 * dir, cx + (xb - xa) / n - rr, yy)
          g.stroke()
        }
      }
    }
  }
  // the moulded top edge band (front of the top slab)
  const lipPts = [P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, -0.012), P(x0, y0, -0.012)]
  poly(lipPts)
  const lg = g.createLinearGradient(0, lipPts[0][1], 0, lipPts[2][1])
  lg.addColorStop(0, '#7a3626')
  lg.addColorStop(1, '#3d180f')
  g.fillStyle = lg
  g.fill()
  // the top
  const top = [P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)]
  poly(top)
  const tg = g.createLinearGradient(0, top[2][1], 0, top[0][1])
  tg.addColorStop(0, '#4A1F16')
  tg.addColorStop(1, '#6B2E1F')
  g.fillStyle = tg
  g.fill()
  g.save()
  poly(top)
  g.clip()
  // long grain along y: 300 strokes, 1 px, alpha 0.08, lighter and darker
  g.lineWidth = Math.max(1, dpr * 0.75)
  for (let i = 0; i < 300; i++) {
    const x = x0 + rnd() * (x1 - x0)
    const wob = (rnd() - 0.5) * 0.02
    const a = P(x, y0 - 0.02, 0)
    const m = P(x + wob, (y0 + y1) / 2, 0)
    const b = P(x + wob * 0.3, y1 + 0.02, 0)
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,190,150,0.08)' : 'rgba(25,8,4,0.10)'
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.quadraticCurveTo(m[0], m[1], b[0], b[1])
    g.stroke()
  }
  // the window's soft reflection band across the far third (white, alpha 0.10)
  g.filter = `blur(${Math.round(10 * dpr)}px)`
  g.fillStyle = 'rgba(255,255,255,0.10)'
  quad([x0 - 0.1, y1 - 0.12, 0], [x0 + 0.42, y1 - 0.12, 0], [x0 + 0.22, y1 - 0.42, 0], [x0 - 0.3, y1 - 0.42, 0])
  g.fill()
  g.filter = 'none'
  g.restore()
  // the lip: 2 px light line on the upper-left edge, 3 px dark line under it
  const ln = (a: [number, number], b: [number, number], col: string, w: number) => {
    g.strokeStyle = col
    g.lineWidth = w
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.lineTo(b[0], b[1])
    g.stroke()
  }
  ln(P(x0, y0, 0), P(x1, y0, 0), 'rgba(255,205,170,0.55)', 2 * dpr)
  const under = P(x0, y0, -0.012)
  ln([under[0], under[1] + 1.5 * dpr], [P(x1, y0, -0.012)[0], under[1] + 1.5 * dpr], 'rgba(20,6,3,0.6)', 3 * dpr)
  ln(P(x0, y0, 0), P(x0, y1, 0), 'rgba(255,205,170,0.35)', 1.5 * dpr)
  // the apron's bottom edge
  ln(P(x0, y0, -apron), P(x1, y0, -apron), 'rgba(15,5,2,0.55)', 2 * dpr)

  // the table top and apron hide the floor too
  mg.globalCompositeOperation = 'destination-out'
  mg.fillStyle = '#000'
  for (const pts of [top, apronPts, lipPts]) {
    mg.beginPath()
    pts.forEach((p, k) => (k ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])))
    mg.fill()
  }
  return { room: cv, mask }
}
