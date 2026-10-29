'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ListChecks, Loader2, Save } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { effectiveListsMode, parseListText, REGISTRATION_LIST_KEYS, type RegistrationListKey, type RegistrationOptions } from '@/lib/registration'
import type { School } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'

export default function SuperadminListsPage() {
  const t = useTranslations('superadminTools.lists')
  const tr = useTranslations('registration')
  const schools = useLiveData<School[]>('schools', (emit) => rtdb.subscribeToSchools(emit)).data
  const platform = useLiveData<RegistrationOptions>('platformRegistrationOptions', (emit) => rtdb.subscribeToPlatformRegistrationOptions(emit)).data

  const [text, setText] = useState<Record<RegistrationListKey, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [ownLists, setOwnLists] = useState<Record<string, boolean> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Fill the editor once from the saved platform lists.
  useEffect(() => {
    if (!platform) return
    setText((current) => {
      if (current) return current
      const next = {} as Record<RegistrationListKey, string>
      for (const key of REGISTRATION_LIST_KEYS) next[key] = platform[key].join('\n')
      return next
    })
  }, [platform])

  const sorted = useMemo(() => [...(schools ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [schools])
  const idsKey = sorted.map((s) => s.id).join(',')

  // Which medresehs have lists of their own saved (read once, and after a change).
  const loadOwn = async () => {
    if (!idsKey) {
      setOwnLists({})
      return
    }
    setOwnLists(await rtdb.getSchoolsWithOwnLists(idsKey.split(',')))
  }
  useEffect(() => {
    void loadOwn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text) return
    setSaving(true)
    try {
      const options = {} as RegistrationOptions
      for (const key of REGISTRATION_LIST_KEYS) options[key] = parseListText(text[key])
      await rtdb.savePlatformRegistrationOptions(options)
      toast.success(t('saved'))
    } catch (err) {
      console.error('Saving platform lists failed', err)
      toast.error(t('failed'))
    } finally {
      setSaving(false)
    }
  }

  const setMode = async (school: School, mode: 'platform' | 'own') => {
    setBusyId(school.id)
    try {
      await rtdb.updateSchool(school.id, { listsMode: mode, updatedAt: new Date().toISOString() })
      toast.success(mode === 'platform' ? t('toast.platform', { name: school.name }) : t('toast.own', { name: school.name }))
    } catch (err) {
      console.error('Changing lists mode failed', err)
      toast.error(t('toast.failed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <section className="mb-8 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
          <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('platformTitle')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('platformDescription')}</p>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {REGISTRATION_LIST_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`platform-list-${key}`}>{tr(`lists.${key}`)}</Label>
                <Textarea
                  id={`platform-list-${key}`}
                  rows={6}
                  value={text?.[key] ?? ''}
                  disabled={!text}
                  onChange={(e) => setText((cur) => (cur ? { ...cur, [key]: e.target.value } : cur))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !text}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {t('save')}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-foreground">{t('schoolsTitle')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('schoolsDescription')}</p>

        {schools === undefined || ownLists === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={ListChecks} title={t('noSchools')} />
        ) : (
          <ul className="space-y-2">
            {sorted.map((s) => {
              const hasOwn = ownLists[s.id] === true
              const mode = effectiveListsMode(s.listsMode, hasOwn)
              const state = mode === 'own' ? (hasOwn ? 'ownEdited' : 'ownAllowed') : hasOwn ? 'platformKept' : 'platform'
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={mode === 'own' ? 'info' : 'secondary'}>{t(`state.${state}.label`)}</Badge>
                      <span className="text-xs text-muted-foreground">{t(`state.${state}.hint`)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === s.id}
                    onClick={async () => {
                      await setMode(s, mode === 'own' ? 'platform' : 'own')
                    }}
                  >
                    {busyId === s.id && <Loader2 className="animate-spin" />}
                    {mode === 'own' ? t('usePlatform') : t('allowOwn')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
