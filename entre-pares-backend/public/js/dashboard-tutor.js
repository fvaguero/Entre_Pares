const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    usuarioActual = user;

    const rolActual = localStorage.getItem('usuarioRol');
    const roleSwitcher = document.getElementById('roleSwitcher');
    const btnRoleDropdown = document.getElementById('btnRoleDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (rolActual === 'Ambos' && roleSwitcher) {
        roleSwitcher.style.display = 'inline-block';
    }

    if (btnRoleDropdown) {
        btnRoleDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    document.addEventListener('click', (e) => {
        if (roleSwitcher && !roleSwitcher.contains(e.target) && dropdownMenu) {
            dropdownMenu.style.display = 'none';
        }
    });

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('usuarioRol'); 
            window.location.href = 'login.html';
        });
    }

    const formMaterias = document.getElementById('formMaterias');
    const mensajeMaterias = document.getElementById('mensajeMaterias');

    if (formMaterias) {
        formMaterias.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ciudad = document.getElementById('ciudadTutor').value;
            const materias = document.getElementById('materias').value;

            mensajeMaterias.textContent = "Guardando perfil...";
            mensajeMaterias.style.color = "#4f46e5";

            try {
                const respuesta = await fetch('/api/tutor/perfil', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: usuarioActual.id, ciudad: ciudad, materias: materias })
                });
                const resultado = await respuesta.json();

                if (!resultado.success) throw new Error(resultado.error || "No se pudo actualizar.");
                
                mostrarNotificacion("¡Perfil activado con éxito!", "exito");
                mensajeMaterias.textContent = "¡Perfil activado con éxito!";
                mensajeMaterias.style.color = "green";
            } catch (error) {
                mostrarNotificacion("Error: " + error.message, "error");
                mensajeMaterias.textContent = "Error: " + error.message;
                mensajeMaterias.style.color = "red";
            }
        });
    }

    const ciudadInput = document.getElementById('ciudadTutor');
    const sugerenciasContenedor = document.getElementById('sugerenciasCiudades');
    let debounceTimer;

    if (ciudadInput && sugerenciasContenedor) {
        ciudadInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                sugerenciasContenedor.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&limit=5`);
                    const data = await response.json();
                    
                    sugerenciasContenedor.innerHTML = '';
                    
                    if (data.length > 0) {
                        data.forEach(lugar => {
                            const div = document.createElement('div');
                            div.textContent = lugar.display_name;
                            div.addEventListener('click', () => {
                                ciudadInput.value = lugar.display_name;
                                sugerenciasContenedor.style.display = 'none';
                            });
                            sugerenciasContenedor.appendChild(div);
                        });
                        sugerenciasContenedor.style.display = 'block';
                    } else {
                        sugerenciasContenedor.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error al buscar ciudad:', error);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!ciudadInput.contains(e.target) && !sugerenciasContenedor.contains(e.target)) {
                sugerenciasContenedor.style.display = 'none';
            }
        });
    }

    cargarSolicitudes();
});

async function cargarSolicitudes() {
    const listaSolicitudes = document.getElementById('listaSolicitudes');
    if (!listaSolicitudes || !usuarioActual) return;

    try {
        const respuesta = await fetch(`/api/reservas/${usuarioActual.id}?rol=Tutor`);
        const resultado = await respuesta.json();

        if (!resultado.success) {
            listaSolicitudes.innerHTML = `<p style="color: red; text-align: center;">Error al cargar: ${resultado.error}</p>`;
            return;
        }

        const reservas = resultado.data.filter(r => r.estado && r.estado.toLowerCase() === 'pendiente');

        if (reservas.length === 0) {
            listaSolicitudes.innerHTML = `<p style="color: #64748b; text-align: center; font-style: italic;">No tienes solicitudes pendientes en este momento.</p>`;
            return;
        }

        listaSolicitudes.innerHTML = reservas.map(reserva => {
            const fecha = new Date(reserva.fecha_hora).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
            return `
                <div style="border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1rem; background: #ffffff;">
                    <h4 style="color: #0f172a; margin-bottom: 0.5rem; font-size: 1.1rem;">📚 Materia: ${reserva.materia}</h4>
                    <p style="color: #475569; font-size: 0.9rem; margin-bottom: 0.3rem;"><strong>🗓️ Fecha y Hora:</strong> ${fecha}</p>
                    <p style="color: #475569; font-size: 0.9rem; margin-bottom: 1.5rem;"><strong>💬 Estudiante ID:</strong> ${reserva.estudiante_id}</p>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button onclick="actualizarEstado('${reserva.id}', 'Aprobado')" class="btn" style="background: #10b981; color: white; flex: 1; border: none; padding: 0.6rem; border-radius: 4px; cursor: pointer;">Aceptar Tutoría</button>
                        <button onclick="actualizarEstado('${reserva.id}', 'Rechazada')" class="btn" style="background: #ef4444; color: white; flex: 1; border: none; padding: 0.6rem; border-radius: 4px; cursor: pointer;">Rechazar</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error cargando solicitudes:", err);
        listaSolicitudes.innerHTML = `<p style="color: red; text-align: center;">Error de conexión con el servidor.</p>`;
    }
}

window.actualizarEstado = async function(id, nuevoEstado) {
    const accionTexto = nuevoEstado === 'Aprobado' ? 'aceptar' : 'rechazar';
    
    // Usamos un modal/confirmación sutil o directo sin bloqueos molestos. 
    // Si prefieres omitir cualquier confirmación, puedes quitar esta línea:
    if (!window.confirm(`¿Estás seguro de que deseas ${accionTexto} esta tutoría?`)) return;

    try {
        const endpoint = nuevoEstado === 'Aprobado' 
            ? `/api/reservas/${id}/aprobar` 
            : `/api/reservas/${id}/estado`;

        const options = nuevoEstado === 'Aprobado' 
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' } }
            : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }) };

        const respuesta = await fetch(endpoint, options);
        const resultado = await respuesta.json();

        if (!resultado.success) {
            mostrarNotificacion("Error: " + resultado.error, "error");
        } else {
            mostrarNotificacion(`¡Tutoría ${nuevoEstado.toLowerCase()} con éxito! Notificación enviada.`, "exito");
            cargarSolicitudes();
        }
    } catch (err) {
        console.error("Error en la petición:", err);
        mostrarNotificacion("Error de conexión con el servidor.", "error");
    }
};

// Función para mostrar alertas flotantes modernas en lugar del alert() nativo
function mostrarNotificacion(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.textContent = mensaje;
    alerta.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${tipo === 'exito' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 500;
        animation: fadeInOut 3s ease forwards;
    `;
    document.body.appendChild(alerta);

    setTimeout(() => {
        alerta.remove();
    }, 3500);
}