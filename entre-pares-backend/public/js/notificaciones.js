// ==========================================
// SISTEMA GLOBAL DE NOTIFICACIONES (MODO PRUEBAS / DEBUG)
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

    // Manejar apertura/cierre del desplegable
    btnCampanita.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownNotificaciones.style.display === 'block';
        dropdownNotificaciones.style.display = isOpen ? 'none' : 'block';

        if (!isOpen) {
            notificacionesNoLeidas = 0;
            actualizarBadgeNotificaciones();
        }
    });

    document.addEventListener('click', () => {
        if (dropdownNotificaciones) dropdownNotificaciones.style.display = 'none';
    });

    // Obtener el usuario actual (opcional para pruebas directas)
    const { data: { user } } = await client.auth.getUser();

    // ESCUCHAR CAMBIOS EN TIEMPO REAL SIN FILTROS RESTRINGIDOS (Ideal para probar)
    client
        .channel('public:reservas_global_test')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, payload => {
            const res = payload.new;
            const eventType = payload.eventType;

            console.log("¡Evento de Realtime recibido!", payload);

            if (eventType === 'INSERT') {
                agregarNotificacionUI(`Nueva reserva detectada: ${res.materia || 'Clase General'}`);
            } else if (eventType === 'UPDATE') {
                // Notificar sobre el nuevo estado de la reserva
                agregarNotificacionUI(`La reserva de ${res.materia || 'Clase'} cambió a estado: ${res.estado || 'Pendiente'}`);
            }
        })
        .subscribe((status) => {
            console.log("Estado de suscripción Realtime:", status);
        });
});

function agregarNotificacionUI(mensaje) {
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
        item.innerHTML = `🔔 <strong>${mensaje}</strong><div style="font-size: 0.7rem; color: #94a3b8;">Hace un momento</div>`;
        
        lista.prepend(item);
    }

    // 2. Agregar a la nueva sección detallada (panel principal)
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
                <strong style="color: #0f172a; font-size: 0.95rem;">${mensaje}</strong>
                <p style="color: #64748b; font-size: 0.8rem; margin: 0.2rem 0 0 0;">Recibido en la sesión actual</p>
            </div>
        `;
        listaDetalle.prepend(itemDetalle);
    }

    // Aumentar el contador del globo rojo
    notificacionesNoLeidas++;
    actualizarBadgeNotificaciones();
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