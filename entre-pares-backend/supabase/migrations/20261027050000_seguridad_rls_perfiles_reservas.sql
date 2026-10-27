-- Seguridad base de Entre Pares: perfiles, reservas, mensajes, reseñas y notificaciones.
-- Aplicar en Supabase SQL Editor DESPUES de revisar la rama feature/gamificacion-puntos.
begin;

-- Función segura para consultar el rol sin provocar recursión en las políticas de perfiles.
create or replace function public.usuario_actual_es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.rol = 'Administrador'
  );
$$$;
revoke all on function public.usuario_actual_es_admin() from public;
grant execute on function public.usuario_actual_es_admin() to authenticated;

create or replace function public.perfil_tutor_aprobado(p_tutor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_tutor_id
      and p.rol in ('Tutor','Ambos')
      and p.estado_verificacion = 'Aprobado'
  );
$$;
revoke all on function public.perfil_tutor_aprobado(uuid) from public;
grant execute on function public.perfil_tutor_aprobado(uuid) to authenticated;

-- Vista pública con únicamente datos académicos/profesionales no sensibles.
create or replace view public.perfiles_publicos
with (security_barrier = true)
as
select
  id, nombre_completo, rol, carrera, anio_estudio, sede_universitaria,
  ubicacion, materias_impartidas, precio_hora, calificacion_promedio,
  total_resenas, puntos_gamificacion, estado_verificacion
from public.perfiles
where rol in ('Tutor','Ambos')
  and estado_verificacion = 'Aprobado';

grant select on public.perfiles_publicos to anon, authenticated;

-- Vista privada: datos completos solo para el titular y administradores.
create or replace view public.perfiles_privados
with (security_barrier = true)
as
select *
from public.perfiles
where id = auth.uid()
   or public.usuario_actual_es_admin();
grant select on public.perfiles_privados to authenticated;

-- En la tabla base solo se pueden leer columnas no bancarias/no documentales.
-- Los datos privados se consultan por perfiles_privados, que filtra por titular/admin.
revoke select on public.perfiles from anon, authenticated;
grant select (
  id, nombre_completo, email, rol, carrera, anio_estudio,
  sede_universitaria, ubicacion, materias_impartidas, precio_hora,
  calificacion_promedio, total_resenas, puntos_gamificacion,
  estado_verificacion
) on public.perfiles to authenticated;
revoke update on public.perfiles from anon, authenticated;
grant update (
  nombre_completo, fecha_nacimiento, carrera, sede_universitaria,
  materias_impartidas, precio_hora, ubicacion, cbu, cvu_alias,
  estado_verificacion
) on public.perfiles to authenticated;

-- Disponibilidad pública: expone solo bloques ocupados, nunca estudiante, precio ni pago.
create or replace view public.horarios_tutores_publicos
with (security_barrier = true)
as
select tutor_id, fecha_hora, estado
from public.reservas
where fecha_hora is not null
  and fecha_hora >= now()
  and lower(coalesce(estado,'')) in ('aceptada','aprobada','confirmada');
grant select on public.horarios_tutores_publicos to anon, authenticated;

-- PERFILES
alter table public.perfiles enable row level security;
drop policy if exists "perfiles_select_protegido" on public.perfiles;
drop policy if exists "perfiles_insert_propio" on public.perfiles;
drop policy if exists "Permitir inserción de perfiles a usuarios autenticados" on public.perfiles;
drop policy if exists "perfiles_update_propio_o_admin" on public.perfiles;

create policy "perfiles_select_protegido"
on public.perfiles for select to authenticated
using (
  id = auth.uid()
  or public.usuario_actual_es_admin()
  or exists (
    select 1
    from public.reservas r
    where (r.estudiante_id = auth.uid() and r.tutor_id = perfiles.id)
       or (r.tutor_id = auth.uid() and r.estudiante_id = perfiles.id)
  )
);

create policy "perfiles_insert_propio"
on public.perfiles for insert to authenticated
with check (
  id = auth.uid()
  and coalesce(rol,'') <> 'Administrador'
  and (rol = 'Estudiante' or (rol in ('Tutor','Ambos') and coalesce(estado_verificacion,'Pendiente') = 'Pendiente'))
);

create policy "perfiles_update_propio_o_admin"
on public.perfiles for update to authenticated
using (id = auth.uid() or public.usuario_actual_es_admin())
with check (id = auth.uid() or public.usuario_actual_es_admin());

