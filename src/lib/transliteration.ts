/**
 * Amharic (Ge'ez) → Latin phonetic transliteration.
 *
 * A pragmatic, standard phonetic mapping of the Ethiopic syllabary (Fidel) used
 * to render Amharic names in Latin script — primarily for SMS messages written
 * in a Latin-script language (e.g. Afaan Oromoo). It is intentionally NOT a
 * perfect, scholarly (BGN/PCGN or EAE) transliteration; it targets common names
 * such as "ኡመር" → "Umar" and "ጀሚላ" → "Jamila".
 *
 * The Ethiopic block (U+1200–U+137F) is ordered by consonant series. Within a
 * series, each character is a syllable whose vowel is determined by the "order":
 *   0 → a, 1 → u, 2 → i, 3 → a, 4 → e, 5 → (bare consonant), 6 → o.
 * Non-Ethiopic characters (spaces, digits, already-Latin letters, punctuation)
 * are passed through unchanged.
 */

/** Vowel produced by each Ethiopic order for a regular consonant. Order 5 (the
 * "bare" kelem) carries no trailing vowel, so the consonant is written alone. */
const VOWELS = ['a', 'u', 'i', 'a', 'e', '', 'o']

/** Vowels for the vowel-only letters (አ, ዐ) — here order 5 keeps an explicit vowel. */
const VOWEL_LETTER_VOWELS = ['a', 'u', 'i', 'a', 'e', 'e', 'o']

// First character (order 1, '-a') of each attested Amharic consonant series,
// mapped to its Latin consonant. Bases are keyed by their Unicode codepoint.
const BASE_CONSONANTS: Record<number, string> = {
  0x1200: 'h', // ሀ
  0x1208: 'l', // ለ
  0x1210: 'h', // ሐ
  0x1218: 'm', // መ
  0x1220: 's', // ሠ
  0x1228: 'r', // ረ
  0x1230: 's', // ሰ
  0x1238: 'sh', // ሸ
  0x1240: 'q', // ቀ (series continues with labialised /ቈ)
  0x1250: 'q', // ቐ
  0x1260: 'b', // በ
  0x1268: 'v', // ቨ
  0x1270: 't', // ተ
  0x1278: 'ch', // ቸ
  0x1280: 'h', // ኀ
  0x1290: 'n', // ነ
  0x1298: 'ny', // ኘ
  0x12a0: '', // አ (vowel letter)
  0x12a8: 'k', // ከ
  0x12b8: 'h', // ኸ
  0x12c8: 'w', // ወ
  0x12d0: '', // ዐ (vowel letter)
  0x12d8: 'z', // ዘ
  0x12e0: 'z', // ዠ
  0x12e8: 'y', // የ
  0x12f0: 'd', // ደ
  0x1300: 'j', // ጀ
  0x1308: 'g', // ገ
  0x1320: 't', // ጠ
  0x1328: 'ch', // ጨ
  0x1330: 'p', // ጰ
  0x1338: 'ts', // ጸ
  0x1340: 'ts', // ፀ
  0x1348: 'f', // ፈ
  0x1350: 'p', // ፐ
}

const ETHIOPIC_FIRST = 0x1200
const ETHIOPIC_LAST = 0x137f

const sortedBases: number[] = Object.keys(BASE_CONSONANTS).map(Number).sort((a, b) => a - b)

/** Transliterate a single Ethiopic character, or null when the codepoint is outside the range. */
function transliterateChar(code: number): string | null {
  if (code < ETHIOPIC_FIRST || code > ETHIOPIC_LAST) return null

  // Find the consonant series this character belongs to (largest base <= code).
  let base = sortedBases[0]
  for (const b of sortedBases) {
    if (b <= code) base = b
    else break
  }

  const consonant = BASE_CONSONANTS[base] ?? ''
  const offset = code - base

  // Anything far past the 7 orders (unassigned codepoints) — drop it.
  if (offset > 15) return ''

  // Labialised second-half of the q-series (ኈ…ቌ / ዀ…) — approximate as <c>wa.
  if (offset >= 8) return consonant === '' ? 'wa' : `${consonant}wa`

  const vowels = consonant === '' ? VOWEL_LETTER_VOWELS : VOWELS
  return consonant + vowels[offset]
}

/**
 * Convert an Amharic name to an equivalent Latin (romanized) form.
 * Returns a friendlier "Title case" string (e.g. "ኡመር" → "Umar").
 */
export function transliterateAmharicToLatin(amharicName?: string): string {
  if (!amharicName) return ''
  let out = ''
  for (const ch of String(amharicName)) {
    const code = ch.codePointAt(0) || 0
    const latin = transliterateChar(code)
    out += latin === null ? ch : latin
  }
  const lower = out.toLowerCase()
  if (!lower) return lower
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}