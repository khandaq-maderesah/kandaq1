/**
 * Builds public/image/khandaq-logo.png from public/image/newlogo2.jpg.
 *
 * - Detects the full content bbox automatically (emblem AND the Amharic
 *   text below it - nothing is cut off)
 * - Composes it onto a square canvas sized so the circle contains the
 *   entire content (circumscribed circle + margin)
 * - Masks that circle with a transparent background
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'image', 'newlogo2.jpg')
const out = path.join(root, 'public', 'image', 'khandaq-logo.png')

const MARGIN = 24 // px padding between content and the circle edge
const THRESH = 60 // channel diff vs background that counts as content
                   // (ignores faint paper texture / watermark stars)

const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

// Background color = average of the four corners
const px = (x, y) => {
  const i = (y * width + x) * channels
  return [data[i], data[i + 1], data[i + 2]]
}
const corners = [px(1, 1), px(width - 2, 1), px(1, height - 2), px(width - 2, height - 2)]
const bg = [0, 1, 2].map((k) => Math.round(corners.reduce((s, c) => s + c[k], 0) / 4))

// Content bounding box (emblem + text)
let minX = width
let minY = height
let maxX = 0
let maxY = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const d = Math.max(
      Math.abs(data[i] - bg[0]),
      Math.abs(data[i + 1] - bg[1]),
      Math.abs(data[i + 2] - bg[2])
    )
    if (d > THRESH) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
minX = Math.max(0, minX - MARGIN)
minY = Math.max(0, minY - MARGIN)
maxX = Math.min(width - 1, maxX + MARGIN)
maxY = Math.min(height - 1, maxY + MARGIN)
const bw = maxX - minX + 1
const bh = maxY - minY + 1

// Circle that covers the whole bbox (its diagonal) - no text gets cut
const side = Math.ceil(Math.hypot(bw, bh)) + 8

console.log('content bbox: ' + bw + 'x' + bh + ' at (' + minX + ',' + minY + ') -> canvas ' + side + 'x' + side)

// Paste the content centered onto a square canvas of the background color
const extracted = await sharp(src)
  .extract({ left: minX, top: minY, width: bw, height: bh })
  .png()
  .toBuffer()

const canvas = await sharp({
  create: { width: side, height: side, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } },
})
  .composite([{ input: extracted, left: Math.round((side - bw) / 2), top: Math.round((side - bh) / 2) }])
  .png()
  .toBuffer()

// Circular mask (no resize in the composite pipeline)
const mask = Buffer.from(
  '<svg width="' + side + '" height="' + side + '"><circle cx="' + side / 2 + '" cy="' + side / 2 + '" r="' + (side / 2 - 3) + '" fill="#fff"/></svg>'
)
const masked = await sharp(canvas)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()

await sharp(masked)
  .resize(512, 512)
  .png()
  .toFile(out)

console.log('Generated ' + out + ' (512x512, circular, transparent, includes emblem + text)')
