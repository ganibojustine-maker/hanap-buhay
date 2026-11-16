/**
 * SiteHeader / SiteFooter — the one header and footer of the public site
 * (landing page, guest job board, a job posting, Job Map, Training, legal pages).
 *
 * Logo on the left, three links in the middle, language + Sign in + Get started on the
 * right. On the landing page it floats over the navy hero and turns solid on scroll; on
 * every other public page it is solid and sticks to the top. The app's own menu (Find
 * Jobs, Job Map, Training…) lives inside the app, not here.
 *
 * Styles: landing.css (`lh-`, `lp-foot`).
 */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo, IconArrow, IconMenu, IconX } from './icons.jsx'
import UserAvatar from './Avatar.jsx'
import { useAuth } from '../auth.jsx'
import { useLanguage, LanguageSwitcher } from '../i18n.jsx'

export function SiteHeader() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const home = pathname === '/'
  const [stuck, setStuck] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const f = () => setStuck(window.scrollY > 8)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // on the landing page these scroll; anywhere else they go back to that part of it
  const links = [['features', t('lh.features')], ['how', t('lh.how')], ['employers', t('lh.roles')]]
  const href = id => (home ? `#${id}` : `/#${id}`)
  const close = () => setOpen(false)
  const item = ([id, l], extra = {}) => home
    ? <a key={id} href={href(id)} {...extra}>{l}</a>
    : <Link key={id} to={href(id)} {...extra}>{l}</Link>

  return (
    <header className={`lh${home ? '' : ' lh-page'}${stuck ? ' stuck' : ''}${open ? ' open' : ''}`}>
      <div className="lp-in lh-in">
        <Logo light height={40} />
        <nav className="lh-links" aria-label="Site">{links.map(l => item(l))}</nav>
        <div className="lh-right">
          <span className="lh-lang"><LanguageSwitcher variant="toggle" light /></span>
          {user ? (
            <Link to="/dashboard" className="lh-me"><UserAvatar user={user} size={30} /><span>{t('lh.dashboard')}</span></Link>
          ) : (
            <>
              <Link to="/login" className="lh-signin">{t('nav.sign_in')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm lh-start">{t('nav.sign_up')}</Link>
            </>
          )}
          <button type="button" className="lh-burger" aria-label={t('lh.menu')} aria-expanded={open} onClick={() => setOpen(v => !v)}>
            {open ? <IconX size={22} /> : <IconMenu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lh-sheet">
          {links.map(l => item(l, { onClick: close }))}
          <div className="lh-sheet-lang"><LanguageSwitcher variant="toggle" light /></div>
          {user
            ? <Link to="/dashboard" className="btn btn-primary btn-lg" onClick={close}>{t('lh.dashboard')} <IconArrow /></Link>
            : <>
                <Link to="/login" className="btn lp-ghost btn-lg" onClick={close}>{t('nav.sign_in')}</Link>
                <Link to="/register" className="btn btn-primary btn-lg" onClick={close}>{t('nav.sign_up')} <IconArrow /></Link>
              </>}
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  const { t } = useLanguage()
  return (
    <footer className="lp-foot">
      <div className="lp-in lp-foot-in">
        <Logo height={32} />
        <nav aria-label="Footer">
          <Link to="/jobs">{t('lp.foot.jobs')}</Link>
          <Link to="/map">{t('lp.foot.map')}</Link>
          <Link to="/training">{t('lp.foot.training')}</Link>
          <Link to="/about">About</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/help">Help & contact</Link>
          <Link to="/privacy">{t('lp.foot.privacy')}</Link>
          <Link to="/terms">{t('lp.foot.terms')}</Link>
        </nav>
        <span>© {new Date().getFullYear()} {t('lp.foot.copy')}</span>
      </div>
    </footer>
  )
}
