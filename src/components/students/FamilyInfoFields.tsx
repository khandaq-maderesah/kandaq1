'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  GUARDIAN_KEYS,
  REQUIRED_GUARDIAN_FIELDS,
  REQUIRED_STUDENT_FIELDS,
  type GuardianDetails,
  type GuardianKey,
  type RegistrationDetails,
  type RegistrationOptions,
} from '@/lib/registration'

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
function LevelSelect({
  id,
  label,
  value,
  onChange,
  options,
  required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
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
    <div className="space-y-2">
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
  const required = (field: (typeof REQUIRED_GUARDIAN_FIELDS)[number]) => REQUIRED_GUARDIAN_FIELDS.includes(field)

  return (
    <>
      <SectionTitle title={t(`sections.${who}`)} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('name')}>
          {t('fields.name')}
          <RequiredMark />
        </Label>
        <Input id={id('name')} value={value.name} onChange={(e) => set('name', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('phone')}>
          {t('fields.phone')}
          <RequiredMark />
        </Label>
        <Input
          id={id('phone')}
          type="tel"
          dir="ltr"
          placeholder={t('placeholders.phone')}
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          required
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
          <RequiredMark />
        </Label>
        <Input id={id('occupation')} value={value.occupation} onChange={(e) => set('occupation', e.target.value)} required />
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

      <div className="space-y-2">
        <Label htmlFor={id('kitabs')}>{t('fields.kitabs')}</Label>
        <Input
          id={id('kitabs')}
          placeholder={t('placeholders.kitabs')}
          value={value.kitabs}
          onChange={(e) => set('kitabs', e.target.value)}
        />
      </div>

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
        id={id('madrasaLevel')}
        label={t('fields.madrasaLevel')}
        value={value.madrasaLevel}
        onChange={(v) => set('madrasaLevel', v)}
        options={options.madrasaLevels}
        required={required('madrasaLevel')}
      />

      <LevelSelect
        id={id('quranLevel')}
        label={t('fields.quranLevel')}
        value={value.quranLevel}
        onChange={(v) => set('quranLevel', v)}
        options={options.quranLevels}
        required={required('quranLevel')}
      />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id('kitabs')}>{t('fields.kitabs')}</Label>
        <Input
          id={id('kitabs')}
          placeholder={t('placeholders.kitabs')}
          value={value.kitabs}
          onChange={(e) => set('kitabs', e.target.value)}
        />
      </div>

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
    madrasaLevel: 'fields.madrasaLevel',
    quranLevel: 'fields.quranLevel',
    name: 'fields.name',
    phone: 'fields.phone',
    occupation: 'fields.occupation',
    educationLevel: 'fields.educationLevel',
  } as const
  const fieldLabel = (field: string) => {
    const key = labelKey[field as keyof typeof labelKey]
    return key ? t(key) : field
  }
  return (keys) => {
    const labels = keys.map((key) => {
      const [first, second] = key.split('.')
      if (second) return `${t(`sections.${first as GuardianKey}`)}: ${fieldLabel(second)}`
      return `${t('sections.student')}: ${fieldLabel(first)}`
    })
    return t('errors.missing', { fields: labels.join(', ') })
  }
}
