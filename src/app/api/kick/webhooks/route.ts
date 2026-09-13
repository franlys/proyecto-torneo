/**
 * Kick Webhook Endpoint — Gate 2: Kick Subscriber Webhooks Integration (Remediado)
 *
 * Route Handler POST para recibir, verificar y registrar eventos técnicos de webhooks
 * de suscripción de Kick (channel.subscription.new, renewal, gifts).
 *
 * Seguridad & Reglas:
 * 1. Mantiene el raw body intacto para verificación criptográfica RSA.
 * 2. Valida los 6 headers obligatorios de Kick y rechaza headers prohibidos.
 * 3. Replay protection: abs(now - timestamp) ≤ 300,000 ms (5 min).
 * 4. Firma RSA PKCS#1 v1.5 + SHA-256 sobre `${message_id}.${timestamp}.${raw_body}`.
 * 5. Claim atómico de idempotencia y orphan recovery sobre `created_at` (300s).
 * 6. processed_at NULL mientras status != 'processed'.
 * 7. Persistencia exclusiva con admin client (service_role).
 * 8. MEDIUM-01: Respuesta 500 expone mensaje técnico genérico (sin leaking de errores internos).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  extractAndValidateHeaders,
  getKickPublicKey,
  isTimestampWithinTolerance,
  verifyKickWebhookSignature,
  validateAndParseEventPayload,
  claimKickWebhookEvent,
  markKickWebhookEventProcessed,
  markKickWebhookEventFailed,
  KickWebhookError,
} from '@/lib/services/kick-webhooks'
import { updateKickSubscriberProjection } from '@/lib/services/kick-eligibility'

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Obtener raw body como string intacto
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el cuerpo de la petición' },
      { status: 400 }
    )
  }

  // 2. Extraer y validar los 6 headers obligatorios
  let headersData: ReturnType<typeof extractAndValidateHeaders>
  try {
    headersData = extractAndValidateHeaders((name) => request.headers.get(name))
  } catch (err) {
    if (err instanceof KickWebhookError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Headers de Kick malformados' }, { status: 400 })
  }

  // 3. Replay Protection (tolerancia 5 min)
  try {
    if (!isTimestampWithinTolerance(headersData.timestamp)) {
      return NextResponse.json(
        { error: 'Timestamp fuera de la tolerancia permitida (Replay Attack Protection)' },
        { status: 401 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Timestamp inválido en los headers del webhook' },
      { status: 400 }
    )
  }

  // 4. Obtener clave pública RSA de Kick (con fallback) y verificar firma
  try {
    const publicKey = await getKickPublicKey()
    const isValidSignature = verifyKickWebhookSignature({
      messageId: headersData.messageId,
      timestamp: headersData.timestamp,
      rawBody,
      signatureB64: headersData.signature,
      publicKey,
    })

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Firma criptográfica RSA del webhook inválida' },
        { status: 401 }
      )
    }
  } catch (err) {
    if (err instanceof KickWebhookError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 })
    }
    return NextResponse.json({ error: 'Error verificando la firma del webhook' }, { status: 401 })
  }

  // 5. Parsear payload JSON y validar schema Zod según el eventType
  let jsonPayload: unknown
  try {
    jsonPayload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo del webhook no es un JSON válido' },
      { status: 400 }
    )
  }

  let broadcasterKickUserId: string
  try {
    const parsed = validateAndParseEventPayload(headersData.eventType, jsonPayload)
    broadcasterKickUserId = parsed.broadcasterKickUserId
  } catch (err) {
    if (err instanceof KickWebhookError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Payload de evento no válido' }, { status: 400 })
  }

  // 6. Claim atómico de idempotencia y orphan recovery (service_role)
  const adminClient = await createAdminClient()

  let claimResult: Awaited<ReturnType<typeof claimKickWebhookEvent>>
  try {
    claimResult = await claimKickWebhookEvent(adminClient, {
      messageId: headersData.messageId,
      subscriptionId: headersData.subscriptionId,
      eventType: headersData.eventType,
      eventVersion: headersData.eventVersion,
      broadcasterKickUserId,
    })
  } catch {
    return NextResponse.json(
      { error: 'Error interno de persistencia procesando la idempotencia' },
      { status: 500 }
    )
  }

  if (!claimResult.claimed) {
    if (claimResult.reason === 'already_processed') {
      return NextResponse.json({
        message: 'Evento ya procesado previamente (idempotente)',
        message_id: headersData.messageId,
      })
    }
    return NextResponse.json({
      message: 'Evento en proceso actualmente por otra instancia',
      message_id: headersData.messageId,
    })
  }

  // 7. Procesamiento técnico de proyección y marcado final (MEDIUM #1 remediado)
  try {
    // Gate 3: Actualizar proyección de elegibilidad en kick_subscribers PRIMERO
    await updateKickSubscriberProjection(adminClient, {
      eventType: headersData.eventType,
      rawPayload: jsonPayload,
      eventTimestampIso: headersData.timestamp,
    })

    // Si la proyección se actualiza con éxito, se marca como processed
    await markKickWebhookEventProcessed(adminClient, headersData.messageId)

    return NextResponse.json({
      success: true,
      message_id: headersData.messageId,
      status: 'processed',
      reclaim: claimResult.isReclaim,
    })
  } catch (err) {
    // Registra error sanitizado en DB marcando status = 'failed' (permite re-intento/reclaim) y HTTP 500
    await markKickWebhookEventFailed(adminClient, headersData.messageId, err)

    return NextResponse.json(
      { error: 'Error interno procesando el evento de webhook' },
      { status: 500 }
    )
  }
}

