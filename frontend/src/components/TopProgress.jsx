/**
 * TopProgress — the thin gold bar across the top of the screen while the app is
 * waiting on the server, like GitHub or YouTube.
 *
 * api.js counts requests in flight and announces the count ("hb:net"). The bar appears
 * only if something takes longer than 250ms (quick answers don't flash it), creeps
 * towards 90% while waiting, then fills and fades out when everything has answered.
 */
import { useEffect, useRef, useState } from 'react'

export default function TopProgress() {
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const showTimer = useRef(null)
  const trickle = useRef(null)
  const hideTimer = useRef(null)

  useEffect(() => {
    const start = () => {
      clearTimeout(hideTimer.current)
      if (visible || showTimer.current) return
      showTimer.current = setTimeout(() => {
        showTimer.current = null
        setVisible(true)
        setWidth(12)
        clearInterval(trickle.current)
        trickle.current = setInterval(() => setWidth(w => (w < 90 ? w + (90 - w) * 0.08 : w)), 250)
      }, 250)
    }
    const done = () => {
      clearTimeout(showTimer.current); showTimer.current = null
      clearInterval(trickle.current)
      setWidth(w => (w > 0 ? 100 : 0))
      hideTimer.current = setTimeout(() => { setVisible(false); setWidth(0) }, 300)
    }
    const onNet = e => (e.detail > 0 ? start() : done())
    window.addEventListener('hb:net', onNet)
    return () => {
      window.removeEventListener('hb:net', onNet)
      clearTimeout(showTimer.current); clearInterval(trickle.current); clearTimeout(hideTimer.current)
    }
  }, [visible])

  return (
    <div className={`top-progress${visible ? ' on' : ''}`} aria-hidden="true">
      <i style={{ width: `${width}%` }} />
    </div>
  )
}
