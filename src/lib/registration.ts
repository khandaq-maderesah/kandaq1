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
import type { CaregiverInfo, GuardianInfo, ParentStatus, Student, StudentSupport, SupportLevel } from '@/types'

// ==================== Form state ====================

export interface GuardianDetails {
  /** Alive / unable to work / deceased / absent. Only the first two have contact details. */
  status: ParentStatus
  name: string
  age: string
  phone: string
  subCity: string
  wereda: string
  kebele: string
  educationLevel: string
  occupation: string
  quranLevel: string
  kitabs: string
  /** Form only: copy the student's sub-city, wereda and kebele on save. */
  sameAddress: boolean
}

/** Who looks after the child; needed when neither parent can be contacted. */
export interface CaregiverDetails {
  relation: string
  name: string
  phone: string
}

/** The private help assessment as edited in the form. 'none' means no record is kept. */
export interface SupportDetails {
  level: 'none' | SupportLevel
  kinds: string[]
  note: string
}

/** Whose number the absence SMS goes to; '' means automatic (father, then mother, then caregiver). */
export type SmsTarget = '' | GuardianKey | 'caregiver'

export interface RegistrationDetails {
  phone: string
  subCity: string
  wereda: string
  kebele: string
  quranLevel: string
  kitabs: string
  lastYearLevel: string
  lastYearResult: string
  occupation: string
  father: GuardianDetails
  mother: GuardianDetails
  caregiver: CaregiverDetails
  smsTo: SmsTarget
  /**
   * The help assessment. null while an existing student's record is still being
   * loaded (or could not be): it is then left untouched on save.
   */
  support: SupportDetails | null
}

export type GuardianKey = 'father' | 'mother'

export const GUARDIAN_KEYS: GuardianKey[] = ['father', 'mother']

export function emptyGuardian(): GuardianDetails {
  return {
    status: 'alive',
    name: '',
    age: '',
    phone: '',
    subCity: '',
    wereda: '',
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
    wereda: '',
    kebele: '',
    quranLevel: '',
    kitabs: '',
    lastYearLevel: '',
    lastYearResult: '',
    occupation: '',
    father: emptyGuardian(),
    mother: emptyGuardian(),
    caregiver: { relation: '', name: '', phone: '' },
    smsTo: '',
    support: emptySupport(),
  }
}

export function emptySupport(): SupportDetails {
  return { level: 'none', kinds: [], note: '' }
}

// ==================== Parent status ====================

/** The choices for a parent's status (fixed list). */
export const PARENT_STATUSES: ParentStatus[] = ['alive', 'unable', 'deceased', 'absent']

/** Who can look after the child when a parent cannot be contacted (fixed list). */
export const CAREGIVER_RELATIONS = ['grandparent', 'uncleAunt', 'sibling', 'otherRelative', 'other'] as const

/** Kinds of help a family may need (fixed list). */
export const SUPPORT_KINDS = ['financial', 'food', 'clothing', 'health', 'housing', 'guidance', 'other'] as const

/** What the student does besides the medreseh (fixed list; the stored value is the key). */
export const STUDENT_OCCUPATIONS = ['student', 'working', 'notWorking'] as const
export type StudentOccupation = (typeof STUDENT_OCCUPATIONS)[number]

export function isStudentOccupation(value: string | undefined): value is StudentOccupation {
  return (STUDENT_OCCUPATIONS as readonly string[]).includes(value ?? '')
}

/** A parent who can be contacted: alive, or unable to work but present. */
export function isReachable(status: ParentStatus | undefined): boolean {
  return (status ?? 'alive') === 'alive' || status === 'unable'
}

export type OrphanKind = 'both' | 'father' | 'mother'

/** Orphan by the parents' recorded status (only a deceased parent counts, not an absent one). */
export function orphanKind(student: Pick<Student, 'father' | 'mother'>): OrphanKind | null {
  const father = student.father?.status === 'deceased'
  const mother = student.mother?.status === 'deceased'
  if (father && mother) return 'both'
  if (father) return 'father'
  if (mother) return 'mother'
  return null
}

// ==================== Required fields ====================

/** Student fields that must be filled (the student's academic status; the class says the madrasa level). */
export const REQUIRED_STUDENT_FIELDS = ['quranLevel'] as const

/** Parent fields that must be filled, for the father and the mother alike. */
export const REQUIRED_GUARDIAN_FIELDS = ['name', 'phone', 'occupation'] as const

export type RequiredStudentField = (typeof REQUIRED_STUDENT_FIELDS)[number]
export type RequiredGuardianField = (typeof REQUIRED_GUARDIAN_FIELDS)[number]

