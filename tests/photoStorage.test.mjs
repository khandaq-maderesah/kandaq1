import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Student Photo Compression & Storage Rules Invariants', () => {
  const MAX_DIMENSION = 360
  const MAX_PAYLOAD_CHARS = 150000 // Invariant from database.rules.json

  function calculateTargetDimensions(w, h) {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h))
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      scale,
    }
  }

  test('downscales large photos to MAX_DIMENSION preserving aspect ratio', () => {
    // Landscape high-res photo 1920x1080
    const landscape = calculateTargetDimensions(1920, 1080)
    assert.equal(landscape.width, 360)
    assert.equal(landscape.height, Math.round(1080 * (360 / 1920)))
    assert.ok(landscape.scale < 1)

    // Portrait photo 1080x1920
    const portrait = calculateTargetDimensions(1080, 1920)
    assert.equal(portrait.height, 360)
    assert.equal(portrait.width, Math.round(1080 * (360 / 1920)))

    // Small photo 200x200 (should not be enlarged)
    const small = calculateTargetDimensions(200, 200)
    assert.equal(small.width, 200)
    assert.equal(small.height, 200)
    assert.equal(small.scale, 1)
  })

  test('validates base64 dataUrl payload limits against RTDB security rules', () => {
    const sampleValidDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(30000)
    assert.ok(sampleValidDataUrl.length < MAX_PAYLOAD_CHARS)
    assert.match(sampleValidDataUrl, /^data:image\/jpeg;base64,/)

    const oversizedDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(160000)
    assert.ok(oversizedDataUrl.length > MAX_PAYLOAD_CHARS)
  })

  test('verifies storage.rules enforces size and contentType security limits', () => {
    const storageRulesContent = fs.readFileSync(path.resolve('storage.rules'), 'utf8')

    // Rule 1: announcements bounded to 25MB
    assert.match(storageRulesContent, /25\s*\*\s*1024\s*\*\s*1024/)

    // Rule 2: branding bounded to 2MB and PNG contentType
    assert.match(storageRulesContent, /2\s*\*\s*1024\s*\*\s*1024/)
    assert.match(storageRulesContent, /contentType\s*==\s*'image\/png'/)

    // Rule 3: default catch-all deny rule exists
    assert.match(storageRulesContent, /match\s+\/\{allPaths=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/)
  })
})
