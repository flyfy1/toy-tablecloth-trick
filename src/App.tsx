import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { Hint } from './components/Hint'
import { Tag } from './components/Tag'
import { applyMeta, t, tx } from './i18n'
import { startAnalytics, track } from './analytics'
import { landing, trackLanding } from './share'
import { startGame } from './game'
import type { Line } from './play'

type Shown = { text: string; id: number; from?: string }

const LINE_GAP = 2500

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  const [noGL, setNoGL] = useState(false)
  const [line, setLine] = useState<Shown | null>(null)
  const [mum, setMum] = useState<Shown | null>(null)
  const [count, setCount] = useState<{ n: number; s: number; bump: number } | null>(null)
  const [card, setCard] = useState<{ title: number; x: number; y: number; w: number; id: number } | null>(null)
  const q = new URLSearchParams(location.search)
  const bare = import.meta.env.DEV && (q.has('shot') || q.has('bare'))
  const og = import.meta.env.DEV && q.has('og')

  useEffect(() => {
    applyMeta('yoink')
    startAnalytics('yoink')
    trackLanding()
    // the lines: at most one per 2.5 s, the most important first (tablecloth.md 7); Mum's in her own bubble
    const queue: Line[] = []
    let lastLine = -1e9
    let timer: number | undefined
    let lineOff: number | undefined
    const showNext = () => {
      timer = undefined
      if (!queue.length) return
      const wait = lastLine + LINE_GAP - performance.now()
      if (wait > 0) {
        timer = window.setTimeout(showNext, wait)
        return
      }
      queue.sort((a, b) => a.pri - b.pri)
      const l = queue.shift()!
      queue.length = Math.min(queue.length, 2)
      lastLine = performance.now()
      setLine({ text: t(l.key as never, l.vars ?? {}), id: lastLine })
      window.clearTimeout(lineOff)
      lineOff = window.setTimeout(() => setLine(null), 2600)
      if (queue.length) timer = window.setTimeout(showNext, LINE_GAP)
    }
    let mumOff: number | undefined
    const showMum = (key: string) => {
      setMum({ text: tx(key), from: t('yoink_mum'), id: performance.now() })
      window.clearTimeout(mumOff)
      mumOff = window.setTimeout(() => setMum(null), 3400)
    }
    return startGame(ref.current!, {
      onFirst() {
        setTouched(true)
        track('play_start')
      },
      onNoGL() {
        setNoGL(true)
        track('no_webgl')
      },
      onLine(l) {
        if (l.mum) {
          showMum(l.key)
          if (l.key === 'yoink_mum_which') window.setTimeout(() => showMum('yoink_mum_set'), 2000)
          return
        }
        queue.push(l)
        if (!timer) showNext()
      },
      onCount(n, s) {
        setCount((c) => ({ n, s, bump: (c?.bump ?? 0) + 1 }))
      },
      onTable(n, title, x, y, w) {
        setCard((c) => ({ title, x, y, w, id: c && c.title === title && Math.abs(c.y - y) < 1 ? c.id : n }))
      },
    })
  }, [])

  const b = /^([1-6])([0-9])$/.exec(q.get('b') || '')
  const tag = landing.recipient && b ? (b[2] === '0' ? t('yoink_tag0') : t('yoink_tagk', { k: Number(b[2]) })) : ''

  return (
    <>
      <canvas ref={ref} className="fixed inset-0" />
      {noGL && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#E9DCC8] px-6 text-center">
          <img src="/og.png" alt="" className="w-full max-w-[520px] rounded-xl shadow-lg" />
          <p className="max-w-[32ch] text-[15px] text-[#3A1E14]">{t('yoink_nogl')}</p>
        </div>
      )}
      {card && !og && !(bare && q.has('nocard')) && (
        <div key={card.id} className="yoink-card pointer-events-none fixed z-[5] flex justify-center select-none" style={{ left: card.x - 120, top: card.y - 34, width: 240 }}>
          <span className="max-w-[min(240px,80vw)] truncate rounded-[3px] border border-[#3A1E14]/15 bg-[#FFFDF7] px-3 py-1 text-[13px] font-medium tracking-wide text-[#3A1E14] shadow-[0_3px_8px_rgba(58,30,20,.25)]">
            {tx(`yoink_t${card.title}`)}
          </span>
        </div>
      )}
      {!bare && count && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-10 flex justify-center select-none">
          <span key={count.bump} className="yoink-bump rounded-full bg-[#FFF9F0]/85 px-3.5 py-1.5 text-[14px] font-medium tabular-nums text-[#3A1E14]/85 shadow-[0_4px_14px_rgba(74,58,44,.15)]">
            {count.s ? t('yoink_count', { n: count.n, s: count.s }) : t('yoink_count0', { n: count.n })}
          </span>
        </div>
      )}
      {!bare && mum && (
        <div key={mum.id} className="yoink-mum pointer-events-none fixed inset-x-0 top-14 z-10 flex justify-center px-4 select-none">
          <div className="max-w-[340px] rounded-2xl rounded-tl-md bg-white/95 px-3.5 py-2 text-[15px] leading-snug text-[#2B2620] shadow-[0_6px_20px_rgba(60,45,30,.18)]">
            <div className="text-[12px] font-semibold text-[#3A8DDE]">{mum.from}</div>
            {mum.text}
          </div>
        </div>
      )}
      {!bare && line && (
        <div key={line.id} className="yoink-line pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-10 flex justify-center px-6 select-none">
          <span className="rounded-full bg-[#FFF9F0]/88 px-3.5 py-1.5 text-center text-[16px] font-medium leading-snug tracking-wide text-[#3A1E14]/90 shadow-[0_4px_14px_rgba(74,58,44,.14)]">{line.text}</span>
        </div>
      )}
      {og && (
        <div className="pointer-events-none fixed inset-y-0 left-0 z-10 flex w-[44%] flex-col justify-center gap-3 bg-gradient-to-r from-[#E9DCC8] via-[#E9DCC8]/92 to-transparent pl-14 pr-6">
          <div className="text-[64px] font-black leading-none text-[#3A1E14]">{t('name_yoink')}</div>
          <div className="text-[28px] font-semibold text-[#B3261E]">抽桌布</div>
          <div className="max-w-[18ch] text-[22px] leading-snug text-[#3A1E14]/75">Whip a silk tablecloth out from under Mum’s bowls.</div>
        </div>
      )}
      {!bare && !noGL && <Hint text={t('hint_yoink')} hidden={touched} toy="yoink" />}
      {tag && <Tag text={tag} className="top-14" paper="bg-[#FFFDF7] text-[#3A1E14] font-medium" />}
      {!(bare && q.has('nopills')) && !og && <MoreMenu current="yoink" />}
    </>
  )
}
