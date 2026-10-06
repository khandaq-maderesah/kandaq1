'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Student, Class, Exam } from '@/types'

/**
 * ──────────────────────────────────────────────────────────────────────
 * Khandaq Madresah — Printable Student Certificate
 * ──────────────────────────────────────────────────────────────────────
   * Background image: public/image/2 page [Recovered]-11.jpg
 *
   * The image is an A4-landscape certificate whose graphics, tables, field
 * labels and text prompts are already printed. This component overlays
 * *dynamic* student data onto the empty white areas:
 *
 *   1. TOP-RIGHT    — student info        (2×2 grid)
 *   2. CENTRE-RIGHT — grades table        (6 subjects × Term1/2/3/Total)
 *   3. MIDDLE-RIGHT — summary             (grand-total, average, next-grade, promote)
 *   4. BOTTOM-LEFT  — evaluation stars    (3 rows × 3 stars)
 *
 * ── ALIGNMENT HANDBOOK ─────────────────────────────────────────────────
 * Pass `debug` to paint every overlay panel with a translucent colour so you
 * can SEE the containers. Tweak the `top-[%]` / `right-[%]` / `left-[%]`
 * classes on each panel until it sits exactly on the matching white area of
 * the image, then set `debug={false}` (or omit the prop). All positions are
 * relative to the A4-landscape container below.
 * ──────────────────────────────────────────────────────────────────────
 */

/* ════════════════════════════ Types ══════════════════════════════════ */

/**
 * The six subject rows already labelled in the background image, in row
 * order (top → bottom of the grade table). Only the four numeric columns
 * (Term 1 / Term 2 / Term 3 / Total) need overlaying — the Subject and
 * Description columns are baked into the image.
 */
export const CERTIFICATE_SUBJECTS = [
  'seerah',
  'aqeedah',
  'hadith',
  'zikr',
  'arabic',
  'fiqh',
] as const
export type CertificateSubject = (typeof CERTIFICATE_SUBJECTS)[number]

/** Per-subject marks for the three terms plus the computed total. */
export interface CertificateSubjectGrade {
  subject: CertificateSubject
  description?: string
  term1: number
  term2: number
  term3: number
  total: number
}

/** Everything the certificate overlay needs to render for one student. */
export interface CertificateStudent {
  id?: string
  name: string
  class: string
  teacherName: string
  academicYear: string
  rollNumber?: string
  photoUrl?: string
  grades: CertificateSubjectGrade[]
  grandTotal: number
  average: number
  nextGrade: string
  isPromoted: boolean
  /** 1–3 star rating (Behaviour). */
  behaviorRating: number
  /** 1–3 star rating (Attendance). */
  attendanceRating: number
  /** 1–3 star rating (Qur'an interest). */
  quranInterestRating: number
}

/**
 * Subject-name aliases used to bridge the system's configurable subjects
 * (e.g. "Hadith", "Sirah", "Iman") onto the six certificate rows. Matching
 * is case-insensitive, so add local variants here if your exam subjects use
  * different spellings.
 */
const SUBJECT_ALIASES: Record<CertificateSubject, string[]> = {
  seerah: ['seerah', 'sirah', 'sira', 'siyar', 'ስርዓ'],
  aqeedah: ['aqeedah', 'aqidah', 'iman', 'ሕይምት', 'creed', 'belief'],
  hadith: ['hadith', 'hadeeth', 'hadees', 'hadeth'],
  zikr: ['zikr', 'zekr', 'dhikr'],
  arabic: ['arabic', 'language', 'ar'],
  fiqh: ['fiqh', 'jurisprudence', 'feqh'],
}

/* ═════════════════════════ Helpers ══════════════════════════════════ */

/**
 * Public URL of the certificate background image.
 *
 * The filename contains spaces + brackets ("2 page [Recovered]-11.jpg") which
 * break Tailwind's arbitrary-value background-image parser, so it is applied
  * through an inline style while bg-cover and bg-center are
 * kept as Tailwind utilities. The URL is percent-encoded so the spaces and
 * brackets in the filename survive CSS url() parsing.
 *
 * Same visual result as a Tailwind bg-url utility, but parser-proof.
 */
