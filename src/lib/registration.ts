/**
 * Student registration form (family information).
 *
 * Mirrors the madrasa's paper registration sheet: the student, the father and
 * the mother, each with contact, address and academic details. This module is
 * pure (no React, no Firebase) so the rules can be unit tested:
 *  - which fields are required,
 *  - how the form maps onto the student record (and back),
 *  - the editable option lists behind the level dropdowns.
 */
import type { GuardianInfo, Student } from '@/types'

// ==================== Form state ====================

export interface GuardianDetails {
  name: string
  age: string
  phone: string
  subCity: string
  kebele: string
  educationLevel: string
  occupation: string
  quranLevel: string
  kitabs: string
  /** Form only: copy the student's sub-city and kebele on save. */
  sameAddress: boolean
}

export interface RegistrationDetails {
  phone: string
  subCity: string
  kebele: string
  quranLevel: string
  kitabs: string
  lastYearLevel: string
  lastYearResult: string
  occupation: string
  father: GuardianDetails
  mother: GuardianDetails
}

export type GuardianKey = 'father' | 'mother'

export const GUARDIAN_KEYS: GuardianKey[] = ['father', 'mother']

export function emptyGuardian(): GuardianDetails {
  return {
    name: '',
    age: '',
    phone: '',
    subCity: '',
    kebele: '',
    educationLevel: '',
    occupation: '',
    quranLevel: '',
    kitabs: '',
    sameAddress: true,
  }
}

export function emptyRegistration(): RegistrationDetails {
  return {
    phone: '',
    subCity: '',
    kebele: '',
    quranLevel: '',
    kitabs: '',
    lastYearLevel: '',
    lastYearResult: '',
    occupation: '',
    father: emptyGuardian(),
    mother: emptyGuardian(),
  }
}

// ==================== Required fields ====================

/** Student fields that must be filled (the student's academic status; the class says the madrasa level). */
export const REQUIRED_STUDENT_FIELDS = ['quranLevel'] as const

/** Parent fields that must be filled, for the father and the mother alike. */
export const REQUIRED_GUARDIAN_FIELDS = ['name', 'phone', 'occupation', 'educationLevel', 'quranLevel'] as const

export type RequiredStudentField = (typeof REQUIRED_STUDENT_FIELDS)[number]
export type RequiredGuardianField = (typeof REQUIRED_GUARDIAN_FIELDS)[number]

/**
 * Keys of the required fields that are still empty, e.g. 'madrasaLevel',
 * 'father.phone'. Empty means the form may not be saved.
 */
export function missingRegistrationFields(details: RegistrationDetails): string[] {
  const missing: string[] = []
  for (const field of REQUIRED_STUDENT_FIELDS) {
    if (!details[field].trim()) missing.push(field)
  }
  for (const who of GUARDIAN_KEYS) {
    for (const field of REQUIRED_GUARDIAN_FIELDS) {
      if (!details[who][field].trim()) missing.push(`${who}.${field}`)
    }
  }
  return missing
}

// ==================== Record mapping ====================

const clean = (value: string) => value.trim()

function parseAge(value: string): number | undefined {
  const n = Number(value)
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
}

function toGuardianInfo(g: GuardianDetails, student: RegistrationDetails): GuardianInfo {
  return {
    name: clean(g.name),
    age: parseAge(g.age),
    phone: clean(g.phone),
    subCity: g.sameAddress ? clean(student.subCity) : clean(g.subCity),
    kebele: g.sameAddress ? clean(student.kebele) : clean(g.kebele),
    educationLevel: clean(g.educationLevel),
    occupation: clean(g.occupation),
    quranLevel: clean(g.quranLevel),
    kitabs: clean(g.kitabs),
  }
}

/**
 * The student record fields written from the form. The father's phone also
 * fills the existing `parentPhone` and the mother's the `alternativePhone`
 * (SMS and absence calls keep working unchanged); `parentName` is the father.
 */
export function registrationToStudentFields(details: RegistrationDetails): Partial<Student> {
  const father = toGuardianInfo(details.father, details)
  const mother = toGuardianInfo(details.mother, details)
  const parentPhone = father.phone || mother.phone || ''
  const alternativePhone = father.phone ? mother.phone || '' : ''
  return {
    phone: clean(details.phone),
    subCity: clean(details.subCity),
    kebele: clean(details.kebele),
    quranLevel: clean(details.quranLevel),
    kitabs: clean(details.kitabs),
    lastYearLevel: clean(details.lastYearLevel),
    lastYearResult: clean(details.lastYearResult),
    occupation: clean(details.occupation),
    father,
    mother,
    parentName: father.name || mother.name || '',
    parentPhone,
    alternativePhone,
  }
}

