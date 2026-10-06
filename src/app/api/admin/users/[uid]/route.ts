import { NextResponse } from 'next/server'
import { getAdminApp } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

export const dynamic = 'force-dynamic'

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const admin = getAdminApp()
  const decoded = await getAuth(admin).verifyIdToken(idToken)
  const db = getDatabase(admin)
  const roleSnap = await db.ref('users/' + decoded.uid + '/role').get()
  if (roleSnap.val() !== 'admin') {
    throw new Error('Admin privileges required.')
  }
  return { admin, db, callerUid: decoded.uid }
}

/**
 * PATCH /api/admin/users/[uid]
 *
 * Updates the classes assigned to an existing teacher. Class records and user
 * profiles are updated together so moving a teacher to a new grade does not
 * leave stale assignments behind.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  try {
    const { db, callerUid } = await verifyAdmin(request)
    const body = await request.json()
    const assignedClassIds = Array.isArray(body?.assignedClassIds)
      ? [...new Set(body.assignedClassIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
      : null

    if (!assignedClassIds) {
      return NextResponse.json({ ok: false, error: 'assignedClassIds must be an array.' }, { status: 400 })
    }

    const [userSnap, classesSnap, usersSnap] = await Promise.all([
      db.ref('users/' + uid).get(),
      db.ref('classes').get(),
      db.ref('users').get(),
    ])
    const user = userSnap.val()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 })
    }
    if (user.role !== 'teacher') {
      return NextResponse.json({ ok: false, error: 'Only teacher assignments can be edited.' }, { status: 400 })
    }

    const selected = new Set(assignedClassIds)
    const updates: Record<string, unknown> = {
      [`users/${uid}/assignedClassIds`]: assignedClassIds,
      [`users/${uid}/updatedAt`]: new Date().toISOString(),
    }
    const assignedByUser = new Map<string, string[]>()

    usersSnap.forEach((child) => {
      const value = child.val()
      if (value?.role === 'teacher' && Array.isArray(value.assignedClassIds)) {
        assignedByUser.set(child.key as string, value.assignedClassIds)
      }
    })

    classesSnap.forEach((child) => {
      const classId = child.key as string
      const value = child.val()
      if (!value) return

      if (selected.has(classId)) {
        updates[`classes/${classId}/teacherId`] = uid
        updates[`classes/${classId}/teacherName`] = user.name
      } else if (value.teacherId === uid) {
        updates[`classes/${classId}/teacherId`] = null
        updates[`classes/${classId}/teacherName`] = null
      }

      if (selected.has(classId)) {
        assignedByUser.forEach((ids, otherUid) => {
          if (otherUid !== uid && ids.includes(classId)) {
            updates[`users/${otherUid}/assignedClassIds`] = ids.filter((id) => id !== classId)
            updates[`users/${otherUid}/updatedAt`] = new Date().toISOString()
          }
        })
      }
    })

    await db.ref().update(updates)
    await db.ref('audit/audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)).set({
      actorId: callerUid,
      action: 'update',
      entity: 'user',
      entityId: uid,
      details: `Updated class assignments for ${user.name}`,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Update user assignments failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to update user assignments' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[uid]
 *
 * Permanently deletes a user (from Firebase Auth + Realtime Database) and
 * unassigns any classes they taught. Only an admin can do this, and an admin
 * cannot delete their own account (to avoid locking everyone out).
 *
 * Auth: the caller must send `Authorization: Bearer <idToken>` where the token
 * belongs to an account whose `users/{uid}/role` is "admin".
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''

  try {
    const admin = getAdminApp()

    // Verify the caller and confirm they are an admin.
    const decoded = await getAuth(admin).verifyIdToken(idToken)
    const callerUid = decoded.uid

    if (callerUid === uid) {
      return NextResponse.json(
        { ok: false, error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    const db = getDatabase(admin)
    const roleSnap = await db.ref('users/' + callerUid + '/role').get()
    if (roleSnap.val() !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Admin privileges required.' },
        { status: 403 }
      )
    }

    // Unassign classes taught by the user being deleted.
    const classesSnap = await db.ref('classes').get()
    const classUpdates: Record<string, null> = {}
    classesSnap.forEach((child) => {
      const val = child.val()
      if (val && val.teacherId === uid) {
        classUpdates[`classes/${child.key}/teacherId`] = null
        classUpdates[`classes/${child.key}/teacherName`] = null
      }
    })
    if (Object.keys(classUpdates).length > 0) {
      await db.ref().update(classUpdates)
    }

    // Remove the Auth account and the RTDB profile.
    await getAuth(admin).deleteUser(uid)
    await db.ref('users/' + uid).remove()

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Delete user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}