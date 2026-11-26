// The rules of the toy around the world (tablecloth.md 3.6, 5.5 to 5.7, 6.2, 7): which table is laid, the result
// of a pull, what breaks and when, the cat, the near miss, and the lines. Pure TypeScript (no DOM, no GL), so the
// threshold checks in node run the same code; the game turns its events into pictures, sounds and analytics.
import { GRIP, HEIR_GRIP, LAYOUTS, rng, TABLE, World, type Layout } from './sim.ts'
import { Prop, type PropId } from './model/props.ts'

export const ITEMS = ['cup', 'bowls', 'fish', 'vase', 'thermos', 'heirloom'] as const
/** the most precious first: what the card names when several broke */
const PRECIOUS: PropId[] = ['heirloom', 'bowls', 'thermos', 'fish', 'vase', 'cup']

export type Result = 'perfect' | 'close' | 'mess' | 'ride'
export type Fate = 'ok' | 'falling' | 'broken' | 'toppled' | 'spilled'
export type How = 'edge' | 'topple'
export type CatAct = 'jump' | 'stay' | 'step_off' | 'push' | 'push_stopped'

/** a line under the table, or one of Mum's bubbles; `pri` orders them (lower first, tablecloth.md 7) */
export interface Line {
  key: string
  vars?: Record<string, number>
  mum?: boolean
  pri: number
}

export type Ev =
  | { k: 'clink'; id: PropId; g: number; ride?: boolean }
  | { k: 'edge'; id: PropId } // went over an edge (the fall starts)
  | { k: 'crash'; id: PropId; how: How; x: number; y: number; z: number }
  | { k: 'topple'; id: PropId }
  | { k: 'spill'; id: PropId }
  | { k: 'near'; id: PropId; pct: number }
  | { k: 'clothOff'; v: number }
  | { k: 'result'; r: Result; data: Record<string, number>; ga: Record<string, number | string> }
  | { k: 'line'; line: Line }
  | { k: 'cat'; act: CatAct }
  | { k: 'lay' } // a new cloth drops in
  | { k: 'drop'; id: PropId; i: number } // a prop comes down onto the new table
  | { k: 'table'; n: number; title: number } // the place card (title: 1 to 6)
  | { k: 'clear' } // the old table goes (shards fade, survivors lift away)
  | { k: 'skip'; set: number }

const LINE_PRI: Record<string, number> = {
  yoink_perfect: 0,
  yoink_close: 1,
  yoink_mess: 2,
  yoink_ride: 3,
  yoink_wobble: 4,
  yoink_mum_which: 5,
  yoink_mum_set: 6,
  yoink_mum_next: 7,
  yoink_thermos: 8,
  yoink_fish: 9,
  yoink_heir_ok: 10,
  yoink_heir_gone: 11,
  yoink_cat_on: 12,
  yoink_cat_stay: 13,
  yoink_cat_push: 14,
  yoink_skip: 15,
}

export interface Item {
  prop: Prop
  fate: Fate
  offT: number // world time it went over an edge
  topT: number // world time it toppled
  byCat: boolean
}

/** the fall from the lip to the floor: tip 120 ms, then 0.75 m under gravity (0.39 s) */
export const FALL_T = 0.12 + 0.39
/** a toppled prop swings down to lying in this long */
export const LIE_T = 0.35
export const CAT_R = 0.15 // the cat's footprint radius on the table (m)
const EDGE_GAP = 0.12

export type CatState = 'none' | 'jump' | 'land' | 'loaf' | 'leave' | 'paw' | 'gone'

