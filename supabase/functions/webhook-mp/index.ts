import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    if (!MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET) {
      console.error('Faltan MP_ACCESS_TOKEN o MP_WEBHOOK_SECRET.')
      return json({ error: 'Webhook no configurado.' }, 500)
    }

    const body = await req.json()
    const paymentId = body.data?.id ? String(body.data.id) : ''
    const topic = body.type || body.topic
    if (topic !== 'payment' || !paymentId) return json({ received: true, ignored: true })

    if (!await validarFirmaMercadoPago(req, paymentId)) {
      console.warn('Firma de notificación de Mercado Pago inválida.')
      return json({ error: 'Firma inválida.' }, 401)
    }

    // Se consulta la API oficial: nunca se confía en el estado enviado en el webhook.
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    const payment = await mpResponse.json()
    if (!mpResponse.ok) {
      console.error('No se pudo consultar el pago en Mercado Pago:', payment)
      return json({ error: 'No se pudo verificar el pago.' }, 502)
    }

    const reservaId = String(payment.external_reference || payment.metadata?.reserva_id || '')
    if (!reservaId) return json({ error: 'El pago no tiene una reserva asociada.' }, 400)

    const { data: reserva, error: reservaError } = await supabaseAdmin
      .from('reservas')
      .select('id, precio, estado_pago, estudiante_id')
      .eq('id', reservaId)
      .single()
    if (reservaError || !reserva) return json({ error: 'No se encontró la reserva asociada.' }, 404)

    // Verificaciones de importe, moneda y referencia para impedir acreditar pagos ajenos o parciales.
    const importeReserva = Number(reserva.precio)
    const importePagado = Number(payment.transaction_amount)
    if (payment.currency_id !== 'ARS' || !Number.isFinite(importeReserva) ||
        Math.abs(importePagado - importeReserva) > 0.01) {
      console.error('El importe o la moneda del pago no coincide con la reserva.', {
        reservaId, importeReserva, importePagado, moneda: payment.currency_id,
      })
      return json({ error: 'El importe o la moneda no coincide con la reserva.' }, 409)
    }

    const estadoMP = String(payment.status || '').toLowerCase()
    const estadoReserva = estadoMP === 'approved' ? 'Pagado'
      : estadoMP === 'rejected' ? 'Rechazado'
      : estadoMP === 'cancelled' ? 'Cancelado'
      : 'Pendiente'

    const fechaPago = estadoMP === 'approved'
      ? (payment.date_approved || new Date().toISOString())
      : null

    const update = {
      estado_pago: estadoReserva,
      fecha_pago: fechaPago,
      mercadopago_payment_id: paymentId,
      mercadopago_status: estadoMP,
      mercadopago_payment_type: payment.payment_type_id || null,
      mercadopago_external_reference: reservaId,
      mercadopago_paid_at: fechaPago,
    }
    const { error: updateError } = await supabaseAdmin
      .from('reservas')
      .update(update)
      .eq('id', reservaId)
    if (updateError) {
      console.error('Error al guardar el resultado del pago:', updateError)
      return json({ error: 'No se pudo actualizar la reserva.' }, 500)
    }

    return json({ received: true, reservaId, paymentStatus: estadoMP })
  } catch (error) {
    console.error('Error en webhook Mercado Pago:', error)
    return json({ error: error.message || 'Error procesando notificación.' }, 500)
  }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function validarFirmaMercadoPago(req: Request, paymentId: string): Promise<boolean> {
  const signature = req.headers.get('x-signature') || ''
  const requestId = req.headers.get('x-request-id') || ''
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, ...value] = part.trim().split('=')
    return [key, value.join('=')]
  }))
  const timestamp = parts.ts
  const receivedHash = parts.v1
  if (!timestamp || !receivedHash || !requestId) return false

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${timestamp};`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(MP_WEBHOOK_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest))
  const expectedHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  if (expectedHash.length !== receivedHash.length) return false
  let difference = 0
  for (let i = 0; i < expectedHash.length; i++) difference |= expectedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i)
  return difference === 0
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