create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.usuario_actual_es_admin() then
    if new.id is distinct from old.id
       or new.rol is distinct from old.rol
       or new.estado_verificacion is distinct from old.estado_verificacion
       or new.puntos_gamificacion is distinct from old.puntos_gamificacion
       or new.calificacion_promedio is distinct from old.calificacion_promedio
       or new.total_resenas is distinct from old.total_resenas
       or new.email is distinct from old.email
       or new.dni is distinct from old.dni
       or new.created_at is distinct from old.created_at then
      raise exception 'No tenés permisos para modificar campos protegidos del perfil.';
    end if;
  end if;
  return new;
end;
$$$;

drop trigger if exists trg_proteger_campos_perfil on public.perfiles;
create trigger trg_proteger_campos_perfil
before update on public.perfiles
for each row execute function public.proteger_campos_perfil();

create or replace function public.proteger_insert_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if auth.uid() is not null and not public.usuario_actual_es_admin() then
    if new.id is distinct from auth.uid() then
      raise exception 'Solo podés crear tu propio perfil.';
    end if;
    if new.rol not in ('Estudiante','Tutor','Ambos') then
      raise exception 'El rol solicitado no es válido.';
    end if;
    new.puntos_gamificacion := 0;
    new.calificacion_promedio := 5.0;
    new.total_resenas := 0;
    if new.rol = 'Estudiante' then
      new.estado_verificacion := 'Aprobado';
    else
      new.estado_verificacion := 'Pendiente';
    end if;
  end if;
  return new;
end;
$;
drop trigger if exists trg_proteger_insert_perfil on public.perfiles;
create trigger trg_proteger_insert_perfil
before insert on public.perfiles
for each row execute function public.proteger_insert_perfil();

-- RESERVAS
alter table public.reservas enable row level security;
drop policy if exists "reservas_select_participantes_admin" on public.reservas;
drop policy if exists "reservas_insert_estudiante_validado" on public.reservas;
drop policy if exists "reservas_update_participantes_admin" on public.reservas;
drop policy if exists "Estudiantes pueden crear reservas" on public.reservas;
drop policy if exists "Tutores pueden actualizar estado de sus reservas" on public.reservas;
drop policy if exists "Usuarios pueden ver sus propias reservas" on public.reservas;

create policy "reservas_select_participantes_admin"
on public.reservas for select to authenticated
using (
  estudiante_id = auth.uid()
  or tutor_id = auth.uid()
  or public.usuario_actual_es_admin()
);

create policy "reservas_insert_estudiante_validado"
on public.reservas for insert to authenticated
with check (
  estudiante_id = auth.uid()
  and exists (
    select 1 from public.perfiles estudiante
    where estudiante.id = auth.uid()
      and estudiante.rol in ('Estudiante','Ambos')
  )
  and public.perfil_tutor_aprobado(reservas.tutor_id)
);

create or replace function public.proteger_insert_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_precio numeric;
begin
  if auth.uid() is not null and not public.usuario_actual_es_admin() then
    if new.estudiante_id is distinct from auth.uid() then
      raise exception 'Solo podés crear reservas a tu nombre.';
    end if;
    select p.precio_hora into v_precio
    from public.perfiles p
    where p.id = new.tutor_id
      and p.rol in ('Tutor','Ambos')
      and p.estado_verificacion = 'Aprobado';
    if not found then raise exception 'El tutor no está disponible o no fue aprobado.'; end if;

    new := jsonb_populate_record(new, jsonb_build_object(
      'estado', 'Pendiente',
      'estado_pago', 'Pendiente',
      'estado_liquidacion', 'Pendiente',
      'fecha_hora', null,
      'estado_programacion', 'Sin coordinar',
      'precio', coalesce(v_precio, 3000),
      'fecha_pago', null,
      'fecha_liquidacion', null,
      'mercadopago_payment_id', null,
      'mercadopago_preference_id', null,
      'mercadopago_status', null,
      'mercadopago_payment_type', null,
      'mercadopago_external_reference', null,
      'mercadopago_paid_at', null
    ));
  end if;
  return new;
end;
$;
drop trigger if exists trg_proteger_insert_reserva on public.reservas;
create trigger trg_proteger_insert_reserva
before insert on public.reservas
for each row execute function public.proteger_insert_reserva();

