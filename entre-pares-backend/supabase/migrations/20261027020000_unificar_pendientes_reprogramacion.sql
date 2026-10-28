-- Evita solicitudes simultáneas por los dos canales de reprogramación.
-- Las RPC bloquean primero la fila de reservas; estos triggers verifican el otro canal
-- dentro de la misma transacción para impedir propuestas pendientes duplicadas.
create or replace function public.evitar_reprogramacion_pendiente_duplicada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.estado = 'Pendiente' then
        if TG_TABLE_NAME = 'solicitudes_reprogramacion' then
            if exists (
                select 1 from public.propuestas_horario_chat p
                where p.reserva_id = new.reserva_id and p.estado = 'Pendiente'
            ) then
                raise exception 'Ya existe una propuesta de horario pendiente en el chat para esta tutoría.';
            end if;
        elsif TG_TABLE_NAME = 'propuestas_horario_chat' then
            if exists (
                select 1 from public.solicitudes_reprogramacion s
                where s.reserva_id = new.reserva_id and s.estado = 'Pendiente'
            ) then
                raise exception 'Ya existe una solicitud de reprogramación pendiente para esta tutoría.';
            end if;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_evitar_reprogramacion_duplicada on public.solicitudes_reprogramacion;
create trigger trg_evitar_reprogramacion_duplicada
before insert or update of estado, reserva_id on public.solicitudes_reprogramacion
for each row execute function public.evitar_reprogramacion_pendiente_duplicada();

drop trigger if exists trg_evitar_propuesta_chat_duplicada on public.propuestas_horario_chat;
create trigger trg_evitar_propuesta_chat_duplicada
before insert or update of estado, reserva_id on public.propuestas_horario_chat
for each row execute function public.evitar_reprogramacion_pendiente_duplicada();

revoke all on function public.evitar_reprogramacion_pendiente_duplicada() from public;
