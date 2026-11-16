/**
 * SlowNotice: a small, polite note when the server takes long to answer.
 *
 * The API is on a free server that sleeps after a quiet spell; the first request then
 * waits while it starts (up to about a minute). Instead of a spinner that looks frozen,
 * this says what is happening. api.js announces requests in flight ("hb:net"); the note
 * shows after 6 seconds of waiting and disappears as soon as everything has answered.
 */
import { useEffect, useRef, useState } from 'react'

export default function SlowNotice() {
  const [show, setShow] = useState(false)
  const timer = useRef(null)
  useEffect(() => {
    const onNet = e => {
      if (e.detail > 0) {
        if (!timer.current) timer.current = setTimeout(() => setShow(true), 6000)
      } else {
        clearTimeout(timer.current); timer.current = null
        setShow(false)
      }
    }
    window.addEventListener('hb:net', onNet)
    return () => { window.removeEventListener('hb:net', onNet); clearTimeout(timer.current) }
  }, [])
  if (!show) return null
  return (
    <div className="slow-note" role="status" aria-live="polite">
      <span className="spin" aria-hidden="true" />
      <span><b>Starting up the server…</b> After a quiet period the first page can take up to a minute. Thanks for waiting.</span>
    </div>
  )
}
