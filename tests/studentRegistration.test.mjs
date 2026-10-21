import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const {
  emptyRegistration,
  missingRegistrationFields,
  registrationToStudentFields,
  registrationFromStudent,
  normalizeRegistrationOptions,
  parseListText,
  DEFAULT_REGISTRATION_OPTIONS,
  REGISTRATION_LIST_KEYS,
} = await import('../src/lib/registration.ts')

/**
 * Student registration form (family information), as agreed with the owner:
 *  - required: the student's academic status, and for the father and the
 *    mother their name, phone, occupation, education level and Qur'an level;
 *  - the parents' phones fill the existing parentPhone / alternativePhone;
 *  - the level dropdowns come from madrasa-editable lists with an "Other".
 */

function filledRegistration() {
  const r = emptyRegistration()
  r.quranLevel = 'Juz Amma'
  for (const who of ['father', 'mother']) {
    r[who].name = who === 'father' ? 'Ahmed Ali' : 'Fatima Hassan'
    r[who].phone = who === 'father' ? '0911000001' : '0911000002'
    r[who].occupation = who === 'father' ? 'Trader' : 'Nurse'
    r[who].educationLevel = 'Degree'
    r[who].quranLevel = 'Hifz - 5 Juz'
  }
  return r
}

describe('Registration form: required fields', () => {
  test('an empty form is missing the student academic status and every required parent field', () => {
    const missing = missingRegistrationFields(emptyRegistration())
    assert.deepEqual(missing, [
      'quranLevel',
      'father.name',
      'father.phone',
      'father.occupation',
      'father.educationLevel',
      'father.quranLevel',
      'mother.name',
      'mother.phone',
      'mother.occupation',
      'mother.educationLevel',
      'mother.quranLevel',
    ])
  })

  test('a fully filled form has nothing missing; blanks of spaces still count as missing', () => {
    const r = filledRegistration()
    assert.deepEqual(missingRegistrationFields(r), [])
    r.mother.phone = '   '
    assert.deepEqual(missingRegistrationFields(r), ['mother.phone'])
  })

  test('address, kitabs, ages, last year and the student phone are optional', () => {
    const r = filledRegistration()
    r.subCity = ''
    r.kebele = ''
    r.kitabs = ''
    r.lastYearLevel = ''
    r.lastYearResult = ''
    r.phone = ''
    r.father.age = ''
    assert.deepEqual(missingRegistrationFields(r), [])
  })
})

describe('Registration form: mapping to the student record', () => {
  test("the father's phone fills parentPhone and the mother's the alternativePhone", () => {
    const fields = registrationToStudentFields(filledRegistration())
    assert.equal(fields.parentPhone, '0911000001')
    assert.equal(fields.alternativePhone, '0911000002')
    assert.equal(fields.parentName, 'Ahmed Ali')
    assert.equal(fields.father.phone, '0911000001')
    assert.equal(fields.mother.name, 'Fatima Hassan')
  })

  test('without a father phone the mother becomes the parent phone (no duplicate alternative)', () => {
    const r = filledRegistration()
    r.father.phone = ''
    const fields = registrationToStudentFields(r)
    assert.equal(fields.parentPhone, '0911000002')
    assert.equal(fields.alternativePhone, '')
  })

  test('parents marked "same address" copy the student sub-city and kebele', () => {
    const r = filledRegistration()
    r.subCity = 'Bole'
    r.kebele = '05'
    r.father.sameAddress = true
    r.mother.sameAddress = false
    r.mother.subCity = 'Yeka'
    r.mother.kebele = '12'
    const fields = registrationToStudentFields(r)
    assert.equal(fields.father.subCity, 'Bole')
    assert.equal(fields.father.kebele, '05')
    assert.equal(fields.mother.subCity, 'Yeka')
    assert.equal(fields.mother.kebele, '12')
  })

  test('values are trimmed and ages become numbers', () => {
    const r = filledRegistration()
    r.quranLevel = '  Juz Amma '
    r.father.age = '45'
    r.mother.age = 'abc'
    const fields = registrationToStudentFields(r)
    assert.equal(fields.quranLevel, 'Juz Amma')
    assert.equal(fields.father.age, 45)
    assert.equal(fields.mother.age, undefined)
  })

  test('a saved record round-trips back into the form', () => {
    const r = filledRegistration()
    r.subCity = 'Bole'
    r.kebele = '05'
    r.mother.sameAddress = false
    r.mother.subCity = 'Yeka'
    r.mother.kebele = '12'
    const fields = registrationToStudentFields(r)
    const student = { id: 's1', name: 'Test', classId: 'c1', isActive: true, createdAt: '', createdBy: '', updatedAt: '', ...fields }
    const back = registrationFromStudent(student)
    assert.equal(back.quranLevel, 'Juz Amma')
    assert.equal(back.father.name, 'Ahmed Ali')
    assert.equal(back.father.sameAddress, true)
    assert.equal(back.mother.sameAddress, false)
    assert.equal(back.mother.subCity, 'Yeka')
    assert.deepEqual(missingRegistrationFields(back), [])
  })

  test('a student registered before this form shows the old parent phones under the parents', () => {
    const legacy = {
      id: 's0',
      name: 'Old',
      classId: 'c1',
      isActive: true,
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      parentName: 'Legacy Parent',
      parentPhone: '0911111111',
      alternativePhone: '0922222222',
    }
    const form = registrationFromStudent(legacy)
    assert.equal(form.father.name, 'Legacy Parent')
    assert.equal(form.father.phone, '0911111111')
    assert.equal(form.mother.phone, '0922222222')
  })
})

