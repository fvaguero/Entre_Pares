const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let reservasAdminCache = [];
const ESTADOS_PAGO_PAGADOS = ['pagado', 'pagada', 'completada', 'completado', 'liquidado', 'liquidada'];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const { data: perfil, error } = await supabaseClient
            .from('perfiles')
            .select('rol, nombre_completo')
            .eq('id', user.id)
            .single();

        if (error || !perfil || perfil.rol !== 'Administrador') {
            alert('Acceso denegado. Se requieren permisos de Administrador.');
            window.location.href = 'login.html';
            return;
        }
        const spanNombre = document.getElementById('nombreUsuarioHeader');
        if (spanNombre) spanNombre.textContent = perfil.nombre_completo || 'Administrador';
    } catch (err) {
        console.error('Error al validar rol admin:', err);
        alert('No se pudo validar el perfil de administrador.');
        window.location.href = 'login.html';
        return;
    }

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            if (window.Swal) {
                const result = await Swal.fire({
                    title: '¿Cerrar sesión?',
                    text: '¿Estás seguro que deseas salir de tu cuenta?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc2626',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Sí, salir',
                    cancelButtonText: 'Cancelar'
                });
                if (!result.isConfirmed) return;
            }
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    cargarTutoresPendientes();
    cargarTodasLasTutorias();
    cargarMetricas();
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
            contenedor.textContent = 'No hay tutores pendientes de validación.';
            return;
        }

        contenedor.replaceChildren();
        tutores.forEach(tutor => {
            const card = document.createElement('div');
            card.style.cssText = 'border:1px solid #e2e8f0;padding:1rem;border-radius:8px;background:white;box-shadow:0 1px 3px rgba(0,0,0,.05);';
            const title = document.createElement('h4');
            title.style.cssText = 'color:#0f172a;margin-bottom:.4rem;font-size:1rem;';
            title.textContent = '👤 ' + (tutor.nombre_completo || 'Sin nombre');
            card.appendChild(title);
            [
                ['Email', tutor.email || 'No disponible'],
                ['Sede', tutor.sede_universitaria || 'N/A'],
                ['Materias', tutor.materias_impartidas || 'No especificadas']
            ].forEach(([label, value]) => {
                const p = document.createElement('p');
                p.style.cssText = 'color:#475569;font-size:.85rem;margin:.2rem 0;';
                const strong = document.createElement('strong');
                strong.textContent = label + ': ';
                p.append(strong, document.createTextNode(value));
                card.appendChild(p);
            });
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:.5rem;margin-top:1rem;';
            [['Aprobar', 'Aprobado', '#16a34a'], ['Rechazar', 'Rechazado', '#dc2626']].forEach(([label, state, color]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn';
                button.textContent = label;
                button.style.cssText = 'background:' + color + ';color:white;flex:1;border:none;padding:.4rem;border-radius:4px;cursor:pointer;font-size:.8rem;font-weight:600;';
                button.addEventListener('click', () => cambiarEstadoTutor(tutor.id, state));
                actions.appendChild(button);
            });
            card.appendChild(actions);
            contenedor.appendChild(card);
        });
    } catch (err) {
        console.error('Error al cargar tutores pendientes:', err);
        contenedor.textContent = 'Error al cargar tutores. Revisá la consola para más detalles.';
    }
}

async function cambiarEstadoTutor(tutorId, nuevoEstado) {
    try {
        const { error } = await supabaseClient
            .from('perfiles')
            .update({ estado_verificacion: nuevoEstado })
            .eq('id', tutorId);
        if (error) throw error;
        alert('Tutor ' + nuevoEstado.toLowerCase() + ' con éxito.');
        await cargarTutoresPendientes();
        await cargarMetricas();
    } catch (err) {
        console.error('Error al actualizar tutor:', err);
        alert('No se pudo actualizar el estado del tutor.');
    }
}
window.cambiarEstadoTutor = cambiarEstadoTutor;

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
            const materias = [...new Set(reservasAdminCache.map(r => String(r.materia || '').trim()).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'es'));
            materiaSelect.replaceChildren(new Option('Todas las materias', ''));
            materias.forEach(materia => materiaSelect.add(new Option(materia, materia)));
            if (materias.includes(anterior)) materiaSelect.value = anterior;
        }
        renderizarTodasLasTutoriasAdmin();
    } catch (err) {
        console.error('Error al cargar tutorías:', err);
        contenedor.textContent = 'Error al cargar el historial de tutorías y pagos.';
    }
}

function normalizarEstadoAdmin(valor) {
    const estado = String(valor || 'Pendiente').trim().toLowerCase();
    if (['aceptada', 'aprobada', 'confirmada'].includes(estado)) return 'Aceptada';
    if (['finalizada', 'finalizado'].includes(estado)) return 'Finalizada';
    if (['rechazada', 'rechazado'].includes(estado)) return 'Rechazada';
    return 'Pendiente';
}
function fechaLocalArgentina(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(fecha);
    const valores = {};
    partes.forEach(parte => { if (parte.type !== 'literal') valores[parte.type] = parte.value; });
    return valores.year + '-' + valores.month + '-' + valores.day;
}
function estadoPagoNormalizado(reserva) {
    return String(reserva.estado_pago || 'Pendiente').trim().toLowerCase();
}
function esPagoPendiente(reserva) {
    return ['pendiente', 'pendiente de pago', 'a pagar'].includes(estadoPagoNormalizado(reserva));
}
function esPagoPagado(reserva) {
    return ESTADOS_PAGO_PAGADOS.includes(estadoPagoNormalizado(reserva));
}
function esTutoriaDeHoy(reserva) {
    if (!reserva.fecha_hora) return false;
    const fecha = new Date(reserva.fecha_hora);
    return !Number.isNaN(fecha.getTime()) && fechaLocalArgentina(fecha) === fechaLocalArgentina();
}
function actualizarResumenPagosAdmin() {
    const hoy = reservasAdminCache.filter(r => esTutoriaDeHoy(r) && esPagoPendiente(r));
    const pendientes = reservasAdminCache.filter(esPagoPendiente);
    const pagados = reservasAdminCache.filter(esPagoPagado);
    const sumar = lista => lista.reduce((total, reserva) => total + Number(reserva.precio || 0), 0);
    const formato = cantidad => cantidad.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('statPagosHoyAdmin', hoy.length + ' · ' + formato(sumar(hoy)));
    setText('statPagosPendientesAdmin', pendientes.length + ' · ' + formato(sumar(pendientes)));
    setText('statPagosPagadosAdmin', pagados.length + ' · ' + formato(sumar(pagados)));
}

