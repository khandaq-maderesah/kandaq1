'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import type { Announcement, AnnouncementAttachment, AnnouncementAudience } from '@/types'

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  everyone: 'Everyone',
  teachers: 'Teachers only',
  admins: 'Admins only',
}

const formatDate = (iso?: string): string => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Collapsible "Megaphone" announcement bell shown in the navbars (like the
 * absence/reminder bells). Admins see a publish form inside the dropdown;
 * everyone sees the scrollable, newest-first list.
 */
export function AnnouncementBell({ dark = true }: { dark?: boolean }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('everyone')
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Shared store channel — the same announcements list is used by the admin and
  // teacher navs without a second subscription.
  const announcementsData = useLiveData<Announcement[]>(
    'announcements',
    (emit) => rtdb.subscribeToAnnouncements(emit)
  )
  // Stabilize the fallback reference (same reason as the reminder/absence bells).
  const announcements = useMemo(() => announcementsData.data ?? [], [announcementsData.data])
  useEffect(() => {
    if (announcementsData.data) setLoading(false)
  }, [announcementsData.data])

  // Only show announcements the current user is allowed to see. Admins see
  // everyone/teachers/admins; teachers see everyone/teachers.
  const visible = useMemo(() => {
    const sortedAll = [...announcements].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    )
    const role = user?.role || 'teacher'
    return sortedAll.filter((a) => {
      const target = a.audience ?? 'everyone'
      if (target === 'everyone') return true
      if (role === 'admin') return true // admins can see all
      return target === 'teachers'
    })
  }, [announcements, user?.role])

  const count = visible.length

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    setSuccess('')
    setUploading(true)

    try {
      const storage = getStorage(app)
      const uploaded: AnnouncementAttachment[] = []

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/\s+/g, '_')
        const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
        const storagePath = `announcements/${user?.uid ?? 'system'}/${fileId}`
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
      setSuccess(files.length > 1 ? `${files.length} files added to the announcement.` : 'File added to the announcement.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!title.trim() || !message.trim()) {
      setError('Please add both a title and a message.')
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
      setSuccess('Announcement published.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish announcement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (annc: Announcement) => {
    if (!confirm(`Delete announcement "${annc.title}"? This cannot be undone.`)) return
    setError('')
    setSuccess('')
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement.')
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== attachmentId))
  }


  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Announcements"
        title="Announcements"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${
          dark
            ? 'bg-white/15 text-white hover:bg-white hover:text-green-600'
            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Megaphone className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-2 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <span className="inline-flex items-center justify-center rounded-lg bg-green-100 p-1.5">
              <Megaphone className="h-4 w-4 text-green-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Announcements</p>
              <p className="text-xs text-gray-500">Latest messages from the administration</p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-gray-500">
                <Megaphone className="h-6 w-6 text-gray-300" />
                No announcements for you yet.
              </div>
            ) : (
              visible.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 border-b border-gray-50 px-4 py-3 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                    <span className="flex items-center gap-2">
                      {a.audience && a.audience !== 'everyone' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                          {a.audience === 'teachers' ? (
                            <GraduationCap className="h-3 w-3" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          {AUDIENCE_LABELS[a.audience] || a.audience}
                        </span>
                      )}
                      <span className="whitespace-nowrap text-xs text-gray-400">
                        {formatDate(a.createdAt)}
                      </span>
                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          title="Delete announcement"
                          aria-label="Delete announcement"
                          className="rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.content}</p>
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {attachment.type === 'image' ? (
                            <ImageIcon className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-gray-500" />
                          )}
                          <span className="max-w-[180px] truncate">{attachment.name}</span>
                          <Download className="h-3 w-3 text-gray-400" />
                        </a>
                      ))}
                    </div>
                  )}
                  {a.createdByName && (
                    <p className="text-xs text-gray-400">Posted by {a.createdByName}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {user?.role === 'admin' && (
            <form onSubmit={handlePublish} className="space-y-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
              {success && <p className="text-xs font-medium text-emerald-600">{success}</p>}
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setError('')
                }}
                placeholder="Announcement title"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setError('')
                }}
                rows={2}
                placeholder="Write the message..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
              />

              {attachments.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-gray-200 bg-white p-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Attached files</p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"
                      >
                        {attachment.type === 'image' ? (
                          <ImageIcon className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-gray-500" />
                        )}
                        <span className="max-w-[120px] truncate">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="text-gray-400 hover:text-red-600"
                          aria-label={`Remove ${attachment.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Who can see this</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(['everyone', 'teachers', 'admins'] as AnnouncementAudience[]).map((opt) => {
                    const Icon = opt === 'everyone' ? Users : opt === 'teachers' ? GraduationCap : ShieldCheck
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAudience(opt)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          audience === opt
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {AUDIENCE_LABELS[opt]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  className="hidden"
                  onChange={(e) => uploadFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={uploading || saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Paperclip className="h-4 w-4 mr-2" />
                  )}
                  Add Image/File
                </Button>
                <Button type="submit" size="sm" className="flex-1" disabled={saving || uploading}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Publish Announcement
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2">
            <span className="text-xs text-gray-400">
              {count > 0 ? `${count} announcement${count > 1 ? 's' : ''}` : 'No announcements'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

