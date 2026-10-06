import { db } from '@/lib/firebase/config'
import { ref, get, set, update, remove, onValue, query, orderByChild, equalTo, startAt, type QueryConstraint, type Unsubscribe } from 'firebase/database'
import type { User, Class, Student, Attendance, AbsentAlert, MissingAttendanceAlert, Exam, Announcement } from '@/types'

// ==================== Users ====================
export async function getUser(userId: string): Promise<User | null> {
  const snap = await get(ref(db, `users/${userId}`))
  return snap.exists() ? (snap.val() as User) : null
}

export async function createUser(userId: string, data: Partial<User>): Promise<void> {
  await set(ref(db, `users/${userId}`), data)
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  await update(ref(db, `users/${userId}`), updates)
}

export async function deleteUser(userId: string): Promise<void> {
  await remove(ref(db, `users/${userId}`))
}

export async function getAllUsers(): Promise<User[]> {
  const snap = await get(ref(db, 'users'))
  const users: User[] = []
  snap.forEach((child) => {
    users.push({ id: child.key as string, ...child.val() })
  })
  return users
}

// ==================== Classes ====================
export async function getClass(classId: string): Promise<Class | null> {
  const snap = await get(ref(db, `classes/${classId}`))
  return snap.exists() ? (snap.val() as Class) : null
}

export async function createClass(classId: string, data: Partial<Class>): Promise<void> {
  await set(ref(db, `classes/${classId}`), data)
}

export async function updateClass(classId: string, updates: Partial<Class>): Promise<void> {
  await update(ref(db, `classes/${classId}`), updates)
}

export async function deleteClass(classId: string): Promise<void> {
  await remove(ref(db, `classes/${classId}`))
}

export async function getAllClasses(): Promise<Class[]> {
  const snap = await get(ref(db, 'classes'))
  const classes: Class[] = []
  snap.forEach((child) => {
    classes.push({ id: child.key as string, ...child.val() })
  })
  return classes
}

// ==================== Students ====================
// Runs a Realtime Database query (server-side filter) so only matching rows are
// transferred, instead of downloading an entire collection and filtering in JS.
// Returns null if the query is rejected (e.g. the ".indexOn" rule has not yet
// been republished), letting callers fall back to the previous full scan so the
// app keeps working even before rules are updated.
async function queryChildren<T extends { id?: string }>(
  path: string,
  constraints: QueryConstraint[]
): Promise<T[] | null> {
  try {
    const snap = await get(query(ref(db, path), ...constraints))
    const out: T[] = []
    snap.forEach((child) => {
      out.push({
        id: child.key as string,
        ...(child.val() as object),
      } as T)
    })
    return out
  } catch {
    return null
  }
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const snap = await get(ref(db, `students/${studentId}`))
  return snap.exists() ? (snap.val() as Student) : null
}

export async function createStudent(studentId: string, data: Partial<Student>): Promise<void> {
  await set(ref(db, `students/${studentId}`), data)
}

export async function updateStudent(studentId: string, updates: Partial<Student>): Promise<void> {
  await update(ref(db, `students/${studentId}`), updates)
}

export async function deleteStudent(studentId: string): Promise<void> {
  await remove(ref(db, `students/${studentId}`))
  // Also clean up the student's on-demand photo record if any (best effort).
  try {
    await remove(ref(db, `studentPhotos/${studentId}`))
  } catch {
    /* ignore */
  }
}

// ==================== Student photos (on-demand) ====================
// Photos are heavy (15-35 KB base64 each). Keeping them INSIDE the students
// node means every "list students" subscription downloads every photo. Instead
// new photos are written to a sibling node /studentPhotos/{studentId} and only
// fetched when a specific student's photo is actually shown. Reads fall back to
// the legacy embedded `photoUrl` handled in hooks/useStudentPhoto.

export async function setStudentPhoto(studentId: string, dataUrl: string): Promise<void> {
  if (!dataUrl) {
    await remove(ref(db, `studentPhotos/${studentId}`))
    return
  }
  await set(ref(db, `studentPhotos/${studentId}/photo`), dataUrl)
}

export async function getStudentPhoto(studentId: string): Promise<string | null> {
  try {
    const snap = await get(ref(db, `studentPhotos/${studentId}/photo`))
    return snap.exists() ? (snap.val() as string) : null
  } catch {
    return null
  }
}

export async function getAllStudents(): Promise<Student[]> {
  const snap = await get(ref(db, 'students'))
  const students: Student[] = []
  snap.forEach((child) => {
    students.push({ id: child.key as string, ...child.val() })
  })
  return students
}

