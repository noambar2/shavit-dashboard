/**
 * Business settings that are easy to change in one place.
 */

/**
 * ימים לחריגה threshold for the named report (דוח שמי):
 * - daysToBreach < 0                    → משימות בחריגה
 * - 0 ≤ daysToBreach ≤ NEAR_BREACH_DAYS → עתידות לחרוג
 * - daysToBreach > NEAR_BREACH_DAYS     → משימות לטיפול
 * (A task whose pause hasn't ended yet is משימות בהשהייה regardless of days.)
 *
 * The backend should use the same number for the dashboard counts.
 */
export const NEAR_BREACH_DAYS = 5
