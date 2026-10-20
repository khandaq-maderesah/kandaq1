import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const {
  normalizePhoneNumber,
  SandboxSmsProvider,
  globalSandboxSms,
  getSmsProvider,
} = await import('../src/lib/server/smsAdapter.ts')

const {
  generateSmsMessage,
} = await import('../src/lib/smsMessage.ts')

describe('Pluggable SMS Adapter & Normalization (Task 4.1)', () => {
  beforeEach(() => {
    globalSandboxSms.clearQueue()
  })

  test('normalizes Ethiopian local phone numbers to E.164 international format', () => {
    assert.equal(normalizePhoneNumber('0911223344'), '+251911223344')
    assert.equal(normalizePhoneNumber('0711223344'), '+251711223344')
    assert.equal(normalizePhoneNumber('251911223344'), '+251911223344')
    assert.equal(normalizePhoneNumber('+251911223344'), '+251911223344')
  })

  test('sandbox provider simulates SMS delivery without network roundtrip', async () => {
    const sandbox = new SandboxSmsProvider()
    const result = await sandbox.send({
      to: '0911556677',
      text: 'Test absent notification',
      senderId: 'KMMS',
    })

    assert.equal(result.success, true)
    assert.equal(result.provider, 'sandbox')
    assert.equal(result.status, 'delivered')
    assert.match(result.messageId, /^sandbox_sms_/)

    const last = sandbox.getLastSent()
    assert.ok(last)
    assert.equal(last.to, '+251911556677')
    assert.equal(last.text, 'Test absent notification')
  })

  test('sandbox provider rejects invalid phone numbers and empty text', async () => {
    const sandbox = new SandboxSmsProvider()

    const badPhone = await sandbox.send({ to: '123', text: 'Hello' })
    assert.equal(badPhone.success, false)
    assert.match(badPhone.error, /Invalid destination phone number/)

    const emptyText = await sandbox.send({ to: '0911223344', text: '   ' })
    assert.equal(emptyText.success, false)
    assert.match(emptyText.error, /Message body cannot be empty/)
  })

  test('getSmsProvider safely defaults to sandbox in test environment', () => {
    const provider = getSmsProvider()
    assert.equal(provider.name, 'sandbox')
  })

  test('integrates with generateSmsMessage for end-to-end absent alert dispatch', async () => {
    const msgAm = generateSmsMessage('አብዱልከሪም', 'male', 'Amharic', { name: 'Khendeq', nameAm: 'ኸንደቅ' })
    assert.ok(msgAm.includes('ኸንደቅ'))
    assert.ok(msgAm.includes('አብዱልከሪም'))

    const provider = getSmsProvider()
    const sendResult = await provider.send({
      to: '0911889900',
      text: msgAm,
    })

    assert.equal(sendResult.success, true)
    assert.equal(sendResult.status, 'delivered')
  })
})
