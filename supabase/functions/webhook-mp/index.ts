import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // MercadoPago nos notifica cuando hay un evento relacionado con pagos
    if (body.type === 'payment' || body.action === 'payment.created') {
      const paymentId = body.data?.id

      if (paymentId) {
        // Consultamos los detalles del pago directamente a la API de MercadoPago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
          }
        })
        const paymentData = await mpRes.json()

        if (mpRes.ok && paymentData.status === 'approved') {
          // Extraemos el ID de la reserva que guardamos en external_reference
          const reservaId = paymentData.external_reference

          if (reservaId) {
            // Actualizamos la reserva como "Pagado" en nuestra base de datos de Supabase
            const { error: updateError } = await supabaseAdmin
              .from('reservas')
              .update({ estado_pago: 'Pagado' })
              .eq('id', reservaId)

            if (updateError) {
              console.error("Error al actualizar la reserva en Supabase:", updateError)
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Error en el Webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})