export class Play {
  world: World
  items: Item[] = []
  rnd: () => number
  emit: (e: Ev) => void
  /** the table being played (1 to 6), the lap (0 the first time through), tables laid so far, clean streak */
  set = 1
  lap = 0
  count = 0
  streak = 0
  messes = 0
  pulls = 0
  perfects = 0
  brokeTotal = 0
  bestSet = 0
  state: 'laying' | 'ready' | 'pull' | 'done' | 'push' = 'laying'
  /** seconds in the current state */
  t = 0
  layout: Layout = []
  private layAt = 0 // world time the cloth was dropped
  private dropped = 0
  private nextAt = -1 // world time the next table is laid (after a result)
  private redo = false // lay the same table again
  // the pull in progress
  private grabT = -1
  private kBroke = 0 // broken by the player on this table (all pulls)
  private nearDone = false
  private nearId: PropId | null = null
  private sawOff = false
  private firstEdge = false
  private clothStart = 0
  private lastResult: Result | null = null
  private passed6 = false
  // the cat
  cat: Prop | null = null
  catState: CatState = 'none'
  catT = 0
  catFrom: [number, number] = [0, 0]
  catTo: [number, number] = [0, 0]
  catFace = -1 // -1 faces left (it came from the right)
  catPushed = 0
  catWanted = false
  private catPushProp: Prop | null = null
  private pushFrom: [number, number] = [0, 0]
  private pushTo: [number, number] = [0, 0]
  private hasCat = false
  /** a recipient's starting table */
  rival = -1
  /** gates: cat on or off (threshold checks), hem kick */
  allowCat = true
  pendingSnap = false

  constructor(world: World, seed: number, emit: (e: Ev) => void) {
    this.world = world
    this.rnd = rng(seed * 7 + 3)
    this.emit = emit
  }

  line(key: string, vars?: Record<string, number>, mum = false) {
    this.emit({ k: 'line', line: { key, vars, mum, pri: LINE_PRI[key] ?? 20 } })
  }

  /** the props of table n: its layout, jittered by up to 0.06 m on later laps */
  private layoutFor(n: number): Layout {
    const base = LAYOUTS[n - 1]
    if (this.lap === 0) return base.map((p) => ({ ...p }))
    return base.map((p) => {
      const a = this.rnd() * Math.PI * 2
      const r = this.rnd() * 0.06
      return { id: p.id, x: Math.max(-0.3, Math.min(0.3, p.x + Math.cos(a) * r)), y: Math.max(0.3, Math.min(0.98, p.y + Math.sin(a) * r)) }
    })
  }

  /** lay table n: the cloth drops in, the props come down one by one, the place card */
  lay(n: number, instant = false) {
    const w = this.world
    this.holdUntil = -1
    if (!this.redo) this.messes = 0
    this.set = n
    this.count++
    this.redo = false
    this.layout = this.layoutFor(n)
    this.items = []
    w.props = []
    this.cat = null
    this.catState = 'none'
    this.kBroke = 0
    this.grabT = -1
    this.lastResult = null
    this.nextAt = -1
    this.hasCat = this.allowCat && (n === 6 || ((n >= 4 || this.lap > 0) && this.rnd() < 1 / 3))
    this.catPushed = 0
    w.layFlat()
    this.layAt = w.time
    this.dropped = 0
    this.state = 'laying'
    this.t = 0
    this.emit({ k: 'lay' })
    if (instant) {
      for (let i = 0; i < 180; i++) w.step(1 / 60)
      this.placeProps()
      this.dropped = this.layout.length
      this.state = 'ready'
      this.emit({ k: 'table', n: this.count, title: n })
      if (this.hasCat) this.catLandNow()
    }
  }

  private placeProps() {
    const w = this.world
    w.setProps(this.layout)
    this.items = w.props.map((prop) => ({ prop, fate: 'ok', offT: -1, topT: -1, byCat: false }))
    for (const it of this.items) {
      if (it.prop.id !== 'cat') it.prop.grip = it.prop.id === 'heirloom' ? Math.min(HEIR_GRIP, GRIP[this.set - 1] ?? 1) : (GRIP[this.set - 1] ?? 1)
      it.prop.onTouch = (p, g) => this.emit({ k: 'clink', id: p.id, g })
    }
    w.asleep = false
  }

  /** after a result: the old table goes and the next one (or the same one again) is laid */
  advance() {
    if (this.state !== 'done') return
    this.emit({ k: 'clear' })
    this.nextAt = this.world.time + 0.32
  }

  private nextTable(): number {
    if (this.redo) return this.set
    if (this.set < 6) return this.set + 1
    this.lap++
    return 2
  }

