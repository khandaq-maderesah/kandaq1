"""Generates database.rules.json (Realtime Database security rules).

The rules repeat the same school-membership checks in many places, so they are
written here once and expanded. Edit THIS file, then run:

    python scripts/generate-db-rules.py
    firebase deploy --only database
"""
import json, sys
U ="root.child('users/' + auth.uid)"
ROLE = f"{U}.child('role').val()"
MYSCHOOL = f"{U}.child('schoolId').val()"
ACTIVE_USER = f"{U}.child('status').val() !== 'inactive'"
SUPER = f"{ROLE} === 'superadmin'"
# A school admin (always has a schoolId) acting on users of their own school.
SCHOOL_ADMIN_USER = f"{ROLE} === 'admin' && {MYSCHOOL} != null && {ACTIVE_USER}"

def member(sid):
    return f"({MYSCHOOL} === {sid} && {ACTIVE_USER} && root.child('schoolInfo/' + {sid} + '/status').val() === 'active')"
def school_admin(sid):
    return f"({member(sid)} && {ROLE} === 'admin')"
def can_read(sid):
    return f"auth != null && ({SUPER} || {member(sid)})"
def can_admin(sid):
    return f"auth != null && ({SUPER} || {school_admin(sid)})"

S = "$schoolId"
READ, ADMIN, MEMBER = can_read(S), can_admin(S), member(S)
def class_teacher(class_expr):
    return f"root.child('schoolData/' + $schoolId + '/classes/' + {class_expr} + '/teacherId').val() === auth.uid"
NEW_CLASS_TEACHER = class_teacher("newData.child('classId').val()")
PHOTO_CLASS_TEACHER = class_teacher("root.child('schoolData/' + $schoolId + '/students/' + $studentId + '/classId').val()")
REQ_STUDENT = "root.child('schoolData/' + $schoolId + '/students/' + newData.child('studentId').val())"
REQ_STUDENT_TEACHER = class_teacher(f"{REQ_STUDENT}.child('classId').val()")
REQ_STUDENT_ACTIVE = f"{REQ_STUDENT}.child('isActive').val() !== false"

# --- Branding: slugs/{slug} -> schoolId and publicBranding/{schoolId} are public.
# A slug may only be claimed or released together with publicBranding.slug in
# the same (atomic) write, by the platform admin or that madrasa's admin.
NEW_ROOT = "newData.parent().parent()"
SLUG_CLAIM = (
    f"(!data.exists() && newData.exists() && {NEW_ROOT}.child('publicBranding/' + newData.val() + '/slug').val() === $slug"
    f" && ({SUPER} || ({SCHOOL_ADMIN_USER} && newData.val() === {MYSCHOOL})))"
)
SLUG_RELEASE = (
    f"(data.exists() && !newData.exists() && {NEW_ROOT}.child('publicBranding/' + data.val() + '/slug').val() !== $slug"
    f" && ({SUPER} || ({SCHOOL_ADMIN_USER} && data.val() === {MYSCHOOL})))"
)
BRANDING_SLUG_VALID = f"{NEW_ROOT}.parent().child('slugs/' + newData.val()).val() === $schoolId"

