// The props (layer L4, tablecloth.md 3.5), each painted once with Canvas 2D as seen from the camera's elevation,
// at twice its on-screen size. Coordinates in the painters: metres, origin at the base centre, y down.
// Light from the upper left. Phase 1: the cup, Mum's rooster bowls, the braised fish, the celadon vase.
import type { PropId } from '../model/props'

export const E = 0.58 // ellipse ratio of a level circle seen from the camera
export const BOWL_STEP = 0.027 // the stacked bowls sit this far apart

export interface Sprite {
  cv: HTMLCanvasElement
  ax: number // anchor (base centre) in canvas px
  ay: number
  k: number // canvas px per metre
}

function canvas(left: number, right: number, up: number, down: number, k: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const cv = document.createElement('canvas')
  cv.width = Math.ceil((left + right) * k)
  cv.height = Math.ceil((up + down) * k)
  const g = cv.getContext('2d')!
  g.translate(left * k, up * k)
  g.scale(k, k)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  draw(g)
  return { cv, ax: left * k, ay: up * k, k }
}

const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
}

/** a porcelain body gradient: lit on the left, cool on the right */
function porcelain(g: CanvasRenderingContext2D, x0: number, x1: number, base = '#F6F1E6') {
  const gr = g.createLinearGradient(x0, 0, x1, 0)
  gr.addColorStop(0, '#E9E3D6')
  gr.addColorStop(0.18, '#FFFFFF')
  gr.addColorStop(0.35, base)
  gr.addColorStop(0.8, '#CFCBC2')
  gr.addColorStop(1, '#B8B4AC')
  return gr
}

// ---------- cup on a saucer: 0.11 wide, 0.07 tall ----------
function cup(k: number): Sprite {
  return canvas(0.065, 0.075, 0.1, 0.042, k, (g) => {
    // saucer: an edge, then the top
    ell(g, 0, 0.004, 0.055, 0.055 * E)
    g.fillStyle = '#B9B4AA'
    g.fill()
    ell(g, 0, 0, 0.055, 0.055 * E)
    g.fillStyle = porcelain(g, -0.055, 0.055)
    g.fill()
    g.strokeStyle = '#2B4C9B'
    g.lineWidth = 0.0016
    ell(g, 0, -0.0005, 0.05, 0.05 * E)
    g.stroke()
    ell(g, 0, 0.001, 0.03, 0.03 * E)
    g.fillStyle = 'rgba(150,140,125,0.25)'
    g.fill()
    // the cup body
    const my = -0.056
    const rx = 0.037
    g.beginPath()
    g.moveTo(-rx, my)
    g.bezierCurveTo(-rx, my + 0.03, -0.026, -0.006, -0.02, -0.004)
    g.lineTo(0.02, -0.004)
    g.bezierCurveTo(0.026, -0.006, rx, my + 0.03, rx, my)
    g.ellipse(0, my, rx, rx * E, 0, 0, Math.PI, false)
    g.closePath()
    g.fillStyle = porcelain(g, -rx, rx)
    g.fill()
    // handle on the right, a little behind
    g.strokeStyle = '#D9D4CA'
    g.lineWidth = 0.006
    g.beginPath()
    g.moveTo(rx - 0.003, my + 0.01)
    g.bezierCurveTo(rx + 0.022, my + 0.008, rx + 0.02, my + 0.034, rx - 0.008, my + 0.036)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 0.0018
    g.beginPath()
    g.moveTo(rx + 0.001, my + 0.012)
    g.bezierCurveTo(rx + 0.016, my + 0.012, rx + 0.015, my + 0.028, rx - 0.004, my + 0.031)
    g.stroke()
    // cobalt rim line, then the mouth: inner wall and tea
    g.strokeStyle = '#2B4C9B'
    g.lineWidth = 0.0022
    g.beginPath()
    g.ellipse(0, my + 0.004, rx - 0.0008, (rx - 0.0008) * E, 0, 0.05, Math.PI - 0.05)
    g.stroke()
    ell(g, 0, my, rx, rx * E)
    g.fillStyle = '#EDE7DA'
    g.fill()
    ell(g, 0, my + 0.004, rx - 0.004, (rx - 0.004) * E * 0.92)
    const tg = g.createRadialGradient(-0.01, my, 0.002, 0, my + 0.004, rx)
    tg.addColorStop(0, '#C9762A')
    tg.addColorStop(1, '#8E4A14')
    g.fillStyle = tg
    g.fill()
    // crescent highlight on the tea
    g.strokeStyle = 'rgba(255,240,215,0.75)'
    g.lineWidth = 0.0028
    g.beginPath()
    g.ellipse(0, my + 0.004, rx - 0.009, (rx - 0.009) * E * 0.85, 0, Math.PI * 1.08, Math.PI * 1.45)
    g.stroke()
    // rim highlight
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    g.lineWidth = 0.0012
    g.beginPath()
    g.ellipse(0, my, rx, rx * E, 0, Math.PI * 1.05, Math.PI * 1.5)
    g.stroke()
    // a wisp of steam
    g.strokeStyle = 'rgba(255,255,255,0.28)'
    g.lineWidth = 0.004
    g.beginPath()
    g.moveTo(-0.004, my - 0.006)
    g.bezierCurveTo(-0.016, my - 0.016, 0.01, my - 0.024, -0.002, my - 0.04)
    g.stroke()
    g.lineWidth = 0.0025
    g.strokeStyle = 'rgba(255,255,255,0.18)'
    g.beginPath()
    g.moveTo(0.008, my - 0.008)
    g.bezierCurveTo(0.018, my - 0.02, 0.0, my - 0.028, 0.012, my - 0.042)
    g.stroke()
  })
}

