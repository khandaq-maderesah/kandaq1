import { NextResponse } from 'next/server'
import {
  requireAdmin,
  assertCanManageSchool,
  errorStatus,
  errorCode,
  HttpError,
} from '@/lib/firebase/admin'
import { getSmsProvider } from '@/lib/server/smsAdapter'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sms
 *
 * Sends an SMS message to a student's parent or custom recipient using
 * the configured pluggable SMS adapter (AfroMessage or Sandbox fallback).
 *
 * Auth: Authorization: Bearer <idToken> (Admin or Superadmin)
 * Body: { to: string, text: string, studentId?: string, schoolId?: string }
 */
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.', code: 'invalid' }, { status: 400 })
  }

  const { to, text, studentId, schoolId: targetSchoolId } = body || {}

  if (!to || !text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Recipient phone ("to") and message content ("text") are required.', code: 'invalid' },
      { status: 400 }
    )
  }

  try {
    const { db, caller } = await requireAdmin(request)

    const schoolId: string | undefined =
      caller.role === 'superadmin' ? targetSchoolId || caller.schoolId : caller.schoolId

    if (!schoolId) {
      throw new HttpError(400, 'schoolId is required.')
    }
    assertCanManageSchool(caller, schoolId)

    const smsProvider = getSmsProvider()
    const result = await smsProvider.send({
      to,
      text,
      senderId: caller.schoolId ? `sch_${caller.schoolId.slice(0, 8)}` : 'KMMS',
    })

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Failed to dispatch SMS.', code: 'sms_failure' },
        { status: 502 }
      )
    }

    // Record audit entry in RTDB
    try {
      const auditRef = db.ref(`schoolData/${schoolId}/audit`).push()
      await auditRef.set({
        action: 'sms_dispatch',
        recipient: to,
        studentId: studentId || null,
        messageId: result.messageId || null,
        provider: result.provider,
        timestamp: Date.now(),
        byUid: caller.uid,
      })
    } catch (auditErr) {
      console.warn('Failed to record SMS audit log:', auditErr)
    }

    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'SMS dispatch failed.', code: errorCode(err) },
      { status: errorStatus(err) }
    )
  }
}
