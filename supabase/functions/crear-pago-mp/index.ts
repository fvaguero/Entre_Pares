import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reservaId, titulo, precio, emailEstudiante } = await req.json()

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            id: reservaId,
            title: `Tutoría: ${titulo}`,
            description: `Reserva ID: ${reservaId}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: Number(precio)
          }
        ],
        payer: {
          email: emailEstudiante
        },
        external_reference: reservaId,
        back_urls: {
          success: "https://tu-sitio-en-render.com/dashboard-estudiante.html?pago=exito",
          failure: "https://tu-sitio-en-render.com/dashboard-estudiante.html?pago=error",
          pending: "https://tu-sitio-en-render.com/dashboard-estudiante.html?pago=pendiente"
        },
        auto_return: "approved"
      })
    })

    const data = await response.json()

    if (!response.ok) {
        console.error("Error MP:", data);
        throw new Error("Error al crear preferencia en MercadoPago")
    }

    return new Response(JSON.stringify({ urlPago: data.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})