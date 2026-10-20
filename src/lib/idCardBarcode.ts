/**
 * Barcode & Verification Code Generator for Printable Student ID Cards.
 * Generates crisp, scalable SVG barcodes without heavy external dependencies.
 */

// Code 39 binary patterns for alphanumeric digits
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'bwbwbwBWB', '1': 'BwbwbWbwb', '2': 'bwBwbWbwb', '3': 'BwBwbwbwb',
  '4': 'bwbwBWbwb', '5': 'BwbwBWbwb', '6': 'bwBwBWbwb', '7': 'bwbwbWBwb',
  '8': 'BwbwbWBwb', '9': 'bwBwbWBwb', 'A': 'BwbwbwbWB', 'B': 'bwBwbwbWB',
  'C': 'BwBwbwbWB', 'D': 'bwbwBwbWB', 'E': 'BwbwBwbWB', 'F': 'bwBwBwbWB',
  'G': 'bwbwbwBWB', 'H': 'BwbwbwBWB', 'I': 'bwBwbwBWB', 'J': 'bwbwBwBWB',
  'K': 'BwbwbwbwB', 'L': 'bwBwbwbwB', 'M': 'BwBwbwbwB', 'N': 'bwbwBwbwB',
  'O': 'BwbwBwbwB', 'P': 'bwBwBwbwB', 'Q': 'bwbwbwBwB', 'R': 'BwbwbwBwB',
  'S': 'bwBwbwBwB', 'T': 'bwbwBwBwB', 'U': 'BWbwbwbwb', 'V': 'bWBwbwbwb',
  'W': 'BWBwbwbwb', 'X': 'bWbwBwbwb', 'Y': 'BWbwBwbwb', 'Z': 'bWBwBwbwb',
  '-': 'bWbwbwBwb', '.': 'BWbwbwBwb', ' ': 'bWBwbwBwb', '$': 'bWbWbWbwb',
  '/': 'bWbWbwbWb', '+': 'bWbwbWbWb', '%': 'bwbWbWbWb', '*': 'bWbwBwBwb',
}

export interface BarcodeSvgOptions {
  width?: number
  height?: number
  barWidth?: number
  showText?: boolean
  color?: string
}

/**
 * Generates a standard verification code string for a student.
 * Format: "KMMS-{ROLL}-{ID_HASH}"
 */
export function generateStudentVerificationCode(studentId: string, rollNumber?: string): string {
  const roll = (rollNumber || '00').replace(/[^0-9A-Z]/gi, '').toUpperCase().padStart(2, '0')
  const idHash = (studentId || 'STUDENT').replace(/[^0-9A-Z]/gi, '').toUpperCase().slice(-6)
  return `KMMS-${roll}-${idHash}`
}

/**
 * Encodes text into a Code 39 SVG representation.
 */
export function generateBarcodeSvg(text: string, options: BarcodeSvgOptions = {}): string {
  const {
    height = 40,
    barWidth = 1.5,
    showText = false,
    color = '#000000',
  } = options

  const sanitized = `*${text.toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '')}*`
  let x = 4
  const rects: string[] = []

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i]
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['-']

    for (let p = 0; p < pattern.length; p++) {
      const isBar = p % 2 === 0
      const isWide = pattern[p] === 'B' || pattern[p] === 'W'
      const w = isWide ? barWidth * 2.2 : barWidth

      if (isBar) {
        rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${color}" />`)
      }
      x += w
    }
    // Inter-character space
    x += barWidth
  }

  const totalWidth = Math.ceil(x + 4)
  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${height + 12}" font-family="monospace" font-size="10" text-anchor="middle" fill="${color}">${text}</text>`
    : ''

  const totalHeight = showText ? height + 16 : height

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">${rects.join('')}${textElement}</svg>`
}
