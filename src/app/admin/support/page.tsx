'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, ClipboardCheck, Download, HeartHandshake, Loader2, Pencil, Phone, Search, Users } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import {
  SUPPORT_KINDS,
  supportFromRecord,
  supportToRecord,
  type SupportDetails,
} from '@/lib/registration'
import {
  buildSupportRows,
  countSupportRows,
  filterSupportRows,
  type SupportFilter,
  type SupportRow,
} from '@/lib/supportList'
import { SupportFields } from '@/components/students/FamilyInfoFields'
import type { Student, StudentSupport } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const FILTERS: SupportFilter[] = ['all', 'orphans', 'needs', 'urgent', 'review']

export default function SupportPage() {
  const t = useTranslations('adminSupport')
  const tr = useTranslations('registration')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { user } = useAuth()

  const students = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit)).data
  const supports = useLiveData<StudentSupport[]>('studentSupport', (emit) => rtdb.subscribeToStudentSupport(emit)).data

  const [filter, setFilter] = useState<SupportFilter>('all')
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<SupportRow | null>(null)
  const [draft, setDraft] = useState<SupportDetails>({ level: 'none', kinds: [], note: '' })
  const [saving, setSaving] = useState(false)

  const loading = students === undefined || supports === undefined
  const rows = useMemo(() => buildSupportRows(students ?? [], supports ?? []), [students, supports])
  const counts = useMemo(() => countSupportRows(rows), [rows])
  const shown = useMemo(() => filterSupportRows(rows, { filter, kind, search }), [rows, filter, kind, search])

  const orphanLabel = (r: SupportRow) => (r.orphan ? tr(`orphan.${r.orphan}`) : '')
  const kindsLabel = (record: StudentSupport | null) =>
    SUPPORT_KINDS.filter((k) => record?.kinds?.[k])
      .map((k) => tr(`supportKinds.${k}`))
      .join(', ')
  const reviewedLabel = (record: StudentSupport | null) =>
    record
      ? t('reviewed', { date: format.dateTime(new Date(record.updatedAt), { day: 'numeric', month: 'short', year: 'numeric' }) })
      : ''

  const startEdit = (row: SupportRow) => {
    setEditing(row)
    setDraft(supportFromRecord(row.support))
  }

  const save = async () => {
    if (!editing || !user) return
    setSaving(true)
    try {
      await rtdb.setStudentSupport(editing.student.id, supportToRecord(draft, { uid: user.uid, name: user.name }))
      toast.success(t('toast.saved', { name: editing.student.name }))
      setEditing(null)
    } catch {
      toast.error(t('toast.failed'))
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    exportToCsv(
      `family-support-${dateStamp()}.csv`,
      [t('csv.name'), t('csv.class'), t('csv.orphan'), t('csv.level'), t('csv.kinds'), t('csv.contact'), t('csv.phone'), t('csv.note'), t('csv.reviewed')],
      shown.map((r) => [
        r.student.name,
        r.student.className ?? '',
        orphanLabel(r),
        r.support ? tr(`supportLevels.${r.support.level}`) : t('notAssessed'),
        kindsLabel(r.support),
        r.student.parentName ?? '',
        r.student.parentPhone ?? '',
        r.support?.note ?? '',
        r.support ? r.support.updatedAt.slice(0, 10) : '',
      ])
    )
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={shown.length === 0}>
            <Download /> {tc('actions.exportCsv')}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('stats.orphans')} value={counts.orphans} icon={Users} onClick={() => setFilter('orphans')} />
        <StatCard label={t('stats.needs')} value={counts.needs} icon={HeartHandshake} tone="warning" onClick={() => setFilter('needs')} />
        <StatCard label={t('stats.urgent')} value={counts.urgent} icon={AlertTriangle} tone="destructive" onClick={() => setFilter('urgent')} />
        <StatCard label={t('stats.review')} value={counts.review} icon={ClipboardCheck} tone="info" onClick={() => setFilter('review')} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Label htmlFor="support-search" className="sr-only">
            {t('searchLabel')}
          </Label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="support-search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="w-full sm:w-52">
          <Label htmlFor="support-filter" className="sr-only">
            {t('filterLabel')}
          </Label>
          <Select id="support-filter" value={filter} onChange={(e) => setFilter(e.target.value as SupportFilter)}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {t(`filters.${f}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-56">
          <Label htmlFor="support-kind" className="sr-only">
            {t('kindLabel')}
          </Label>
          <Select id="support-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t('anyKind')}</option>
            {SUPPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {tr(`supportKinds.${k}`)}
              </option>
            ))}
          </Select>
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground sm:ms-auto">{t('summary', { shown: shown.length, total: rows.length })}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={rows.length === 0 ? t('empty.title') : t('empty.filtered')}
          description={rows.length === 0 ? t('empty.description') : undefined}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((r) => (
            <li key={r.student.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.student.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[r.student.className, r.student.section].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={t('edit', { name: r.student.name })} onClick={() => startEdit(r)}>
                  <Pencil />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.orphan && <Badge variant="info">{orphanLabel(r)}</Badge>}
                {r.support ? (
                  <Badge variant={r.support.level === 'urgent' ? 'destructive' : 'warning'}>{tr(`supportLevels.${r.support.level}`)}</Badge>
                ) : (
                  <Badge variant="secondary">{t('notAssessed')}</Badge>
                )}
                {r.review && <Badge variant="outline">{t('reviewDue')}</Badge>}
              </div>

              {r.support && kindsLabel(r.support) && <p className="mt-3 text-sm text-foreground">{kindsLabel(r.support)}</p>}
              {r.support?.note && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.support.note}</p>}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{reviewedLabel(r.support)}</span>
                {r.student.parentPhone && (
                  <a href={`tel:${r.student.parentPhone}`} dir="ltr" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" />
                    {r.student.parentName ? `${r.student.parentName} · ` : ''}
                    {r.student.parentPhone}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.title', { name: editing?.student.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <SupportFields idPrefix="support-edit" value={draft} onChange={setDraft} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t('dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
