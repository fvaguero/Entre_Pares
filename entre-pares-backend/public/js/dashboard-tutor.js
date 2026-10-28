// Mantiene los mismos rangos y cálculo de progreso que el panel estudiante.
function obtenerNivelGamificacionTutor(puntos) {
    const total = Math.max(0, Number(puntos) || 0);
    if (total <= 100) return { nombre: 'Principiante', insignia: '🌱', minimo: 0, maximo: 100, siguiente: 101 };
    if (total <= 300) return { nombre: 'Colaborador', insignia: '⭐', minimo: 101, maximo: 300, siguiente: 301 };
    if (total <= 600) return { nombre: 'Académico Pro', insignia: '🔥', minimo: 301, maximo: 600, siguiente: 601 };
    return { nombre: 'Leyenda Entre Pares', insignia: '👑', minimo: 601, maximo: null, siguiente: null };
}

function mostrarNivelGamificacionTutor(puntos) {
    const total = Math.max(0, Number(puntos) || 0);
    const nivel = obtenerNivelGamificacionTutor(total);
    const nombre = document.getElementById('nivelGamificacionTutor');
    const barra = document.getElementById('progresoGamificacionTutor');
    const texto = document.getElementById('textoProgresoGamificacionTutor');
    if (nombre) nombre.textContent = nivel.insignia + ' ' + nivel.nombre;
    if (!nivel.maximo) {
        if (barra) barra.style.width = '100%';
        if (texto) texto.textContent = '¡Felicitaciones! Alcanzaste el nivel máximo con ' + total + ' puntos.';
        return;
    }
    const porcentaje = Math.max(0, Math.min(100, ((total - nivel.minimo + 1) / (nivel.maximo - nivel.minimo + 1)) * 100));
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = 'Tenés ' + total + ' puntos. Te faltan ' + (nivel.siguiente - total) + ' para el próximo nivel.';
}

const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let destinatarioActivoId = null;
let reservaChatActivaId = null;
let reservaChatActivaFecha = null;
let reservasTutorCache = [];
let resenasTutorPorReserva = new Set();
let pagosTutorCache = [];
let mesCalendarioTutor = new Date();
let diaSeleccionadoTutor = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }
    usuarioActual = user;
    inicializarPanelRecordatorios(usuarioActual.id);

    try {
        const { data: perfil, error: perfilError } = await supabaseClient
            .from('perfiles_privados')
            .select('*')
            .eq('id', usuarioActual.id)
            .single();

        if (perfilError || !perfil || !['Tutor', 'Ambos'].includes(perfil.rol)) {
            alert('Esta sección requiere una cuenta de Tutor o una cuenta dual.');
            window.location.href = 'index.html';
            return;
        }

        if (perfil) {
            const spanNombre = document.getElementById('nombreUsuarioHeader');
            if (spanNombre) {
                spanNombre.textContent = perfil.nombre_completo || 'Tutor';
            }
            const puntosTutor = Number(perfil.puntos_gamificacion ?? 0);
            const spanPuntosTutor = document.getElementById('puntosGamificacionTutor');
            const spanNivelTutor = document.getElementById('nivelGamificacionTutor');
            if (spanPuntosTutor) spanPuntosTutor.textContent = puntosTutor + ' pts';
            mostrarNivelGamificacionTutor(puntosTutor);

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
                // Evitar calificaciones repetidas del tutor para la misma reserva.
                const { data: resenaExistente, error: errorConsultaResena } = await supabaseClient
                    .from('resenas')
                    .select('reserva_id')
                    .eq('reserva_id', reservaId)
                    .eq('tutor_id', usuarioActual.id)
                    .eq('calificado_por', 'tutor')
                    .maybeSingle();

                if (errorConsultaResena) throw errorConsultaResena;
                if (resenaExistente) {
                    mostrarNotificacion("Ya calificaste esta tutoría.", "error");
                    return;
                }

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
                await cargarSolicitudesYTutorias();
    await cargarSolicitudesReprogramacionTutor();
            } catch (err) {
                const detalleError = [
                    'Código: ' + (err?.code || 'sin código'),
                    'Mensaje: ' + (err?.message || 'desconocido'),
                    err?.details ? 'Detalles: ' + err.details : '',
                    err?.hint ? 'Sugerencia: ' + err.hint : ''
                ].filter(Boolean).join(' | ');
                console.error('Error al guardar reseña del tutor: ' + detalleError);
                if (window.Swal) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'No se pudo guardar la calificación',
                        text: detalleError,
                        confirmButtonText: 'Entendido'
                    });
                } else {
                    mostrarNotificacion('No se pudo guardar: ' + detalleError, 'error');
                }
            }
        });
    }

    inicializarAgendaTutor();
    cargarSolicitudesYTutorias();
    supabaseClient.channel('reservas-tutor-' + usuarioActual.id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservas', filter: 'tutor_id=eq.' + usuarioActual.id }, () => cargarSolicitudesYTutorias())
        .subscribe();
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
        reservasTutorCache = reservas || [];
        await cargarSolicitudesReprogramacionTutor();
        resenasTutorPorReserva = new Set();
        const idsReservas = reservasTutorCache.map(r => r.id).filter(Boolean);
        if (idsReservas.length) {
            const { data: resenasTutor, error: errorResenasTutor } = await supabaseClient
                .from('resenas')
                .select('reserva_id')
                .eq('tutor_id', usuarioActual.id)
                .eq('calificado_por', 'tutor')
                .in('reserva_id', idsReservas);
            if (errorResenasTutor) throw errorResenasTutor;
            (resenasTutor || []).forEach(resena => resenasTutorPorReserva.add(String(resena.reserva_id)));
        }
        actualizarMateriasFiltroTutor();

        if (!reservas || reservas.length === 0) {
            if (contenedorPendientes) contenedorPendientes.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes solicitudes pendientes.</p>`;
            if (contenedorAceptadas) contenedorAceptadas.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No tienes tutorías aceptadas aún.</p>`;
            return;
        }

        const pendientes = reservas.filter(r => r.estado && r.estado.toLowerCase() === 'pendiente');
        const aceptadas = reservasFiltradasTutor().filter(r => r.estado && (r.estado.toLowerCase() === 'aceptada' || r.estado.toLowerCase() === 'aprobada' || r.estado.toLowerCase() === 'finalizada'));

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
                    const yaCalificadaTutor = resenasTutorPorReserva.has(String(res.id));
                    let estadoTexto = esFinalizada ? (yaCalificadaTutor ? 'Finalizada · Calificada' : 'Finalizada · Sin calificar') : 'Aceptada';
                    const nombreEst = res.estudiante?.nombre_completo || 'Asignado';
                    const estId = res.estudiante?.id;

                    let botonAccionTutor = '';
                    if (esFinalizada && yaCalificadaTutor) {
                        botonAccionTutor = `
                            <div style="margin-top:.8rem;padding:.65rem;border-radius:6px;background:#f0fdf4;color:#166534;text-align:center;font-size:.85rem;font-weight:700;">
                                ✅ Ya calificaste al estudiante
                            </div>
                        `;
                    } else if (esFinalizada) {
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

        renderizarAgendaTutor();
        renderizarCalendarioTutor();
    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
    }
}