  grabbable() {
    return this.state === 'ready' || this.state === 'pull'
  }

  onGrab() {
    if (this.state === 'ready') {
      this.state = 'pull'
      this.grabT = this.world.time
      this.nearDone = false
      this.nearId = null
      this.sawOff = false
      this.firstEdge = false
      this.world.peakHandV = 0
      this.world.followed = false
      this.clothStart = this.clothY()
      this.pulls++
    }
  }

  /** the mean position of the cloth along the table (to tell a pull from a nudge) */
  private clothY() {
    const x = this.world.cloth.x
    let s = 0
    for (let i = 1; i < x.length; i += 3 * 28) s += x[i]
    return s
  }

  /** a tap on a prop: during the cat's push it saves the prop */
  tapProp(p: Prop) {
    if (this.state === 'push' && this.catPushProp === p && this.catState === 'paw') {
      this.catState = 'loaf'
      this.catPushProp = null
      this.emit({ k: 'cat', act: 'push_stopped' })
      this.finishPush()
    }
  }

  step(dt: number) {
    const w = this.world
    w.step(dt)
    this.t += dt
    // laying: the props come down 0.55 s after the cloth dropped, 120 ms apart; the place card after the last
    if (this.state === 'laying') {
      const since = w.time - this.layAt
      if (since >= 0.55 && !this.items.length) this.placeProps()
      while (this.items.length && this.dropped < this.layout.length && since >= 0.55 + this.dropped * 0.12) {
        this.emit({ k: 'drop', id: this.layout[this.dropped].id, i: this.dropped })
        this.dropped++
      }
      if (this.items.length && this.dropped >= this.layout.length && since >= 0.55 + this.layout.length * 0.12 + 0.2) {
        this.state = 'ready'
        this.t = 0
        this.emit({ k: 'table', n: this.count, title: this.set })
      }
    }
    if (this.nextAt >= 0 && w.time >= this.nextAt) {
      this.nextAt = -1
      this.lay(this.nextTable())
      return
    }
    this.stepCat(dt)
    // the cat is solid: a prop sliding into it stops against it (the cat does not budge)
    const c = this.cat
    if (c && (this.catState === 'loaf' || this.catState === 'land' || this.catState === 'paw'))
      for (const it of this.items) {
        const p = it.prop
        if (it.fate !== 'ok' || p === this.catPushProp) continue
        const dx = p.x - c.x
        const dy = p.y - c.y
        const d = Math.hypot(dx, dy)
        const min = CAT_R * 0.75 + p.c.rb
        if (d >= min || d < 1e-6) continue
        const nx = dx / d
        const ny = dy / d
        p.x = c.x + nx * min
        p.y = c.y + ny * min
        const vn = p.vx * nx + p.vy * ny
        if (vn < 0) {
          p.vx -= vn * nx
          p.vy -= vn * ny
        }
      }
    // falls, topples, breaks
    for (const it of this.items) {
      const p = it.prop
      if ((it.fate === 'ok' || it.fate === 'toppled' || it.fate === 'spilled') && p.off) {
        it.fate = 'falling'
        it.offT = w.time
        this.emit({ k: 'edge', id: p.id })
        if (!this.firstEdge && !it.byCat) {
          this.firstEdge = true
          if (w.peakHandV < 2.5) this.line('yoink_ride')
        }
      } else if (it.fate === 'falling' && w.time - it.offT >= FALL_T) {
        this.breakIt(it, 'edge')
      } else if (it.fate === 'ok' && p.toppled) {
        it.fate = 'toppled'
        it.topT = w.time
        this.emit({ k: 'topple', id: p.id })
      } else if (it.fate === 'toppled' && it.topT >= 0 && w.time - it.topT >= LIE_T) {
        it.topT = -1
        if (p.id === 'thermos' || p.id === 'heirloom') this.breakIt(it, 'topple')
        else if (p.id === 'vase') {
          it.fate = 'spilled'
          this.emit({ k: 'spill', id: p.id })
        }
      }
      // the near miss: past 70 % of the tip angle, once per pull
      if (this.state === 'pull' && !this.nearDone && !p.toppled && p.th > 0.7 * p.thc) {
        this.nearDone = true
        this.nearId = p.id
        this.emit({ k: 'near', id: p.id, pct: Math.round((100 * p.th) / p.thc) })
      }
      // the ride: a quiet clink every 0.04 m of travel
      if (p.on && p.rideTravel > 0.04) {
        p.rideTravel = 0
        this.emit({ k: 'clink', id: p.id, g: 0.03, ride: true })
      }
    }
    if (this.state === 'pull') {
      if (!this.sawOff && w.clothOffTime >= 0) {
        this.sawOff = true
        this.emit({ k: 'clothOff', v: w.peakHandV })
      }
      if (this.settled()) this.result()
    }
    if (this.state === 'push' && this.catState !== 'paw' && this.settled()) this.finishPush()
  }