// ---------- Mum's rooster bowls: three bowls, one sprite each ----------
const BR = 0.065 // rim radius
const BH = 0.068 // bowl height
const BE = 0.5 // the bowls' rim ellipse (a little flatter than E so more of the painted wall shows)
const BF = 0.028 // foot radius

function bowlBody(g: CanvasRenderingContext2D) {
  g.beginPath()
  g.moveTo(-BR, -BH)
  g.bezierCurveTo(-BR, -BH * 0.35, -BF - 0.006, -0.008, -BF, -0.006)
  g.lineTo(-BF, 0)
  g.ellipse(0, 0, BF, BF * E, 0, Math.PI, 0, true)
  g.lineTo(BF, -0.006)
  g.bezierCurveTo(BF + 0.006, -0.008, BR, -BH * 0.35, BR, -BH)
  g.ellipse(0, -BH, BR, BR * BE, 0, 0, Math.PI, false)
  g.closePath()
}

/** the rooster: red and black brushwork, a green banana leaf, a pink peony, with the hand-painted wobble */
function rooster(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  // banana leaf behind, to the right
  g.fillStyle = '#3F8F3A'
  g.beginPath()
  g.moveTo(0.006, 0.012)
  g.bezierCurveTo(0.02, -0.004, 0.036, -0.02, 0.046, -0.03)
  g.bezierCurveTo(0.04, -0.012, 0.028, 0.006, 0.01, 0.016)
  g.fill()
  g.strokeStyle = '#25602A'
  g.lineWidth = 0.0012
  g.beginPath()
  g.moveTo(0.008, 0.014)
  g.quadraticCurveTo(0.03, -0.006, 0.045, -0.029)
  g.stroke()
  // tail: black sweeping feathers
  g.strokeStyle = '#1C1A18'
  g.lineWidth = 0.003
  for (let i = 0; i < 4; i++) {
    g.beginPath()
    g.moveTo(-0.008, -0.004)
    g.bezierCurveTo(-0.02 - i * 0.002, -0.022 - i * 0.003, -0.034 - i * 0.003, -0.012 + i * 0.002, -0.028 - i * 0.004, 0.006 + i * 0.003)
    g.stroke()
  }
  // body: red
  g.fillStyle = '#C8321F'
  g.beginPath()
  g.ellipse(0, 0.002, 0.012, 0.009, -0.25, 0, Math.PI * 2)
  g.fill()
  // neck and head
  g.beginPath()
  g.moveTo(0.004, -0.004)
  g.quadraticCurveTo(0.012, -0.012, 0.011, -0.019)
  g.lineTo(0.016, -0.018)
  g.quadraticCurveTo(0.017, -0.008, 0.01, 0.0)
  g.fill()
  ell(g, 0.0135, -0.02, 0.0042, 0.0038)
  g.fill()
  // comb and wattle
  g.fillStyle = '#E2402A'
  g.beginPath()
  g.moveTo(0.01, -0.023)
  g.lineTo(0.012, -0.028)
  g.lineTo(0.014, -0.024)
  g.lineTo(0.016, -0.028)
  g.lineTo(0.0175, -0.022)
  g.fill()
  // beak
  g.fillStyle = '#D9A32B'
  g.beginPath()
  g.moveTo(0.0175, -0.0205)
  g.lineTo(0.022, -0.019)
  g.lineTo(0.0172, -0.0178)
  g.fill()
  // wing: black strokes over the red
  g.strokeStyle = '#1C1A18'
  g.lineWidth = 0.0018
  g.beginPath()
  g.moveTo(-0.006, -0.001)
  g.quadraticCurveTo(0.002, 0.004, 0.008, 0.0)
  g.moveTo(-0.004, 0.003)
  g.quadraticCurveTo(0.003, 0.007, 0.007, 0.004)
  g.stroke()
  // legs
  g.strokeStyle = '#B5651D'
  g.lineWidth = 0.0013
  g.beginPath()
  g.moveTo(-0.002, 0.01)
  g.lineTo(-0.003, 0.017)
  g.moveTo(0.003, 0.01)
  g.lineTo(0.004, 0.017)
  g.stroke()
  // peony on the left, pink
  g.fillStyle = '#E58FA0'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ell(g, -0.03 + Math.cos(a) * 0.0045, 0.008 + Math.sin(a) * 0.0035, 0.004, 0.0032)
    g.fill()
  }
  g.fillStyle = '#C9566E'
  ell(g, -0.03, 0.008, 0.0028, 0.0022)
  g.fill()
  g.strokeStyle = '#3F8F3A'
  g.lineWidth = 0.0015
  g.beginPath()
  g.moveTo(-0.03, 0.012)
  g.quadraticCurveTo(-0.026, 0.02, -0.02, 0.02)
  g.stroke()
  g.restore()
}