const CERT_BACKGROUND_IMAGE = "/image/2%20page%20%5BRecovered%5D-11.jpg"

/** Round to a clean integer string (certificate marks are whole numbers). */
function fmt(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  return String(Math.round(n))
}

/** Clamp a 1–3 star rating to the supported range. */
function clampRating(value: number | undefined | null): number {
  if (!value || value < 0) return 0
  return Math.min(3, Math.round(value))
}

/** Five-pointed star — solid yellow when filled, hollow outline otherwise. */
function Star({ filled = true, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#eab308' : 'none'}
      stroke="#eab308"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 17.27 18.18 21 17.54 13.47 22 8.74 14.41 7.93 12 2.5 9.59 7.93 2 8.74 6.45 13.47 5.82 21z" />
        </svg>
  )
}

/**
 * Best-effort mapper from the system's result data to the certificate shape.
 *
 *   • exams whose `type` is 'mid' / 'assignment' / 'final' → Term 1 / 2 / 3
 *   • each certificate subject is matched to an exam subject by name alias
 *   • grand-total / average / next-grade / ratings are derived where possible
 *
 * Subjects that can't be matched fall back to 0 so the table always shows six
 * rows (matching the six printed Subject rows in the image).
 */
export function buildCertificateStudent(
  student: Student,
  cls: Class | undefined,
  exams: Exam[],
  options?: {
    nextGrade?: string
    isPromoted?: boolean
    behaviorRating?: number
    attendanceRating?: number
    quranInterestRating?: number
  }
): CertificateStudent {
  const byType: Partial<Record<NonNullable<Exam['type']>, Exam[]>> = {}
  exams.forEach((ex) => {
    if (ex.type) (byType[ex.type] ||= []).push(ex)
  })

  const markFor = (ex: Exam, certSubj: CertificateSubject): number => {
    const aliases = SUBJECT_ALIASES[certSubj]
    const subj = ex.subjects.find((s) =>
      aliases.some((a) => s.toLowerCase().trim() === a.toLowerCase())
    )
    if (!subj) return 0
    return Number(ex.rows?.[student.id]?.marks?.[subj] ?? 0) || 0
  }

  const grades: CertificateSubjectGrade[] = CERTIFICATE_SUBJECTS.map((s) => {
    const term1 = byType['mid']?.reduce((sum, ex) => sum + markFor(ex, s), 0) ?? 0
    const term2 =
      byType['assignment']?.reduce((sum, ex) => sum + markFor(ex, s), 0) ?? 0
    const term3 = byType['final']?.reduce((sum, ex) => sum + markFor(ex, s), 0) ?? 0
    const total = term1 + term2 + term3
    return { subject: s, term1, term2, term3, total }
  })

  const grandTotal = grades.reduce((s, g) => s + g.total, 0)
  // Average = mean score per subject across the terms (whole-number marks).
  const average = grades.length ? grandTotal / grades.length : 0
  // Default: assume promoted when the overall average is passing (>= 50%).
  const isPromoted = options?.isPromoted ?? average >= 50

  return {
    id: student.id,
    name: student.name,
    class: cls?.name ?? student.className ?? '',
    teacherName: cls?.teacherName ?? '',
    academicYear: cls?.academicYear ?? '',
    rollNumber: student.rollNumber,
    photoUrl: student.photoUrl,
    grades,
    grandTotal,
    average,
    nextGrade: options?.nextGrade ?? (cls?.name ?? student.className ?? ''),
    isPromoted,
    behaviorRating: options?.behaviorRating ?? 0,
    attendanceRating: options?.attendanceRating ?? 0,
    quranInterestRating: options?.quranInterestRating ?? 0,
    }
}

/* ═════════════════════════ Demo data ══════════════════════════════════ */

export const DEMO_CERTIFICATE_STUDENT: CertificateStudent = {
  id: 'demo',
  name: 'የተማሪ ስም',
  class: 'ደረጃ ᒪዙኛ',
  teacherName: 'የኡስታዝ/ዛ ስም',
  academicYear: 'የት/ት ዘመን 2017',
  grades: CERTIFICATE_SUBJECTS.map((s) => ({
    subject: s,
    term1: 0,
    term2: 0,
    term3: 0,
    total: 0,
  })),
  grandTotal: 0,
  average: 0,
  nextGrade: 'ደረጃ ᒪዙኛ',
  isPromoted: true,
  behaviorRating: 3,
  attendanceRating: 2,
  quranInterestRating: 3,
}