export async function getStudentsByClass(classId: string): Promise<Student[]> {
  // Server-side filter: only this class's students are downloaded.
  const q = await queryChildren<Student>('students', [
    orderByChild('classId'),
    equalTo(classId),
  ])
  if (q) return q
  // Fallback if the ".indexOn" rule isn't deployed yet (slow but works).
  const students = await getAllStudents()
  return students.filter((s) => s.classId === classId)
}

// ==================== Attendance ====================
export async function getAttendance(attendanceId: string): Promise<Attendance | null> {
  const snap = await get(ref(db, `attendance/${attendanceId}`))
  return snap.exists() ? (snap.val() as Attendance) : null
}

export async function createAttendance(
  attendanceId: string,
  data: Partial<Attendance>
): Promise<void> {
  await set(ref(db, `attendance/${attendanceId}`), data)
}

export async function updateAttendance(
  attendanceId: string,
  updates: Partial<Attendance>
): Promise<void> {
  await update(ref(db, `attendance/${attendanceId}`), updates)
}

export async function deleteAttendance(attendanceId: string): Promise<void> {
  await remove(ref(db, `attendance/${attendanceId}`))
}

export async function getAllAttendance(): Promise<Attendance[]> {
  const snap = await get(ref(db, 'attendance'))
  const records: Attendance[] = []
  snap.forEach((child) => {
    records.push({ id: child.key as string, ...child.val() })
  })
  return records
}

export async function getAttendanceByClassAndDate(
  classId: string,
  date: string
): Promise<Attendance[]> {
  // Server-side filter by class first (RTDB supports one order-by), then the
  // tiny date filter in memory. Transfers one class's history, not the school's.
  const q = await queryChildren<Attendance>('attendance', [
    orderByChild('classId'),
    equalTo(classId),
  ])
  if (q) return q.filter((r) => r.date === date)
  const records = await getAllAttendance()
  return records.filter((r) => r.classId === classId && r.date === date)
}

export async function getAttendanceByTeacher(teacherId: string): Promise<Attendance[]> {
  // Server-side filter by teacher: teachers only download their own records.
  const q = await queryChildren<Attendance>('attendance', [
    orderByChild('teacherId'),
    equalTo(teacherId),
  ])
  if (q) return q
  const records = await getAllAttendance()
  return records.filter((r) => r.teacherId === teacherId)
}

export async function getAllAttendanceSince(date: string): Promise<Attendance[]> {
  // Server-side filter by date (attendance/date is indexed). Transfers only
  // records newer than `date` instead of the whole history.
  const q = await queryChildren<Attendance>('attendance', [
    orderByChild('date'),
    startAt(date),
  ])
  if (q) return q
  const records = await getAllAttendance()
  return records.filter((r) => r.date >= date)
}

export async function getAttendanceByStudent(studentId: string): Promise<Attendance[]> {
  // Server-side filter by studentId (see rules: attendance/studentId is indexed).
  const q = await queryChildren<Attendance>('attendance', [
    orderByChild('studentId'),
    equalTo(studentId),
  ])
  if (q) return q
  const records = await getAllAttendance()
  return records.filter((r) => r.studentId === studentId)
}

// ==================== Absence Alerts ====================
export async function getAbsentAlerts(): Promise<AbsentAlert[]> {
  const snap = await get(ref(db, 'absentAlerts'))
  const alerts: AbsentAlert[] = []
  snap.forEach((child) => {
    alerts.push({ studentId: child.key as string, ...child.val() })
  })
  return alerts
}

export async function acknowledgeAbsentAlert(
  studentId: string,
  data: Partial<AbsentAlert>
): Promise<void> {
  await set(ref(db, `absentAlerts/${studentId}`), data)
}

// ==================== Missing Attendance Alerts ====================
// Alerts created when a teacher has not marked attendance for their class on a given day.
// Stored under missingAttendanceAlerts/{date}_{classId}.
export async function getMissingAttendanceAlerts(): Promise<MissingAttendanceAlert[]> {
  const snap = await get(ref(db, 'missingAttendanceAlerts'))
  const alerts: MissingAttendanceAlert[] = []
  snap.forEach((child) => {
    alerts.push({ ...(child.val() as MissingAttendanceAlert), id: child.key as string })
  })
  return alerts
}

export async function setMissingAttendanceAlert(
  id: string,
  data: MissingAttendanceAlert
): Promise<void> {
  await set(ref(db, `missingAttendanceAlerts/${id}`), data)
}

export async function updateMissingAttendanceAlert(
  id: string,
  updates: Partial<MissingAttendanceAlert>
): Promise<void> {
  await update(ref(db, `missingAttendanceAlerts/${id}`), updates)
}

