const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }

    // 🔒 DOBLE SEGURIDAD: Validación por correo institucional y de administrador
    const CORREO_ADMIN = 'valentinaseco2004@gmail.com';
    
    if (user.email !== CORREO_ADMIN) {
        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('rol')
            .eq('id', user.id)
            .single();

        if (!perfil || perfil.rol !== 'Administrador') {
            alert("Acceso denegado. No tienes permisos de administrador.");
            window.location.href = 'index.html';
            return;
        }
    }

    await cargarDatosAdminFinanzas();
    await cargarDatosAdminUsuarios();
    await cargarDatosAdminReservas();

    const btnCerrarSesion = document.getElementById('btnCerrarSesionAdmin');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }
});

// 1. CARGAR FINANZAS Y LIQUIDACIONES
async function cargarDatosAdminFinanzas() {
    const tbody = document.getElementById('tablaAdminFinanzas');
    if (!tbody) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`
                id,
                materia,
                precio,
                estado_pago,
                creado_at,
                estudiante:estudiante_id (nombre_completo, email),
                tutor:tutor_id (nombre_completo, cvu_alias)
            `)
            .order('id', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        if (!reservas || reservas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No hay registros financieros.</td></tr>`;
            return;
        }

        let totalRecaudado = 0;
        let pendientesLiquidacion = 0;
        let totalLiquidadas = 0;

        reservas.forEach(res => {
            const estado = res.estado_pago || 'Pendiente';
            const monto = Number(res.precio) || 0;

            if (estado === 'Pagado' || estado === 'Completada') {
                totalRecaudado += monto;
                pendientesLiquidacion++;
            } else if (estado === 'Liquidado') {
                totalLiquidadas++;
            }

            let badgeBg = '#f1f5f9', badgeColor = '#475569';
            if (estado === 'Pagado') { badgeBg = '#fef08a'; badgeColor = '#713f12'; }
            else if (estado === 'Completada') { badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; }
            else if (estado === 'Liquidado') { badgeBg = '#dcfce7'; badgeColor = '#166534'; }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="padding: 1rem; color: #1e293b; font-weight: 500;">
                    ${res.estudiante?.nombre_completo || 'Estudiante'}
                    <div style="font-size: 0.75rem; color: #64748b;">${res.estudiante?.email || ''}</div>
                </td>
                <td style="padding: 1rem; color: #475569;">
                    <strong>${res.tutor?.nombre_completo || 'Tutor'}</strong>
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 600;">CVU/Alias: ${res.tutor?.cvu_alias || 'No configurado'}</div>
                </td>
                <td style="padding: 1rem; color: #475569;">${res.materia}</td>
                <td style="padding: 1rem; color: #1e293b; font-weight: 600;">$${monto} ARS</td>
                <td style="padding: 1rem;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                        ${estado}
                    </span>
                </td>
                <td style="padding: 1rem; text-align: center;">
                    ${estado !== 'Liquidado' ? `
                        <button onclick="liquidarPago('${res.id}', '${res.tutor?.cvu_alias || ''}')" class="btn" style="background: #16a34a; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
                            💸 Liquidar
                        </button>
                    ` : `
                        <span style="color: #16a34a; font-size: 0.8rem; font-weight: 600;">✓ Transferido</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('kpiRecaudado').textContent = `$${totalRecaudado} ARS`;
        document.getElementById('kpiPendientes').textContent = pendientesLiquidacion;
        document.getElementById('kpiLiquidadas').textContent = totalLiquidadas;

    } catch (err) {
        console.error("Error al cargar finanzas:", err.message);
    }
}

// 2. CARGAR DIRECTORIO DE USUARIOS
async function cargarDatosAdminUsuarios() {
    const tbody = document.getElementById('tablaAdminUsuarios');
    if (!tbody) return;

    try {
        const { data: perfiles, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .order('nombre_completo', { ascending: true });

        if (error) throw error;

        tbody.innerHTML = '';
        if (!perfiles || perfiles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No hay usuarios registrados.</td></tr>`;
            return;
        }

        perfiles.forEach(p => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="padding: 1rem; color: #1e293b; font-weight: 500;">${p.nombre_completo || 'Sin nombre'}</td>
                <td style="padding: 1rem; color: #475569;">${p.email || 'Sin correo'}</td>
                <td style="padding: 1rem;"><span style="background: #f1f5f9; color: #1e293b; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${p.rol || 'Estudiante'}</span></td>
                <td style="padding: 1rem; color: #475569;">${p.sede_universitaria || 'No especificada'}</td>
                <td style="padding: 1rem; color: #d97706; font-weight: bold;">⭐ ${p.puntos_gamificacion || 0} pts</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al cargar usuarios:", err);
    }
}

// 3. CARGAR AUDITORÍA GENERAL DE RESERVAS
async function cargarDatosAdminReservas() {
    const tbody = document.getElementById('tablaAdminTodasReservas');
    if (!tbody) return;

    try {
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`
                id,
                materia,
                estado,
                comentarios,
                estudiante:estudiante_id (nombre_completo),
                tutor:tutor_id (nombre_completo)
            `)
            .order('id', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        if (!reservas || reservas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No hay reservas registradas.</td></tr>`;
            return;
        }

        reservas.forEach(res => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="padding: 1rem; color: #1e293b; font-weight: 500;">${res.materia}</td>
                <td style="padding: 1rem; color: #475569;">${res.estudiante?.nombre_completo || 'Estudiante'}</td>
                <td style="padding: 1rem; color: #475569;">${res.tutor?.nombre_completo || 'Tutor'}</td>
                <td style="padding: 1rem;"><span style="background: #e2e8f0; color: #1e293b; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${res.estado || 'Pendiente'}</span></td>
                <td style="padding: 1rem; color: #64748b; font-size: 0.85rem;">${res.comentarios || 'Sin notas'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al cargar reservas:", err);
    }
}

// Acción de liquidar pago
window.liquidarPago = async function(reservaId, cvuAlias) {
    if (!cvuAlias || cvuAlias === 'No configurado') {
        if (!confirm("⚠️ Este tutor no tiene CVU/Alias registrado. ¿Marcar como liquidado de todos modos?")) return;
    } else {
        alert(`👉 Realiza la transferencia al CVU/Alias: ${cvuAlias} antes de confirmar.`);
    }

    try {
        const { error } = await supabaseClient
            .from('reservas')
            .update({ estado_pago: 'Liquidado' })
            .eq('id', reservaId);

        if (error) throw error;
        alert("¡Pago liquidado con éxito!");
        await cargarDatosAdminFinanzas();
    } catch (err) {
        console.error("Error al liquidar:", err);
        alert("No se pudo actualizar el estado.");
    }
};