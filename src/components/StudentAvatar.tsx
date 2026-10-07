'use client'

import { User2 } from 'lucide-react'
import { useStudentPhoto } from '@/hooks/useStudentPhoto'

interface StudentAvatarProps {
  /** Legacy embedded data-URL (still on very old records); passed through. */
  photoUrl?: string
  /** Student id — enables the lightweight on-demand photo fetch. */
  studentId?: string
  name?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-24 w-24',
}

/**
 * Photo thumbnail for a student. Shows the captured photo when available and a
 * friendly initials/icon fallback otherwise. Uses a plain <img> because student
 * photos are stored as JPEG data URLs (next/image needs a remote loader).
 */
export function StudentAvatar({
  photoUrl,
  studentId,
  name,
  className = '',
  size = 'md',
}: StudentAvatarProps) {
  const box = `${SIZES[size]} ${className}`
  const resolved = useStudentPhoto(studentId, photoUrl)
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={name ? `Photo of ${name}` : 'Student photo'}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <div className={`${box} shrink-0 flex items-center justify-center rounded-full bg-green-100`}>
      <User2 className={size === 'lg' ? 'h-10 w-10 text-green-300' : 'h-5 w-5 text-green-500'} />
    </div>
  )
}