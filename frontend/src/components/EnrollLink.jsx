import { IconArrow } from './icons.jsx'
import { enrollUrl } from '../utils/tesdaCourses.js'
import { tr } from '../lang/dash.js'

/** "Enroll" opens TESDA's official list of schools in Oriental Mindoro offering the course. */
export default function EnrollLink({ course, className = 'btn btn-navy', style, children }) {
  return (
    <a href={enrollUrl(course)} target="_blank" rel="noopener noreferrer" className={className} style={style}
      aria-label={tr("Enroll in {course}: opens TESDA's list of schools in a new tab", { course: course.title })}>
      {children || <>{tr("Enroll on TESDA")} <IconArrow size={15} /></>}
    </a>
  )
}
