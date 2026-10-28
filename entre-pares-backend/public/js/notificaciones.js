// Notificaciones de Entre Pares: el menú funciona incluso si Supabase tarda o falla.
(() => {
    let client = null;
    let usuarioId = null;
    let noLeidas = 0;
    let canal = null;
    const idsMostrados = new Set();

    function actualizarBadge() {
        const badge = document.getElementById('badgeNoti');
        if (!badge) return;
        badge.textContent = String(noLeidas);
        badge.style.display = noLeidas > 0 ? 'inline-block' : 'none';
    }

    function crearTexto(tag, contenido, estilos) {
        const elemento = document.createElement(tag);
        elemento.textContent = String(contenido ?? '');
        if (estilos) elemento.style.cssText = estilos;
        return elemento;
    }

    function renderizarNotificacion(n) {
        if (n.id && idsMostrados.has(n.id)) return;
        if (n.id) idsMostrados.add(n.id);
        const fecha = n.creado_at
            ? new Date(n.creado_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
            : 'Hace un momento';
        const lista = document.getElementById('listaNotificaciones');
        if (lista) {
            if (lista.textContent.includes('No hay notificaciones') || lista.textContent.includes('No se pudieron cargar')) lista.replaceChildren();
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px 6px;border-bottom:1px solid #e2e8f0;font-size:.82rem;line-height:1.45;';
            item.append(
                crearTexto('strong', '🔔 ' + n.titulo),
                crearTexto('div', n.mensaje, 'margin-top:4px;overflow-wrap:anywhere;'),
                crearTexto('small', fecha, 'display:block;margin-top:4px;color:#64748b;')
            );
            lista.prepend(item);
        }
        const detalle = document.getElementById('listaDetalladaNotificaciones');
        if (detalle) {
            if (detalle.textContent.includes('No tienes notificaciones recientes')) detalle.replaceChildren();
            const item = document.createElement('div');
            item.style.cssText = 'padding:1rem;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;margin-bottom:.8rem;';
            item.append(
                crearTexto('strong', '🔔 ' + n.titulo),
                crearTexto('p', n.mensaje, 'color:#475569;font-size:.9rem;margin:.4rem 0;overflow-wrap:anywhere;'),
                crearTexto('small', fecha, 'color:#64748b;')
            );
            detalle.prepend(item);
        }
    }

    async function cargarHistorial() {
        if (!client || !usuarioId) return;
        try {
            const { data, error } = await client.from('notificaciones')
                .select('id,titulo,mensaje,creado_at,leida')
                .eq('usuario_id', usuarioId)
                .order('creado_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            noLeidas = (data || []).filter(n => !n.leida).length;
            // Se muestran primero las más recientes.
            (data || []).slice().reverse().forEach(renderizarNotificacion);
            actualizarBadge();
        } catch (error) {
            console.error('No se pudo cargar el historial de notificaciones:', error);
            const lista = document.getElementById('listaNotificaciones');
            if (lista && !idsMostrados.size) lista.textContent = 'No se pudieron cargar los avisos. Volvé a intentarlo más tarde.';
        }
    }

    async function marcarComoLeidas() {
        if (!client || !usuarioId || noLeidas === 0) return;
        try {
            const { error } = await client.from('notificaciones')
                .update({ leida: true })
                .eq('usuario_id', usuarioId)
                .eq('leida', false);
            if (error) throw error;
            noLeidas = 0;
            actualizarBadge();
        } catch (error) {
            console.error('No se pudieron marcar las notificaciones como leídas:', error);
        }
    }

    async function inicializarDatos() {
        // Reutiliza el cliente del panel; evita crear instancias de autenticación adicionales.
        client = typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient || null;
        if (!client) {
            console.error('No se encontró el cliente Supabase del panel.');
            return;
        }
        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            usuarioId = data?.session?.user?.id || null;
            if (!usuarioId) return;
            await cargarHistorial();
            canal = client.channel('notificaciones-panel-' + usuarioId)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'notificaciones',
                    filter: 'usuario_id=eq.' + usuarioId
                }, ({ new: n }) => {
                    renderizarNotificacion(n);
                    if (!n.leida) {
                        noLeidas += 1;
                        actualizarBadge();
                    }
                })
                .subscribe(status => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.warn('Realtime de notificaciones:', status);
                    }
                });
        } catch (error) {
            console.error('No se pudo iniciar el módulo de notificaciones:', error);
        }
    }

    function iniciar() {
        const boton = document.getElementById('btnCampanita');
        const menu = document.getElementById('dropdownNotificaciones');
        if (!boton || !menu) return;

        // Registrar el clic ANTES de hacer llamadas async: la campanita nunca se bloquea por la red.
        boton.setAttribute('role', 'button');
        boton.setAttribute('tabindex', '0');
        boton.setAttribute('aria-label', 'Abrir notificaciones');
        boton.setAttribute('aria-expanded', 'false');
        // Mover el desplegable fuera del botón y del encabezado: evita
        // problemas de recorte y capas que impedían ver las notificaciones.
        document.body.appendChild(menu);
        menu.style.position = 'fixed';
        menu.style.zIndex = '2147483000';
        menu.style.maxWidth = 'calc(100vw - 24px)';
        menu.style.boxSizing = 'border-box';
        menu.style.boxShadow = '0 12px 35px rgba(15,23,42,.18)';
        const cerrar = () => {
            menu.style.display = 'none';
            boton.setAttribute('aria-expanded', 'false');
        };
        const posicionar = () => {
            const rect = boton.getBoundingClientRect();
            const ancho = Math.min(320, window.innerWidth - 24);
            menu.style.width = ancho + 'px';
            menu.style.left = Math.max(12, Math.min(window.innerWidth - ancho - 12, rect.right - ancho)) + 'px';
            menu.style.top = Math.min(window.innerHeight - 24, rect.bottom + 8) + 'px';
            menu.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 24) + 'px';
            menu.style.overflowY = 'auto';
        };
        const alternar = () => {
            const abrir = menu.style.display !== 'block';
            if (!abrir) { cerrar(); return; }
            posicionar();
            menu.style.display = 'block';
            boton.setAttribute('aria-expanded', 'true');
            // Al abrir, verificar si llegaron avisos cuando Realtime estaba desconectado.
            void (async () => {
                await cargarHistorial();
                await marcarComoLeidas();
            })();
        };
        boton.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            alternar();
        });
        boton.addEventListener('keydown', e => {
            if (e.target !== boton) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                alternar();
            }
            if (e.key === 'Escape') {
                cerrar();
            }
        });
        // El menú está dentro del contenedor clickeable: evita cerrarlo al tocar sus avisos.
        menu.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('click', e => {
            if (!boton.contains(e.target) && !menu.contains(e.target)) cerrar();
        });
        window.addEventListener('resize', () => {
            if (menu.style.display === 'block') posicionar();
        });
        window.addEventListener('scroll', () => {
            if (menu.style.display === 'block') posicionar();
        }, true);
        actualizarBadge();
        void inicializarDatos();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
})();