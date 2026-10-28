// Gamificación: niveles, progreso y beneficios del usuario.
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
    const progreso = document.querySelector('[role="progressbar"][aria-label="Progreso al siguiente nivel"]');
    if (nombre) nombre.textContent = nivel.insignia + ' ' + nivel.nombre;
    if (!nivel.maximo) {
        if (barra) barra.style.width = '100%';
        if (progreso) progreso.setAttribute('aria-valuenow', '100');
        if (texto) texto.textContent = '¡Felicitaciones! Alcanzaste el nivel máximo con ' + total + ' puntos.';
        return;
    }
    const porcentaje = Math.max(0, Math.min(100, ((total - nivel.minimo + 1) / (nivel.maximo - nivel.minimo + 1)) * 100));
    if (barra) barra.style.width = porcentaje + '%';
    if (progreso) progreso.setAttribute('aria-valuenow', String(Math.round(porcentaje)));
    if (texto) texto.textContent = 'Tenés ' + total + ' puntos. Te faltan ' + (nivel.siguiente - total) + ' para el próximo nivel.';
}

const SUPABASE_URL = "https://uecwotydamsjstpovbzz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let destinatarioActivoId = null;
let reservaChatActivaId = null;
let reservaChatActivaFecha = null;

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
            .from('perfiles_privados')
            .select('*')
            .eq('id', userId)
            .single();

        if (perfilError || !perfil || !['Estudiante', 'Ambos'].includes(perfil.rol)) {
            alert('Esta sección requiere una cuenta de Estudiante o una cuenta dual.');
            window.location.href = 'index.html';
            return;
        }

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
            const puntosActuales = Number(perfil.puntos_gamificacion ?? 0);
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
    inicializarFiltrosYCalendarioReservas();
    cargarMisReservas(supabaseClient, userId);
    // Refrescar agenda y calendario cuando el tutor confirme una reprogramación.
    supabaseClient
        .channel('reservas-estudiante-' + userId)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'reservas',
            filter: 'estudiante_id=eq.' + userId
        }, () => cargarMisReservas(supabaseClient, userId))
        .subscribe();

    inicializarChat(supabaseClient, userId);
    cargarContactos(supabaseClient, userId);
    const buscarContactoChat = document.getElementById('buscarContactoChat');
    if (buscarContactoChat) buscarContactoChat.addEventListener('input', () => {
        const termino = buscarContactoChat.value.trim().toLowerCase();
        document.querySelectorAll('#listaContactos > *').forEach(el => { el.style.display = el.textContent.toLowerCase().includes(termino) ? '' : 'none'; });
    });
    inicializarNotificacionesReservas(supabaseClient, userId);
    inicializarPanelRecordatorios(userId);

    // 3. Botón de Filtros (Único momento en que se cargan los tutores)
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', () => {
            const materiaFiltro = document.getElementById('filtroMateria').value.trim();
            const ciudadFiltro = document.getElementById('filtroCiudad').value.trim();
            const valoracionMinima = document.getElementById('filtroValoracion')?.value || '';
            const precioMaximo = document.getElementById('filtroPrecioMaximo')?.value || '';
            const disponibilidad = document.getElementById('filtroDisponibilidad')?.value || '';
            cargarTutoresEnMapa(supabaseClient, mapa, materiaFiltro, ciudadFiltro, valoracionMinima, precioMaximo, disponibilidad);
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
            const materia = document.getElementById('materiaReserva').value.trim();
            const comentarios = document.getElementById('comentariosReserva').value.trim();
            const fechaInput = document.getElementById('fechaHoraReserva');
            const fechaHora = fechaInput && fechaInput.value ? new Date(fechaInput.value).toISOString() : null;
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
                        fecha_hora: null,
                        estado_programacion: 'Sin coordinar',
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
                // Evitar que una misma reserva reciba más de una calificación del estudiante.
                const { data: resenasExistentes, error: errorConsultaResena } = await supabaseClient
                    .from('resenas')
                    .select('reserva_id, calificado_por')
                    .eq('reserva_id', reservaId)
                    .eq('estudiante_id', userId);

                if (errorConsultaResena) throw errorConsultaResena;
                const yaCalificoEstudiante = (resenasExistentes || []).some(r => String(r.calificado_por || 'estudiante').toLowerCase() !== 'tutor');
                if (yaCalificoEstudiante) {
                    mostrarNotificacionEstudiante("Ya calificaste esta tutoría.", "error");
                    return;
                }

                const { error: errorResena } = await supabaseClient
                    .from('resenas')
                    .insert([{
                        reserva_id: reservaId,
                        tutor_id: tutorId,
                        estudiante_id: userId,
                        calificacion: calificacion,
                        comentario: comentario,
                        calificado_por: 'estudiante'
                    }]);

                if (errorResena) throw errorResena;


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


async function cargarEstadisticasPersonales() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const actividad = document.getElementById('listaActividadPersonal');
    if (actividad) actividad.textContent = 'Cargando actividad…';
    try {
        const [{ data: reservas, error: errReservas }, { data: recibidas, error: errRecibidas }, { data: escritas, error: errEscritas }, { data: perfil, error: errPerfil }] = await Promise.all([
            supabaseClient.from('reservas').select('id,materia,estado,fecha_hora,creado_at').eq('estudiante_id', user.id).order('creado_at', { ascending: false }).limit(100),
            supabaseClient.from('resenas').select('calificacion').eq('estudiante_id', user.id).eq('calificado_por', 'tutor').limit(100),
            supabaseClient.from('resenas').select('id,calificacion').eq('estudiante_id', user.id).neq('calificado_por', 'tutor').limit(100),
            supabaseClient.from('perfiles').select('puntos_gamificacion').eq('id', user.id).maybeSingle()
        ]);
        if (errReservas || errRecibidas || errEscritas || errPerfil) throw errReservas || errRecibidas || errEscritas || errPerfil;
        const completadas = (reservas || []).filter(x => String(x.estado || '').toLowerCase() === 'finalizada');
        const notas = (recibidas || []).map(x => Number(x.calificacion)).filter(x => x >= 1 && x <= 5);
        set('estadisticaTutoriasCompletadas', completadas.length);
        set('estadisticaPromedioResenas', notas.length ? (notas.reduce((a,b)=>a+b,0)/notas.length).toFixed(1) + ' / 5' : 'Sin notas');
        set('estadisticaPuntos', Number(perfil?.puntos_gamificacion || 0));
        set('estadisticaResenasEscritas', (escritas || []).length);
        const grafico=document.getElementById('graficoProgresoMensual');
        if(grafico){
            grafico.replaceChildren();
            const meses=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));return {key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('es-AR',{month:'short'})};});
            const conteos=meses.map(m=>({ ...m, total:completadas.filter(x=>{const d=new Date(x.fecha_hora||x.creado_at);return !Number.isNaN(d.getTime())&&d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')===m.key;}).length }));
            const max=Math.max(1,...conteos.map(x=>x.total));
            conteos.forEach(item=>{const col=document.createElement('div');col.style.cssText='min-width:52px;flex:1;display:flex;flex-direction:column;align-items:center;gap:.35rem;';
                const count=document.createElement('strong');count.textContent=String(item.total);count.style.cssText='font-size:.8rem;color:#334155;';
                const bar=document.createElement('div');bar.style.cssText='width:70%;min-height:4px;height:'+Math.max(4,item.total/max*90)+'px;background:#2563eb;border-radius:6px 6px 0 0;';
                const label=document.createElement('small');label.textContent=item.label;label.style.color='#64748b';col.append(count,bar,label);grafico.appendChild(col);
            });
        }
        if (actividad) {
            const recientes = [...(reservas || []).slice(0,6)].sort((a,b)=>new Date(b.creado_at || b.fecha_hora || 0)-new Date(a.creado_at || a.fecha_hora || 0));
            actividad.replaceChildren();
            if (!recientes.length) actividad.textContent = 'Todavía no hay actividad registrada.';
            recientes.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:.65rem;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;';
                const label = document.createElement('span');
                label.textContent = (item.materia || 'Tutoría') + ' · ' + (item.estado || 'Sin estado');
                const date = document.createElement('small');
                date.style.color = '#64748b';
                date.textContent = item.fecha_hora ? new Date(item.fecha_hora).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' }) : 'Fecha pendiente';
                row.append(label,date); actividad.appendChild(row);
            });
        }
    } catch (error) {
        console.error('No se pudieron cargar las estadísticas personales:', error);
        if (actividad) actividad.textContent = 'No se pudieron cargar las estadísticas. Verificá los permisos de lectura de reservas y reseñas.';
    }
}

