BEGIN;

-- Elimina únicamente la reseña duplicada confirmada por la usuaria.
DO $$
DECLARE
  filas_eliminadas integer;
BEGIN
  DELETE FROM public.resenas
  WHERE id = 2
    AND reserva_id = 'c1fd8b4b-83a2-4853-b685-004c116c3360'::uuid
    AND lower(calificado_por) = 'estudiante'
    AND estudiante_id = '01dcdc5d-f485-4ed7-a9f4-fcc8459ba967'::uuid
    AND tutor_id = 'b5f06f80-d0c6-4e6d-9594-135cc32f487b'::uuid;

  GET DIAGNOSTICS filas_eliminadas = ROW_COUNT;

  IF filas_eliminadas <> 1 THEN
    RAISE EXCEPTION
      'Se esperaba eliminar exactamente la reseña duplicada ID 2; filas eliminadas: %',
      filas_eliminadas;
  END IF;
END
$$;

-- No continuar si existen otras duplicaciones por tutoría y tipo de evaluador.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resenas
    GROUP BY reserva_id, lower(calificado_por)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Hay otras reseñas duplicadas por reserva y evaluador. Revisarlas antes de crear el índice único.';
  END IF;
END
$$;

-- Cada tutoría admite una reseña del estudiante y otra del tutor.
CREATE UNIQUE INDEX IF NOT EXISTS resenas_una_por_reserva_y_evaluador
ON public.resenas (reserva_id, lower(calificado_por));

-- Las reseñas siguen siendo consultables según las políticas RLS existentes.
-- Solo usuarios autenticados pueden insertar; nadie desde el cliente puede
-- modificar, eliminar, truncar ni alterar la estructura de la tabla.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.resenas FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.resenas FROM authenticated;

GRANT SELECT ON TABLE public.resenas TO anon, authenticated;
GRANT INSERT ON TABLE public.resenas TO authenticated;

COMMIT;