describe('Registration dropdown lists', () => {
  test('the lists cover the madrasa level, Qur\'an level, education level and result', () => {
    assert.deepEqual(REGISTRATION_LIST_KEYS, ['madrasaLevels', 'quranLevels', 'kitabs', 'educationLevels', 'results'])
    for (const key of REGISTRATION_LIST_KEYS) assert.ok(DEFAULT_REGISTRATION_OPTIONS[key].length > 0)
  })

  test('"one entry per line" text is trimmed, de-duplicated and freed of blank lines', () => {
    assert.deepEqual(parseListText(' Level 1 \n\nLevel 2\nlevel 1\r\nLevel 3\n'), ['Level 1', 'Level 2', 'Level 3'])
  })

  test('unset lists fall back to the defaults, saved lists (even empty) are kept', () => {
    assert.deepEqual(normalizeRegistrationOptions(null), DEFAULT_REGISTRATION_OPTIONS)
    const custom = normalizeRegistrationOptions({ quranLevels: { 0: 'Qaida', 1: 'Hifz' }, results: [] })
    assert.deepEqual(custom.quranLevels, ['Qaida', 'Hifz'])
    assert.deepEqual(custom.results, [])
    assert.deepEqual(custom.madrasaLevels, DEFAULT_REGISTRATION_OPTIONS.madrasaLevels)
  })

  test('every member of the madrasa may read the lists (Ustazes register students too)', () => {
    const rules = fs.readFileSync(path.resolve('database.rules.json'), 'utf8')
    const block = rules.match(/"registrationOptions":\s*\{\s*"\.read":\s*"([^"]+)"/)
    assert.ok(block, 'settings/registrationOptions must carry its own .read rule')
    assert.doesNotMatch(block[1], /role'\)\.val\(\) === 'admin'/, 'the read rule must not be admin-only')
  })

  test('kitabs are chosen from the editable list with an "Other" entry, for students, parents and ustazes', () => {
    const family = fs.readFileSync(path.resolve('src/components/students/FamilyInfoFields.tsx'), 'utf8')
    assert.equal((family.match(/options=\{options\.kitabs\}/g) || []).length, 2, 'student and guardian kitabs use the list')
    assert.match(family, /<option value=\{OTHER\}>/)
    const teachers = fs.readFileSync(path.resolve('src/app/admin/teachers/page.tsx'), 'utf8')
    assert.match(teachers, /options=\{registrationOptions\.kitabs\}/)
    assert.match(teachers, /options=\{registrationOptions\.quranLevels\}/)
  })

  test('an ustaz account requires a phone and carries Qur\'an level, kitabs and language', () => {
    const create = fs.readFileSync(path.resolve('src/app/api/admin/users/route.ts'), 'utf8')
    assert.match(create, /role === 'teacher' && !text\(phone\)/)
    assert.match(create, /record\.quranLevel = /)
    assert.match(create, /record\.kitabs = /)
    assert.match(create, /isLocale\(text\(language\)\)/)
    const update = fs.readFileSync(path.resolve('src/app/api/admin/users/[uid]/route.ts'), 'utf8')
    assert.match(update, /user\.role === 'teacher' && !phone/)
    assert.match(update, /users\/\$\{uid\}\/kitabs/)
  })

  test('both registration forms use the shared family fields and validation', () => {
    for (const file of ['src/app/teacher/classes/page.tsx', 'src/app/admin/students/page.tsx']) {
      const source = fs.readFileSync(path.resolve(file), 'utf8')
      assert.ok(source.includes('<FamilyInfoFields'), `${file} must render FamilyInfoFields`)
      assert.ok(source.includes('missingRegistrationFields(family)'), `${file} must validate the family fields`)
      assert.ok(source.includes('registrationToStudentFields(family)'), `${file} must save the family fields`)
    }
  })
})

describe('Kitabs: several per person, stored as one string', () => {
  test('a stored "A, B" splits into choices and joins back cleanly', async () => {
    const { parseKitabs, joinKitabs } = await import('../src/lib/registration.ts')
    assert.deepEqual(parseKitabs("Qa'ida, Juz Amma ,  Safinat al-Najah"), ["Qa'ida", 'Juz Amma', 'Safinat al-Najah'])
    assert.deepEqual(parseKitabs('A، B; a'), ['A', 'B'])
    assert.deepEqual(parseKitabs(''), [])
    assert.deepEqual(parseKitabs(undefined), [])
    assert.equal(joinKitabs(['A', ' B ', 'a']), 'A, B')
  })

  test('every "kitabs studied before" field uses the multi-choice picker', () => {
    const family = fs.readFileSync(path.resolve('src/components/students/FamilyInfoFields.tsx'), 'utf8')
    assert.equal((family.match(/<KitabsPicker/g) || []).length, 2, 'student and guardians')
    const teachers = fs.readFileSync(path.resolve('src/app/admin/teachers/page.tsx'), 'utf8')
    assert.equal((teachers.match(/<KitabsPicker/g) || []).length, 2, 'ustaz create and edit')
    const picker = fs.readFileSync(path.resolve('src/components/students/KitabsPicker.tsx'), 'utf8')
    assert.match(picker, /role="checkbox"/)
    assert.match(picker, /kitabsPicker\.otherPlaceholder/)
  })
})