  /** everything at rest: no hand, props still, falls and topples landed, the cloth asleep or gone */
  settled(): boolean {
    const w = this.world
    if (w.hand !== 'none') return false
    for (const it of this.items) {
      if (it.fate === 'falling') return false
      if (it.fate === 'toppled' && it.topT >= 0) return false
      if (!it.prop.resting) return false
    }
    if (this.catState === 'jump' || this.catState === 'land' || this.catState === 'leave' || this.catState === 'paw') return false
    if (w.asleep) return true
    return w.clothOffTime >= 0 && w.time - w.clothOffTime > 0.6
  }

  private breakIt(it: Item, how: How) {
    const p = it.prop
    it.fate = 'broken'
    const fx = p.x
    const fy = p.y
    this.emit({ k: 'crash', id: p.id, how, x: fx, y: fy, z: how === 'edge' ? -0.75 : 0 })
    if (it.byCat) return
    this.kBroke++
    this.brokeTotal++
    if (p.id === 'bowls') {
      this.line('yoink_mum_which', undefined, true)
    } else if (p.id === 'thermos') this.line('yoink_thermos')
    else if (p.id === 'fish') this.line('yoink_fish')
    else if (p.id === 'heirloom') {
      this.line('yoink_heir_gone')
      this.pendingSnap = true // the slip: any break of the heirloom
    }
  }

  private result() {
    const w = this.world
    const props = this.items.filter((it) => it.prop.id !== 'cat')
    const k = this.kBroke
    const clothOff = w.clothOffTime >= 0
    const moved = props.some((it) => it.prop.moved > 0.03 || it.fate !== 'ok')
    const r: Result = k > 0 ? 'mess' : clothOff ? (moved ? 'close' : 'perfect') : 'ride'
    const ms = Math.round(((clothOff ? w.clothOffTime : w.time) - this.grabT) * 1000)
    const stayed = props.filter((it) => it.fate === 'ok' && it.prop.moved <= 0.03).length
    const slid = props.filter((it) => it.fate !== 'broken' && !(it.fate === 'ok' && it.prop.moved <= 0.03)).length
    this.lastResult = r
    this.state = 'done'
    this.t = 0
    if (r === 'perfect') this.perfects++
    if (r === 'perfect' || r === 'close') {
      this.streak++
      if (this.set > this.bestSet) this.bestSet = this.set
    } else if (r === 'mess') this.streak = 0
    let top = 0
    for (const id of PRECIOUS) if (this.items.some((it) => it.prop.id === id && it.fate === 'broken' && !it.byCat)) {
      top = 1 + ITEMS.indexOf(id as (typeof ITEMS)[number])
      break
    }
    const data = { set: this.set, m: props.length, a: props.filter((it) => it.fate !== 'broken').length, k, top, cat: this.catPushed, ms, streak: this.streak }
    const ga = {
      set: this.set,
      lap: this.lap,
      v: Math.round(w.peakHandV * 100),
      ms,
      m: props.length,
      stayed,
      slid,
      broke: k,
      result: r,
      follow: w.followed ? 1 : 0,
      cat: this.cat ? 1 : 0,
    }
    this.emit({ k: 'result', r, data, ga })
    // the lines
    if (r === 'perfect') this.line('yoink_perfect')
    else if (r === 'close') this.line('yoink_close')
    else if (r === 'mess') this.line('yoink_mess', { k })
    else if (Math.abs(this.clothY() - this.clothStart) > 0.5 || props.some((it) => it.prop.moved > 0.05)) this.line('yoink_ride')
    if (this.nearId && r !== 'ride') {
      const it = this.items.find((x) => x.prop.id === this.nearId)
      if (it && it.fate === 'ok') this.line('yoink_wobble')
    }
    if ((r === 'perfect' || r === 'close') && this.set === 2) this.line('yoink_mum_next', undefined, true)
    if ((r === 'perfect' || r === 'close') && this.set >= 5 && this.items.some((it) => it.prop.id === 'heirloom' && it.fate === 'ok')) this.line('yoink_heir_ok')
    if (this.cat && this.catState === 'loaf' && clothOff && this.cat.moved < 0.03) {
      this.line('yoink_cat_stay')
      this.emit({ k: 'cat', act: 'stay' })
    }
    if (r === 'ride') {
      // nothing: the hem can be grabbed again; the pull goes on as the same table
      this.state = 'ready'
      return
    }
    // the slip: the first perfect on table 2 or later, the first time table 6 is passed
    if (r === 'perfect' && this.set >= 2 && this.perfects === 1) this.pendingSnap = true
    if ((r === 'perfect' || r === 'close') && this.set === 6 && !this.passed6) {
      this.passed6 = true
      this.pendingSnap = true
    }
    if (r === 'mess') {
      this.messes++
      if (this.messes >= 2) {
        this.messes = 0
        this.line('yoink_skip')
        this.emit({ k: 'skip', set: this.set })
      } else this.redo = true
    } else this.messes = 0
    // the cat's push: after a perfect or close with the cat on the table, 1 time in 5
    if ((r === 'perfect' || r === 'close') && this.cat && this.catState === 'loaf' && this.rnd() < (this.catWanted ? 1 : 0.2)) this.startPush()
    else this.nextAt = -1
  }

