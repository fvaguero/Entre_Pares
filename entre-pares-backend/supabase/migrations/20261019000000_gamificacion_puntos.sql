-- Entre Pares: sistema de puntos con movimientos idempotentes.
-- Aplicar en Supabase SQL Editor sobre la base de datos de desarrollo primero.
-- Requiere perfiles(id uuid, puntos_gamificacion integer), reservas(id, estudiante_id, tutor_id, estado)
-- y resenas(reserva_id, estudiante_id, calificado_por).
begin;

do $$
begin
  if to_regclass('public.perfiles') is null then
    raise exception 'No existe public.perfiles; revisar el esquema antes de aplicar gamificacion.';
  end if;
  if to_regclass('public.reservas') is null then
    raise exception 'No existe public.reservas; revisar el esquema antes de aplicar gamificacion.';
  end if;
  if to_regclass('public.resenas') is null then
    raise exception 'No existe public.resenas; revisar el esquema antes de aplicar gamificacion.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='perfiles' and column_name='puntos_gamificacion'
  ) then
    raise exception 'Falta perfiles.puntos_gamificacion. Crear/revisar la columna antes de aplicar esta migracion.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservas' and column_name in ('estudiante_id')
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservas' and column_name in ('tutor_id')
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservas' and column_name in ('estado')
  ) then
    raise exception 'reservas no tiene todas las columnas esperadas (estudiante_id, tutor_id, estado).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resenas' and column_name='reserva_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resenas' and column_name='estudiante_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resenas' and column_name='tutor_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resenas' and column_name='calificado_por'
  ) then
    raise exception 'resenas debe tener reserva_id, estudiante_id, tutor_id y calificado_por.';
  end if;
end $$;

create table if not exists public.movimientos_puntos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  tipo text not null check (tipo in ('tutoria_finalizada','calificacion','contribucion_aprobada','canje')),
  referencia_id text not null,
  puntos integer not null check (puntos <> 0),
  descripcion text not null,
  creado_at timestamptz not null default now(),
  constraint movimientos_puntos_accion_unica unique (usuario_id, tipo, referencia_id)
);

-- La tabla puede existir de antes sin esta restricción; el índice garantiza idempotencia también en ese caso.
create unique index if not exists movimientos_puntos_accion_unica_idx
  on public.movimientos_puntos (usuario_id, tipo, referencia_id);

create index if not exists movimientos_puntos_usuario_fecha_idx
  on public.movimientos_puntos (usuario_id, creado_at desc);

create table if not exists public.contribuciones_comunidad (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  descripcion text not null check (length(trim(descripcion)) between 10 and 3000),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  revisada_por uuid,
  revisada_at timestamptz,
  creado_at timestamptz not null default now()
);

create table if not exists public.canjes_puntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  beneficio text not null check (length(trim(beneficio)) between 3 and 200),
  puntos integer not null check (puntos > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','cancelado')),
  confirmado_por uuid,
  confirmado_at timestamptz,
  creado_at timestamptz not null default now()
);

-- Función central: registra primero el movimiento único y solo después actualiza el saldo.
-- La restricción UNIQUE impide acreditar dos veces una misma acción, incluso con solicitudes simultáneas.
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
  if p_usuario_id is null or p_referencia_id is null or p_puntos = 0 then
    raise exception 'Movimiento de puntos inválido.';
  end if;

  insert into public.movimientos_puntos(usuario_id, tipo, referencia_id, puntos, descripcion)
  values (p_usuario_id, p_tipo, p_referencia_id, p_puntos, p_descripcion)
  on conflict (usuario_id, tipo, referencia_id) do nothing
  returning id into v_insertado;

  if v_insertado is null then
    return false;
  end if;

  -- Bloquea el perfil para que dos canjes concurrentes no gasten el mismo saldo.
  select coalesce(puntos_gamificacion, 0) into v_saldo
  from public.perfiles where id = p_usuario_id for update;

  if not found then
    raise exception 'No existe perfil para usuario %', p_usuario_id;
  end if;
  if v_saldo + p_puntos < 0 then
    raise exception 'Saldo de puntos insuficiente.';
  end if;

  update public.perfiles
     set puntos_gamificacion = v_saldo + p_puntos
   where id = p_usuario_id;

  return true;
end;
$$;

-- Otorga 20 puntos a cada participante una sola vez cuando la reserva pasa a Finalizada.
create or replace function public.trg_puntos_tutoria_finalizada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.estado,'')) = 'finalizada'
     and lower(coalesce(old.estado,'')) <> 'finalizada' then
    if new.tutor_id is not null then
      perform public.registrar_movimiento_puntos(new.tutor_id, 'tutoria_finalizada', new.id::text, 20, 'Tutoría finalizada');
    end if;
    if new.estudiante_id is not null and new.estudiante_id is distinct from new.tutor_id then
      perform public.registrar_movimiento_puntos(new.estudiante_id, 'tutoria_finalizada', new.id::text, 20, 'Tutoría finalizada');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reservas_puntos_tutoria_finalizada on public.reservas;
create trigger reservas_puntos_tutoria_finalizada
after update of estado on public.reservas
for each row execute function public.trg_puntos_tutoria_finalizada();

