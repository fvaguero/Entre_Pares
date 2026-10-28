-- Separa el catálogo de recompensas por rol y valida el rol también en el servidor.
begin;

alter table public.recompensas_puntos
  add column if not exists rol_destinatario text;

-- Las recompensas que ya existían se consideran destinadas a estudiantes.
update public.recompensas_puntos
set rol_destinatario = 'estudiante'
where rol_destinatario is null;

alter table public.recompensas_puntos
  alter column rol_destinatario set default 'estudiante',
  alter column rol_destinatario set not null;

alter table public.recompensas_puntos
  drop constraint if exists recompensas_puntos_rol_destinatario_check;

alter table public.recompensas_puntos
  add constraint recompensas_puntos_rol_destinatario_check
  check (rol_destinatario in ('estudiante', 'tutor'));

create or replace function public.solicitar_canje_recompensa(p_recompensa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_rol_usuario text;
  v_recompensa public.recompensas_puntos%rowtype;
  v_saldo integer;
  v_canje uuid;
begin
  if v_usuario is null then
    raise exception 'Debés iniciar sesión para solicitar un canje.';
  end if;

  select lower(trim(p.rol))
    into v_rol_usuario
  from public.perfiles p
  where p.id = v_usuario;

  if not found or coalesce(v_rol_usuario, '') not in ('estudiante', 'tutor') then
    raise exception 'Solo estudiantes y tutores pueden solicitar recompensas.';
  end if;

  select *
    into v_recompensa
  from public.recompensas_puntos
  where id = p_recompensa_id
    and activa = true;

  if not found then
    raise exception 'La recompensa no existe o está desactivada.';
  end if;

  if v_recompensa.rol_destinatario <> v_rol_usuario then
    raise exception 'Esta recompensa no está disponible para tu rol.';
  end if;

  select coalesce(puntos_gamificacion, 0)
    into v_saldo
  from public.perfiles
  where id = v_usuario
  for update;

  if not found then
    raise exception 'No se encontró tu perfil.';
  end if;

  if v_saldo < v_recompensa.costo_puntos then
    raise exception 'No tenés puntos suficientes.';
  end if;

  insert into public.canjes_puntos(usuario_id, beneficio, puntos, estado)
  values (v_usuario, v_recompensa.nombre, v_recompensa.costo_puntos, 'pendiente')
  returning id into v_canje;

  return v_canje;
exception
  when unique_violation then
    raise exception 'Ya tenés una solicitud pendiente para esta recompensa.';
end;
$$;

revoke all on function public.solicitar_canje_recompensa(uuid) from public, anon;
grant execute on function public.solicitar_canje_recompensa(uuid) to authenticated;

commit;
