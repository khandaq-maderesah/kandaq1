'use client'

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'

type ParentPhotoUrls = { father: string; mother: string }
const none: ParentPhotoUrls = { father: '', mother: '' }

/** The optional photos of a student's parents, fetched on demand (they are not part of the student record). */
export function useParentPhotos(studentId: string | undefined): ParentPhotoUrls {
  const [photos, setPhotos] = useState<ParentPhotoUrls>(none)
  useEffect(() => {
    setPhotos(none)
    if (!studentId) return
    let active = true
    rtdb.getParentPhotos(studentId).then((loaded) => {
      if (active && loaded) setPhotos(loaded)
    })
    return () => {
      active = false
    }
  }, [studentId])
  return photos
}