  /** the world time to lay the next table on its own (1.6 s after everything came to rest) */
  autoNextDue(): boolean {
    return this.state === 'done' && this.nextAt < 0 && this.t >= Math.max(1.6, this.holdUntil)
  }
  /** a tap on the shards (a portal object): the table stays up to `s` more seconds, or until a tap elsewhere */
  hold(s: number) {
    if (this.state === 'done') this.holdUntil = this.t + s
  }
  private holdUntil = -1

  // ---------- the cat (tablecloth.md 5.6) ----------

  private freeSpot(): [number, number] {
    let best: [number, number] = [0.15, 0.6]
    let bd = -1
    for (let i = 0; i < 120; i++) {
      const x = -0.2 + this.rnd() * 0.4
      const y = 0.28 + this.rnd() * 0.62
      let d = 1e9
      // the pictures are drawn larger than the props (game VIS 1.35): keep clear of what is drawn
      for (const it of this.items) {
        const dx = (it.prop.x - x) / (0.2 + it.prop.c.w * 0.62)
        const dy = (it.prop.y - y) / (0.12 + it.prop.c.w * 0.4)
        d = Math.min(d, Math.hypot(dx, dy))
      }
      d -= 0.4 * y // in front, where it can be seen
      if (d > bd) {
        bd = d
        best = [x, y]
      }
    }
    return best
  }

  private catLandNow() {
    const s = this.freeSpot()
    this.cat = new Prop('cat', s[0], s[1], this.rnd)
    this.cat.hemKick = false
    this.world.props.push(this.cat)
    this.catState = 'loaf'
    this.catT = 1
  }

