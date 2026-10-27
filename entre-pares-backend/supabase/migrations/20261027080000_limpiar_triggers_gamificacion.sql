BEGIN;

-- Mantener los triggers nuevos, que aplican las validaciones actuales.
-- Retirar las implementaciones antiguas para que cada evento otorgue puntos una sola vez.
DROP TRIGGER IF EXISTS trg_puntos_por_calificacion
    ON public.resenas;

DROP TRIGGER IF EXISTS trg_puntos_reserva_finalizada
    ON public.reservas;

DROP TRIGGER IF EXISTS trg_puntos_contribucion_aprobada
    ON public.contribuciones_comunidad;

-- Conservar la restricción UNIQUE movimientos_puntos_accion_unica.
-- Eliminar solamente el índice independiente duplicado.
DROP INDEX IF EXISTS public.movimientos_puntos_accion_unica_idx;

COMMIT;
