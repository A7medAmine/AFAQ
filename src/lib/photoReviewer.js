// Only this account may approve or refuse member profile photos.
export const PHOTO_REVIEWER_EMAIL = 'ahmedabdesselam55@gmail.com'

export const canReviewPhotos = email => String(email || '').trim().toLowerCase() === PHOTO_REVIEWER_EMAIL
