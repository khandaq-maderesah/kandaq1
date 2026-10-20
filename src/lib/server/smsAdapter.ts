export interface SmsSendParams {
  to: string
  text: string
  senderId?: string
}

export interface SmsSendResult {
  success: boolean
  messageId?: string
  provider: 'sandbox' | 'afromessage' | 'custom_webhook'
  status: 'sent' | 'delivered' | 'failed' | 'queued'
  error?: string
}

export interface SmsProvider {
  readonly name: 'sandbox' | 'afromessage' | 'custom_webhook'
  send(params: SmsSendParams): Promise<SmsSendResult>
}

/**
 * Normalizes an Ethiopian or international phone number to standard format.
 * Examples: '0911223344' -> '+251911223344', '+251911223344' -> '+251911223344'.
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    return `+251${cleaned.slice(1)}`
  }
  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return `+251${cleaned.slice(1)}`
  }
  if (cleaned.startsWith('251') && cleaned.length === 12) {
    return `+${cleaned}`
  }
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  return cleaned
}

/**
 * In-memory Sandbox SMS Provider for testing and local development.
 * Simulates SMS sending without making external HTTP requests or incurring costs.
 */
export class SandboxSmsProvider implements SmsProvider {
  readonly name = 'sandbox' as const
  private sentMessages: Array<SmsSendParams & { messageId: string; timestamp: number }> = []

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const normalizedTo = normalizePhoneNumber(params.to)
    if (!normalizedTo || normalizedTo.length < 9) {
      return {
        success: false,
        provider: this.name,
        status: 'failed',
        error: `Invalid destination phone number: ${params.to}`,
      }
    }

    if (!params.text || params.text.trim().length === 0) {
      return {
        success: false,
        provider: this.name,
        status: 'failed',
        error: 'Message body cannot be empty',
      }
    }

    const messageId = `sandbox_sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.sentMessages.push({
      ...params,
      to: normalizedTo,
      messageId,
      timestamp: Date.now(),
    })

    return {
      success: true,
      messageId,
      provider: this.name,
      status: 'delivered',
    }
  }

  getSentMessages() {
    return [...this.sentMessages]
  }

  getLastSent() {
    return this.sentMessages[this.sentMessages.length - 1] ?? null
  }

  clearQueue() {
    this.sentMessages = []
  }
}

/**
 * AfroMessage SMS Gateway Provider.
 * Integrates with AfroMessage HTTP API for local Ethiopian SMS delivery.
 */
export class AfroMessageSmsProvider implements SmsProvider {
  readonly name = 'afromessage' as const
  private apiKey: string
  private senderName?: string
  private identifierId?: string

  constructor(config: { apiKey: string; senderName?: string; identifierId?: string }) {
    this.apiKey = config.apiKey
    this.senderName = config.senderName
    this.identifierId = config.identifierId
  }

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const to = normalizePhoneNumber(params.to)
    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        status: 'failed',
        error: 'AfroMessage API key is not configured',
      }
    }

    try {
      const endpoint = 'https://api.afromessage.com/api/send'
      const payload: Record<string, string> = {
        to,
        message: params.text,
      }
      if (this.senderName || params.senderId) {
        payload.from = params.senderId || this.senderName || ''
      }
      if (this.identifierId) {
        payload.sender = this.identifierId
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.acknowledge === 'error') {
        return {
          success: false,
          provider: this.name,
          status: 'failed',
          error: data.response?.errors?.[0] || data.message || `HTTP ${res.status}`,
        }
      }

      return {
        success: true,
        messageId: data.response?.message_id || `afro_${Date.now()}`,
        provider: this.name,
        status: 'sent',
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        provider: this.name,
        status: 'failed',
        error: `Network error dispatching SMS: ${message}`,
      }
    }
  }
}

// Global shared sandbox instance for testing inspection
export const globalSandboxSms = new SandboxSmsProvider()

/**
 * Pluggable Factory: retrieves configured SMS provider based on environment.
 * In development, CI, or when credentials are not configured, safely defaults to Sandbox.
 */
export function getSmsProvider(): SmsProvider {
  const providerType = (process.env.SMS_PROVIDER || 'sandbox').toLowerCase()

  if (providerType === 'afromessage' || providerType === 'production') {
    const apiKey = process.env.SMS_API_KEY || process.env.AFROMESSAGE_API_KEY
    if (apiKey) {
      return new AfroMessageSmsProvider({
        apiKey,
        senderName: process.env.SMS_SENDER_NAME,
        identifierId: process.env.SMS_IDENTIFIER_ID,
      })
    }
  }

  return globalSandboxSms
}
