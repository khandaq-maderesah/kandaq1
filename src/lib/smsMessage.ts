/**
 * SMS messages for absent-student notifications.
 *
 * The message is personalised with the student's name, gender and the parent's
 * preferred language. It is always written in the PARENT's language, whatever
 * language the teacher/admin uses the app in.
 */

import { transliterateAmharicToLatin } from './transliteration'

export type ParentGender = 'male' | 'female'
export type ParentLanguage = 'Amharic' | 'Afaan Oromoo' | 'English' | 'Arabic' | 'Somali'

/** Parent language choices, shown by each language's own name. */
export const PARENT_LANGUAGES: { value: ParentLanguage; label: string }[] = [
  { value: 'Amharic', label: 'አማርኛ' },
  { value: 'Afaan Oromoo', label: 'Afaan Oromoo' },
  { value: 'Somali', label: 'Soomaali' },
  { value: 'Arabic', label: 'العربية' },
  { value: 'English', label: 'English' },
]

/** Normalise any stored gender value (e.g. 'male', 'Male', 'M') to the lower-case form. */
export function normalizeGender(gender?: string): ParentGender {
  const g = (gender || '').trim().toLowerCase()
  if (g.startsWith('f')) return 'female'
  if (g.startsWith('m')) return 'male'
  // Fall back to the masculine form for any legacy/unknown gender values.
  return 'male'
}

/** Latin-script form of a (possibly Amharic-script) name, for Latin-script messages. */
function latin(name: string): string {
  return transliterateAmharicToLatin(name) || name || ''
}

/**
 * Build the SMS text sent to a student's parent when a student is absent.
 *
 * Afaan Oromoo grammar rule: when the student's name is used as the subject of
 * the sentence, we append an "n" to the name IF it ends in a vowel
 * (a, e, i, o, u); if it ends in a consonant we do not append anything.
 * Latin-script messages (Afaan Oromoo, Somali, English) transliterate an
 * Amharic-script name first (e.g. "ኡመር" → "Umar").
 *
 * @param studentName The student's full name (may be in Amharic script).
 * @param gender      'male' | 'female' (case-insensitive).
 * @param language    A ParentLanguage (falls back to Amharic).
 * @param school      The sending school (its name opens the message).
 */
export function generateSmsMessage(
  studentName: string,
  gender?: string,
  language?: string,
  school?: { name: string; nameAm?: string } | null
): string {
  const isFemale = normalizeGender(gender) === 'female'
  const schoolName = school?.name ?? 'Khendeq'

  switch (language as ParentLanguage) {
    case 'Afaan Oromoo': {
      const name = latin(studentName)
      const isVowel = ['a', 'e', 'i', 'o', 'u'].includes(name.slice(-1).toLowerCase())
      const subject = isVowel ? `${name}n` : name
      const from = school ? `${school.name} irraa` : 'Madarasaa Khendeq irraa'
      return `${from}\n\nKabajamtoota maatii ${isFemale ? 'barattuu' : 'barataa'} ${name}, guyyaa har'aa ${subject} madarasaa akka hin dhufne isin beeksifna.`
    }

    case 'Somali': {
      // Plural "idin" addresses the family respectfully; uusan/aysan = he/she did not.
      const name = latin(studentName)
      return `Ka socota ${schoolName}\n\nWaalidka sharafta leh ee ${isFemale ? 'ardayda' : 'ardayga'} ${name}, waxaan idin ogeysiinaynaa in ${name} ${isFemale ? 'aysan' : 'uusan'} maanta dugsiga iman.`
    }

    case 'Arabic':
      // وليّ الأمر is the standard school term for parent/guardian.
      return isFemale
        ? `من ${schoolName}\n\nحضرة وليّ أمر الطالبة ${studentName} المحترم،\nنودّ إعلامكم بأنّ ${studentName} تغيّبت عن المدرسة اليوم.`
        : `من ${schoolName}\n\nحضرة وليّ أمر الطالب ${studentName} المحترم،\nنودّ إعلامكم بأنّ ${studentName} تغيّب عن المدرسة اليوم.`

    case 'English': {
      const name = latin(studentName)
      return `From ${schoolName}\n\nDear parent or guardian of ${name}, we would like to let you know that ${name} was absent from school today.`
    }

    default: {
      // Amharic (the name is used as-is, no suffix rule)
      const from = school ? `ከ ${school.nameAm || school.name}` : 'ከ ኸንደቅ መድረሳ'
      return isFemale
        ? `${from}\n\nየተከበራችሁ የ${studentName} ወላጆች፣ ዛሬ ${studentName} መድረሳ አለመምጣቷን እናሳውቃለን።`
        : `${from}\n\nየተከበራችሁ የ${studentName} ወላጆች፣ ዛሬ ${studentName} መድረሳ አለመምጣቱን እናሳውቃለን።`
    }
  }
}
