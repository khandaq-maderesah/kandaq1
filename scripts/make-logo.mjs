import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Creates public/image/khandaq-logo.png from the raw emblem JPG:
// - crops the centered square around the circular emblem
// - masks it into a perfect circle with a REAL transparent background
//   (the source JPG has a fake checkerboard "transparency" baked in)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'image', 'khandaq-log.jpg')
const out = path.join(root, 'public', 'image', 'khandaq-logo.png')

const meta = await sharp(src).metadata()
const size = Math.min(meta.height, meta.width)
const left = Math.round((meta.width - size) / 2)

const mask = Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
)

// Two passes: sharp runs resize() before composite(), so the crop must be
// finalized to a buffer first for the mask to match its dimensions exactly.
const cropped = await sharp(src)
  .extract({ left, top: 0, width: size, height: size })
  .png()
  .toBuffer()

// Pass 2: erase the baked-in checkerboard "sky" behind the mosque.
// The original PNG's transparency was flattened to white + #CCCCCC squares
// when saved as JPG; inside the emblem window, recolor those neutral grays
// to solid white so the scene looks clean.
const CX = size / 2
const CY = size / 2
const R_SCENE = 160 // radius of the inner scene window (emblem circle)
const { data, info } = await sharp(cropped).raw().toBuffer({ resolveWithObject: true })
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const dx = x - CX
    const dy = y - CY
    if (dx * dx + dy * dy > R_SCENE * R_SCENE) continue
    const i = (y * info.width + x) * 3
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    if (mx - mn <= 12 && mn >= 150 && mx <= 245) {
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
    }
  }
}
const cleaned = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
  .png()
  .toBuffer()

// Pass 3: apply the circular mask (no resize in this pipeline)
const masked = await sharp(cleaned)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()

// Pass 4: downscale to the final display size
await sharp(masked)
  .resize(512, 512)
  .png()
  .toFile(out)

console.log(`Generated ${out} (512x512, circular, transparent)`)
