// ==========================================
// SISTEMA GLOBAL DE NOTIFICACIONES
// ==========================================

let notificacionesNoLeidas = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const btnCampanita = document.getElementById('btnCampanita');
    if (!btnCampanita) return; 

    const dropdownNotificaciones = document.getElementById('dropdownNotificaciones');

    const client = window.supabaseClient || (window.supabase ? window.supabase.createClient('https://uecwotydamsjstpovbzz.supabase.co', 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2') : null);
    
    if (!client) {
        console.error("Supabase JS SDK no está disponible.");
        return;
    }

    // Obtener el usuario actual logueado
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session) {
        return; // Si no hay sesión activa, no cargamos notificaciones
    }
    const userId = session.user.id;

    // 1. Cargar notificaciones existentes desde la base de datos al iniciar
    await cargarNotificacionesHistoricas(client, userId);

    // Manejar apertura/cierre del desplegable
    btnCampanita.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = dropdownNotificaciones.style.display === 'block';
        dropdownNotificaciones.style.display = isOpen ? 'none' : 'block';

        if (!isOpen && notificacionesNoLeidas > 0) {
            notificacionesNoLeidas = 0;
            actualizarBadgeNotificaciones();
            
            // Opcional: Marcar como leídas en la BD
            await client
                .from('notificaciones')
                .update({ leida: true })
                .eq('usuario_id', userId)
                .eq('leida', false);
        }
    });

    document.addEventListener('click', () => {
        if (dropdownNotificaciones) dropdownNotificaciones.style.display = 'none';
    });

    // 2. ESCUCHAR CAMBIOS EN TIEMPO REAL (Tabla 'notificaciones' filtrada por usuario)
    client
        .channel('public:notificaciones-usuario-' + userId)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notificaciones',
            filter: `usuario_id=eq.${userId}`
        }, payload => {
            const nuevaNoti = payload.new;
            console.log("¡Nueva notificación en tiempo real!", nuevaNoti);

            // Agregar la notificación a la interfaz e incrementar contador
            renderizarNotificacionEnUI(nuevaNoti.titulo, nuevaNoti.mensaje, nuevaNoti.creado_at);
            
            notificacionesNoLeidas++;
            actualizarBadgeNotificaciones();
        })
        .subscribe((status) => {
            console.log("Estado de suscripción a Notificaciones Realtime:", status);
        });
});

// Función para cargar el historial previo de notificaciones
async function cargarNotificacionesHistoricas(client, userId) {
    try {
        const { data: notis, error } = await client
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', userId)
            .order('creado_at', { ascending: false })
            .limit(15); // Traer las últimas 15

        if (error) throw error;

        if (!notis || notis.length === 0) return;

        // Limpiar textos por defecto
        const lista = document.getElementById('listaNotificaciones');
        const listaDetalle = document.getElementById('listaDetalladaNotificaciones');
        if (lista && lista.innerHTML.includes('No hay notificaciones')) lista.innerHTML = '';
        if (listaDetalle && listaDetalle.innerHTML.includes('No tienes notificaciones recientes')) listaDetalle.innerHTML = '';

        notis.forEach(n => {
            renderizarNotificacionEnUI(n.titulo, n.mensaje, n.creado_at);
            if (!n.leida) {
                notificacionesNoLeidas++;
            }
        });

        actualizarBadgeNotificaciones();
    } catch (err) {
        console.error("Error al cargar historial de notificaciones:", err);
    }
}

// Función auxiliar para pintar las notificaciones en el HTML
function renderizarNotificacionEnUI(titulo, mensaje, fechaCreacion) {
    const tiempoFormateado = fechaCreacion ? new Date(fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hace un momento';

    // 1. Agregar a la campanita superior (mini notificación)
    const lista = document.getElementById('listaNotificaciones');
    if (lista) {
        if (lista.innerHTML.includes('No hay notificaciones')) {
            lista.innerHTML = '';
        }
        const item = document.createElement('div');
        item.style.padding = '8px 6px';
        item.style.borderBottom = '1px solid #f1f5f9';
        item.style.fontSize = '0.8rem';
        item.innerHTML = `🔔 <strong>${titulo}</strong>: ${mensaje}<div style="font-size: 0.7rem; color: #94a3b8;">${tiempoFormateado}</div>`;
        
        lista.prepend(item);
    }

    // 2. Agregar a la sección detallada (panel principal de notificaciones)
    const listaDetalle = document.getElementById('listaDetalladaNotificaciones');
    if (listaDetalle) {
        if (listaDetalle.innerHTML.includes('No tienes notificaciones recientes')) {
            listaDetalle.innerHTML = '';
        }
        const itemDetalle = document.createElement('div');
        itemDetalle.style.cssText = "padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; display: flex; align-items: center; gap: 1rem; animation: fadeIn 0.3s ease-in-out; margin-bottom: 0.8rem;";
        itemDetalle.innerHTML = `
            <span style="font-size: 1.5rem;">🔔</span> 
            <div>
                <strong style="color: #0f172a; font-size: 0.95rem;">${titulo}</strong>
                <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">${mensaje}</p>
                <span style="font-size: 0.7rem; color: #94a3b8;">${tiempoFormateado}</span>
            </div>
        `;
        listaDetalle.prepend(itemDetalle);
    }
}

function actualizarBadgeNotificaciones() {
    const badge = document.getElementById('badgeNoti');
    if (!badge) return;

    if (notificacionesNoLeidas > 0) {
        badge.textContent = notificacionesNoLeidas;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}