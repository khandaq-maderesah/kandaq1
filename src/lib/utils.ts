import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Gregorian 'YYYY-MM-DD' key for `days` days before today (UTC slice, same
 * convention as the rest of the app: new Date().toISOString().slice(0, 10)). */
export function daysAgoISO(days: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Shared "recent attendance" window (in days) used by EVERY realtime consumer
 * that only needs fresh data — the attendance-reminder bell, the absence-alert
 * bell (5-day streaks never need older records) and the admin dashboard KPIs.
 *
 * Because every consumer uses the SAME key, the dataStore keeps ONE RTDB
 * subscription for all of them (previously each downloaded the entire
 * attendance history independently).
 */
export const ATTENDANCE_RECENT_DAYS = 15
