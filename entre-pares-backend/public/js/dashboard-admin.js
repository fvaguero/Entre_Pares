const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            .select(`*, estudiante:estudiante_id (nombre_completo), tutor:tutor_id (nombre_completo)`)
            .order('fecha_hora', { ascending: false });

        if (error) throw error;

        if (!reservas || reservas.length === 0) {
            contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No hay tutorías registradas.</p>`;
            return;
        }

        contenedor.innerHTML = reservas.map(res => {
            const fecha = new Date(res.fecha_hora).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
            return `
                <div style="border: 1px solid #e2e8f0; padding: 0.8rem 1rem; border-radius: 6px; background: white; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <div>
                        <strong style="color: #0f172a;">${res.materia}</strong><br>
                        <span style="color: #475569;">Estudiante: ${res.estudiante?.nombre_completo || 'N/A'} | Tutor: ${res.tutor?.nombre_completo || 'N/A'}</span><br>
                        <span style="color: #64748b; font-size: 0.75rem;">Fecha: ${fecha}</span>
                    </div>
                    <span style="background: #e2e8f0; color: #1e293b; padding: 3px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 0.7rem;">${res.estado}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar tutorías:", err);
        contenedor.innerHTML = `<p style="color: #dc2626; font-size: 0.85rem; text-align: center;">Error al cargar el historial.</p>`;
    }
}

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
}