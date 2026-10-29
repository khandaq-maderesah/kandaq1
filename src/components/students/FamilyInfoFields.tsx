'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { KitabsPicker } from '@/components/students/KitabsPicker'
import {
  CAREGIVER_RELATIONS,
  GUARDIAN_KEYS,
  PARENT_STATUSES,
  REQUIRED_STUDENT_FIELDS,
  SUPPORT_KINDS,
  caregiverRequired,
  caregiverShown,
  isReachable,
  requiredGuardianFields,
  type CaregiverDetails,
  type GuardianDetails,
  type GuardianKey,
  type RegistrationDetails,
  type RegistrationOptions,
  type RequiredGuardianField,
  type SupportDetails,
} from '@/lib/registration'
import type { ParentStatus } from '@/types'

const OTHER = '__other__'

/** Marks a required field's label with an asterisk. */
function RequiredMark() {
  const t = useTranslations('registration')
  return (
    <span className="ms-0.5 text-destructive" aria-label={t('required')}>
      *
    </span>
  )
}

/**
 * A dropdown fed by a madrasa-editable list, with an "Other…" choice that
 * reveals a text box for a value that is not listed yet. The value is always
 * a plain string, so the record never depends on the list.
 */
export function LevelSelect({
  id,
  label,
  value,
  onChange,
  options,
  required,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
  className?: string
}) {
  const t = useTranslations('registration')
  const listed = value !== '' && options.includes(value)
  const [other, setOther] = useState(value !== '' && !listed)

  // A value loaded later (edit mode) or chosen from the list drives the mode.
  useEffect(() => {
    if (value === '') return
    setOther(!options.includes(value))
  }, [value, options])

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <Select
        id={id}
        value={other ? OTHER : value}
        required={required}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true)
            onChange('')
            return
          }
          setOther(false)
          onChange(e.target.value)
        }}
      >
        <option value="">{t('placeholders.select')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER}>{t('other')}</option>
      </Select>
      {other && (
        <Input
          id={`${id}-other`}
          aria-label={`${label} (${t('other')})`}
          placeholder={t('placeholders.other')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus
        />
      )}
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-t pt-4 sm:col-span-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function GuardianFields({
  who,
  idPrefix,
  value,
  onChange,
  options,
}: {
  who: GuardianKey
  idPrefix: string
  value: GuardianDetails
  onChange: (next: GuardianDetails) => void
  options: RegistrationOptions
}) {
  const t = useTranslations('registration')
  const id = (field: string) => `${idPrefix}-${who}-${field}`
  const set = <K extends keyof GuardianDetails>(field: K, v: GuardianDetails[K]) => onChange({ ...value, [field]: v })
  const mandatory = requiredGuardianFields(value.status)
  const required = (field: RequiredGuardianField) => mandatory.includes(field)
  const reachable = isReachable(value.status)

  return (
    <>
      <SectionTitle title={t(`sections.${who}`)} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('status')}>{t('fields.status')}</Label>
        <Select id={id('status')} value={value.status} onChange={(e) => set('status', e.target.value as ParentStatus)}>
          {PARENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('name')}>
          {t('fields.name')}
          {required('name') && <RequiredMark />}
        </Label>
        <Input id={id('name')} value={value.name} onChange={(e) => set('name', e.target.value)} required={required('name')} />
      </div>

      {!reachable && <p className="text-xs text-muted-foreground sm:col-span-2">{t('noDetailsNeeded')}</p>}

      {reachable && (
        <>
      <div className="space-y-2">
        <Label htmlFor={id('phone')}>
          {t('fields.phone')}
          {required('phone') && <RequiredMark />}
        </Label>
        <Input
          id={id('phone')}
          type="tel"
          dir="ltr"
          placeholder={t('placeholders.phone')}
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          required={required('phone')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('age')}>{t('fields.age')}</Label>
        <Input
          id={id('age')}
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          placeholder={t('placeholders.age')}
          value={value.age}
          onChange={(e) => set('age', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('occupation')}>
          {t('fields.occupation')}
          {required('occupation') && <RequiredMark />}
        </Label>
        <Input
          id={id('occupation')}
          value={value.occupation}
          onChange={(e) => set('occupation', e.target.value)}
          required={required('occupation')}
        />
      </div>

      <LevelSelect
        id={id('educationLevel')}
        label={t('fields.educationLevel')}
        value={value.educationLevel}
        onChange={(v) => set('educationLevel', v)}
        options={options.educationLevels}
        required={required('educationLevel')}
      />

      <LevelSelect
        id={id('quranLevel')}
        label={t('fields.quranLevel')}
        value={value.quranLevel}
        onChange={(v) => set('quranLevel', v)}
        options={options.quranLevels}
        required={required('quranLevel')}
      />

      <KitabsPicker
        id={id('kitabs')}
        label={t('fields.kitabs')}
        value={value.kitabs}
        onChange={(v) => set('kitabs', v)}
        options={options.kitabs}
        className="sm:col-span-2"
      />

      <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input accent-primary"
          checked={value.sameAddress}
          onChange={(e) => set('sameAddress', e.target.checked)}
        />
        {t('sameAddress')}
      </label>

      {!value.sameAddress && (
        <>
          <div className="space-y-2">
            <Label htmlFor={id('subCity')}>{t('fields.subCity')}</Label>
            <Input id={id('subCity')} value={value.subCity} onChange={(e) => set('subCity', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id('kebele')}>{t('fields.kebele')}</Label>
            <Input id={id('kebele')} value={value.kebele} onChange={(e) => set('kebele', e.target.value)} />
          </div>
        </>
      )}
        </>
      )}
    </>
  )
}

/** Who looks after the child; shown when a parent has died or is absent. */
function CaregiverFields({
  idPrefix,
  value,
  onChange,
  required,
}: {
  idPrefix: string
  value: CaregiverDetails
  onChange: (next: CaregiverDetails) => void
  required: boolean
}) {
  const t = useTranslations('registration')
  const id = (field: string) => `${idPrefix}-caregiver-${field}`
  const set = (field: keyof CaregiverDetails, v: string) => onChange({ ...value, [field]: v })
  return (
    <>
      <SectionTitle title={t('sections.caregiver')} hint={required ? t('sections.caregiverRequiredHint') : t('sections.caregiverHint')} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('relation')}>
          {t('fields.relation')}
          {required && <RequiredMark />}
        </Label>
        <Select id={id('relation')} value={value.relation} onChange={(e) => set('relation', e.target.value)} required={required}>
          <option value="">{t('placeholders.select')}</option>
          {CAREGIVER_RELATIONS.map((r) => (
            <option key={r} value={r}>
              {t(`relations.${r}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('name')}>
          {t('fields.name')}
          {required && <RequiredMark />}
        </Label>
        <Input id={id('name')} value={value.name} onChange={(e) => set('name', e.target.value)} required={required} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('phone')}>
          {t('fields.phone')}
          {required && <RequiredMark />}
        </Label>
        <Input
          id={id('phone')}
          type="tel"
          dir="ltr"
          placeholder={t('placeholders.phone')}
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          required={required}
        />
      </div>
    </>
  )
}

/**
 * The private help assessment: does the family need help, and what kind.
 * Used in the registration form and in the admin's Support page.
 */
export function SupportFields({
  idPrefix = 'reg',
  value,
  onChange,
}: {
  idPrefix?: string
  value: SupportDetails
  onChange: (next: SupportDetails) => void
}) {
  const t = useTranslations('registration')
  const id = (field: string) => `${idPrefix}-support-${field}`
  const levels: SupportDetails['level'][] = ['none', 'needs', 'urgent']
  const toggle = (kind: string) =>
    onChange({ ...value, kinds: value.kinds.includes(kind) ? value.kinds.filter((k) => k !== kind) : [...value.kinds, kind] })
  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('level')}>{t('fields.supportLevel')}</Label>
        <Select id={id('level')} value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as SupportDetails['level'] })}>
          {levels.map((l) => (
            <option key={l} value={l}>
              {t(`supportLevels.${l}`)}
            </option>
          ))}
        </Select>
      </div>

      {value.level !== 'none' && (
        <>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium text-foreground">{t('fields.supportKinds')}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {SUPPORT_KINDS.map((kind) => (
                <label key={kind} htmlFor={id(`kind-${kind}`)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted/50">
                  <input
                    id={id(`kind-${kind}`)}
                    type="checkbox"
                    checked={value.kinds.includes(kind)}
                    onChange={() => toggle(kind)}
                    className="h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
                  />
                  {t(`supportKinds.${kind}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={id('note')}>{t('fields.supportNote')}</Label>
            <Textarea
              id={id('note')}
              rows={3}
              maxLength={1000}
              placeholder={t('placeholders.supportNote')}
              value={value.note}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  )
}

/**
 * The family part of the student registration form: the student's own
 * details from the paper sheet, then the father and the mother. Renders as
 * rows of the parent's two-column grid (`sm:grid-cols-2`).
 */
export function FamilyInfoFields({
  value,
  onChange,
  options,
  idPrefix = 'reg',
  className,
}: {
  value: RegistrationDetails
  onChange: (next: RegistrationDetails) => void
  options: RegistrationOptions
  idPrefix?: string
  className?: string
}) {
  const t = useTranslations('registration')
  const id = (field: string) => `${idPrefix}-${field}`
  const set = <K extends keyof RegistrationDetails>(field: K, v: RegistrationDetails[K]) => onChange({ ...value, [field]: v })
  const required = (field: (typeof REQUIRED_STUDENT_FIELDS)[number]) => REQUIRED_STUDENT_FIELDS.includes(field)

  return (
    <div className={cn('grid gap-4 sm:col-span-2 sm:grid-cols-2', className)}>
      <SectionTitle title={t('sections.student')} hint={t('sections.studentHint')} />

      <LevelSelect
        id={id('quranLevel')}
        label={t('fields.quranLevel')}
        value={value.quranLevel}
        onChange={(v) => set('quranLevel', v)}
        options={options.quranLevels}
        required={required('quranLevel')}
        className="sm:col-span-2"
      />

      <KitabsPicker
        id={id('kitabs')}
        label={t('fields.kitabs')}
        value={value.kitabs}
        onChange={(v) => set('kitabs', v)}
        options={options.kitabs}
        className="sm:col-span-2"
      />

      <LevelSelect
        id={id('lastYearLevel')}
        label={t('fields.lastYearLevel')}
        value={value.lastYearLevel}
        onChange={(v) => set('lastYearLevel', v)}
        options={options.madrasaLevels}
      />

      <LevelSelect
        id={id('lastYearResult')}
        label={t('fields.lastYearResult')}
        value={value.lastYearResult}
        onChange={(v) => set('lastYearResult', v)}
        options={options.results}
      />

      <div className="space-y-2">
        <Label htmlFor={id('phone')}>{t('fields.phone')}</Label>
        <Input
          id={id('phone')}
          type="tel"
          dir="ltr"
          placeholder={t('placeholders.phone')}
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('occupation')}>{t('fields.occupation')}</Label>
        <Input id={id('occupation')} value={value.occupation} onChange={(e) => set('occupation', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('subCity')}>{t('fields.subCity')}</Label>
        <Input id={id('subCity')} value={value.subCity} onChange={(e) => set('subCity', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('kebele')}>{t('fields.kebele')}</Label>
        <Input id={id('kebele')} value={value.kebele} onChange={(e) => set('kebele', e.target.value)} />
      </div>

      {GUARDIAN_KEYS.map((who) => (
        <GuardianFields
          key={who}
          who={who}
          idPrefix={idPrefix}
          value={value[who]}
          onChange={(next) => set(who, next)}
          options={options}
        />
      ))}

      {caregiverShown(value) && (
        <CaregiverFields
          idPrefix={idPrefix}
          value={value.caregiver}
          onChange={(next) => set('caregiver', next)}
          required={caregiverRequired(value)}
        />
      )}

      <SectionTitle title={t('sections.support')} hint={t('sections.supportHint')} />
      {value.support ? (
        <SupportFields idPrefix={idPrefix} value={value.support} onChange={(next) => set('support', next)} />
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">{t('supportUnavailable')}</p>
      )}
    </div>
  )
}

/**
 * Turns the keys returned by missingRegistrationFields() into readable
 * labels, e.g. "Father: Phone".
 */
export function useMissingFieldsMessage(): (keys: string[]) => string {
  const t = useTranslations('registration')
  // Only required fields can be missing, so only their labels are needed.
  const labelKey = {
    quranLevel: 'fields.quranLevel',
    name: 'fields.name',
    phone: 'fields.phone',
    occupation: 'fields.occupation',
    educationLevel: 'fields.educationLevel',
    relation: 'fields.relation',
  } as const
  const fieldLabel = (field: string) => {
    const key = labelKey[field as keyof typeof labelKey]
    return key ? t(key) : field
  }
  return (keys) => {
    const labels = keys.map((key) => {
      const [first, second] = key.split('.')
      if (first === 'caregiver') return `${t('sections.caregiver')}: ${fieldLabel(second)}`
      if (second) return `${t(`sections.${first as GuardianKey}`)}: ${fieldLabel(second)}`
      return `${t('sections.student')}: ${fieldLabel(first)}`
    })
    return t('errors.missing', { fields: labels.join(', ') })
  }
}
