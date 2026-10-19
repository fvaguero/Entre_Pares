// Gamificación: niveles y progreso del usuario.
function obtenerNivelGamificacion(puntos) {
    const total = Math.max(0, Number(puntos) || 0);
    if (total <= 100) return { nombre: 'Principiante', insignia: '🌱', minimo: 0, maximo: 100, siguiente: 101 };
    if (total <= 300) return { nombre: 'Colaborador', insignia: '⭐', minimo: 101, maximo: 300, siguiente: 301 };
    if (total <= 600) return { nombre: 'Académico Pro', insignia: '🔥', minimo: 301, maximo: 600, siguiente: 601 };
    return { nombre: 'Leyenda Entre Pares', insignia: '👑', minimo: 601, maximo: null, siguiente: null };
}

function mostrarNivelGamificacion(puntos) {
    const total = Math.max(0, Number(puntos) || 0);
    const nivel = obtenerNivelGamificacion(total);
    const nombre = document.getElementById('nivelGamificacion');
    const barra = document.getElementById('progresoGamificacion');
    const texto = document.getElementById('textoProgresoGamificacion');
    if (nombre) nombre.textContent = nivel.insignia + ' ' + nivel.nombre;
    if (!nivel.maximo) {
        if (barra) barra.style.width = '100%';
        if (texto) texto.textContent = '¡Felicitaciones! Alcanzaste el nivel máximo con ' + total + ' puntos.';
        return;
    }
    const puntosDelNivel = total - nivel.minimo;
    const puntosDelTramo = nivel.maximo - nivel.minimo + 1;
    const porcentaje = Math.max(0, Math.min(100, ((puntosDelNivel + 1) / puntosDelTramo) * 100));
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = 'Tenés ' + total + ' puntos. Te faltan ' + (nivel.siguiente - total) + ' para el próximo nivel.';
}