rules = {
  "users": {
    ".read": f"auth != null && ({SUPER} || ({SCHOOL_ADMIN_USER} && query.orderByChild === 'schoolId' && query.equalTo === {MYSCHOOL}))",
    ".indexOn": ["schoolId"],
    "$userId": {
      ".read": f"auth != null && (auth.uid === $userId || {SUPER} || ({SCHOOL_ADMIN_USER} && data.child('schoolId').val() === {MYSCHOOL}))",
      ".write": f"auth != null && ({SUPER} || (auth.uid === $userId && data.exists() && newData.exists()) || ({SCHOOL_ADMIN_USER} && data.exists() && data.child('schoolId').val() === {MYSCHOOL} && newData.child('schoolId').val() === {MYSCHOOL}))",
      "role": {".validate": f"newData.val() === data.val() || {SUPER} || ({SCHOOL_ADMIN_USER} && auth.uid !== $userId && data.val() !== 'superadmin' && newData.val() !== 'superadmin')"},
      "schoolId": {".validate": f"newData.val() === data.val() || {SUPER}"},
      "status": {".validate": f"newData.val() === data.val() || {SUPER} || ({SCHOOL_ADMIN_USER} && auth.uid !== $userId)"},
      "pushTokens": {
        ".read": f"auth != null && (auth.uid === $userId || {SUPER})",
        "$tokenId": {
          ".write": f"auth != null && (auth.uid === $userId || {SUPER})"
        }
      }
    }
  },
  "slugs": {
    ".read": True,
    "$slug": {
      ".write": f"auth != null && ({SLUG_CLAIM} || {SLUG_RELEASE})",
      ".validate": "!newData.exists() || ($slug.matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/) && newData.isString())"
    }
  },
  "publicBranding": {
    ".read": True,
    "$schoolId": {
      ".write": f"auth != null && newData.exists() && ({SUPER} || {school_admin(S)})",
      "slug": {".validate": f"newData.isString() && {BRANDING_SLUG_VALID}"},
      "name": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 100"},
      "appName": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30"},
      "logoVersion": {".validate": "newData.isNumber()"},
      "$other": {".validate": False}
    }
  },
  "schoolInfo": {
    ".read": f"auth != null && {SUPER}",
    "$schoolId": {
      ".read": f"auth != null && ({SUPER} || {MYSCHOOL} === $schoolId)",
      ".write": f"auth != null && ({SUPER} || ({school_admin(S)} && data.exists() && newData.exists()))",
      "status": {".validate": f"newData.val() === data.val() || {SUPER}"}
    }
  },
  "schoolData": {
    ".read": f"auth != null && {SUPER}",
    "$schoolId": {
      "classes": {".read": READ, "$classId": {".write": ADMIN}},
      "students": {
        ".read": READ, ".indexOn": ["classId"],
        # Teachers add/edit students of their classes, but deleting (archiving)
        # or moving a student needs an admin: classId/isActive/archive are
        # admin-only once the student exists, and archived students are frozen.
        "$studentId": {
          ".write": f"{ADMIN} || ({MEMBER} && newData.child('classId').exists() && {NEW_CLASS_TEACHER} && data.child('isActive').val() !== false)",
          "classId": {".validate": f"!data.exists() || newData.val() === data.val() || {ADMIN}"},
          "isActive": {".validate": f"newData.val() === data.val() || {ADMIN} || (!data.exists() && newData.val() === true)"},
          "archive": {".validate": ADMIN}
        }
      },
      "requests": {
        ".read": f"{ADMIN} || ({MEMBER} && query.orderByChild === 'requestedBy' && query.equalTo === auth.uid)",
        ".indexOn": ["requestedBy", "status", "studentId"],
        "$requestId": {
          ".read": f"{ADMIN} || ({MEMBER} && data.child('requestedBy').val() === auth.uid)",
          ".write": f"{ADMIN} || ({MEMBER} && ((!data.exists() && newData.child('requestedBy').val() === auth.uid && newData.child('status').val() === 'pending' && {REQ_STUDENT_TEACHER} && {REQ_STUDENT_ACTIVE}) || (data.exists() && data.child('requestedBy').val() === auth.uid && data.child('status').val() === 'pending' && newData.child('status').val() === 'cancelled' && newData.child('requestedBy').val() === auth.uid && newData.child('studentId').val() === data.child('studentId').val() && newData.child('type').val() === data.child('type').val())))",
          "type": {".validate": "newData.val() === 'student_delete' || newData.val() === 'student_transfer'"},
          "status": {".validate": "newData.val() === 'pending' || newData.val() === 'approved' || newData.val() === 'rejected' || newData.val() === 'cancelled'"},
          "reason": {".validate": "newData.isString() && newData.val().length >= 3 && newData.val().length <= 1000"},
          "toClassId": {".validate": "root.child('schoolData/' + $schoolId + '/classes/' + newData.val()).exists()"},
          "reviewNote": {".validate": "newData.isString() && newData.val().length <= 1000"}
        }
      },
      "studentPhotos": {
        ".read": READ,
        "$studentId": {".write": f"{ADMIN} || ({MEMBER} && {PHOTO_CLASS_TEACHER})"}
      },
      "attendance": {
        ".read": READ, ".indexOn": ["classId", "teacherId", "date", "studentId"],
        "$attendanceId": {".write": f"{ADMIN} || ({MEMBER} && newData.child('teacherId').val() === auth.uid && newData.child('classId').val() != null && {NEW_CLASS_TEACHER})"}
      },
      "absentAlerts": {".read": READ, "$studentId": {".write": ADMIN}},
      "missingAttendanceAlerts": {".read": READ, "$id": {".write": READ}},
      "adminPushTokens": {".read": ADMIN, "$tokenId": {".write": ADMIN}},
      "exams": {
        ".read": READ, ".indexOn": ["classId", "teacherId"],
        "$examId": {".write": f"{ADMIN} || ({MEMBER} && ((data.exists() && data.child('teacherId').val() === auth.uid) || (!data.exists() && newData.child('classId').exists() && {NEW_CLASS_TEACHER})))"}
      },
      "announcements": {".read": READ, "$announcementId": {".write": ADMIN}},
      "audit": {".read": ADMIN, "$id": {".write": f"{READ} && !data.exists()"}},
      "settings": {
        ".read": ADMIN, ".write": ADMIN,
        "registrationOpen": {".read": READ}
      }
    }
  }
}
json.dump({"rules": rules}, open(sys.argv[1] if len(sys.argv) > 1 else "database.rules.json", 'w', encoding='utf8', newline='\n'), indent=2, ensure_ascii=False)
print("ok")
