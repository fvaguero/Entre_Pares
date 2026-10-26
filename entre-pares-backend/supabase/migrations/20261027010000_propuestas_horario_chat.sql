-- Propuestas de fecha y horario desde el chat (independientes de confirmar la tutoría).
create table if not exists public.propuestas_horario_chat (
    id uuid primary key default gen_random_uuid(),
    reserva_id uuid not null references public.reservas(id) on delete cascade,
    estudiante_id uuid not null references public.perfiles(id) on delete cascade,
    tutor_id uuid not null references public.perfiles(id) on delete cascade,
    propuesto_por uuid not null references public.perfiles(id) on delete cascade,
    fecha_propuesta timestamptz not null,
    estado text not null default 'Pendiente' check (estado in ('Pendiente','Aceptada','Rechazada')),
    created_at timestamptz not null default now(),
    respondido_por uuid references public.perfiles(id),
    responded_at timestamptz
);
create index if not exists idx_propuestas_horario_chat_reserva
on public.propuestas_horario_chat(reserva_id, estado, created_at desc);
create unique index if not exists uq_propuesta_horario_chat_pendiente
on public.propuestas_horario_chat(reserva_id) where estado = 'Pendiente';

alter table public.propuestas_horario_chat enable row level security;
drop policy if exists "participantes leen propuestas horario chat" on public.propuestas_horario_chat;
create policy "participantes leen propuestas horario chat"
on public.propuestas_horario_chat for select to authenticated
using (auth.uid() = estudiante_id or auth.uid() = tutor_id);

create or replace function public.proponer_horario_desde_chat(
    p_reserva_id uuid,
    p_fecha_propuesta timestamptz
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_reserva public.reservas%rowtype;
    v_id uuid;
    v_destinatario uuid;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;
    if p_fecha_propuesta is null or p_fecha_propuesta <= now() then
        raise exception 'La fecha y hora propuestas deben ser futuras.';
    end if;

    select * into v_reserva from public.reservas
    where id = p_reserva_id
      and (estudiante_id = auth.uid() or tutor_id = auth.uid())
    for update;
    if not found then raise exception 'No tenés acceso a esta tutoría.'; end if;
    if lower(coalesce(v_reserva.estado,'')) not in ('pendiente','aceptada','aprobada','confirmada') then
        raise exception 'Esta tutoría ya no admite propuestas de horario.';
    end if;

    v_destinatario := case when auth.uid() = v_reserva.estudiante_id
        then v_reserva.tutor_id else v_reserva.estudiante_id end;

    insert into public.propuestas_horario_chat
        (reserva_id, estudiante_id, tutor_id, propuesto_por, fecha_propuesta)
    values
        (v_reserva.id, v_reserva.estudiante_id, v_reserva.tutor_id, auth.uid(), p_fecha_propuesta)
    returning id into v_id;

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (
        auth.uid(), v_destinatario,
        'HORARIO_PROPUESTA|' || v_id::text || '|' ||
        to_char(p_fecha_propuesta at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS') || 'Z'
    );
    return v_id;
exception when unique_violation then
    raise exception 'Ya hay una propuesta de horario pendiente para esta tutoría.';
end;
$$;

create or replace function public.responder_propuesta_horario_chat(
    p_propuesta_id uuid,
    p_aceptar boolean
) returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_propuesta public.propuestas_horario_chat%rowtype;
    v_destinatario uuid;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;

    select * into v_propuesta from public.propuestas_horario_chat
    where id = p_propuesta_id
      and (estudiante_id = auth.uid() or tutor_id = auth.uid())
    for update;
    if not found then raise exception 'No se encontró la propuesta.'; end if;
    if v_propuesta.propuesto_por = auth.uid() then
        raise exception 'La propuesta debe responderla la otra persona.';
    end if;
    if v_propuesta.estado <> 'Pendiente' then raise exception 'Esta propuesta ya fue respondida.'; end if;

    if p_aceptar then
        update public.reservas
        set fecha_hora = v_propuesta.fecha_propuesta
        where id = v_propuesta.reserva_id
          and (estudiante_id = auth.uid() or tutor_id = auth.uid())
          and lower(coalesce(estado,'')) in ('pendiente','aceptada','aprobada','confirmada');
        if not found then raise exception 'La tutoría ya no está disponible para cambiar el horario.'; end if;
    end if;

    update public.propuestas_horario_chat
    set estado = case when p_aceptar then 'Aceptada' else 'Rechazada' end,
        respondido_por = auth.uid(), responded_at = now()
    where id = p_propuesta_id;

    v_destinatario := case when auth.uid() = v_propuesta.estudiante_id
        then v_propuesta.tutor_id else v_propuesta.estudiante_id end;

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (
        auth.uid(), v_destinatario,
        case when p_aceptar
            then 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|ACEPTADA'
            else 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|RECHAZADA'
        end
    );
end;
$$;

revoke all on function public.proponer_horario_desde_chat(uuid,timestamptz) from public;
revoke all on function public.responder_propuesta_horario_chat(uuid,boolean) from public;
grant execute on function public.proponer_horario_desde_chat(uuid,timestamptz) to authenticated;
grant execute on function public.responder_propuesta_horario_chat(uuid,boolean) to authenticated;
