-- Recordatorios de tutorías dentro de EntrePares: 24 h y 1 h antes.
-- Ejecutar en Supabase SQL Editor. Requiere pg_cron habilitado en el proyecto.
begin;

create table if not exists public.recordatorios_notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  reserva_id text not null,
  tipo text not null check (tipo in ('24_horas','1_hora')),
  titulo text not null,
  mensaje text not null,
  fecha_tutoria timestamptz not null,
  creado_at timestamptz not null default now(),
  leida boolean not null default false,
  constraint recordatorio_tutoria_unico unique (usuario_id, reserva_id, tipo)
);

create index if not exists recordatorios_notificaciones_usuario_fecha_idx
  on public.recordatorios_notificaciones (usuario_id, creado_at desc);

alter table public.recordatorios_notificaciones enable row level security;

drop policy if exists "Cada usuario ve sus recordatorios" on public.recordatorios_notificaciones;
create policy "Cada usuario ve sus recordatorios"
  on public.recordatorios_notificaciones for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "Cada usuario marca sus recordatorios" on public.recordatorios_notificaciones;
create policy "Cada usuario marca sus recordatorios"
  on public.recordatorios_notificaciones for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

revoke insert, delete, update on public.recordatorios_notificaciones from anon, authenticated;
grant select on public.recordatorios_notificaciones to authenticated;
grant update (leida) on public.recordatorios_notificaciones to authenticated;

create or replace function public.generar_recordatorios_tutorias()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insertados integer := 0;
  v_ahora timestamptz := now();
begin
  -- Una tutoría solo genera avisos si está confirmada y aún no comenzó.
  -- Los estados se comparan sin distinguir mayúsculas por compatibilidad con datos existentes.
  insert into public.recordatorios_notificaciones
    (usuario_id, reserva_id, tipo, titulo, mensaje, fecha_tutoria)
  select participantes.usuario_id,
         r.id::text,
         avisos.tipo,
         case when avisos.tipo = '24_horas' then 'Tutoría mañana' else 'Tu tutoría comienza pronto' end,
         'Tenés una tutoría de ' || coalesce(nullif(trim(r.materia), ''), 'consulta académica') ||
           case when avisos.tipo = '24_horas' then ' dentro de 24 horas.' else ' dentro de 1 hora.' end,
         r.fecha_hora
  from public.reservas r
  cross join lateral (
    values ('24_horas'::text, interval '24 hours'),
           ('1_hora'::text, interval '1 hour')
  ) as avisos(tipo, anticipacion)
  cross join lateral (
    values (r.estudiante_id), (r.tutor_id)
  ) as participantes(usuario_id)
  where participantes.usuario_id is not null
    and lower(coalesce(r.estado, '')) in ('aceptada','aprobada','confirmada')
    and r.fecha_hora is not null
    and r.fecha_hora > v_ahora
    and v_ahora >= r.fecha_hora - avisos.anticipacion
    and v_ahora < r.fecha_hora - avisos.anticipacion + interval '10 minutes'
  on conflict (usuario_id, reserva_id, tipo) do nothing;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

revoke all on function public.generar_recordatorios_tutorias() from public, anon, authenticated;
grant execute on function public.generar_recordatorios_tutorias() to postgres, service_role;

-- Programar ejecución cada 5 minutos. Si el trabajo ya existe, se reemplaza.
create extension if not exists pg_cron;
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'entrepares-recordatorios-tutorias';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'entrepares-recordatorios-tutorias',
    '*/5 * * * *',
    'select public.generar_recordatorios_tutorias();'
  );
end $$;

commit;
