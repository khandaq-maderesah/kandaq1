/**
 * Daily session log + weekly report (pure, unit-tested).
 *
 * The madrasa's after-school program has two sessions a day, Monday to
 * Saturday: Qur'an first, then a Kitab lesson. On Saturday the second session
 * is the weekly review. When taking attendance the Ustaz must say whether each
 * session was held (the daily session log). On Saturday the Ustaz writes the
 * weekly report: what was covered each day, from the madrasa's kitab list,
 * plus the review notes.
 */
import type { SessionLog, WeeklyReport, WeeklyReportDay } from '@/types'

export type SessionAnswer = boolean | null

/** Both sessions of a day as answered on the attendance page (null = not answered yet). */
export interface SessionAnswers {
  quran: SessionAnswer
  kitab: SessionAnswer
}

export const EMPTY_SESSION_ANSWERS: SessionAnswers = { quran: null, kitab: null }

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return toIso(new Date(parseDate(date).getTime() + days * DAY_MS))
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: string): number {
  return parseDate(date).getUTCDay()
}

export function isSaturday(date: string): boolean {
  return dayOfWeek(date) === 6
}

export function isSunday(date: string): boolean {
  return dayOfWeek(date) === 0
}

/** The Monday that starts the week containing `date` (a Sunday belongs to the week before). */
export function weekStartOf(date: string): string {
  const dow = dayOfWeek(date)
  const back = dow === 0 ? 6 : dow - 1
  return addDays(date, -back)
}

/** Monday to Saturday of the week starting on `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i))
}

export function sessionLogId(classId: string, date: string): string {
  return `${classId}_${date}`
}

export function weeklyReportId(classId: string, weekStart: string): string {
  return `${classId}_${weekStart}`
}

/** The week a report is due for: this week on Saturday/Sunday, otherwise the week before. */
export function reportWeekFor(today: string): string {
  const dow = dayOfWeek(today)
  if (dow === 6 || dow === 0) return weekStartOf(today)
  return addDays(weekStartOf(today), -7)
}

/** True once both sessions of the day have an answer (held or not held). */
export function sessionsAnswered(answers: SessionAnswers): boolean {
  return answers.quran !== null && answers.kitab !== null
}

export function answersFromLog(log: SessionLog | undefined): SessionAnswers {
  if (!log) return EMPTY_SESSION_ANSWERS
  return { quran: log.quran, kitab: log.kitab }
}

export function emptyReportDay(): WeeklyReportDay {
  return { quran: '', kitab: '', topic: '' }
}

export function emptyWeeklyReport(classId: string, teacherId: string, weekStart: string): WeeklyReport {
  const now = new Date().toISOString()
  const days: Record<string, WeeklyReportDay> = {}
  for (const d of weekDays(weekStart)) days[d] = emptyReportDay()
  return {
    id: weeklyReportId(classId, weekStart),
    classId,
    teacherId,
    weekStart,
    days,
    review: '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

/** A report as stored (days may be missing) completed into a full form state. */
export function normalizeWeeklyReport(report: WeeklyReport): WeeklyReport {
  const days: Record<string, WeeklyReportDay> = {}
  for (const d of weekDays(report.weekStart)) {
    const stored = report.days?.[d]
    days[d] = { quran: stored?.quran ?? '', kitab: stored?.kitab ?? '', topic: stored?.topic ?? '' }
  }
  return { ...report, days, review: report.review ?? '', status: report.status ?? 'draft' }
}

/**
 * What still blocks a submission, as keys like '2026-10-20.quran',
 * '2026-10-21.kitab', '2026-10-21.topic' or 'review'. A day's entry is
 * required only when the session log says that session was held; the
 * Saturday review notes are always required.
 */
export function weeklyReportProblems(report: WeeklyReport, logs: Record<string, SessionLog | undefined>): string[] {
  const problems: string[] = []
  for (const date of weekDays(report.weekStart)) {
    const log = logs[sessionLogId(report.classId, date)]
    const day = report.days[date] ?? emptyReportDay()
    if (log?.quran && !day.quran.trim()) problems.push(`${date}.quran`)
    if (log?.kitab && !isSaturday(date)) {
      if (!day.kitab.trim()) problems.push(`${date}.kitab`)
      if (!day.topic.trim()) problems.push(`${date}.topic`)
    }
  }
  if (!report.review.trim()) problems.push('review')
  return problems
}

/** The week keys covered by a list of reports, newest first. */
export function weeksOf(reports: Pick<WeeklyReport, 'weekStart'>[]): string[] {
  return Array.from(new Set(reports.map((r) => r.weekStart))).sort((a, b) => (a < b ? 1 : -1))
}
