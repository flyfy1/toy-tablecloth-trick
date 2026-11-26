// The props (layer L4, tablecloth.md 3.5), each painted once with Canvas 2D as seen from the camera's elevation,
// at twice its on-screen size. Coordinates in the painters: metres, origin at the base centre, y down.
// Light from the upper left: the cup, Mum's rooster bowls, the braised fish, the celadon vase, Grandma's thermos,
// the heirloom meiping on its stand, the cat in three poses.
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

/** text at a size in metres (fonts are set in px at the canvas's own scale, so a tiny font is never clamped) */
function text(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, font: string, measure = false): number {
  const k = g.getTransform().a
  g.save()
  g.scale(1 / k, 1 / k)
  g.font = `${font.replace('{s}', String(size * k))}`
  const w = g.measureText(str).width / k
  if (!measure) g.fillText(str, x * k, y * k)
  g.restore()
  return w
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

// the braised fish itself (also lies on the floor, whole, when its plate breaks)
function fishBody(g: CanvasRenderingContext2D) {
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
}

// ---------- 年年有余: a braised fish on an oval plate, 0.26 wide ----------
function fish(k: number, withFish = true): Sprite {
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
    if (withFish) fishBody(g)
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

// ---------- 奶奶的暖水瓶: the red enamel thermos, 0.12 wide, 0.36 tall ----------
function thermos(k: number): Sprite {
  return canvas(0.085, 0.1, 0.38, 0.035, k, (g) => {
    const R = 0.056
    const top = -0.27
    // the aluminium foot ring
    g.beginPath()
    g.moveTo(-R, -0.022)
    g.lineTo(-R, 0)
    g.ellipse(0, 0, R, R * E, 0, Math.PI, 0, true)
    g.lineTo(R, -0.022)
    g.closePath()
    const al = g.createLinearGradient(-R, 0, R, 0)
    al.addColorStop(0, '#8F969B')
    al.addColorStop(0.2, '#E8ECEE')
    al.addColorStop(0.45, '#B5BCC1')
    al.addColorStop(1, '#6E757A')
    g.fillStyle = al
    g.fill()
    g.strokeStyle = 'rgba(60,66,70,0.5)'
    g.lineWidth = 0.0012
    for (const yy of [-0.008, -0.015]) {
      g.beginPath()
      g.ellipse(0, yy, R, R * E, 0, 0.05, Math.PI - 0.05)
      g.stroke()
    }
    // the red enamel body
    g.beginPath()
    g.moveTo(-R, top)
    g.lineTo(-R, -0.022)
    g.ellipse(0, -0.022, R, R * E, 0, Math.PI, 0, true)
    g.lineTo(R, top)
    g.ellipse(0, top, R, R * E, 0, 0, Math.PI, true)
    g.closePath()
    const rg = g.createLinearGradient(-R, 0, R, 0)
    rg.addColorStop(0, '#8E1610')
    rg.addColorStop(0.16, '#E2453A')
    rg.addColorStop(0.3, '#C9271E')
    rg.addColorStop(0.75, '#9C1A13')
    rg.addColorStop(1, '#6A0F0A')
    g.fillStyle = rg
    g.fill()
    // gold lines round the top and the bottom of the print
    g.strokeStyle = '#E3C46A'
    g.lineWidth = 0.0022
    for (const yy of [top + 0.022, -0.045]) {
      g.beginPath()
      g.ellipse(0, yy, R, R * E, 0, 0.02, Math.PI - 0.02)
      g.stroke()
    }
    // the big printed peony, a little left of centre, with leaves, and a gold 囍 on the right
    const px = -0.012
    const py = -0.15
    g.fillStyle = '#3F7D3A'
    for (const [dx, dy, a] of [
      [-0.03, 0.03, -0.6],
      [0.026, 0.034, 0.7],
      [-0.034, -0.02, -2.2],
      [0.03, -0.026, 2.4],
    ]) {
      g.save()
      g.translate(px + dx, py + dy)
      g.rotate(a)
      g.beginPath()
      g.ellipse(0, 0, 0.022, 0.009, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    for (let ring = 0; ring < 4; ring++) {
      const n = 9 - ring * 2
      const r = 0.036 - ring * 0.008
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + ring * 0.5
        g.fillStyle = ring === 0 ? '#F3B6C2' : ring === 1 ? '#F7CBD4' : ring === 2 ? '#FBE3E8' : '#FFF3F5'
        g.beginPath()
        g.ellipse(px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.5, r * 0.5, r * 0.36, a, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = 'rgba(190,60,90,0.45)'
        g.lineWidth = 0.0009
        g.stroke()
      }
    }
    ell(g, px, py, 0.005, 0.004)
    g.fillStyle = '#F2C94C'
    g.fill()
    g.fillStyle = '#E8C766'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    text(g, '囍', 0.036, -0.09, 0.026, '700 {s}px serif')
    // the shine down the left
    g.strokeStyle = 'rgba(255,230,220,0.6)'
    g.lineWidth = 0.006
    g.beginPath()
    g.moveTo(-0.04, top + 0.02)
    g.lineTo(-0.04, -0.03)
    g.stroke()
    g.strokeStyle = 'rgba(255,230,220,0.22)'
    g.lineWidth = 0.014
    g.stroke()
    // a chip in the enamel near the base: black iron under it, a pale edge
    g.beginPath()
    g.moveTo(0.02, -0.03)
    g.lineTo(0.031, -0.036)
    g.lineTo(0.036, -0.028)
    g.lineTo(0.026, -0.024)
    g.closePath()
    g.fillStyle = '#2A2422'
    g.fill()
    g.strokeStyle = 'rgba(255,220,210,0.7)'
    g.lineWidth = 0.0008
    g.stroke()
    // the aluminium shoulder, neck and cup-lid
    g.beginPath()
    g.moveTo(-R, top)
    g.bezierCurveTo(-R, top - 0.03, -0.028, top - 0.038, -0.026, top - 0.045)
    g.lineTo(0.026, top - 0.045)
    g.bezierCurveTo(0.028, top - 0.038, R, top - 0.03, R, top)
    g.ellipse(0, top, R, R * E, 0, 0, Math.PI, false)
    g.closePath()
    g.fillStyle = al
    g.fill()
    g.strokeStyle = 'rgba(60,66,70,0.45)'
    g.lineWidth = 0.0012
    g.beginPath()
    g.ellipse(0, top - 0.02, 0.046, 0.046 * E * 0.6, 0, 0.1, Math.PI - 0.1)
    g.stroke()
    // the cork stopper
    g.beginPath()
    g.moveTo(-0.02, top - 0.045)
    g.lineTo(-0.017, top - 0.072)
    g.ellipse(0, top - 0.072, 0.017, 0.017 * E, 0, Math.PI, 0)
    g.lineTo(0.02, top - 0.045)
    g.closePath()
    const ck = g.createLinearGradient(-0.02, 0, 0.02, 0)
    ck.addColorStop(0, '#9C6A3A')
    ck.addColorStop(0.3, '#D3A36A')
    ck.addColorStop(1, '#7E5228')
    g.fillStyle = ck
    g.fill()
    ell(g, 0, top - 0.072, 0.017, 0.017 * E)
    g.fillStyle = '#C79A62'
    g.fill()
    g.fillStyle = 'rgba(90,55,25,0.5)'
    for (let j = 0; j < 7; j++) {
      ell(g, -0.01 + ((j * 7) % 19) * 0.0011, top - 0.073 + ((j * 5) % 7) * 0.0012 - 0.003, 0.0012, 0.0008)
      g.fill()
    }
    // the handle: an aluminium wire loop on the right
    g.strokeStyle = '#A9B0B5'
    g.lineWidth = 0.004
    g.beginPath()
    g.moveTo(R - 0.004, top - 0.01)
    g.bezierCurveTo(R + 0.04, top - 0.005, R + 0.042, top + 0.11, R - 0.002, top + 0.12)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.6)'
    g.lineWidth = 0.0012
    g.stroke()
  })
}

// ---------- 传家宝: a blue-and-white meiping vase on a small rosewood stand, 0.10 wide, 0.32 tall ----------
function heirloom(k: number, tag: string): Sprite {
  return canvas(0.075, 0.1, 0.34, 0.03, k, (g) => {
    // the stand: a small rosewood table with a carved apron and four short legs
    const sw = 0.05
    g.fillStyle = '#4A1B12'
    for (const x of [-sw + 0.006, sw - 0.012]) g.fillRect(x, -0.02, 0.006, 0.02)
    g.beginPath()
    g.ellipse(0, -0.02, sw, sw * E, 0, 0, Math.PI * 2)
    const st = g.createLinearGradient(-sw, 0, sw, 0)
    st.addColorStop(0, '#5E2418')
    st.addColorStop(0.3, '#8A3A26')
    st.addColorStop(1, '#3E140D')
    g.fillStyle = st
    g.fill()
    g.beginPath()
    g.ellipse(0, -0.026, sw, sw * E, 0, 0, Math.PI * 2)
    g.fillStyle = '#7A3221'
    g.fill()
    g.strokeStyle = 'rgba(255,200,160,0.25)'
    g.lineWidth = 0.001
    g.stroke()
    // the meiping: small mouth, broad shoulder, a long taper to a narrow foot
    const b = -0.03 // its foot
    const top = -0.3
    const shape = () => {
      g.beginPath()
      g.moveTo(-0.014, top)
      g.lineTo(-0.014, top + 0.012)
      g.bezierCurveTo(-0.03, top + 0.016, -0.05, top + 0.035, -0.05, top + 0.075)
      g.bezierCurveTo(-0.05, top + 0.15, -0.026, top + 0.22, -0.028, b)
      g.ellipse(0, b, 0.028, 0.028 * E, 0, Math.PI, 0, true)
      g.bezierCurveTo(0.026, top + 0.22, 0.05, top + 0.15, 0.05, top + 0.075)
      g.bezierCurveTo(0.05, top + 0.035, 0.03, top + 0.016, 0.014, top + 0.012)
      g.lineTo(0.014, top)
      g.closePath()
    }
    shape()
    const vg = g.createLinearGradient(-0.05, 0, 0.05, 0)
    vg.addColorStop(0, '#D9DEE3')
    vg.addColorStop(0.2, '#FFFFFF')
    vg.addColorStop(0.45, '#F2F4F6')
    vg.addColorStop(0.85, '#C7CDD3')
    vg.addColorStop(1, '#AEB5BC')
    g.fillStyle = vg
    g.fill()
    g.save()
    shape()
    g.clip()
    const blue = '#1F3F8F'
    g.strokeStyle = blue
    g.fillStyle = blue
    // bands: under the mouth (lappets), at the shoulder, and the foot (a key fret)
    g.lineWidth = 0.0018
    for (const yy of [top + 0.03, top + 0.05, b - 0.03, b - 0.012]) {
      g.beginPath()
      g.ellipse(0, yy, 0.06, 0.06 * E * 0.45, 0, 0, Math.PI)
      g.stroke()
    }
    for (let j = -3; j <= 3; j++) {
      g.beginPath()
      g.moveTo(j * 0.014 - 0.006, top + 0.032)
      g.quadraticCurveTo(j * 0.014, top + 0.048, j * 0.014 + 0.006, top + 0.032)
      g.fill()
    }
    for (let j = -4; j <= 4; j++) g.strokeRect(j * 0.012 - 0.004, b - 0.027, 0.008, 0.009)
    // the lotus scroll: a wavy stem round the body with lotus flowers and curling leaves
    g.lineWidth = 0.0016
    g.beginPath()
    for (let x = -0.06; x <= 0.06; x += 0.002) {
      const yy = top + 0.12 + Math.sin(x * 70) * 0.022
      x === -0.06 ? g.moveTo(x, yy) : g.lineTo(x, yy)
    }
    g.stroke()
    for (const [x, yy, s] of [
      [-0.03, top + 0.1, 1],
      [0.012, top + 0.142, 1.15],
      [0.044, top + 0.1, 0.9],
      [-0.012, top + 0.185, 0.8],
    ]) {
      // a lotus: three petals and a seed pod
      for (const a of [-0.7, 0, 0.7]) {
        g.save()
        g.translate(x, yy)
        g.rotate(a)
        g.beginPath()
        g.ellipse(0, -0.007 * s, 0.0045 * s, 0.009 * s, 0, 0, Math.PI * 2)
        g.globalAlpha = a ? 0.75 : 0.95
        g.fill()
        g.restore()
      }
      g.globalAlpha = 1
      // curling leaves
      g.beginPath()
      g.arc(x - 0.012 * s, yy + 0.008 * s, 0.005 * s, 0, Math.PI * 1.6)
      g.stroke()
      g.beginPath()
      g.arc(x + 0.012 * s, yy + 0.007 * s, 0.004 * s, Math.PI, Math.PI * 2.6)
      g.stroke()
    }
    // the light wash of cobalt in the glaze, darker toward the right
    const sh = g.createLinearGradient(-0.05, 0, 0.05, 0)
    sh.addColorStop(0, 'rgba(255,255,255,0)')
    sh.addColorStop(1, 'rgba(40,50,70,0.18)')
    g.fillStyle = sh
    g.fillRect(-0.06, top, 0.12, b - top + 0.02)
    g.restore()
    // the glaze highlight
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 0.004
    g.beginPath()
    g.moveTo(-0.036, top + 0.05)
    g.bezierCurveTo(-0.042, top + 0.1, -0.036, top + 0.16, -0.026, top + 0.2)
    g.stroke()
    // the mouth
    ell(g, 0, top, 0.014, 0.014 * E)
    g.fillStyle = '#E8ECEF'
    g.fill()
    ell(g, 0, top + 0.001, 0.009, 0.009 * E)
    g.fillStyle = '#1C2230'
    g.fill()
    // the paper tag on a red thread round the neck, hanging to the right, hand-written
    g.strokeStyle = '#C62828'
    g.lineWidth = 0.0014
    g.beginPath()
    g.ellipse(0, top + 0.016, 0.017, 0.017 * E * 0.6, 0, 0, Math.PI)
    g.moveTo(0.014, top + 0.018)
    g.quadraticCurveTo(0.04, top + 0.03, 0.05, top + 0.05)
    g.stroke()
    g.save()
    g.translate(0.05, top + 0.05)
    g.rotate(0.22)
    const tw = 0.05
    const th = 0.03
    g.fillStyle = '#FBF4DF'
    g.shadowColor = 'rgba(0,0,0,0.25)'
    g.shadowBlur = 0.004
    g.shadowOffsetY = 0.002
    g.beginPath()
    g.moveTo(-0.006, 0)
    g.lineTo(tw - 0.006, 0)
    g.lineTo(tw - 0.006, th)
    g.lineTo(-0.006, th)
    g.closePath()
    g.fill()
    g.shadowColor = 'transparent'
    ell(g, 0, 0.004, 0.0018, 0.0018)
    g.fillStyle = '#C62828'
    g.fill()
    g.fillStyle = '#2B2118'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // the text in two lines if it has a break point, shrunk to fit the tag
    const m = /^(.+?[.。　])\s*(.+)$/.exec(tag) ?? /^(\S+)\s+(.+)$/.exec(tag)
    const lines = m ? [m[1].trim(), m[2].trim()] : [tag]
    const F = '600 {s}px "Kaiti SC", "STKaiti", "KaiTi", cursive, serif'
    let fs = 0.0105
    const widest = Math.max(...lines.map((l) => text(g, l, 0, 0, fs, F, true)))
    fs *= Math.min(1, (tw - 0.012) / widest)
    lines.forEach((l, j) => text(g, l, tw / 2 - 0.004, th / 2 + (j - (lines.length - 1) / 2) * fs * 1.15, fs, F))
    g.restore()
  })
}

// ---------- the cat: an orange tabby, about 0.34 long, three poses, facing left ----------
type CatPose = 'loaf' | 'stand' | 'paw' | 'flick'
function catSprite(k: number, pose: CatPose): Sprite {
  return canvas(0.24, 0.24, 0.3, 0.05, k, (g) => {
    const fur = '#E39A4B'
    const dark = '#B5652A'
    const light = '#F6D3A1'
    const stroke = (x: number, y: number, a: number, l: number, c: string, w = 0.0016) => {
      g.strokeStyle = c
      g.lineWidth = w
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      g.stroke()
    }
    // a seeded scatter so the fur is the same in every pose
    let sd = 11
    const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
    const fill = (path: () => void, x0: number, x1: number, y0: number, y1: number) => {
      path()
      const gr = g.createLinearGradient(0, y0, 0, y1)
      gr.addColorStop(0, '#EFAE62')
      gr.addColorStop(0.6, fur)
      gr.addColorStop(1, '#C97A38')
      g.fillStyle = gr
      g.fill()
      g.save()
      path()
      g.clip()
      // tabby stripes, then short strokes of fur
      for (let x = x0; x < x1; x += 0.026) {
        g.strokeStyle = 'rgba(150,75,25,0.55)'
        g.lineWidth = 0.007
        g.beginPath()
        g.moveTo(x, y0)
        g.quadraticCurveTo(x + 0.012, (y0 + y1) / 2, x - 0.004, y1)
        g.stroke()
      }
      for (let j = 0; j < 260; j++) {
        const x = x0 + r() * (x1 - x0)
        const y = y0 + r() * (y1 - y0)
        stroke(x, y, 1.2 + r() * 0.6, 0.006 + r() * 0.006, r() < 0.5 ? 'rgba(255,225,170,0.5)' : 'rgba(140,70,25,0.4)', 0.0012)
      }
      g.restore()
    }
    // the shadow under it is the game's; here only the cat
    const tailTip = (x: number, y: number) => {
      g.strokeStyle = fur
      g.lineWidth = 0.022
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(0.13, y + 0.02)
      g.quadraticCurveTo(0.2, y + 0.02, x, y)
      g.stroke()
      g.strokeStyle = dark
      g.lineWidth = 0.016
      for (const t of [0.35, 0.6, 0.85]) {
        const px = 0.13 + (x - 0.13) * t
        const py = y + 0.02 - 0.02 * t * t
        g.beginPath()
        g.moveTo(px, py - 0.008)
        g.lineTo(px + 0.004, py + 0.008)
        g.stroke()
      }
    }
    const head = (hx: number, hy: number, eyes: 'half' | 'open') => {
      // ears (flick: the far one swivels out flat for a moment)
      for (const s of [-1, 1]) {
        const f = pose === 'flick' && s === 1
        g.beginPath()
        g.moveTo(hx + s * 0.022, hy - 0.03)
        g.lineTo(hx + s * (f ? 0.07 : 0.04), hy - (f ? 0.05 : 0.068))
        g.lineTo(hx + s * 0.05, hy - 0.022)
        g.closePath()
        g.fillStyle = fur
        g.fill()
        g.beginPath()
        g.moveTo(hx + s * 0.03, hy - 0.032)
        g.lineTo(hx + s * (f ? 0.062 : 0.04), hy - (f ? 0.046 : 0.058))
        g.lineTo(hx + s * 0.045, hy - 0.03)
        g.closePath()
        g.fillStyle = '#F2B8A8'
        g.fill()
      }
      fill(() => {
        g.beginPath()
        g.ellipse(hx, hy, 0.058, 0.046, 0, 0, Math.PI * 2)
      }, hx - 0.06, hx + 0.06, hy - 0.05, hy + 0.05)
      // the M on the forehead
      g.strokeStyle = 'rgba(140,65,20,0.7)'
      g.lineWidth = 0.0035
      g.beginPath()
      g.moveTo(hx - 0.018, hy - 0.022)
      g.lineTo(hx - 0.01, hy - 0.036)
      g.lineTo(hx, hy - 0.024)
      g.lineTo(hx + 0.01, hy - 0.036)
      g.lineTo(hx + 0.018, hy - 0.022)
      g.stroke()
      // muzzle
      g.fillStyle = light
      g.beginPath()
      g.ellipse(hx - 0.009, hy + 0.017, 0.017, 0.013, 0, 0, Math.PI * 2)
      g.ellipse(hx + 0.009, hy + 0.017, 0.017, 0.013, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#D9827A'
      g.beginPath()
      g.moveTo(hx - 0.006, hy + 0.007)
      g.lineTo(hx + 0.006, hy + 0.007)
      g.lineTo(hx, hy + 0.013)
      g.closePath()
      g.fill()
      // eyes: half-closed and unimpressed, or open
      for (const s of [-1, 1]) {
        const ex = hx + s * 0.022
        const ey = hy - 0.004
        g.fillStyle = '#C9B23C'
        g.beginPath()
        g.ellipse(ex, ey, 0.009, eyes === 'half' ? 0.0042 : 0.0075, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#1A140C'
        g.beginPath()
        g.ellipse(ex, ey + (eyes === 'half' ? 0.001 : 0), 0.0022, eyes === 'half' ? 0.0032 : 0.0065, 0, 0, Math.PI * 2)
        g.fill()
        if (eyes === 'half') {
          g.fillStyle = fur
          g.beginPath()
          g.ellipse(ex, ey - 0.006, 0.011, 0.0055, 0, 0, Math.PI * 2)
          g.fill()
          g.strokeStyle = 'rgba(90,45,15,0.8)'
          g.lineWidth = 0.0014
          g.beginPath()
          g.moveTo(ex - 0.009, ey - 0.0005)
          g.lineTo(ex + 0.009, ey - 0.0005)
          g.stroke()
        }
      }
      // whiskers
      g.strokeStyle = 'rgba(255,255,255,0.75)'
      g.lineWidth = 0.0008
      for (const s of [-1, 1])
        for (const a of [-0.12, 0.05, 0.2]) {
          g.beginPath()
          g.moveTo(hx + s * 0.02, hy + 0.017)
          g.lineTo(hx + s * 0.07, hy + 0.017 + a * 0.06 * 1)
          g.stroke()
        }
    }
    if (pose === 'loaf' || pose === 'flick' || pose === 'paw') {
      tailTip(0.19, -0.03)
      // the loaf: a long rounded body, paws tucked under
      fill(() => {
        g.beginPath()
        g.moveTo(-0.13, -0.005)
        g.bezierCurveTo(-0.15, -0.09, -0.09, -0.135, 0, -0.135)
        g.bezierCurveTo(0.11, -0.135, 0.16, -0.09, 0.15, -0.02)
        g.bezierCurveTo(0.15, 0.008, 0.1, 0.012, 0, 0.012)
        g.bezierCurveTo(-0.08, 0.012, -0.125, 0.01, -0.13, -0.005)
      }, -0.16, 0.16, -0.14, 0.015)
      // the chest, pale
      g.fillStyle = light
      g.beginPath()
      g.ellipse(-0.09, -0.04, 0.035, 0.04, 0.2, 0, Math.PI * 2)
      g.fill()
      if (pose === 'paw') {
        // one paw out toward the left, reaching
        fill(() => {
          g.beginPath()
          g.moveTo(-0.11, -0.03)
          g.bezierCurveTo(-0.16, -0.035, -0.2, -0.03, -0.215, -0.018)
          g.bezierCurveTo(-0.222, -0.006, -0.21, 0.0, -0.195, -0.002)
          g.bezierCurveTo(-0.16, -0.004, -0.13, -0.006, -0.11, -0.004)
          g.closePath()
        }, -0.23, -0.1, -0.04, 0.005)
        g.fillStyle = light
        g.beginPath()
        g.ellipse(-0.208, -0.01, 0.012, 0.009, 0, 0, Math.PI * 2)
        g.fill()
      } else {
        g.fillStyle = light
        for (const x of [-0.105, -0.07]) {
          g.beginPath()
          g.ellipse(x, 0.004, 0.016, 0.008, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      head(-0.1, -0.14, pose === 'paw' ? 'open' : 'half')
    } else {
      // standing: the body raised on four legs, the tail up
      g.strokeStyle = fur
      g.lineWidth = 0.022
      g.beginPath()
      g.moveTo(0.12, -0.13)
      g.bezierCurveTo(0.17, -0.16, 0.16, -0.25, 0.19, -0.27)
      g.stroke()
      for (const [x, d] of [
        [-0.09, 0],
        [-0.06, 0.008],
        [0.07, 0],
        [0.1, 0.008],
      ]) {
        g.strokeStyle = d ? '#C97A38' : fur
        g.lineWidth = 0.022
        g.beginPath()
        g.moveTo(x, -0.1)
        g.lineTo(x - 0.004, -0.006 + d)
        g.stroke()
        g.fillStyle = light
        g.beginPath()
        g.ellipse(x - 0.004, -0.002 + d, 0.014, 0.007, 0, 0, Math.PI * 2)
        g.fill()
      }
      fill(() => {
        g.beginPath()
        g.moveTo(-0.13, -0.11)
        g.bezierCurveTo(-0.13, -0.17, -0.06, -0.18, 0.02, -0.175)
        g.bezierCurveTo(0.1, -0.17, 0.14, -0.15, 0.135, -0.11)
        g.bezierCurveTo(0.13, -0.08, 0.06, -0.075, 0.0, -0.078)
        g.bezierCurveTo(-0.07, -0.08, -0.13, -0.08, -0.13, -0.11)
      }, -0.14, 0.14, -0.18, -0.07)
      head(-0.13, -0.185, 'open')
    }
  })
}

/** pieces the game needs besides the props: the fish alone (lying on the floor) and the thermos cork */
export function paintExtras(k: number): { fish: Sprite; cork: Sprite; plate: Sprite } {
  const fishOnly = canvas(0.12, 0.12, 0.05, 0.03, k, (g) => fishBody(g))
  const cork = canvas(0.022, 0.022, 0.03, 0.012, k, (g) => {
    g.beginPath()
    g.moveTo(-0.019, 0)
    g.lineTo(-0.016, -0.024)
    g.lineTo(0.016, -0.024)
    g.lineTo(0.019, 0)
    g.closePath()
    g.fillStyle = '#B9864E'
    g.fill()
    ell(g, 0, -0.024, 0.016, 0.016 * E)
    g.fillStyle = '#D2A46C'
    g.fill()
  })
  return { fish: fishOnly, cork, plate: fish(k, false) }
}

export function paintProp(id: PropId, k: number, tag = ''): Sprite[] {
  switch (id) {
    case 'thermos':
      return [thermos(k)]
    case 'heirloom':
      return [heirloom(k, tag)]
    case 'cat':
      return [catSprite(k, 'loaf'), catSprite(k, 'stand'), catSprite(k, 'paw'), catSprite(k, 'flick')]
    case 'cup':
      return [cup(k)]
    case 'bowls':
      return [bowl(k, 0), bowl(k, 1), bowl(k, 2)]
    case 'fish':
      return [fish(k)]
    case 'vase':
      return [vase(k)]
  }
  return [cup(k)]
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
