'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, FlipHorizontal2, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FacingMode = 'user' | 'environment'

interface StudentPhotoCaptureProps {
  /** Current photo as a JPEG data URL ('' when no photo yet). */
  value: string
  onChange: (dataUrl: string) => void
}

// Photos are compressed here so they stay small enough to live inside the
// Realtime Database alongside the student record (no Firebase Storage / rules
// republish required). 360px is crisp enough for a student card on a phone,
// while each photo is typically only ~15-35 KB.
const MAX_DIMENSION = 360
const JPEG_QUALITY = 0.62

function toResizedJpeg(source: CanvasImageSource, w: number, h: number): string {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h))
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/**
 * Take a student photo straight from the phone camera (front/"selfie" camera or
 * the back camera - flip any time), with a gallery/file fallback for desktops.
 */
export function StudentPhotoCapture({ value, onChange }: StudentPhotoCaptureProps) {
  const t = useTranslations('students.photo')
  const tc = useTranslations('common.actions')
  const [open, setOpen] = useState(false)
  const [facing, setFacing] = useState<FacingMode>('user')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setOpen(false)
  }, [])

  const startCamera = useCallback(
    async (mode: FacingMode) => {
      setError('')
      setStarting(true)
      stopCamera()
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        })
        streamRef.current = stream
        setFacing(mode)
        setOpen(true)
        // Attach the stream to the <video> element after React has rendered it.
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play?.().catch(() => {})
          }
        })
      } catch {
        setError(t('cameraUnavailable'))
        setOpen(false)
      } finally {
        setStarting(false)
      }
    },
    [stopCamera, t]
  )

  // Always stop the camera when the component unmounts.
  useEffect(() => () => stopCamera(), [stopCamera])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const dataUrl = toResizedJpeg(video, video.videoWidth, video.videoHeight)
    if (!dataUrl) return
    onChange(dataUrl)
    stopCamera()
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('notImage'))
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const dataUrl = toResizedJpeg(img, img.naturalWidth, img.naturalHeight)
        if (dataUrl) onChange(dataUrl)
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {value && !open ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={t('capturedAlt')}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => startCamera(facing)}>
                <RefreshCw /> {t('retake')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onChange('')}
              >
                <Trash2 /> {t('remove')}
              </Button>
            </div>
          </>
        ) : open ? (
          <>
            <div className="relative w-44 shrink-0 overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-32 w-44 object-cover" />
              <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {facing === 'user' ? t('frontCamera') : t('backCamera')}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button type="button" size="sm" onClick={capture}>
                <Camera /> {t('take')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startCamera(facing === 'user' ? 'environment' : 'user')}
              >
                <FlipHorizontal2 /> {t('flip')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
                <X /> {tc('cancel')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-muted">
              <Camera className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={starting} onClick={() => startCamera('user')}>
                {starting ? <Loader2 className="animate-spin" /> : <Camera />}
                {t('take')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> {t('upload')}
              </Button>
            </div>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <p className="mt-2 text-xs text-muted-foreground">{t('hint')}</p>

      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
