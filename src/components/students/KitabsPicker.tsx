'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { joinKitabs, parseKitabs } from '@/lib/registration'

/**
 * "Kitabs studied before": several choices from the madrasa's kitab list,
 * plus any kitab typed under "Other". The value is one string ("A, B, C"),
 * so records and lists keep working unchanged.
 */
export function KitabsPicker({
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
  const [other, setOther] = useState('')
  const selected = parseKitabs(value)
  const lower = new Set(selected.map((s) => s.toLowerCase()))
  const custom = selected.filter((s) => !options.some((o) => o.toLowerCase() === s.toLowerCase()))

  const toggle = (kitab: string) => {
    const next = lower.has(kitab.toLowerCase()) ? selected.filter((s) => s.toLowerCase() !== kitab.toLowerCase()) : [...selected, kitab]
    onChange(joinKitabs(next))
  }

  const addOther = () => {
    const entry = other.trim()
    if (!entry) return
    if (!lower.has(entry.toLowerCase())) onChange(joinKitabs([...selected, entry]))
    setOther('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={`${id}-other`}>
        {label}
        {required && (
          <span className="ms-0.5 text-destructive" aria-label={t('required')}>
            *
          </span>
        )}
      </Label>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((kitab) => {
          const on = lower.has(kitab.toLowerCase())
          return (
            <button
              key={kitab}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(kitab)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {kitab}
            </button>
          )
        })}
        {custom.map((kitab) => (
          <span
            key={kitab}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 text-xs font-medium text-primary"
          >
            {kitab}
            <button type="button" onClick={() => toggle(kitab)} aria-label={`${kitab} ×`} className="rounded-full hover:bg-primary/20">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={`${id}-other`}
          placeholder={t('kitabsPicker.otherPlaceholder')}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addOther()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addOther} disabled={!other.trim()}>
          <Plus /> {t('kitabsPicker.add')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length > 0 ? t('kitabsPicker.selected', { count: selected.length }) : t('kitabsPicker.none')}
      </p>
      {required && (
        // Native form validation: the form cannot submit with nothing chosen.
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          required
          value={selected.length > 0 ? 'ok' : ''}
          onChange={() => {}}
        />
      )}
    </div>
  )
}
