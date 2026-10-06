import { NextResponse } from 'next/server'
import { getAdminApp } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/users
 *
 * Creates a new user (teacher or admin) using the Admin SDK so the client's
 * session is NOT hijacked (which happened with the browser's
 * `createUserWithEmailAndPassword`). Only an admin can do this.
 *
 * Auth: `Authorization: Bearer <idToken>` of an admin account.
 * Body: { name, email, password, phone?, role, assignedClassIds? }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const { name, email, password, phone, role, assignedClassIds } = body || {}

  if (!email || !password || !name || !role) {
    return NextResponse.json(
      { ok: false, error: 'name, email, password and role are required.' },
      { status: 400 }
    )
  }

  try {
    const admin = getAdminApp()
    const decoded = await getAuth(admin).verifyIdToken(idToken)
    const callerUid = decoded.uid

    const db = getDatabase(admin)
    const roleSnap = await db.ref('users/' + callerUid + '/role').get()
    if (roleSnap.val() !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Admin privileges required.' },
        { status: 403 }
      )
    }

    // 1) Create the Firebase Auth account.
    const userRecord = await getAuth(admin).createUser({
      email,
      password,
      displayName: name,
    })
    const uid = userRecord.uid

    // 2) Write the profile (never write "undefined" or null to RTDB).
    const record: Record<string, any> = {
      uid,
      email,
      name,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: callerUid,
    }
    if (phone) record.phone = phone
    if (role === 'teacher' && Array.isArray(assignedClassIds) && assignedClassIds.length > 0) {
      record.assignedClassIds = assignedClassIds
    }
    await db.ref('users/' + uid).set(record)

    // 3) Assign classes (teachers).
    if (role === 'teacher' && Array.isArray(assignedClassIds)) {
      const updates: Record<string, any> = {}
      for (const cid of assignedClassIds) {
        if (!cid) continue
        updates[`classes/${cid}/teacherId`] = uid
        updates[`classes/${cid}/teacherName`] = name
      }
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates)
      }
    }

    // 4) Audit log.
    await db
      .ref('audit/audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
      .set({
        actorId: callerUid,
        actorName: email,
        action: 'create',
        entity: 'user',
        entityId: uid,
        details: `${name} (${role})`,
        timestamp: new Date().toISOString(),
      })

    return NextResponse.json({ ok: true, uid })
  } catch (err: any) {
    console.error('Create user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}