/* Recordatorios persistentes de tutorías: se generan desde Supabase, no desde el navegador. */
async function inicializarPanelRecordatorios(usuarioId) {
    const boton = document.getElementById('btnCampanita');
    const dropdown = document.getElementById('dropdownNotificaciones');
    const lista = document.getElementById('listaNotificaciones');
    const badge = document.getElementById('badgeNoti');
    if (!boton || !dropdown || !lista) return;

    const cargar = async () => {
        const { data, error } = await supabaseClient
            .from('recordatorios_notificaciones')
            .select('id, titulo, mensaje, fecha_tutoria, creado_at, leida')
            .eq('usuario_id', usuarioId)
            .order('creado_at', { ascending: false })
            .limit(10);
        if (error) {
            console.error('No se pudieron cargar los recordatorios:', error);
            lista.textContent = 'No se pudieron cargar las notificaciones.';
            return;
        }
        const avisos = data || [];
        const noLeidas = avisos.filter(a => !a.leida).length;
        if (badge) {
            badge.textContent = String(noLeidas);
            badge.style.display = noLeidas ? 'inline-block' : 'none';
        }
        lista.replaceChildren();
        if (!avisos.length) {
            const vacio = document.createElement('p');
            vacio.textContent = 'No tenés recordatorios de tutorías por ahora.';
            vacio.style.cssText = 'text-align:center;color:#94a3b8;padding:10px;';
            lista.appendChild(vacio);
            return;
        }
        avisos.forEach(aviso => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px;border-bottom:1px solid #e2e8f0;' + (!aviso.leida ? 'background:#fffbeb;' : '');
            const titulo = document.createElement('strong');
            titulo.textContent = aviso.titulo || 'Recordatorio de tutoría';
            titulo.style.display = 'block';
            const mensaje = document.createElement('p');
            mensaje.textContent = aviso.mensaje || '';
            mensaje.style.cssText = 'margin:4px 0;color:#475569;';
            const fecha = document.createElement('small');
            fecha.textContent = aviso.fecha_tutoria
                ? 'Tutoría: ' + new Date(aviso.fecha_tutoria).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
                : '';
            fecha.style.color = '#64748b';
            item.append(titulo, mensaje, fecha);
            lista.appendChild(item);
        });
        if (dropdown.style.display === 'block' && noLeidas) {
            const ids = avisos.filter(a => !a.leida).map(a => a.id);
            if (ids.length) {
                const { error: errorLectura } = await supabaseClient
                    .from('recordatorios_notificaciones')
                    .update({ leida: true })
                    .in('id', ids);
                if (!errorLectura && badge) {
                    badge.textContent = '0';
                    badge.style.display = 'none';
                }
            }
        }
    };

    boton.addEventListener('click', async (evento) => {
        evento.stopPropagation();
        const abrir = dropdown.style.display !== 'block';
        dropdown.style.display = abrir ? 'block' : 'none';
        await cargar();
    });
    dropdown.addEventListener('click', evento => evento.stopPropagation());
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });
    await cargar();
}


/* ============================================================
   MAPA Y RESERVAS (FILTRADO BAJO DEMANDA)
   ============================================================ */
let marcadoresActuales = [];

function limpiarMarcadoresDelMapa(mapa) {
    marcadoresActuales.forEach(m => mapa.removeLayer(m));
    marcadoresActuales = [];
}

