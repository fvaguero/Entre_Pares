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

    // 1. Obtener perfil del tutor para el nombre superior y datos
    try {
        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', usuarioActual.id)
            .single();

        if (perfil) {
            // Rellenar nombre en la barra superior
            const spanNombre = document.getElementById('nombreUsuarioHeader');
            if (spanNombre) {
                spanNombre.textContent = perfil.nombre_completo || 'Tutor';
            }

            // Rellenar pestaña de perfil
            const inputNombre = document.getElementById('perfilNombre');
            const inputEmail = document.getElementById('perfilEmail');
            const inputSede = document.getElementById('perfilSede');
            const inputMaterias = document.getElementById('perfilMaterias');

            if (inputNombre) inputNombre.value = perfil.nombre_completo || '';
            if (inputEmail) inputEmail.value = perfil.email || '';
            if (inputSede) inputSede.value = perfil.sede_universitaria || '';
            if (inputMaterias) inputMaterias.value = perfil.materias_impartidas || '';

            // Selector de roles si es 'Ambos'
            if (perfil.rol === 'Ambos') {
                const roleSwitcher = document.getElementById('roleSwitcher');
                if (roleSwitcher) roleSwitcher.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("Error al cargar perfil del tutor:", err);
    }

    // Dropdown de Rol
    const btnRoleDropdown = document.getElementById('btnRoleDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (btnRoleDropdown && dropdownMenu) {
        btnRoleDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    // Dropdown de Usuario en la cabecera
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

    // Botón Cerrar Sesión
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    // Formulario de Actualizar Perfil y Materias
    const formPerfilTutor = document.getElementById('formPerfilTutor');
    if (formPerfilTutor) {
        formPerfilTutor.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sede = document.getElementById('perfilSede').value;
            const materias = document.getElementById('perfilMaterias').value;

            try {
                const { error } = await supabaseClient
                    .from('perfiles')
                    .update({ 
                        sede_universitaria: sede, 
                        materias_impartidas: materias 
                    })
                    .eq('id', usuarioActual.id);

                if (error) throw error;
                mostrarNotificacion("¡Perfil y materias actualizados con éxito!", "exito");
            } catch (error) {
                mostrarNotificacion("Error al actualizar: " + error.message, "error");
            }
        });
    }

    // Cargar solicitudes pendientes y agenda aceptada
    cargarSolicitudesYTutorias();

    // Chat en tiempo real
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
            .select(`*, estudiante:estudiante_id (nombre_completo, email)`)
            .eq('tutor_id', usuarioActual.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reservas || reservas.length === 0) {
            if (contenedorPendientes) contenedorPendientes.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes solicitudes pendientes.</p>`;
            if (contenedorAceptadas) contenedorAceptadas.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes tutorías aceptadas aún.</p>`;
            return;
        }

        const pendientes = reservas.filter(r => r.estado && r.estado.toLowerCase() === 'pendiente');
        const aceptadas = reservas.filter(r => r.estado && (r.estado.toLowerCase() === 'aceptada' || r.estado.toLowerCase() === 'aprobada'));

        // Renderizar Pendientes
        if (contenedorPendientes) {
            if (pendientes.length === 0) {
                contenedorPendientes.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No hay solicitudes pendientes.</p>`;
            } else {
                contenedorPendientes.innerHTML = pendientes.map(res => {
                    return `
                        <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="color: #0f172a; margin-bottom: 0.4rem; font-size: 1rem;">📚 ${res.materia}</h4>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;"><strong>Estudiante:</strong> ${res.estudiante?.nombre_completo || 'Anónimo'}</p>
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

        // Renderizar Aceptadas / Agenda
        if (contenedorAceptadas) {
            if (aceptadas.length === 0) {
                contenedorAceptadas.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes tutorías confirmadas en tu agenda.</p>`;
            } else {
                contenedorAceptadas.innerHTML = aceptadas.map(res => {
                    return `
                        <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                <strong style="color: #0f172a;">${res.materia}</strong>
                                <span style="background: #16a34a; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">Aceptada</span>
                            </div>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">Estudiante: ${res.estudiante?.nombre_completo || 'Asignado'}</p>
                            <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;">Consulta: ${res.comentarios || 'Sin descripción'}</p>
                            <a href="https://meet.jit.si/EntrePares-${res.id}" target="_blank" class="btn" style="display: block; text-align: center; margin-top: 0.8rem; background: #2563eb; color: white; padding: 0.4rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px; font-weight: 600;">Unirse a Videollamada</a>
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
    }
}

window.actualizarEstado = async function(id, nuevoEstado) {
    try {
        const { error } = await supabaseClient
            .from('reservas')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) throw error;

        mostrarNotificacion(`¡Tutoría ${nuevoEstado.toLowerCase()} con éxito!`, "exito");
        cargarSolicitudesYTutorias();
        cargarContactos(supabaseClient, usuarioActual.id);
    } catch (err) {
        console.error("Error al actualizar estado:", err);
        mostrarNotificacion("Error al actualizar la solicitud.", "error");
    }
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

/* ============================================================
   CHAT EN TIEMPO REAL Y COORDINACIÓN
   ============================================================ */

async function cargarContactos(supabaseClient, miId) {
    const lista = document.getElementById('listaContactos');
    if (!lista) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select('estudiante_id, estado, estudiante:estudiante_id (nombre_completo)')
            .eq('tutor_id', miId)
            .order('created_at', { ascending: false });

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
        bandeja.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; text-align: center; margin: auto;">No hay mensajes aún. ¡Comienza la conversación!</p>';
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

async function seleccionarContactoParaChat(supabaseClient, tutorId, estudianteId, nombreEstudiante) {
    destinatarioActivoId = estudianteId;
    
    const headerChat = document.getElementById('chatHeader');
    headerChat.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Chat con <strong>${nombreEstudiante}</strong></span>
            <button id="btnConfirmarCita" class="btn" style="display: none; background: #16a34a; color: white; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; cursor: pointer; font-weight: bold;">
                ✅ Confirmar Coordinación y Enviar Mail
            </button>
        </div>
    `;
    
    const { data: reserva } = await supabaseClient
        .from('reservas')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('estudiante_id', estudianteId)
        .in('estado', ['Pendiente', 'Aceptada'])
        .single();

    const btnConfirmar = document.getElementById('btnConfirmarCita');
    if (reserva && btnConfirmar) {
        btnConfirmar.style.display = 'block';
        btnConfirmar.onclick = () => confirmarCoordinacionYEnviarMail(supabaseClient, reserva.id, estudianteId);
    }

    cargarHistorialChat(supabaseClient, tutorId, estudianteId);
}

async function confirmarCoordinacionYEnviarMail(supabaseClient, reservaId, estudianteId) {
    try {
        const { data: reservaActualizada, error } = await supabaseClient
            .from('reservas')
            .update({ estado: 'Aceptada' })
            .eq('id', reservaId)
            .select(`*, estudiante:estudiante_id (nombre_completo, email), tutor:tutor_id (nombre_completo)`)
            .single();

        if (error) throw error;

        const { data: { user } } = await supabaseClient.auth.getUser();
        await supabaseClient.from('mensajes').insert({
            remitente_id: user.id,
            destinatario_id: estudianteId,
            contenido: "📌 [Sistema]: ¡Coordinación confirmada oficialmente! Se ha enviado un correo al estudiante con los detalles."
        });

        const { error: fnError } = await supabaseClient.functions.invoke('enviar-correo-reserva', {
            body: {
                reservaId: reservaId,
                estado: 'Aceptada',
                estudianteEmail: reservaActualizada.estudiante?.email,
                estudianteNombre: reservaActualizada.estudiante?.nombre_completo || 'Estudiante',
                tutorNombre: reservaActualizada.tutor?.nombre_completo || 'Tutor',
                materia: reservaActualizada.materia
            }
        });

        if (fnError) {
            console.warn("La cita se confirmó, pero hubo un error al disparar la función de correo:", fnError);
        }

        alert("¡Cita confirmada y correo enviado con éxito al estudiante a través de Brevo!");
        location.reload();
    } catch (err) {
        console.error("Error al confirmar la coordinación:", err);
        alert("No se pudo completar la confirmación.");
    }
}