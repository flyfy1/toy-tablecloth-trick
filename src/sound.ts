// Tablecloth Trick's sounds (tablecloth.md section 4), all synthesised: the pinch, the silk's hiss, the snap,
// each prop's clink, the crashes, the topple's roll, the bells of a perfect pull, the new cloth's fwuff, the cat.
import { audio } from './engine/AudioEngine'
import type { PropId } from './model/props'

/** the slow-motion beat: everything drops a fifth */
let rate = 1
let silk: { set(freq: number, gain: number): void } | null = null
let hum: { set(gain: number): void } | null = null
const lastClink: Record<string, number> = {}

export function unlock() {
  audio.unlock()
  if (!silk && audio.ctx) {
    silk = audio.noiseLoop(0.8)
    hum = audio.hum(55)
  }
}

export function slowMo(on: boolean) {
  rate = on ? 2 / 3 : 1
  hum?.set(on ? 0.05 : 0)
}

export function pinch() {
  audio.noise({ dur: 0.025, gain: 0.06, filter: 'bandpass', freq: 1800 * rate, q: 1.5 })
}

/** the silk over the table: v is the cloth's speed over the table (m/s) */
export function silkAt(v: number) {
  silk?.set((1200 + 500 * v) * rate, 0.035 * Math.min(v, 6))
}

export function snap() {
  audio.noise({ dur: 0.012, gain: 0.18, filter: 'highpass', freq: 3000 })
  audio.tone({ freq: 85 * rate, dur: 0.05, gain: 0.1 })
}

const CLINK: Record<PropId, { f: number[]; dur: number }> = {
  cup: { f: [2150, 5300], dur: 0.09 },
  bowls: { f: [1450, 3900], dur: 0.07 },
  fish: { f: [980, 2700], dur: 0.12 },
  vase: { f: [760, 2050], dur: 0.16 },
  thermos: { f: [310, 640], dur: 0.14 },
  heirloom: { f: [1020, 2880, 4400], dur: 0.26 },
  cat: { f: [70], dur: 0.06 },
}

/** a rocking prop touches down (or rides a step along); g is the level */
export function clink(id: PropId, g: number) {
  if (!audio.ctx) return
  // at most 40 a second per prop
  const now = audio.ctx.currentTime
  if (now - (lastClink[id] ?? -1) < 0.025) return
  lastClink[id] = now
  const c = CLINK[id]
  const gg = Math.min(0.22, g)
  if (id === 'bowls') {
    // three bowls, each detuned 4 %
    for (let b = 0; b < 3; b++) {
      const d = 1 + (b - 1) * 0.04
      c.f.forEach((f, i) => audio.tone({ freq: f * d * rate, dur: c.dur, gain: (gg / (i + 1)) * 0.6, delay: b * 0.008 }))
    }
    return
  }
  c.f.forEach((f, i) => audio.tone({ freq: f * rate, dur: c.dur, gain: gg / (i + 1) }))
  if (id === 'thermos') audio.tone({ freq: 2200 * rate, dur: 0.03, gain: gg * 0.4 })
}

export function crash(id: PropId) {
  if (id === 'thermos') {
    audio.tone({ freq: 120, freqEnd: 60, dur: 0.09, gain: 0.25 })
    audio.noise({ dur: 0.2, gain: 0.12, filter: 'highpass', freq: 2500 })
  }
  audio.noise({ dur: 0.03, gain: 0.3, filter: 'lowpass', freq: 5000 })
  const n = 8 + Math.floor(Math.random() * 7)
  for (let i = 0; i < n; i++) {
    const d = (i / n) * 0.35
    audio.tone({ freq: (1800 + Math.random() * 5200) * rate, dur: 0.03 + Math.random() * 0.09, gain: 0.09 * (1 - i / n) + 0.02, delay: d + 0.02, pan: Math.random() - 0.5 })
  }
  for (let i = 0; i < 3; i++) audio.tone({ freq: 3000 + Math.random() * 4000, dur: 0.06, gain: 0.025, delay: 0.4 + Math.random() * 0.5 })
  if (id === 'fish') audio.noise({ dur: 0.07, gain: 0.2, filter: 'lowpass', freq: 400, delay: 0.03 })
}

export function topple(id: PropId) {
  clink(id, 0.22)
  audio.noise({ dur: 0.6, gain: 0.08, filter: 'bandpass', freq: 220, q: 1.2, attack: 0.05 })
}

export function perfect() {
  audio.tone({ freq: 880, dur: 0.5, gain: 0.06 })
  audio.tone({ freq: 1320, dur: 0.5, gain: 0.06, delay: 0.06 })
}

export function lay() {
  audio.noise({ dur: 0.3, gain: 0.05, filter: 'lowpass', freq: 900, attack: 0.15 })
}

export function catLand() {
  audio.tone({ freq: 70, dur: 0.06, gain: 0.14 })
}
