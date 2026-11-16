/**
 * /jobs/:id — one job posting, seen by a guest.
 *
 * The posting itself is pages/jobs/JobView.jsx, the same component the dashboard renders
 * at /dashboard/browse/:id, so the match analysis, the skills gap and the apply flow are
 * identical whether or not someone is signed in.
 */
import PublicShell, { PageHead } from '../components/PublicShell.jsx'
import JobView from './jobs/JobView.jsx'

export default function JobDetail() {
  return (
    <PublicShell>
      <PageHead crumbs={[{ to: '/', label: 'Home' }, { to: '/jobs', label: 'Jobs' }, { label: 'Job details' }]} />
      <JobView basePath="/jobs" />
    </PublicShell>
  )
}
