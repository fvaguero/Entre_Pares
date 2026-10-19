-- Endurece el saldo de puntos y valida los canjes del lado de la base de datos.
begin;

-- Unifica estados heredados (algunas bases anteriores usaban inicial mayúscula).
alter table public.canjes_puntos drop constraint if exists canjes_puntos_estado_check;
update public.canjes_puntos
   set estado = case lower(estado)
     when 'pendiente' then 'pendiente'
     when 'confirmado' then 'confirmado'
     when 'cancelado' then 'cancelado'
     else lower(estado)
   end;
alter table public.canjes_puntos
  add constraint canjes_puntos_estado_check check (estado in ('pendiente','confirmado','cancelado'));

-- Un usuario no puede insertar canjes directamente manipulando beneficio o costo.
drop policy if exists "Usuario solicita sus propios canjes" on public.canjes_puntos;

-- Si había solicitudes duplicadas antes de esta migración, conservá la más antigua pendiente
-- y marcá las posteriores como canceladas antes de imponer la unicidad.
with duplicados as (
  select id, row_number() over (
    partition by usuario_id, lower(beneficio)
    order by creado_at asc, id asc
  ) as posicion
  from public.canjes_puntos
  where lower(estado) = 'pendiente'
)
update public.canjes_puntos c
   set estado = 'cancelado'
  from duplicados d
 where c.id = d.id and d.posicion > 1;

create unique index if not exists canjes_puntos_solicitud_pendiente_unica_idx
  on public.canjes_puntos (usuario_id, lower(beneficio))
  where lower(estado) = 'pendiente';

create or replace function public.proteger_saldo_puntos_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.puntos_gamificacion is distinct from old.puntos_gamificacion
     and coalesce(current_setting('app.points_rpc', true), 'off') <> 'on' then
    raise exception 'El saldo de puntos solo puede modificarse mediante operaciones validadas.';
  end if;
  if (new.rol is distinct from old.rol or new.estado_verificacion is distinct from old.estado_verificacion)
     and not public.es_administrador_actual() then
    raise exception 'Solo un administrador puede cambiar el rol o la verificación de un perfil.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_saldo_puntos_perfil_trigger on public.perfiles;
create trigger proteger_saldo_puntos_perfil_trigger
before update of puntos_gamificacion, rol, estado_verificacion on public.perfiles
for each row execute function public.proteger_saldo_puntos_perfil();