function renderizarTodasLasTutoriasAdmin() {
    const contenedor = document.getElementById('listaTodasTutorias');
    if (!contenedor) return;
    const materia = (document.getElementById('filtroMateriaAdmin')?.value || '').trim().toLowerCase();
    const estadoReserva = document.getElementById('filtroEstadoReservaAdmin')?.value || '';
    const estadoPago = document.getElementById('filtroEstadoPagoAdmin')?.value || '';
    const vistaPago = document.getElementById('filtroVistaPagoAdmin')?.value || '';
    actualizarResumenPagosAdmin();

    const reservas = reservasAdminCache.filter(reserva => {
        const coincideMateria = !materia || String(reserva.materia || '').trim().toLowerCase() === materia;
        const coincideReserva = !estadoReserva || normalizarEstadoAdmin(reserva.estado) === estadoReserva;
        const coincideEstadoPago = !estadoPago || String(reserva.estado_pago || 'Pendiente').trim() === estadoPago;
        let coincideVistaPago = true;
        if (vistaPago === 'pagar_hoy') coincideVistaPago = esTutoriaDeHoy(reserva) && esPagoPendiente(reserva);
        if (vistaPago === 'pendientes') coincideVistaPago = esPagoPendiente(reserva);
        if (vistaPago === 'pagados') coincideVistaPago = esPagoPagado(reserva);
        return coincideMateria && coincideReserva && coincideEstadoPago && coincideVistaPago;
    });

    contenedor.replaceChildren();
    const contador = document.createElement('p');
    contador.style.cssText = 'color:#64748b;font-size:.82rem;margin:0 0 .5rem;';
    contador.textContent = 'Resultados: ' + reservas.length;
    contenedor.appendChild(contador);
    if (!reservas.length) {
        const vacio = document.createElement('p');
        vacio.style.cssText = 'color:#64748b;font-size:.85rem;text-align:center;';
        vacio.textContent = 'No hay tutorías que coincidan con los filtros.';
        contenedor.appendChild(vacio);
        return;
    }

    reservas.forEach(reserva => {
        const fecha = reserva.fecha_hora && !Number.isNaN(new Date(reserva.fecha_hora).getTime())
            ? new Date(reserva.fecha_hora).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
            : 'Fecha a coordinar';
        const estadoPago = reserva.estado_pago || 'Pendiente';
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e2e8f0;padding:.9rem 1rem;border-radius:8px;background:white;font-size:.85rem;';
        const title = document.createElement('strong');
        title.style.cssText = 'color:#0f172a;font-size:.95rem;';
        title.textContent = reserva.materia || 'Tutoría';
        const details = document.createElement('div');
        details.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.35rem .8rem;margin-top:.45rem;color:#475569;';
        const fields = [
            ['Estudiante (paga)', reserva.estudiante?.nombre_completo || 'No disponible'],
            ['Tutor (recibe)', reserva.tutor?.nombre_completo || 'No disponible'],
            ['Fecha de tutoría', fecha],
            ['Estado de tutoría', normalizarEstadoAdmin(reserva.estado)],
            ['Importe', Number(reserva.precio || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })],
            ['Estado del pago', estadoPago]
        ];
        fields.forEach(([label, value]) => {
            const p = document.createElement('p');
            p.style.margin = '0';
            const strong = document.createElement('strong');
            strong.textContent = label + ': ';
            p.append(strong, document.createTextNode(value));
            details.appendChild(p);
        });
        card.append(title, details);
        contenedor.appendChild(card);
    });
}

['filtroMateriaAdmin', 'filtroEstadoReservaAdmin', 'filtroEstadoPagoAdmin', 'filtroVistaPagoAdmin'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderizarTodasLasTutoriasAdmin);
});
document.getElementById('limpiarFiltrosAdmin')?.addEventListener('click', () => {
    ['filtroMateriaAdmin', 'filtroEstadoReservaAdmin', 'filtroEstadoPagoAdmin', 'filtroVistaPagoAdmin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderizarTodasLasTutoriasAdmin();
});

async function cargarMetricas() {
    try {
        const [{ count: totalUsuarios, error: errorUsuarios }, { count: tutoresAprobados, error: errorTutores }, { count: totalReservas, error: errorReservas }] = await Promise.all([
            supabaseClient.from('perfiles').select('*', { count: 'exact', head: true }),
            supabaseClient.from('perfiles').select('*', { count: 'exact', head: true }).eq('estado_verificacion', 'Aprobado'),
            supabaseClient.from('reservas').select('*', { count: 'exact', head: true })
        ]);
        if (errorUsuarios || errorTutores || errorReservas) throw errorUsuarios || errorTutores || errorReservas;
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('statUsuarios', totalUsuarios || 0);
        setText('statTutores', tutoresAprobados || 0);
        setText('statReservas', totalReservas || 0);
    } catch (err) {
        console.error('Error al cargar métricas:', err);
    }
}
