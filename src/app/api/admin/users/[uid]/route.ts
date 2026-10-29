import { NextResponse } from 'next/server'
import { requireAdmin, assertCanManageSchool, errorStatus, errorCode, HttpError } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { isLocale } from '@/i18n/config'
import { isClassTeacher, teacherFieldsFor, teachersAfterChange } from '@/lib/classTeachers'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/[uid]
 *
 * Shapes:
 *  - { details: { phone, quranLevel, kitabs, language } } updates the profile
 *    details an admin collects for an ustaz (phone stays required for one);
 *  - { email } changes a user's sign-in email (an admin for an Ustaz, the
 *    super admin for an admin);
 *  - { assignedClassIds } updates the classes assigned to an existing teacher.
 *    Class records and user profiles are updated together so moving a teacher
 *    to a new grade does not leave stale assignments behind.
 * Only within the user's own school.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  try {
    const { db, caller } = await requireAdmin(request)
    const body = await request.json()

    if (typeof body?.email === 'string') {
      const email = body.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: 'email is not valid.', code: 'auth/invalid-email' }, { status: 400 })
      }
      const user = (await db.ref('users/' + uid).get()).val()
      if (!user) {
        return NextResponse.json({ ok: false, error: 'User not found.', code: 'not-found' }, { status: 404 })
      }
      assertCanManageSchool(caller, user.schoolId)
      // A medreseh admin changes the email of an Ustaz; only the super admin
      // changes an admin's email. Nobody changes a super admin's here.
      const allowed = caller.role === 'superadmin' ? user.role !== 'superadmin' : user.role === 'teacher'
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'You cannot change this email.', code: 'forbidden' }, { status: 403 })
      }
      if (email !== String(user.email ?? '').toLowerCase()) {
        await getAuth().updateUser(uid, { email })
        await db.ref().update({
          [`users/${uid}/email`]: email,
          [`users/${uid}/updatedAt`]: new Date().toISOString(),
        })
        if (user.schoolId) {
          await db
            .ref(`schoolData/${user.schoolId}/audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
            .set({
              actorId: caller.uid,
              action: 'update',
              entity: 'user',
              entityId: uid,
              details: `Changed the email of ${user.name}`,
              timestamp: new Date().toISOString(),
            })
        }
      }
      return NextResponse.json({ ok: true, email })
    }

    if (body?.details && typeof body.details === 'object') {
      const user = (await db.ref('users/' + uid).get()).val()
      if (!user) {
        return NextResponse.json({ ok: false, error: 'User not found.', code: 'not-found' }, { status: 404 })
      }
      assertCanManageSchool(caller, user.schoolId)
      const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
      const details = body.details
      const phone = text(details.phone)
      if (user.role === 'teacher' && !phone) {
        return NextResponse.json({ ok: false, error: 'phone is required for an ustaz.', code: 'invalid' }, { status: 400 })
      }
      const language = text(details.language)
      if (language && !isLocale(language)) {
        return NextResponse.json({ ok: false, error: 'language is not supported.', code: 'invalid' }, { status: 400 })
      }
      await db.ref().update({
        [`users/${uid}/phone`]: phone || null,
        [`users/${uid}/quranLevel`]: text(details.quranLevel) || null,
        [`users/${uid}/kitabs`]: text(details.kitabs) || null,
        [`users/${uid}/language`]: language || null,
        [`users/${uid}/updatedAt`]: new Date().toISOString(),
      })
      await db
        .ref(`schoolData/${user.schoolId}/audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
        .set({
          actorId: caller.uid,
          action: 'update',
          entity: 'user',
          entityId: uid,
          details: `Updated details for ${user.name}`,
          timestamp: new Date().toISOString(),
        })
      return NextResponse.json({ ok: true })
    }

    const assignedClassIds = Array.isArray(body?.assignedClassIds)
      ? [...new Set<string>(body.assignedClassIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
      : null

    if (!assignedClassIds) {
      return NextResponse.json({ ok: false, error: 'assignedClassIds must be an array.', code: 'invalid' }, { status: 400 })
    }

    const user = (await db.ref('users/' + uid).get()).val()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.', code: 'not-found' }, { status: 404 })
    }
    assertCanManageSchool(caller, user.schoolId)
    if (user.role !== 'teacher') {
      return NextResponse.json({ ok: false, error: 'Only teacher assignments can be edited.', code: 'invalid' }, { status: 400 })
    }
    const schoolId: string = user.schoolId

    const [classesSnap, usersSnap] = await Promise.all([
      db.ref(`schoolData/${schoolId}/classes`).get(),
      db.ref('users').orderByChild('schoolId').equalTo(schoolId).get(),
    ])

    const selected = new Set(assignedClassIds.filter((cid) => classesSnap.hasChild(cid)))
    const updates: Record<string, unknown> = {
      [`users/${uid}/assignedClassIds`]: [...selected],
      [`users/${uid}/updatedAt`]: new Date().toISOString(),
    }

    const nameByUid = new Map<string, string>()
    usersSnap.forEach((child) => {
      const value = child.val()
      if (value?.role === 'teacher' && typeof value.name === 'string') nameByUid.set(child.key as string, value.name)
    })
    nameByUid.set(uid, user.name)

    // A class can have several Ustaz: adding this one keeps the others, and
    // removing it only takes this Ustaz off.
    classesSnap.forEach((child) => {
      const classId = child.key as string
      const value = child.val()
      if (!value) return
      const wasAssigned = isClassTeacher(value, uid)
      const assigned = selected.has(classId)
      if (assigned === wasAssigned) return
      const classPath = `schoolData/${schoolId}/classes/${classId}`
      const fields = teacherFieldsFor(teachersAfterChange(value, uid, assigned, (id) => nameByUid.get(id)))
      updates[`${classPath}/teacherId`] = fields.teacherId
      updates[`${classPath}/teacherName`] = fields.teacherName
      updates[`${classPath}/teacherIds`] = fields.teacherIds
    })

    await db.ref().update(updates)
    await db
      .ref(`schoolData/${schoolId}/audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
      .set({
        actorId: caller.uid,
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
      { ok: false, error: err?.message || 'Failed to update user assignments', code: errorCode(err) },
      { status: errorStatus(err) }
    )
  }
}

/**
 * DELETE /api/admin/users/[uid]
 *
 * Permanently deletes a user (from Firebase Auth + Realtime Database) and
 * unassigns any classes they taught. Admins can only delete users of their own
 * school; nobody can delete their own account or a superadmin.
 *
 * Auth: `Authorization: Bearer <idToken>` of an admin or superadmin account.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params

  try {
    const { admin, db, caller } = await requireAdmin(request)

    if (caller.uid === uid) {
      return NextResponse.json(
        { ok: false, error: 'You cannot delete your own account.', code: 'cannot-delete-self' },
        { status: 400 }
      )
    }

    const user = (await db.ref('users/' + uid).get()).val()
    if (!user) throw new HttpError(404, 'User not found.')
    if (user.role === 'superadmin') throw new HttpError(403, 'A superadmin cannot be deleted here.')
    assertCanManageSchool(caller, user.schoolId)

    // Take the user off every class they taught (other Ustaz of the class stay).
    const [classesSnap, schoolUsersSnap] = await Promise.all([
      db.ref(`schoolData/${user.schoolId}/classes`).get(),
      db.ref('users').orderByChild('schoolId').equalTo(user.schoolId).get(),
    ])
    const nameByUid = new Map<string, string>()
    schoolUsersSnap.forEach((child) => {
      const value = child.val()
      if (value && typeof value.name === 'string') nameByUid.set(child.key as string, value.name)
    })
    const classUpdates: Record<string, unknown> = {}
    classesSnap.forEach((child) => {
      const val = child.val()
      if (val && isClassTeacher(val, uid)) {
        const fields = teacherFieldsFor(teachersAfterChange(val, uid, false, (id) => nameByUid.get(id)))
        const path = `schoolData/${user.schoolId}/classes/${child.key}`
        classUpdates[`${path}/teacherId`] = fields.teacherId
        classUpdates[`${path}/teacherName`] = fields.teacherName
        classUpdates[`${path}/teacherIds`] = fields.teacherIds
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
      { ok: false, error: err?.message || 'Failed to delete user', code: errorCode(err) },
      { status: errorStatus(err) }
    )
  }
}