const SUPABASE_URL = "https://uecwotydamsjstpovbzz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let destinatarioActivoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        window.location.href = 'login.html';
        return;
    }

    const userId = session.user.id;

    // 1. Verificar perfil, rol y rellenar datos en la cabecera y perfil
    try {
        const { data: perfil, error: perfilError } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (perfil) {
            const spanNombre = document.getElementById('nombreUsuarioHeader');
            if (spanNombre) spanNombre.textContent = perfil.nombre_completo || 'Estudiante';

            const inputNombre = document.getElementById('perfilNombre');
            const inputNacimiento = document.getElementById('perfilNacimiento');
            const inputEmail = document.getElementById('perfilEmail');
            const inputCarrera = document.getElementById('perfilCarrera');
            const inputSede = document.getElementById('perfilSede');
            const spanPuntos = document.getElementById('puntosGamificacion');

            if (inputNombre) inputNombre.value = perfil.nombre_completo || '';
            if (inputNacimiento) inputNacimiento.value = perfil.fecha_nacimiento || '';
            if (inputEmail) inputEmail.value = perfil.email || '';
            if (inputCarrera) inputCarrera.value = perfil.carrera || '';
            if (inputSede) inputSede.value = perfil.sede_universitaria || '';
            const puntosActuales = Number(perfil.puntos_gamificacion ?? perfil.puntos ?? 0);
            if (spanPuntos) spanPuntos.textContent = puntosActuales + ' pts';
            mostrarNivelGamificacion(puntosActuales);

            if (perfil.rol === 'Ambos' || perfil.rol === 'Tutor') {
                const roleSwitcher = document.getElementById('roleSwitcher');
                if (roleSwitcher) roleSwitcher.style.display = 'block';
            }
            if (perfil.rol === 'Tutor') {
                window.location.href = 'dashboard-tutor.html';
                return;
            }
        }
    } catch (err) {
        console.error("Error al verificar perfil:", err);
    }

    // 2. Inicializar Mapa (Leaflet) limpio de inicio
    const mapa = L.map('mapa').setView([-28.4696, -65.7852], 13);
    window.mapaLeaflet = mapa; 
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);

    setTimeout(() => {
        mapa.invalidateSize();
    }, 250);

    // Dejar la lista lateral limpia con un mensaje guía inicial
    const listaTutoresContenedor = document.getElementById('listaTutoresFiltrados');
    if (listaTutoresContenedor) {
        listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center; padding: 2rem 0;">Aplica un filtro para buscar tutores y verlos en el mapa.</p>';
    }

    // Cargar datos del estudiante y activar Realtime
    cargarMisReservas(supabaseClient, userId);
    inicializarChat(supabaseClient, userId);
    cargarContactos(supabaseClient, userId);
    inicializarNotificacionesReservas(supabaseClient, userId);

    // 3. Botón de Filtros (Único momento en que se cargan los tutores)
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', () => {
            const materiaFiltro = document.getElementById('filtroMateria').value.trim();
            const ciudadFiltro = document.getElementById('filtroCiudad').value.trim();
            cargarTutoresEnMapa(supabaseClient, mapa, materiaFiltro, ciudadFiltro);
        });
    }

    // 4. Actualizar Datos del Perfil
    const formPerfil = document.getElementById('formPerfilEstudiante');
    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('perfilNombre').value;
            const nacimiento = document.getElementById('perfilNacimiento').value;
            const carrera = document.getElementById('perfilCarrera').value;
            const sede = document.getElementById('perfilSede').value;

            const { error } = await supabaseClient
                .from('perfiles')
                .update({ 
                    nombre_completo: nombre,
                    fecha_nacimiento: nacimiento || null,
                    carrera: carrera, 
                    sede_universitaria: sede 
                })
                .eq('id', userId);

            if (!error) {
                const spanNombre = document.getElementById('nombreUsuarioHeader');
                if (spanNombre) spanNombre.textContent = nombre;
                
                mostrarNotificacionEstudiante("¡Perfil actualizado con éxito!", "exito");
            } else {
                mostrarNotificacionEstudiante("Error al actualizar el perfil.", "error");
                console.error("Error BD:", error);
            }
        });
    }

    // 5. Botón Cerrar Sesión (Con SweetAlert2)
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: '¿Cerrar sesión?',
                text: "¿Estás seguro que deseas salir de tu cuenta?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                backdrop: `rgba(0,0,0,0.5)`
            });

            if (result.isConfirmed) {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            }
        });
    }

    // Dropdown Rol
    const btnRoleDropdown = document.getElementById('btnRoleDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (btnRoleDropdown && dropdownMenu) {
        btnRoleDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
        window.addEventListener('click', () => { dropdownMenu.style.display = 'none'; });
    }

    // Modal de Reserva
    const modalReserva = document.getElementById('modalReserva');
    const cerrarModal = document.getElementById('cerrarModal');
    if (cerrarModal) {
        cerrarModal.addEventListener('click', () => {
            modalReserva.style.display = 'none';
        });
    }

    // 6. Enviar formulario de solicitud de consulta
    const formReserva = document.getElementById('formReservaTutoria');
    if (formReserva) {
        formReserva.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tutorId = document.getElementById('tutorIdModal').value;
            const materia = document.getElementById('materiaReserva').value;
            const comentarios = document.getElementById('comentariosReserva').value;
            const mensajeEstado = document.getElementById('mensajeReserva');

            try {
                mensajeEstado.style.color = '#2563eb';
                mensajeEstado.textContent = "Enviando solicitud de consulta...";

                const { error: insertError } = await supabaseClient
                    .from('reservas')
                    .insert([{
                        estudiante_id: userId,
                        tutor_id: tutorId,
                        materia: materia,
                        comentarios: comentarios,
                        estado: 'Pendiente',
                        estado_pago: 'Pendiente'
                    }]);

                if (insertError) throw insertError;

                mensajeEstado.style.color = '#16a34a';
                mensajeEstado.textContent = "¡Solicitud enviada con éxito! Esperando aprobación del tutor.";
                setTimeout(() => {
                    modalReserva.style.display = 'none';
                    e.target.reset();
                    mensajeEstado.textContent = '';
                    cargarMisReservas(supabaseClient, userId);
                    cargarContactos(supabaseClient, userId);
                }, 2000);
            } catch (error) {
                console.error("Error al enviar solicitud:", error);
                mensajeEstado.style.color = '#dc2626';
                mensajeEstado.textContent = "Error: " + (error.message || "No se pudo completar la solicitud.");
            }
        });
    }

    // 7. Enviar formulario de Reseña (Estrellas)
    const formResena = document.getElementById('formResena');
    if (formResena) {
        formResena.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reservaId = document.getElementById('reservaIdResena').value;
            const tutorId = document.getElementById('tutorIdResena').value;
            const calificacion = parseInt(document.getElementById('estrellasResena').value);
            const comentario = document.getElementById('comentarioResena').value;

            try {
                const { error: errorResena } = await supabaseClient
                    .from('resenas')
                    .insert([{
                        reserva_id: reservaId,
                        tutor_id: tutorId,
                        estudiante_id: userId,
                        calificacion: calificacion,
                        comentario: comentario
                    }]);

                if (errorResena) throw errorResena;

                await supabaseClient
                    .from('reservas')
                    .update({ estado: 'Finalizada' })
                    .eq('id', reservaId);

                document.getElementById('modalResena').style.display = 'none';
                mostrarNotificacionEstudiante("¡Gracias por calificar al tutor!", "exito");
                
                cargarMisReservas(supabaseClient, userId);

            } catch (err) {
                console.error("Error al guardar reseña:", err);
                mostrarNotificacionEstudiante("No se pudo guardar la reseña.", "error");
            }
        });
    }
});