async function cargarTutoresEnMapa(supabaseClient, mapa, filtroMateria = '', filtroCiudad = '', valoracionMinima = '', precioMaximo = '', disponibilidad = '') {
    const listaTutoresContenedor = document.getElementById('listaTutoresFiltrados');
    if (listaTutoresContenedor) {
        listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">Buscando tutores...</p>';
    }

    try {
        let query = supabaseClient
            .from('perfiles_publicos')
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

        const { data: resenasPublicas, error: errorResenasPublicas } = await supabaseClient
            .from('resenas').select('tutor_id, calificacion, calificado_por');
        if (errorResenasPublicas) console.warn('No se pudieron calcular los promedios de reseñas:', errorResenasPublicas.message);
        const resumenResenas = new Map();
        (resenasPublicas || []).forEach(resena => {
            if (!resena.tutor_id || (resena.calificado_por && String(resena.calificado_por).toLowerCase() !== 'estudiante')) return;
            const actual = resumenResenas.get(String(resena.tutor_id)) || { suma: 0, cantidad: 0 };
            const nota = Number(resena.calificacion);
            if (nota >= 1 && nota <= 5) { actual.suma += nota; actual.cantidad += 1; resumenResenas.set(String(resena.tutor_id), actual); }
        });
        (tutores || []).forEach(tutor => {
            const resumen = resumenResenas.get(String(tutor.id));
            if (resumen?.cantidad) {
                tutor.total_resenas = resumen.cantidad;
                tutor.calificacion_promedio = Number((resumen.suma / resumen.cantidad).toFixed(1));
            }
        });

        limpiarMarcadoresDelMapa(mapa);

        let tutoresOcupados = new Set();
        if (disponibilidad) {
            const fechaConsulta = new Date(disponibilidad);
            if (Number.isNaN(fechaConsulta.getTime()) || fechaConsulta <= new Date()) {
                if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '<p style="color:#b91c1c;text-align:center;">Elegí una fecha y hora futura para comprobar disponibilidad.</p>';
                return;
            }
            const desde = new Date(fechaConsulta.getTime() - 60 * 60 * 1000).toISOString();
            const hasta = new Date(fechaConsulta.getTime() + 60 * 60 * 1000).toISOString();
            const { data: reservasOcupadas, error: errorOcupadas } = await supabaseClient
                .from('horarios_tutores_publicos').select('tutor_id, fecha_hora, estado')
                .gte('fecha_hora', desde).lte('fecha_hora', hasta);
            if (errorOcupadas) throw errorOcupadas;
            (reservasOcupadas || []).forEach(reserva => {
                if (['aceptada','aprobada','confirmada'].includes(String(reserva.estado || '').toLowerCase()) && reserva.tutor_id) tutoresOcupados.add(String(reserva.tutor_id));
            });
        }

        if (!tutores || tutores.length === 0) {
            if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron tutores disponibles.</p>';
            return;
        }

        if (listaTutoresContenedor) listaTutoresContenedor.innerHTML = '';

        let tutoresMostrados = 0;

        tutores.forEach((tutor, index) => {
            if (filtroMateria && !String(tutor.materias_impartidas || '').toLowerCase().includes(filtroMateria.toLowerCase())) return;
            if (valoracionMinima && Number(tutor.calificacion_promedio || 0) < Number(valoracionMinima)) return;
            if (precioMaximo !== '' && Number(tutor.precio_hora || 3000) > Number(precioMaximo)) return;
            if (disponibilidad && tutoresOcupados.has(String(tutor.id))) return;

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

let reservasEstudianteCache = [];
let resenasEstudiantePorReserva = new Set();
let fechaMesCalendario = new Date();
let fechaSeleccionadaCalendario = null;

function estadoReservaNormalizado(estado) {
    const e = String(estado || '').trim().toLowerCase();
    if (['aceptada','aprobada','confirmada','confirmado'].includes(e)) return 'Aceptada';
    if (['rechazada','rechazado'].includes(e)) return 'Rechazada';
    if (['finalizada','finalizado'].includes(e)) return 'Finalizada';
    if (['cancelada','cancelado'].includes(e)) return 'Cancelada';
    return 'Pendiente';
}
function fechaClaveLocal(fecha) {
    return fecha.getFullYear()+'-'+String(fecha.getMonth()+1).padStart(2,'0')+'-'+String(fecha.getDate()).padStart(2,'0');
}
function mostrarFechaReserva(valor) {
    if (!valor) return 'Fecha y hora a coordinar';
    const f = new Date(valor);
    return Number.isNaN(f.getTime()) ? 'Fecha y hora a coordinar' : f.toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'});
}
function reservasFiltradas() {
    const materia=(document.getElementById('filtroMateriaReservas')?.value||'').toLowerCase();
    const estado=document.getElementById('filtroEstadoReservas')?.value||'';
    return reservasEstudianteCache.filter(r=>
        (!materia || String(r.materia||'').trim().toLowerCase()===materia) &&
        (!estado || estadoReservaNormalizado(r.estado)===estado)
    );
}
function actualizarFiltroMaterias() {
    const select=document.getElementById('filtroMateriaReservas');
    if(!select)return;
    const anterior=select.value;
    const materias=[...new Set(reservasEstudianteCache.map(r=>String(r.materia||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="">Todas las materias</option>';
    materias.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;select.appendChild(o);});
    if(materias.includes(anterior))select.value=anterior;
}
function inicializarFiltrosYCalendarioReservas() {
    ['filtroMateriaReservas','filtroEstadoReservas'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{renderizarReservasEstudiante();renderizarCalendarioReservas();}));
    document.getElementById('btnLimpiarFiltrosReservas')?.addEventListener('click',()=>{
        document.getElementById('filtroMateriaReservas').value='';
        document.getElementById('filtroEstadoReservas').value='';
        fechaSeleccionadaCalendario=null;
        renderizarReservasEstudiante();renderizarCalendarioReservas();
    });
    document.getElementById('btnMesAnterior')?.addEventListener('click',()=>{fechaMesCalendario=new Date(fechaMesCalendario.getFullYear(),fechaMesCalendario.getMonth()-1,1);renderizarCalendarioReservas();});
    document.getElementById('btnMesSiguiente')?.addEventListener('click',()=>{fechaMesCalendario=new Date(fechaMesCalendario.getFullYear(),fechaMesCalendario.getMonth()+1,1);renderizarCalendarioReservas();});
    const input=document.getElementById('fechaHoraReserva');
    if(input){const ahora=new Date();ahora.setMinutes(ahora.getMinutes()-ahora.getTimezoneOffset());input.min=ahora.toISOString().slice(0,16);}
}

/* Comprobante interno imprimible. Se verifica el pago nuevamente en Supabase antes de emitirlo. */
function escaparHTMLComprobante(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

async function generarComprobantePago(reservaId) {
    // Abrir la pestaña de forma síncrona para evitar que el navegador bloquee la ventana emergente.
    const ventana = window.open('', '_blank');
    if (!ventana) {
        mostrarNotificacionEstudiante('Permití las ventanas emergentes para imprimir el comprobante.', 'error');
        return;
    }

    ventana.document.write('<!doctype html><html lang="es"><meta charset="utf-8"><title>Preparando comprobante</title><body style="font-family:Arial;padding:2rem;color:#334155">Verificando el estado del pago…</body></html>');

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error('Tu sesión no está disponible. Iniciá sesión nuevamente.');

        // No se confía en la caché del navegador: se consulta la reserva actual y se valida su titular.
        const { data: reserva, error: reservaError } = await supabaseClient
            .from('reservas')
            .select('*, tutor:tutor_id (nombre_completo, email)')
            .eq('id', reservaId)
            .eq('estudiante_id', user.id)
            .single();

        if (reservaError || !reserva) throw new Error('No se encontró la tutoría o no tenés permiso para consultar este comprobante.');

        const estadoPago = String(reserva.estado_pago || '').trim().toLowerCase();
        const estadosConfirmados = ['pagado', 'pagada', 'aprobado', 'aprobada', 'completado', 'completada', 'acreditado', 'acreditada'];
        if (!estadosConfirmados.includes(estadoPago)) {
            throw new Error('El comprobante estará disponible cuando Mercado Pago o la administración confirmen el pago.');
        }

        const { data: perfil, error: perfilError } = await supabaseClient
            .from('perfiles')
            .select('nombre_completo')
            .eq('id', user.id)
            .maybeSingle();
        if (perfilError) throw perfilError;

        const fechaTutoría = reserva.fecha_hora && !Number.isNaN(new Date(reserva.fecha_hora).getTime())
            ? new Date(reserva.fecha_hora).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
            : 'No especificada';
        const fechaPagoRegistrada = reserva.mercadopago_paid_at || reserva.fecha_pago;
        const fechaPago = fechaPagoRegistrada && !Number.isNaN(new Date(fechaPagoRegistrada).getTime())
            ? new Date(fechaPagoRegistrada).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
            : 'No registrada';
        const medioPago = reserva.mercadopago_payment_type || 'No informado';
        const idOperacion = reserva.mercadopago_payment_id || 'No disponible';
        const fechaEmision = new Date().toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
        const importeRegistrado = Number(reserva.precio);
        const importeValido = Number.isFinite(importeRegistrado) && importeRegistrado > 0;
        const importeTexto = importeValido
            ? importeRegistrado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
            : 'No informado en la reserva';
        const numero = 'EP-' + String(reserva.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12).toUpperCase();
        const nombreEstudiante = perfil?.nombre_completo || user.email || 'Estudiante';
        const nombreTutor = reserva.tutor?.nombre_completo || 'No disponible';

        const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprobante ${escaparHTMLComprobante(numero)} · Entre Pares</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif}
.ticket{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px}
header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:20px}
h1{margin:0;font-size:26px;color:#1d4ed8}.muted{color:#64748b;font-size:13px}.status{background:#dcfce7;color:#166534;border-radius:999px;padding:8px 12px;font-weight:bold;font-size:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.field{padding:12px;background:#f8fafc;border-radius:8px}.label{display:block;color:#64748b;font-size:11px;text-transform:uppercase;margin-bottom:6px}.value{font-weight:600;overflow-wrap:anywhere}
.total{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:24px;padding:18px;background:#eff6ff;border-radius:10px}.amount{font-size:25px;font-weight:800;color:#1d4ed8;text-align:right}
.note{border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;font-size:11px;color:#64748b;line-height:1.5}
button{display:block;margin:20px auto 0;padding:12px 20px;border:0;border-radius:8px;background:#1d4ed8;color:#fff;font-weight:bold;cursor:pointer}
@media print{body{padding:0;background:white}.ticket{border:0;border-radius:0;max-width:none;padding:12px}.no-print{display:none!important}}
@media(max-width:520px){body{padding:10px}.ticket{padding:18px}.grid{grid-template-columns:1fr}header{flex-direction:column}.total{align-items:flex-start;flex-direction:column}.amount{text-align:left}}
</style>
</head>
<body>
<main class="ticket">
<header><div><h1>ENTRE PARES</h1><p class="muted">Comprobante interno de pago de tutoría</p></div><span class="status">✓ PAGO CONFIRMADO</span></header>
<div class="grid">
<div class="field"><span class="label">Número de comprobante</span><span class="value">${escaparHTMLComprobante(numero)}</span></div>
<div class="field"><span class="label">Fecha de emisión</span><span class="value">${escaparHTMLComprobante(fechaEmision)}</span></div>
<div class="field"><span class="label">Estudiante</span><span class="value">${escaparHTMLComprobante(nombreEstudiante)}</span></div>
<div class="field"><span class="label">Tutor/a</span><span class="value">${escaparHTMLComprobante(nombreTutor)}</span></div>
<div class="field"><span class="label">Materia</span><span class="value">${escaparHTMLComprobante(reserva.materia || 'Tutoría')}</span></div>
<div class="field"><span class="label">Fecha de tutoría</span><span class="value">${escaparHTMLComprobante(fechaTutoría)}</span></div>
<div class="field"><span class="label">Fecha de pago</span><span class="value">${escaparHTMLComprobante(fechaPago)}</span></div>
<div class="field"><span class="label">Estado del pago</span><span class="value">${escaparHTMLComprobante(reserva.estado_pago)}</span></div>
<div class="field"><span class="label">Medio de pago</span><span class="value">${escaparHTMLComprobante(medioPago)}</span></div>
<div class="field"><span class="label">Identificador de operación</span><span class="value">${escaparHTMLComprobante(idOperacion)}</span></div>
</div>
<div class="total"><div><span class="label">Importe registrado en la reserva</span><span class="muted">Moneda: pesos argentinos (ARS)</span></div><div class="amount">${escaparHTMLComprobante(importeTexto)}</div></div>
<p class="note">Este documento es un comprobante interno generado por Entre Pares a partir de los datos registrados en la plataforma. No constituye factura ni comprobante fiscal de AFIP/ARCA. Si el importe o la fecha de pago no figuran, contactá a administración para verificar el registro.</p>
<button class="no-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
</main>
</body></html>`;
        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();
    } catch (error) {
        console.error('Error al generar comprobante:', error);
        ventana.close();
        mostrarNotificacionEstudiante(error.message || 'No se pudo generar el comprobante.', 'error');
    }
}

function renderizarReservasEstudiante(contenedorId='listaMisReservas', listaReservas=null) {
    const cont=document.getElementById(contenedorId);if(!cont)return;
    const reservas=(listaReservas || reservasFiltradas()).slice().sort((a,b)=>new Date(b.fecha_hora||b.creado_at||0)-new Date(a.fecha_hora||a.creado_at||0));
    cont.innerHTML='';
    if(!reservas.length){cont.innerHTML='<p style="color:#64748b;font-size:.9rem;text-align:center;grid-column:1/-1;">No hay consultas que coincidan con los filtros seleccionados.</p>';return;}
    reservas.forEach(res=>{
        const estado=estadoReservaNormalizado(res.estado);
        const yaCalificada = resenasEstudiantePorReserva.has(String(res.id));
        const color=estado==='Aceptada'?'#16a34a':estado==='Rechazada'?'#dc2626':estado==='Cancelada'?'#64748b':estado==='Finalizada'?'#2563eb':'#eab308';
        const card=document.createElement('div');card.className='panel-card';card.style.cssText='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;font-size:.85rem;';
        const cab=document.createElement('div');cab.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.4rem;';
        const titulo=document.createElement('strong');titulo.style.cssText='color:#0f172a;font-size:1rem;';titulo.textContent=res.materia||'Consulta';
        const badge=document.createElement('span');
        badge.style.cssText='background:'+color+';color:white;padding:2px 8px;border-radius:4px;font-size:.72rem;font-weight:700;';
        badge.textContent=estado==='Aceptada'?'Confirmada':(estado==='Finalizada'?(yaCalificada?'Finalizada · Calificada':'Finalizada · Sin calificar'):estado);
        cab.append(titulo,badge);
        const tutor=document.createElement('p');tutor.style.cssText='color:#475569;margin:.3rem 0;';tutor.textContent='Tutor: '+(res.tutor?.nombre_completo||'Asignado');
        const fecha=document.createElement('p');fecha.style.cssText='color:#475569;margin:.3rem 0;';fecha.textContent=res.fecha_hora?'📅 Fecha confirmada: '+mostrarFechaReserva(res.fecha_hora):'📅 Fecha y horario pendientes de coordinación';
        const duda=document.createElement('p');duda.style.cssText='color:#475569;margin:.3rem 0;';duda.textContent='Duda: '+(res.comentarios||'Sin descripción');
        card.append(cab,tutor,fecha,duda);
        // Mostrar acciones para toda reserva activa, aunque la fecha esté vacía o haya pasado.
        // La fecha se valida nuevamente al abrir el formulario de reprogramación.
        if (['Aceptada','Pendiente'].includes(estado)) {
            const acciones = document.createElement('div');
            acciones.style.cssText = 'display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap;';
            if (estado === 'Aceptada') {
            }
            const btnCancelar = document.createElement('button');
            btnCancelar.type = 'button';
            btnCancelar.className = 'btn';
            btnCancelar.textContent = '✖ Cancelar tutoría';
            btnCancelar.style.cssText = 'flex:1;background:#fee2e2;color:#991b1b;padding:.5rem;';
            btnCancelar.onclick = () => cancelarReservaEstudiante(res.id);
            acciones.append(btnCancelar);
            card.appendChild(acciones);
        }
        const pagoNormalizado = String(res.estado_pago || '').trim().toLowerCase();
        if (['pagado','pagada','aprobado','aprobada','completado','completada','acreditado','acreditada'].includes(pagoNormalizado)) {
            const btnComprobante = document.createElement('button');
            btnComprobante.type = 'button';
            btnComprobante.className = 'btn';
            btnComprobante.style.cssText = 'width:100%;margin-top:.7rem;background:#dcfce7;color:#166534;padding:.6rem;font-weight:600;';
            btnComprobante.textContent = '🧾 Ver / imprimir comprobante';
            btnComprobante.onclick = () => generarComprobantePago(res.id);
            card.appendChild(btnComprobante);
        }
        if(estado==='Aceptada'){
            if(res.estado_pago==='Pendiente'||!res.estado_pago){
                const btn=document.createElement('button');btn.id='btn-pagar-'+res.id;btn.className='btn btn-yellow';btn.style.cssText='width:100%;margin-top:.8rem;padding:.5rem;font-size:.85rem;';btn.textContent='💳 Pagar Tutoría ($'+(res.precio||res.tutor?.precio_hora||3000)+')';btn.onclick=()=>pagarTutoria(res.id,res.materia,Number(res.precio||res.tutor?.precio_hora||3000));card.appendChild(btn);
            } else {
                const a=document.createElement('a');a.href='https://meet.jit.si/EntrePares-'+res.id;a.target='_blank';a.rel='noopener noreferrer';a.className='btn';a.style.cssText='display:block;text-align:center;margin-top:.8rem;background:#2563eb;color:white;padding:.5rem;text-decoration:none;border-radius:4px;';a.textContent='🎥 Unirse a Videollamada';card.appendChild(a);
            }
        } else if(estado==='Finalizada'){
            if (yaCalificada) {
                const nota = document.createElement('p');
                nota.style.cssText = 'margin-top:.6rem;padding:.6rem;border-radius:6px;background:#f0fdf4;color:#166534;font-weight:600;text-align:center;';
                nota.textContent = '✅ Ya calificaste esta tutoría';
                card.appendChild(nota);
            } else {
                const btn=document.createElement('button');btn.className='btn btn-yellow';btn.style.cssText='width:100%;margin-top:.5rem;padding:.5rem;';btn.textContent='⭐ Calificar Tutoría';btn.onclick=()=>abrirModalResena(res.id,res.tutor_id,res.tutor?.nombre_completo||'Tutor');card.appendChild(btn);
            }
        }
        cont.appendChild(card);
    });
}

/* Cancelación y reprogramación desde el panel del estudiante. */
async function cancelarReservaEstudiante(reservaId) {
    const reservaActual = reservasEstudianteCache.find(r => String(r.id) === String(reservaId));
    if (reservaActual && estadoReservaNormalizado(reservaActual.estado) === 'Finalizada') {
        mostrarNotificacionEstudiante('No se puede cancelar una tutoría que ya está finalizada.', 'error');
        return;
    }
    const confirmacion = await Swal.fire({
        title: '¿Cancelar esta tutoría?',
        text: 'La tutoría dejará de figurar como confirmada y no debería generar recordatorios.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#dc2626'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const { error } = await supabaseClient.rpc('cancelar_reserva_participante', { p_reserva_id: String(reservaId) });
        if (error) throw error;
        mostrarNotificacionEstudiante('La solicitud de cancelación se guardó.', 'exito');
        await cargarMisReservas(supabaseClient, userId);
    } catch (error) {
        console.error('Error al cancelar tutoría:', error);
        mostrarNotificacionEstudiante('No se pudo cancelar. Revisá los permisos de reservas en Supabase.', 'error');
    }
}
async function reprogramarReservaEstudiante(reservaId, fechaActual) {
    const reservaActual = reservasEstudianteCache.find(r => String(r.id) === String(reservaId));
    if (!reservaActual || estadoReservaNormalizado(reservaActual.estado) !== 'Aceptada') {
        mostrarNotificacionEstudiante('Solo podés solicitar cambios para tutorías confirmadas.', 'error');
        return;
    }
    const { data: pendientes, error: errorPendiente } = await supabaseClient
        .from('propuestas_horario_chat')
        .select('id')
        .eq('reserva_id', reservaId)
        .eq('estado', 'Pendiente')
        .limit(1);
    if (errorPendiente) {
        console.error('Error consultando solicitudes pendientes:', errorPendiente);
        mostrarNotificacionEstudiante('No se pudo verificar si ya existe una solicitud pendiente.', 'error');
        return;
    }
    if (pendientes?.length) {
        mostrarNotificacionEstudiante('Ya hay una propuesta pendiente de respuesta para esta tutoría.', 'error');
        return;
    }

    const ahora = new Date();
    const minima = new Date(ahora.getTime() + 60 * 60 * 1000);
    const fechaInicial = fechaActual && new Date(fechaActual) > minima ? new Date(fechaActual) : minima;
    const aLocal = f => { const d = new Date(f); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
    const { value: nuevaFecha } = await Swal.fire({
        title: 'Proponer nueva fecha',
        html: '<p style="color:#64748b;font-size:.9rem;margin-bottom:12px;">Elegí una fecha y horario. Tu tutor recibirá la propuesta por el chat y deberá aceptarla para confirmar el cambio.</p>',
        input: 'datetime-local',
        inputValue: aLocal(fechaInicial),
        inputAttributes: { min: aLocal(minima), style: 'width:100%;' },
        showCancelButton: true,
        confirmButtonText: 'Enviar propuesta al tutor',
        cancelButtonText: 'Cancelar',
        inputValidator: value => !value ? 'Elegí una fecha y hora.' : (new Date(value) <= new Date() ? 'La fecha debe ser futura.' : undefined)
    });
    if (!nuevaFecha) return;

    try {
        const { error } = await supabaseClient.rpc('proponer_horario_desde_chat', {
            p_reserva_id: String(reservaId),
            p_fecha_propuesta: new Date(nuevaFecha).toISOString()
        });
        if (error) throw error;
        mostrarNotificacionEstudiante('Propuesta enviada al chat del tutor. La fecha actual no cambia hasta que la acepte.', 'exito');
        await cargarMisReservas(supabaseClient, userId);
    } catch (error) {
        console.error('Error al solicitar reprogramación:', error);
        mostrarNotificacionEstudiante(error.message || 'No se pudo enviar la propuesta de reprogramación.', 'error');
    }
}

function renderizarCalendarioReservas() {
    const cal=document.getElementById('calendarioReservas'),titulo=document.getElementById('tituloMesCalendario'),detalle=document.getElementById('detalleDiaCalendario');
    if(!cal||!titulo||!detalle)return;
    titulo.textContent=fechaMesCalendario.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    titulo.textContent=titulo.textContent.charAt(0).toUpperCase()+titulo.textContent.slice(1);
    cal.innerHTML='';
    ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(d=>{const el=document.createElement('div');el.textContent=d;el.style.cssText='text-align:center;font-size:.75rem;font-weight:700;color:#64748b;padding:.45rem 0;';cal.appendChild(el);});
    const primero=new Date(fechaMesCalendario.getFullYear(),fechaMesCalendario.getMonth(),1),offset=(primero.getDay()+6)%7,dias=new Date(fechaMesCalendario.getFullYear(),fechaMesCalendario.getMonth()+1,0).getDate();
    for(let i=0;i<offset;i++)cal.appendChild(document.createElement('div'));
    const conFecha=reservasFiltradas().filter(r=>r.fecha_hora&&!Number.isNaN(new Date(r.fecha_hora).getTime()));
    const marcados=new Set(conFecha.map(r=>fechaClaveLocal(new Date(r.fecha_hora))));
    for(let d=1;d<=dias;d++){
        const f=new Date(fechaMesCalendario.getFullYear(),fechaMesCalendario.getMonth(),d),clave=fechaClaveLocal(f),hay=marcados.has(clave),sel=clave===fechaSeleccionadaCalendario;
        const btn=document.createElement('button');btn.type='button';btn.textContent=d;btn.style.cssText='min-height:42px;border:1px solid '+(sel?'#2563eb':hay?'#86efac':'#e2e8f0')+';border-radius:8px;background:'+(sel?'#dbeafe':hay?'#f0fdf4':'white')+';font-weight:'+(hay?'700':'400')+';cursor:pointer;';
        btn.addEventListener('click',()=>{fechaSeleccionadaCalendario=clave;renderizarCalendarioReservas();});cal.appendChild(btn);
    }
    detalle.innerHTML='';
    if(!fechaSeleccionadaCalendario){detalle.innerHTML='<p style="color:#64748b;font-size:.85rem;">Seleccioná un día para ver las tarjetas de las consultas.</p>';return;}
    const delDia=conFecha.filter(r=>fechaClaveLocal(new Date(r.fecha_hora))===fechaSeleccionadaCalendario).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
    const h=document.createElement('h3');h.style.cssText='font-size:.95rem;margin:0 0 .7rem;';h.textContent='Consultas del '+new Date(fechaSeleccionadaCalendario+'T12:00:00').toLocaleDateString('es-AR',{dateStyle:'full'});detalle.appendChild(h);
    const tarjetas=document.createElement('div');tarjetas.id='consultasDelDiaCalendario';tarjetas.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;';detalle.appendChild(tarjetas);
    renderizarReservasEstudiante('consultasDelDiaCalendario',delDia);
}
async function cargarMisReservas(supabaseClient, estudianteId) {
    const cont=document.getElementById('listaMisReservas');
    try{
        const {data:reservas,error}=await supabaseClient.from('reservas').select('*, tutor:tutor_id (nombre_completo, email, precio_hora)').eq('estudiante_id',estudianteId).order('creado_at',{ascending:false});
        if(error)throw error;
        reservasEstudianteCache=reservas||[];
        resenasEstudiantePorReserva = new Set();
        const idsReservas = reservasEstudianteCache.map(r => r.id).filter(Boolean);
        if (idsReservas.length) {
            const { data: resenas, error: errorResenas } = await supabaseClient
                .from('resenas')
                .select('reserva_id, calificado_por')
                .eq('estudiante_id', estudianteId)
                .in('reserva_id', idsReservas);
            if (errorResenas) throw errorResenas;
            (resenas || []).forEach(resena => {
                if (String(resena.calificado_por || 'estudiante').toLowerCase() !== 'tutor') {
                    resenasEstudiantePorReserva.add(String(resena.reserva_id));
                }
            });
        }
        actualizarFiltroMaterias();renderizarReservasEstudiante();renderizarCalendarioReservas();
    }catch(err){console.error('Error al cargar reservas:',err);if(cont)cont.innerHTML='<p style="color:#dc2626;font-size:.85rem;text-align:center;">Error al cargar solicitudes. Intentá nuevamente.</p>';}
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
            .from('perfiles_publicos')
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
                actualizarReservaActivaChatEstudiante(supabaseClient, miId, c.id);
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
    const btnHorario = document.getElementById('btnProponerHorarioChat');
    if (btnHorario) btnHorario.addEventListener('click', () => proponerHorarioDesdeChat(supabaseClient, usuarioActualId));
    actualizarEstadoBotonHorarioChat();

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

function actualizarEstadoBotonHorarioChat() {
    const btn = document.getElementById('btnProponerHorarioChat');
    if (!btn) return;
    btn.disabled = !destinatarioActivoId || !reservaChatActivaId;
    btn.style.opacity = btn.disabled ? '.65' : '1';
    btn.textContent = reservaChatActivaFecha
        ? '🔁 Solicitar reprogramación'
        : '📅 Proponer fecha y horario';
    btn.title = !destinatarioActivoId
        ? 'Seleccioná una conversación.'
        : (!reservaChatActivaId
            ? 'No se detectó una tutoría activa en esta conversación.'
            : (reservaChatActivaFecha
                ? 'Solicitar al tutor un cambio de fecha y horario.'
                : 'Coordinar la primera fecha de la tutoría.'));
}

async function actualizarReservaActivaChatEstudiante(client, estudianteId, tutorId) {
    reservaChatActivaId = null;
    reservaChatActivaFecha = null;
    actualizarEstadoBotonHorarioChat();
    const { data, error } = await client.from('reservas')
        .select('id,estado,fecha_hora')
        .eq('estudiante_id', estudianteId)
        .eq('tutor_id', tutorId)
        .order('id', { ascending: false });
    if (error) {
        console.error('No se pudo identificar la tutoría del chat:', error);
        return;
    }
    const reserva = (data || []).find(r => ['aceptada','aprobada','confirmada'].includes(String(r.estado || '').toLowerCase()));
    reservaChatActivaId = reserva?.id || null;
    reservaChatActivaFecha = reserva?.fecha_hora || null;
    actualizarEstadoBotonHorarioChat();
}

async function proponerHorarioDesdeChat(client, miId) {
    if (!destinatarioActivoId || !reservaChatActivaId) {
        const mensaje = 'Esta conversación no tiene una tutoría activa asociada. No se puede proponer un horario todavía.';
        if (typeof mostrarNotificacionEstudiante === 'function') mostrarNotificacionEstudiante(mensaje, 'error');
        else mostrarNotificacion(mensaje, 'error');
        return;
    }

    const ahora = new Date();
    const minima = new Date(ahora.getTime() + 60 * 60 * 1000);
    const fechaMinima = new Date(minima.getTime() - minima.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const horaMinima = minima.toTimeString().slice(0, 5);

    const { value: horario } = await Swal.fire({
        title: '📅 Proponer fecha y horario',
        html: `
            <div style="text-align:left;display:grid;gap:12px;margin-top:12px;">
                <label for="fechaPropuestaChat" style="font-weight:600;color:#334155;">Elegí el día</label>
                <input id="fechaPropuestaChat" type="date" min="${fechaMinima}" value="${fechaMinima}" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;">
                <label for="horaPropuestaChat" style="font-weight:600;color:#334155;">Elegí el horario</label>
                <input id="horaPropuestaChat" type="time" value="${horaMinima}" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;">
                <p style="font-size:.82rem;color:#64748b;margin:0;">La otra persona recibirá la propuesta en este chat y deberá aceptarla. La fecha actual no cambiará hasta entonces.</p>
            </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Enviar propuesta',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const fechaInput = document.getElementById('fechaPropuestaChat');
            if (fechaInput && typeof fechaInput.showPicker === 'function') {
                try { fechaInput.showPicker(); } catch (_) { fechaInput.focus(); }
            }
        },
        preConfirm: () => {
            const fecha = document.getElementById('fechaPropuestaChat')?.value;
            const hora = document.getElementById('horaPropuestaChat')?.value;
            if (!fecha || !hora) {
                Swal.showValidationMessage('Seleccioná una fecha y un horario.');
                return false;
            }
            const seleccion = new Date(`${fecha}T${hora}:00`);
            if (Number.isNaN(seleccion.getTime()) || seleccion <= new Date()) {
                Swal.showValidationMessage('La fecha y hora deben ser futuras.');
                return false;
            }
            if (seleccion < minima) {
                Swal.showValidationMessage('Elegí un horario con al menos una hora de anticipación.');
                return false;
            }
            return seleccion.toISOString();
        }
    });
    if (!horario) return;

    const { error } = await client.rpc('proponer_horario_desde_chat', {
        p_reserva_id: reservaChatActivaId,
        p_fecha_propuesta: horario
    });
    if (error) {
        console.error('Error al proponer horario:', error);
        const mensaje = error.message || 'No se pudo enviar la propuesta.';
        if (typeof mostrarNotificacionEstudiante === 'function') mostrarNotificacionEstudiante(mensaje, 'error');
        else mostrarNotificacion(mensaje, 'error');
        return;
    }
    const mensaje = 'Propuesta enviada al chat. La tutoría ya está activa; la fecha se actualizará cuando la otra persona acepte.';
    if (typeof mostrarNotificacionEstudiante === 'function') mostrarNotificacionEstudiante(mensaje, 'exito');
    else mostrarNotificacion(mensaje, 'exito');
    await cargarHistorialChat(client, miId, destinatarioActivoId);
}
async function responderPropuestaHorarioChat(client, propuestaId, aceptar, miId, otroId) {
    const { error } = await client.rpc('responder_propuesta_horario_chat', {
        p_propuesta_id: propuestaId,
        p_aceptar: aceptar
    });
    if (error) {
        console.error('Error al responder propuesta de horario:', error);
        mostrarNotificacionEstudiante(error.message || 'No se pudo responder la propuesta.', 'error');
        return;
    }
    mostrarNotificacionEstudiante(aceptar ? 'Horario aceptado. La fecha de la tutoría se actualizó.' : 'Propuesta rechazada. La fecha anterior se mantiene.', 'exito');
    await cargarHistorialChat(client, miId, otroId);
    await cargarMisReservas(client, miId);
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

    // Las propuestas vigentes se consultan únicamente en propuestas_horario_chat.
    const idsPropuestas = [...new Set((mensajes || []).map(m => String(m.contenido || '').match(/^HORARIO_PROPUESTA\|([^|]+)\|/)).filter(Boolean).map(m => m[1]))];
    const { data: propuestas, error: errorPropuestas } = idsPropuestas.length
        ? await supabaseClient.from('propuestas_horario_chat').select('id,fecha_propuesta,fecha_anterior,tipo,estado,propuesto_por,respondido_por,created_at,responded_at').in('id', idsPropuestas)
        : { data: [], error: null };
    if (errorPropuestas) console.error('No se pudieron cargar las propuestas del chat:', errorPropuestas);
    const propuestasPorId = new Map((propuestas || []).map(p => [String(p.id), p]));

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

            const solicitudReprogramacionMatch = String(msg.contenido || '').match(/SOLICITUD DE REPROGRAMACIÓN\|([^|]+)\|/);
            const propuestaMatch = String(msg.contenido || '').match(/^HORARIO_PROPUESTA\|([^|]+)\|(.+)$/);
            const respuestaMatch = String(msg.contenido || '').match(/^HORARIO_RESPUESTA\|([^|]+)\|(ACEPTADA|RECHAZADA)(?:\|([^|]+))?$/);
            if (solicitudReprogramacionMatch) {
                // Mensaje histórico: la tabla y RPC antiguas están deshabilitadas.
                const avisoHistorico = document.createElement('div');
                avisoHistorico.textContent = '🔁 Solicitud de reprogramación antigua (solo historial). Para coordinar una nueva fecha, usá Proponer fecha y hora en el chat.';
                burbuja.appendChild(avisoHistorico);
            } else if (propuestaMatch) {
                const propuesta = propuestasPorId.get(propuestaMatch[1]);
                const titulo = document.createElement('strong');
                titulo.textContent = propuesta?.tipo === 'ProgramacionInicial' ? '📅 Propuesta de primera fecha' : '🔁 Solicitud de reprogramación';
                burbuja.appendChild(titulo);
                const fecha = document.createElement('p');
                fecha.textContent = (propuesta?.tipo === 'Reprogramacion' && propuesta?.fecha_anterior ? 'Fecha actual: ' + new Date(propuesta.fecha_anterior).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}) + ' · Nueva fecha: ' : 'Fecha propuesta: ') + (propuesta ? new Date(propuesta.fecha_propuesta).toLocaleString('es-AR',{dateStyle:'full',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}) : new Date(propuestaMatch[2]).toLocaleString('es-AR'));
                fecha.style.margin = '.45rem 0';
                burbuja.appendChild(fecha);
                const estado = document.createElement('p');
                estado.style.fontWeight = '700';
                estado.textContent = propuesta?.estado && propuesta.estado !== 'Pendiente' ? 'Estado: ' + propuesta.estado : 'Pendiente de respuesta';
                burbuja.appendChild(estado);
                const auditoria = document.createElement('small');
                auditoria.style.display = 'block';
                auditoria.style.marginTop = '.35rem';
                auditoria.style.opacity = '.8';
                auditoria.textContent = 'Propuesta enviada: ' + (propuesta?.created_at ? new Date(propuesta.created_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}) : 'fecha no disponible') + (propuesta?.responded_at ? ' · Respondida: ' + new Date(propuesta.responded_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}) : '') + ' · ' + (propuesta?.propuesto_por === miId ? 'La propusiste vos' : 'La propuso la otra persona') + (propuesta?.respondido_por ? ' · Respondió ' + (propuesta.respondido_por === miId ? 'vos' : 'la otra persona') : '');
                burbuja.appendChild(auditoria);
                if (propuesta?.estado === 'Pendiente' && propuesta.propuesto_por !== miId) {
                    const acciones = document.createElement('div');
                    acciones.style.display = 'flex'; acciones.style.gap = '.4rem'; acciones.style.marginTop = '.5rem';
                    [['Aceptar',true],['Rechazar',false]].forEach(([label,aceptar]) => {
                        const b = document.createElement('button'); b.type='button'; b.textContent=label;
                        b.style.cssText='border:0;border-radius:6px;padding:.4rem .65rem;cursor:pointer;background:'+(aceptar?'#16a34a':'#fee2e2')+';color:'+(aceptar?'white':'#991b1b');
                        b.addEventListener('click',()=>responderPropuestaHorarioChat(supabaseClient,propuesta.id,aceptar,miId,otroId));
                        acciones.appendChild(b);
                    });
                    burbuja.appendChild(acciones);
                }
            } else if (respuestaMatch) {
                const textoP = document.createElement('div');
                textoP.textContent = respuestaMatch[2] === 'ACEPTADA' ? (respuestaMatch[3] === 'PROGRAMACION' ? '✅ La fecha inicial fue confirmada y ya aparece en ambos calendarios.' : '✅ La reprogramación fue aceptada. Los calendarios fueron actualizados.') : (respuestaMatch[3] === 'PROGRAMACION' ? '❌ La fecha inicial no fue aceptada. Todavía deben coordinar un horario.' : '❌ La reprogramación fue rechazada. Se mantiene la fecha confirmada anterior.');
                burbuja.appendChild(textoP);
            } else {
                const textoP = document.createElement('div');
                textoP.textContent = msg.contenido;
                burbuja.appendChild(textoP);
            }

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
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generando pago seguro…';
    }

    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) throw new Error('Tu sesión venció. Iniciá sesión nuevamente.');

        // La Edge Function determina el precio desde Supabase; no se envían importes confiados al navegador.
        const { data, error } = await supabaseClient.functions.invoke('crear-pago-mp', {
            body: { reservaId },
        });
        if (error) throw error;
        if (!data?.urlPago) throw new Error(data?.error || 'No se recibió el enlace de Mercado Pago.');

        window.location.assign(data.urlPago);
    } catch (err) {
        console.error('Error al generar pago:', err);
        mostrarNotificacionEstudiante(err.message || 'No se pudo generar el link de pago.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💳 Intentar pagar nuevamente';
        }
    }
};

