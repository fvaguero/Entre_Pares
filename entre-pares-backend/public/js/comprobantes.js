/* Comprobantes de pago para estudiante, tutor y administrador. */
(() => {
    const URL = 'https://uecwotydamsjstpovbzz.supabase.co';
    const KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
    const client = window.supabase.createClient(URL, KEY);
    const PAGADOS = ['pagado','pagada','aprobado','aprobada','completado','completada','acreditado','acreditada','liquidado','liquidada'];

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fecha = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'})
        : 'No registrada';

    async function iniciarComprobantes() {
        const contenedor = document.getElementById('listaComprobantes');
        if (!contenedor) return;
        contenedor.textContent = 'Cargando comprobantes…';
        try {
            const {data:{user},error:userError} = await client.auth.getUser();
            if (userError || !user) throw new Error('Tu sesión no está disponible. Iniciá sesión nuevamente.');
            const {data:perfil,error:perfilError} = await client.from('perfiles').select('rol').eq('id',user.id).single();
            if (perfilError || !perfil) throw perfilError || new Error('No se pudo identificar tu rol.');

            let consulta = client.from('reservas')
                .select('*, estudiante:estudiante_id (nombre_completo, email), tutor:tutor_id (nombre_completo, email)')
                .order('creado_at',{ascending:false});
            if (perfil.rol === 'Estudiante') consulta = consulta.eq('estudiante_id',user.id);
            else if (perfil.rol === 'Tutor') consulta = consulta.eq('tutor_id',user.id);
            else if (perfil.rol !== 'Administrador') throw new Error('Tu rol no tiene acceso a los comprobantes.');
            const {data:reservas,error} = await consulta;
            if (error) throw error;

            contenedor.replaceChildren();
            const confirmados = (reservas || []).filter(r => PAGADOS.includes(String(r.estado_pago || '').trim().toLowerCase()));
            if (!confirmados.length) {
                contenedor.textContent = 'Todavía no hay comprobantes disponibles. Se mostrarán cuando el pago esté confirmado.';
                return;
            }
            confirmados.forEach(r => {
                const card = document.createElement('article');
                card.style.cssText='border:1px solid #e2e8f0;border-radius:10px;padding:1rem;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;';
                const info = document.createElement('div');
                const titulo = document.createElement('strong');
                titulo.textContent = r.materia || 'Tutoría';
                const detalle = document.createElement('p');
                detalle.style.cssText='margin:.35rem 0;color:#64748b;font-size:.88rem;';
                detalle.textContent = (r.estudiante?.nombre_completo || 'Estudiante') + ' · ' + (r.tutor?.nombre_completo || 'Tutor') + ' · ' + fecha(r.fecha_hora);
                const importe = document.createElement('p');
                importe.style.cssText='margin:0;font-weight:700;color:#166534;';
                importe.textContent = Number(r.precio || 0).toLocaleString('es-AR',{style:'currency',currency:'ARS'}) + ' · ' + (r.estado_pago || 'Pagado');
                info.append(titulo,detalle,importe);
                const boton = document.createElement('button');
                boton.type='button'; boton.className='btn';
                boton.textContent='🧾 Ver / imprimir comprobante';
                boton.style.cssText='background:#dcfce7;color:#166534;padding:.65rem .9rem;';
                boton.addEventListener('click',()=>imprimirComprobante(r));
                card.append(info,boton);
                contenedor.appendChild(card);
            });
        } catch (error) {
            console.error('Error al cargar comprobantes:',error);
            contenedor.textContent = 'No se pudieron cargar los comprobantes. Verificá los permisos de lectura de reservas en Supabase.';
        }
    }

    function imprimirComprobante(r) {
        const win = window.open('','_blank');
        if (!win) { alert('Permití las ventanas emergentes para abrir el comprobante.'); return; }
        const numero = 'EP-' + String(r.id || '').replace(/[^a-z0-9]/gi,'').slice(-12).toUpperCase();
        const estado = String(r.estado_pago || '').trim();
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante ${esc(numero)} · Entre Pares</title>
        <style>body{font-family:Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px}.ticket{max-width:720px;margin:auto;background:white;padding:30px;border:1px solid #e2e8f0;border-radius:14px}h1{color:#1d4ed8;margin:0}.sub{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}.field{background:#f8fafc;padding:12px;border-radius:8px}.label{display:block;font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:5px}.value{font-weight:600;overflow-wrap:anywhere}.total{margin-top:20px;padding:18px;background:#eff6ff;border-radius:8px;font-size:24px;font-weight:bold;color:#1d4ed8}.note{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.5}button{display:block;margin:20px auto;padding:12px 20px;background:#1d4ed8;color:white;border:0;border-radius:7px}@media print{body{background:white;padding:0}.ticket{border:0}.no-print{display:none}}@media(max-width:520px){.grid{grid-template-columns:1fr}}</style></head><body><main class="ticket">
        <h1>ENTRE PARES</h1><p class="sub">Comprobante interno de pago de tutoría</p>
        <div class="grid">
        <div class="field"><span class="label">Número de comprobante</span><span class="value">${esc(numero)}</span></div>
        <div class="field"><span class="label">Fecha de emisión</span><span class="value">${esc(fecha(new Date()))}</span></div>
        <div class="field"><span class="label">Estudiante</span><span class="value">${esc(r.estudiante?.nombre_completo || r.estudiante?.email || 'No disponible')}</span></div>
        <div class="field"><span class="label">Tutor/a</span><span class="value">${esc(r.tutor?.nombre_completo || r.tutor?.email || 'No disponible')}</span></div>
        <div class="field"><span class="label">Materia</span><span class="value">${esc(r.materia || 'Tutoría')}</span></div>
        <div class="field"><span class="label">Fecha de tutoría</span><span class="value">${esc(fecha(r.fecha_hora))}</span></div>
        <div class="field"><span class="label">Fecha de pago</span><span class="value">${esc(fecha(r.mercadopago_paid_at || r.fecha_pago))}</span></div>
        <div class="field"><span class="label">Estado del pago</span><span class="value">${esc(estado)}</span></div>
        <div class="field"><span class="label">Medio de pago</span><span class="value">${esc(r.mercadopago_payment_type || 'No informado')}</span></div>
        <div class="field"><span class="label">Identificador de operación</span><span class="value">${esc(r.mercadopago_payment_id || 'No disponible')}</span></div></div>
        <div class="total">${esc(Number(r.precio || 0).toLocaleString('es-AR',{style:'currency',currency:'ARS'}))} ARS</div>
        <p class="note">Documento interno emitido por Entre Pares según los datos registrados en la plataforma. No constituye factura ni comprobante fiscal de AFIP/ARCA.</p>
        <button class="no-print" onclick="window.print()">Imprimir / Guardar como PDF</button></main></body></html>`;
        win.document.open(); win.document.write(html); win.document.close();
    }

    window.cargarComprobantes = iniciarComprobantes;
    document.addEventListener('DOMContentLoaded', iniciarComprobantes);
})();
