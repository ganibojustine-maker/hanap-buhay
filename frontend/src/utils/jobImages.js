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
export function getJobImage(job = {}) {
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