function fromGuardianInfo(g: GuardianInfo | undefined, student: Student): GuardianDetails {
  const subCity = g?.subCity ?? ''
  const kebele = g?.kebele ?? ''
  const hasAddress = Boolean(subCity || kebele)
  return {
    name: g?.name ?? '',
    age: g?.age !== undefined ? String(g.age) : '',
    phone: g?.phone ?? '',
    subCity,
    kebele,
    educationLevel: g?.educationLevel ?? '',
    occupation: g?.occupation ?? '',
    quranLevel: g?.quranLevel ?? '',
    kitabs: g?.kitabs ?? '',
    // Same address when it matches the student's (or none was recorded yet).
    sameAddress: !hasAddress || (subCity === (student.subCity ?? '') && kebele === (student.kebele ?? '')),
  }
}

/** The form state for editing an existing student. */
export function registrationFromStudent(student: Student): RegistrationDetails {
  const father = fromGuardianInfo(student.father, student)
  const mother = fromGuardianInfo(student.mother, student)
  // Students registered before this form only have the old parent phones.
  if (!student.father && !student.mother) {
    father.name = student.parentName ?? ''
    father.phone = student.parentPhone ?? ''
    mother.phone = student.alternativePhone ?? ''
  }
  return {
    phone: student.phone ?? '',
    subCity: student.subCity ?? '',
    kebele: student.kebele ?? '',
    quranLevel: student.quranLevel ?? '',
    kitabs: student.kitabs ?? '',
    lastYearLevel: student.lastYearLevel ?? '',
    lastYearResult: student.lastYearResult ?? '',
    occupation: student.occupation ?? '',
    father,
    mother,
  }
}

// ==================== Dropdown lists ====================

export const REGISTRATION_LIST_KEYS = ['madrasaLevels', 'quranLevels', 'kitabs', 'educationLevels', 'results'] as const
export type RegistrationListKey = (typeof REGISTRATION_LIST_KEYS)[number]
export type RegistrationOptions = Record<RegistrationListKey, string[]>

/** Starting lists; the madrasa admin edits them in Settings. */
export const DEFAULT_REGISTRATION_OPTIONS: RegistrationOptions = {
  madrasaLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'],
  quranLevels: [
    "Qa'ida",
    'Juz Amma',
    'Nazira (reading)',
    'Hifz - 5 Juz',
    'Hifz - 10 Juz',
    'Hifz - 15 Juz',
    'Hifz - 20 Juz',
    'Hifz - 30 Juz (Hafiz)',
  ],
  kitabs: [
    "Qa'ida",
    'Juz Amma',
    'Safinat al-Najah',
    "Matn Abi Shuja' (al-Ghayah wa al-Taqrib)",
    "Al-Arba'in al-Nawawiyyah",
    'Riyad al-Salihin',
    'Al-Ajurrumiyyah',
    'Alfiyyat Ibn Malik',
  ],
  educationLevels: ['None', 'Primary (1-8)', 'Secondary (9-12)', 'Certificate / Diploma', 'Degree', 'Masters or above'],
  results: ['Excellent', 'Very good', 'Good', 'Pass', 'Fail'],
}

/** Turns "one entry per line" text into a clean list (trimmed, no blanks, no duplicates). */
export function parseListText(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || seen.has(line.toLowerCase())) continue
    seen.add(line.toLowerCase())
    out.push(line)
  }
  return out
}

function toList(value: unknown): string[] | null {
  if (value === null || value === undefined) return null
  const items = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value as object) : null
  if (!items) return null
  return parseListText(items.filter((v) => typeof v === 'string').join('\n'))
}

/**
 * The lists as stored in the database, completed with the defaults for any
 * list the madrasa has not set (an empty saved list stays empty on purpose).
 */
export function normalizeRegistrationOptions(raw: unknown): RegistrationOptions {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...DEFAULT_REGISTRATION_OPTIONS }
  for (const key of REGISTRATION_LIST_KEYS) {
    const list = toList(source[key])
    if (list !== null) out[key] = list
  }
  return out
}
