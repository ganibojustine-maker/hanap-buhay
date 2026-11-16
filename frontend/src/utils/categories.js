/** Kinds of work (same list: backend Job_model::CATEGORIES). */
export const CATEGORIES = {
  construction: 'Construction & building', electrical: 'Electrical & aircon', automotive: 'Driving & automotive',
  food: 'Food & restaurant', hospitality: 'Hotel, resort & tourism', agriculture: 'Farming & fishing',
  care: 'Household & caregiving', office: 'Office, sales & cashier', tech: 'Computer & design',
  health: 'Health & wellness', beauty: 'Beauty & grooming', education: 'Teaching & tutoring', other: 'Other work',
}

/** Highest education (same list: backend Job_matcher::EDUCATION). */
export const EDUCATION = {
  none: 'No formal schooling', elementary: 'Elementary graduate', high_school: 'High school graduate',
  senior_high: 'Senior high graduate', vocational: 'Vocational / TESDA course', college: 'College graduate',
  postgraduate: "Master's degree or higher",
}

/** Years of experience a job post asks for (backend JobController::EXPERIENCE). */
export const EXPERIENCE = { none: 'No experience needed', '1': 'At least 1 year', '2-3': '2 to 3 years', '4+': '4 years or more' }
