import type { ClassificationKey, RatingKey, TaskStatusKey } from '@/api/types'

export const STATUS_COLORS: Record<TaskStatusKey, string> = {
  treatment: '#12b8a6',
  nearBreach: '#f2b05c',
  breach: '#e04a5d',
  paused: '#3d6deb',
}

export const RATING_COLORS: Record<RatingKey, string> = {
  high: '#12b8a6',
  medium: '#f2b05c',
  low: '#e04a5d',
}

export const CLASSIFICATION_COLORS: Record<ClassificationKey, string> = {
  processes: '#3d6deb',
  routine: '#e04a5d',
}

export const SERIES_COLORS = ['#3d6deb', '#002a99']

/** Card-title ⓘ texts. Static for now — move to the API if they need to be editable. */
export const CARD_INFO = {
  score: 'ציון משוקלל של כלל המדדים לפי הסינון הנבחר. המגמה מציגה שינוי ביחס לתקופה הקודמת.',
  taskStatus: 'מציג את כמות המשימות בחלוקה לעמידה בזמני התקן לביצוע. המגמה מציגה שינוי ביחס ליום הקודם.',
  indicatorRating: 'מספר המדדים בחלוקה לפי דירוג הציון שלהם.',
  taskClassification: 'כמות המשימות בחלוקה לפי סיווג המדד: תהליכים או שגרה.',
  frameworks: 'התפלגות המשימות לפי מסגרות. לחיצה על עמודה מציגה את המסגרות שמתחתיה.',
  history: 'התפתחות המדדים לאורך זמן לפי הסינון הנבחר.',
}
