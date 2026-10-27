BEGIN;

-- Mantener los triggers nuevos, que aplican las validaciones actuales.
-- Retirar las implementaciones antiguas para que cada evento otorgue puntos una sola vez.
DROP TRIGGER IF EXISTS trg_puntos_por_calificacion
    ON public.resenas;

DROP TRIGGER IF EXISTS trg_puntos_reserva_finalizada
    ON public.reservas;

DROP TRIGGER IF EXISTS trg_puntos_contribucion_aprobada
    ON public.contribuciones_comunidad;

-- Los dos índices únicos protegen las mismas columnas.
-- Se conserva movimientos_puntos_accion_unica_idx.
DROP INDEX IF EXISTS public.movimientos_puntos_accion_unica;

COMMIT;
