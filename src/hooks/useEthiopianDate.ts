'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toEthiopianParts, type EthiopianParts } from '@/lib/ethiopianDate'

type MonthKey = `months.${'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13'}`

/**
 * Ethiopian calendar formatting with month names in the current UI language
 * (the `dates` namespace). Numbers are passed as strings so years are not
 * formatted with thousands separators ("2018", not "2,018").
 */
export function useEthiopianDate() {
  const t = useTranslations('dates')

  return useMemo(() => {
    const monthName = (month: number): string =>
      month >= 1 && month <= 13 ? t(`months.${month}` as MonthKey) : ''

    /** All 13 month names, in order (index 0 = Meskerem). */
    const months = Array.from({ length: 13 }, (_, i) => monthName(i + 1))

    const fromParts = (p: EthiopianParts) =>
      t('format.long', { month: monthName(p.month), day: String(p.day), year: String(p.year) })

    /** "Tikimt 6, 2019" for a YYYY-MM-DD / ISO date string, or undefined when unsupported. */
    const format = (dateStr?: string): string | undefined => {
      const p = toEthiopianParts(dateStr)
      return p ? fromParts(p) : undefined
    }

    /** "Tikimt 6" (no year). */
    const formatShort = (dateStr?: string): string | undefined => {
      const p = toEthiopianParts(dateStr)
      return p ? t('format.short', { month: monthName(p.month), day: String(p.day) }) : undefined
    }

    /** "Tikimt 6, 2019 E.C." */
    const formatWithEra = (dateStr?: string): string | undefined => {
      const d = format(dateStr)
      return d ? t('format.withEra', { date: d }) : undefined
    }

    /** Today's Ethiopian date (long form). */
    const today = () => format(new Date().toISOString())

    return { monthName, months, toParts: toEthiopianParts, format, formatShort, formatWithEra, today }
  }, [t])
}