function bowl(k: number, level: 0 | 1 | 2): Sprite {
  return canvas(0.075, 0.075, 0.12, 0.03, k, (g) => {
    g.save()
    if (level > 0) {
      // only what shows above the rim of the bowl below (BOWL_STEP lower in this frame)
      const ry = -BH + BOWL_STEP
      g.beginPath()
      g.rect(-0.08, -0.12, 0.16, 0.12 + ry)
      g.ellipse(0, ry, BR - 0.002, (BR - 0.002) * BE, 0, 0, Math.PI * 2)
      g.clip()
    }
    // outside: off-white glaze
    bowlBody(g)
    g.fillStyle = porcelain(g, -BR, BR, '#F4EEDF')
    g.fill()
    // the decoration: one rooster facing right, a little left of centre
    g.save()
    bowlBody(g)
    g.clip()
    rooster(g, level === 1 ? 0.012 : -0.008, level === 0 ? -0.016 : -BH + BR * BE - BOWL_STEP * 0.45, level === 0 ? 1.25 : 1.05)
    // shading over the painting: the right side turns away from the light
    const sh = g.createLinearGradient(-BR, 0, BR, 0)
    sh.addColorStop(0, 'rgba(255,255,255,0.0)')
    sh.addColorStop(0.6, 'rgba(120,110,95,0.0)')
    sh.addColorStop(1, 'rgba(90,80,70,0.35)')
    g.fillStyle = sh
    g.fillRect(-BR, -BH - 0.05, BR * 2, 0.08)
    g.restore()
    // the foot ring line
    g.strokeStyle = 'rgba(120,105,85,0.5)'
    g.lineWidth = 0.0012
    g.beginPath()
    g.ellipse(0, -0.006, BF + 0.002, (BF + 0.002) * E, 0, 0.1, Math.PI - 0.1)
    g.stroke()
    g.restore()
    // the mouth: inner glaze, shaded at the front (the wall facing away from the light)
    ell(g, 0, -BH, BR, BR * BE)
    const ig = g.createLinearGradient(0, -BH - BR * BE, 0, -BH + BR * BE)
    ig.addColorStop(0, '#FBF7EE')
    ig.addColorStop(0.55, '#EFE8D8')
    ig.addColorStop(1, '#D8D0BF')
    g.fillStyle = ig
    g.fill()
    if (level === 2) {
      // the inside centre: a small painted red ring
      g.strokeStyle = 'rgba(200,50,31,0.55)'
      g.lineWidth = 0.0015
      ell(g, 0, -BH + 0.008, 0.016, 0.016 * E)
      g.stroke()
    }
    // the rim: a thin brown-red edge line and a highlight
    g.strokeStyle = 'rgba(150,60,30,0.65)'
    g.lineWidth = 0.0015
    ell(g, 0, -BH, BR, BR * BE)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    g.lineWidth = 0.0014
    g.beginPath()
    g.ellipse(0, -BH, BR - 0.001, (BR - 0.001) * BE, 0, Math.PI * 0.85, Math.PI * 1.35)
    g.stroke()
  })
}

