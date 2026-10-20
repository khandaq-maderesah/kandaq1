import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

function computeMultiMadrasaStats(schools = [], users = []) {
  const suspended = schools.filter((s) => s.status === 'suspended').length
  const active = schools.length - suspended

  let totalUstazes = 0
  let totalAdmins = 0

  for (const u of users) {
    if (!u.schoolId) continue
    if (u.role === 'teacher') totalUstazes++
    else if (u.role === 'admin') totalAdmins++
  }

  const avgUstazesPerMadrasa = active > 0 ? Number((totalUstazes / active).toFixed(1)) : 0

  return {
    totalSchools: schools.length,
    activeSchools: active,
    suspendedSchools: suspended,
    totalUstazes,
    totalAdmins,
    avgUstazesPerMadrasa,
  }
}

function filterMadrasas(schools = [], query = '', statusFilter = 'all') {
  const q = query.trim().toLowerCase()
  return schools.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (!q) return true
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.slug && s.slug.toLowerCase().includes(q))
    )
  })
}

describe('Multi-Madrasa Analytics & Filtering (Task 3.3)', () => {
  const mockSchools = [
    { id: 'sch_1', name: 'Al-Huda Madrasa', slug: 'al-huda', address: 'Addis Ababa', status: 'active' },
    { id: 'sch_2', name: 'Al-Noor Madrasa', slug: 'al-noor', address: 'Dire Dawa', status: 'active' },
    { id: 'sch_3', name: 'Badr Madrasa', slug: 'badr', address: 'Jimma', status: 'suspended' },
  ]

  const mockUsers = [
    { uid: 'u1', role: 'teacher', schoolId: 'sch_1' },
    { uid: 'u2', role: 'teacher', schoolId: 'sch_1' },
    { uid: 'u3', role: 'admin', schoolId: 'sch_1' },
    { uid: 'u4', role: 'teacher', schoolId: 'sch_2' },
    { uid: 'u5', role: 'admin', schoolId: 'sch_2' },
    { uid: 'u6', role: 'teacher', schoolId: 'sch_3' },
    { uid: 'u7', role: 'superadmin' }, // No schoolId
  ]

  test('computes platform-wide multi-madrasa metrics accurately', () => {
    const stats = computeMultiMadrasaStats(mockSchools, mockUsers)
    assert.equal(stats.totalSchools, 3)
    assert.equal(stats.activeSchools, 2)
    assert.equal(stats.suspendedSchools, 1)
    assert.equal(stats.totalUstazes, 4)
    assert.equal(stats.totalAdmins, 2)
    assert.equal(stats.avgUstazesPerMadrasa, 2.0)
  })

  test('filters madrasas by search query', () => {
    const searchByName = filterMadrasas(mockSchools, 'Noor')
    assert.equal(searchByName.length, 1)
    assert.equal(searchByName[0].name, 'Al-Noor Madrasa')

    const searchByAddress = filterMadrasas(mockSchools, 'Addis')
    assert.equal(searchByAddress.length, 1)
    assert.equal(searchByAddress[0].name, 'Al-Huda Madrasa')
  })

  test('filters madrasas by status (active vs suspended)', () => {
    const activeOnly = filterMadrasas(mockSchools, '', 'active')
    assert.equal(activeOnly.length, 2)

    const suspendedOnly = filterMadrasas(mockSchools, '', 'suspended')
    assert.equal(suspendedOnly.length, 1)
    assert.equal(suspendedOnly[0].name, 'Badr Madrasa')
  })
})
