/**
 * PublicShell — the one header (and footer) every public page uses.
 *
 * Job Search, a job posting, the Job Map and Training each used to draw their own navy
 * bar with its own links, spacing and sign-in button, so moving between them felt like
 * moving between three different sites. They all render inside this now.
 *
 * Signed-in people never see it: those routes send them to the same page inside the
 * dashboard (see App.jsx), so the sidebar, top bar and layout stay put.
 */
import { Link } from 'react-router-dom'
import { SiteHeader, SiteFooter } from './SiteHeader.jsx'
import '../styles/public.css'

/* The public header and footer are the site's own (SiteHeader.jsx), the same on the
   landing page and every public page. These names stay for the pages that import them. */
export function PublicNav() {
  return <SiteHeader />
}

/** Breadcrumb + page title strip, so every public page opens the same way. */
export function PageHead({ crumbs = [], title, lede, children, narrow = false }) {
  return (
    <div className="phead">
      <div className={`phead-in${narrow ? ' narrow' : ''}`}>
        {crumbs.length > 0 && (
          <nav className="phead-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.to || c.label}>
                {i > 0 && <i aria-hidden="true">›</i>}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        {title && <h1>{title}</h1>}
        {lede && <p>{lede}</p>}
        {children}
      </div>
    </div>
  )
}

export function PublicFooter() {
  return <SiteFooter />
}

/**
 * Wrap a public page. `embedded` is what the dashboard passes: the page then renders
 * its content alone, because the dashboard already provides the chrome.
 */
export default function PublicShell({ embedded = false, children, footer = true }) {
  if (embedded) return <>{children}</>
  return (
    <div className="public-page">
      <PublicNav />
      {children}
      {footer && <PublicFooter />}
    </div>
  )
}
