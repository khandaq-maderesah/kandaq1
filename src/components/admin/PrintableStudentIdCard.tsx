'use client'

import React, { useMemo } from 'react'
import { GraduationCap, Phone, Printer, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateBarcodeSvg, generateStudentVerificationCode } from '@/lib/idCardBarcode'
import type { Student, Class } from '@/types'

export interface StudentIdCardProps {
  student: Student
  className?: string
  schoolName?: string
  academicYear?: string
}

export function SingleStudentIdCard({
  student,
  className = '',
  schoolName = 'Khendeq Madrasa',
  academicYear = '2017 E.C. / 2024-2025',
}: StudentIdCardProps) {
  const verificationCode = useMemo(
    () => generateStudentVerificationCode(student.id, student.rollNumber),
    [student.id, student.rollNumber]
  )

  const barcodeSvg = useMemo(
    () => generateBarcodeSvg(verificationCode, { height: 28, barWidth: 1.2, showText: true }),
    [verificationCode]
  )

  return (
    <div
      className={`relative flex h-[54mm] w-[85.6mm] flex-col overflow-hidden rounded-xl border border-gray-300 bg-white p-3 shadow-sm print:m-2 print:border-gray-400 print:shadow-none ${className}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white">
            <GraduationCap className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-tight text-emerald-950">{schoolName}</div>
            <div className="text-[8px] font-medium text-emerald-700">Talib Identification Card</div>
          </div>
        </div>
        <div className="text-right text-[8px] text-gray-500">{academicYear}</div>
      </div>

      {/* Main Body: Photo + Info */}
      <div className="mt-2 flex flex-1 items-start gap-3">
        {/* Student Photo */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photoUrl} alt={student.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-gray-400">
              {student.name ? student.name.slice(0, 2).toUpperCase() : 'ST'}
            </span>
          )}
        </div>

        {/* Student Data Fields */}
        <div className="min-w-0 flex-1 text-[10px]">
          <div className="truncate font-bold text-gray-900">{student.name}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-gray-600">
            <div>
              <span className="text-gray-400">Roll:</span> <strong className="text-gray-800">{student.rollNumber || '—'}</strong>
            </div>
            <div>
              <span className="text-gray-400">Class:</span> <span className="font-medium text-gray-800">{student.className || '—'}</span>
            </div>
            {student.section && (
              <div>
                <span className="text-gray-400">Sec:</span> <span className="font-medium text-gray-800">{student.section}</span>
              </div>
            )}
            {student.parentPhone && (
              <div className="col-span-2 truncate flex items-center gap-1 text-[8px] text-gray-500">
                <Phone className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
                <span>{student.parentPhone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barcode & Footer */}
      <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-1">
        <div
          className="overflow-hidden"
          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
        />
        <div className="text-right text-[7px] text-gray-400">Official Student Pass</div>
      </div>
    </div>
  )
}

export interface BatchStudentIdCardPrinterProps {
  students: Student[]
  schoolName?: string
  academicYear?: string
  classes?: Class[]
}

export function BatchStudentIdCardPrinter({
  students,
  schoolName = 'Khendeq Madrasa',
  academicYear = '2017 E.C.',
}: BatchStudentIdCardPrinterProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="space-y-4">
      {/* Print Controls (Hidden when printing) */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm print:hidden">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Printable Student ID Cards</h3>
          <p className="text-xs text-muted-foreground">
            Standard CR80 dimensions. Ready for direct print or batch export ({students.length} cards).
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print ID Cards
        </Button>
      </div>

      {/* Grid of Cards (2x4 layout per page on print) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-2">
        {students.map((student) => (
          <SingleStudentIdCard
            key={student.id}
            student={student}
            schoolName={schoolName}
            academicYear={academicYear}
          />
        ))}
      </div>
    </div>
  )
}