/* ============================================================
   NOTIFICACIONES EN TIEMPO REAL
   ============================================================ */
function inicializarNotificacionesReservas(supabaseClient, estudianteId) {
    supabaseClient
        .channel('public:reservas-estudiante')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'reservas',
            filter: `estudiante_id=eq.${estudianteId}`
        }, payload => {
            const reservaActualizada = payload.new;
            if (reservaActualizada.estado === 'Aceptada' || reservaActualizada.estado === 'aprobada') {
                mostrarNotificacionEstudiante("¡Tu solicitud de consulta fue aceptada! Ya puedes chatear con el tutor.", "exito");
                cargarMisReservas(supabaseClient, estudianteId);
                cargarContactos(supabaseClient, estudianteId);
            } else if (reservaActualizada.estado === 'Rechazada' || reservaActualizada.estado === 'rechazada') {
                mostrarNotificacionEstudiante("Tu solicitud de consulta fue rechazada. Puedes intentar con otro tutor.", "error");
                cargarMisReservas(supabaseClient, estudianteId);
            } else if (reservaActualizada.estado === 'Finalizada') {
                mostrarNotificacionEstudiante("⭐ ¡La tutoría ha finalizado! Ya puedes calificar la clase.", "exito");
                cargarMisReservas(supabaseClient, estudianteId);
            }
        })
        .subscribe();
}

