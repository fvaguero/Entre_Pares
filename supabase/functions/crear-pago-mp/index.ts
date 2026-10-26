import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE_URL = Deno.env.get('APP_BASE_URL')

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    if (!MP_ACCESS_TOKEN || !APP_BASE_URL) {
      throw new Error('Faltan configurar MP_ACCESS_TOKEN o APP_BASE_URL en los secretos de Supabase.')
    }
    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debés iniciar sesión para pagar.' }, 401)

    const token = authorization.slice(7)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'La sesión no es válida.' }, 401)

    const { reservaId } = await req.json()
    if (!reservaId || typeof reservaId !== 'string') return json({ error: 'Falta el identificador de la reserva.' }, 400)

    // El precio y el correo se obtienen de la base de datos, nunca del navegador.
    const { data: reserva, error: reservaError } = await supabaseAdmin
      .from('reservas')
      .select('id, estudiante_id, estado, estado_pago, precio, tutor:tutor_id (precio_hora)')
      .eq('id', reservaId)
      .eq('estudiante_id', authData.user.id)
      .single()
    if (reservaError || !reserva) return json({ error: 'No se encontró la reserva o no te pertenece.' }, 404)

    const estadoReserva = String(reserva.estado || '').toLowerCase()
    if (['cancelada', 'cancelado', 'rechazada', 'rechazado'].includes(estadoReserva)) {
      return json({ error: 'No se puede pagar una tutoría cancelada o rechazada.' }, 409)
    }
    const estadoPago = String(reserva.estado_pago || '').toLowerCase()
    if (['pagado', 'pagada', 'aprobado', 'aprobada', 'completado', 'completada', 'acreditado', 'acreditada'].includes(estadoPago)) {
      return json({ error: 'Esta reserva ya figura como pagada.' }, 409)
    }

    const precioExistente = Number(reserva.precio)
    const precioTutor = Number(reserva.tutor?.precio_hora)
    const importe = Number.isFinite(precioExistente) && precioExistente > 0
      ? precioExistente
      : precioTutor
    if (!Number.isFinite(importe) || importe <= 0) {
      return json({ error: 'La reserva no tiene un precio válido. Pedile al tutor que revise su tarifa.' }, 400)
    }

    // Congelar el precio en la reserva para que el comprobante no dependa de cambios futuros de tarifa.
    if (!(Number.isFinite(precioExistente) && precioExistente > 0)) {
      const { error: precioError } = await supabaseAdmin
        .from('reservas')
        .update({ precio: importe })
        .eq('id', reservaId)
        .eq('estudiante_id', authData.user.id)
      if (precioError) throw new Error('No se pudo guardar el importe de la reserva.')
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: reservaId,
          title: `Tutoría: ${reservaId}`,
          description: `Pago de tutoría en Entre Pares · Reserva ${reservaId}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: importe,
        }],
        payer: { email: authData.user.email },
        external_reference: reservaId,
        notification_url: `${SUPABASE_URL}/functions/v1/webhook-mp`,
        back_urls: {
          success: `${APP_BASE_URL}/dashboard-estudiante.html?pago=exito`,
          failure: `${APP_BASE_URL}/dashboard-estudiante.html?pago=error`,
          pending: `${APP_BASE_URL}/dashboard-estudiante.html?pago=pendiente`,
        },
        auto_return: 'approved',
        metadata: { reserva_id: reservaId, estudiante_id: authData.user.id },
      }),
    })
    const preference = await response.json()
    if (!response.ok) {
      console.error('Mercado Pago rechazó la preferencia:', preference)
      return json({ error: 'Mercado Pago no pudo crear el enlace de pago.' }, 502)
    }

    const { error: updateError } = await supabaseAdmin
      .from('reservas')
      .update({ mercadopago_preference_id: preference.id, mercadopago_external_reference: reservaId })
      .eq('id', reservaId)
    if (updateError) throw updateError

    return json({ urlPago: preference.init_point })
  } catch (error) {
    console.error('Error al crear el pago:', error)
    return json({ error: error.message || 'No se pudo iniciar el pago.' }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