create policy "reservas_update_participantes_admin"
on public.reservas for update to authenticated
using (
  estudiante_id = auth.uid()
  or tutor_id = auth.uid()
  or public.usuario_actual_es_admin()
)
with check (
  estudiante_id = auth.uid()
  or tutor_id = auth.uid()
  or public.usuario_actual_es_admin()
);

-- Impide cambiar participantes, precio, pago, liquidación o datos de Mercado Pago
-- desde el navegador. La fecha se modifica exclusivamente desde la RPC de coordinación.
create or replace function public.proteger_campos_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.usuario_actual_es_admin();
  v_rpc_horario boolean := coalesce(current_setting('app.reserva_rpc', true), '') = 'on';
begin
  if auth.uid() is null or v_admin then
    return new;
  end if;

  if (to_jsonb(new) - array['estado','fecha_hora','estado_programacion'])
       is distinct from
     (to_jsonb(old) - array['estado','fecha_hora','estado_programacion']) then
    raise exception 'No tenés permisos para modificar los datos protegidos de la reserva.';
  end if;

  if (new.fecha_hora is distinct from old.fecha_hora
      or new.estado_programacion is distinct from old.estado_programacion)
     and not v_rpc_horario then
    raise exception 'El horario solo puede modificarse mediante una propuesta confirmada.';
  end if;

  if new.estado is distinct from old.estado then
    if old.tutor_id = auth.uid() then
      if lower(coalesce(old.estado,'')) = 'pendiente' then
        if lower(coalesce(new.estado,'')) not in ('aceptada','aprobada','rechazada') then
          raise exception 'Desde una solicitud pendiente, el tutor solo puede aceptar o rechazar.';
        end if;
      elsif lower(coalesce(old.estado,'')) in ('aceptada','aprobada','confirmada') then
        if lower(coalesce(new.estado,'')) not in ('finalizada','cancelada','cancelado') then
          raise exception 'Una tutoría activa solo puede finalizarse o cancelarse.';
        end if;
      else
        raise exception 'No se puede cambiar el estado actual de esta tutoría.';
      end if;
    elsif old.estudiante_id = auth.uid() then
      if lower(coalesce(old.estado,'')) in ('finalizada','finalizado','completada','completado','rechazada','cancelada','cancelado')
         or lower(coalesce(new.estado,'')) not in ('cancelada','cancelado') then
        raise exception 'Solo podés cancelar una tutoría que todavía no haya finalizado.';
      end if;
    else
      raise exception 'No sos participante de esta reserva.';
    end if;
  end if;
  return new;
end;
$$$;

drop trigger if exists trg_proteger_campos_reserva on public.reservas;
create trigger trg_proteger_campos_reserva
before update on public.reservas
for each row execute function public.proteger_campos_reserva();

-- La respuesta a una propuesta es la única operación que puede cambiar fecha_hora.
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
        perform set_config('app.reserva_rpc', 'on', true);
        update public.reservas
        set fecha_hora = v_propuesta.fecha_propuesta,
            estado_programacion = 'Confirmada'
        where id = v_propuesta.reserva_id;
        perform set_config('app.reserva_rpc', 'off', true);
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
$$$;
revoke all on function public.responder_propuesta_horario_chat(uuid,boolean) from public;
grant execute on function public.responder_propuesta_horario_chat(uuid,boolean) to authenticated;

-- MENSAJES: solo se conversa entre participantes de una tutoría existente.
drop policy if exists "Usuarios pueden enviar mensajes" on public.mensajes;
drop policy if exists "Usuarios pueden leer sus mensajes" on public.mensajes;
create policy "mensajes_select_participantes"
on public.mensajes for select to authenticated
using (
  (auth.uid() = remitente_id or auth.uid() = destinatario_id)
  and exists (
    select 1 from public.reservas r
    where (
      (r.estudiante_id = mensajes.remitente_id and r.tutor_id = mensajes.destinatario_id)
      or (r.tutor_id = mensajes.remitente_id and r.estudiante_id = mensajes.destinatario_id)
    )
    and lower(coalesce(r.estado,'')) in ('aceptada','aprobada','confirmada','finalizada','finalizado','completada','completado')
  )
);

create policy "mensajes_insert_participantes_tutoria"
on public.mensajes for insert to authenticated
with check (
  auth.uid() = remitente_id
  and exists (
    select 1 from public.reservas r
    where (
      (r.estudiante_id = mensajes.remitente_id and r.tutor_id = mensajes.destinatario_id)
      or (r.tutor_id = mensajes.remitente_id and r.estudiante_id = mensajes.destinatario_id)
    )
    and lower(coalesce(r.estado,'')) in ('aceptada','aprobada','confirmada','finalizada','finalizado','completada','completado')
  )
);

