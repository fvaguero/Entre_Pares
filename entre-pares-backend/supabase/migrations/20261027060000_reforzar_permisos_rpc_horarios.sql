BEGIN;

-- Estas funciones validan auth.uid() y la participación en la reserva.
-- No deben poder invocarse desde sesiones anónimas.
ALTER FUNCTION public.proponer_horario_desde_chat(uuid, timestamp with time zone)
    SET search_path = '';

ALTER FUNCTION public.responder_propuesta_horario_chat(uuid, boolean)
    SET search_path = '';

-- Revocar permisos heredados o concedidos explícitamente a PUBLIC/anon.
REVOKE ALL PRIVILEGES
    ON FUNCTION public.proponer_horario_desde_chat(uuid, timestamp with time zone)
    FROM PUBLIC;

REVOKE ALL PRIVILEGES
    ON FUNCTION public.proponer_horario_desde_chat(uuid, timestamp with time zone)
    FROM anon;

REVOKE ALL PRIVILEGES
    ON FUNCTION public.responder_propuesta_horario_chat(uuid, boolean)
    FROM PUBLIC;

REVOKE ALL PRIVILEGES
    ON FUNCTION public.responder_propuesta_horario_chat(uuid, boolean)
    FROM anon;

-- Mantener el acceso de la aplicación y de procesos confiables del servidor.
GRANT EXECUTE
    ON FUNCTION public.proponer_horario_desde_chat(uuid, timestamp with time zone)
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.responder_propuesta_horario_chat(uuid, boolean)
    TO authenticated, service_role;

COMMIT;