const recompensasCanjeEstudiante = [
    { id: 'insignia', nombre: 'Insignia de aprendizaje', puntos: 50, icono: '🌟', descripcion: 'Desbloqueá un reconocimiento por tu participación en la comunidad.' },
    { id: 'constancia', nombre: 'Insignia de constancia', puntos: 150, icono: '📚', descripcion: 'Un distintivo por tu compromiso con el aprendizaje.' },
    { id: 'perfil', nombre: 'Perfil destacado', puntos: 200, icono: '🚀', descripcion: 'Solicitá destacar tu perfil de estudiante en la comunidad. Sujeto a revisión.' },
    { id: 'excelencia', nombre: 'Reconocimiento especial', puntos: 300, icono: '🏆', descripcion: 'Solicitá una distinción por tu participación y progreso. Sujeto a revisión.' },
    { id: 'premio', nombre: 'Recompensa especial', puntos: 500, icono: '🎁', descripcion: 'Solicitá un beneficio especial disponible en la plataforma. Sujeto a disponibilidad.' }
];

window.cargarCatalogoCanjesEstudiante = async function() {
    const catalogo = document.getElementById('catalogoCanjesEstudiante');
    const historial = document.getElementById('historialCanjesEstudiante');
    if (!catalogo || !historial) return;
    catalogo.innerHTML = '<p style="color:#64748b;">Cargando recompensas...</p>';
    historial.innerHTML = '<p style="color:#64748b;">Cargando historial...</p>';
    try {
        const { data: { session }, error: errorSesion } = await supabaseClient.auth.getSession();
        if (errorSesion || !session) throw errorSesion || new Error('La sesión no está activa.');
        const usuarioId = session.user.id;
        const { data: perfil, error: errorPerfil } = await supabaseClient
            .from('perfiles').select('puntos_gamificacion').eq('id', usuarioId).single();
        if (errorPerfil) throw errorPerfil;
        const saldo = Number(perfil?.puntos_gamificacion ?? 0);
        const saldoEl = document.getElementById('saldoCanjesEstudiante');
        if (saldoEl) saldoEl.textContent = 'Saldo disponible: ' + saldo + ' pts';
        const { data: recompensas, error: errorRecompensas } = await supabaseClient
            .from('recompensas_puntos').select('id,nombre,descripcion,costo_puntos,rol_destinatario').eq('activa', true).eq('rol_destinatario', 'estudiante').order('costo_puntos', { ascending: true });
        if (errorRecompensas) throw errorRecompensas;
        catalogo.replaceChildren();
        if (!recompensas?.length) {
            const vacio=document.createElement('p'); vacio.style.color='#64748b'; vacio.textContent='Todavía no hay recompensas activas. Volvé a consultar más adelante.'; catalogo.appendChild(vacio);
        }
        (recompensas || []).forEach(recompensa => {
            const tarjeta = document.createElement('article');
            tarjeta.style.cssText = 'border:1px solid #e2e8f0;border-radius:12px;padding:1rem;background:#fff;display:flex;flex-direction:column;gap:.65rem;';
            const icono = document.createElement('div'); icono.textContent = '🎁'; icono.style.fontSize = '2rem';
            const titulo = document.createElement('h3'); titulo.textContent = recompensa.nombre; titulo.style.cssText = 'margin:0;font-size:1rem;color:#1e293b;';
            const descripcion = document.createElement('p'); descripcion.textContent = recompensa.descripcion || 'Recompensa disponible para canjear.'; descripcion.style.cssText = 'margin:0;color:#64748b;font-size:.85rem;flex:1;';
            const costoPuntos = Number(recompensa.costo_puntos);
            const costo = document.createElement('strong'); costo.textContent = costoPuntos + ' puntos'; costo.style.color = '#854d0e';
            const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'btn';
            boton.textContent = saldo >= costoPuntos ? 'Solicitar canje' : 'Puntos insuficientes';
            boton.disabled = saldo < costoPuntos;
            boton.style.cssText = 'background:'+(boton.disabled?'#e2e8f0':'#713f12')+';color:'+(boton.disabled?'#64748b':'#fff')+';padding:.7rem;border-radius:8px;cursor:'+(boton.disabled?'not-allowed':'pointer')+';';
            boton.addEventListener('click', () => solicitarCanjeEstudiante({id:recompensa.id,nombre:recompensa.nombre,puntos:costoPuntos,descripcion:recompensa.descripcion}));
            tarjeta.append(icono,titulo,descripcion,costo,boton); catalogo.appendChild(tarjeta);
        });
        const { data: canjes, error: errorCanjes } = await supabaseClient
            .from('canjes_puntos').select('id, beneficio, puntos, estado, creado_at')
            .eq('usuario_id', usuarioId).order('creado_at', { ascending: false });
        if (errorCanjes) throw errorCanjes;
        historial.innerHTML = '';
        if (!canjes?.length) { historial.innerHTML = '<p style="color:#64748b;">Todavía no realizaste ningún canje.</p>'; return; }
        canjes.forEach(canje => {
            const fila = document.createElement('div'); fila.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:.8rem;border:1px solid #e2e8f0;border-radius:8px;';
            const info = document.createElement('div'); const nombre = document.createElement('strong'); nombre.textContent = canje.beneficio;
            const detalle = document.createElement('p'); detalle.textContent = Number(canje.puntos) + ' puntos · ' + (canje.creado_at ? new Date(canje.creado_at).toLocaleDateString('es-AR') : 'Fecha no disponible'); detalle.style.cssText = 'margin:.25rem 0 0;color:#64748b;font-size:.85rem;';
            info.append(nombre,detalle);
            const estado = document.createElement('span'); const estadoN = String(canje.estado || 'pendiente').toLowerCase();
            estado.textContent = estadoN === 'confirmado' ? 'Confirmado' : estadoN === 'cancelado' ? 'Cancelado' : 'Pendiente de revisión';
            estado.style.cssText = 'background:'+(estadoN==='confirmado'?'#dcfce7':estadoN==='cancelado'?'#fee2e2':'#fef3c7')+';color:'+(estadoN==='confirmado'?'#166534':estadoN==='cancelado'?'#991b1b':'#92400e')+';padding:.35rem .6rem;border-radius:6px;font-size:.8rem;font-weight:600;';
            fila.append(info,estado); historial.appendChild(fila);
        });
    } catch (err) {
        console.error('Error al cargar canjes del estudiante:', err);
        catalogo.innerHTML = '<p style="color:#dc2626;">No se pudo cargar el catálogo. Verificá que la tabla canjes_puntos y sus permisos estén configurados en Supabase.</p>';
        historial.innerHTML = '<p style="color:#dc2626;">No se pudo cargar el historial de canjes.</p>';
    }
};

