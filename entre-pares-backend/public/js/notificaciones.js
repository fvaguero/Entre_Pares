// ==========================================
// SISTEMA GLOBAL DE NOTIFICACIONES EN TIEMPO REAL
// ==========================================

let notificacionesNoLeidas = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificamos si existe el contenedor de la campanita en la página actual
    const btnCampanita = document.getElementById('btnCampanita');
    if (!btnCampanita) return; 

    const dropdownNotificaciones = document.getElementById('dropdownNotificaciones');

    // Usamos la instancia global de Supabase si existe, sino creamos una única fallback segura
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

    // Obtener el usuario actual logueado
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const usuarioId = user.id;
    const rolActual = localStorage.getItem('usuarioRol') || 'Estudiante';

    // Escuchar cambios en la tabla reservas en tiempo real
    client
        .channel('public:reservas_global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, payload => {
            const res = payload.new;
            const eventType = payload.eventType;

            // Filtros inteligentes según el rol
            if (rolActual === 'Administrador' || user.email === 'valentinaseco2004@gmail.com') {
                if (eventType === 'INSERT') {
                    agregarNotificacionUI(`Nueva reserva creada: ${res.materia || 'Clase'}`);
                }
            } else if (rolActual === 'Tutor') {
                if (res.tutor_id === usuarioId) {
                    if (eventType === 'INSERT') {
                        agregarNotificacionUI(`¡Te han agendado una nueva reserva de ${res.materia}!`);
                    } else if (eventType === 'UPDATE') {
                        agregarNotificacionUI(`Una reserva de ${res.materia} cambió de estado.`);
                    }
                }
            } else { // Estudiante
                if (res.estudiante_id === usuarioId) {
                    if (eventType === 'UPDATE') {
                        agregarNotificacionUI(`Tu reserva de ${res.materia} fue actualizada.`);
                    }
                }
            }
        })
        .subscribe();
});

function agregarNotificacionUI(mensaje) {
    const lista = document.getElementById('listaNotificaciones');
    if (!lista) return;

    if (lista.innerHTML.includes('No hay notificaciones')) {
        lista.innerHTML = '';
    }

    const item = document.createElement('div');
    item.style.padding = '8px 6px';
    item.style.borderBottom = '1px solid #f1f5f9';
    item.style.fontSize = '0.8rem';
    item.innerHTML = `🔔 <strong>${mensaje}</strong><div style="font-size: 0.7rem; color: #94a3b8;">Hace un momento</div>`;
    
    lista.prepend(item);
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