// Fill the demo totals now that the random marks exist.
DEMO_CERTIFICATE_STUDENT.grades.forEach((g) => {
  g.term1 = 70 + Math.round(Math.random() * 25)
  g.term2 = 65 + Math.round(Math.random() * 30)
  g.term3 = 75 + Math.round(Math.random() * 20)
  g.total = g.term1 + g.term2 + g.term3
})
DEMO_CERTIFICATE_STUDENT.grandTotal = DEMO_CERTIFICATE_STUDENT.grades.reduce(
  (s, g) => s + g.total,
  0
)
DEMO_CERTIFICATE_STUDENT.average = DEMO_CERTIFICATE_STUDENT.grandTotal / 6

/* ═════════════════════════ Component ══════════════════════════════════ */

export interface CertificateOverlayProps {
  student: CertificateStudent
  /** Paint translucent coloured guides over every overlay so you can align
   *  the percentage offsets with the background image. Off by default. */
  debug?: boolean
  className?: string
}

export function CertificateOverlay({
  student,
  debug = false,
  className,
}: CertificateOverlayProps) {
  const grades = useMemo(
    () =>
      student.grades.length
        ? student.grades
        : CERTIFICATE_SUBJECTS.map((s) => ({
            subject: s,
            term1: 0,
            term2: 0,
            term3: 0,
            total: 0,
          })),
    [student.grades]
  )

  // Convenience: return the debug class string only when debug is on.
  const dbg = (color: string) => (debug ? color : '')

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-5xl',
        'aspect-[297/210]',
        'bg-cover bg-center bg-no-repeat',
        className
      )}
      style={{ backgroundImage: `url('${CERT_BACKGROUND_IMAGE}')` }}
    >
      {/* ═══════════════════════════════════════════════════════════
           SECTION 1 — Top-right: student info (2×2 grid)
           Image labels: የተማሪ ስም | ክፍል | የኡስታዝ/ዛ ስም | የት/ት ዘመን
           Approx position: top 8–15%, right 2–5%  — adjust to align —
      ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'absolute top-[15%] right-[5%] grid w-[22%] grid-cols-2 gap-[2%] text-xs font-medium text-gray-800',
          dbg('bg-red-500/20')
        )}
      >
        {/* TL: የተማሪ ስም */}
        <div className="truncate text-center leading-tight">{student.name}</div>
        {/* TR: ክፍል */}
        <div className="truncate text-center leading-tight">{student.class}</div>
        {/* BL: የኡስታዝ/ዛ ስም */}
        <div className="truncate text-center leading-tight">{student.teacherName}</div>
        {/* BR: የት/ት ዘመን */}
        <div className="truncate text-center leading-tight">{student.academicYear}</div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 2 — Centre-right: grades table (6 subjects × 4 cols)
           Cols 1–2 (Subject / Description) are printed in the image, so each
           row is a 6-column grid with the first two cells empty. Data lands
           in Term 1 | Term 2 | Term 3 | Total.
           Approx: top 26–30%, right 2–5%, width 52–55% — adjust to align —
      ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn('absolute top-[30%] right-[5%] w-[52%]', dbg('bg-blue-500/20'))}
      >
        <div className="grid grid-cols-[0.9fr_1.5fr_repeat(4,_1fr)] gap-y-[2.2%] text-xs font-medium text-gray-800">
          {grades.map((g) => (
            <div key={g.subject} className="contents">
              {/* Subject column (printed in image) */}
              <div />
              {/* Description column (printed in image) */}
              <div />
              {/* Term 1 */}
              <div className="text-right leading-tight">{fmt(g.term1)}</div>
              {/* Term 2 */}
              <div className="text-right leading-tight">{fmt(g.term2)}</div>
              {/* Term 3 */}
              <div className="text-right leading-tight">{fmt(g.term3)}</div>
              {/* Total */}
              <div className="text-right font-bold leading-tight">
                {fmt(g.total > 0 ? g.total : g.term1 + g.term2 + g.term3)}
              </div>
              </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 3 — Middle-right: summary
           • two pill boxes on the FAR right: grand-total (top) + average (bottom)
           • a green hollow circle carrying nextGrade (next to the word "ወደ")
           • two stacked small circles for promote status (✓ top = promoted,
             ✓ bottom = not promoted)
           Approx position: bottom 25–28%, right 2–5% — adjust to align —
      ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'absolute bottom-[30%] right-[5%] flex w-[24%] items-center justify-end gap-[3%]',
          dbg('bg-green-500/20')
        )}
      >
        {/* Promote-status circles (stacked; ✓ goes in the active one) */}
        <div className="flex flex-col items-center justify-center gap-[2.5%]">
          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/80 text-[9px] font-bold text-gray-700 shadow">
            {student.isPromoted ? '✓' : ''}
          </div>
          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/80 text-[9px] font-bold text-gray-700 shadow">
            {student.isPromoted ? '' : '✓'}
          </div>
        </div>

        {/* Green hollow circle — next grade (next to "ወደ" in the image) */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-green-600 text-[11px] font-bold text-green-700"
          aria-label="next grade"
        >
          {student.nextGrade || '—'}
        </div>

        {/* Pill boxes — grand total (top) + average (bottom) */}
        <div className="flex flex-col items-center justify-center gap-[3%]">
          <div className="w-full rounded-full bg-white/80 px-3 py-1 text-center text-xs font-bold text-gray-800 shadow">
            {fmt(student.grandTotal)}
          </div>
          <div className="w-full rounded-full bg-white/80 px-3 py-1 text-center text-xs font-bold text-gray-800 shadow">
            {fmt(student.average)}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 4 — Left-side: overall results table
           Uses the white space below the header on the left side of the
           certificate. Shows each subject and its total marks obtained
           (summed across all terms), matching the "overall results" view.
           Approx position: top 13–15%, left 3–6%, width 30–32%
      ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'absolute top-[15%] left-[5%] w-[30%]',
          dbg('bg-purple-500/20')
        )}
      >
        <table className="w-full text-[11px] font-medium text-gray-800">
          <thead>
            <tr className="border-b border-gray-400/50">
              <th className="pb-1 text-left font-semibold uppercase tracking-wide">
                Subject
              </th>
              <th className="pb-1 text-right font-semibold uppercase tracking-wide">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.subject} className="border-b border-gray-300/30">
                <td className="py-[2px] capitalize leading-tight">
                  {g.subject}
                </td>
                <td className="py-[2px] text-right font-bold leading-tight">
                  {fmt(g.total > 0 ? g.total : g.term1 + g.term2 + g.term3)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400/60 font-bold text-gray-900">
              <td className="pt-1 text-left">Grand Total</td>
              <td className="pt-1 text-right">
                {fmt(student.grandTotal)}
              </td>
            </tr>
            <tr className="font-semibold text-gray-800">
              <td className="pb-1 text-left">Average</td>
              <td className="pb-1 text-right">
                {fmt(student.average)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 5 — Bottom-left: evaluation stars (3 rows × 3 stars)
           Each row in the image has 3 empty star outlines; we overlay solid
           yellow stars for the first N (= rating, 1–3).
           Row 1: Behaviour   Row 2: Attendance   Row 3: Qur'an interest
           Approx position: bottom 6–10%, left 40–45% — adjust to align —
      ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'absolute bottom-[10%] left-[45%] flex flex-col items-center gap-[2.5%]',
          dbg('bg-yellow-500/20')
        )}
      >
        {[
          { rating: student.behaviorRating },
          { rating: student.attendanceRating },
          { rating: student.quranInterestRating },
        ].map((row, idx) => (
          <div key={idx} className="flex items-center gap-0.5">
            {debug && <span className="text-[10px] text-gray-400">{idx + 1}</span>}
            {[1, 2, 3].map((i) => (
              <Star key={i} filled={i <= clampRating(row.rating)} size={18} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}






