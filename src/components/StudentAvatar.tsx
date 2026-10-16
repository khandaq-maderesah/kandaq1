'use client'

import { User2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useStudentPhoto } from '@/hooks/useStudentPhoto'
import { cn } from '@/lib/utils'

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
 * Photo thumbnail for a student. Shows the captured photo when available and an
 * icon fallback otherwise. Uses a plain <img> because student photos are stored
 * as JPEG data URLs (next/image needs a remote loader).
 */
export function StudentAvatar({ photoUrl, studentId, name, className = '', size = 'md' }: StudentAvatarProps) {
  const t = useTranslations('students.avatar')
  const resolved = useStudentPhoto(studentId, photoUrl)
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={name ? t('photoOf', { name }) : t('photo')}
        className={cn(SIZES[size], 'shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(SIZES[size], 'flex shrink-0 items-center justify-center rounded-full bg-muted', className)}
      aria-hidden="true"
    >
      <User2 className={cn('text-muted-foreground', size === 'lg' ? 'h-10 w-10' : 'h-4 w-4')} />
    </div>
  )
}
