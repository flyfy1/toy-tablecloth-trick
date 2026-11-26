// Tablecloth Trick: the room, the cloth with the table, the hand, the props with the friction and rocking model,
// the rules (play.ts), falls and breaks, the cat, sound and haptics, the share peak, and the ?shot= states.
import { makeCam, type Cam } from './scene/camera'
import { bakeRoom } from './scene/room'
import { bakePattern, JADE, RED } from './scene/pattern'
import { BOWL_STEP, paintExtras, paintProp, shadowSprite, type Sprite } from './scene/paint'
import { Renderer, type Bill, type PropView, type Stain } from './scene/render'
import { FLOOR, rng, TABLE, World } from './sim'
import { CAT_R, FALL_T, LIE_T, Play, type Ev, type Item, type Line, type Result } from './play'
import type { PropId } from './model/props'
import * as snd from './sound'
import { act, track } from './analytics'
import { tx } from './i18n'
import { live, offer, peakEvery, sharePeak, stats } from './share'

export interface GameHooks {
  onFirst(): void
  onNoGL(): void
  onLine(l: Line): void
  onCount(n: number, s: number): void
  /** the place card: table count n, title 1 to 6, screen position of the table's far edge (css px) */
  onTable(n: number, title: number, x: number, y: number, w: number): void
  /** a result was announced (App: the reply button, the recipient's row) */
  onResult?(r: Result, k: number): void
}

const DEV = import.meta.env.DEV
const Q = new URLSearchParams(location.search)
const SEED = Number(Q.get('seed')) || 7
/** the props are painted at their real size and drawn this much larger (lead, phase 2: they read as specks) */
export const VIS = 1.35
const CAT_VIS = 1.1
const G = 9.81

/** contact shadow half-axes on the table (m, real size) */
const SHADOW: Record<PropId, [number, number]> = {
  cup: [0.07, 0.07],
  bowls: [0.05, 0.05],
  fish: [0.155, 0.1],
  vase: [0.04, 0.04],
  thermos: [0.062, 0.062],
  heirloom: [0.055, 0.05],
  cat: [0.19, 0.1],
}
/** a picture's content box in its canvas (0..1): what the shards are cut from */
const BOX: Partial<Record<PropId, [number, number, number, number]>> = {}

interface Look {
  item: Item
  lie: number // seconds since it toppled
  fallT: number // seconds since it went over an edge
  fv: [number, number] // its speed as it went over
  jitT: number
  jit: [number, number][]
  dropT: number // seconds since it was set down (-1: not yet)
  exitT: number // seconds since the table started to clear (-1: not)
  gone: boolean // broken: its pieces are drawn instead
}