  private stepCat(dt: number) {
    const w = this.world
    this.catT += dt
    if (this.hasCat && this.catState === 'none' && this.state === 'ready' && this.t >= 0.8) {
      this.catTo = this.freeSpot()
      this.catFrom = [0.75, this.catTo[1] - 0.25]
      this.catState = 'jump'
      this.catT = 0
      this.catFace = -1
      this.emit({ k: 'cat', act: 'jump' })
    }
    if (this.catState === 'jump' && this.catT >= 0.5) {
      // lands: thump; every prop rocks a hem kick's worth
      this.cat = new Prop('cat', this.catTo[0], this.catTo[1], this.rnd)
      this.cat.hemKick = false
      w.props.push(this.cat)
      w.asleep = false
      for (const it of this.items) it.prop.kick(0)
      this.catState = 'land'
      this.catT = 0
      this.line('yoink_cat_on')
    }
    if (this.catState === 'land' && this.catT >= 0.9) {
      this.catState = 'loaf'
      this.catT = 0
    }
    const c = this.cat
    if (!c) return
    // carried toward an edge: it stands and hops down (it never falls)
    if ((this.catState === 'loaf' || this.catState === 'land') && Math.hypot(c.vx, c.vy) > 0.02) {
      const gap = Math.min(c.x - TABLE.x0, TABLE.x1 - c.x, c.y - TABLE.y0, TABLE.y1 - c.y)
      if (gap < EDGE_GAP) {
        this.catState = 'leave'
        this.catT = 0
        this.catFrom = [c.x, c.y]
        this.catFace = 1
        w.props = w.props.filter((p) => p !== c)
        this.emit({ k: 'cat', act: 'step_off' })
      }
    }
    if (this.catState === 'leave' && this.catT >= 0.9) {
      this.catState = 'gone'
      this.cat = null
    }
    if (this.catState === 'paw' && this.catPushProp) {
      const p = this.catPushProp
      const e = Math.min(1, this.catT / 1.4)
      const ee = e * e
      p.x = this.pushFrom[0] + (this.pushTo[0] - this.pushFrom[0]) * ee
      p.y = this.pushFrom[1] + (this.pushTo[1] - this.pushFrom[1]) * ee
      p.vx = p.vy = 0
      w.asleep = false
      if (p.x < TABLE.x0 || p.x > TABLE.x1 || p.y < TABLE.y0 || p.y > TABLE.y1) {
        p.off = true
        this.catState = 'loaf'
        this.catPushed = 1
        this.line('yoink_cat_push')
        this.catPushProp = null
      }
    }
  }

  private startPush() {
    const target = this.items.find((it) => it.prop.id === 'cup' && it.fate === 'ok') ?? this.items.find((it) => it.prop.id === 'bowls' && it.fate === 'ok')
    if (!target || !this.cat) return
    const p = target.prop
    const it = target
    it.byCat = true
    // the nearest edge
    const opts: [number, number, number][] = [
      [p.x - TABLE.x0, TABLE.x0 - 0.03, p.y],
      [TABLE.x1 - p.x, TABLE.x1 + 0.03, p.y],
      [p.y - TABLE.y0, p.x, TABLE.y0 - 0.03],
    ]
    opts.sort((a, b) => a[0] - b[0])
    this.pushFrom = [p.x, p.y]
    this.pushTo = [opts[0][1], opts[0][2]]
    this.catPushProp = p
    this.catState = 'paw'
    this.catT = 0
    this.catFace = this.pushTo[0] > this.cat.x ? 1 : -1
    this.state = 'push'
    this.emit({ k: 'cat', act: 'push' })
  }

  private finishPush() {
    if (this.state !== 'push') return
    this.state = 'done'
    this.t = 0
    for (const it of this.items) it.byCat = it.fate === 'broken' ? it.byCat : false
  }

  /** the numbers for the share card right now (the last result, or the table so far) */
  data(): Record<string, number> {
    const props = this.items.filter((it) => it.prop.id !== 'cat')
    let top = 0
    for (const id of PRECIOUS) if (this.items.some((it) => it.prop.id === id && it.fate === 'broken' && !it.byCat)) {
      top = 1 + ITEMS.indexOf(id as (typeof ITEMS)[number])
      break
    }
    const w = this.world
    const ms = this.grabT >= 0 ? Math.round(((w.clothOffTime >= 0 ? w.clothOffTime : w.time) - this.grabT) * 1000) : 0
    return { set: this.set, m: props.length, a: props.filter((it) => it.fate !== 'broken').length, k: this.kBroke, top, cat: this.catPushed, ms, streak: this.streak }
  }

  get result_(): Result | null {
    return this.lastResult
  }
}
