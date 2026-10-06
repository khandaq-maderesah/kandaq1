import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Creates public/image/khandaq-logo.png from the raw emblem PHOTO:
// - crops the centered square around the circular emblem
//   (the emblem sits in the middle of a 1376x768 photo on paper/wood)
// - masks it into a perfect circle with a transparent background,
//   so only the round emblem remains
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'image', 'khandaq-log.jpg')
const out = path.join(root, 'public', 'image', 'khandaq-logo.png')

const meta = await sharp(src).metadata()
const size = Math.min(meta.height, meta.width)
const left = Math.round((meta.width - size) / 2)

// Slightly inside the crop edge so no paper/background halo is visible
const MASK_R = Math.round(size / 2) - 4

const mask = Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${MASK_R}" fill="#fff"/></svg>`
)

// Pass 1: centered square crop (sharp runs resize() before composite(), so
// the crop must be finalized to a buffer first for the mask to match).
const cropped = await sharp(src)
  .extract({ left, top: 0, width: size, height: size })
  .png()
  .toBuffer()

// Pass 2: apply the circular mask (no resize in this pipeline)
const masked = await sharp(cropped)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()

// Pass 3: downscale to the final display size
await sharp(masked)
  .resize(512, 512)
  .png()
  .toFile(out)

console.log(`Generated ${out} (512x512, circular, transparent, r=${MASK_R})`)