-- La reseña del estudiante acredita 5 puntos al autor. Las reseñas hechas por el tutor no puntúan.
create or replace function public.trg_puntos_calificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calificador uuid;
begin
  -- calificado_por guarda el rol de quien hizo la reseña en el esquema actual.
  if lower(coalesce(new.calificado_por, 'estudiante')) = 'estudiante' then
    v_calificador := new.estudiante_id;
  elsif lower(coalesce(new.calificado_por, '')) = 'tutor' then
    v_calificador := new.tutor_id;
  else
    return new;
  end if;

  if v_calificador is not null then
    perform public.registrar_movimiento_puntos(
      v_calificador, 'calificacion', new.id::text, 5, 'Calificación de una clase'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists resenas_puntos_calificacion on public.resenas;
create trigger resenas_puntos_calificacion
after insert on public.resenas
for each row execute function public.trg_puntos_calificacion();

-- El puntaje por contribución se entrega únicamente al pasar de pendiente a aprobada.
create or replace function public.trg_puntos_contribucion_aprobada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'aprobada' and old.estado is distinct from 'aprobada' then
    perform public.registrar_movimiento_puntos(
      new.usuario_id, 'contribucion_aprobada', new.id::text, 10, 'Contribución comunitaria aprobada'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists contribuciones_puntos_aprobada on public.contribuciones_comunidad;
create trigger contribuciones_puntos_aprobada
after update of estado on public.contribuciones_comunidad
for each row execute function public.trg_puntos_contribucion_aprobada();

-- La confirmación del canje es atómica: solo un administrador puede confirmarlo,
-- y el saldo debe alcanzar. El movimiento negativo queda registrado con referencia al canje.
create or replace function public.confirmar_canje(p_canje_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canje public.canjes_puntos%rowtype;
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'Administrador'
  ) into v_admin;

  if not v_admin then
    raise exception 'Solo un administrador puede confirmar un canje.';
  end if;

  select * into v_canje
  from public.canjes_puntos
  where id = p_canje_id
  for update;

  if not found then raise exception 'Canje no encontrado.'; end if;
  if v_canje.estado = 'confirmado' then return; end if;
  if v_canje.estado <> 'pendiente' then raise exception 'El canje no está pendiente.'; end if;

  if coalesce((select p.puntos_gamificacion from public.perfiles p where p.id = v_canje.usuario_id),0) < v_canje.puntos then
    raise exception 'El usuario no tiene puntos suficientes para este canje.';
  end if;

  perform public.registrar_movimiento_puntos(
    v_canje.usuario_id, 'canje', v_canje.id::text, -v_canje.puntos, 'Canje confirmado: ' || v_canje.beneficio
  );

  update public.canjes_puntos
  set estado = 'confirmado', confirmado_por = auth.uid(), confirmado_at = now()
  where id = v_canje.id;
end;
$$;

-- Activar RLS para evitar acceso anónimo. Las políticas de escritura se definen
-- por rol y deben revisarse con las políticas ya existentes del proyecto antes de habilitar el front.
alter table public.movimientos_puntos enable row level security;
alter table public.contribuciones_comunidad enable row level security;
alter table public.canjes_puntos enable row level security;

drop policy if exists "Cada usuario consulta sus movimientos" on public.movimientos_puntos;
create policy "Cada usuario consulta sus movimientos"
on public.movimientos_puntos for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists "Usuario ve sus contribuciones" on public.contribuciones_comunidad;
create policy "Usuario ve sus contribuciones"
on public.contribuciones_comunidad for select to authenticated
using (usuario_id = (select auth.uid()) or exists (
  select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'Administrador'
));

drop policy if exists "Usuario crea su contribucion pendiente" on public.contribuciones_comunidad;
create policy "Usuario crea su contribucion pendiente"
on public.contribuciones_comunidad for insert to authenticated
with check (usuario_id = (select auth.uid()) and estado = 'pendiente' and revisada_por is null);

drop policy if exists "Administrador revisa contribuciones" on public.contribuciones_comunidad;
create policy "Administrador revisa contribuciones"
on public.contribuciones_comunidad for update to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'Administrador'))
with check (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'Administrador'));

drop policy if exists "Usuario ve sus canjes" on public.canjes_puntos;
create policy "Usuario ve sus canjes"
on public.canjes_puntos for select to authenticated
using (usuario_id = (select auth.uid()) or exists (
  select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'Administrador'
));

drop policy if exists "Usuario solicita canje" on public.canjes_puntos;
create policy "Usuario solicita canje"
on public.canjes_puntos for insert to authenticated
with check (usuario_id = (select auth.uid()) and estado = 'pendiente' and confirmado_por is null);

-- Las funciones internas de puntos no deben poder ser invocadas desde el cliente.
revoke all on function public.registrar_movimiento_puntos(uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.trg_puntos_tutoria_finalizada() from public, anon, authenticated;
revoke all on function public.trg_puntos_calificacion() from public, anon, authenticated;
revoke all on function public.trg_puntos_contribucion_aprobada() from public, anon, authenticated;
revoke all on function public.confirmar_canje(uuid) from public, anon;
grant execute on function public.confirmar_canje(uuid) to authenticated;

commit;
