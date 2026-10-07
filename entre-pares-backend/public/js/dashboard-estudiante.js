let destinatarioActivoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = "https://uecwotydamsjstpovbzz.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2";
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            const inputEmail = document.getElementById('perfilEmail');
            const inputCarrera = document.getElementById('perfilCarrera');
            const inputSede = document.getElementById('perfilSede');
            const spanPuntos = document.getElementById('puntosGamificacion');

            if (inputNombre) inputNombre.value = perfil.nombre_completo || '';
            if (inputEmail) inputEmail.value = perfil.email || '';
            if (inputCarrera) inputCarrera.value = perfil.carrera || '';
            if (inputSede) inputSede.value = perfil.sede_universitaria || '';
            if (spanPuntos) spanPuntos.textContent = `${perfil.puntos_gamificacion || 0} pts`;

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

    // 2. Inicializar Mapa (Leaflet)
    const mapa = L.map('mapa').setView([-28.4696, -65.7852], 13);
    window.mapaLeaflet = mapa; 
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);

    setTimeout(() => {
        mapa.invalidateSize();
    }, 250);

    // Cargar datos iniciales y activar Realtime
    cargarTutoresEnMapa(supabaseClient, mapa);
    cargarMisReservas(supabaseClient, userId);
    inicializarChat(supabaseClient, userId);
    cargarContactos(supabaseClient, userId);
    inicializarNotificacionesReservas(supabaseClient, userId);

    // 3. Botón de Filtros
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
            const carrera = document.getElementById('perfilCarrera').value;
            const sede = document.getElementById('perfilSede').value;

            const { error } = await supabaseClient
                .from('perfiles')
                .update({ carrera, sede_universitaria: sede })
                .eq('id', userId);

            if (!error) {
                mostrarNotificacionEstudiante("¡Perfil actualizado con éxito!", "exito");
            } else {
                mostrarNotificacionEstudiante("Error al actualizar el perfil.", "error");
            }
        });
    }

    // 5. Botón Cerrar Sesión
    document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

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

    // Modal
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

                if (insertError) {
                    throw insertError;
                }

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
                // Guardar reseña en tabla resenas
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

                // Marcar reserva como Finalizada
                await supabaseClient
                    .from('reservas')
                    .update({ estado: 'Finalizada' })
                    .eq('id', reservaId);

                document.getElementById('modalResena').style.display = 'none';
                mostrarNotificacionEstudiante("¡Gracias por calificar al tutor!", "exito");
                
                cargarMisReservas(supabaseClient, userId);
                setTimeout(() => cargarTutoresEnMapa(supabaseClient, mapa), 1000);

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
   MAPA Y RESERVAS
   ============================================================ */
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

        if (!tutores || tutores.length === 0) {
            if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron tutores disponibles.</p>';
            return;
        }

        if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '';

        tutores.forEach((tutor, index) => {
            if (filtroMateria && tutor.materias_impartidas) {
                if (!tutor.materias_impartidas.toLowerCase().includes(filtroMateria.toLowerCase())) {
                    return;
                }
            }

            const estrellasTexto = tutor.total_resenas > 0 
                ? `⭐ ${tutor.calificacion_promedio} (${tutor.total_resenas} reseñas)` 
                : `<span style="color: #94a3b8; font-size: 0.8rem;">⭐ Nuevo tutor</span>`;

            if (listaTutoresContenedor) {
                const card = document.createElement('div');
                card.className = "panel-card";
                card.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; font-size: 0.85rem; margin-bottom: 0.5rem;";
                card.innerHTML = `
                    <strong style="color: #0f172a; display: block; margin-bottom: 0.2rem;">${tutor.nombre_completo || 'Tutor Entre Pares'}</strong>
                    <p style="color: #ca8a04; font-weight: bold; margin: 0.1rem 0; font-size: 0.85rem;">${estrellasTexto}</p>
                    <p style="color: #475569; margin: 0.1rem 0;">Sede: ${tutor.sede_universitaria || 'Catamarca'}</p>
                    <p style="color: #475569; margin: 0.1rem 0;">Materias: ${tutor.materias_impartidas || 'Varias'}</p>
                    <p style="color: #16a34a; font-weight: bold; margin: 0.2rem 0;">Precio: $${tutor.precio_hora || 3000}</p>
                    <button onclick="abrirModalReserva('${tutor.id}', '${tutor.nombre_completo || 'Tutor'}')" class="btn btn-yellow" style="margin-top: 0.5rem; width: 100%; font-size: 0.75rem; padding: 0.4rem;">Solicitar Consulta</button>
                `;
                listaTutoresContenedor.appendChild(card);
            }

            const lat = tutor.latitud ? parseFloat(tutor.latitud) : -28.4696 + (index * 0.002);
            const lng = tutor.longitud ? parseFloat(tutor.longitud) : -65.7852 + (index * 0.002);

            const marker = L.marker([lat, lng]).addTo(mapa);
            marker.bindPopup(`
                <b>${tutor.nombre_completo || 'Tutor Entre Pares'}</b><br>
                ${estrellasTexto}<br>
                Sede: ${tutor.sede_universitaria || 'Catamarca'}<br>
                Materias: ${tutor.materias_impartidas || 'Varias'}<br>
                Precio: $${tutor.precio_hora || 3000}<br>
                <button onclick="abrirModalReserva('${tutor.id}', '${tutor.nombre_completo || 'Tutor'}')" style="margin-top: 6px; background: #eab308; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem;">Solicitar Consulta</button>
            `);
        });

        if (listaTutoresContenedor && listaTutoresContenedor.innerHTML === '') {
            listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No hay tutores que coincidan con la materia buscada.</p>';
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

            // Lógica para botones de acción
            let botonAccion = '';
            if (res.estado === 'Aceptada' || res.estado === 'aprobada') {
                if (res.estado_pago === 'Pendiente' || !res.estado_pago) {
                    const precio = res.precio || res.tutor?.precio_hora || 3000;
                    botonAccion = `<button id="btn-pagar-${res.id}" onclick="pagarTutoria('${res.id}', '${res.materia}', ${precio})" class="btn btn-yellow" style="width: 100%; display: block; text-align: center; margin-top: 0.8rem; padding: 0.5rem; font-size: 0.85rem; border-radius: 4px; border: none; font-weight: 600; cursor: pointer;">💳 Pagar Tutoría ($${precio})</button>`;
                } else {
                    botonAccion = `
                        <a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.8rem; background: #2563eb; color: white; padding: 0.5rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px; font-weight:600;">🎥 Unirse a Videollamada</a>
                        <button onclick="abrirModalResena('${res.id}', '${res.tutor_id}', '${res.tutor?.nombre_completo}')" class="btn" style="width: 100%; margin-top: 0.5rem; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; font-size: 0.8rem; font-weight: 600; padding: 0.5rem; border-radius: 4px; cursor: pointer;">⭐ Finalizar y Calificar</button>
                    `;
                }
            } else if (res.estado === 'Finalizada') {
                botonAccion = `<p style="color: #2563eb; font-weight: bold; text-align: center; margin-top: 0.8rem; font-size: 0.8rem;">✅ Tutoría Completada y Calificada</p>`;
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
   CHAT EN TIEMPO REAL (Supabase Realtime)
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
                document.getElementById('chatHeader').textContent = c.nombre;
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

    const { data: mensajes, error } = await supabaseClient
        .from('mensajes')
        .select('*')
        .or(`and(remitente_id.eq.${miId},destinatario_id.eq.${otroId}),and(remitente_id.eq.${otroId},destinatario_id.eq.${miId})`)
        .order('id', { ascending: true });

    if (error) {
        console.error("Error al cargar historial:", error.message);
        return;
    }

    bandeja.innerHTML = '';
    if (mensajes.length === 0) {
        bandeja.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; text-align: center; margin: auto;">No hay mensajes aún. ¡Comienza la conversación para coordinar el día y la hora!</p>';
        return;
    }

    mensajes.forEach(msg => {
        const esMio = msg.remitente_id === miId;
        const burbuja = document.createElement('div');
        
        burbuja.style.maxWidth = '75%';
        burbuja.style.padding = '0.7rem 1rem';
        burbuja.style.fontSize = '0.9rem';
        burbuja.style.marginBottom = '0.5rem';
        burbuja.style.alignSelf = esMio ? 'flex-end' : 'flex-start';
        
        if (esMio) {
            burbuja.style.background = 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)';
            burbuja.style.color = '#713f12';
            burbuja.style.borderRadius = '14px 14px 2px 14px';
            burbuja.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        } else {
            burbuja.style.background = '#f1f5f9';
            burbuja.style.color = '#1e293b';
            burbuja.style.borderRadius = '14px 14px 14px 2px';
        }

        burbuja.textContent = msg.contenido;
        bandeja.appendChild(burbuja);
    });

    bandeja.scrollTop = bandeja.scrollHeight;
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
        
        const supabaseClient = window.supabase.createClient("https://uecwotydamsjstpovbzz.supabase.co", "sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2");
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