function mostrarNotificacionEstudiante(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.textContent = mensaje;
    alerta.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${tipo === 'exito' ? '#16a34a' : '#dc2626'};
        color: white;
        padding: 0.8rem 1.2rem;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3000;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        font-weight: 500;
        animation: fadeIn 0.3s ease-in-out;
    `;
    document.body.appendChild(alerta);
    setTimeout(() => { alerta.remove(); }, 4000);
}

/* ============================================================
   MAPA Y RESERVAS (FILTRADO BAJO DEMANDA)
   ============================================================ */
let marcadoresActuales = [];

function limpiarMarcadoresDelMapa(mapa) {
    marcadoresActuales.forEach(m => mapa.removeLayer(m));
    marcadoresActuales = [];
}

async function cargarTutoresEnMapa(supabaseClient, mapa, filtroMateria = '', filtroCiudad = '') {
    const listaTutoresContenedor = document.getElementById('listaTutoresFiltrados');
    if (listaTutoresContenedor) {
        listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">Buscando tutores...</p>';
    }

    try {
        let query = supabaseClient
            .from('perfiles')
            .select('*')
            .in('rol', ['Tutor', 'Ambos']);

        if (filtroCiudad) {
            query = query.ilike('sede_universitaria', `%${filtroCiudad}%`);
        }

        const { data: tutores, error } = await query;

        if (error) {
            console.error("Error al consultar tutores:", error);
            if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">Error al cargar tutores.</p>';
            return;
        }

        limpiarMarcadoresDelMapa(mapa);

        if (!tutores || tutores.length === 0) {
            if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron tutores disponibles.</p>';
            return;
        }

        if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '';

        let tutoresMostrados = 0;

        tutores.forEach((tutor, index) => {
            if (filtroMateria && tutor.materias_impartidas) {
                if (!tutor.materias_impartidas.toLowerCase().includes(filtroMateria.toLowerCase())) {
                    return;
                }
            }

            tutoresMostrados++;

            const estrellasTexto = tutor.total_resenas > 0 
                ? `⭐ ${tutor.calificacion_promedio} (${tutor.total_resenas} reseñas)` 
                : `<span style="color: #94a3b8; font-size: 0.8rem;">⭐ Nuevo tutor</span>`;

            if (listaTutoresContenedor) {
                const card = document.createElement('div');
                card.className = "panel-card";
                card.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; font-size: 0.85rem; margin-bottom: 0.5rem;";
                card.innerHTML = `
                    <strong onclick="verPerfilTutor('${tutor.id}')" style="color: #2563eb; cursor: pointer; display: block; margin-bottom: 0.2rem; font-size: 0.95rem; text-decoration: underline;">${tutor.nombre_completo || 'Tutor Entre Pares'}</strong>
                    <p style="color: #ca8a04; font-weight: bold; margin: 0.1rem 0; font-size: 0.85rem;">${estrellasTexto}</p>
                    <p style="color: #475569; margin: 0.1rem 0;">Sede: ${tutor.sede_universitaria || 'Catamarca'}</p>
                    <p style="color: #475569; margin: 0.1rem 0;">Materias: ${tutor.materias_impartidas || 'Varias'}</p>
                    <p style="color: #16a34a; font-weight: bold; margin: 0.2rem 0;">Precio: $${tutor.precio_hora || 3000}</p>
                    <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem;">
                        <button onclick="verPerfilTutor('${tutor.id}')" class="btn" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #1e293b; flex: 1; font-size: 0.75rem; padding: 0.4rem; cursor: pointer;">Ver Perfil</button>
                        <button onclick="abrirModalReserva('${tutor.id}', '${tutor.nombre_completo || 'Tutor'}')" class="btn btn-yellow" style="flex: 1; font-size: 0.75rem; padding: 0.4rem; cursor: pointer;">Solicitar</button>
                    </div>
                `;
                listaTutoresContenedor.appendChild(card);
            }

            const lat = tutor.latitud ? parseFloat(tutor.latitud) : -28.4696 + (index * 0.002);
            const lng = tutor.longitud ? parseFloat(tutor.longitud) : -65.7852 + (index * 0.002);

            const marker = L.marker([lat, lng]).addTo(mapa);
            marker.bindPopup(`
                <b><a href="#" onclick="verPerfilTutor('${tutor.id}'); return false;" style="color: #2563eb;">${tutor.nombre_completo || 'Tutor Entre Pares'}</a></b><br>
                ${estrellasTexto}<br>
                Sede: ${tutor.sede_universitaria || 'Catamarca'}<br>
                Materias: ${tutor.materias_impartidas || 'Varias'}<br>
                Precio: $${tutor.precio_hora || 3000}<br>
                <button onclick="verPerfilTutor('${tutor.id}')" style="margin-top: 6px; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">Ver Perfil</button>
            `);
            marcadoresActuales.push(marker);
        });

        if (tutoresMostrados === 0 && listaTutoresContenedor) {
            listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No hay tutores que coincidan con los filtros aplicados.</p>';
        }

    } catch (err) {
        console.error("Error al cargar mapa y tutores:", err);
    }
}

async function cargarMisReservas(supabaseClient, estudianteId) {
    const contenedor = document.getElementById('listaMisReservas');
    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`*, tutor:tutor_id (nombre_completo, email, precio_hora)`)
            .eq('estudiante_id', estudianteId)
            .order('id', { ascending: false });

        if (error || !reservas || reservas.length === 0) {
            contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No tienes solicitudes de consulta aún.</p>`;
            return;
        }

        contenedor.innerHTML = '';
        reservas.forEach(res => {
            let badgeColor = '#eab308';
            if (res.estado === 'Aceptada' || res.estado === 'aprobada') badgeColor = '#16a34a';
            if (res.estado === 'Rechazada' || res.estado === 'rechazada') badgeColor = '#dc2626';
            if (res.estado === 'Finalizada') badgeColor = '#2563eb';

            let botonAccion = '';
            if (res.estado === 'Aceptada' || res.estado === 'aprobada') {
                if (res.estado_pago === 'Pendiente' || !res.estado_pago) {
                    const precio = res.precio || res.tutor?.precio_hora || 3000;
                    botonAccion = `<button id="btn-pagar-${res.id}" onclick="pagarTutoria('${res.id}', '${res.materia}', ${precio})" class="btn btn-yellow" style="width: 100%; display: block; text-align: center; margin-top: 0.8rem; padding: 0.5rem; font-size: 0.85rem; border-radius: 4px; border: none; font-weight: 600; cursor: pointer;">💳 Pagar Tutoría ($${precio})</button>`;
                } else {
                    botonAccion = `
                        <a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.8rem; background: #2563eb; color: white; padding: 0.5rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px; font-weight:600;">🎥 Unirse a Videollamada</a>
                    `;
                }
            } else if (res.estado === 'Finalizada') {
                botonAccion = `
                    <button onclick="abrirModalResena('${res.id}', '${res.tutor_id}', '${res.tutor?.nombre_completo}')" class="btn btn-yellow" style="width: 100%; margin-top: 0.5rem; font-size: 0.8rem; font-weight: 600; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                        ⭐ Calificar Tutoría
                    </button>
                `;
            }

            const card = document.createElement('div');
            card.className = "panel-card";
            card.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; font-size: 0.85rem;";
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <strong style="color: #0f172a; font-size: 1rem;">${res.materia}</strong>
                    <span style="background: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">${res.estado}</span>
                </div>
                <p style="color: #475569; margin: 0.3rem 0;">Tutor: <strong>${res.tutor?.nombre_completo || 'Asignado'}</strong></p>
                <p style="color: #475569; margin: 0.3rem 0;"><strong>Duda:</strong> ${res.comentarios || 'Sin descripción'}</p>
                ${botonAccion}
            `;
            contenedor.appendChild(card);
        });
    } catch (err) {
        console.error("Error al cargar reservas:", err);
        contenedor.innerHTML = `<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">Error al cargar solicitudes.</p>`;
    }
}