// ---------- 年年有余: a braised fish on an oval plate, 0.26 wide ----------
function fish(k: number): Sprite {
  return canvas(0.14, 0.14, 0.09, 0.06, k, (g) => {
    const PX = 0.13
    const PY = 0.085 * E
    // plate edge and top
    ell(g, 0, 0.004, PX, PY)
    g.fillStyle = '#B5B0A6'
    g.fill()
    ell(g, 0, 0, PX, PY)
    g.fillStyle = porcelain(g, -PX, PX, '#F7F3EA')
    g.fill()
    g.strokeStyle = '#2B4C9B'
    g.lineWidth = 0.002
    ell(g, 0, -0.0005, PX - 0.008, PY - 0.006)
    g.stroke()
    // the well, with a sauce pool
    ell(g, 0, 0.001, PX - 0.024, PY - 0.016)
    g.fillStyle = 'rgba(160,150,135,0.25)'
    g.fill()
    ell(g, 0.004, 0.002, PX - 0.03, PY - 0.02)
    const pool = g.createRadialGradient(-0.02, -0.004, 0.005, 0, 0, PX)
    pool.addColorStop(0, '#7A3E16')
    pool.addColorStop(1, '#4E240C')
    g.fillStyle = pool
    g.fill()
    // the fish, head to the left, lying on its side, raised a little
    const y = -0.012
    g.save()
    g.translate(0, y)
    // tail fin
    g.fillStyle = '#5A2A0E'
    g.beginPath()
    g.moveTo(0.078, 0)
    g.lineTo(0.108, -0.02)
    g.quadraticCurveTo(0.1, 0, 0.11, 0.018)
    g.closePath()
    g.fill()
    // dorsal fin
    g.beginPath()
    g.moveTo(-0.03, -0.022)
    g.quadraticCurveTo(0.01, -0.038, 0.05, -0.016)
    g.lineTo(0.03, -0.012)
    g.closePath()
    g.fill()
    // body
    g.beginPath()
    g.moveTo(-0.092, 0.002)
    g.bezierCurveTo(-0.07, -0.032, 0.03, -0.03, 0.08, -0.004)
    g.lineTo(0.08, 0.004)
    g.bezierCurveTo(0.03, 0.026, -0.07, 0.03, -0.092, 0.002)
    const bg = g.createLinearGradient(0, -0.03, 0, 0.03)
    bg.addColorStop(0, '#9A5420')
    bg.addColorStop(0.45, '#7C3D12')
    bg.addColorStop(1, '#4A200A')
    g.fillStyle = bg
    g.fill()
    // scored cuts
    g.strokeStyle = 'rgba(40,15,5,0.6)'
    g.lineWidth = 0.002
    for (let i = 0; i < 4; i++) {
      const x = -0.03 + i * 0.022
      g.beginPath()
      g.moveTo(x - 0.004, -0.02)
      g.quadraticCurveTo(x + 0.004, -0.004, x - 0.002, 0.016)
      g.stroke()
    }
    // head: gill line, eye
    g.strokeStyle = 'rgba(40,15,5,0.7)'
    g.lineWidth = 0.0018
    g.beginPath()
    g.moveTo(-0.058, -0.02)
    g.quadraticCurveTo(-0.05, 0.0, -0.058, 0.018)
    g.stroke()
    ell(g, -0.075, -0.006, 0.0045, 0.004)
    g.fillStyle = '#EDE3CF'
    g.fill()
    ell(g, -0.075, -0.006, 0.0022, 0.002)
    g.fillStyle = '#1B120C'
    g.fill()
    // glossy sauce highlights: the brightest thing on the table
    g.strokeStyle = 'rgba(255,236,200,0.95)'
    g.lineWidth = 0.003
    g.beginPath()
    g.moveTo(-0.06, -0.018)
    g.quadraticCurveTo(-0.01, -0.03, 0.05, -0.016)
    g.stroke()
    g.strokeStyle = 'rgba(255,245,225,0.7)'
    g.lineWidth = 0.0016
    for (const [x, w] of [
      [-0.02, 0.012],
      [0.014, 0.01],
      [0.04, 0.008],
    ]) {
      g.beginPath()
      g.moveTo(x, -0.01)
      g.lineTo(x + w, -0.012)
      g.stroke()
    }
    // spring-onion threads, green and white
    g.lineWidth = 0.0016
    for (let i = 0; i < 9; i++) {
      const x = -0.05 + i * 0.012
      g.strokeStyle = i % 3 === 1 ? '#EEF3D8' : '#7CB342'
      g.beginPath()
      g.moveTo(x, -0.018 + (i % 2) * 0.004)
      g.bezierCurveTo(x + 0.006, -0.03, x + 0.012, -0.006, x + 0.02, -0.02 + (i % 3) * 0.003)
      g.stroke()
    }
    // red chilli rings
    g.strokeStyle = '#D7261E'
    g.lineWidth = 0.0024
    for (const [x, yy] of [
      [-0.035, -0.012],
      [0.0, -0.02],
      [0.028, -0.008],
      [0.052, -0.014],
      [-0.012, 0.002],
    ]) {
      ell(g, x, yy, 0.004, 0.003)
      g.stroke()
    }
    g.restore()
    // plate rim highlight
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 0.0016
    g.beginPath()
    g.ellipse(0, 0, PX - 0.002, PY - 0.0015, 0, Math.PI * 0.95, Math.PI * 1.4)
    g.stroke()
  })
}

