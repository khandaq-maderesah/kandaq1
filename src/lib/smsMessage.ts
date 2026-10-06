/**
 * SMS messages for absent-student notifications.
 *
 * The message is personalised with the student's name, gender and the parent's
 * preferred language (Amharic or Afaan Oromoo).
 */

import { transliterateAmharicToLatin } from './transliteration'

export type ParentGender = 'male' | 'female'
export type ParentLanguage = 'Amharic' | 'Afaan Oromoo'

/** Normalise any stored gender value (e.g. 'male', 'Male', 'M') to the lower-case form. */
export function normalizeGender(gender?: string): ParentGender {
  const g = (gender || '').trim().toLowerCase()
  if (g.startsWith('f')) return 'female'
  if (g.startsWith('m')) return 'male'
  // Fall back to the masculine form for any legacy/unknown gender values.
  return 'male'
}

/**
 * Build the SMS text sent to a student's parent when a student is absent.
 *
 * Afaan Oromoo grammar rule: when the student's name is used as the subject of
 * the sentence, we append an "n" to the name IF it ends in a vowel
 * (a, e, i, o, u); if it ends in a consonant we do not append anything.
 * Because the Oromoo message is written in Latin script, the Amharic name is
 * first transliterated to Latin (e.g. "ኡመር" → "Umar") before the rule is applied.
 *
 * @param studentName The student's full name (may be in Amharic script).
 * @param gender      'male' | 'female' (case-insensitive).
 * @param language    'Amharic' | 'Afaan Oromoo' (falls back to Amharic).
 */
export function generateSmsMessage(
  studentName: string,
  gender?: string,
  language?: string
): string {
  const isFemale = normalizeGender(gender) === 'female'

  if (language === 'Afaan Oromoo') {
    // Convert the Amharic name to Latin, then apply the nominative vowel rule.
    const latinName = transliterateAmharicToLatin(studentName) || (studentName || '')
    const lastChar = latinName.slice(-1).toLowerCase()
    const isVowel = ['a', 'e', 'i', 'o', 'u'].includes(lastChar)
    const oromoSubjectName = isVowel ? `${latinName}n` : latinName

    return isFemale
      ? `Madarasaa Ansaar irraa\n\nKabajamtoota maatii barattuu ${latinName}, guyyaa har'aa ${oromoSubjectName} madarasaa akka hin dhufne isin beeksifna.`
      : `Madarasaa Ansaar irraa\n\nKabajamtoota maatii barataa ${latinName}, guyyaa har'aa ${oromoSubjectName} madarasaa akka hin dhufne isin beeksifna.`
  }

  // Default language: Amharic (the name is used as-is, no suffix rule)
  return isFemale
    ? `ከአንሳር መድረሳ\n\nየተከበራችሁ የ${studentName} ወላጆች፣ ዛሬ ${studentName} መድረሳ አለመምጣቷን እናሳውቃለን።`
    : `ከአንሳር መድረሳ\n\nየተከበራችሁ የ${studentName} ወላጆች፣ ዛሬ ${studentName} መድረሳ አለመምጣቱን እናሳውቃለን።`
}