-- RESEÑAS: lectura pública, pero solo participantes de tutorías finalizadas pueden escribir.
drop policy if exists "Permitir inserción de reseñas a tutores" on public.resenas;
drop policy if exists "Permitir inserción de reseñas a usuarios autenticados" on public.resenas;
create policy "resenas_insertar_participante_tutoria_finalizada"
on public.resenas for insert to authenticated
with check (
  exists (
    select 1 from public.reservas r
    where r.id = resenas.reserva_id
      and r.estudiante_id = resenas.estudiante_id
      and r.tutor_id = resenas.tutor_id
      and lower(coalesce(r.estado,'')) in ('finalizada','finalizado','completada','completado')
      and (
        (auth.uid() = resenas.estudiante_id and lower(coalesce(resenas.calificado_por,'')) = 'estudiante')
        or
        (auth.uid() = resenas.tutor_id and lower(coalesce(resenas.calificado_por,'')) = 'tutor')
      )
  )
);

-- NOTIFICACIONES: cada usuario solo puede crear/leer/actualizar las propias.
drop policy if exists "El sistema o usuarios pueden insertar notificaciones" on public.notificaciones;
drop policy if exists "Usuarios pueden actualizar sus propias notificaciones" on public.notificaciones;
drop policy if exists "Usuarios pueden marcar sus notificaciones como leídas" on public.notificaciones;
drop policy if exists "Usuarios pueden ver sus propias notificaciones" on public.notificaciones;
create policy "notificaciones_select_propia"
on public.notificaciones for select to authenticated
using (auth.uid() = usuario_id);
create policy "notificaciones_insert_propia"
on public.notificaciones for insert to authenticated
with check (auth.uid() = usuario_id);
create policy "notificaciones_update_propia"
on public.notificaciones for update to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create or replace function public.proteger_actualizacion_notificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.usuario_actual_es_admin() then
    if new.usuario_id is distinct from old.usuario_id
       or (to_jsonb(new) - 'leida') is distinct from (to_jsonb(old) - 'leida') then
      raise exception 'Solo podés marcar como leídas tus propias notificaciones.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_actualizacion_notificacion on public.notificaciones;
create trigger trg_proteger_actualizacion_notificacion
before update on public.notificaciones
for each row execute function public.proteger_actualizacion_notificacion();

-- Elimina políticas redundantes de puntos y deja una única regla por operación.
drop policy if exists "Cada usuario consulta sus movimientos" on public.movimientos_puntos;
drop policy if exists "Administradores ven todos los canjes" on public.canjes_puntos;
drop policy if exists "Usuario ve sus canjes" on public.canjes_puntos;
drop policy if exists "Ver mis canjes" on public.canjes_puntos;
drop policy if exists "Usuario solicita canje" on public.canjes_puntos;
drop policy if exists "Solicitar mis canjes" on public.canjes_puntos;
create policy "canjes_select_propio_o_admin"
on public.canjes_puntos for select to authenticated
using (usuario_id = auth.uid() or public.usuario_actual_es_admin());
create policy "canjes_insert_propio_pendiente"
on public.canjes_puntos for insert to authenticated
with check (
  usuario_id = auth.uid()
  and lower(coalesce(estado,'')) = 'pendiente'
  and confirmado_por is null
  and confirmado_at is null
);

drop policy if exists "Usuario ve sus contribuciones" on public.contribuciones_comunidad;
drop policy if exists "Ver mis contribuciones" on public.contribuciones_comunidad;
drop policy if exists "Crear mis contribuciones" on public.contribuciones_comunidad;
drop policy if exists "Usuario crea su contribucion pendiente" on public.contribuciones_comunidad;
create policy "contribuciones_select_propio_o_admin"
on public.contribuciones_comunidad for select to authenticated
using (usuario_id = auth.uid() or public.usuario_actual_es_admin());
create policy "contribuciones_insert_propia_pendiente"
on public.contribuciones_comunidad for insert to authenticated
with check (
  usuario_id = auth.uid()
  and lower(coalesce(estado,'')) = 'pendiente'
  and revisada_por is null
  and revisada_at is null
);

commit;