/**
 * The fields a parent must have filled, by status: everything for a living
 * parent, everything but the occupation for one unable to work, and nothing
 * for a parent who has died or is absent.
 */
export function requiredGuardianFields(status: ParentStatus): readonly RequiredGuardianField[] {
  if (status === 'deceased' || status === 'absent') return []
  if (status === 'unable') return REQUIRED_GUARDIAN_FIELDS.filter((f) => f !== 'occupation')
  return REQUIRED_GUARDIAN_FIELDS
}

/** The caregiver is mandatory when neither parent can be contacted (someone must be called). */
export function caregiverRequired(details: Pick<RegistrationDetails, 'father' | 'mother'>): boolean {
  return !isReachable(details.father.status) && !isReachable(details.mother.status)
}

/** The caregiver block is offered as soon as one parent cannot be contacted. */
export function caregiverShown(details: Pick<RegistrationDetails, 'father' | 'mother'>): boolean {
  return !isReachable(details.father.status) || !isReachable(details.mother.status)
}

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
    for (const field of requiredGuardianFields(details[who].status)) {
      if (!details[who][field].trim()) missing.push(`${who}.${field}`)
    }
  }
  if (caregiverRequired(details)) {
    for (const field of ['relation', 'name', 'phone'] as const) {
      if (!details.caregiver[field].trim()) missing.push(`caregiver.${field}`)
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
  // A parent who has died or is absent keeps only the status and (optionally) the name.
  if (!isReachable(g.status)) return { status: g.status, name: clean(g.name) }
  return {
    status: g.status,
    name: clean(g.name),
    age: parseAge(g.age),
    phone: clean(g.phone),
    subCity: g.sameAddress ? clean(student.subCity) : clean(g.subCity),
    wereda: g.sameAddress ? clean(student.wereda) : clean(g.wereda),
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
  const caregiver: CaregiverInfo | null = caregiverShown(details)
    ? { relation: clean(details.caregiver.relation), name: clean(details.caregiver.name), phone: clean(details.caregiver.phone) }
    : null
  // Who is called: the reachable parents first, then the caregiver. The
  // person chosen in "SMS goes to" (if they have a number) goes first.
  const candidates: { key: SmsTarget; info?: { name?: string; phone?: string } }[] = [
    { key: 'father', info: isReachable(details.father.status) ? father : undefined },
    { key: 'mother', info: isReachable(details.mother.status) ? mother : undefined },
    { key: 'caregiver', info: caregiver ?? undefined },
  ]
  const chosen = candidates.find((c) => c.key === details.smsTo && c.info?.phone)
  const ordered = chosen ? [chosen, ...candidates.filter((c) => c !== chosen)] : candidates
  const contacts = ordered.map((c) => c.info)
  const phones = contacts.map((c) => c?.phone ?? '').filter(Boolean)
  const parentPhone = phones[0] ?? ''
  const alternativePhone = phones[1] ?? ''
  const parentName = contacts.map((c) => c?.name ?? '').find(Boolean) ?? ''
  return {
    phone: clean(details.phone),
    subCity: clean(details.subCity),
    wereda: clean(details.wereda),
    kebele: clean(details.kebele),
    quranLevel: clean(details.quranLevel),
    kitabs: clean(details.kitabs),
    lastYearLevel: clean(details.lastYearLevel),
    lastYearResult: clean(details.lastYearResult),
    occupation: clean(details.occupation),
    father,
    mother,
    caregiver,
    smsTo: chosen && chosen.key !== '' ? chosen.key : null,
    parentName,
    parentPhone,
    alternativePhone,
  }
}

function fromGuardianInfo(g: GuardianInfo | undefined, student: Student): GuardianDetails {
  const subCity = g?.subCity ?? ''
  const wereda = g?.wereda ?? ''
  const kebele = g?.kebele ?? ''
  const hasAddress = Boolean(subCity || wereda || kebele)
  return {
    status: g?.status ?? 'alive',
    name: g?.name ?? '',
    age: g?.age !== undefined ? String(g.age) : '',
    phone: g?.phone ?? '',
    subCity,
    wereda,
    kebele,
    educationLevel: g?.educationLevel ?? '',
    occupation: g?.occupation ?? '',
    quranLevel: g?.quranLevel ?? '',
    kitabs: g?.kitabs ?? '',
    // Same address when it matches the student's (or none was recorded yet).
    sameAddress: !hasAddress || (subCity === (student.subCity ?? '') && wereda === (student.wereda ?? '') && kebele === (student.kebele ?? '')),
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
    wereda: student.wereda ?? '',
    kebele: student.kebele ?? '',
    quranLevel: student.quranLevel ?? '',
    kitabs: student.kitabs ?? '',
    lastYearLevel: student.lastYearLevel ?? '',
    lastYearResult: student.lastYearResult ?? '',
    occupation: student.occupation ?? '',
    father,
    mother,
    caregiver: {
      relation: student.caregiver?.relation ?? '',
      name: student.caregiver?.name ?? '',
      phone: student.caregiver?.phone ?? '',
    },
    smsTo: student.smsTo ?? '',
    // The help assessment lives in its own record; the page loads it.
    support: null,
  }
}

// ==================== Help assessment (private record) ====================

/** The form state for a saved assessment (no record = no help needed). */
export function supportFromRecord(record: StudentSupport | null): SupportDetails {
  if (!record) return emptySupport()
  return {
    level: record.level,
    kinds: SUPPORT_KINDS.filter((k) => record.kinds?.[k]),
    note: record.note ?? '',
  }
}

/** The record to save, or null when the student needs no help (the record is removed). */
export function supportToRecord(
  details: SupportDetails,
  by: { uid: string; name?: string },
  now: Date = new Date()
): Omit<StudentSupport, 'studentId'> | null {
  if (details.level === 'none') return null
  const kinds = SUPPORT_KINDS.filter((k) => details.kinds.includes(k))
  const note = details.note.trim()
  return {
    level: details.level,
    kinds: kinds.length > 0 ? Object.fromEntries(kinds.map((k) => [k, true])) : undefined,
    note: note || undefined,
    updatedAt: now.toISOString(),
    updatedBy: by.uid,
    updatedByName: by.name || undefined,
  }
}

/** An assessment not looked at for this many months is flagged for review. */
export const SUPPORT_REVIEW_MONTHS = 6

export function supportNeedsReview(record: Pick<StudentSupport, 'updatedAt'>, now: Date = new Date()): boolean {
  const saved = new Date(record.updatedAt)
  if (Number.isNaN(saved.getTime())) return true
  const limit = new Date(now)
  limit.setMonth(limit.getMonth() - SUPPORT_REVIEW_MONTHS)
  return saved < limit
}

// ==================== Dropdown lists ====================

export const REGISTRATION_LIST_KEYS = ['madrasaLevels', 'quranLevels', 'kitabs', 'parentKitabs', 'educationLevels', 'results'] as const
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
  // The parents' own list; starts like the students' and is edited separately.
  parentKitabs: [
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
export function normalizeRegistrationOptions(raw: unknown, base: RegistrationOptions = DEFAULT_REGISTRATION_OPTIONS): RegistrationOptions {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...base }
  for (const key of REGISTRATION_LIST_KEYS) {
    const list = toList(source[key])
    if (list !== null) out[key] = list
  }
  return out
}

// ==================== Platform lists vs a medreseh's own lists ====================

/**
 * 'platform': the medreseh uses the lists set by the super admin (the default,
 * also for new medresehs). 'own': its admin edits its own lists in Settings.
 */
export type ListsMode = 'platform' | 'own'

/**
 * The mode in force. Nothing chosen yet means the platform lists, except for a
 * medreseh that already saved its own lists before this existed: it keeps them
 * until the super admin decides.
 */
export function effectiveListsMode(mode: unknown, hasOwn: boolean): ListsMode {
  if (mode === 'platform' || mode === 'own') return mode
  return hasOwn ? 'own' : 'platform'
}

/** The lists a medreseh's forms use. Anything a list leaves unset falls back to the platform's, then the built-in starter. */
export function resolveRegistrationOptions(input: { platform: unknown; own: unknown; mode: unknown }): RegistrationOptions {
  const platform = normalizeRegistrationOptions(input.platform)
  const hasOwn = input.own !== null && input.own !== undefined
  return effectiveListsMode(input.mode, hasOwn) === 'own' ? normalizeRegistrationOptions(input.own, platform) : platform
}

// ==================== Kitabs (several per person) ====================

/** "A, B, C" -> ['A', 'B', 'C'] (trimmed, no blanks, no duplicates). */
export function parseKitabs(value: string | undefined): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value.split(/\s*[,;،]\s*/)) {
    const item = raw.trim()
    if (!item || seen.has(item.toLowerCase())) continue
    seen.add(item.toLowerCase())
    out.push(item)
  }
  return out
}

/** ['A', 'B'] -> "A, B" (the stored form). */
export function joinKitabs(list: string[]): string {
  return parseKitabs(list.join(', ')).join(', ')
}