window.abrirModalReserva = function(tutorId, tutorNombre) {
    document.getElementById('tutorIdModal').value = tutorId;
    document.getElementById('tutorNombreModal').textContent = `Envía tu duda a ${tutorNombre}`;
    document.getElementById('modalReserva').style.display = 'flex';
};

window.abrirModalResena = function(reservaId, tutorId, tutorNombre) {
    document.getElementById('reservaIdResena').value = reservaId;
    document.getElementById('tutorIdResena').value = tutorId;
    document.getElementById('nombreTutorResena').textContent = tutorNombre || 'el tutor';
    document.getElementById('modalResena').style.display = 'flex';
};

/* ============================================================
   PERFIL PÚBLICO DEL TUTOR
   ============================================================ */
window.verPerfilTutor = async function(tutorId) {
    const modal = document.getElementById('modalPerfilTutorPublico');
    const lblNombre = document.getElementById('modalTutorNombre');
    const lblEstrellas = document.getElementById('modalTutorEstrellas');
    const lblSede = document.getElementById('modalTutorSede');
    const lblMaterias = document.getElementById('modalTutorMaterias');
    const lblPrecio = document.getElementById('modalTutorPrecio');
    const contenedorResenasModal = document.getElementById('modalTutorListaResenas');
    const btnSolicitarModal = document.getElementById('modalTutorBtnSolicitar');

    if (!modal) return;

    modal.style.display = 'flex';
    lblNombre.textContent = "Cargando perfil...";
    lblEstrellas.textContent = "⭐ ...";
    lblSede.textContent = "...";
    lblMaterias.textContent = "...";
    lblPrecio.textContent = "$...";
    contenedorResenasModal.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">Cargando opiniones...</p>';

    try {
        const { data: tutor, error: errorTutor } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', tutorId)
            .single();

        if (errorTutor) throw errorTutor;

        lblNombre.textContent = tutor.nombre_completo || 'Tutor Entre Pares';
        lblEstrellas.textContent = tutor.total_resenas > 0 
            ? `⭐ ${tutor.calificacion_promedio} (${tutor.total_resenas} reseñas)` 
            : '⭐ Nuevo tutor (Sin reseñas aún)';
        lblSede.textContent = tutor.sede_universitaria || 'Catamarca';
        lblMaterias.textContent = tutor.materias_impartidas || 'No especificadas';
        lblPrecio.textContent = `$${tutor.precio_hora || 3000} ARS`;

        btnSolicitarModal.onclick = () => {
            modal.style.display = 'none';
            abrirModalReserva(tutor.id, tutor.nombre_completo || 'Tutor');
        };

        const { data: resenas, error: errorResenas } = await supabaseClient
            .from('resenas')
            .select(`*, estudiante:estudiante_id (nombre_completo)`)
            .eq('tutor_id', tutorId)
            .order('id', { ascending: false });

        if (errorResenas) throw errorResenas;

        if (!resenas || resenas.length === 0) {
            contenedorResenasModal.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">Este tutor aún no tiene opiniones registradas.</p>';
            return;
        }

        contenedorResenasModal.innerHTML = resenas.map(r => {
            const estrellas = '⭐'.repeat(r.calificacion || 5);
            return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.7rem; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                        <strong style="color: #0f172a; font-size: 0.85rem;">${r.estudiante?.nombre_completo || 'Estudiante'}</strong>
                        <span style="color: #ca8a04; font-size: 0.8rem;">${estrellas}</span>
                    </div>
                    <p style="color: #475569; font-size: 0.8rem; margin: 0; font-style: italic;">"${r.comentario || 'Sin comentarios'}"</p>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar perfil público del tutor:", err);
        contenedorResenasModal.innerHTML = '<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">No se pudo cargar la información del tutor.</p>';
    }
};

/* ============================================================
   CHAT EN TIEMPO REAL Y HISTORIAL FLUIDO
   ============================================================ */
async function cargarContactos(supabaseClient, miId) {
    const lista = document.getElementById('listaContactos');
    if (!lista) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select('tutor_id, estado, tutor:tutor_id (nombre_completo)')
            .eq('estudiante_id', miId);

        if (error) throw error;

        const vistos = new Set();
        const contactos = [];
        (reservas || []).forEach(r => {
            const aprobada = r.estado === 'Aceptada' || r.estado === 'aprobada';
            if (!aprobada || vistos.has(r.tutor_id)) return;
            vistos.add(r.tutor_id);
            contactos.push({ id: r.tutor_id, nombre: r.tutor?.nombre_completo || 'Tutor' });
        });

        if (contactos.length === 0) {
            lista.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; text-align: center; margin-top: 2rem;">El chat se habilitará cuando el tutor apruebe tu consulta.</p>';
            return;
        }

        lista.innerHTML = '';
        contactos.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sidebar-btn contacto-chat';
            btn.dataset.id = c.id;
            btn.textContent = `👤 ${c.nombre}`;
            if (destinatarioActivoId === c.id) btn.classList.add('active');

            btn.addEventListener('click', () => {
                destinatarioActivoId = c.id;
                document.querySelectorAll('.contacto-chat').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('chatHeaderNombre').textContent = c.nombre;
                document.getElementById('chatHeaderEstado').style.display = 'block';
                cargarHistorialChat(supabaseClient, miId, c.id);
            });
            lista.appendChild(btn);
        });
    } catch (err) {
        console.error("Error al cargar contactos:", err);
        lista.innerHTML = '<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">Error al cargar conversaciones.</p>';
    }
}

