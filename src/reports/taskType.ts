/**
 * סוג משימה — derived from a task's `daysToBreach` and `pauseEndDate`.
 * Shared by the Excel export, the in-app report view and the mock backend,
 * so all three classify tasks the same way. Threshold: `NEAR_BREACH_DAYS` in src/config.ts.
 */
import type { ReportTask, ReportTaskType } from '@/api/types'
import { NEAR_BREACH_DAYS } from '@/config'

export const TASK_TYPES: ReportTaskType[] = ['breach', 'nearBreach', 'treatment', 'paused']

export const TASK_TYPE_LABELS: Record<ReportTaskType, string> = {
  breach: 'משימות בחריגה',
  nearBreach: 'עתידות לחרוג',
  treatment: 'משימות לטיפול',
  paused: 'משימות בהשהייה',
}

/** Short labels for chips and tags in the report view. */
export const TASK_TYPE_SHORT: Record<ReportTaskType, string> = {
  breach: 'בחריגה',
  nearBreach: 'עתידה לחרוג',
  treatment: 'לטיפול',
  paused: 'בהשהייה',
}

export function taskType(task: ReportTask, today: string): ReportTaskType {
  const pauseEnd = task.pauseEndDate
  const days = Number(task.daysToBreach)
  if (typeof pauseEnd === 'string' && pauseEnd >= today) return 'paused'
  if (days < 0) return 'breach'
  if (days <= NEAR_BREACH_DAYS) return 'nearBreach'
  return 'treatment'
}

/** Today as `YYYY-MM-DD` in local time. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
