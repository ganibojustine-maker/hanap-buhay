/**
 * Skeleton: grey placeholder cards in the shape of what is loading, so the page keeps its
 * layout while it waits (the way large job sites show loading), instead of a spinner.
 *
 *   <SkeletonCards count={6} />          photo cards (jobs, gigs, services)
 *   <SkeletonCards count={4} kind="row" /> list rows (applications, proposals, contracts)
 */
export function SkeletonCards({ count = 6, kind = 'card', label = 'Loading' }) {
  return (
    <div className={kind === 'row' ? 'sk-rows' : 'jc-grid sk-grid'} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        kind === 'row' ? (
          <div key={i} className="sk-row">
            <span className="sk sk-thumb" />
            <span className="sk-lines"><span className="sk sk-line w60" /><span className="sk sk-line w40" /><span className="sk sk-line w80" /></span>
          </div>
        ) : (
          <div key={i} className="sk-card">
            <span className="sk sk-cover" />
            <span className="sk-body">
              <span className="sk sk-line w70" />
              <span className="sk sk-line w45" />
              <span className="sk sk-line w55" />
              <span className="sk sk-btns"><span className="sk sk-btn" /><span className="sk sk-btn" /></span>
            </span>
          </div>
        )
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}

export default SkeletonCards
