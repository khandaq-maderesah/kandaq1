// Generates PNG app icons for the PWA from public/image/logo2.jpg
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'public', 'image', 'logo2.jpg')
const outDir = path.join(root, 'public', 'icons')

await mkdir(outDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const t of targets) {
  const img = sharp(src).resize(t.size, t.size, { fit: 'cover' }).png({ compressionLevel: 9 })
  await img.toFile(path.join(outDir, t.file))
  console.log(`Generated ${t.file}`)
}