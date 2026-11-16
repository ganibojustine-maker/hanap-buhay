/**
 * jobImages.js
 * Helpers for realistic photos across Hanapbuhay
 */

export const DEFAULT_AVATAR = '/images/avatar.jpg'
export const RECRUITER_AVATAR = '/images/maria.jpg'

export const ROLE_PHOTOS = {
  construction: '/images/construction.jpg',
  builder: '/images/construction.jpg',
  helper: '/images/construction.jpg',
  civil: '/images/civil_engineer.jpg',
  engineer: '/images/civil_engineer.jpg',
  electrician: '/images/electrician.jpg',
  electrical: '/images/electrician.jpg',
  welder: '/images/welder.jpg',
  welding: '/images/welder.jpg',
  food: '/images/service_crew.jpg',
  service: '/images/service_crew.jpg',
  crew: '/images/service_crew.jpg',
  cashier: '/images/service_crew.jpg',
  cook: '/images/food.jpg',
  baker: '/images/food.jpg',
  pastry: '/images/food.jpg',
  designer: '/images/designer.jpg',
  graphic: '/images/designer.jpg',
  it: '/images/computer.jpg',
  tech: '/images/computer.jpg',
  computer: '/images/computer.jpg',
  mechanic: '/images/mechanic.jpg',
  automotive: '/images/mechanic.jpg',
  caregiver: '/images/caregiver.jpg',
  nurse: '/images/caregiver.jpg',
  health: '/images/caregiver.jpg',
  farm: '/images/agriculture.jpg',
  agriculture: '/images/agriculture.jpg',
  warehouse: '/images/construction.jpg',
  driver: '/images/mechanic.jpg',
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
    '/images/construction.jpg',
    '/images/service_crew.jpg',
    '/images/electrician.jpg',
    '/images/welder.jpg',
    '/images/designer.jpg',
    '/images/civil_engineer.jpg',
  ]
  const id = typeof job.id === 'number' ? job.id : (job.title?.length || 0)
  return fallbackList[id % fallbackList.length]
}

/**
 * Course photo mapping
 */
export const COURSE_PHOTOS = {
  // more specific words first: the first match wins
  beverage: '/images/fnb.jpg',
  barista: '/images/fnb.jpg',
  bartending: '/images/fnb.jpg',
  events: '/images/service_crew.jpg',
  housekeeping: '/images/service_crew.jpg',
  'front office': '/images/service_crew.jpg',
  cookery: '/images/food.jpg',
  electronic: '/images/electrician.jpg',
  masonry: '/images/construction.jpg',
  carpentry: '/images/construction.jpg',
  'tile setting': '/images/construction.jpg',
  plumbing: '/images/construction.jpg',
  painting: '/images/construction.jpg',
  'heavy equipment': '/images/construction.jpg',
  driving: '/images/mechanic.jpg',
  motorcycle: '/images/mechanic.jpg',
  'animal production': '/images/agriculture.jpg',
  crops: '/images/agriculture.jpg',
  massage: '/images/caregiver.jpg',
  dressmaking: '/images/designer.jpg',
  'nail care': '/images/designer.jpg',
  welding: '/images/welder.jpg',
  computer: '/images/computer.jpg',
  electrical: '/images/electrical-nc.jpg',
  bread: '/images/food.jpg',
  pastry: '/images/food.jpg',
  food: '/images/food.jpg',
  caregiving: '/images/caregiver.jpg',
  health: '/images/caregiver.jpg',
  agriculture: '/images/agriculture.jpg',
  organic: '/images/agriculture.jpg',
  automotive: '/images/mechanic.jpg',
  mechanic: '/images/mechanic.jpg',
}

export function getCourseImage(course = {}) {
  const text = `${course.title || ''} ${course.sector || ''}`.toLowerCase()
  for (const [key, path] of Object.entries(COURSE_PHOTOS)) {
    if (text.includes(key)) return path
  }
  return '/images/computer.jpg'
}