interface Shard {
  id: PropId
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rot: number
  vr: number
  bounced: boolean
  sub: [number, number, number, number]
  tri: [number, number, number, number, number, number]
  sprite?: Sprite // a piece with its own picture (the fish, the cork)
  roll?: number
  alpha: number
  lie?: number // a fixed tilt once it lies (the heirloom's halves)
  anc?: [number, number]
  floorZ?: number // where it lands (default the floor; the heirloom's chips stay on the table)
}

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function startGame(cv: HTMLCanvasElement, hooks: GameHooks) {
  let r: Renderer
  try {
    r = new Renderer(cv)
  } catch {
    hooks.onNoGL()
    return () => {}
  }
  const world = new World(SEED)
  const rnd = rng(SEED * 31 + 5)
  const patterns = { jade: bakePattern(JADE), red: null as HTMLCanvasElement | null }
  let patName: 'jade' | 'red' = 'jade'
  const shadowCv = shadowSprite()
  r.init(world, patterns.jade, shadowCv)
  if (DEV && Q.get('lobe') === 'v') r.strongOnV = true
  let cam: Cam
  let dprCap = DEV && Q.get('dpr') ? Number(Q.get('dpr')) : 2
  let dpr = 1
  let sprites = new Map<PropId, Sprite[]>()
  let texs = new Map<PropId, WebGLTexture[]>()
  let extras: { fish: Sprite; cork: Sprite; plate: Sprite }
  let extraTex: { fish: WebGLTexture; cork: WebGLTexture; plate: WebGLTexture }
  let looks: Look[] = []
  let shards: Shard[] = []
  let stains: (Stain & { grow?: number; fade?: number; target?: number })[] = []

  const ALL: PropId[] = ['cup', 'bowls', 'fish', 'vase', 'thermos', 'heirloom', 'cat']
  const paintAll = () => {
    for (const ts of texs.values()) ts.forEach((t) => r.gl.deleteTexture(t))
    if (extraTex) for (const t of Object.values(extraTex)) r.gl.deleteTexture(t)
    sprites = new Map()
    texs = new Map()
    // twice the on-screen size at the near edge, with the drawing scale
    const k0 = 2 * dpr * cam.scale(cam.project(0, 0.2, 0)[2])
    for (const id of ALL) {
      const k = k0 * (id === 'cat' ? CAT_VIS : VIS)
      const s = paintProp(id, k, tx('yoink_tag_heirloom'))
      // drawn at VIS: the sprite's px per world metre is k / VIS
      for (const sp of s) sp.k = k / (id === 'cat' ? CAT_VIS : VIS)
      sprites.set(id, s)
      texs.set(id, s.map((x) => r.spriteTex(x)))
      BOX[id] = contentBox(s[0].cv)
    }
    extras = paintExtras(k0 * VIS)
    for (const e of Object.values(extras)) e.k /= VIS
    extraTex = { fish: r.spriteTex(extras.fish), cork: r.spriteTex(extras.cork), plate: r.spriteTex(extras.plate) }
  }

  /** the painted part of a canvas (0..1), so shards are cut from the picture rather than its margins */
  function contentBox(c: HTMLCanvasElement): [number, number, number, number] {
    const g = c.getContext('2d')!
    const w = c.width
    const h = c.height
    const d = g.getImageData(0, 0, w, h).data
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 2)
        if (d[(y * w + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    if (x1 <= x0) return [0, 0, 1, 1]
    return [x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h]
  }

  const resize = () => {
    const w = innerWidth
    const h = innerHeight
    dpr = Math.min(devicePixelRatio || 1, dprCap)
    cam = makeCam(w, h)
    cv.style.width = w + 'px'
    cv.style.height = h + 'px'
    r.resize(cam, dpr, bakeRoom(cam, dpr, rng(SEED)))
    paintAll()
    if (play.state !== 'laying' && play.items.length) placeCard()
  }

  // ---------- the rules ----------
  let slowT = -1 // seconds of real time left in the slow-motion beat
  let timeScale = 1
  let snapNow = false
  let shakeT = -1
  let lastShake = -1
  let lastTick = 0
  let counted = false
  const play = new Play(world, SEED, (e) => onEvent(e))
  // a challenge link (?b=<set><k>) starts on that table
  const b = /^([1-6])([0-9])$/.exec(Q.get('b') || '')
  const startSet = b ? Number(b[1]) : 1
  play.rival = b ? Number(b[2]) : -1

  const lookFor = (id: PropId) => looks.find((l) => l.item.prop.id === id)
  const rockDeg = (p: Item['prop'], deg: number) => {
    const t = (deg * Math.PI) / 180
    const dh = p.c.rb * Math.sin(t) + p.c.hc * Math.cos(t) - p.c.hc
    p.om += Math.sqrt((2 * 0.75 * G * dh) / p.R2)
    world.asleep = false
  }
  const haptic = (p: number | number[]) => {
    try {
      navigator.vibrate?.(p)
    } catch {
      /* no vibration */
    }
  }
  let lastTickHaptic = 0

  function onEvent(e: Ev) {
    const now = performance.now()
    switch (e.k) {
      case 'clink':
        snd.clink(e.id, e.ride ? 0.03 : Math.min(0.2, 0.04 + e.g * 0.06))
        if (!e.ride) {
          const l = lookFor(e.id)
          if (l) l.jitT = 0.06
          if (now - lastTickHaptic > 35) {
            lastTickHaptic = now
            haptic(3)
          }
        }
        break
      case 'edge':
        break
      case 'topple':
        snd.topple(e.id)
        break
      case 'spill': {
        const l = lookFor(e.id)
        if (l) {
          const dir = Math.cos(l.item.prop.phi) >= 0 ? 1 : -1
          stains.push({ x: l.item.prop.x + dir * 0.17, y: l.item.prop.y - 0.01, z: 0, rx: 0.01, ry: 0.008, k: 2.2, col: [0.42, 0.33, 0.3], grow: 0, target: 0.1 })
        }
        break
      }
      case 'crash':
        crash(e.id, e.how)
        break
      case 'near':
        if (!REDUCED) {
          slowT = 0.5
          snd.slowMo(true)
        }
        track('near_miss', { item: e.id, pct: e.pct })
        break
      case 'clothOff':
        if (e.v >= 3) snd.snap()
        haptic(16)
        break
      case 'result':
        onResult(e.r, e.data, e.ga)
        break
      case 'line':
        hooks.onLine(e.line)
        break
      case 'cat':
        track('cat', { act: e.act })
        if (e.act === 'jump') setTimeout(() => {
          snd.catLand()
          haptic(14)
        }, 480)
        break
      case 'lay':
        snd.lay()
        shards = []
        stains = []
        looks = []
        // New Year's Eve dinner is laid on the red cloth
        setPattern(play.set === 6 ? 'red' : 'jade')
        break
      case 'drop': {
        syncLooks()
        const l = looks[e.i]
        if (l) l.dropT = 0
        break
      }
      case 'table':
        syncLooks()
        for (const l of looks) if (l.dropT < 0) l.dropT = 1
        act('table')
        placeCard()
        break
      case 'clear':
        for (const l of looks) l.exitT = 0
        for (const s of stains) s.fade = 0
        for (const s of shards) s.alpha = 0.999
        break
      case 'skip':
        track('table_skip', { set: e.set })
        break
    }
  }

  function placeCard() {
    const far = cam.project(0, TABLE.y1, 0)
    const l = cam.project(TABLE.x0, TABLE.y1, 0)
    hooks.onTable(play.count, play.set, far[0], far[1], far[0] - l[0])
  }

  function setPattern(n: 'jade' | 'red') {
    if (n === patName) return
    patName = n
    if (n === 'red' && !patterns.red) patterns.red = bakePattern(RED)
    r.setPattern(n === 'red' ? patterns.red! : patterns.jade)
  }

  /** the looks follow the items (props placed, the cat is drawn apart) */
  function syncLooks() {
    if (looks.length === play.items.length && looks.every((l, i) => l.item === play.items[i])) return
    looks = play.items.map((item) => ({
      item,
      lie: 0,
      fallT: 0,
      fv: [0, 0],
      jitT: 0,
      jit: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      dropT: -1,
      exitT: -1,
      gone: false,
    }))
  }

  function crash(id: PropId, how: 'edge' | 'topple') {
    const l = lookFor(id)
    snd.crash(id)
    haptic([30, 40, 20])
    act('break')
    track('crash', { item: id, how, set: play.set })
    const now = performance.now()
    if (now - lastShake > 200 && !REDUCED) {
      lastShake = now
      shakeT = 0.12
    }
    if (!l) return
    const p = l.item.prop
    const dir = Math.cos(p.phi) >= 0 ? 1 : -1
    if (how === 'topple' && id === 'thermos') {
      // the liner goes inside (the sound); the cork pops out and rolls
      shards.push({ id, x: p.x + dir * 0.34, y: p.y, z: 0.03, vx: dir * 0.5, vy: -0.05, vz: 0.6, rot: 0, vr: dir * 8, bounced: false, sub: [0, 0, 1, 1], tri: [0, 0, 0, 0, 0, 0], sprite: extras.cork, roll: 1, alpha: 1 })
      return
    }
    l.gone = true
    if (how === 'topple' && id === 'heirloom') {
      // it breaks cleanly in two where it lands; the little stand stays where it was
      const bx = p.x
      const still = (x: number, y: number, sub: [number, number, number, number], lie: number, anc: [number, number]) =>
        shards.push({ id, x, y, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, bounced: true, sub, tri: [0, 0, 0, 0, 0, 0], alpha: 1, lie, anc })
      still(bx, p.y, [0, 0.8, 1, 0.2], 0, [0.5, 0.6])
      still(bx + dir * 0.06, p.y - 0.005, [0, 0.47, 1, 0.37], dir * (Math.PI / 2 - 0.1), [0.5, 1])
      still(bx + dir * 0.33, p.y - 0.02, [0, 0.07, 1, 0.4], dir * (Math.PI / 2 + 0.3), [0.5, 1])
      // and a few chips from the break
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2
        shards.push({ id, x: bx + dir * 0.27, y: p.y, z: 0.02, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.3, vz: 0.5, rot: rnd() * 6, vr: (rnd() - 0.5) * 20, bounced: false, sub: [0.3 + rnd() * 0.3, 0.45, 0.12, 0.05], tri: [0, 0, 1, 0.2, 0.4, 1], alpha: 1, floorZ: 0 })
      }
      return
    }
    // over an edge: on the floor, 8 to 14 triangular shards fly up and out, bounce once and lie still
    const fx = p.x + l.fv[0] * FALL_T * 0.5
    const fy = p.y + l.fv[1] * FALL_T * 0.5
    const box = BOX[id] ?? [0, 0, 1, 1]
    const nx = 3
    const ny = id === 'fish' ? 2 : 3
    const tris: Shard[] = []
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const sub: [number, number, number, number] = [box[0] + (box[2] * i) / nx, box[1] + (box[3] * j) / ny, box[2] / nx, box[3] / ny]
        // each cell in two triangles along a random diagonal, a little jagged
        const jg = () => 0.1 * (rnd() - 0.5)
        const d = rnd() < 0.5
        const ts: [number, number, number, number, number, number][] = d
          ? [
              [0, 0, 1 + jg(), 0, 0, 1 + jg()],
              [1, 0, 1, 1, 0 + jg(), 1],
            ]
          : [
              [0, 0, 1, 0, 1 + jg(), 1],
              [0, 0, 1, 1, 0, 1 + jg()],
            ]
        for (const tri of ts) {
          const a = rnd() * Math.PI * 2
          const sp = 0.8 + rnd() * 1.6
          tris.push({ id, x: fx + (rnd() - 0.5) * 0.04, y: fy + (rnd() - 0.5) * 0.03, z: FLOOR + 0.02, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 0.6 + rnd() * 1.4, rot: rnd() * 6, vr: (rnd() - 0.5) * 24, bounced: false, sub, tri, alpha: 1 })
        }
      }
    // 8 to 14 of them
    const keep = 8 + Math.floor(rnd() * 7)
    while (tris.length > keep) tris.splice(Math.floor(rnd() * tris.length), 1)
    shards.push(...tris)
    if (id === 'fish') {
      // the plate breaks; the fish lies on the floor, whole
      shards.push({ id, x: fx + 0.02, y: fy - 0.03, z: FLOOR, vx: 0, vy: 0, vz: 0, rot: 0.15, vr: 0, bounced: true, sub: [0, 0, 1, 1], tri: [0, 0, 0, 0, 0, 0], sprite: extras.fish, alpha: 1 })
    }
    // the liquid: a tea-brown or clear splat of 6 blobs
    const col: [number, number, number] | null = id === 'cup' ? [0.71, 0.4, 0.11] : id === 'vase' ? [0.55, 0.55, 0.58] : id === 'fish' ? [0.4, 0.2, 0.06] : null
    if (col)
      for (let i = 0; i < 6; i++) {
        const a = rnd() * Math.PI * 2
        const rr = 0.02 + rnd() * 0.07
        stains.push({ x: fx + Math.cos(a) * rr, y: fy + Math.sin(a) * rr * 0.7, z: FLOOR, rx: 0.004, ry: 0.003, k: 2.2, col, grow: 0, target: 0.02 + rnd() * 0.035 })
      }
  }

  function onResult(res: Result, data: Record<string, number>, ga: Record<string, number | string>) {
    track('pull', ga)
    stats.n = play.pulls
    stats.k = play.perfects
    if (res === 'perfect') {
      snd.perfect()
      haptic([10, 60, 10])
    }
    if (res === 'perfect' || res === 'close') act('clean')
    if (!counted || res !== 'ride') {
      counted = true
      hooks.onCount(play.count, play.streak)
    }
    hooks.onResult?.(res, data.k)
    // the share peak: the snapshot is copied in this frame (after it is drawn)
    if (play.pendingSnap) {
      play.pendingSnap = false
      snapNow = true
      peakData = { ...data }
      peakKind = 'peak'
    } else if (res === 'perfect') {
      snapNow = true
      peakData = { ...data }
      peakKind = 'every'
    }
  }
  let peakData: Record<string, number> = {}
  let peakKind: 'peak' | 'every' = 'every'
  live.data = () => play.data()

  /** the snapshot for the card: the table and the floor in front of it */
  function takeSnap(): HTMLCanvasElement {
    const top = Math.max(0, cam.project(0, TABLE.y1 + 0.05, 0.35)[1] - 30)
    const W = cv.width
    const H = cv.height
    const y0 = Math.round(top * dpr)
    const h = Math.min(H - y0, Math.round(W * 1.25))
    const c = document.createElement('canvas')
    const sc = Math.min(1, 900 / W)
    c.width = Math.round(W * sc)
    c.height = Math.round(h * sc)
    c.getContext('2d')!.drawImage(cv, 0, y0, W, h, 0, 0, c.width, c.height)
    return c
  }

  // the place where a hidden pull's ripples were tapped
  function dimple(sx: number, sy: number) {
    const x = world.cloth.x
    const p = world.cloth.p
    const pt = [0, 0, 0]
    let best = -1
    let bd = 30 * 30
    for (let i = 0; i < world.cloth.n; i++) {
      const a = i * 3
      if (x[a + 2] < -0.01) continue
      cam.project(x[a], x[a + 1], x[a + 2], pt)
      const d = (pt[0] - sx) ** 2 + (pt[1] - sy) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (best < 0) return false
    const cx = x[best * 3]
    const cy = x[best * 3 + 1]
    const h = 1 / 600
    for (let i = 0; i < world.cloth.n; i++) {
      const a = i * 3
      const rr = Math.hypot(x[a] - cx, x[a + 1] - cy)
      if (rr > 0.06 || x[a + 2] < -0.01) continue
      // a press: the ring round the finger lifts, the centre stays (it ripples out as it falls)
      p[a + 2] = x[a + 2] - 0.35 * Math.sin((rr / 0.06) * Math.PI) * h
    }
    world.asleep = false
    return true
  }

  // ---------- views ----------
  const propViews = (dt: number): PropView[] => {
    const out: PropView[] = []
    for (const l of looks) {
      const p = l.item.prop
      if (l.gone || l.dropT < 0) continue
      let z = 0.002
      let x = p.x
      let y = p.y
      let rot = 0
      let squash = 1
      let alpha = 1
      let shadowK = 1
      const th = p.th
      let pivot = 1
      if (l.item.fate === 'falling' || p.off) {
        // tips over the lip (120 ms), then falls to the floor, turning
        if (l.fallT === 0) l.fv = [p.vx, p.vy]
        l.fallT += dt
        const t = l.fallT
        const side = p.x > TABLE.x1 - 0.01 ? 1 : p.x < TABLE.x0 + 0.01 ? -1 : 0
        x += l.fv[0] * Math.min(t, FALL_T) * 0.5
        y += l.fv[1] * Math.min(t, FALL_T) * 0.5
        z = Math.max(FLOOR, -0.5 * G * Math.max(0, t - 0.12) ** 2)
        rot = Math.min(1, t / 0.12) * 0.5 * (side || 0.4) + Math.max(0, t - 0.12) * 5 * (side || 0.6)
        shadowK = 0
      } else if (p.toppled) {
        l.lie += dt
        const e = Math.min(1, l.lie / LIE_T)
        const dir = Math.cos(p.phi) >= 0 ? 1 : -1
        rot = dir * (p.thc + (Math.PI / 2 - 0.15 - p.thc) * e * e)
        pivot = dir
        shadowK = 0.5
      } else {
        rot = th * Math.cos(p.phi)
        squash = 1 - 0.5 * th * Math.sin(p.phi)
        pivot = rot >= 0 ? 1 : -1
        shadowK = 1 - Math.min(0.6, th * 2)
      }
      // coming down onto the new table, or lifting away at the end
      if (l.dropT >= 0 && l.dropT < 0.2) {
        const was = l.dropT
        l.dropT += dt
        const e = Math.min(1, l.dropT / 0.18)
        z += 0.7 * (1 - e * e)
        shadowK *= e
        if (was < 0.18 && l.dropT >= 0.18) {
          snd.clink(p.id, 0.12)
          rockDeg(p, 1)
        }
      }
      if (l.exitT >= 0) {
        const i = looks.indexOf(l)
        const e = Math.max(0, Math.min(1, (l.exitT - i * 0.06) / 0.2))
        l.exitT += dt
        z += 2.2 * e * e
        shadowK *= 1 - e
      }
      if (l.jitT > 0) {
        l.jitT -= dt
        for (let i = 1; i < 3; i++) l.jit[i] = [(rnd() - 0.5) * 1.0, (rnd() - 0.5) * 0.6]
      } else for (const j of l.jit) (j[0] = 0), (j[1] = 0)
      const lifts = p.id === 'bowls' ? [0, BOWL_STEP, BOWL_STEP * 2] : [0]
      const sh = SHADOW[p.id]
      out.push({
        sprites: sprites.get(p.id)!,
        tex: texs.get(p.id)!,
        lift: lifts,
        jit: l.jit,
        x,
        y,
        z,
        rot,
        squash,
        pivot,
        rb: p.c.rb,
        shadow: [sh[0] * VIS * (1 - 0.2 * Math.min(1, th * 3)), sh[1] * VIS],
        lean: p.toppled || p.off ? [0, 0] : [VIS * p.c.hc * Math.sin(th) * Math.cos(p.phi), VIS * p.c.hc * Math.sin(th) * Math.sin(p.phi)],
        shadowK,
        alpha,
        vis: VIS,
      })
    }
    // the cat
    const cs = catView()
    if (cs) out.push(cs)
    return out
  }

  function catView(): PropView | null {
    const st = play.catState
    if (st === 'none' || st === 'gone') return null
    const sp = sprites.get('cat')!
    const tx_ = texs.get('cat')!
    const t = play.catT
    let x = 0
    let y = 0
    let z = 0.002
    let pose = 0 // loaf, stand, paw
    let flip = play.catFace > 0
    let shadowK = 1
    if (st === 'jump') {
      const e = Math.min(1, t / 0.5)
      x = play.catFrom[0] + (play.catTo[0] - play.catFrom[0]) * e
      y = play.catFrom[1] + (play.catTo[1] - play.catFrom[1]) * e
      z = -0.75 + 0.75 * e + 0.45 * Math.sin(e * Math.PI)
      pose = 1
      shadowK = e > 0.85 ? 1 : 0
      flip = false
    } else if (st === 'leave') {
      const e = Math.min(1, t / 0.9)
      x = play.catFrom[0] + (0.8 - play.catFrom[0]) * e
      y = play.catFrom[1]
      z = e < 0.4 ? 0.002 : 0.002 + 0.25 * Math.sin(((e - 0.4) / 0.6) * Math.PI) - 0.75 * ((e - 0.4) / 0.6) ** 2
      pose = 1
      flip = true
      shadowK = e < 0.4 ? 1 : 0
    } else {
      const c = play.cat
      if (!c) return null
      x = c.x
      y = c.y
      if (st === 'land') {
        // it turns round once, then settles into a loaf
        pose = 1
        flip = t > 0.3 && t < 0.6
      } else if (st === 'paw') {
        pose = 2
      } else pose = performance.now() - flickAt < 260 ? 3 : 0
    }
    if (!flip) flip = false
    for (const l of looks) if (l.exitT >= 0) z += 2.2 * Math.min(1, l.exitT / 0.3) ** 2 / looks.length
    return {
      sprites: [sp[pose]],
      tex: [tx_[pose]],
      lift: [0],
      jit: [[0, 0]],
      x,
      y,
      z,
      rot: 0,
      squash: 1,
      pivot: 1,
      rb: CAT_R,
      shadow: [SHADOW.cat[0] * CAT_VIS, SHADOW.cat[1] * CAT_VIS],
      lean: [0, 0],
      shadowK,
      alpha: 1,
      vis: CAT_VIS,
      flip,
    }
  }

  const billViews = (dt: number): Bill[] => {
    const out: Bill[] = []
    for (const s of shards) {
      if (!s.bounced || s.roll) {
        s.vz -= G * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.z += s.vz * dt
        s.rot += s.vr * dt
        const onTable = Math.abs(s.x) < TABLE.x1 && s.y > 0 && s.y < TABLE.y1
        const floor = s.roll || s.floorZ !== undefined ? (onTable ? (s.floorZ ?? 0) : FLOOR) : FLOOR
        if (s.z < floor) {
          s.z = floor
          if (s.roll) {
            s.vz = 0
            s.vx *= 1 - 2.5 * dt
            s.vy *= 1 - 2.5 * dt
            s.vr = (s.vx / 0.02) * 0.6
            if (Math.abs(s.vx) < 0.02) s.roll = 0
          } else if (!s.bounced) {
            s.bounced = true
            s.vz = -s.vz * 0.3
            s.vx *= 0.3
            s.vy *= 0.3
            s.vr *= 0.3
            if (s.vz < 0.05) s.vz = 0
            s.bounced = s.vz === 0
            if (!s.bounced) s.roll = 0
          }
        }
      }
      if (s.alpha < 1) s.alpha = Math.max(0, s.alpha - dt / 0.3)
      const plate = s.id === 'fish' && !s.sprite
      const spr = s.sprite ?? (plate ? extras.plate : sprites.get(s.id)![0])
      const tex = s.sprite === extras.fish ? extraTex.fish : s.sprite === extras.cork ? extraTex.cork : plate ? extraTex.plate : texs.get(s.id)![0]
      const shard = !s.sprite && s.tri[4] + s.tri[2] + s.tri[3] > 0
      out.push({
        sprite: spr,
        tex,
        x: s.x,
        y: s.y,
        z: s.z - (s.alpha < 1 ? 0.06 * (1 - s.alpha) : 0),
        rot: s.lie ?? s.rot,
        vis: VIS,
        alpha: s.alpha,
        sub: s.sprite ? undefined : s.sub,
        // (the fish's shards come from the plate alone: the fish itself lies whole beside them)
        tri: shard ? s.tri : undefined,
        anc: s.sprite ? undefined : (s.anc ?? [0.5, 0.6]),
      })
    }
    shards = shards.filter((s) => s.alpha > 0)
    return out
  }

  const stainViews = (dt: number): Stain[] => {
    for (const s of stains) {
      if (s.target !== undefined && s.grow !== undefined && s.grow < 1) {
        s.grow = Math.min(1, s.grow + dt / 0.5)
        const e = 1 - (1 - s.grow) ** 3
        s.rx = 0.004 + (s.target - 0.004) * e
        s.ry = s.rx * 0.7
      }
      if (s.fade !== undefined) {
        s.fade += dt
        s.k = Math.max(0, 2.2 * (1 - s.fade / 0.3))
      }
    }
    stains = stains.filter((s) => s.k > 0)
    return stains
  }

  // ---------- input ----------
  let first = true
  let down: { id: number; x: number; y: number } | null = null
  let stamp = -1
  const harness = {
    freeze: () => (frozen = true),
    advance: (dt: number) => {
      const n = Math.max(1, Math.round(dt / (1 / 60)))
      for (let i = 0; i < n; i++) tick(dt / n)
      draw(dt)
    },
    seed: SEED,
    inputToDrawMs: -1,
    degrade: 0,
    simMs: 0,
    drawCalls: 0,
    world,
    play,
    ready: false,
    cam: () => cam,
    loseContext: () => r.gl.getExtension('WEBGL_lose_context'),
    state: () => ({
      t: world.time,
      hand: world.hand,
      stretch: world.cloth.maxStretch(),
      clothOff: world.clothOffTime,
      play: play.state,
      set: play.set,
      cat: play.catState,
      props: world.props.map((p) => ({ id: p.id, x: p.x, y: p.y, moved: p.moved, th: p.th, peak: p.peak, toppled: p.toppled, off: p.off, on: p.on })),
    }),
  }
  ;(window as unknown as { __toy: typeof harness }).__toy = harness

  /** the drape's screen box (css px), for grabbing */
  const drapeBox = () => {
    const x = world.cloth.x
    let x0 = 1e9
    let x1 = -1e9
    let y0 = 1e9
    let y1 = -1e9
    const pt = [0, 0, 0]
    for (let i = 0; i < world.cloth.n; i++) {
      const a = i * 3
      if (x[a + 1] > 0.02) continue // only the part in front of the near edge
      cam.project(x[a], x[a + 1], x[a + 2], pt)
      x0 = Math.min(x0, pt[0])
      x1 = Math.max(x1, pt[0])
      y0 = Math.min(y0, pt[1])
      y1 = Math.max(y1, pt[1])
    }
    return { x0: x0 - 24, x1: x1 + 24, y0: y0 - 24, y1: y1 + 24 }
  }
  const hitProp = (sx: number, sy: number) => {
    for (const l of looks) {
      const p = l.item.prop
      if (l.gone || p.off) continue
      const s = cam.project(p.x, p.y, 0)
      const sc = cam.scale(s[2]) * VIS
      if (Math.abs(sx - s[0]) < p.c.w * 0.5 * sc + 4 && sy < s[1] + 8 && sy > s[1] - p.c.h * sc - 4) return l
    }
    return null
  }
  // portals: the cat waiting on a set table (to purr), the shards of Mum's bowls on the floor (to smash)
  let flickAt = -1e9
  const catAt = (): [number, number] | null => {
    const c = play.cat
    if (!c || play.state !== 'ready' || play.catState !== 'loaf') return null
    const s = cam.project(c.x, c.y, 0)
    return [s[0], s[1] - c.c.h * cam.scale(s[2]) * CAT_VIS]
  }
  const bowlShards = () => (play.state === 'done' ? shards.filter((s) => s.id === 'bowls' && s.bounced && !s.roll && s.alpha >= 1).map((s) => ({ s, p: cam.project(s.x, s.y, s.z) })) : [])
  /** a shard of the bowls on screen (tests) */
  const bowlAt = (): [number, number] | null => {
    const b = bowlShards().find((x) => x.p[0] > 40 && x.p[0] < cam.w - 40 && x.p[1] > 80 && x.p[1] < innerHeight - 100)
    return b ? [b.p[0], b.p[1]] : null
  }
  // (tests: where the portal objects are now)
  if (import.meta.env.DEV) Object.assign(harness, { catAt, bowlAt, shards: () => shards })
  const onDown = (e: PointerEvent) => {
    if (down) return
    snd.unlock()
    if (first) {
      first = false
      hooks.onFirst()
    }
    stamp = performance.now()
    // the waiting cat (in front of the props it sits by): a tap flicks an ear (only that); the 2nd may show the bubble
    const ca = catAt()
    const c = play.cat
    if (ca && c) {
      const s = cam.project(c.x, c.y, 0)
      // (its box takes in the plate it sits by: over a prop, only its head and back count as the cat)
      const onCat = Math.abs(e.clientX - s[0]) < c.c.w * 0.5 * cam.scale(s[2]) * CAT_VIS + 6 && e.clientY < s[1] + 8 && e.clientY > ca[1] - 6
      if (onCat && (!hitProp(e.clientX, e.clientY) || e.clientY < ca[1] + (s[1] - ca[1]) * 0.55)) {
        flickAt = performance.now()
        offer('yoink', 'cat', catAt)
        return
      }
    }
    // a touch on a prop rocks it a degree (and saves it from the cat's paw)
    const l = hitProp(e.clientX, e.clientY)
    if (l) {
      rockDeg(l.item.prop, 1)
      snd.clink(l.item.prop.id, 0.1)
      play.tapProp(l.item.prop)
      return
    }
    const b = drapeBox()
    if (play.grabbable() && e.clientX >= b.x0 && e.clientX <= b.x1 && e.clientY >= b.y0 && e.clientY <= b.y1) {
      const wx = (e.clientX - cam.w / 2) / cam.scale(cam.project(0, 0, -0.2)[2])
      world.grab(world.nearestHem(wx))
      play.onGrab()
      act('pull')
      down = { id: e.pointerId, x: e.clientX, y: e.clientY }
      cv.setPointerCapture?.(e.pointerId)
      snd.pinch()
      haptic(8)
      return
    }
    // the bowls' shards: they clink and shift, and the table stays (up to 8 s more); the 2nd tap may show the bubble
    const hit = bowlShards().filter((x) => Math.hypot(x.p[0] - e.clientX, x.p[1] - e.clientY) < 34)
    if (hit.length) {
      for (const { s } of hit) s.rot += (Math.random() - 0.5) * 0.5 // not rnd(): the seeded sequence stays as it was
      snd.clink('bowls', 0.12)
      haptic(6)
      play.hold(8)
      const s0 = hit[0].s
      offer('yoink', 'bowl', () => (play.state === 'done' && shards.includes(s0) ? (cam.project(s0.x, s0.y, s0.z).slice(0, 2) as [number, number]) : null))
      return
    }
    // the table is done: a tap lays the next one at once
    if (play.state === 'done') {
      play.advance()
      return
    }
    dimple(e.clientX, e.clientY)
  }
  const onMove = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return
    const Spull = 0.99 * cam.Wt
    world.moveHand((e.clientY - down.y) / Spull, (e.clientX - down.x) / (cam.Wt / 0.8))
    if (e.clientY >= innerHeight - 2) onUp(e)
  }
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return
    down = null
    world.release()
  }
  cv.addEventListener('pointerdown', onDown)
  addEventListener('pointermove', onMove)
  addEventListener('pointerup', onUp)
  addEventListener('pointercancel', onUp)
  addEventListener('resize', resize)
  let sentPulls = -1
  const onHide = () => {
    if (!document.hidden || !play.pulls || sentPulls === play.pulls) return
    sentPulls = play.pulls
    track('session_pulls', { n: play.pulls, perfects: play.perfects, broke: play.brokeTotal, best_set: play.bestSet })
  }
  document.addEventListener('visibilitychange', onHide)
  addEventListener('pagehide', onHide)

  // ---------- the loop ----------
  let frozen = false
  let raf = 0
  let last = performance.now()
  let idleAcc = 0
  const ft: number[] = []
  let slow = 0
  let lost = false
  let travel = 0
  const degradeStep = () => {
    harness.degrade++
    if (harness.degrade === 1) {
      dprCap = 1.5
      resize()
    } else if (harness.degrade === 2) {
      r.shadowDiv = 8
      r.blurPasses = 1
      r.makeTargets()
    } else if (harness.degrade === 3) world.S = Math.max(6, Math.round((world.S * 2) / 3))
  }
  /** the cloth's speed over the table top (m/s), for the hiss and the pulses */
  const clothSpeed = () => {
    const x = world.cloth.x
    const p = world.cloth.p
    const h = 1 / (60 * world.S)
    let s = 0
    let n = 0
    for (let i = 0; i < world.cloth.n; i += 3) {
      const a = i * 3
      if (x[a + 2] < -0.006 || x[a + 1] < 0 || x[a + 1] > TABLE.y1 || Math.abs(x[a]) > TABLE.x1) continue
      s += Math.hypot(x[a] - p[a], x[a + 1] - p[a + 1]) / h
      n++
    }
    return n ? s / n : 0
  }
  const tick = (dt: number) => {
    const t0 = performance.now()
    play.step(dt)
    if (play.autoNextDue()) play.advance()
    harness.simMs = performance.now() - t0
  }
  const draw = (dt: number) => {
    harness.drawCalls = r.draw(world, propViews(dt), billViews(dt), stainViews(dt))
    if (snapNow) {
      snapNow = false
      const snap = takeSnap()
      if (peakKind === 'peak') sharePeak('yoink', { snap, data: peakData })
      else peakEvery('yoink', play.perfects, { snap, data: peakData })
    }
  }
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    let dt = Math.min(1 / 30, (now - last) / 1000)
    if (dt <= 0 || lost) return
    if (frozen) {
      last = now
      return
    }
    // idle: the solver sleeps and the picture refreshes at 20 fps
    const busy = shards.some((s) => !s.bounced || s.roll || s.alpha < 1) || stains.some((s) => (s.grow ?? 1) < 1 || s.fade !== undefined) || play.state === 'laying' || play.state === 'done' || play.catState !== 'loaf' && play.catState !== 'none' && play.catState !== 'gone'
    if (world.asleep && !down && !busy && shakeT < 0) {
      idleAcc += now - last
      last = now
      if (idleAcc < 50) return
      idleAcc = 0
    } else last = now
    // the slow-motion beat: 0.35 for up to 500 ms of real time (in 60 ms, out 120 ms)
    if (slowT > 0) {
      slowT -= dt
      const into = 0.5 - slowT
      timeScale = into < 0.06 ? 1 - 0.65 * (into / 0.06) : slowT < 0.12 ? 0.35 + 0.65 * (1 - slowT / 0.12) : 0.35
      if (slowT <= 0) {
        timeScale = 1
        snd.slowMo(false)
      }
    }
    const sdt = dt * timeScale
    tick(sdt)
    draw(sdt)
    // the silk's hiss and the pulses while it runs
    const v = clothSpeed()
    snd.silkAt(world.clothOffTime >= 0 && world.hand === 'none' ? 0 : v)
    travel += v * sdt
    if (travel > 0.05 && now - lastTick > 30) {
      travel = 0
      lastTick = now
      haptic(4)
    }
    if (shakeT > 0) {
      shakeT -= dt
      const a = shakeT > 0 ? 5 * (shakeT / 0.12) : 0
      cv.style.transform = a ? `translate(${(rnd() - 0.5) * 2 * a}px,${(rnd() - 0.5) * 2 * a}px)` : ''
      if (shakeT <= 0) shakeT = -1
    }
    if (stamp >= 0) {
      harness.inputToDrawMs = performance.now() - stamp
      stamp = -1
    }
    // degrade path: mean frame time over 30 frames, over 20 ms twice in a row takes the next step
    ft.push(dt * 1000)
    if (ft.length === 30) {
      const m = ft.reduce((a, b) => a + b, 0) / 30
      ft.length = 0
      slow = m > 20 ? slow + 1 : 0
      if (slow >= 2 && harness.degrade < 3) {
        slow = 0
        degradeStep()
      }
    }
  }

  // ---------- a lost GL context: stop, then rebuild everything GL held when it comes back ----------
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
  }
  const onRestored = () => {
    r.init(world, patName === 'red' && patterns.red ? patterns.red : patterns.jade, shadowCv)
    resize()
    lost = false
    last = performance.now()
  }
  cv.addEventListener('webglcontextlost', onLost)
  cv.addEventListener('webglcontextrestored', onRestored)

  resize()
  // ---------- ?shot= states (dev harness): scripted, stepped, frozen ----------
  const shot = DEV ? Q.get('shot') : null
  if (shot) {
    frozen = true
    runShot(shot)
    draw(1 / 60)
  } else {
    play.lay(startSet, true)
    syncLooks()
    for (const l of looks) l.dropT = 1
    raf = requestAnimationFrame(frame)
  }
  harness.ready = true

  function runShot(name: string) {
    const table = Number(Q.get('table')) || 0
    const run = (s: number, each?: (i: number) => boolean | void) => {
      const n = Math.round(s * 60)
      for (let i = 0; i < n; i++) {
        tick(1 / 60)
        propViews(1 / 60)
        billViews(1 / 60)
        stainViews(1 / 60)
        if (each && each(i)) break
      }
    }
    const lay = (n: number) => {
      play.allowCat = Q.get('cat') === '1' || n === 6
      play.lay(n, true)
      syncLooks()
      for (const l of looks) l.dropT = 1
    }
    const pull = (v: number, ms: number, ramp = v > 2 ? 0.06 : 0.3) => {
      world.grab(world.nearestHem(Number(Q.get('gx')) || 0))
      play.onGrab()
      const drive = world.scriptPull(v, ramp, Number(Q.get('travel')) || 1)
      run(ms / 1000, () => {
        if (drive(1 / 60) === 'release') world.release()
      })
    }
    switch (name) {
      case 'rest':
        lay(table || 2)
        break
      case 'taut': {
        lay(table || 2)
        world.grab(world.nearestHem(0))
        for (let i = 1; i <= 4; i++) {
          world.moveHand((0.08 * i) / 4, 0)
          world.step(0.01)
        }
        break
      }
      case 'whip':
        lay(table || 2)
        pull(Number(Q.get('v')) || 6, Q.has('t') ? Number(Q.get('t')) : 100)
        break
      case 'pull':
        lay(table || 2)
        pull(Number(Q.get('v')) || 3, Number(Q.get('t')) || 500)
        break
      case 'clean': {
        // a clean flick, framed after everything settled (the bells)
        lay(table || 1)
        pull(Number(Q.get('v')) || 5, Number(Q.get('t')) || 1600)
        break
      }
      case 'disaster': {
        // a slow drag: the table rides to the edge and goes over, one piece at a time
        lay(table || 2)
        pull(Number(Q.get('v')) || 0.5, Number(Q.get('t')) || 3600, 0.3)
        break
      }
      case 'topple':
        lay(table || 4)
        pull(Number(Q.get('v')) || 1.6, Number(Q.get('t')) || 900)
        break
      case 'cat': {
        lay(table || 6)
        break
      }
      case 'catjump': {
        play.allowCat = true
        play.lay(table || 6)
        run(Number(Q.get('t')) / 1000 || 2.2)
        break
      }
      case 'lay': {
        play.lay(table || 2)
        run((Number(Q.get('t')) || 250) / 1000)
        break
      }
      case 'og': {
        // the link preview: table 2, the cloth half out, the bowls in the air by a hair
        lay(2)
        pull(3.2, Number(Q.get('t')) || 140)
        const bw = lookFor('bowls')
        if (bw) bw.item.prop.th = 0.02
        break
      }
    }
  }

  return () => {
    cancelAnimationFrame(raf)
    cv.removeEventListener('pointerdown', onDown)
    removeEventListener('pointermove', onMove)
    removeEventListener('pointerup', onUp)
    removeEventListener('pointercancel', onUp)
    removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onHide)
    removeEventListener('pagehide', onHide)
    cv.removeEventListener('webglcontextlost', onLost)
    cv.removeEventListener('webglcontextrestored', onRestored)
  }
}