export function subscribeToMissingAttendanceAlerts(
  cb: (alerts: MissingAttendanceAlert[]) => void
): Unsubscribe {
  return onValue(ref(db, 'missingAttendanceAlerts'), (snap) => {
    const alerts: MissingAttendanceAlert[] = []
    snap.forEach((child) => {
      alerts.push({ ...(child.val() as MissingAttendanceAlert), id: child.key as string })
    })
    cb(alerts)
  })
}

// ==================== Settings ====================
// Read/write each setting individually so it works even when the deployed
// Realtime Database rules only allow per-child access (no republish required).
const SETTING_KEYS = ['schoolName', 'address', 'phone', 'academicYear', 'registrationOpen'] as const

export async function getSettings(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(
    SETTING_KEYS.map(async (k) => {
      const snap = await get(ref(db, `settings/${k}`))
      if (snap.exists()) out[k] = String(snap.val())
    })
  )
  return out
}

export async function getRegistrationOpen(): Promise<boolean> {
  const snap = await get(ref(db, 'settings/registrationOpen'))
  return !snap.exists() || String(snap.val()) !== 'false'
}

export async function updateSettings(data: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(data).map(([k, v]) => set(ref(db, `settings/${k}`), v ?? ''))
  )
}

// ==================== Exams / Results ====================
export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await get(ref(db, `exams/${examId}`))
  return snap.exists() ? (snap.val() as Exam) : null
}

export async function createExam(examId: string, data: Partial<Exam>): Promise<void> {
  await set(ref(db, `exams/${examId}`), data)
}

export async function updateExam(examId: string, updates: Partial<Exam>): Promise<void> {
  await update(ref(db, `exams/${examId}`), updates)
}

export async function deleteExam(examId: string): Promise<void> {
  await remove(ref(db, `exams/${examId}`))
}

export async function getAllExams(): Promise<Exam[]> {
  const snap = await get(ref(db, 'exams'))
  const exams: Exam[] = []
  snap.forEach((child) => {
    exams.push({ id: child.key as string, ...child.val() })
  })
  return exams
}

export async function getExamsByClass(classId: string): Promise<Exam[]> {
  // Server-side filter: only this class's exams are downloaded.
  const q = await queryChildren<Exam>('exams', [
    orderByChild('classId'),
    equalTo(classId),
  ])
  if (q) return q
  const exams = await getAllExams()
  return exams.filter((e) => e.classId === classId)
}

