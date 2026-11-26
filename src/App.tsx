import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { Hint } from './components/Hint'
import { applyMeta, t } from './i18n'
import { startAnalytics, track } from './analytics'
import { trackLanding } from './share'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  const [noGL, setNoGL] = useState(false)
  const q = new URLSearchParams(location.search)
  const bare = import.meta.env.DEV && (q.has('shot') || q.has('bare'))

  useEffect(() => {
    applyMeta('yoink')
    startAnalytics('yoink')
    trackLanding()
    return startGame(ref.current!, {
      onFirst() {
        setTouched(true)
        track('play_start')
      },
      onNoGL() {
        setNoGL(true)
        track('no_webgl')
      },
    })
  }, [])

  return (
    <>
      <canvas ref={ref} className="fixed inset-0" />
      {noGL && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#E9DCC8] px-6 text-center">
          <img src="/og.png" alt="" className="w-full max-w-[520px] rounded-xl shadow-lg" />
          <p className="max-w-[32ch] text-[15px] text-[#3A1E14]">{t('yoink_nogl')}</p>
        </div>
      )}
      {!bare && !noGL && <Hint text={t('hint_yoink')} hidden={touched} toy="yoink" />}
      {!(bare && q.has('nopills')) && <MoreMenu current="yoink" />}
    </>
  )
}