function estadoAgendaTutor(estado){const e=String(estado||'').toLowerCase();if(['aceptada','aprobada','confirmada'].includes(e))return 'Aceptada';if(e==='finalizada')return 'Finalizada';if(e==='rechazada')return 'Rechazada';return 'Pendiente';}
function reservasFiltradasTutor(){const m=(document.getElementById('filtroMateriaTutor')?.value||'').trim().toLowerCase(),e=document.getElementById('filtroEstadoTutor')?.value||'';return reservasTutorCache.filter(r=>(!m||String(r.materia||'').trim().toLowerCase()===m)&&(!e||estadoAgendaTutor(r.estado)===e));}
function actualizarMateriasFiltroTutor(){const s=document.getElementById('filtroMateriaTutor');if(!s)return;const old=s.value,ms=[...new Set(reservasTutorCache.filter(r=>['aceptada','aprobada','finalizada'].includes(String(r.estado||'').toLowerCase())).map(r=>String(r.materia||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));s.innerHTML='<option value="">Todas las materias</option>';ms.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;s.appendChild(o)});if(ms.includes(old))s.value=old;}
function inicializarAgendaTutor(){['filtroMateriaTutor','filtroEstadoTutor'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{renderizarAgendaTutor();renderizarCalendarioTutor();}));document.getElementById('limpiarFiltrosTutor')?.addEventListener('click',()=>{document.getElementById('filtroMateriaTutor').value='';document.getElementById('filtroEstadoTutor').value='';diaSeleccionadoTutor=null;renderizarAgendaTutor();renderizarCalendarioTutor();});document.getElementById('mesTutorAnterior')?.addEventListener('click',()=>{mesCalendarioTutor=new Date(mesCalendarioTutor.getFullYear(),mesCalendarioTutor.getMonth()-1,1);renderizarCalendarioTutor();});document.getElementById('mesTutorSiguiente')?.addEventListener('click',()=>{mesCalendarioTutor=new Date(mesCalendarioTutor.getFullYear(),mesCalendarioTutor.getMonth()+1,1);renderizarCalendarioTutor();});}
function claveDiaTutor(f){return f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');}
function renderizarAgendaTutor(contenedorId='listaTutoriasAceptadas', listaReservas=null){const cont=document.getElementById(contenedorId);if(!cont)return;const rs=(listaReservas||reservasFiltradasTutor()).filter(r=>['aceptada','aprobada','finalizada'].includes(String(r.estado||'').toLowerCase())).sort((a,b)=>new Date(a.fecha_hora||a.creado_at||0)-new Date(b.fecha_hora||b.creado_at||0));cont.innerHTML='';if(!rs.length){cont.innerHTML='<p style="color:#64748b;font-size:.85rem;text-align:center;grid-column:1/-1;">No hay tutorías que coincidan con los filtros.</p>';return;}rs.forEach(r=>{const estadoNormalizado=String(r.estado||'').trim().toLowerCase();const fin=['finalizada','finalizado','completada','completado'].includes(estadoNormalizado)||estadoAgendaTutor(r.estado)==='Finalizada',card=document.createElement('div');card.style.cssText='border:1px solid #e2e8f0;padding:1rem;border-radius:8px;background:white;';const head=document.createElement('div');head.style.cssText='display:flex;justify-content:space-between;gap:.5rem;';const t=document.createElement('strong');t.textContent=r.materia||'Tutoría';const yaCalificada=resenasTutorPorReserva.has(String(r.id));const badge=document.createElement('span');badge.style.cssText='background:'+(fin?(yaCalificada?'#15803d':'#2563eb'):'#16a34a')+';color:white;padding:2px 6px;border-radius:4px;font-size:.7rem;';badge.textContent=fin?(yaCalificada?'Finalizada · Calificada':'Finalizada · Sin calificar'):'Confirmada';head.append(t,badge);card.appendChild(head);const p=document.createElement('p');p.style.cssText='color:#475569;font-size:.85rem;';p.textContent='Estudiante: '+(r.estudiante?.nombre_completo||'Estudiante');card.appendChild(p);const f=document.createElement('p');f.style.cssText='color:#475569;font-size:.85rem;';f.textContent='📅 '+(r.fecha_hora?new Date(r.fecha_hora).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'Fecha y hora a coordinar');card.appendChild(f);const c=document.createElement('p');c.style.cssText='color:#475569;font-size:.85rem;';c.textContent='Consulta: '+(r.comentarios||'Sin descripción');card.appendChild(c);if(fin){if(resenasTutorPorReserva.has(String(r.id))){const nota=document.createElement('p');nota.style.cssText='margin-top:.5rem;padding:.6rem;border-radius:6px;background:#f0fdf4;color:#166534;font-weight:600;text-align:center;font-size:.85rem;';nota.textContent='✅ Ya calificaste al estudiante';card.appendChild(nota);}else{const b=document.createElement('button');b.className='btn btn-yellow';b.style.cssText='width:100%;padding:.5rem;';b.textContent='⭐ Calificar Estudiante';b.onclick=()=>window.abrirModalResenaTutor(r.id,r.estudiante_id,r.estudiante?.nombre_completo||'Estudiante');card.appendChild(b);}}else{if(r.fecha_hora&&new Date(r.fecha_hora)>new Date()){const acciones=document.createElement('div');acciones.style.cssText='display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap;';const cancelar=document.createElement('button');cancelar.type='button';cancelar.className='btn';cancelar.textContent='✖ Cancelar';cancelar.style.cssText='flex:1;background:#fee2e2;color:#991b1b;padding:.5rem;';cancelar.onclick=()=>cancelarReservaTutor(r.id);acciones.append(cancelar);card.appendChild(acciones);}const a=document.createElement('a');a.href='https://meet.jit.si/EntrePares-'+r.id;a.target='_blank';a.rel='noopener noreferrer';a.className='btn';a.style.cssText='display:block;text-align:center;margin-top:.5rem;background:#2563eb;color:white;padding:.5rem;text-decoration:none;border-radius:4px;';a.textContent='Unirse a Videollamada';card.appendChild(a);const b=document.createElement('button');b.className='btn';b.style.cssText='width:100%;margin-top:.5rem;background:#0f172a;color:white;padding:.5rem;';b.textContent='🏁 Marcar como Finalizada';b.onclick=()=>window.marcarTutoriaFinalizada(r.id);card.appendChild(b);}cont.appendChild(card);});}

async function cargarSolicitudesReprogramacionTutor() {
    const cont = document.getElementById('solicitudesReprogramacionTutor');
    if (!cont || !usuarioActual) return;
    try {
        const { data, error } = await supabaseClient
            .from('propuestas_horario_chat')
            .select('id,reserva_id,estudiante_id,fecha_anterior,fecha_propuesta,tipo,created_at,propuesto_por,estudiante:estudiante_id(nombre_completo),reserva:reservas(materia)')
            .eq('tutor_id', usuarioActual.id)
            .eq('estado', 'Pendiente')
            .neq('propuesto_por', usuarioActual.id)
            .order('created_at', { ascending: true });
        if (error) throw error;
        cont.replaceChildren();
        if (!data?.length) {
            cont.textContent = 'No tenés propuestas de fecha pendientes de respuesta.';
            return;
        }
        data.forEach(p => {
            const card = document.createElement('article');
            card.style.cssText = 'border:1px solid #bae6fd;background:#f0f9ff;border-radius:9px;padding:.9rem;';
            const title = document.createElement('strong');
            title.textContent = (p.reserva?.materia || 'Tutoría') + ' · ' + (p.estudiante?.nombre_completo || 'Estudiante');
            const tipo = document.createElement('p');
            tipo.style.cssText = 'margin:.4rem 0;color:#0369a1;font-weight:700;font-size:.85rem;';
            tipo.textContent = p.tipo === 'ProgramacionInicial' ? 'Primera fecha propuesta' : 'Solicitud de reprogramación';
            const oldDate = document.createElement('p');
            oldDate.style.cssText = 'margin:.35rem 0;color:#475569;font-size:.85rem;';
            oldDate.textContent = p.fecha_anterior
                ? 'Fecha vigente: ' + new Date(p.fecha_anterior).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'})
                : 'Todavía no hay una fecha confirmada.';
            const newDate = document.createElement('p');
            newDate.style.cssText = 'margin:.25rem 0 .7rem;color:#075985;font-weight:700;font-size:.9rem;';
            newDate.textContent = 'Fecha propuesta: ' + new Date(p.fecha_propuesta).toLocaleString('es-AR',{dateStyle:'full',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'});
            const sent = document.createElement('small');
            sent.textContent = 'Enviada: ' + new Date(p.created_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'});
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.65rem;';
            const accept = document.createElement('button');
            accept.type='button'; accept.className='btn'; accept.textContent='✓ Aceptar fecha';
            accept.style.cssText='background:#16a34a;color:white;padding:.55rem .8rem;flex:1;';
            accept.addEventListener('click',()=>responderPropuestaHorarioChat(supabaseClient,p.id,true,usuarioActual.id,p.estudiante_id));
            const reject = document.createElement('button');
            reject.type='button'; reject.className='btn'; reject.textContent='✕ Rechazar';
            reject.style.cssText='background:#fee2e2;color:#991b1b;padding:.55rem .8rem;flex:1;';
            reject.addEventListener('click',()=>responderPropuestaHorarioChat(supabaseClient,p.id,false,usuarioActual.id,p.estudiante_id));
            actions.append(accept,reject);
            card.append(title,tipo,oldDate,newDate,sent,actions);
            cont.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar propuestas de fecha:', error);
        cont.textContent = 'No se pudieron cargar las propuestas. Verificá que hayas ejecutado la última migración de Supabase.';
    }
}

async function cancelarReservaTutor(reservaId) {
    const reservaActual = (reservasTutorCache || []).find(r => String(r.id) === String(reservaId));
    if (reservaActual && ['finalizada','finalizado','completada','completado'].includes(String(reservaActual.estado || '').trim().toLowerCase())) {
        mostrarNotificacion('No se puede cancelar una tutoría que ya está finalizada.', 'error');
        return;
    }
    const confirmacion = await Swal.fire({
        title: '¿Cancelar esta tutoría?',
        text: 'Se cambiará el estado a Cancelada. Avisale al estudiante por mensajes para coordinar otra fecha.',
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
        mostrarNotificacion('La tutoría fue cancelada.', 'exito');
        await cargarSolicitudesYTutorias();
    } catch (error) {
        console.error('Error al cancelar tutoría:', error);
        mostrarNotificacion('No se pudo cancelar. Revisá los permisos de reservas en Supabase.', 'error');
    }
}
async function reprogramarReservaTutor(reservaId, fechaActual) {
    const reservaActual = (reservasTutorCache || []).find(r => String(r.id) === String(reservaId));
    if (reservaActual && ['finalizada','finalizado','completada','completado'].includes(String(reservaActual.estado || '').trim().toLowerCase())) {
        mostrarNotificacion('No se puede reprogramar una tutoría que ya está finalizada.', 'error');
        return;
    }
    const valorLocal = (() => {
        const f = new Date(fechaActual);
        f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
        return f.toISOString().slice(0,16);
    })();
    const { value: nuevaFecha } = await Swal.fire({
        title: 'Reprogramar tutoría',
        input: 'datetime-local',
        inputValue: valorLocal,
        inputAttributes: { min: (() => { const n = new Date(); n.setMinutes(n.getMinutes()-n.getTimezoneOffset()); return n.toISOString().slice(0,16); })() },
        showCancelButton: true,
        confirmButtonText: 'Guardar horario',
        cancelButtonText: 'Cancelar',
        inputValidator: value => !value ? 'Elegí una fecha y hora.' : (new Date(value) <= new Date() ? 'La fecha debe ser futura.' : undefined)
    });
    if (!nuevaFecha) return;
    try {
        const { error } = await supabaseClient.rpc('reprogramar_reserva_participante', { p_reserva_id: String(reservaId), p_nueva_fecha: new Date(nuevaFecha).toISOString() });
        if (error) throw error;
        mostrarNotificacion('Horario actualizado. Coordiná el cambio con el estudiante por mensajes.', 'exito');
        await cargarSolicitudesYTutorias();
    } catch (error) {
        console.error('Error al reprogramar tutoría:', error);
        mostrarNotificacion('No se pudo reprogramar. Revisá los permisos de reservas en Supabase.', 'error');
    }
}

function renderizarCalendarioTutor(){const cal=document.getElementById('calendarioTutor'),tit=document.getElementById('mesTutorTitulo'),det=document.getElementById('detalleCalendarioTutor');if(!cal||!tit||!det)return;tit.textContent=mesCalendarioTutor.toLocaleDateString('es-AR',{month:'long',year:'numeric'});tit.textContent=tit.textContent.charAt(0).toUpperCase()+tit.textContent.slice(1);cal.innerHTML='';['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(d=>{const e=document.createElement('div');e.textContent=d;e.style.cssText='text-align:center;font-size:.75rem;font-weight:700;color:#64748b;padding:.45rem 0;';cal.appendChild(e);});const first=new Date(mesCalendarioTutor.getFullYear(),mesCalendarioTutor.getMonth(),1),off=(first.getDay()+6)%7,total=new Date(mesCalendarioTutor.getFullYear(),mesCalendarioTutor.getMonth()+1,0).getDate();for(let i=0;i<off;i++)cal.appendChild(document.createElement('div'));const dated=reservasFiltradasTutor().filter(r=>['aceptada','aprobada','finalizada'].includes(String(r.estado||'').toLowerCase())&&r.fecha_hora&&!Number.isNaN(new Date(r.fecha_hora).getTime())),marked=new Set(dated.map(r=>claveDiaTutor(new Date(r.fecha_hora))));for(let d=1;d<=total;d++){const f=new Date(mesCalendarioTutor.getFullYear(),mesCalendarioTutor.getMonth(),d),key=claveDiaTutor(f),has=marked.has(key),sel=key===diaSeleccionadoTutor,b=document.createElement('button');b.type='button';b.textContent=d;b.style.cssText='min-height:42px;border:1px solid '+(sel?'#2563eb':has?'#86efac':'#e2e8f0')+';border-radius:8px;background:'+(sel?'#dbeafe':has?'#f0fdf4':'white')+';font-weight:'+(has?'700':'400')+';cursor:pointer;';b.onclick=()=>{diaSeleccionadoTutor=key;renderizarCalendarioTutor()};cal.appendChild(b);}det.innerHTML='';if(!diaSeleccionadoTutor){det.innerHTML='<p style="color:#64748b;font-size:.85rem;">Seleccioná un día para ver las tarjetas de las tutorías.</p>';return;}const day=dated.filter(r=>claveDiaTutor(new Date(r.fecha_hora))===diaSeleccionadoTutor).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora)),h=document.createElement('h3');h.style.cssText='font-size:.95rem;margin:0 0 .7rem;';h.textContent='Tutorías del '+new Date(diaSeleccionadoTutor+'T12:00:00').toLocaleDateString('es-AR',{dateStyle:'full'});det.appendChild(h);const cards=document.createElement('div');cards.id='tarjetasTutorDia';cards.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;';det.appendChild(cards);renderizarAgendaTutor('tarjetasTutorDia',day);}
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
            .select('id,nombre_completo,email,carrera,sede_universitaria')
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
    const btnHorario = document.getElementById('btnProponerHorarioChat');
    if (btnHorario) btnHorario.addEventListener('click', () => proponerHorarioDesdeChat(supabaseClient, usuarioActualId));
    actualizarEstadoBotonHorarioChat();

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
function actualizarEstadoBotonHorarioChat() {
    const btn = document.getElementById('btnProponerHorarioChat');
    if (!btn) return;

    const hayTutoriaActiva = Boolean(destinatarioActivoId && reservaChatActivaId);
    btn.disabled = !hayTutoriaActiva;
    btn.style.opacity = btn.disabled ? '0.65' : '1';

    if (!destinatarioActivoId) {
        btn.title = 'Seleccioná una conversación.';
    } else if (!reservaChatActivaId) {
        btn.title = 'Necesitás una tutoría aceptada para proponer horarios.';
    } else if (reservaChatActivaFecha) {
        btn.title = 'Proponer una nueva fecha para reprogramar la tutoría.';
    } else {
        btn.title = 'Proponer la primera fecha de la tutoría.';
    }

    btn.textContent = reservaChatActivaFecha
        ? '📅 Solicitar reprogramación'
        : '📅 Proponer fecha y hora';
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
        mostrarNotificacion(error.message || 'No se pudo responder la propuesta.', 'error');
        return;
    }
    mostrarNotificacion(aceptar ? 'Horario aceptado. La fecha de la tutoría se actualizó.' : 'Propuesta rechazada. La fecha anterior se mantiene.', 'exito');
    if (destinatarioActivoId === otroId) await cargarHistorialChat(client, miId, otroId);
    await cargarSolicitudesYTutorias();
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

    // Las propuestas vigentes se consultan únicamente en propuestas_horario_chat.
    const idsPropuestas = [...new Set((mensajes || []).map(m => String(m.contenido || '').match(/^HORARIO_PROPUESTA\|([^|]+)\|/)).filter(Boolean).map(m => m[1]))];
    const { data: propuestas, error: errorPropuestas } = idsPropuestas.length
        ? await supabaseClient.from('propuestas_horario_chat').select('id,fecha_propuesta,fecha_anterior,tipo,estado,propuesto_por,respondido_por,created_at,responded_at').in('id', idsPropuestas)
        : { data: [], error: null };
    if (errorPropuestas) console.error('No se pudieron cargar las propuestas del chat:', errorPropuestas);
    const propuestasPorId = new Map((propuestas || []).map(p => [String(p.id), p]));

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
    reservaChatActivaId = null;
    reservaChatActivaFecha = null;
    actualizarEstadoBotonHorarioChat();
    
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

    const reservaActiva = (reservas || []).find(r => ['aceptada','aprobada','confirmada'].includes(String(r.estado || '').toLowerCase())) || null;
    reservaChatActivaId = reservaActiva?.id || null;
    reservaChatActivaFecha = reservaActiva?.fecha_hora || null;
    actualizarEstadoBotonHorarioChat();

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
            .select('id, materia, precio, estado_pago, creado_at, estudiante:estudiante_id (nombre_completo)')
            .eq('tutor_id', usuarioActual.id)
            .order('creado_at', { ascending: false });
        if (error) throw error;
        pagosTutorCache = reservas || [];
        const materiaSelect = document.getElementById('filtroMateriaPagosTutor');
        if (materiaSelect) {
            const anterior = materiaSelect.value;
            const materias = [...new Set(pagosTutorCache.map(r => String(r.materia || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
            materiaSelect.innerHTML = '<option value="">Todas las materias</option>';
            materias.forEach(m => { const op=document.createElement('option'); op.value=m; op.textContent=m; materiaSelect.appendChild(op); });
            if (materias.includes(anterior)) materiaSelect.value = anterior;
        }
        renderizarPagosTutor();
    } catch (err) {
        console.error('Error al cargar los pagos del tutor:', err.message);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#dc2626;">Error al cargar los datos de pagos.</td></tr>';
    }
}
function renderizarPagosTutor() {
    const tbody = document.getElementById('tabla-pagos-tutor');
    if (!tbody) return;
    const materia = (document.getElementById('filtroMateriaPagosTutor')?.value || '').trim().toLowerCase();
    const estadoFiltro = document.getElementById('filtroEstadoPagoTutor')?.value || '';
    const reservas = pagosTutorCache.filter(r =>
        (!materia || String(r.materia || '').trim().toLowerCase() === materia) &&
        (!estadoFiltro || (r.estado_pago || 'Pendiente') === estadoFiltro)
    );
    tbody.innerHTML = '';
    if (!reservas.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#64748b;">No hay pagos que coincidan con los filtros.</td></tr>';
        return;
    }
    reservas.forEach(reserva => {
        const estado = reserva.estado_pago || 'Pendiente';
        const estilos = {
            Pagado: ['#fef08a','#713f12'],
            Completada: ['#e0f2fe','#0369a1'],
            Liquidado: ['#dcfce7','#166534']
        };
        const [badgeBg,badgeColor] = estilos[estado] || ['#f1f5f9','#475569'];
        const fecha = reserva.creado_at ? new Date(reserva.creado_at).toLocaleDateString('es-AR') : 'Fecha no disponible';
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        const celdas = [
            reserva.estudiante?.nombre_completo || 'Estudiante',
            reserva.materia || 'Tutoría',
            '$' + Number(reserva.precio || 0).toLocaleString('es-AR') + ' ARS',
            estado,
            fecha
        ];
        celdas.forEach((valor, indice) => {
            const td = document.createElement('td');
            td.style.cssText = 'padding:.8rem;color:' + (indice===2 ? '#1e293b' : '#475569') + ';' + (indice===2 ? 'font-weight:600;' : '');
            if (indice===3) {
                const badge = document.createElement('span');
                badge.style.cssText = 'background:'+badgeBg+';color:'+badgeColor+';padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:600;';
                badge.textContent = valor; td.appendChild(badge);
            } else td.textContent = valor;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}
document.getElementById('filtroMateriaPagosTutor')?.addEventListener('change', renderizarPagosTutor);
document.getElementById('filtroEstadoPagoTutor')?.addEventListener('change', renderizarPagosTutor);
document.getElementById('limpiarFiltrosPagosTutor')?.addEventListener('click', () => {
    const materia=document.getElementById('filtroMateriaPagosTutor');
    const estado=document.getElementById('filtroEstadoPagoTutor');
    if(materia) materia.value='';
    if(estado) estado.value='';
    renderizarPagosTutor();
});

const recompensasCanjeTutor = [
    { id: 'insignia', nombre: 'Insignia especial', puntos: 50, icono: '🌟', descripcion: 'Desbloqueá un reconocimiento para destacar tu perfil de tutor.' },
    { id: 'experto', nombre: 'Insignia Tutor Experto', puntos: 150, icono: '🎓', descripcion: 'Un distintivo especial por tu compromiso con la comunidad.' },
    { id: 'destacado', nombre: 'Perfil destacado', puntos: 200, icono: '🚀', descripcion: 'Solicitá aparecer como tutor destacado durante una semana. Sujeto a revisión.' },
    { id: 'mes', nombre: 'Reconocimiento especial', puntos: 300, icono: '🏆', descripcion: 'Solicitá una distinción por tu participación y constancia. Sujeto a revisión.' },
    { id: 'premio', nombre: 'Recompensa especial', puntos: 500, icono: '🎁', descripcion: 'Solicitá un beneficio especial disponible en la plataforma. Sujeto a disponibilidad.' }
];

window.cargarCatalogoCanjesTutor = async function() {
    const catalogo = document.getElementById('catalogoCanjesTutor');
    const historial = document.getElementById('historialCanjesTutor');
    if (!catalogo || !historial || !usuarioActual) return;
    catalogo.innerHTML = '<p style="color:#64748b;">Cargando recompensas...</p>';
    historial.innerHTML = '<p style="color:#64748b;">Cargando historial...</p>';
    try {
        const { data: perfil, error: errorPerfil } = await supabaseClient
            .from('perfiles').select('puntos_gamificacion').eq('id', usuarioActual.id).single();
        if (errorPerfil) throw errorPerfil;
        const saldo = Number(perfil?.puntos_gamificacion || 0);
        const saldoEl = document.getElementById('saldoCanjesTutor');
        if (saldoEl) saldoEl.textContent = 'Saldo disponible: ' + saldo + ' pts';

        const { data: recompensas, error: errorRecompensas } = await supabaseClient
            .from('recompensas_puntos').select('id,nombre,descripcion,costo_puntos,rol_destinatario').eq('activa', true).eq('rol_destinatario', 'tutor').order('costo_puntos', { ascending: true });
        if (errorRecompensas) throw errorRecompensas;
        catalogo.replaceChildren();
        if (!recompensas?.length) { const vacio=document.createElement('p');vacio.style.color='#64748b';vacio.textContent='Todavía no hay recompensas activas.';catalogo.appendChild(vacio); }
        (recompensas || []).forEach(recompensa => {
            const costoPuntos=Number(recompensa.costo_puntos);
            const tarjeta=document.createElement('article');tarjeta.style.cssText='border:1px solid #e2e8f0;border-radius:12px;padding:1rem;background:#fff;display:flex;flex-direction:column;gap:.65rem;';
            const icono=document.createElement('div');icono.textContent='🎁';icono.style.fontSize='2rem';
            const titulo=document.createElement('h3');titulo.textContent=recompensa.nombre;titulo.style.cssText='margin:0;font-size:1rem;color:#1e293b;';
            const descripcion=document.createElement('p');descripcion.textContent=recompensa.descripcion||'Recompensa disponible para canjear.';descripcion.style.cssText='margin:0;color:#64748b;font-size:.85rem;flex:1;';
            const costo=document.createElement('strong');costo.textContent=costoPuntos+' puntos';costo.style.color='#854d0e';
            const boton=document.createElement('button');boton.type='button';boton.className='btn';boton.textContent=saldo>=costoPuntos?'Solicitar canje':'Puntos insuficientes';boton.disabled=saldo<costoPuntos;
            boton.style.cssText='background:'+(boton.disabled?'#e2e8f0':'#713f12')+';color:'+(boton.disabled?'#64748b':'#fff')+';padding:.7rem;border-radius:8px;cursor:'+(boton.disabled?'not-allowed':'pointer')+';';
            boton.addEventListener('click',()=>solicitarCanjeTutor({id:recompensa.id,nombre:recompensa.nombre,puntos:costoPuntos,descripcion:recompensa.descripcion}));
            tarjeta.append(icono,titulo,descripcion,costo,boton);catalogo.appendChild(tarjeta);
        });
        const { data: canjes, error: errorCanjes } = await supabaseClient
            .from('canjes_puntos').select('id, beneficio, puntos, estado, creado_at')
            .eq('usuario_id', usuarioActual.id).order('creado_at', { ascending: false });
        if (errorCanjes) throw errorCanjes;
        historial.innerHTML = '';
        if (!canjes || canjes.length === 0) {
            historial.innerHTML = '<p style="color:#64748b;">Todavía no realizaste ningún canje.</p>';
            return;
        }
        canjes.forEach(canje => {
            const fila = document.createElement('div');
            fila.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:.8rem;border:1px solid #e2e8f0;border-radius:8px;';
            const info = document.createElement('div');
            const nombre = document.createElement('strong');
            nombre.textContent = canje.beneficio;
            const detalle = document.createElement('p');
            detalle.textContent = Number(canje.puntos) + ' puntos · ' + (canje.creado_at ? new Date(canje.creado_at).toLocaleDateString('es-AR') : 'Fecha no disponible');
            detalle.style.cssText = 'margin:.25rem 0 0;color:#64748b;font-size:.85rem;';
            info.append(nombre,detalle);
            const estado = document.createElement('span');
            const estadoNormalizado = String(canje.estado || 'pendiente').toLowerCase();
            estado.textContent = estadoNormalizado === 'confirmado' ? 'Confirmado' : estadoNormalizado === 'cancelado' ? 'Cancelado' : 'Pendiente de revisión';
            estado.style.cssText = 'background:'+(estadoNormalizado==='confirmado'?'#dcfce7':estadoNormalizado==='cancelado'?'#fee2e2':'#fef3c7')+';color:'+(estadoNormalizado==='confirmado'?'#166534':estadoNormalizado==='cancelado'?'#991b1b':'#92400e')+';padding:.35rem .6rem;border-radius:6px;font-size:.8rem;font-weight:600;';
            fila.append(info,estado);
            historial.appendChild(fila);
        });
    } catch (err) {
        console.error('Error al cargar catálogo de canjes:', err);
        catalogo.innerHTML = '<p style="color:#dc2626;">No se pudo cargar el catálogo. Verificá que las tablas y políticas de canjes estén configuradas en Supabase.</p>';
        historial.innerHTML = '<p style="color:#dc2626;">No se pudo cargar el historial de canjes.</p>';
    }
};

async function solicitarCanjeTutor(recompensa) {
    const confirmacion = await Swal.fire({
        title: '¿Solicitar este canje?',
        html: '<strong>' + recompensa.nombre + '</strong><br>Se solicitarán ' + recompensa.puntos + ' puntos. El saldo se descontará cuando el canje sea confirmado.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, solicitar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#713f12'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const { data: perfil, error: errorPerfil } = await supabaseClient
            .from('perfiles').select('puntos_gamificacion').eq('id', usuarioActual.id).single();
        if (errorPerfil) throw errorPerfil;
        if (Number(perfil?.puntos_gamificacion || 0) < recompensa.puntos) {
            mostrarNotificacion('No tenés puntos suficientes para este canje.', 'error');
            await cargarCatalogoCanjesTutor();
            return;
        }
        const { error } = await supabaseClient.rpc('solicitar_canje_recompensa', { p_recompensa_id: recompensa.id });
        if (error) throw error;
        mostrarNotificacion('Solicitud de canje enviada. Quedó pendiente de revisión.', 'exito');
        await cargarCatalogoCanjesTutor();
    } catch (err) {
        console.error('Error al solicitar canje:', err);
        mostrarNotificacion('No se pudo solicitar el canje. Revisá las políticas de canjes en Supabase.', 'error');
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


async function cargarReclamosTutor(usuarioId){
    const cont=document.getElementById('historialReclamosTutor');if(!cont)return;
    const {data,error}=await supabaseClient.from('reclamos_puntos').select('asunto,estado,respuesta_admin,creado_at').eq('usuario_id',usuarioId).order('creado_at',{ascending:false}).limit(20);
    cont.replaceChildren();if(error){cont.textContent='No se pudo cargar el historial de reclamos. Aplicá la migración administrativa.';return;}
    if(!data?.length){cont.textContent='Todavía no enviaste reclamos.';return;}
    data.forEach(item=>{const row=document.createElement('div');row.style.cssText='border-top:1px solid #e2e8f0;padding:.65rem 0;';const title=document.createElement('strong');title.textContent=item.asunto+' · '+item.estado;const response=document.createElement('p');response.style.cssText='margin:.25rem 0;color:#64748b;font-size:.85rem;';response.textContent=item.respuesta_admin?'Respuesta: '+item.respuesta_admin:'Sin respuesta del administrador todavía.';row.append(title,response);cont.appendChild(row);});
}
document.addEventListener('DOMContentLoaded',async()=>{
    const form=document.getElementById('formReclamoPuntosTutor');if(!form)return;
    const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;
    await cargarReclamosTutor(user.id);
    form.addEventListener('submit',async event=>{
        event.preventDefault();const asunto=document.getElementById('reclamoAsuntoTutor').value.trim(),descripcion=document.getElementById('reclamoDescripcionTutor').value.trim();
        if(asunto.length<3||descripcion.length<10){alert('Completá el asunto y el detalle del reclamo.');return;}
        const {error}=await supabaseClient.from('reclamos_puntos').insert({usuario_id:user.id,asunto,descripcion,estado:'pendiente'});
        if(error){alert('No se pudo enviar el reclamo: '+error.message);return;}form.reset();alert('Reclamo enviado.');await cargarReclamosTutor(user.id);
    });
});

async function cargarEstadisticasPersonalesTutor(){
    const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
    const actividad=document.getElementById('listaActividadTutor');if(actividad)actividad.textContent='Cargando actividad…';
    try{
        const [{data:reservas,error:errReservas},{data:resenas,error:errResenas},{data:perfil,error:errPerfil}]=await Promise.all([
            supabaseClient.from('reservas').select('id,materia,estado,fecha_hora,creado_at').eq('tutor_id',user.id).order('creado_at',{ascending:false}).limit(100),
            supabaseClient.from('resenas').select('calificacion,calificado_por').eq('tutor_id',user.id),
            supabaseClient.from('perfiles').select('puntos_gamificacion').eq('id',user.id).maybeSingle()
        ]);
        if(errReservas||errResenas||errPerfil)throw errReservas||errResenas||errPerfil;
        const finalizadas=(reservas||[]).filter(x=>String(x.estado||'').toLowerCase()==='finalizada');
        const recibidas=(resenas||[]).filter(x=>String(x.calificado_por||'estudiante').toLowerCase()!=='tutor').map(x=>Number(x.calificacion)).filter(x=>x>=1&&x<=5);
        const escritas=(resenas||[]).filter(x=>String(x.calificado_por||'').toLowerCase()==='tutor');
        set('estadisticaTutorFinalizadas',finalizadas.length);
        set('estadisticaTutorPromedio',recibidas.length?(recibidas.reduce((a,b)=>a+b,0)/recibidas.length).toFixed(1)+' / 5':'Sin notas');
        set('estadisticaTutorPuntos',Number(perfil?.puntos_gamificacion||0));
        set('estadisticaTutorResenasEscritas',escritas.length);
        const grafico=document.getElementById('graficoProgresoTutor');
        if(grafico){
            grafico.replaceChildren();
            const meses=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));return {key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('es-AR',{month:'short'})};});
            const conteos=meses.map(m=>({...m,total:finalizadas.filter(x=>{const d=new Date(x.fecha_hora||x.creado_at);return !Number.isNaN(d.getTime())&&d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')===m.key;}).length}));
            const max=Math.max(1,...conteos.map(x=>x.total));
            conteos.forEach(item=>{const col=document.createElement('div');col.style.cssText='min-width:52px;flex:1;display:flex;flex-direction:column;align-items:center;gap:.35rem;';
                const count=document.createElement('strong');count.textContent=String(item.total);count.style.cssText='font-size:.8rem;color:#334155;';
                const bar=document.createElement('div');bar.style.cssText='width:70%;min-height:4px;height:'+Math.max(4,item.total/max*90)+'px;background:#16a34a;border-radius:6px 6px 0 0;';
                const label=document.createElement('small');label.textContent=item.label;label.style.color='#64748b';col.append(count,bar,label);grafico.appendChild(col);
            });
        }
        if(actividad){
            actividad.replaceChildren();
            const recientes=(reservas||[]).slice(0,6);
            if(!recientes.length)actividad.textContent='Todavía no hay actividad registrada.';
            recientes.forEach(item=>{const row=document.createElement('div');row.style.cssText='padding:.65rem;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;';
                const label=document.createElement('span');label.textContent=(item.materia||'Tutoría')+' · '+(item.estado||'Sin estado');
                const date=document.createElement('small');date.style.color='#64748b';date.textContent=item.fecha_hora?new Date(item.fecha_hora).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'Fecha pendiente';
                row.append(label,date);actividad.appendChild(row);
            });
        }
    }catch(error){console.error('Error al cargar estadísticas del tutor:',error);if(actividad)actividad.textContent='No se pudieron cargar las estadísticas. Verificá los permisos de lectura.';}
}

document.addEventListener('DOMContentLoaded',()=>{
    const buscar=document.getElementById('buscarContactoChatTutor');
    if(buscar)buscar.addEventListener('input',()=>{
        const termino=buscar.value.trim().toLowerCase();
        document.querySelectorAll('#listaContactos > *').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(termino)?'':'none';});
    });
});
