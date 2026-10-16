import { NextResponse } from 'next/server'
import {
  requireAdmin,
  assertCanManageSchool,
  syncUserClaims,
  errorStatus,
  errorCode,
  HttpError,
} from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'

export const dynamic = 'force-dynamic'

const CREATABLE_ROLES = ['admin', 'teacher'] as const

/**
 * POST /api/admin/users
 *
 * Creates a new user (teacher or school admin) using the Admin SDK so the
 * client's session is NOT hijacked (which happened with the browser's
 * `createUserWithEmailAndPassword`).
 *
 * A school admin can only create users in their own school; a superadmin must
 * say which school with `schoolId`.
 *
 * Auth: `Authorization: Bearer <idToken>` of an admin or superadmin account.
 * Body: { name, email, password, phone?, role, assignedClassIds?, schoolId? }
 */
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.', code: 'invalid' }, { status: 400 })
  }
  const { name, email, password, phone, role, assignedClassIds } = body || {}

  if (!email || !password || !name || !role) {
    return NextResponse.json(
      { ok: false, error: 'name, email, password and role are required.', code: 'invalid' },
      { status: 400 }
    )
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'role must be admin or teacher.', code: 'invalid' }, { status: 400 })
  }

  try {
    const { admin, db, caller } = await requireAdmin(request)

    // A school admin always creates users in their own school.
    const schoolId: string | undefined =
      caller.role === 'superadmin' ? body.schoolId || undefined : caller.schoolId
    if (!schoolId) throw new HttpError(400, 'schoolId is required.')
    assertCanManageSchool(caller, schoolId)
    if (!(await db.ref(`schoolInfo/${schoolId}`).get()).exists()) {
      throw new HttpError(404, 'School not found.')
    }

    // Only assign classes that really belong to this school.
    let classIds: string[] = []
    if (role === 'teacher' && Array.isArray(assignedClassIds)) {
      const classesSnap = await db.ref(`schoolData/${schoolId}/classes`).get()
      classIds = [...new Set<string>(assignedClassIds)].filter(
        (cid) => typeof cid === 'string' && cid && classesSnap.hasChild(cid)
      )
    }

    // 1) Create the Firebase Auth account.
    const userRecord = await getAuth(admin).createUser({
      email,
      password,
      displayName: name,
    })
    const uid = userRecord.uid
    await syncUserClaims(uid, role, schoolId)

    // 2) Write the profile (never write "undefined" or null to RTDB).
    const now = new Date().toISOString()
    const record: Record<string, any> = {
      uid,
      email,
      name,
      role,
      schoolId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: caller.uid,
    }
    if (phone) record.phone = phone
    if (classIds.length > 0) record.assignedClassIds = classIds
    await db.ref('users/' + uid).set(record)

    // 3) Assign classes (teachers).
    if (classIds.length > 0) {
      const updates: Record<string, any> = {}
      for (const cid of classIds) {
        updates[`schoolData/${schoolId}/classes/${cid}/teacherId`] = uid
        updates[`schoolData/${schoolId}/classes/${cid}/teacherName`] = name
      }
      await db.ref().update(updates)
    }

    // 4) Audit log.
    await db
      .ref(`schoolData/${schoolId}/audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
      .set({
        actorId: caller.uid,
        actorName: email,
        action: 'create',
        entity: 'user',
        entityId: uid,
        details: `${name} (${role})`,
        timestamp: now,
      })

    return NextResponse.json({ ok: true, uid })
  } catch (err: any) {
    console.error('Create user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create user', code: errorCode(err) },
      { status: errorStatus(err) }
    )
  }
}