// ---------- celadon vase with one peony: 0.09 wide, 0.30 tall ----------
function vase(k: number): Sprite {
  return canvas(0.07, 0.07, 0.31, 0.03, k, (g) => {
    const top = -0.21
    // body: a baluster, shoulder at 0.07 below the mouth
    g.beginPath()
    g.moveTo(-0.012, top)
    g.bezierCurveTo(-0.012, top + 0.03, -0.045, top + 0.05, -0.044, top + 0.1)
    g.bezierCurveTo(-0.043, top + 0.16, -0.026, top + 0.2, -0.026, -0.004)
    g.ellipse(0, -0.004, 0.026, 0.026 * E, 0, Math.PI, 0, true)
    g.bezierCurveTo(0.026, top + 0.2, 0.043, top + 0.16, 0.044, top + 0.1)
    g.bezierCurveTo(0.045, top + 0.05, 0.012, top + 0.03, 0.012, top)
    g.closePath()
    const vg = g.createLinearGradient(-0.045, 0, 0.045, 0)
    vg.addColorStop(0, '#9DBB9B')
    vg.addColorStop(0.22, '#CFE3CB')
    vg.addColorStop(0.42, '#AECBAA')
    vg.addColorStop(0.85, '#7F9F80')
    vg.addColorStop(1, '#6C8A6E')
    g.fillStyle = vg
    g.fill()
    // the long soft highlight
    g.strokeStyle = 'rgba(255,255,255,0.55)'
    g.lineWidth = 0.005
    g.beginPath()
    g.moveTo(-0.028, top + 0.065)
    g.bezierCurveTo(-0.034, top + 0.11, -0.03, top + 0.16, -0.02, top + 0.19)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.25)'
    g.lineWidth = 0.011
    g.stroke()
    // a faint crackle band at the shoulder
    g.strokeStyle = 'rgba(70,100,72,0.35)'
    g.lineWidth = 0.0012
    g.beginPath()
    g.ellipse(0, top + 0.05, 0.04, 0.04 * E * 0.5, 0, 0.1, Math.PI - 0.1)
    g.stroke()
    // the foot line
    g.strokeStyle = 'rgba(60,80,60,0.45)'
    g.beginPath()
    g.ellipse(0, -0.008, 0.026, 0.026 * E, 0, 0.1, Math.PI - 0.1)
    g.stroke()
    // the mouth
    ell(g, 0, top, 0.016, 0.016 * E)
    g.fillStyle = '#6F8F70'
    g.fill()
    ell(g, 0, top + 0.001, 0.011, 0.011 * E)
    g.fillStyle = '#2E3F2F'
    g.fill()
    // the peony on its stem, a little off to the left, with two leaves
    g.strokeStyle = '#3E7A35'
    g.lineWidth = 0.0035
    g.beginPath()
    g.moveTo(0, top)
    g.quadraticCurveTo(-0.004, top - 0.03, -0.006, top - 0.055)
    g.stroke()
    g.fillStyle = '#4C8C3E'
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(-0.002, top - 0.02)
      g.quadraticCurveTo(-0.002 + s * 0.024, top - 0.04, -0.002 + s * 0.03, top - 0.022)
      g.quadraticCurveTo(-0.002 + s * 0.016, top - 0.016, -0.002, top - 0.02)
      g.fill()
    }
    const fx = -0.006
    const fy = top - 0.07
    for (let ring = 0; ring < 3; ring++) {
      const n = 7 - ring
      const r = 0.026 - ring * 0.007
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4
        g.fillStyle = ring === 0 ? '#E07A92' : ring === 1 ? '#EB97AA' : '#F6C1CB'
        g.beginPath()
        g.ellipse(fx + Math.cos(a) * r * 0.5, fy + Math.sin(a) * r * 0.36, r * 0.55, r * 0.42, a, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = 'rgba(150,40,70,0.35)'
        g.lineWidth = 0.0008
        g.stroke()
      }
    }
    ell(g, fx, fy, 0.0045, 0.0035)
    g.fillStyle = '#E8C15A'
    g.fill()
  })
}

export function paintProp(id: PropId, k: number): Sprite[] {
  switch (id) {
    case 'cup':
      return [cup(k)]
    case 'bowls':
      return [bowl(k, 0), bowl(k, 1), bowl(k, 2)]
    case 'fish':
      return [fish(k)]
    case 'vase':
      return [vase(k)]
    default:
      return [cup(k)] // phase 2 props are not painted yet
  }
}

/** the soft contact shadow ellipse, white = shadow (multiplied as rgba(10,20,18,0.34)) */
export function shadowSprite(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')!
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.62, 'rgba(255,255,255,0.95)')
  gr.addColorStop(0.85, 'rgba(255,255,255,0.45)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return cv
}
