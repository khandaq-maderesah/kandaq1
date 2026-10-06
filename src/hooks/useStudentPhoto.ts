'use client'

/**
 * Resolve a student's photo data-URL.
 *
 * Photos are expensive to ship around (a JPEG data URL is 15-35 KB). They are
 * no longer stored inline in every student record; instead they live under
 * `/studentPhotos/{studentId}` and are fetched only when a photo is actually
 * shown (an avatar for a visible row / the detail card). Results are cached for
 * the session so the same photo is only ever fetched once.
 *
 * Legacy records that still embed the data URL directly on `student.photoUrl`
 * are served from that field (string fragments shaved nothing — RTDB clients
 * cannot project fields, but the migration script moves them out of the node).
 */

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'

const photoCache = new Map<string, string>()

/** True when the stored value is an actual embedded image (legacy records). */
export function isEmbeddedPhoto(photoUrl?: string): boolean {
  return !!photoUrl && photoUrl.startsWith('data:')
}

export function useStudentPhoto(
  studentId: string | undefined | null,
  embeddedPhotoUrl?: string
): string {
  const [url, setUrl] = useState<string>(() => {
    if (isEmbeddedPhoto(embeddedPhotoUrl || '')) return embeddedPhotoUrl as string
    if (studentId && photoCache.has(studentId)) return photoCache.get(studentId) as string
    return ''
  })

  useEffect(() => {
    if (!studentId) {
      setUrl(isEmbeddedPhoto(embeddedPhotoUrl || '') ? (embeddedPhotoUrl as string) : '')
      return
    }
    if (isEmbeddedPhoto(embeddedPhotoUrl || '')) {
      setUrl(embeddedPhotoUrl as string)
      return
    }
    if (photoCache.has(studentId)) {
      setUrl(photoCache.get(studentId) as string)
      return
    }
    let active = true
    rtdb
      .getStudentPhoto(studentId)
      .then((src) => {
        if (src) photoCache.set(studentId, src)
        if (active) setUrl(src || '')
      })
      .catch(() => {
        if (active) setUrl('')
      })
    return () => {
      active = false
    }
  }, [studentId, embeddedPhotoUrl])

  return url
}