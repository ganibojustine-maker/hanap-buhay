/**
 * /training — TESDA courses, seen by a guest.
 *
 * The catalogue is pages/training/TrainingBrowser.jsx, the same component the dashboard
 * renders at /dashboard/training. Signed in, the ordering changes (courses that close
 * the skill gaps on your job matches first) but the page does not.
 */
import PublicShell, { PageHead } from '../components/PublicShell.jsx'
import TrainingBrowser from './training/TrainingBrowser.jsx'
import { TESDA_COURSES } from '../utils/tesdaCourses.js'

const TOWNS_COVERED = new Set(TESDA_COURSES.flatMap(c => Object.keys(c.towns || {}))).size

export default function Training() {
  return (
    <PublicShell>
      <PageHead
        crumbs={[{ to: '/', label: 'Home' }, { label: 'Training' }]}
        title="Training & Courses"
        lede="TESDA-registered programs across Oriental Mindoro. Pick a course, then enrol with a school from TESDA's official list — many have free scholarship slots."
      >
        <div className="phead-stats">
          {[[String(TESDA_COURSES.length), 'TESDA programs'], [String(TOWNS_COVERED), 'towns with schools'], ['NC I–III', 'national certification']].map(([v, l]) => (
            <div key={l}><b>{v}</b><span>{l}</span></div>
          ))}
        </div>
      </PageHead>
      <TrainingBrowser />
    </PublicShell>
  )
}
