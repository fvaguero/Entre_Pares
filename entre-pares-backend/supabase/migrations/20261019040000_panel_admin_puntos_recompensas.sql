-- Panel administrativo de puntos, recompensas y reclamos.
-- Aplicar en Supabase SQL Editor despues de las migraciones de gamificacion.
begin;

create table if not exists public.recompensas_puntos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 3 and 120),
  descripcion text not null default '',
  costo_puntos integer not null check (costo_puntos > 0),
  activa boolean not null default true,
  creado_por uuid,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create table if not exists public.reclamos_puntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  asunto text not null check (length(trim(asunto)) between 3 and 120),
  descripcion text not null check (length(trim(descripcion)) between 10 and 3000),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_revision','resuelto','rechazado')),
  respuesta_admin text,
  revisado_por uuid,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

-- Incluir ajustes administrativos sin eliminar los tipos existentes.
alter table public.movimientos_puntos drop constraint if exists movimientos_puntos_tipo_check;
alter table public.movimientos_puntos
  add constraint movimientos_puntos_tipo_check
  check (tipo in ('tutoria_finalizada','calificacion','contribucion_aprobada','canje','ajuste_admin'));

create or replace function public.es_administrador_actual()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'Administrador'
  );
$$;

alter table public.recompensas_puntos enable row level security;
alter table public.reclamos_puntos enable row level security;
alter table public.movimientos_puntos enable row level security;
alter table public.canjes_puntos enable row level security;

drop policy if exists "Todos ven recompensas activas" on public.recompensas_puntos;
create policy "Todos ven recompensas activas" on public.recompensas_puntos
for select to authenticated using (activa = true or public.es_administrador_actual());

drop policy if exists "Administradores gestionan recompensas" on public.recompensas_puntos;
create policy "Administradores gestionan recompensas" on public.recompensas_puntos
for all to authenticated using (public.es_administrador_actual())
with check (public.es_administrador_actual());

drop policy if exists "Usuario ve sus reclamos" on public.reclamos_puntos;
create policy "Usuario ve sus reclamos" on public.reclamos_puntos
for select to authenticated using (usuario_id = (select auth.uid()) or public.es_administrador_actual());

drop policy if exists "Usuario crea reclamos propios" on public.reclamos_puntos;
create policy "Usuario crea reclamos propios" on public.reclamos_puntos
for insert to authenticated with check (usuario_id = (select auth.uid()) and estado = 'pendiente');

drop policy if exists "Admin gestiona reclamos" on public.reclamos_puntos;
create policy "Admin gestiona reclamos" on public.reclamos_puntos
for update to authenticated using (public.es_administrador_actual())
with check (public.es_administrador_actual());

drop policy if exists "Administradores ven movimientos de puntos" on public.movimientos_puntos;
create policy "Administradores ven movimientos de puntos" on public.movimientos_puntos
for select to authenticated using (public.es_administrador_actual());

drop policy if exists "Administradores ven todos los canjes" on public.canjes_puntos;
create policy "Administradores ven todos los canjes" on public.canjes_puntos
for select to authenticated using (public.es_administrador_actual());

create or replace function public.admin_ajustar_puntos(
  p_usuario_id uuid, p_puntos integer, p_descripcion text, p_referencia_id text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.es_administrador_actual() then
    raise exception 'Solo un administrador puede ajustar puntos.';
  end if;
  if p_usuario_id is null or p_usuario_id = (select auth.uid()) then
    raise exception 'No está permitido asignarte puntos a tu propia cuenta.';
  end if;
  if p_puntos = 0 or abs(p_puntos) > 10000 then
    raise exception 'El ajuste debe ser distinto de cero y no superar 10000 puntos.';
  end if;
  if length(trim(coalesce(p_descripcion,''))) < 5 or length(trim(coalesce(p_referencia_id,''))) < 3 then
    raise exception 'Ingresá una descripción y una referencia válidas.';
  end if;
  return public.registrar_movimiento_puntos(
    p_usuario_id, 'ajuste_admin', p_referencia_id, p_puntos, p_descripcion
  );
end;
$$;

create or replace function public.admin_resolver_canje(p_canje_id uuid, p_accion text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_canje public.canjes_puntos%rowtype;
begin
  if (select auth.uid()) is null or not public.es_administrador_actual() then
    raise exception 'Solo un administrador puede resolver canjes.';
  end if;
  if lower(coalesce(p_accion,'')) not in ('confirmar','rechazar') then
    raise exception 'Acción inválida.';
  end if;
  select * into v_canje from public.canjes_puntos where id = p_canje_id for update;
  if not found then raise exception 'No se encontró el canje.'; end if;
  if lower(v_canje.estado) <> 'pendiente' then
    raise exception 'Este canje ya fue procesado y no puede duplicarse.';
  end if;
  if lower(p_accion) = 'confirmar' then
    perform public.registrar_movimiento_puntos(
      v_canje.usuario_id, 'canje', v_canje.id::text, -v_canje.puntos,
      'Canje confirmado: ' || v_canje.beneficio
    );
    update public.canjes_puntos set estado='confirmado', confirmado_por=(select auth.uid()), confirmado_at=now()
      where id=p_canje_id;
  else
    update public.canjes_puntos set estado='cancelado', confirmado_por=(select auth.uid()), confirmado_at=now()
      where id=p_canje_id;
  end if;
end;
$$;

create or replace function public.admin_resolver_reclamo(
  p_reclamo_id uuid, p_estado text, p_respuesta text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.es_administrador_actual() then
    raise exception 'Solo un administrador puede resolver reclamos.';
  end if;
  if p_estado not in ('en_revision','resuelto','rechazado') then
    raise exception 'Estado de reclamo inválido.';
  end if;
  update public.reclamos_puntos
     set estado=p_estado, respuesta_admin=nullif(trim(coalesce(p_respuesta,'')),''),
         revisado_por=(select auth.uid()), actualizado_at=now()
   where id=p_reclamo_id and estado in ('pendiente','en_revision');
  if not found then raise exception 'El reclamo no existe o ya fue resuelto.'; end if;
end;
$$;

revoke all on function public.admin_ajustar_puntos(uuid,integer,text,text) from public, anon;
revoke all on function public.admin_resolver_canje(uuid,text) from public, anon;
revoke all on function public.admin_resolver_reclamo(uuid,text,text) from public, anon;
grant execute on function public.admin_ajustar_puntos(uuid,integer,text,text) to authenticated;
grant execute on function public.admin_resolver_canje(uuid,text) to authenticated;
grant execute on function public.admin_resolver_reclamo(uuid,text,text) to authenticated;

commit;
