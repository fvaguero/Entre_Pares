-- Cancelación y reprogramación seguras desde los paneles de estudiante y tutor.
-- Las funciones validan identidad, participación y estado en el servidor.
begin;

create or replace function public.cancelar_reserva_participante(p_reserva_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_estado text;
begin
  if v_usuario is null then
    raise exception 'Debés iniciar sesión para cancelar una tutoría.';
  end if;

  select r.estado
    into v_estado
  from public.reservas r
  where r.id::text = p_reserva_id
    and (r.estudiante_id = v_usuario or r.tutor_id = v_usuario)
  for update;

  if not found then
    raise exception 'No se encontró una tutoría asociada a tu cuenta.';
  end if;

  if lower(coalesce(v_estado, '')) not in ('pendiente','aceptada','aprobada','confirmada') then
    raise exception 'Solo se pueden cancelar solicitudes pendientes o tutorías confirmadas.';
  end if;

  update public.reservas
  set estado = 'Cancelada'
  where id::text = p_reserva_id;
end;
$$;

create or replace function public.reprogramar_reserva_participante(
  p_reserva_id text,
  p_nueva_fecha timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_estado text;
begin
  if v_usuario is null then
    raise exception 'Debés iniciar sesión para reprogramar una tutoría.';
  end if;
  if p_nueva_fecha is null or p_nueva_fecha <= now() then
    raise exception 'La nueva fecha debe ser futura.';
  end if;

  select r.estado
    into v_estado
  from public.reservas r
  where r.id::text = p_reserva_id
    and (r.estudiante_id = v_usuario or r.tutor_id = v_usuario)
  for update;

  if not found then
    raise exception 'No se encontró una tutoría asociada a tu cuenta.';
  end if;

  if lower(coalesce(v_estado, '')) not in ('pendiente','aceptada','aprobada','confirmada') then
    raise exception 'Solo se pueden reprogramar solicitudes pendientes o tutorías confirmadas.';
  end if;

  update public.reservas
  set fecha_hora = p_nueva_fecha
  where id::text = p_reserva_id;
end;
$$;

revoke all on function public.cancelar_reserva_participante(text) from public, anon;
revoke all on function public.reprogramar_reserva_participante(text, timestamptz) from public, anon;
grant execute on function public.cancelar_reserva_participante(text) to authenticated;
grant execute on function public.reprogramar_reserva_participante(text, timestamptz) to authenticated;

commit;
