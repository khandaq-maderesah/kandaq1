'use client'

/**
 * Turns one uploaded logo into every icon the app needs, in the browser
 * (no server work): a transparent square mark for the app, white-backed PWA /
 * iOS icons with safe padding, an Android maskable icon and a favicon.
 */
import type { BrandingFile } from './branding'

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'
export const LOGO_MAX_BYTES = 5 * 1024 * 1024

export class LogoError extends Error {
  constructor(public reason: 'type' | 'size' | 'decode') {
    super(reason)
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new LogoError('decode'))
    }
    img.src = url
  })
}

/** Draws the image centred inside a square, scaled to `scale` of its side. */
function render(img: HTMLImageElement, size: number, scale: number, background: string | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new LogoError('decode')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size, size)
  }
  const w = img.naturalWidth || img.width || size
  const h = img.naturalHeight || img.height || size
  const box = size * scale
  const ratio = Math.min(box / w, box / h)
  const dw = w * ratio
  const dh = h * ratio
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new LogoError('decode'))), 'image/png')
  )
}

/** Validates the upload and generates all branding images (PNG blobs). */
export async function processLogo(file: File): Promise<Record<BrandingFile, Blob>> {
  if (!LOGO_ACCEPT.split(',').includes(file.type)) throw new LogoError('type')
  if (file.size > LOGO_MAX_BYTES) throw new LogoError('size')
  const img = await loadImage(file)
  const [mark, icon192, icon512, maskable512, apple, favicon] = await Promise.all([
    render(img, 512, 1, null),
    render(img, 192, 0.86, '#ffffff'),
    render(img, 512, 0.86, '#ffffff'),
    render(img, 512, 0.68, '#ffffff'), // Android masks may crop to the inner 80%
    render(img, 180, 0.86, '#ffffff'),
    render(img, 64, 1, null),
  ])
  return { mark, icon192, icon512, maskable512, apple, favicon }
}
