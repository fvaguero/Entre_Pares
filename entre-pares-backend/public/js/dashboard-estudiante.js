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
            // Mostrar nombre en la barra superior
            const spanNombre = document.getElementById('nombreUsuarioHeader');
            if (spanNombre) {
                spanNombre.textContent = perfil.nombre_completo || 'Estudiante';
            }

            // Rellenar datos en la pestaña de Perfil
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

            // Control de roles
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
    window.mapaLeaflet = mapa; // Guardar referencia para redibujar al cambiar pestañas
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);

    setTimeout(() => {
        mapa.invalidateSize();
    }, 250);

    // Cargar tutores iniciales, reservas y chat
    cargarTutoresEnMapa(supabaseClient, mapa);
    cargarMisReservas(supabaseClient, userId);
    inicializarChat(supabaseClient, userId);
    cargarContactos(supabaseClient, userId);

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
                alert("¡Perfil actualizado con éxito!");
            } else {
                alert("Error al actualizar el perfil.");
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

    // 6. Enviar formulario de solicitud de consulta adaptado a la tabla 'reservas' (sin fecha ni hora obligatoria)
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
                        estado: 'Pendiente'
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
});

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
            // Si tienes un campo de verificación y ya lo configuraste, puedes descomentar la siguiente línea:
            // .eq('estado_verificacion', 'Aprobado');

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

            // 1. Renderizar la tarjeta en la lista izquierda
            if (listaTutoresContenedor) {
                const card = document.createElement('div');
                card.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; font-size: 0.85rem;";
                card.innerHTML = `
                    <strong style="color: #0f172a; display: block; margin-bottom: 0.2rem;">${tutor.nombre_completo || 'Tutor Entre Pares'}</strong>
                    <p style="color: #475569; margin: 0.1rem 0;">Sede: ${tutor.sede_universitaria || 'Catamarca'}</p>
                    <p style="color: #475569; margin: 0.1rem 0;">Materias: ${tutor.materias_impartidas || 'Varias'}</p>
                    <button onclick="abrirModalReserva('${tutor.id}', '${tutor.nombre_completo || 'Tutor'}')" class="btn btn-yellow" style="margin-top: 0.5rem; width: 100%; font-size: 0.75rem; padding: 0.3rem;">Solicitar Consulta</button>
                `;
                listaTutoresContenedor.appendChild(card);
            }

            // 2. Colocar marcador en el mapa de Leaflet
            const lat = tutor.latitud ? parseFloat(tutor.latitud) : -28.4696 + (index * 0.002);
            const lng = tutor.longitud ? parseFloat(tutor.longitud) : -65.7852 + (index * 0.002);

            const marker = L.marker([lat, lng]).addTo(mapa);
            marker.bindPopup(`
                <b>${tutor.nombre_completo || 'Tutor Entre Pares'}</b><br>
                Sede: ${tutor.sede_universitaria || 'Catamarca'}<br>
                Materias: ${tutor.materias_impartidas || 'Varias'}<br>
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
            .select(`*, tutor:tutor_id (nombre_completo, email)`)
            .eq('estudiante_id', estudianteId)
            .order('created_at', { ascending: false });

        if (error || !reservas || reservas.length === 0) {
            contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No tienes solicitudes de consulta aún.</p>`;
            return;
        }

        contenedor.innerHTML = '';
        reservas.forEach(res => {
            let badgeColor = '#eab308'; // Pendiente
            if (res.estado === 'Aceptada' || res.estado === 'aprobada') badgeColor = '#16a34a';
            if (res.estado === 'Rechazada' || res.estado === 'rechazada') badgeColor = '#dc2626';

            const card = document.createElement('div');
            card.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; font-size: 0.85rem;";
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <strong style="color: #0f172a;">${res.materia}</strong>
                    <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">${res.estado}</span>
                </div>
                <p style="color: #475569; margin: 0.2rem 0;">Tutor: ${res.tutor?.nombre_completo || 'Asignado'}</p>
                <p style="color: #475569; margin: 0.2rem 0;"><strong>Duda:</strong> ${res.comentarios || 'Sin descripción'}</p>
                ${(res.estado === 'Aceptada' || res.estado === 'aprobada') ? `<a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.5rem; background: #2563eb; color: white; padding: 0.4rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px;">Unirse a Videollamada</a>` : ''}
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

        // Solo mostrar contactos con los que tenga una reserva aprobada / aceptada
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
                alert("Selecciona un contacto primero.");
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
                alert("No se pudo enviar el mensaje.");
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
        .order('created_at', { ascending: true });

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
        burbuja.style.maxWidth = '70%';
        burbuja.style.padding = '0.6rem 0.9rem';
        burbuja.style.borderRadius = '10px';
        burbuja.style.fontSize = '0.9rem';
        burbuja.style.alignSelf = esMio ? 'flex-end' : 'flex-start';
        burbuja.style.backgroundColor = esMio ? '#fef08a' : '#f1f5f9';
        burbuja.style.color = esMio ? '#713f12' : '#1e293b';
        burbuja.textContent = msg.contenido;
        bandeja.appendChild(burbuja);
    });

    bandeja.scrollTop = bandeja.scrollHeight;
}   