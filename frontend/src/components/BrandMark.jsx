/**
 * BrandMark — hanapbuhay's own loading animation.
 *
 * "Hanap" means to search: the magnifying glass from the logo, with a briefcase in its
 * lens, sweeps along a road of five job pins. Each pin turns gold as the lens finds it,
 * and fades again on the way back; gold speed lines (the ones in the logo) trail behind
 * it, and the lens bobs a little as it travels. Pure SVG + CSS (base.css, "BrandMark"),
 * so it costs nothing to download, and it holds still for people who turn motion off.
 *
 *   dark   white-and-gold version for the navy startup screen
 *   size   width in px (height follows)
 *
 * The same drawing is copied into index.html for the screen shown before the app loads.
 */
export default function BrandMark({ size = 132, dark = false, className = '' }) {
  return (
    <svg className={`bmk${dark ? ' dark' : ''} ${className}`} width={size} height={Math.round(size * 84 / 144)} viewBox="-12 0 144 84" aria-hidden="true" focusable="false">
      <line className="bmk-road" x1="6" y1="72" x2="114" y2="72" />
      {[16, 38, 60, 82, 104].map((x, i) => <circle key={x} className={`bmk-pin p${i}`} cx={x} cy="72" r="3.4" />)}
      <g className="bmk-lens">
        <g className="bmk-trail">
          <line x1="-31" y1="-9" x2="-24" y2="-9" />
          <line x1="-35" y1="0" x2="-25" y2="0" />
          <line x1="-31" y1="9" x2="-24" y2="9" />
        </g>
        <g className="bmk-bob">
          <line className="bmk-handle" x1="12" y1="12" x2="23" y2="23" />
          <circle className="bmk-glass" r="17" />
          <g className="bmk-case">
            <path className="bmk-case-handle" d="M-3.6 -5.2v-2a1.6 1.6 0 0 1 1.6-1.6h4a1.6 1.6 0 0 1 1.6 1.6v2" />
            <rect className="bmk-case-body" x="-8.5" y="-5.2" width="17" height="11.5" rx="2.6" />
            <rect className="bmk-case-clasp" x="-1.7" y="-0.9" width="3.4" height="2.8" rx="0.7" />
          </g>
          <path className="bmk-shine" d="M-10 -6a12 12 0 0 1 6-6" />
        </g>
      </g>
    </svg>
  )
}
