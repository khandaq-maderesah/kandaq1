// User Types
export type UserRole = 'admin' | 'teacher'
export type UserStatus = 'active' | 'inactive'

export interface User {
  uid: string
  email: string
  name: string
  phone?: string
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
  createdBy: string
  lastLogin?: string
  assignedClassIds?: string[]
}

// Class Types
export interface Class {
  id: string
  name: string
  description?: string
  grade?: string
  section?: string
  teacherId: string
  teacherName?: string
  academicYear: string
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
  studentCount?: number
}

// Student Types
export interface Student {
  id: string
  name: string
  rollNumber?: string
  gender?: 'male' | 'female'
  age?: number
  dateOfBirth?: string
  photoUrl?: string
  parentLanguage?: 'Amharic' | 'Afaan Oromoo'
  classId: string
  className?: string
  section?: string
  parentName?: string
  parentPhone: string
  alternativePhone?: string
  parentEmail?: string
  parentRelationship?: string
  address?: string
  city?: string
  isActive: boolean
  createdAt: string
  createdBy: string
  createdByName?: string
  createdByRole?: string
  updatedAt: string
  admissionNumber?: string
  admissionDate?: string
}

// Attendance Types
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface Attendance {
  id: string
  studentId: string
  classId: string
  date: string // YYYY-MM-DD format
  status: AttendanceStatus
  studentName: string
  className: string
  teacherId: string
  markedBy: string
  markedAt: string
  note?: string
  excuseNote?: string
}

// Form Types
export interface CreateUserForm {
  email: string
  password: string
  name: string
  phone?: string
  role: UserRole
}

export interface CreateClassForm {
  name: string
  description?: string
  grade?: string
  section?: string
  teacherId: string
  academicYear: string
}

// Absence Alert Types
export interface AbsentAlert {
  studentId: string
  name?: string
  className?: string
  section?: string
  streak?: number
  triggeredAt?: string
  resolved?: boolean
  streakAtResolve?: number
  resolvedAt?: string
  resolvedBy?: string
  updatedAt?: string
}

// Alert raised when a teacher has not marked attendance for their class on a given day.
// Id is `${date}_${classId}`.
export type ReminderAudience = 'admin' | 'teacher'

export interface MissingAttendanceAlert {
  id: string
  date: string // YYYY-MM-DD
  classId: string
  className: string
  section?: string
  teacherId: string
  teacherName: string
  adminNotified: boolean
  adminNotifiedAt?: string
  teacherNotified: boolean
  teacherNotifiedAt?: string
  resolved: boolean
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateStudentForm {
  name: string
  rollNumber?: string
  gender?: 'male' | 'female'
  age?: number
  dateOfBirth?: string
  photoUrl?: string
  parentLanguage?: 'Amharic' | 'Afaan Oromoo'
  classId: string
  parentName?: string
  parentPhone: string
  parentEmail?: string
  alternativePhone?: string
  parentRelationship?: string
  address?: string
  city?: string
}

export interface AttendanceRecordForm {
  studentId: string
  classId: string
  date: string
  status: AttendanceStatus
  note?: string
}

// ==================== Exam / Results Types ====================
export type ExamType = 'mid' | 'assignment' | 'final'
export type ExamStatus = 'draft' | 'saved'

export interface ExamRow {
  studentId: string
  studentName: string
  rollNumber?: string
  marks: Record<string, number> // subject name -> mark obtained
  total: number
  average: number
  percentage: number
  rank: number
}

export interface SubjectStat {
  max: number
  min: number
  sum: number
  average: number
}

export interface ExamSummary {
  subjectStats: Record<string, SubjectStat>
  overallMax: number
  overallMin: number
  overallSum: number
  overallAverage: number
}

export interface Exam {
  id: string
  title: string
  type: ExamType
  classId: string
  className: string
  section?: string
  subjects: string[]
  subjectMax: Record<string, number> // subject name -> max marks
  teacherId: string
  teacherName: string
  status: ExamStatus
  rows: Record<string, ExamRow> // keyed by studentId
  summary: ExamSummary
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Academic year the exam belongs to (e.g. "2025-2026").
   *  Auto-populated from the class when the exam is created.
   *  Legacy exams without this field show under "Legacy". */
  academicYear?: string
}

// Announcement Types
export type AnnouncementAudience = 'everyone' | 'teachers' | 'admins'

export interface AnnouncementAttachment {
  id: string
  name: string
  url: string
  storagePath?: string
  type: 'image' | 'file'
  mimeType?: string
  size?: number
}

export interface Announcement {
  id: string
  title: string
  content: string
  createdAt: string // ISO date
  createdById?: string
  createdByName?: string
  attachments?: AnnouncementAttachment[]
  /** Who should see this announcement. Defaults to 'everyone'. */
  audience?: AnnouncementAudience
}
