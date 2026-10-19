const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let reservasAdminCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Verificar rol Administrador
    try {
        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('rol, nombre_completo')
            .eq('id', user.id)
            .single();

        if (!perfil || perfil.rol !== 'Administrador') {
            alert("Acceso denegado. Se requieren permisos de Administrador.");
            window.location.href = 'login.html';
            return;
        }

        const spanNombre = document.getElementById('nombreUsuarioHeader');
        if (spanNombre) {
            spanNombre.textContent = perfil.nombre_completo || 'Administrador';
        }
    } catch (err) {
        console.error("Error al validar rol admin:", err);
    }

    // Botón Cerrar Sesión
    document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

    // Cargar datos de administración
    cargarTutoresPendientes();
    cargarTodasLasTutorias();
    cargarMetricas();
});
 // 5. Botón Cerrar Sesión (Con SweetAlert2)
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

async function cargarTutoresPendientes() {
    const contenedor = document.getElementById('listaTutoresPendientes');
    if (!contenedor) return;

    try {
        const { data: tutores, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .in('rol', ['Tutor', 'Ambos'])
            .eq('estado_verificacion', 'Pendiente');

        if (error) throw error;

        if (!tutores || tutores.length === 0) {
            contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">No hay tutores pendientes de validación.</p>`;
            return;
        }

        contenedor.innerHTML = tutores.map(tutor => `
            <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h4 style="color: #0f172a; margin-bottom: 0.4rem; font-size: 1rem;">👤 ${tutor.nombre_completo || 'Sin nombre'}</h4>
                <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;"><strong>Email:</strong> ${tutor.email}</p>
                <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;"><strong>Sede:</strong> ${tutor.sede_universitaria || 'N/A'}</p>
                <p style="color: #475569; font-size: 0.85rem; margin: 0.2rem 0;"><strong>Materias:</strong> ${tutor.materias_impartidas || 'No especificadas'}</p>
                
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button onclick="cambiarEstadoTutor('${tutor.id}', 'Aprobado')" class="btn" style="background: #16a34a; color: white; flex: 1; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Aprobar</button>
                    <button onclick="cambiarEstadoTutor('${tutor.id}', 'Rechazado')" class="btn" style="background: #dc2626; color: white; flex: 1; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Rechazar</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error al cargar tutores pendientes:", err);
        contenedor.innerHTML = `<p style="color: #dc2626; font-size: 0.85rem; text-align: center; grid-column: 1/-1;">Error al cargar tutores.</p>`;
    }
}

window.cambiarEstadoTutor = async function(tutorId, nuevoEstado) {
    try {
        const { error } = await supabaseClient
            .from('perfiles')
            .update({ estado_verificacion: nuevoEstado })
            .eq('id', tutorId);

        if (error) throw error;

        alert(`Tutor ${nuevoEstado.toLowerCase()} con éxito.`);
        cargarTutoresPendientes();
        cargarMetricas();
    } catch (err) {
        console.error("Error al actualizar tutor:", err);
        alert("No se pudo actualizar el estado del tutor.");
    }
};

async function cargarTodasLasTutorias() {
    const contenedor = document.getElementById('listaTodasTutorias');
    if (!contenedor) return;
    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select('*, estudiante:estudiante_id (nombre_completo), tutor:tutor_id (nombre_completo)')
            .order('fecha_hora', { ascending: false });
        if (error) throw error;
        reservasAdminCache = reservas || [];
        const materiaSelect = document.getElementById('filtroMateriaAdmin');
        if (materiaSelect) {
            const anterior = materiaSelect.value;
            const materias = [...new Set(reservasAdminCache.map(r => String(r.materia || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
            materiaSelect.innerHTML = '<option value="">Todas las materias</option>';
            materias.forEach(m => { const op=document.createElement('option'); op.value=m; op.textContent=m; materiaSelect.appendChild(op); });
            if (materias.includes(anterior)) materiaSelect.value = anterior;
        }
        renderizarTodasLasTutoriasAdmin();
    } catch (err) {
        console.error('Error al cargar tutorías:', err);
        contenedor.innerHTML = '<p style="color:#dc2626;font-size:.85rem;text-align:center;">Error al cargar el historial.</p>';
    }
}
function normalizarEstadoAdmin(valor) {
    const estado = String(valor || 'Pendiente').trim().toLowerCase();
    if (['aceptada','aprobada','confirmada'].includes(estado)) return 'Aceptada';
    if (['finalizada','finalizado'].includes(estado)) return 'Finalizada';
    if (['rechazada','rechazado'].includes(estado)) return 'Rechazada';
    return 'Pendiente';
}
function renderizarTodasLasTutoriasAdmin() {
    const contenedor = document.getElementById('listaTodasTutorias');
    if (!contenedor) return;
    const materia = (document.getElementById('filtroMateriaAdmin')?.value || '').trim().toLowerCase();
    const estadoReserva = document.getElementById('filtroEstadoReservaAdmin')?.value || '';
    const estadoPago = document.getElementById('filtroEstadoPagoAdmin')?.value || '';
    const reservas = reservasAdminCache.filter(r =>
        (!materia || String(r.materia || '').trim().toLowerCase() === materia) &&
        (!estadoReserva || normalizarEstadoAdmin(r.estado) === estadoReserva) &&
        (!estadoPago || (r.estado_pago || 'Pendiente') === estadoPago)
    );
    contenedor.innerHTML = '';
    if (!reservas.length) {
        contenedor.innerHTML = '<p style="color:#64748b;font-size:.85rem;text-align:center;">No hay tutorías que coincidan con los filtros.</p>';
        return;
    }
    reservas.forEach(res => {
        const fecha = res.fecha_hora && !Number.isNaN(new Date(res.fecha_hora).getTime())
            ? new Date(res.fecha_hora).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' })
            : 'Fecha a coordinar';
        const estadoPago = res.estado_pago || 'Pendiente';
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e2e8f0;padding:.9rem 1rem;border-radius:8px;background:white;font-size:.85rem;';
        const title = document.createElement('strong');
        title.style.cssText = 'color:#0f172a;font-size:.95rem;';
        title.textContent = res.materia || 'Tutoría';
        const details = document.createElement('div');
        details.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.35rem .8rem;margin-top:.45rem;color:#475569;';
        const fields = [
            ['Estudiante (paga)', res.estudiante?.nombre_completo || 'No disponible'],
            ['Tutor (recibe)', res.tutor?.nombre_completo || 'No disponible'],
            ['Fecha', fecha],
            ['Estado de tutoría', normalizarEstadoAdmin(res.estado)],
            ['Importe', '$' + Number(res.precio || 0).toLocaleString('es-AR') + ' ARS'],
            ['Estado del pago', estadoPago]
        ];
        fields.forEach(([label,value]) => {
            const p = document.createElement('p');
            p.style.margin = '0';
            const b = document.createElement('strong');
            b.textContent = label + ': ';
            p.append(b, document.createTextNode(value));
            details.appendChild(p);
        });
        card.append(title, details);
        contenedor.appendChild(card);
    });
}
['filtroMateriaAdmin','filtroEstadoReservaAdmin','filtroEstadoPagoAdmin'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderizarTodasLasTutoriasAdmin);
});
document.getElementById('limpiarFiltrosAdmin')?.addEventListener('click', () => {
    ['filtroMateriaAdmin','filtroEstadoReservaAdmin','filtroEstadoPagoAdmin'].forEach(id => {
        const el=document.getElementById(id); if(el) el.value='';
    });
    renderizarTodasLasTutoriasAdmin();
});

async function cargarMetricas() {
    try {
        const { count: totalUsuarios } = await supabaseClient.from('perfiles').select('*', { count: 'exact', head: true });
        const { count: tutoresAprobados } = await supabaseClient.from('perfiles').select('*', { count: 'exact', head: true }).eq('estado_verificacion', 'Aprobado');
        const { count: totalReservas } = await supabaseClient.from('reservas').select('*', { count: 'exact', head: true });

        document.getElementById('statUsuarios').textContent = totalUsuarios || 0;
        document.getElementById('statTutores').textContent = tutoresAprobados || 0;
        document.getElementById('statReservas').textContent = totalReservas || 0;
    } catch (err) {
        console.error("Error al cargar métricas:", err);
    }
} }