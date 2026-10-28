-- Solicitudes de reprogramación: el estudiante propone y el tutor decide.
create table if not exists public.solicitudes_reprogramacion (
    id uuid primary key default gen_random_uuid(),
    reserva_id uuid not null references public.reservas(id) on delete cascade,
    estudiante_id uuid not null references public.perfiles(id) on delete cascade,
    tutor_id uuid not null references public.perfiles(id) on delete cascade,
    fecha_original timestamptz,
    fecha_propuesta timestamptz not null,
    estado text not null default 'Pendiente' check (estado in ('Pendiente','Aceptada','Rechazada')),
    creada_por uuid not null references public.perfiles(id),
    respondida_por uuid references public.perfiles(id),
    created_at timestamptz not null default now(),
    responded_at timestamptz
);

create index if not exists idx_solicitudes_reprogramacion_tutor_estado
on public.solicitudes_reprogramacion(tutor_id, estado, created_at desc);
create index if not exists idx_solicitudes_reprogramacion_estudiante
on public.solicitudes_reprogramacion(estudiante_id, created_at desc);

create unique index if not exists uq_reprogramacion_pendiente_reserva
on public.solicitudes_reprogramacion(reserva_id) where estado = 'Pendiente';

alter table public.solicitudes_reprogramacion enable row level security;

drop policy if exists "participantes leen solicitudes reprogramacion" on public.solicitudes_reprogramacion;
create policy "participantes leen solicitudes reprogramacion"
on public.solicitudes_reprogramacion for select to authenticated
using (auth.uid() = estudiante_id or auth.uid() = tutor_id);

create or replace function public.solicitar_reprogramacion_reserva(
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
    v_nombre text;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;
    if p_fecha_propuesta is null or p_fecha_propuesta <= now() then
        raise exception 'La nueva fecha debe ser futura.';
    end if;

    select * into v_reserva from public.reservas
    where id = p_reserva_id and estudiante_id = auth.uid()
    for update;

    if not found then raise exception 'No se encontró la tutoría o no tenés permiso.'; end if;
    if lower(coalesce(v_reserva.estado,'')) not in ('aceptada','aprobada','confirmada') then
        raise exception 'Solo se pueden reprogramar tutorías confirmadas.';
    end if;

    select nombre_completo into v_nombre from public.perfiles where id = auth.uid();

    insert into public.solicitudes_reprogramacion
        (reserva_id, estudiante_id, tutor_id, fecha_original, fecha_propuesta, creada_por)
    values
        (v_reserva.id, v_reserva.estudiante_id, v_reserva.tutor_id,
         v_reserva.fecha_hora, p_fecha_propuesta, auth.uid())
    returning id into v_id;

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (
        auth.uid(),
        v_reserva.tutor_id,
        '📅 SOLICITUD DE REPROGRAMACIÓN|' || v_id::text ||
        '|El estudiante ' || coalesce(v_nombre,'') ||
        ' propone cambiar "' || coalesce(v_reserva.materia,'Tutoría') ||
        '" al ' || to_char(p_fecha_propuesta at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI') ||
        '. Respondé desde la sección Solicitudes de reprogramación.'
    );
    return v_id;
exception
    when unique_violation then
        raise exception 'Ya existe una solicitud de reprogramación pendiente para esta tutoría.';
end;
$$;

create or replace function public.responder_reprogramacion_reserva(
    p_solicitud_id uuid,
    p_aceptar boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_solicitud public.solicitudes_reprogramacion%rowtype;
    v_materia text;
begin
    if auth.uid() is null then raise exception 'Debés iniciar sesión.'; end if;

    select * into v_solicitud
    from public.solicitudes_reprogramacion
    where id = p_solicitud_id and tutor_id = auth.uid()
    for update;

    if not found then raise exception 'No se encontró la solicitud o no sos el tutor asignado.'; end if;
    if v_solicitud.estado <> 'Pendiente' then raise exception 'Esta solicitud ya fue respondida.'; end if;

    if p_aceptar then
        update public.reservas
        set fecha_hora = v_solicitud.fecha_propuesta
        where id = v_solicitud.reserva_id and tutor_id = auth.uid()
          and lower(coalesce(estado,'')) in ('aceptada','aprobada','confirmada');
        if not found then raise exception 'La tutoría ya no está disponible para reprogramar.'; end if;
    end if;

    update public.solicitudes_reprogramacion
    set estado = case when p_aceptar then 'Aceptada' else 'Rechazada' end,
        respondida_por = auth.uid(), responded_at = now()
    where id = p_solicitud_id;

    select materia into v_materia from public.reservas where id = v_solicitud.reserva_id;

    insert into public.mensajes (remitente_id, destinatario_id, contenido)
    values (
        auth.uid(),
        v_solicitud.estudiante_id,
        case when p_aceptar
            then '✅ REPROGRAMACIÓN ACEPTADA|' || p_solicitud_id::text ||
                 '|El tutor aceptó la nueva fecha de ' ||
                 to_char(v_solicitud.fecha_propuesta at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI') ||
                 ' para ' || coalesce(v_materia,'la tutoría') || '. El calendario fue actualizado.'
            else '❌ REPROGRAMACIÓN RECHAZADA|' || p_solicitud_id::text ||
                 '|El tutor no pudo aceptar la fecha propuesta. La fecha original de la tutoría se mantiene.'
        end
    );
end;
$$;

revoke all on function public.solicitar_reprogramacion_reserva(uuid,timestamptz) from public;
revoke all on function public.responder_reprogramacion_reserva(uuid,boolean) from public;
grant execute on function public.solicitar_reprogramacion_reserva(uuid,timestamptz) to authenticated;
grant execute on function public.responder_reprogramacion_reserva(uuid,boolean) to authenticated;
