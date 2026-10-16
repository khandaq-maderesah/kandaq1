'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Megaphone,
  Loader2,
  X,
  Send,
  Trash2,
  Users,
  GraduationCap,
  ShieldCheck,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
} from 'lucide-react'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from '@/lib/firebase/config'
import { cn } from '@/lib/utils'
import type { Announcement, AnnouncementAttachment, AnnouncementAudience } from '@/types'

const AUDIENCES: { value: AnnouncementAudience; icon: typeof Users }[] = [
  { value: 'everyone', icon: Users },
  { value: 'teachers', icon: GraduationCap },
  { value: 'admins', icon: ShieldCheck },
]

/**
 * Announcement bell shown in the app shell top bar (next to the absence and
 * reminder bells). Admins see a publish form inside the panel; everyone sees
 * the scrollable, newest-first list.
 */
export function AnnouncementBell(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: {
    /** @deprecated Kept for backward compatibility; the bell always matches the light top bar. */
    dark?: boolean
  } = {}
) {
  const t = useTranslations('notifications.announcements')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('everyone')
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // While the delete confirmation is open, clicks land in the dialog (outside
  // this container) and must not close the panel.
  const confirmOpenRef = useRef(false)
  confirmOpenRef.current = pendingDelete !== null

  const isAdmin = user?.role === 'admin'

  // Shared store channel — the same announcements list is used by the admin and
  // teacher shells without a second subscription.
  const announcementsData = useLiveData<Announcement[]>('announcements', (emit) => rtdb.subscribeToAnnouncements(emit))
  // Stabilize the fallback reference (same reason as the reminder/absence bells).
  const announcements = useMemo(() => announcementsData.data ?? [], [announcementsData.data])
  useEffect(() => {
    if (announcementsData.data) setLoading(false)
  }, [announcementsData.data])

  // Only show announcements the current user is allowed to see. Admins see
  // everyone/teachers/admins; teachers see everyone/teachers.
  const visible = useMemo(() => {
    const sortedAll = [...announcements].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    const role = user?.role || 'teacher'
    return sortedAll.filter((a) => {
      const target = a.audience ?? 'everyone'
      if (target === 'everyone') return true
      if (role === 'admin') return true // admins can see all
      return target === 'teachers'
    })
  }, [announcements, user?.role])

  const count = visible.length

  // Close the panel when clicking outside or pressing Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (confirmOpenRef.current) return
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmOpenRef.current) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const formatDate = (iso?: string): string => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format.dateTime(d, { dateStyle: 'medium', timeStyle: 'short' })
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setFormError('')
    setUploading(true)

    try {
      const storage = getStorage(app)
      const uploaded: AnnouncementAttachment[] = []

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/\s+/g, '_')
        const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
        const storagePath = `schools/${rtdb.getCurrentSchoolId()}/announcements/${user?.uid ?? 'system'}/${fileId}`
        const storageFileRef = storageRef(storage, storagePath)
        await uploadBytes(storageFileRef, file)
        const url = await getDownloadURL(storageFileRef)

        uploaded.push({
          id: fileId,
          name: file.name,
          url,
          storagePath,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          mimeType: file.type || undefined,
          size: file.size,
        })
      }

      setAttachments((prev) => [...prev, ...uploaded])
      toast.success(t('toast.filesAdded', { count: uploaded.length }))
    } catch (err) {
      console.error('Announcement upload failed', err)
      toast.error(t('toast.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim() || !message.trim()) {
      setFormError(t('form.missingFields'))
      return
    }
    setSaving(true)
    try {
      await rtdb.createAnnouncement({
        title: title.trim(),
        content: message.trim(),
        audience,
        createdById: user?.uid,
        createdByName: user?.name,
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: new Date().toISOString(),
      })
      setTitle('')
      setMessage('')
      setAudience('everyone')
      setAttachments([])
      toast.success(t('toast.published'))
    } catch (err) {
      console.error('Publishing announcement failed', err)
      toast.error(t('toast.publishFailed'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    const annc = pendingDelete
    if (!annc) return
    setDeleting(true)
    try {
      if (annc.attachments?.length) {
        const storage = getStorage(app)
        for (const attachment of annc.attachments) {
          if (attachment.storagePath) {
            try {
              await deleteObject(storageRef(storage, attachment.storagePath))
            } catch {
              // Ignore unsuccessful cleanup for already-missing files.
            }
          }
        }
      }
      await rtdb.deleteAnnouncement(annc.id)
      toast.success(t('toast.deleted'))
      setPendingDelete(null)
    } catch (err) {
      console.error('Deleting announcement failed', err)
      toast.error(t('toast.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== attachmentId))
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="relative text-muted-foreground"
        aria-label={count > 0 ? `${t('label')} (${count})` : t('label')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('label')}
      >
        <Megaphone />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -end-0.5 -top-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-card"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed end-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t('title')}</p>
              <p className="text-xs text-muted-foreground">{t('count', { count })}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              className="-me-1 shrink-0 text-muted-foreground"
              aria-label={tc('actions.close')}
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <Megaphone className="h-6 w-6 text-muted-foreground/60" />
                {t('empty')}
              </div>
            ) : (
              <ul className="divide-y">
                {visible.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold text-foreground">{a.title}</p>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPendingDelete(a)}
                          title={t('delete.action')}
                          aria-label={t('delete.action')}
                          className="-me-1 -mt-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {a.createdAt && <time dateTime={a.createdAt}>{formatDate(a.createdAt)}</time>}
                      {a.audience && a.audience !== 'everyone' && (
                        <Badge variant="secondary">
                          {a.audience === 'teachers' ? <GraduationCap /> : <ShieldCheck />}
                          {t(`audience.${a.audience}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.content}</p>
                    {a.attachments && a.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {a.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t('openAttachment', { name: attachment.name })}
                            className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border bg-card px-2.5 text-xs text-foreground transition-colors hover:bg-muted"
                          >
                            {attachment.type === 'image' ? (
                              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="max-w-[11rem] truncate">{attachment.name}</span>
                            <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    )}
                    {a.createdByName && (
                      <p className="text-xs text-muted-foreground">{t('postedBy', { name: a.createdByName })}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <form onSubmit={handlePublish} className="space-y-3 border-t bg-muted/30 p-4" noValidate>
              <p className="text-sm font-semibold text-foreground">{t('form.heading')}</p>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-title" className="text-xs">
                  {t('form.title')}
                </Label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setFormError('')
                  }}
                  placeholder={t('form.titlePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-message" className="text-xs">
                  {t('form.message')}
                </Label>
                <Textarea
                  id="announcement-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    setFormError('')
                  }}
                  rows={2}
                  placeholder={t('form.messagePlaceholder')}
                  className="resize-y"
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-dashed bg-card p-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('form.attachments')}</p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/50 py-0.5 pe-0.5 ps-2 text-xs text-foreground"
                      >
                        {attachment.type === 'image' ? (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="max-w-[8rem] truncate">{attachment.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeAttachment(attachment.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t('form.removeAttachment', { name: attachment.name })}
                        >
                          <X />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-xs font-medium text-foreground">{t('audience.label')}</legend>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('audience.label')}>
                  {AUDIENCES.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={audience === value}
                      onClick={() => setAudience(value)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        audience === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`audience.${value}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              {formError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => uploadFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={uploading || saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
                  {t('form.addFile')}
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || uploading}>
                  {saving ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
                  {t('form.publish')}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
            <DialogDescription>{t('delete.description', { title: pendingDelete?.title ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              {tc('actions.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {tc('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
