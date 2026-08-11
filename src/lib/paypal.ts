export function getPayPalApiUrl() {
  if (process.env.PAYPAL_API_URL) {
    return process.env.PAYPAL_API_URL.trim()
  }
  if (process.env.PAYPAL_ENVIRONMENT === 'sandbox') {
    return 'https://api-m.sandbox.paypal.com'
  }
  if (process.env.PAYPAL_MODE === 'live' || process.env.NODE_ENV === 'production') {
    return 'https://api-m.paypal.com'
  }
  return 'https://api-m.sandbox.paypal.com'
}

export async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const apiUrl = getPayPalApiUrl()

  if (!clientId || !clientSecret) {
    throw new Error('PayPal client ID or client secret is not defined.')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${apiUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store'
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to generate PayPal Access Token: ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export async function createPayPalOrder(amount: number, currency: string = 'USD') {
  const token = await getPayPalAccessToken()
  const apiUrl = getPayPalApiUrl()

  const res = await fetch(`${apiUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2)
          }
        }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal order creation failed: ${text}`)
  }

  return await res.json()
}

export async function capturePayPalPayment(orderId: string) {
  const token = await getPayPalAccessToken()
  const apiUrl = getPayPalApiUrl()

  const res = await fetch(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal capture failed: ${text}`)
  }

  return await res.json()
}

export async function sendPayPalPayout(email: string, amount: number) {
  const token = await getPayPalAccessToken()
  const apiUrl = getPayPalApiUrl()
  const senderBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const senderItemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`

  const res = await fetch(`${apiUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: '¡Recibiste tus fondos de Kronix!',
        recipient_type: 'EMAIL'
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: amount.toFixed(2),
            currency: 'USD'
          },
          note: 'Retiro de fondos desde tu billetera Kronix.',
          receiver: email,
          sender_item_id: senderItemId
        }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal Payout failed: ${text}`)
  }

  return await res.json()
}

export async function refundPayPalPayment(captureId: string, amount?: number, currency: string = 'USD') {
  const token = await getPayPalAccessToken()
  const apiUrl = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'

  const payload: any = {}
  if (amount) {
    payload.amount = {
      value: amount.toFixed(2),
      currency_code: currency
    }
  }

  const res = await fetch(`${apiUrl}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal refund failed: ${text}`)
  }

  return await res.json()
}