async function solicitarCanjeEstudiante(recompensa) {
    const confirmacion = await Swal.fire({
        title: '¿Solicitar este canje?',
        html: '<strong>' + recompensa.nombre + '</strong><br>Se solicitarán ' + recompensa.puntos + ' puntos. El saldo se descontará cuando el canje sea confirmado.',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, solicitar',
        cancelButtonText: 'Volver', confirmButtonColor: '#713f12'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const { data: { session }, error: errorSesion } = await supabaseClient.auth.getSession();
        if (errorSesion || !session) throw errorSesion || new Error('La sesión no está activa.');
        const usuarioId = session.user.id;
        const { data: perfil, error: errorPerfil } = await supabaseClient
            .from('perfiles').select('puntos_gamificacion').eq('id', usuarioId).single();
        if (errorPerfil) throw errorPerfil;
        if (Number(perfil?.puntos_gamificacion ?? 0) < recompensa.puntos) {
            mostrarNotificacion('No tenés puntos suficientes para este canje.', 'error');
            await cargarCatalogoCanjesEstudiante();
            return;
        }
        const { error } = await supabaseClient.rpc('solicitar_canje_recompensa', { p_recompensa_id: recompensa.id });
        if (error) throw error;
        mostrarNotificacion('Solicitud de canje enviada. Quedó pendiente de revisión.', 'exito');
        await cargarCatalogoCanjesEstudiante();
    } catch (err) {
        console.error('Error al solicitar canje del estudiante:', err);
        mostrarNotificacion('No se pudo solicitar el canje. Revisá las políticas de canjes en Supabase.', 'error');
    }
}


async function cargarReclamosEstudiante(usuarioId) {
    const cont=document.getElementById('historialReclamosEstudiante'); if(!cont)return;
    const {data,error}=await supabaseClient.from('reclamos_puntos').select('asunto,estado,respuesta_admin,creado_at').eq('usuario_id',usuarioId).order('creado_at',{ascending:false}).limit(20);
    cont.replaceChildren();
    if(error){cont.textContent='No se pudo cargar el historial de reclamos. Aplicá la migración de administración.';return;}
    if(!data?.length){cont.textContent='Todavía no enviaste reclamos.';return;}
    data.forEach(item=>{const row=document.createElement('div');row.style.cssText='border-top:1px solid #e2e8f0;padding:.65rem 0;';
        const title=document.createElement('strong');title.textContent=item.asunto+' · '+item.estado;
        const response=document.createElement('p');response.style.cssText='margin:.25rem 0;color:#64748b;font-size:.85rem;';response.textContent=item.respuesta_admin?'Respuesta: '+item.respuesta_admin:'Sin respuesta del administrador todavía.';
        row.append(title,response);cont.appendChild(row);
    });
}
document.addEventListener('DOMContentLoaded', async () => {
    const form=document.getElementById('formReclamoPuntosEstudiante'); if(!form)return;
    const {data:{session}}=await supabaseClient.auth.getSession(); if(!session)return;
    await cargarReclamosEstudiante(session.user.id);
    form.addEventListener('submit',async event=>{
        event.preventDefault();
        const asunto=document.getElementById('reclamoAsuntoEstudiante').value.trim();
        const descripcion=document.getElementById('reclamoDescripcionEstudiante').value.trim();
        if(asunto.length<3||descripcion.length<10){alert('Completá el asunto y el detalle del reclamo.');return;}
        const {error}=await supabaseClient.from('reclamos_puntos').insert({usuario_id:session.user.id,asunto,descripcion,estado:'pendiente'});
        if(error){alert('No se pudo enviar el reclamo: '+error.message);return;}
        form.reset();alert('Reclamo enviado. Podés consultar su estado en esta sección.');await cargarReclamosEstudiante(session.user.id);
    });
});