function inicializarChat(supabaseClient, usuarioActualId) {
    const formMensaje = document.getElementById('formEnviarMensaje');
    const inputTexto = document.getElementById('inputMensajeTexto');

    if (formMensaje) {
        formMensaje.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!destinatarioActivoId) {
                mostrarNotificacionEstudiante("Selecciona un contacto primero.", "error");
                return;
            }

            const texto = inputTexto.value.trim();
            if (!texto) return;

            const { error } = await supabaseClient.from('mensajes').insert({
                remitente_id: usuarioActualId,
                destinatario_id: destinatarioActivoId,
                contenido: texto
            });

            if (error) {
                console.error("Error al enviar mensaje:", error.message);
                mostrarNotificacionEstudiante("No se pudo enviar el mensaje.", "error");
            } else {
                inputTexto.value = '';
                cargarHistorialChat(supabaseClient, usuarioActualId, destinatarioActivoId);
            }
        });
    }

    supabaseClient
        .channel('public:mensajes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
            const nuevoMsg = payload.new;
            if (
                (nuevoMsg.remitente_id === usuarioActualId && nuevoMsg.destinatario_id === destinatarioActivoId) ||
                (nuevoMsg.remitente_id === destinatarioActivoId && nuevoMsg.destinatario_id === usuarioActualId)
            ) {
                cargarHistorialChat(supabaseClient, usuarioActualId, destinatarioActivoId);
            }
        })
        .subscribe();
}

