const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let destinatarioActivoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }
    usuarioActual = user;

    try {
        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', usuarioActual.id)
            .single();

        if (perfil) {
            const spanNombre = document.getElementById('nombreUsuarioHeader');
            if (spanNombre) {
                spanNombre.textContent = perfil.nombre_completo || 'Tutor';
            }

            const inputNombre = document.getElementById('perfilNombre');
            const inputEmail = document.getElementById('perfilEmail');
            const inputSede = document.getElementById('perfilSede');
            const inputMaterias = document.getElementById('perfilMaterias');
            const inputPrecio = document.getElementById('perfilPrecio');
            const inputCbu = document.getElementById('perfilCbuTutor');

            if (inputNombre) inputNombre.value = perfil.nombre_completo || '';
            if (inputEmail) inputEmail.value = perfil.email || '';
            if (inputSede) inputSede.value = perfil.sede_universitaria || '';
            if (inputMaterias) inputMaterias.value = perfil.materias_impartidas || '';
            if (inputPrecio) inputPrecio.value = perfil.precio_hora || '';
            if (inputCbu) inputCbu.value = perfil.cbu || '';

            if (perfil.rol === 'Ambos') {
                const roleSwitcher = document.getElementById('roleSwitcher');
                if (roleSwitcher) roleSwitcher.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("Error al cargar perfil del tutor:", err);
    }

    const btnRoleDropdown = document.getElementById('btnRoleDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (btnRoleDropdown && dropdownMenu) {
        btnRoleDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    const btnUserDropdown = document.getElementById('btnUserDropdown');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    if (btnUserDropdown && userDropdownMenu) {
        btnUserDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.style.display = userDropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    window.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        if (userDropdownMenu) userDropdownMenu.style.display = 'none';
    });

   const btnCerrarSesion = document.getElementById('btnCerrarSesion');
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
        const result = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: "¿Estás seguro que deseas salir de tu cuenta?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626', // Rojo para salir
            cancelButtonColor: '#64748b', // Gris para cancelar
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

    const formPerfilTutor = document.getElementById('formPerfilTutor');
    if (formPerfilTutor) {
        formPerfilTutor.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('perfilNombre').value;
            const sede = document.getElementById('perfilSede').value;
            const materias = document.getElementById('perfilMaterias').value;
            const precio = document.getElementById('perfilPrecio') ? document.getElementById('perfilPrecio').value : null;
            const cbu = document.getElementById('perfilCbuTutor') ? document.getElementById('perfilCbuTutor').value.trim() : null;

            try {
                const { error } = await supabaseClient
                    .from('perfiles')
                    .update({ 
                        nombre_completo: nombre,
                        sede_universitaria: sede, 
                        materias_impartidas: materias,
                        precio_hora: precio,
                        cbu: cbu
                    })
                    .eq('id', usuarioActual.id);

                if (error) throw error;
                
                document.getElementById('nombreUsuarioHeader').textContent = nombre;
                mostrarNotificacion("¡Perfil y datos bancarios actualizados con éxito!", "exito");
            } catch (error) {
                mostrarNotificacion("Error al actualizar: " + error.message, "error");
            }
        });
    }

    // Manejar envío del formulario de reseña del tutor al estudiante
    const formResenaTutor = document.getElementById('formResenaTutor');
    if (formResenaTutor) {
        formResenaTutor.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reservaId = document.getElementById('reservaIdResenaTutor').value;
            const estudianteId = document.getElementById('estudianteIdResenaTutor').value;
            const calificacion = parseInt(document.getElementById('estrellasResenaTutor').value);
            const comentario = document.getElementById('comentarioResenaTutor').value;

            try {
                const { error: errorResena } = await supabaseClient
                    .from('resenas')
                    .insert([{
                        reserva_id: reservaId,
                        tutor_id: usuarioActual.id,
                        estudiante_id: estudianteId,
                        calificacion: calificacion,
                        comentario: comentario,
                        calificado_por: 'tutor'
                    }]);

                if (errorResena) throw errorResena;

                document.getElementById('modalResenaTutor').style.display = 'none';
                mostrarNotificacion("¡Calificación enviada al estudiante con éxito!", "exito");
                e.target.reset();
            } catch (err) {
                console.error("Error al guardar reseña del tutor:", err);
                mostrarNotificacion("No se pudo guardar la calificación.", "error");
            }
        });
    }

    cargarSolicitudesYTutorias();
    cargarPanelPagosTutor();

    inicializarChat(supabaseClient, usuarioActual.id);
    cargarContactos(supabaseClient, usuarioActual.id);
});

