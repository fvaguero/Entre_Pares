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

    // Cargar tutores iniciales y reservas
    cargarTutoresEnMapa(supabaseClient, mapa);
    cargarMisReservas(supabaseClient, userId);

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

    // 6. Enviar formulario de reserva adaptado a la tabla 'reservas'
    const formReserva = document.getElementById('formReservaTutoria');
    if (formReserva) {
        formReserva.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tutorId = document.getElementById('tutorIdModal').value;
            const materia = document.getElementById('materiaReserva').value;
            const fecha = document.getElementById('fechaReserva').value;
            const hora = document.getElementById('horaReserva').value;
            const comentarios = document.getElementById('comentariosReserva').value;
            const mensajeEstado = document.getElementById('mensajeReserva');

            try {
                const { error: insertError } = await supabaseClient
                    .from('reservas')
                    .insert([{
                        estudiante_id: userId,
                        tutor_id: tutorId,
                        materia: materia,
                        fecha_hora: `${fecha}T${hora}:00-03:00`,
                        comentarios: comentarios,
                        estado: 'Pendiente'
                    }]);

                if (insertError) {
                    throw insertError;
                }

                mensajeEstado.style.color = '#16a34a';
                mensajeEstado.textContent = "¡Tutoría reservada con éxito!";
                setTimeout(() => {
                    modalReserva.style.display = 'none';
                    e.target.reset();
                    mensajeEstado.textContent = '';
                    cargarMisReservas(supabaseClient, userId);
                }, 2000);
            } catch (error) {
                console.error("Error al reservar:", error);
                mensajeEstado.style.color = '#dc2626';
                mensajeEstado.textContent = "Error: " + (error.message || "No se pudo completar la reserva.");
            }
        });
    }
});

async function cargarTutoresEnMapa(supabaseClient, mapa, filtroMateria = '', filtroCiudad = '') {
    try {
        let query = supabaseClient
            .from('perfiles')
            .select('*')
            .in('rol', ['Tutor', 'Ambos'])
            .eq('estado_verificacion', 'Aprobado');

        if (filtroCiudad) {
            query = query.ilike('sede_universitaria', `%${filtroCiudad}%`);
        }

        const { data: tutores, error } = await query;

        if (error) {
            console.error("Error al consultar tutores:", error);
            return;
        }

        if (tutores && tutores.length > 0) {
            tutores.forEach((tutor, index) => {
                if (filtroMateria && tutor.materias_impartidas) {
                    if (!tutor.materias_impartidas.toLowerCase().includes(filtroMateria.toLowerCase())) {
                        return;
                    }
                }

                const lat = tutor.latitud ? parseFloat(tutor.latitud) : -28.4696 + (index * 0.002);
                const lng = tutor.longitud ? parseFloat(tutor.longitud) : -65.7852 + (index * 0.002);

                const marker = L.marker([lat, lng]).addTo(mapa);
                marker.bindPopup(`
                    <b>${tutor.nombre_completo || 'Tutor Entre Pares'}</b><br>
                    Sede: ${tutor.sede_universitaria || 'Catamarca'}<br>
                    Materias: ${tutor.materias_impartidas || 'Varias'}<br>
                    <button onclick="abrirModalReserva('${tutor.id}', '${tutor.nombre_completo || 'Tutor'}')" style="margin-top: 6px; background: #eab308; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem;">Reservar</button>
                `);
            });
        }
    } catch (err) {
        console.error("Error al cargar mapa:", err);
    }
}

async function cargarMisReservas(supabaseClient, estudianteId) {
    const contenedor = document.getElementById('listaMisReservas');
    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`*, tutor:tutor_id (nombre_completo, email)`)
            .eq('estudiante_id', estudianteId)
            .order('fecha_hora', { ascending: false });

        if (error || !reservas || reservas.length === 0) {
            contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No tienes tutorías solicitadas aún.</p>`;
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
                <p style="color: #475569; margin: 0.2rem 0;">Fecha: ${new Date(res.fecha_hora).toLocaleString()}</p>
                ${(res.estado === 'Aceptada' || res.estado === 'aprobada') ? `<a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.5rem; background: #2563eb; color: white; padding: 0.4rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px;">Unirse a Videollamada</a>` : ''}
            `;
            contenedor.appendChild(card);
        });
    } catch (err) {
        console.error("Error al cargar reservas:", err);
        contenedor.innerHTML = `<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">Error al cargar reservas.</p>`;
    }
}

window.abrirModalReserva = function(tutorId, tutorNombre) {
    document.getElementById('tutorIdModal').value = tutorId;
    document.getElementById('tutorNombreModal').textContent = `Coordiná tu encuentro con ${tutorNombre}`;
    document.getElementById('modalReserva').style.display = 'flex';
};