import { createRoot } from 'react-dom/client'
import Dialog from './Dialog.jsx'

/**
 * A branded "Are you sure?" in place of the browser's confirm() box. Works from any handler:
 *
 *   if (!(await askConfirm({ title: 'Remove this photo?', body: '…', yes: 'Remove', tone: 'danger' }))) return
 */
export default function askConfirm({ title, body, yes = 'Yes', no = 'Cancel', tone = 'warn' }) {
  return new Promise(resolve => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const answer = ok => { root.unmount(); host.remove(); resolve(ok) }
    root.render(
      <Dialog tone={tone} title={title} onClose={() => answer(false)}
        actions={[{ label: yes, primary: true, onClick: () => answer(true) }, ...(no ? [{ label: no, onClick: () => answer(false) }] : [])]}>
        {body && <p style={{ margin: 0 }}>{body}</p>}
      </Dialog>
    )
  })
}

/** A branded message with one OK button, in place of alert(). */
export const showNotice = (title, body, tone = 'error') => askConfirm({ title, body, tone, yes: 'OK', no: null })
