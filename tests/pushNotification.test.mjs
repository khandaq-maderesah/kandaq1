import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
} = await import('../src/lib/pushNotification.ts')

describe('Browser Push Notification Service', () => {
  test('exposes all required lifecycle functions', () => {
    assert.equal(typeof isNotificationSupported, 'function')
    assert.equal(typeof getNotificationPermission, 'function')
    assert.equal(typeof requestNotificationPermission, 'function')
    assert.equal(typeof showBrowserNotification, 'function')
  })

  test('isNotificationSupported returns false in headless / Node environment', () => {
    // In Node (non-browser), window is undefined
    assert.equal(isNotificationSupported(), false)
  })

  test('getNotificationPermission returns unsupported when window is undefined', () => {
    assert.equal(getNotificationPermission(), 'unsupported')
  })

  test('requestNotificationPermission gracefully returns unsupported without crashing', async () => {
    const res = await requestNotificationPermission()
    assert.equal(res, 'unsupported')
  })

  test('showBrowserNotification does not throw in headless environment', async () => {
    await assert.doesNotReject(async () => {
      await showBrowserNotification({
        title: 'Test Notification',
        body: 'Unit testing push notification service',
      })
    })
  })
})
