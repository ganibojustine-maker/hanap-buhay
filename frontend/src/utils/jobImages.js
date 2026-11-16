/**
 * jobImages.js
 * Helpers for realistic photos across Hanapbuhay
 */

export const DEFAULT_AVATAR = '/images/avatar.webp'
export const RECRUITER_AVATAR = '/images/maria.webp'

export const ROLE_PHOTOS = {
  construction: '/images/construction.webp',
  builder: '/images/construction.webp',
  helper: '/images/construction.webp',
  civil: '/images/civil_engineer.webp',
  engineer: '/images/civil_engineer.webp',
  electrician: '/images/electrician.webp',
  electrical: '/images/electrician.webp',
  welder: '/images/welder.webp',
  welding: '/images/welder.webp',
  food: '/images/service_crew.webp',
  service: '/images/service_crew.webp',
  crew: '/images/service_crew.webp',
  cashier: '/images/service_crew.webp',
  cook: '/images/food.webp',
  baker: '/images/food.webp',
  pastry: '/images/food.webp',
  designer: '/images/designer.webp',
  graphic: '/images/designer.webp',
  it: '/images/computer.webp',
  tech: '/images/computer.webp',
  computer: '/images/computer.webp',
  mechanic: '/images/mechanic.webp',
  automotive: '/images/mechanic.webp',
  caregiver: '/images/caregiver.webp',
  nurse: '/images/caregiver.webp',
  health: '/images/caregiver.webp',
  farm: '/images/agriculture.webp',
  agriculture: '/images/agriculture.webp',
  warehouse: '/images/construction.webp',
  driver: '/images/mechanic.webp',
}

/**
 * Returns a high-res realistic photo URL based on job title, category or company
 */
import { fileUrl } from '../api.js'

/** The poster's own photo when they uploaded one (migration 020), else a photo for the kind of work. */
export function getJobImage(job = {}) {
  if (Number(job.image_v) > 0 && job.id) return fileUrl(`/jobs/${job.id}/image?v=${job.image_v}`)
  const text = `${job.title || ''} ${job.category || ''} ${job.company || ''} ${job.job_type || ''}`.toLowerCase()
  for (const [key, path] of Object.entries(ROLE_PHOTOS)) {
    if (text.includes(key)) return path
  }
  // Fallbacks by ID or default
  const fallbackList = [
    '/images/construction.webp',
    '/images/service_crew.webp',
    '/images/electrician.webp',
    '/images/welder.webp',
    '/images/designer.webp',
    '/images/civil_engineer.webp',
  ]
  const id = typeof job.id === 'number' ? job.id : (job.title?.length || 0)
  return fallbackList[id % fallbackList.length]
}

/**
 * Course photo mapping
 */
export const COURSE_PHOTOS = {
  // more specific words first: the first match wins
  beverage: '/images/fnb.webp',
  barista: '/images/fnb.webp',
  bartending: '/images/fnb.webp',
  events: '/images/service_crew.webp',
  housekeeping: '/images/service_crew.webp',
  'front office': '/images/service_crew.webp',
  cookery: '/images/food.webp',
  electronic: '/images/electrician.webp',
  masonry: '/images/construction.webp',
  carpentry: '/images/construction.webp',
  'tile setting': '/images/construction.webp',
  plumbing: '/images/construction.webp',
  painting: '/images/construction.webp',
  'heavy equipment': '/images/construction.webp',
  driving: '/images/mechanic.webp',
  motorcycle: '/images/mechanic.webp',
  'animal production': '/images/agriculture.webp',
  crops: '/images/agriculture.webp',
  massage: '/images/caregiver.webp',
  dressmaking: '/images/designer.webp',
  'nail care': '/images/designer.webp',
  welding: '/images/welder.webp',
  computer: '/images/computer.webp',
  electrical: '/images/electrical-nc.webp',
  bread: '/images/food.webp',
  pastry: '/images/food.webp',
  food: '/images/food.webp',
  caregiving: '/images/caregiver.webp',
  health: '/images/caregiver.webp',
  agriculture: '/images/agriculture.webp',
  organic: '/images/agriculture.webp',
  automotive: '/images/mechanic.webp',
  mechanic: '/images/mechanic.webp',
}

export function getCourseImage(course = {}) {
  const text = `${course.title || ''} ${course.sector || ''}`.toLowerCase()
  for (const [key, path] of Object.entries(COURSE_PHOTOS)) {
    if (text.includes(key)) return path
  }
  return '/images/computer.webp'
}
