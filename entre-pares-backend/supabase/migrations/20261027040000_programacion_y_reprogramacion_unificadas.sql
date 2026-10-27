-- Unifica la coordinación inicial y las reprogramaciones en un único flujo.
-- La aceptación de la consulta habilita chat; la fecha se confirma por separado.
alter table public.reservas
    add column if not exists estado_programacion text not null default 'Sin coordinar';

alter table public.reservas
    drop constraint if exists reservas_estado_programacion_check;
alter table public.reservas
    add constraint reservas_estado_programacion_check
    check (estado_programacion in ('Sin coordinar','Confirmada'));

update public.reservas
set estado_programacion = case
    when fecha_hora is not null then 'Confirmada'
    else 'Sin coordinar'
end;

alter table public.propuestas_horario_chat
    add column if not exists tipo text not null default 'Reprogramacion',
    add column if not exists fecha_anterior timestamptz;

alter table public.propuestas_horario_chat
    drop constraint if exists propuestas_horario_chat_tipo_check;
alter table public.propuestas_horario_chat
    add constraint propuestas_horario_chat_tipo_check
    check (tipo in ('ProgramacionInicial','Reprogramacion'));

update public.propuestas_horario_chat p
set fecha_anterior = r.fecha_hora,
    tipo = case when r.fecha_hora is null then 'ProgramacionInicial' else 'Reprogramacion' end
from public.reservas r
where r.id = p.reserva_id;

create or replace function public.proponer_horario_desde_chat(
    p_reserva_id uuid,
    p_fecha_propuesta timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_reserva public.reservas%rowtype;
    v_id uuid;
    v_destinatario uuid;
    v_tipo text;
    v_nombre text;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;
    if p_fecha_propuesta is null or p_fecha_propuesta <= now() then
        raise exception 'La fecha y hora propuestas deben ser futuras.';
    end if;

    select * into v_reserva
    from public.reservas
    where id = p_reserva_id
      and (estudiante_id = auth.uid() or tutor_id = auth.uid())
    for update;

    if not found then raise exception 'No tenés acceso a esta tutoría.'; end if;
    if lower(coalesce(v_reserva.estado,'')) not in ('aceptada','aprobada','confirmada') then
        raise exception 'Solo se pueden coordinar horarios de tutorías aceptadas.';
    end if;
    if lower(coalesce(v_reserva.estado,'')) in ('finalizada','finalizado','completada','completado') then
        raise exception 'No se puede modificar una tutoría finalizada.';
    end if;

    v_tipo := case when v_reserva.fecha_hora is null then 'ProgramacionInicial' else 'Reprogramacion' end;
    v_destinatario := case when auth.uid() = v_reserva.estudiante_id
        then v_reserva.tutor_id else v_reserva.estudiante_id end;

    insert into public.propuestas_horario_chat
        (reserva_id, estudiante_id, tutor_id, propuesto_por, fecha_propuesta, fecha_anterior, tipo)
    values
        (v_reserva.id, v_reserva.estudiante_id, v_reserva.tutor_id,
         auth.uid(), p_fecha_propuesta, v_reserva.fecha_hora, v_tipo)
    returning id into v_id;

    select nombre_completo into v_nombre from public.perfiles where id = auth.uid();

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (
        auth.uid(), v_destinatario,
        'HORARIO_PROPUESTA|' || v_id::text || '|' ||
        to_char(p_fecha_propuesta at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS') || 'Z'
    );

    return v_id;
exception when unique_violation then
    raise exception 'Ya existe una propuesta de horario pendiente para esta tutoría.';
end;
$$;

create or replace function public.responder_propuesta_horario_chat(
    p_propuesta_id uuid,
    p_aceptar boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_propuesta public.propuestas_horario_chat%rowtype;
    v_reserva public.reservas%rowtype;
    v_destinatario uuid;
    v_estado_reserva text;
    v_texto text;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;

    select * into v_propuesta
    from public.propuestas_horario_chat
    where id = p_propuesta_id
      and (estudiante_id = auth.uid() or tutor_id = auth.uid())
    for update;

    if not found then raise exception 'No se encontró la propuesta.'; end if;
    if v_propuesta.propuesto_por = auth.uid() then
        raise exception 'La propuesta debe responderla la otra persona.';
    end if;
    if v_propuesta.estado <> 'Pendiente' then
        raise exception 'Esta propuesta ya fue respondida.';
    end if;

    select * into v_reserva
    from public.reservas
    where id = v_propuesta.reserva_id
    for update;

    if not found then raise exception 'La tutoría ya no existe.'; end if;
    v_estado_reserva := lower(coalesce(v_reserva.estado,''));
    if v_estado_reserva in ('finalizada','finalizado','completada','completado') then
        raise exception 'No se puede modificar una tutoría finalizada.';
    end if;
    if v_estado_reserva not in ('aceptada','aprobada','confirmada') then
        raise exception 'La tutoría debe estar aceptada para confirmar un horario.';
    end if;

    if p_aceptar then
        update public.reservas
        set fecha_hora = v_propuesta.fecha_propuesta,
            estado_programacion = 'Confirmada'
        where id = v_propuesta.reserva_id;
    end if;

    update public.propuestas_horario_chat
    set estado = case when p_aceptar then 'Aceptada' else 'Rechazada' end,
        respondido_por = auth.uid(),
        responded_at = now()
    where id = p_propuesta_id;

    v_destinatario := case when auth.uid() = v_propuesta.estudiante_id
        then v_propuesta.tutor_id else v_propuesta.estudiante_id end;

    v_texto := case
        when p_aceptar and v_propuesta.tipo = 'ProgramacionInicial'
            then 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|ACEPTADA|PROGRAMACION'
        when p_aceptar
            then 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|ACEPTADA|REPROGRAMACION'
        when v_propuesta.tipo = 'ProgramacionInicial'
            then 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|RECHAZADA|PROGRAMACION'
        else 'HORARIO_RESPUESTA|' || p_propuesta_id::text || '|RECHAZADA|REPROGRAMACION'
    end;

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (auth.uid(), v_destinatario, v_texto);
end;
$$;

revoke all on function public.proponer_horario_desde_chat(uuid,timestamptz) from public;
revoke all on function public.responder_propuesta_horario_chat(uuid,boolean) from public;
grant execute on function public.proponer_horario_desde_chat(uuid,timestamptz) to authenticated;
grant execute on function public.responder_propuesta_horario_chat(uuid,boolean) to authenticated;

-- La solicitud antigua se conserva por compatibilidad, pero el flujo nuevo usa
-- propuestas_horario_chat para programación inicial y todos los cambios posteriores.