async function cargarHistorialChat(supabaseClient, miId, otroId) {
    const bandeja = document.getElementById('chatBandeja');
    if (!bandeja) return;

    bandeja.style.display = 'flex';
    bandeja.style.flexDirection = 'column'; 
    bandeja.style.gap = '1rem';
    bandeja.style.padding = '1.5rem';

    const { data: mensajes, error } = await supabaseClient
        .from('mensajes')
        .select('*')
        .or(`and(remitente_id.eq.${miId},destinatario_id.eq.${otroId}),and(remitente_id.eq.${otroId},destinatario_id.eq.${miId})`)
        .order('created_at', { ascending: true }); 

    if (error) {
        console.error("Error al cargar historial:", error.message);
        return;
    }

    bandeja.innerHTML = '';
    
    if (!mensajes || mensajes.length === 0) {
        bandeja.innerHTML = `
            <div class="msg-animado" style="margin: auto; text-align: center; color: #94a3b8; padding: 2rem;">
                <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">💬</span>
                <p style="font-size: 0.95rem; font-weight: 500;">¡Rompe el hielo! 👋</p>
                <p style="font-size: 0.8rem; margin-top: 0.3rem;">Comienza la conversación enviando un mensaje.</p>
            </div>
        `;
        return;
    }

    mensajes.forEach(msg => {
        const esDelSistema = !msg.remitente_id || msg.remitente_id === 'sistema' || msg.remitente_id === null;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-animado';
        wrapper.style.display = 'flex';
        wrapper.style.width = '100%';

        if (esDelSistema) {
            wrapper.style.justifyContent = 'center';
            const aviso = document.createElement('div');
            aviso.style.background = '#fef08a';
            aviso.style.color = '#713f12';
            aviso.style.padding = '0.5rem 1rem';
            aviso.style.borderRadius = '12px';
            aviso.style.fontSize = '0.85rem';
            aviso.style.textAlign = 'center';
            aviso.style.maxWidth = '90%';
            aviso.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            aviso.textContent = msg.contenido;
            wrapper.appendChild(aviso);
        } else {
            const esMio = msg.remitente_id === miId;
            wrapper.style.justifyContent = esMio ? 'flex-end' : 'flex-start';

            const burbuja = document.createElement('div');
            burbuja.style.maxWidth = '75%';
            burbuja.style.padding = '0.8rem 1.2rem';
            burbuja.style.fontSize = '0.95rem';
            burbuja.style.lineHeight = '1.4';
            burbuja.style.wordBreak = 'break-word';
            burbuja.style.boxShadow = '0 2px 5px rgba(0,0,0,0.06)';

            if (esMio) {
                burbuja.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                burbuja.style.color = '#ffffff'; 
                burbuja.style.borderRadius = '18px 18px 4px 18px'; 
            } else {
                burbuja.style.background = '#ffffff';
                burbuja.style.color = '#1e293b';
                burbuja.style.border = '1px solid #e2e8f0';
                burbuja.style.borderRadius = '18px 18px 18px 4px';
            }

            const textoP = document.createElement('div');
            textoP.textContent = msg.contenido;
            burbuja.appendChild(textoP);

            const timestamp = msg.created_at || msg.creado_at;
            if (timestamp) {
                const horaSpan = document.createElement('span');
                const fechaObj = new Date(timestamp);
                const horaFormateada = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                horaSpan.textContent = horaFormateada;
                horaSpan.style.display = 'block';
                horaSpan.style.fontSize = '0.7rem';
                horaSpan.style.marginTop = '0.4rem';
                horaSpan.style.textAlign = 'right';
                horaSpan.style.opacity = '0.8';
                horaSpan.style.color = esMio ? '#bfdbfe' : '#94a3b8';
                
                burbuja.appendChild(horaSpan);
            }

            wrapper.appendChild(burbuja);
        }

        bandeja.appendChild(wrapper);
    });

    setTimeout(() => {
        bandeja.scrollTo({
            top: bandeja.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

/* ============================================================
   INTEGRACIÓN MERCADOPAGO
   ============================================================ */
window.pagarTutoria = async function(reservaId, materia, precio) {
    const btn = document.getElementById(`btn-pagar-${reservaId}`);
    if(btn) {
        btn.textContent = "Generando pago...";
        btn.disabled = true;
    }

    try {
        mostrarNotificacionEstudiante("Generando link de pago seguro...", "exito");
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        const { data, error } = await supabaseClient.functions.invoke('crear-pago-mp', {
            body: {
                reservaId: reservaId,
                titulo: materia,
                precio: precio || 3000, 
                emailEstudiante: session.user.email
            }
        });

        if (error) throw error;

        if (data && data.urlPago) {
            window.location.href = data.urlPago;
        } else {
            throw new Error("No se recibió la URL de pago.");
        }

    } catch (err) {
        console.error("Error al generar pago:", err);
        mostrarNotificacionEstudiante("No se pudo generar el link de pago.", "error");
        if(btn) {
            btn.textContent = `💳 Pagar Tutoría ($${precio})`;
            btn.disabled = false;
        }
    }
};