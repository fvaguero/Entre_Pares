-- Datos de trazabilidad de Mercado Pago para comprobantes internos.
-- Ejecutar en Supabase SQL Editor antes de desplegar las Edge Functions.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_preference_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_status text,
  ADD COLUMN IF NOT EXISTS mercadopago_payment_type text,
  ADD COLUMN IF NOT EXISTS mercadopago_external_reference text,
  ADD COLUMN IF NOT EXISTS mercadopago_paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS reservas_mercadopago_payment_id_uidx
  ON public.reservas (mercadopago_payment_id)
  WHERE mercadopago_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservas_mercadopago_status_idx
  ON public.reservas (mercadopago_status);