// ==================== Announcements ====================
export async function createAnnouncement(data: Partial<Announcement>): Promise<void> {
  const id = `annc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await set(ref(db, `announcements/${id}`), { id, ...data })
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await remove(ref(db, `announcements/${announcementId}`))
}

export function subscribeToAnnouncements(cb: (announcements: Announcement[]) => void): Unsubscribe {
  return onValue(ref(db, 'announcements'), (snap) => {
    const announcements: Announcement[] = []
    snap.forEach((child) => {
      announcements.push({ id: child.key as string, ...child.val() })
    })
    cb(announcements)
  })
}

// ==================== Realtime Subscriptions ====================
// Subscribe to a node and call the callback whenever it changes.
// Returns an unsubscribe function to clean up in useEffect.

export function subscribeToUsers(cb: (users: User[]) => void): Unsubscribe {
  return onValue(ref(db, 'users'), (snap) => {
    const users: User[] = []
    snap.forEach((child) => {
      users.push({ id: child.key as string, ...child.val() })
    })
    cb(users)
  })
}

export function subscribeToClasses(cb: (classes: Class[]) => void): Unsubscribe {
  return onValue(ref(db, 'classes'), (snap) => {
    const classes: Class[] = []
    snap.forEach((child) => {
      classes.push({ id: child.key as string, ...child.val() })
    })
    cb(classes)
  })
}

export function subscribeToStudents(cb: (students: Student[]) => void): Unsubscribe {
  return onValue(ref(db, 'students'), (snap) => {
    const students: Student[] = []
    snap.forEach((child) => {
      students.push({ id: child.key as string, ...child.val() })
    })
    cb(students)
  })
}

export function subscribeToAttendance(cb: (records: Attendance[]) => void): Unsubscribe {
  return onValue(ref(db, 'attendance'), (snap) => {
    const records: Attendance[] = []
    snap.forEach((child) => {
      records.push({ id: child.key as string, ...child.val() })
    })
    cb(records)
  })
}

/** Live subscription scoped to records dated on/after `date` (server-filtered
 * with a safe full-history fallback if the `date` index rule is missing). */
export function subscribeToAttendanceSince(
  date: string,
  cb: (records: Attendance[]) => void
): Unsubscribe {
  let unsub: Unsubscribe = () => {}
  let active = true
  const attach = (fallback: boolean) => {
    if (!active) return
    if (fallback) {
      unsub = subscribeToAttendance(cb)
      return
    }
    const q = query(ref(db, 'attendance'), orderByChild('date'), startAt(date))
    unsub = onValue(
      q,
      (snap) => {
        const out: Attendance[] = []
        snap.forEach((child) => {
          out.push({ id: child.key as string, ...(child.val() as object) } as Attendance)
        })
        cb(out)
      },
      () => attach(true)
    )
  }
  attach(false)
  return () => {
    active = false
    unsub()
  }
}

// --- Scoped live subscriptions (server-filtered with safe fallback) ----------
// These transfer only the rows a teacher actually needs, instead of the whole
// collection. If the ".indexOn" rule isn't deployed yet the query is rejected
// and we fall back to the previous full-node subscription (slow but correct).

export function subscribeToStudentsByClass(
  classId: string,
  cb: (students: Student[]) => void
): Unsubscribe {
  let unsub: Unsubscribe = () => {}
  let active = true
  const attach = (fallback: boolean) => {
    if (!active) return
    if (fallback) {
      unsub = subscribeToStudents((all) => cb(all.filter((s) => s.classId === classId)))
      return
    }
    const q = query(ref(db, 'students'), orderByChild('classId'), equalTo(classId))
    unsub = onValue(
      q,
      (snap) => {
        const out: Student[] = []
        snap.forEach((child) => {
          out.push({ id: child.key as string, ...(child.val() as object) } as Student)
        })
        cb(out)
      },
      () => attach(true)
    )
  }
  attach(false)
  return () => {
    active = false
    unsub()
  }
}

export function subscribeToAttendanceByTeacher(
  teacherId: string,
  cb: (records: Attendance[]) => void
): Unsubscribe {
  let unsub: Unsubscribe = () => {}
  let active = true
  const attach = (fallback: boolean) => {
    if (!active) return
    if (fallback) {
      unsub = subscribeToAttendance((all) =>
        cb(all.filter((r) => r.teacherId === teacherId))
      )
      return
    }
    const q = query(ref(db, 'attendance'), orderByChild('teacherId'), equalTo(teacherId))
    unsub = onValue(
      q,
      (snap) => {
        const out: Attendance[] = []
        snap.forEach((child) => {
          out.push({ id: child.key as string, ...(child.val() as object) } as Attendance)
        })
        cb(out)
      },
      () => attach(true)
    )
  }
  attach(false)
  return () => {
    active = false
    unsub()
  }
}

export function subscribeToAbsentAlerts(cb: (alerts: AbsentAlert[]) => void): Unsubscribe {
  return onValue(ref(db, 'absentAlerts'), (snap) => {
    const alerts: AbsentAlert[] = []
    snap.forEach((child) => {
      alerts.push({ studentId: child.key as string, ...child.val() })
    })
    cb(alerts)
  })
}

export function subscribeToExams(cb: (exams: Exam[]) => void): Unsubscribe {
  return onValue(ref(db, 'exams'), (snap) => {
    const exams: Exam[] = []
    snap.forEach((child) => {
      exams.push({ id: child.key as string, ...child.val() })
    })
    cb(exams)
  })
}

// ==================== Audit Log ====================
export async function logAction(data: {
  actorId?: string
  actorName?: string
  action: string // e.g. 'create' | 'update' | 'delete' | 'login'
  entity: string // e.g. 'student' | 'user' | 'class'
  entityId?: string
  details?: string
}): Promise<void> {
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await set(ref(db, `audit/${id}`), {
      ...data,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit logging must NEVER block the primary operation. The deployed
    // database rules only allow admins to write to /audit, so audit entries
    // triggered by teacher actions are intentionally skipped here.
  }
}

// ==================== Exported API ====================
export const rtdb = {
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  getAllClasses,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
  getStudentsByClass,
  setStudentPhoto,
  getStudentPhoto,
  getExam,
  createExam,
  updateExam,
  deleteExam,
  getAllExams,
  getExamsByClass,
  createAnnouncement,
  deleteAnnouncement,
  subscribeToAnnouncements,
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getAllAttendance,
  getAllAttendanceSince,
  getAttendanceByClassAndDate,
  getAttendanceByTeacher,
  getAttendanceByStudent,
  getAbsentAlerts,
  acknowledgeAbsentAlert,
  getMissingAttendanceAlerts,
  setMissingAttendanceAlert,
  updateMissingAttendanceAlert,
  subscribeToMissingAttendanceAlerts,
  getSettings,
  getRegistrationOpen,
  updateSettings,
  subscribeToUsers,
  subscribeToClasses,
  subscribeToStudents,
  subscribeToAttendance,
  subscribeToAttendanceSince,
  subscribeToAbsentAlerts,
  subscribeToExams,
  subscribeToStudentsByClass,
  subscribeToAttendanceByTeacher,
  logAction,
}

export default rtdb