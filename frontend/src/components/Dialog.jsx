/**
 * Dialog — the one pop-up the dashboard uses for results and confirmations.
 *
 *   <Dialog tone="error" title="This is not a certificate" onClose={…}
 *     actions={[{ label: 'Choose another file', onClick: pick, primary: true }]}>
 *     …body…
 *   </Dialog>
 *
 * tone: success | error | warn | info | danger (danger = a confirm that deletes something)
 * Escape and the backdrop close it; focus moves into it and back out when it closes.
 */
import { useEffect, useRef } from 'react'
import { IconCheck, IconAlert, IconX, IconShield, IconTrash } from './icons.jsx'

const ICON = { success: IconCheck, error: IconAlert, warn: IconAlert, info: IconShield, danger: IconTrash }

export default function Dialog({ tone = 'info', title, children, actions = [], onClose, busy = false }) {
  const box = useRef(null)
  useEffect(() => {
    const before = document.activeElement
    box.current?.querySelector('[data-autofocus], button')?.focus()
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      before?.focus?.()
    }
  }, [onClose, busy])

  const Ic = ICON[tone] || IconShield
  return (
    <div className="dlg-back" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose?.() }}>
      <div ref={box} className={`dlg ${tone}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        {onClose && (
          <button type="button" className="dlg-x" onClick={onClose} disabled={busy} aria-label="Close"><IconX size={16} /></button>
        )}
        <span className="dlg-ic" aria-hidden="true"><Ic size={24} /></span>
        <h2 id="dlg-title">{title}</h2>
        <div className="dlg-body">{children}</div>
        {actions.length > 0 && (
          <div className="dlg-actions">
            {actions.map((a, i) => (
              <button key={i} type="button" disabled={busy || a.disabled}
                className={`btn ${a.primary ? (tone === 'danger' ? 'btn-danger' : 'btn-primary') : 'btn-light'}`}
                data-autofocus={a.primary ? '' : undefined}
                onClick={a.onClick}>
                {busy && a.primary ? <span className="spin" /> : a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