async function cargarSolicitudesYTutorias() {
    const contenedorPendientes = document.getElementById('listaSolicitudesPendientes');
    const contenedorAceptadas = document.getElementById('listaTutoriasAceptadas');
    
    if (!usuarioActual) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`*, estudiante:estudiante_id (id, nombre_completo, email, carrera, sede_universitaria)`)
            .eq('tutor_id', usuarioActual.id)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!reservas || reservas.length === 0) {
            if (contenedorPendientes) contenedorPendientes.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes solicitudes pendientes.</p>`;
            if (contenedorAceptadas) contenedorAceptadas.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes tutorías aceptadas aún.</p>`;
            return;
        }

        const pendientes = reservas.filter(r => r.estado && r.estado.toLowerCase() === 'pendiente');
        const aceptadas = reservas.filter(r => r.estado && (r.estado.toLowerCase() === 'aceptada' || r.estado.toLowerCase() === 'aprobada' || r.estado.toLowerCase() === 'finalizada'));

        if (contenedorPendientes) {
            if (pendientes.length === 0) {
                contenedorPendientes.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No hay solicitudes pendientes.</p>`;
            } else {
                contenedorPendientes.innerHTML = pendientes.map(res => {
                    const nombreEst = res.estudiante?.nombre_completo || 'Anónimo';
                    const estId = res.estudiante?.id;

                    return `
                        <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="color: #0f172a; margin-bottom: 0.4rem; font-size: 1rem;">📚 ${res.materia}</h4>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">
                                <strong>Estudiante:</strong> 
                                <span onclick="verPerfilEstudiante('${estId}')" style="color: #2563eb; cursor: pointer; text-decoration: underline; font-weight: 600;">${nombreEst}</span>
                            </p>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.4rem 0;"><strong>Duda / Consulta:</strong> ${res.comentarios || 'Sin descripción'}</p>
                            
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button onclick="actualizarEstado('${res.id}', 'Aceptada')" class="btn" style="background: #16a34a; color: white; flex: 1; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Aceptar (Habilitar Chat)</button>
                                <button onclick="actualizarEstado('${res.id}', 'Rechazada')" class="btn" style="background: #dc2626; color: white; flex: 1; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Rechazar</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (contenedorAceptadas) {
            if (aceptadas.length === 0) {
                contenedorAceptadas.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes tutorías confirmadas en tu agenda.</p>`;
            } else {
                contenedorAceptadas.innerHTML = aceptadas.map(res => {
                    const esFinalizada = res.estado.toLowerCase() === 'finalizada';
                    let badgeColor = esFinalizada ? '#2563eb' : '#16a34a';
                    let estadoTexto = esFinalizada ? 'Finalizada' : 'Aceptada';
                    const nombreEst = res.estudiante?.nombre_completo || 'Asignado';
                    const estId = res.estudiante?.id;

                    let botonAccionTutor = '';
                    if (esFinalizada) {
                        botonAccionTutor = `
                            <button onclick="abrirModalResenaTutor('${res.id}', '${estId}', '${nombreEst}')" class="btn btn-yellow" style="width: 100%; margin-top: 0.8rem; font-size: 0.8rem; font-weight: 600; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                                ⭐ Calificar Estudiante
                            </button>
                        `;
                    } else {
                        botonAccionTutor = `
                            <a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.8rem; background: #2563eb; color: white; padding: 0.4rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px; font-weight: 600;">Unirse a Videollamada</a>
                            
                            <button onclick="marcarTutoriaFinalizada('${res.id}')" class="btn" style="width: 100%; margin-top: 0.5rem; background: #0f172a; color: white; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                                🏁 Marcar como Finalizada
                            </button>
                        `;
                    }

                    return `
                        <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                <strong style="color: #0f172a;">${res.materia}</strong>
                                <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">${estadoTexto}</span>
                            </div>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">
                                Estudiante: 
                                <span onclick="verPerfilEstudiante('${estId}')" style="color: #2563eb; cursor: pointer; text-decoration: underline; font-weight: 600;">${nombreEst}</span>
                            </p>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">Consulta: ${res.comentarios || 'Sin descripción'}</p>
                            
                            ${botonAccionTutor}
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
    }
}

// FUNCIONALIDAD PARA VER PERFIL PÚBLICO DEL ESTUDIANTE
window.verPerfilEstudiante = async function(estudianteId) {
    if (!estudianteId) return;

    const modal = document.getElementById('modalPerfilEstudiante');
    const lblNombre = document.getElementById('modalEstudianteNombre');
    const lblEmail = document.getElementById('modalEstudianteEmail');
    const lblCarrera = document.getElementById('modalEstudianteCarrera');
    const lblSede = document.getElementById('modalEstudianteSede');
    const contenedorResenas = document.getElementById('modalEstudianteListaResenas');

    modal.style.display = 'flex';
    lblNombre.textContent = "Cargando perfil...";
    lblEmail.textContent = "...";
    lblCarrera.textContent = "...";
    lblSede.textContent = "...";
    contenedorResenas.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">Cargando opiniones...</p>';

    try {
        const { data: estudiante, error: errEstudiante } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', estudianteId)
            .single();

        if (errEstudiante) throw errEstudiante;

        lblNombre.textContent = estudiante.nombre_completo || 'Estudiante';
        lblEmail.textContent = estudiante.email || 'No disponible';
        lblCarrera.textContent = estudiante.carrera || 'No especificada';
        lblSede.textContent = estudiante.sede_universitaria || 'Catamarca';

        // Buscar reseñas recibidas como estudiante
        const { data: resenas, error: errResenas } = await supabaseClient
            .from('resenas')
            .select(`*, tutor:tutor_id (nombre_completo)`)
            .eq('estudiante_id', estudianteId)
            .eq('calificado_por', 'tutor')
            .order('id', { ascending: false });

        if (errResenas) throw errResenas;

        if (!resenas || resenas.length === 0) {
            contenedorResenas.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">El estudiante aún no tiene valoraciones registradas.</p>';
            return;
        }

        contenedorResenas.innerHTML = resenas.map(r => {
            const estrellas = '⭐'.repeat(r.calificacion || 5);
            return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                        <strong style="color: #0f172a; font-size: 0.8rem;">Tutor: ${r.tutor?.nombre_completo || 'Par'}</strong>
                        <span style="color: #ca8a04; font-size: 0.75rem;">${estrellas}</span>
                    </div>
                    <p style="color: #475569; font-size: 0.75rem; margin: 0; font-style: italic;">"${r.comentario || 'Sin comentarios'}"</p>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar perfil del estudiante:", err);
        contenedorResenas.innerHTML = '<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">No se pudo cargar la información del estudiante.</p>';
    }
};

window.marcarTutoriaFinalizada = async function(reservaId) {
    try {
        const { error } = await supabaseClient
            .from('reservas')
            .update({ estado: 'Finalizada' })
            .eq('id', reservaId);

        if (error) throw error;

        mostrarNotificacion("¡Tutoría marcada como finalizada con éxito!", "exito");
        cargarSolicitudesYTutorias();
    } catch (err) {
        console.error("Error al finalizar tutoría:", err);
        mostrarNotificacion("No se pudo marcar como finalizada.", "error");
    }
};

window.abrirModalResenaTutor = function(reservaId, estudianteId, estudianteNombre) {
    document.getElementById('reservaIdResenaTutor').value = reservaId;
    document.getElementById('estudianteIdResenaTutor').value = estudianteId;
    document.getElementById('nombreEstudianteResena').textContent = estudianteNombre || 'el estudiante';
    document.getElementById('modalResenaTutor').style.display = 'flex';
};

function mostrarNotificacion(mensaje, tipo) {
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
    `;
    document.body.appendChild(alerta);
    setTimeout(() => { alerta.remove(); }, 3000);
}

async function cargarContactos(supabaseClient, miId) {
    const lista = document.getElementById('listaContactos');
    if (!lista) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select('estudiante_id, estado, estudiante:estudiante_id (nombre_completo)')
            .eq('tutor_id', miId)
            .order('id', { ascending: false });

        if (error) throw error;

        const vistos = new Set();
        const contactos = [];
        (reservas || []).forEach(r => {
            const rechazada = r.estado === 'Rechazada' || r.estado === 'rechazada';
            if (rechazada || vistos.has(r.estudiante_id)) return;
            vistos.add(r.estudiante_id);
            contactos.push({ id: r.estudiante_id, nombre: r.estudiante?.nombre_completo || 'Estudiante' });
        });

        if (contactos.length === 0) {
            lista.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; text-align: center; margin-top: 2rem;">No hay chats activos.</p>';
            return;
        }

        lista.innerHTML = '';
        contactos.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sidebar-btn contacto-chat';
            btn.dataset.id = c.id;
            btn.textContent = `👤 ${c.nombre}`;
            if (c.id === destinatarioActivoId) btn.classList.add('active');
            
            btn.addEventListener('click', () => {
                seleccionarContactoParaChat(supabaseClient, usuarioActual.id, c.id, c.nombre);
                document.querySelectorAll('.contacto-chat').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
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
                mostrarNotificacion("Selecciona un contacto primero.", "error");
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
                mostrarNotificacion("No se pudo enviar el mensaje.", "error");
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

    // Configurar estilos de la bandeja
    bandeja.style.display = 'flex';
    bandeja.style.flexDirection = 'column'; 
    bandeja.style.gap = '1rem';
    bandeja.style.padding = '1.5rem';

    // ORDENAR ESTRICTAMENTE POR created_at (cronológico real)
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
        // Detectar si el mensaje es del sistema/notificación o de un usuario
        const esDelSistema = !msg.remitente_id || msg.remitente_id === 'sistema' || msg.remitente_id === null;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-animado';
        wrapper.style.display = 'flex';
        wrapper.style.width = '100%';

        if (esDelSistema) {
            // Estilo especial para los avisos del sistema (centrados y estéticos)
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
            // Mensajes normales de chat entre usuarios
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

    // Scroll automático hacia abajo
    setTimeout(() => {
        bandeja.scrollTo({
            top: bandeja.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}
async function seleccionarContactoParaChat(supabaseClient, tutorId, estudianteId, nombreEstudiante) {
    destinatarioActivoId = estudianteId;
    
    const headerChat = document.getElementById('chatHeader');
    headerChat.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
            <span>Chat con <strong>${nombreEstudiante}</strong></span>
            <button id="btnConfirmarCita" class="btn" style="display: none; background: #16a34a; color: white; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; cursor: pointer; font-weight: bold;">
                ✅ Confirmar Cita y Enviar Mail
            </button>
        </div>
    `;
    
    const { data: reservas, error } = await supabaseClient
        .from('reservas')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('estudiante_id', estudianteId)
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al buscar reserva para el chat:", error);
    }

    const reservaActiva = reservas && reservas.length > 0 ? reservas[0] : null;

    const btnConfirmar = document.getElementById('btnConfirmarCita');
    if (reservaActiva && btnConfirmar) {
        btnConfirmar.style.display = 'block';
        btnConfirmar.onclick = () => confirmarCoordinacionYEnviarMail(supabaseClient, reservaActiva.id, estudianteId);
    }

    cargarHistorialChat(supabaseClient, tutorId, estudianteId);
}

window.actualizarEstado = async function(id, nuevoEstado) {
    try {
        const { data: reservaActualizada, error } = await supabaseClient
            .from('reservas')
            .update({ estado: nuevoEstado })
            .eq('id', id)
            .select(`*, estudiante:estudiante_id (nombre_completo, email), tutor:tutor_id (nombre_completo)`)
            .single();

        if (error) throw error;

        mostrarNotificacion(`¡Tutoría ${nuevoEstado.toLowerCase()} con éxito!`, "exito");

        if (nuevoEstado === 'Aceptada') {
            mostrarNotificacion("Notificando al estudiante por correo...", "exito");
            
            await supabaseClient.functions.invoke('enviar-correo-reserva', {
                body: {
                    reservaId: id,
                    tipoCorreo: 'chat_aceptado', 
                    estudianteEmail: reservaActualizada.estudiante?.email,
                    estudianteNombre: reservaActualizada.estudiante?.nombre_completo || 'Estudiante',
                    tutorNombre: reservaActualizada.tutor?.nombre_completo || 'Tutor',
                    materia: reservaActualizada.materia
                }
            });
        }

        cargarSolicitudesYTutorias();
        cargarContactos(supabaseClient, usuarioActual.id);
    } catch (err) {
        console.error("Error al actualizar estado:", err);
        mostrarNotificacion("Error al actualizar la solicitud.", "error");
    }
};

async function confirmarCoordinacionYEnviarMail(supabaseClient, reservaId, estudianteId) {
    try {
        const { data: reservaActualizada, error } = await supabaseClient
            .from('reservas')
            .select(`*, estudiante:estudiante_id (nombre_completo, email), tutor:tutor_id (nombre_completo)`)
            .eq('id', reservaId)
            .single();

        if (error) throw error;

        const { data: { user } } = await supabaseClient.auth.getUser();
        await supabaseClient.from('mensajes').insert({
            remitente_id: user.id,
            destinatario_id: estudianteId,
            contenido: "📌 [Sistema]: ¡Coordinación confirmada! Se ha enviado a tu correo el enlace oficial para la videollamada."
        });

        const { error: fnError } = await supabaseClient.functions.invoke('enviar-correo-reserva', {
            body: {
                reservaId: reservaId,
                tipoCorreo: 'cita_confirmada',
                estudianteEmail: reservaActualizada.estudiante?.email,
                estudianteNombre: reservaActualizada.estudiante?.nombre_completo || 'Estudiante',
                tutorNombre: reservaActualizada.tutor?.nombre_completo || 'Tutor',
                materia: reservaActualizada.materia
            }
        });

        if (fnError) console.warn("Error correo:", fnError);

        mostrarNotificacion("¡Enlace de videollamada enviado al estudiante!", "exito");

        const btnConfirmar = document.getElementById('btnConfirmarCita');
        if (btnConfirmar) btnConfirmar.style.display = 'none';

    } catch (err) {
        console.error("Error al confirmar la coordinación:", err);
        mostrarNotificacion("No se pudo enviar el correo de confirmación.", "error");
    }
}

async function cargarPanelPagosTutor() {
    const tbody = document.getElementById('tabla-pagos-tutor');
    if (!tbody || !usuarioActual) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`
                id,
                materia,
                precio,
                estado_pago,
                creado_at,
                estudiante:estudiante_id (nombre_completo)
            `)
            .eq('tutor_id', usuarioActual.id)
            .order('id', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!reservas || reservas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #64748b;">No tienes registros de pagos todavía.</td></tr>`;
            return;
        }

        reservas.forEach(reserva => {
            let estado = reserva.estado_pago || 'Pendiente';
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';

            if (estado === 'Pagado') {
                badgeBg = '#fef08a';
                badgeColor = '#713f12';
            } else if (estado === 'Completada') {
                badgeBg = '#e0f2fe';
                badgeColor = '#0369a1';
            } else if (estado === 'Liquidado') {
                badgeBg = '#dcfce7';
                badgeColor = '#166534';
            }

            const fechaFormateada = reserva.creado_at ? new Date(reserva.creado_at).toLocaleDateString() : 'Fecha no disp.';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="padding: 0.8rem; color: #1e293b; font-weight: 500;">${reserva.estudiante?.nombre_completo || 'Estudiante'}</td>
                <td style="padding: 0.8rem; color: #475569;">${reserva.materia || 'Tutoría'}</td>
                <td style="padding: 0.8rem; color: #1e293b; font-weight: 600;">$${reserva.precio || 0} ARS</td>
                <td style="padding: 0.8rem;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                        ${estado}
                    </span>
                </td>
                <td style="padding: 0.8rem; color: #64748b; font-size: 0.85rem;">${fechaFormateada}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error al cargar los pagos del tutor:", err.message);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #dc2626;">Error al cargar los datos de pagos.</td></tr>`;
    }
}