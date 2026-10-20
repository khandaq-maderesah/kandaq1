import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  generateStudentVerificationCode,
  generateBarcodeSvg,
} = await import('../src/lib/idCardBarcode.ts')

describe('Printable Student ID Card Barcode & Verification (Task 4.3)', () => {
  test('generates standardized student verification code', () => {
    const code = generateStudentVerificationCode('stu_123456', '07')
    assert.equal(code, 'KMMS-07-123456')

    // Missing roll number defaults to '00'
    const codeNoRoll = generateStudentVerificationCode('stu_abcdef', '')
    assert.equal(codeNoRoll, 'KMMS-00-ABCDEF')
  })

  test('generateBarcodeSvg produces valid, scalable SVG markup', () => {
    const svg = generateBarcodeSvg('KMMS-07-123456', { height: 30, showText: true })
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'))
    assert.ok(svg.endsWith('</svg>'))
    assert.ok(svg.includes('<rect'))
    assert.ok(svg.includes('<text'))
    assert.ok(svg.includes('KMMS-07-123456'))
  })

  test('generateBarcodeSvg handles text without label when showText is false', () => {
    const svgNoText = generateBarcodeSvg('KMMS-01-TEST', { height: 25, showText: false })
    assert.ok(svgNoText.startsWith('<svg'))
    assert.ok(svgNoText.includes('<rect'))
    assert.equal(svgNoText.includes('<text'), false)
  })
})
