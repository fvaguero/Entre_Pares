-- Permite al usuario autenticado consultar sus canjes y solicitar canjes pendientes propios.
-- Aplicar en Supabase SQL Editor luego de verificar que la migración de gamificación creó canjes_puntos.
alter table public.canjes_puntos enable row level security;

drop policy if exists "Usuario ve sus canjes" on public.canjes_puntos;
create policy "Usuario ve sus canjes"
on public.canjes_puntos for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists "Usuario solicita sus propios canjes" on public.canjes_puntos;
create policy "Usuario solicita sus propios canjes"
on public.canjes_puntos for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and lower(estado) = 'pendiente'
  and puntos > 0
);