-- Reemplaza la función central para habilitar el cambio de saldo solo durante su transacción.
create or replace function public.registrar_movimiento_puntos(
  p_usuario_id uuid,
  p_tipo text,
  p_referencia_id text,
  p_puntos integer,
  p_descripcion text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insertado bigint;
  v_saldo integer;
begin
  if p_usuario_id is null or p_referencia_id is null or length(trim(p_referencia_id)) < 1
     or p_puntos = 0 or abs(p_puntos) > 10000
     or p_tipo not in ('tutoria_finalizada','calificacion','contribucion_aprobada','canje','ajuste_admin') then
    raise exception 'Movimiento de puntos inválido.';
  end if;

  insert into public.movimientos_puntos(usuario_id,tipo,referencia_id,puntos,descripcion)
  values(p_usuario_id,p_tipo,p_referencia_id,p_puntos,left(coalesce(p_descripcion,'Movimiento de puntos'),500))
  on conflict(usuario_id,tipo,referencia_id) do nothing
  returning id into v_insertado;

  if v_insertado is null then return false; end if;

  select coalesce(puntos_gamificacion,0) into v_saldo
  from public.perfiles where id=p_usuario_id for update;
  if not found then raise exception 'No existe el perfil del usuario.'; end if;
  if v_saldo + p_puntos < 0 then raise exception 'Saldo de puntos insuficiente.'; end if;

  perform set_config('app.points_rpc','on',true);
  update public.perfiles set puntos_gamificacion=v_saldo+p_puntos where id=p_usuario_id;
  perform set_config('app.points_rpc','off',true);
  return true;
exception when others then
  perform set_config('app.points_rpc','off',true);
  raise;
end;
$$;

-- Solo una tutoría ya realizada puede acreditar puntos. El tutor participante la marca finalizada;
-- un usuario no puede adelantar la fecha para cobrar puntos antes del horario pactado.
create or replace function public.trg_puntos_tutoria_finalizada()
returns trigger
language plpgsql security definer set search_path = ''
as $
begin
  if lower(coalesce(new.estado,'')) = 'finalizada'
     and lower(coalesce(old.estado,'')) <> 'finalizada' then
    if new.fecha_hora is null or new.fecha_hora > now() then
      raise exception 'No se puede finalizar una tutoría antes de la fecha y hora acordadas.';
    end if;
    if (select auth.uid()) is not null
       and new.tutor_id is distinct from (select auth.uid())
       and not public.es_administrador_actual() then
      raise exception 'Solo el tutor asignado o un administrador puede finalizar esta tutoría.';
    end if;
    if new.tutor_id is not null then
      perform public.registrar_movimiento_puntos(new.tutor_id,'tutoria_finalizada',new.id::text,20,'Tutoría finalizada');
    end if;
    if new.estudiante_id is not null and new.estudiante_id is distinct from new.tutor_id then
      perform public.registrar_movimiento_puntos(new.estudiante_id,'tutoria_finalizada',new.id::text,20,'Tutoría finalizada');
    end if;
  end if;
  return new;
end;
$;

-- Una contribución solo da puntos cuando un administrador la aprueba.
create or replace function public.trg_puntos_contribucion_aprobada()
returns trigger
language plpgsql security definer set search_path = ''
as $
begin
  if new.estado = 'aprobada' and old.estado is distinct from 'aprobada'
     and ((select auth.uid()) is null or public.es_administrador_actual()) then
    perform public.registrar_movimiento_puntos(
      new.usuario_id,'contribucion_aprobada',new.id::text,10,'Contribución comunitaria aprobada'
    );
  end if;
  return new;
end;
$;

-- Una misma tutoría no puede generar puntos de reseña repetidos aunque se inserten filas duplicadas.
create or replace function public.trg_puntos_calificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_calificador uuid;
  v_reserva public.reservas%rowtype;
begin
  if lower(coalesce(new.calificado_por,'estudiante')) = 'estudiante' then
    v_calificador := new.estudiante_id;
  elsif lower(coalesce(new.calificado_por,'')) = 'tutor' then
    v_calificador := new.tutor_id;
  else
    return new;
  end if;

  if new.reserva_id is null or v_calificador is null then return new; end if;
  select * into v_reserva from public.reservas r where r.id::text = new.reserva_id::text;
  if not found or lower(coalesce(v_reserva.estado,'')) <> 'finalizada'
     or new.estudiante_id is distinct from v_reserva.estudiante_id
     or new.tutor_id is distinct from v_reserva.tutor_id then
    return new;
  end if;

  -- Si la operación viene de un usuario, solo acredita al autor real de esa reseña.
  if (select auth.uid()) is not null and v_calificador is distinct from (select auth.uid()) then
    return new;
  end if;

  -- Reconoce tanto referencias nuevas (reserva_id) como las referencias antiguas (resenas.id).
  if exists (
    select 1 from public.movimientos_puntos m
    where m.usuario_id = v_calificador and m.tipo = 'calificacion'
      and (
        m.referencia_id = new.reserva_id::text
        or m.referencia_id in (
          select r.id::text from public.resenas r
          where r.reserva_id = new.reserva_id and r.id is distinct from new.id
        )
      )
  ) then
    return new;
  end if;

  perform public.registrar_movimiento_puntos(
    v_calificador, 'calificacion', new.reserva_id::text, 5, 'Calificación de tutoría'
  );
  return new;
end;
$;

-- La función no debe ser invocable directamente por usuarios autenticados.
revoke all on function public.registrar_movimiento_puntos(uuid,text,text,integer,text) from public, anon, authenticated;

create or replace function public.solicitar_canje_recompensa(p_recompensa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_recompensa public.recompensas_puntos%rowtype;
  v_saldo integer;
  v_canje uuid;
begin
  if v_usuario is null then raise exception 'Debés iniciar sesión para solicitar un canje.'; end if;
  select * into v_recompensa from public.recompensas_puntos
   where id=p_recompensa_id and activa=true;
  if not found then raise exception 'La recompensa no existe o está desactivada.'; end if;

  select coalesce(puntos_gamificacion,0) into v_saldo
    from public.perfiles where id=v_usuario for update;
  if not found then raise exception 'No se encontró tu perfil.'; end if;
  if v_saldo < v_recompensa.costo_puntos then raise exception 'No tenés puntos suficientes.'; end if;

  insert into public.canjes_puntos(usuario_id,beneficio,puntos,estado)
  values(v_usuario,v_recompensa.nombre,v_recompensa.costo_puntos,'pendiente')
  returning id into v_canje;
  return v_canje;
exception when unique_violation then
  raise exception 'Ya tenés una solicitud pendiente para esta recompensa.';
end;
$$;

revoke all on function public.solicitar_canje_recompensa(uuid) from public, anon;
grant execute on function public.solicitar_canje_recompensa(uuid) to authenticated;

commit;
