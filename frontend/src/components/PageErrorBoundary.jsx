import { Component } from 'react'

// Catches a page that fails to load or crashes, instead of leaving a blank screen.
//  • A page's code could not be downloaded:
//      online  → most likely a new version was deployed and the old file is gone: reload once.
//      offline → the page was never opened on this phone before, so it isn't saved yet.
//  • Any other error: a short message with a reload button.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically|Loading (CSS )?chunk/i
const RELOAD_KEY = 'hb_chunk_reload'

export default class PageErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  // keep the offline/online wording right if the connection changes while the message is shown
  onNetwork = () => this.forceUpdate()
  componentDidMount() {
    window.addEventListener('online', this.onNetwork)
    window.addEventListener('offline', this.onNetwork)
  }
  componentWillUnmount() {
    window.removeEventListener('online', this.onNetwork)
    window.removeEventListener('offline', this.onNetwork)
  }

  componentDidCatch(error) {
    if (!CHUNK_ERROR.test(error?.message || '') || !navigator.onLine) return
    try {
      // one automatic reload per page, so a real outage can't cause a reload loop
      if (sessionStorage.getItem(RELOAD_KEY) !== location.pathname) {
        sessionStorage.setItem(RELOAD_KEY, location.pathname)
        location.reload()
      }
    } catch { /* storage blocked: show the message instead */ }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = CHUNK_ERROR.test(error?.message || '')
    const offline = !navigator.onLine
    return (
      <div className="page-error" role="alert">
        <img src="/icons/icon-192.png" alt="" width="56" height="56" />
        <h2>{offline ? "You're offline" : chunk ? 'This page could not load' : 'Something went wrong'}</h2>
        <p>
          {offline
            ? "This page hasn't been opened on this phone before, so it isn't saved for offline use yet. Connect to data or Wi-Fi and try again."
            : chunk
              ? 'Your connection may be slow or hanapbuhay was just updated. Try again.'
              : 'Please reload the page. If it keeps happening, sign out and back in.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Try again</button>
      </div>
    )
  }
}
