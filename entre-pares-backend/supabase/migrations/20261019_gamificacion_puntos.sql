-- Entre Pares: gamificación adaptada al esquema existente de Supabase.
-- Revisar el aviso sobre duplicados antes de ejecutar. Este archivo NO se ejecuta automáticamente.
-- Usa movimientos_puntos(usuario_id, tipo, referencia_id text) y canjes_puntos existentes.

-- La idempotencia depende de una clave única. Si ya hay duplicados históricos,
-- detenerse y revisarlos antes de crear el índice (el índice no borra datos).
do $$
begin
    if exists (
        select 1
        from public.movimientos_puntos
        group by usuario_id, referencia_id, tipo
        having count(*) > 1
    ) then
        raise exception 'Hay movimientos_puntos duplicados por usuario_id, referencia_id y tipo. Revisalos antes de aplicar esta migración.';
    end if;
end;
$$;

create unique index if not exists movimientos_puntos_unico_por_evento
    on public.movimientos_puntos (usuario_id, referencia_id, tipo);

create index if not exists idx_movimientos_puntos_usuario_fecha
    on public.movimientos_puntos (usuario_id, creado_at desc);

alter table public.movimientos_puntos enable row level security;

drop policy if exists "Cada usuario puede ver sus movimientos de puntos"
    on public.movimientos_puntos;

create policy "Cada usuario puede ver sus movimientos de puntos"
    on public.movimientos_puntos
    for select
    to authenticated
    using (usuario_id = auth.uid());

-- Helper interno: registra un movimiento una sola vez y actualiza el saldo.
create or replace function public.registrar_movimiento_puntos(
    p_usuario_id uuid,
    p_referencia_id text,
    p_tipo text,
    p_puntos integer,
    p_descripcion text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_usuario_id is null or p_referencia_id is null or p_puntos = 0 then
        return;
    end if;

    insert into public.movimientos_puntos
        (usuario_id, tipo, referencia_id, puntos, descripcion)
    values
        (p_usuario_id, p_tipo, p_referencia_id, p_puntos, p_descripcion)
    on conflict (usuario_id, referencia_id, tipo) do nothing;

    if found then
        update public.perfiles
           set puntos_gamificacion = greatest(0, coalesce(puntos_gamificacion, 0) + p_puntos)
         where id = p_usuario_id;
    end if;
end;
$$;

-- +20 puntos al estudiante y al tutor cuando una reserva pasa a Finalizada.
create or replace function public.puntos_por_tutoria_finalizada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.estado = 'Finalizada' and old.estado is distinct from new.estado then
        perform public.registrar_movimiento_puntos(
            new.estudiante_id, new.id::text, 'tutoria_finalizada', 20,
            'Puntos por tutoría finalizada'
        );
        perform public.registrar_movimiento_puntos(
            new.tutor_id, new.id::text, 'tutoria_finalizada', 20,
            'Puntos por tutoría finalizada'
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trg_puntos_tutoria_finalizada on public.reservas;
create trigger trg_puntos_tutoria_finalizada
after update of estado on public.reservas
for each row
execute function public.puntos_por_tutoria_finalizada();

-- +5 puntos al autor de cada reseña insertada.
create or replace function public.puntos_por_calificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_autor uuid;
begin
    if coalesce(new.calificado_por, 'estudiante') = 'tutor' then
        v_autor := new.tutor_id;
    else
        v_autor := new.estudiante_id;
    end if;

    perform public.registrar_movimiento_puntos(
        v_autor, new.reserva_id::text, 'calificacion', 5,
        'Puntos por calificar una tutoría'
    );
    return new;
end;
$$;

drop trigger if exists trg_puntos_por_calificacion on public.resenas;
create trigger trg_puntos_por_calificacion
after insert on public.resenas
for each row
execute function public.puntos_por_calificacion();

-- +10 puntos cuando una contribución pasa a Aprobada.
create or replace function public.puntos_por_contribucion_aprobada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.estado = 'Aprobada' and old.estado is distinct from new.estado then
        perform public.registrar_movimiento_puntos(
            new.usuario_id, new.id::text, 'contribucion_aprobada', 10,
            'Puntos por contribución aprobada: ' || new.titulo
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trg_puntos_contribucion_aprobada on public.contribuciones_comunidad;
create trigger trg_puntos_contribucion_aprobada
after update of estado on public.contribuciones_comunidad
for each row
execute function public.puntos_por_contribucion_aprobada();

-- Descuenta puntos solo cuando un canje pasa a Confirmado.
-- El perfil se bloquea para comprobar el saldo y evitar canjes simultáneos con saldo insuficiente.
create or replace function public.puntos_por_canje_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_saldo integer;
begin
    if new.estado = 'Confirmado' and old.estado is distinct from new.estado then
        select coalesce(puntos_gamificacion, 0)
          into v_saldo
          from public.perfiles
         where id = new.usuario_id
         for update;

        if not found then
            raise exception 'No se encontró el perfil asociado al canje.';
        end if;

        if v_saldo < new.puntos then
            raise exception 'El usuario no tiene puntos suficientes para confirmar este canje.';
        end if;

        perform public.registrar_movimiento_puntos(
            new.usuario_id, new.id::text, 'canje', -new.puntos,
            'Canje confirmado: ' || new.beneficio
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trg_puntos_canje_confirmado on public.canjes_puntos;
create trigger trg_puntos_canje_confirmado
after update of estado on public.canjes_puntos
for each row
execute function public.puntos_por_canje_confirmado();

-- El helper solo debe ejecutarse desde triggers/funciones confiables.
revoke all on function public.registrar_movimiento_puntos(uuid, text, text, integer, text)
    from public, anon, authenticated;

-- Niveles calculados a partir del saldo (no se guardan para evitar inconsistencias):
-- Principiante: 0-100; Colaborador: 101-300; Académico Pro: 301-600; Leyenda: 601+.
