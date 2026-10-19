'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Phone, MessageSquare, Copy, Bell, CheckCircle2, AlertTriangle } from 'lucide-react'
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission, showBrowserNotification } from '@/lib/pushNotification'
import type { Class, User, Attendance } from '@/types'

interface Props {
  classes: Class[]
  users: User[]
  attendance: Attendance[]
}

export default function UstazAttendanceMonitor({ classes, users, attendance }: Props) {
  const [filter, setFilter] = useState<'all' | 'missing' | 'submitted'>('all')
  const [permission, setPermission] = useState(getNotificationPermission())

  const today = new Date().toISOString().slice(0, 10)
  const attendedClassIds = useMemo(
    () => new Set(attendance.filter((a) => a.date === today).map((a) => a.classId)),
    [attendance, today]
  )

  const rows = useMemo(() => {
    const userById = new Map(users.map((u) => [u.uid, u]))
    return classes
      .filter((c) => c.isActive !== false && c.teacherId)
      .map((c) => {
        const teacher = userById.get(c.teacherId as string)
        const submitted = attendedClassIds.has(c.id)
        return {
          classId: c.id,
          className: c.name,
          section: c.section || '',
          teacherId: c.teacherId as string,
          teacherName: c.teacherName || teacher?.name || 'Unknown ustaz',
          phone: teacher?.phone || '',
          submitted,
        }
      })
  }, [classes, users, attendedClassIds])

  const filtered = rows.filter((r) =>
    filter === 'all' ? true : filter === 'missing' ? !r.submitted : r.submitted
  )

  const submittedCount = rows.filter((r) => r.submitted).length
  const missingCount = rows.length - submittedCount

  const handleEnable = async () => {
    const p = await requestNotificationPermission()
    setPermission(p)
  }

  const handleTest = async () => {
    await showBrowserNotification({
      title: 'KMMS: Missing Attendance Alert',
      body: `${missingCount} Ustaz(es) haven't taken today's attendance`,
      url: '/admin/attendance',
      tag: 'test',
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Submitted</p><p className="text-2xl font-bold text-green-600">{submittedCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Missing</p><p className="text-2xl font-bold text-red-600">{missingCount}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'missing', 'submitted'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
        <div className="ms-auto flex items-center gap-2">
          <Badge variant={permission === 'granted' ? 'success' : permission === 'denied' ? 'destructive' : 'secondary'}>
            {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Prompt'}
          </Badge>
          {isNotificationSupported() && permission !== 'granted' && (
            <Button size="sm" onClick={handleEnable}><Bell className="h-4 w-4" /> Enable Push</Button>
          )}
          {permission === 'granted' && (
            <Button size="sm" variant="outline" onClick={handleTest}><Bell className="h-4 w-4" /> Test</Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.classId} className={cn(!r.submitted && 'border-red-300 bg-red-50/40')}>
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{r.teacherName}</p>
                <p className="text-xs text-muted-foreground">{r.className}{r.section ? ` • ${r.section}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.submitted ? 'success' : 'destructive'}>
                  {r.submitted ? <><CheckCircle2 className="h-3 w-3" /> Submitted</> : <><AlertTriangle className="h-3 w-3" /> Pending</>}
                </Badge>
                {r.phone && (
                  <>
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-sm text-primary"><Phone className="h-4 w-4" /></a>
                    <a href={`sms:${r.phone}`} className="inline-flex items-center gap-1 text-sm text-primary"><MessageSquare className="h-4 w-4" /></a>
                    <button type="button" onClick={() => navigator.clipboard.writeText(r.phone)} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Copy className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
