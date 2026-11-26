// Tablecloth Trick, phase 1: the room, the cloth with the table, the hand, the cup, bowls, fish and vase
// with the friction and rocking model, and the ?shot= states for the stills gate (tablecloth.md section 10).
import { makeCam, type Cam } from './scene/camera'
import { bakeRoom } from './scene/room'
import { bakePattern, JADE } from './scene/pattern'
import { BOWL_STEP, paintProp, shadowSprite, type Sprite } from './scene/paint'
import { Renderer, type PropView } from './scene/render'
import { FLOOR, LAYOUTS, rng, WOBBLE_LAYOUT, World } from './sim'
import type { Prop, PropId } from './model/props'

export interface GameHooks {
  onFirst(): void
  onNoGL(): void
}

const DEV = import.meta.env.DEV
const Q = new URLSearchParams(location.search)
const SEED = Number(Q.get('seed')) || 7

/** contact shadow half-axes on the table (m) */
const SHADOW: Record<PropId, [number, number]> = {
  cup: [0.07, 0.07],
  bowls: [0.05, 0.05],
  fish: [0.155, 0.1],
  vase: [0.04, 0.04],
  thermos: [0.058, 0.058],
  heirloom: [0.034, 0.034],
  cat: [0.2, 0.11],
}

interface Look {
  prop: Prop
  sprites: Sprite[]
  tex: WebGLTexture[]
  lie: number // seconds since it toppled
  fallT: number // seconds since it went over an edge
  jitT: number
  jit: [number, number][]
}

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
  const pattern = bakePattern(JADE)
  r.init(world, pattern, shadowSprite())
  if (DEV && Q.get('lobe') === 'v') r.strongOnV = true
  let cam: Cam
  let dprCap = DEV && Q.get('dpr') ? Number(Q.get('dpr')) : 2
  let dpr = 1
  let sprites = new Map<PropId, Sprite[]>()
  let texs = new Map<PropId, WebGLTexture[]>()
  let looks: Look[] = []

  const paintAll = () => {
    for (const ts of texs.values()) ts.forEach((t) => r.gl.deleteTexture(t))
    sprites = new Map()
    texs = new Map()
    // twice the on-screen size at the near edge
    const k = 2 * dpr * cam.scale(cam.project(0, 0.2, 0)[2])
    for (const id of ['cup', 'bowls', 'fish', 'vase'] as PropId[]) {
      const s = paintProp(id, k)
      sprites.set(id, s)
      texs.set(id, s.map((x) => r.spriteTex(x)))
    }
    for (const l of looks) {
      l.sprites = sprites.get(l.prop.id)!
      l.tex = texs.get(l.prop.id)!
    }
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
  }
  resize()

  const setTable = (n: number) => {
    world.setProps(n === 0 ? WOBBLE_LAYOUT : LAYOUTS[n - 1])
    looks = world.props.map((p) => ({
      prop: p,
      sprites: sprites.get(p.id) ?? sprites.get('cup')!,
      tex: texs.get(p.id) ?? texs.get('cup')!,
      lie: 0,
      fallT: 0,
      jitT: 0,
      jit: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    }))
    for (const l of looks)
      l.prop.onTouch = () => {
        l.jitT = 0.06
      }
  }

  // ---------- the rest state: a cloth laid by the solver, cached ----------
  const settle = () => {
    world.layFlat()
    for (let i = 0; i < 180; i++) world.step(1 / 60)
  }
  settle()
  setTable(2)

  // ---------- views ----------
  const views = (dt: number): PropView[] =>
    looks.map((l) => {
      const p = l.prop
      let z = 0.002
      let rot = 0
      let squash = 1
      let alpha = 1
      let shadowK = 1
      const th = p.th
      let pivot = 1
      if (p.off) {
        // phase 1: over the edge it tips and drops to the floor (no breaking yet)
        l.fallT += dt
        const t = l.fallT
        z = Math.max(FLOOR, -0.5 * 9.81 * Math.max(0, t - 0.12) ** 2)
        rot = Math.min(1.4, t * 6) * (p.x > 0.38 ? 1 : p.x < -0.38 ? -1 : 0.4)
        shadowK = 0
      } else if (p.toppled) {
        l.lie += dt
        const e = Math.min(1, l.lie / 0.35)
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
      if (l.jitT > 0) {
        l.jitT -= dt
        for (let i = 1; i < 3; i++) l.jit[i] = [(rnd() - 0.5) * 1.0, (rnd() - 0.5) * 0.6]
      } else for (const j of l.jit) (j[0] = 0), (j[1] = 0)
      const lifts = p.id === 'bowls' ? [0, BOWL_STEP, BOWL_STEP * 2] : [0]
      const sh = SHADOW[p.id]
      return {
        sprites: l.sprites,
        tex: l.tex,
        lift: lifts,
        jit: l.jit,
        x: p.x,
        y: p.y,
        z,
        rot,
        squash,
        pivot,
        rb: p.c.rb,
        shadow: [sh[0] * (1 - 0.2 * Math.min(1, th * 3)), sh[1]],
        lean: p.toppled || p.off ? [0, 0] : [p.c.hc * Math.sin(th) * Math.cos(p.phi), p.c.hc * Math.sin(th) * Math.sin(p.phi)],
        shadowK,
        alpha,
      }
    })

  // ---------- input ----------
  let first = true
  let down: { id: number; x: number; y: number } | null = null
  let stamp = -1
  const harness = {
    freeze: () => (frozen = true),
    advance: (dt: number) => {
      const n = Math.max(1, Math.round(dt / (1 / 60)))
      for (let i = 0; i < n; i++) tick(dt / n)
      draw(0)
    },
    seed: SEED,
    inputToDrawMs: -1,
    degrade: 0,
    simMs: 0,
    drawCalls: 0,
    world,
    ready: false,
    cam: () => cam,
    state: () => ({
      t: world.time,
      hand: world.hand,
      stretch: world.cloth.maxStretch(),
      clothOff: world.clothOffTime,
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
  const onDown = (e: PointerEvent) => {
    if (down) return
    if (first) {
      first = false
      hooks.onFirst()
    }
    stamp = performance.now()
    const b = drapeBox()
    if (e.clientX >= b.x0 && e.clientX <= b.x1 && e.clientY >= b.y0 && e.clientY <= b.y1) {
      const wx = (e.clientX - cam.w / 2) / cam.scale(cam.project(0, 0, -0.2)[2])
      world.grab(world.nearestHem(wx))
      down = { id: e.pointerId, x: e.clientX, y: e.clientY }
      cv.setPointerCapture?.(e.pointerId)
      navigator.vibrate?.(8)
      return
    }
    // a touch on a prop rocks it a degree
    for (const l of looks) {
      const p = l.prop
      const s = cam.project(p.x, p.y, 0)
      const sc = cam.scale(s[2])
      if (Math.abs(e.clientX - s[0]) < p.c.w * 0.5 * sc && e.clientY < s[1] + 6 && e.clientY > s[1] - p.c.h * sc) {
        p.om += Math.sqrt((2 * 0.75 * 9.81 * p.c.rb) / p.R2) * 0.13
        return
      }
    }
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

  // ---------- loop ----------
  let frozen = false
  let raf = 0
  let last = performance.now()
  let idleAcc = 0
  const ft: number[] = []
  let slow = 0
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
  const tick = (dt: number) => {
    const t0 = performance.now()
    world.step(dt)
    harness.simMs = performance.now() - t0
  }
  const draw = (dt: number) => {
    harness.drawCalls = r.draw(world, views(dt))
  }
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(1 / 30, (now - last) / 1000)
    if (dt <= 0) return
    if (frozen) {
      last = now
      return
    }
    // idle: the solver sleeps and the picture refreshes at 20 fps
    if (world.asleep && !down) {
      idleAcc += now - last
      last = now
      if (idleAcc < 50) return
      idleAcc = 0
    } else last = now
    tick(dt)
    draw(dt)
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

  // ---------- ?shot= states (dev harness): scripted, stepped, frozen ----------
  const shot = DEV ? Q.get('shot') : null
  if (shot) {
    frozen = true
    runShot(shot)
    draw(0)
  } else raf = requestAnimationFrame(frame)
  harness.ready = true

  function runShot(name: string) {
    const step = (s: number, dt = 1 / 60) => {
      const n = Math.round(s / dt)
      for (let i = 0; i < n; i++) world.step(dt)
    }
    const table = Number(Q.get('table')) || 0
    const pull = (v: number, ms: number, dt = 1 / 60) => {
      world.grab(world.nearestHem(0))
      const drive = world.scriptPull(v, v > 2 ? 0.06 : 0.3)
      const n = Math.round(ms / 1000 / dt)
      for (let i = 0; i < n; i++) {
        const rr = drive(dt)
        world.step(dt)
        if (rr === 'release') world.release()
        views(dt) // the topple and fall animations follow the model
      }
    }
    switch (name) {
      case 'rest':
        if (table) setTable(table)
        break
      case 'taut': {
        setTable(table || 2)
        world.grab(world.nearestHem(0))
        for (let i = 1; i <= 4; i++) {
          world.moveHand((0.08 * i) / 4, 0)
          world.step(0.01)
        }
        break
      }
      case 'whip': {
        setTable(table || 2)
        const ms = Q.has('t') ? Number(Q.get('t')) : 100
        const dt = Q.get('dt') ? Number(Q.get('dt')) / 1000 : 1 / 60
        pull(Number(Q.get('v')) || 6, ms, dt)
        break
      }
      case 'pull': {
        setTable(table || 2)
        pull(Number(Q.get('v')) || 3, Number(Q.get('t')) || 500)
        break
      }
      case 'wobble': {
        // the phase 1 props with the vase in clear view (table=0). A pull of 2.6 m/s with a slow start (0.3 s ramp):
        // the frame is 200 ms after the cloth has gone from under the vase, which then leans about 5.6 degrees
        setTable(Q.has('table') ? table : 0)
        const v = Number(Q.get('v')) || 2.6
        const after = (Number(Q.get('after')) || 200) / 1000
        world.grab(world.nearestHem(0))
        const drive = world.scriptPull(v, 0.3)
        const vase = world.props.find((p) => p.id === 'vase') ?? world.props[0]
        let gone = -1
        for (let i = 0; i < 600; i++) {
          const rr = drive(1 / 60)
          world.step(1 / 60)
          views(1 / 60)
          if (rr === 'release') world.release()
          if (!vase.on && gone < 0) gone = world.time
          if (gone >= 0 && world.time - gone >= after - 1e-6) break
        }
        break
      }
      case 'ride': {
        setTable(table || 2)
        world.grab(world.nearestHem(0))
        const drive = world.scriptPull(0.3, 0.3, 3)
        const fish = world.props.find((p) => p.id === 'fish')!
        const until = Q.get('t') ? Number(Q.get('t')) / 1000 : 0
        for (let i = 0; i < 600; i++) {
          drive(1 / 60)
          world.step(1 / 60)
          views(1 / 60)
          if (until ? world.time - world.grabTime >= until : fish.y <= 0.03) break
        }
        break
      }
      case 'topple': {
        setTable(table || 4)
        pull(Number(Q.get('v')) || 1.6, Number(Q.get('t')) || 900)
        break
      }
      case 'lay': {
        setTable(table || 2)
        looks = []
        world.props = []
        world.layFlat()
        step((Number(Q.get('t')) || 250) / 1000)
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
  }
}
