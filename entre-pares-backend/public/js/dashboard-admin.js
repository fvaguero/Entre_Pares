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
    inicializarHerramientasPuntosAdmin();
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

['filtroMateriaAdmin', 'filtroEstadoReservaAdmin', 'filtroEstadoPagoAdmin'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderizarTodasLasTutoriasAdmin);
});
document.getElementById('filtroVistaPagoAdmin')?.addEventListener('change', () => {
    const estadoPago = document.getElementById('filtroEstadoPagoAdmin');
    if (estadoPago) estadoPago.value = '';
    renderizarTodasLasTutoriasAdmin();
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
        const [
            {count:totalUsuarios,error:errorUsuarios},
            {count:tutoresAprobados,error:errorTutores},
            {count:totalReservas,error:errorReservas},
            {count:finalizadas,error:errorFinalizadas},
            {data:resenas,error:errorResenas},
            {data:movimientos,error:errorMovimientos},
            {count:canjesPendientes,error:errorCanjes},
            {count:reclamosPendientes,error:errorReclamos}
        ] = await Promise.all([
            supabaseClient.from('perfiles').select('*',{count:'exact',head:true}),
            supabaseClient.from('perfiles').select('*',{count:'exact',head:true}).eq('estado_verificacion','Aprobado'),
            supabaseClient.from('reservas').select('*',{count:'exact',head:true}),
            supabaseClient.from('reservas').select('*',{count:'exact',head:true}).ilike('estado','finalizada'),
            supabaseClient.from('resenas').select('calificacion'),
            supabaseClient.from('movimientos_puntos').select('puntos'),
            supabaseClient.from('canjes_puntos').select('*',{count:'exact',head:true}).ilike('estado','pendiente'),
            supabaseClient.from('reclamos_puntos').select('*',{count:'exact',head:true}).in('estado',['pendiente','en_revision'])
        ]);
        if(errorUsuarios||errorTutores||errorReservas) throw errorUsuarios||errorTutores||errorReservas;
        const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
        setText('statUsuarios',totalUsuarios||0);
        setText('statTutores',tutoresAprobados||0);
        setText('statReservas',totalReservas||0);
        setText('statFinalizadasAdmin',errorFinalizadas?'—':(finalizadas||0));
        const notas=(resenas||[]).map(x=>Number(x.calificacion)).filter(x=>x>=1&&x<=5);
        setText('statPromedioResenasAdmin',errorResenas?'—':(notas.length?(notas.reduce((a,b)=>a+b,0)/notas.length).toFixed(2):'Sin datos'));
        setText('statPuntosAdmin',errorMovimientos?'—':(movimientos||[]).reduce((sum,x)=>sum+(Number(x.puntos||0)>0?Number(x.puntos):0),0));
        setText('statCanjesPendientesAdmin',errorCanjes?'—':(canjesPendientes||0));
        setText('statReclamosPendientesAdmin',errorReclamos?'—':(reclamosPendientes||0));
    } catch(err) {
        console.error('Error al cargar métricas:',err);
    }
}


function inicializarHerramientasPuntosAdmin() {
    const formAjuste=document.getElementById('formAjustePuntosAdmin');
    if(formAjuste) formAjuste.addEventListener('submit',async event=>{
        event.preventDefault();
        const usuarioId=document.getElementById('ajusteUsuarioId').value.trim();
        const puntos=Number(document.getElementById('ajustePuntos').value);
        const referencia=document.getElementById('ajusteReferencia').value.trim();
        const descripcion=document.getElementById('ajusteDescripcion').value.trim();
        if(!usuarioId||!Number.isInteger(puntos)||puntos===0||!referencia||descripcion.length<5){alert('Completá todos los campos con valores válidos.');return;}
        const {data,error}=await supabaseClient.rpc('admin_ajustar_puntos',{p_usuario_id:usuarioId,p_puntos:puntos,p_descripcion:descripcion,p_referencia_id:referencia});
        if(error){alert('No se pudo registrar el ajuste: '+error.message);return;}
        if(data===false){alert('Esta operación ya se había registrado con esa referencia.');return;}
        formAjuste.reset();alert('Ajuste registrado correctamente.');await cargarPanelPuntosAdmin();await cargarMetricas();
    });
    const formRecompensa=document.getElementById('formRecompensaAdmin');
    if(formRecompensa) formRecompensa.addEventListener('submit',async event=>{
        event.preventDefault();
        const nombre=document.getElementById('recompensaNombre').value.trim(),costo=Number(document.getElementById('recompensaCosto').value),descripcion=document.getElementById('recompensaDescripcion').value.trim();
        if(nombre.length<3||!Number.isInteger(costo)||costo<1){alert('Revisá el nombre y el costo.');return;}
        const {data:{user}}=await supabaseClient.auth.getUser();
        const {error}=await supabaseClient.from('recompensas_puntos').insert({nombre,costo_puntos:costo,descripcion,activa:true,creado_por:user.id});
        if(error){alert('No se pudo crear la recompensa: '+error.message);return;}
        formRecompensa.reset();await cargarRecompensasAdmin();
    });
}
function crearTablaAdmin(contenedor,encabezados,filas){
    if(!contenedor)return;contenedor.replaceChildren();if(!filas.length){contenedor.textContent='No hay registros para mostrar.';return;}
    const tabla=document.createElement('table');tabla.style.cssText='width:100%;border-collapse:collapse;font-size:.85rem;';
    const thead=document.createElement('thead'),hr=document.createElement('tr');
    encabezados.forEach(t=>{const th=document.createElement('th');th.textContent=t;th.style.cssText='text-align:left;padding:.65rem;border-bottom:1px solid #e2e8f0;';hr.appendChild(th);});
    thead.appendChild(hr);tabla.appendChild(thead);const tbody=document.createElement('tbody');
    filas.forEach(celdas=>{const tr=document.createElement('tr');celdas.forEach(celda=>{const td=document.createElement('td');td.style.cssText='padding:.65rem;border-bottom:1px solid #f1f5f9;vertical-align:top;';if(celda instanceof Node)td.appendChild(celda);else td.textContent=String(celda??'');tr.appendChild(td);});tbody.appendChild(tr);});
    tabla.appendChild(tbody);contenedor.appendChild(tabla);
}
function botonAdmin(texto,color,accion){const b=document.createElement('button');b.type='button';b.textContent=texto;b.style.cssText='border:0;border-radius:5px;padding:.4rem .6rem;margin:.1rem;background:'+color+';color:white;cursor:pointer;';b.addEventListener('click',accion);return b;}
async function cargarPanelPuntosAdmin(){
    const canjesCont=document.getElementById('listaCanjesAdmin'),movCont=document.getElementById('listaMovimientosPuntosAdmin');
    try{
        const [{data:canjes,error:errCanjes},{data:movimientos,error:errMov}]=await Promise.all([
            supabaseClient.from('canjes_puntos').select('id,usuario_id,beneficio,puntos,estado,creado_at').order('creado_at',{ascending:false}).limit(100),
            supabaseClient.from('movimientos_puntos').select('id,usuario_id,tipo,referencia_id,puntos,descripcion,creado_at').order('creado_at',{ascending:false}).limit(100)
        ]);
        if(errCanjes)throw errCanjes;if(errMov)throw errMov;
        const pendientes=(canjes||[]).filter(x=>String(x.estado).toLowerCase()==='pendiente');
        crearTablaAdmin(canjesCont,['Usuario','Recompensa','Costo','Fecha','Acciones'],pendientes.map(x=>{const a=document.createElement('div');a.append(botonAdmin('Confirmar','#15803d',()=>resolverCanjeAdmin(x.id,'confirmar')),botonAdmin('Rechazar','#b91c1c',()=>resolverCanjeAdmin(x.id,'rechazar')));return[x.usuario_id,x.beneficio,x.puntos,new Date(x.creado_at).toLocaleString('es-AR'),a];}));
        crearTablaAdmin(movCont,['Fecha','Usuario','Tipo','Puntos','Descripción / referencia'],(movimientos||[]).map(x=>[new Date(x.creado_at).toLocaleString('es-AR'),x.usuario_id,x.tipo,(x.puntos>0?'+':'')+x.puntos,x.descripcion+' · '+x.referencia_id]));
    }catch(error){if(canjesCont)canjesCont.textContent='No se pudieron cargar los canjes. Aplicá la migración del panel administrativo y revisá las políticas RLS.';if(movCont)movCont.textContent='No se pudieron cargar los movimientos: '+error.message;console.error(error);}
}
async function resolverCanjeAdmin(id,accion){
    if(!confirm('¿Querés '+(accion==='confirmar'?'confirmar y descontar los puntos':'rechazar')+' este canje? Esta acción no se puede repetir.'))return;
    const {error}=await supabaseClient.rpc('admin_resolver_canje',{p_canje_id:id,p_accion:accion});
    if(error){alert('No se pudo resolver el canje: '+error.message);return;}await cargarPanelPuntosAdmin();await cargarMetricas();
}
async function cargarRecompensasAdmin(){
    const cont=document.getElementById('listaRecompensasAdmin');if(!cont)return;
    const {data,error}=await supabaseClient.from('recompensas_puntos').select('id,nombre,descripcion,costo_puntos,activa,actualizado_at').order('creado_at',{ascending:false});
    if(error){cont.textContent='No se pudo cargar el catálogo. Aplicá la migración de recompensas y revisá los permisos.';return;}
    crearTablaAdmin(cont,['Recompensa','Descripción','Costo','Estado','Acciones'],(data||[]).map(x=>{
        const a=document.createElement('div');
        a.append(botonAdmin('Cambiar costo','#1d4ed8',async()=>{const v=prompt('Nuevo costo en puntos:',String(x.costo_puntos));if(v===null)return;const costo=Number(v);if(!Number.isInteger(costo)||costo<1){alert('El costo debe ser mayor a cero.');return;}const {error}=await supabaseClient.from('recompensas_puntos').update({costo_puntos:costo,actualizado_at:new Date().toISOString()}).eq('id',x.id);if(error)alert(error.message);else cargarRecompensasAdmin();}),
        botonAdmin(x.activa?'Desactivar':'Activar',x.activa?'#b91c1c':'#15803d',async()=>{const {error}=await supabaseClient.from('recompensas_puntos').update({activa:!x.activa,actualizado_at:new Date().toISOString()}).eq('id',x.id);if(error)alert(error.message);else cargarRecompensasAdmin();}));
        return[x.nombre,x.descripcion,x.costo_puntos,x.activa?'Activa':'Inactiva',a];
    }));
}
async function cargarReclamosAdmin(){
    const cont=document.getElementById('listaReclamosAdmin');if(!cont)return;
    const {data,error}=await supabaseClient.from('reclamos_puntos').select('id,usuario_id,asunto,descripcion,estado,respuesta_admin,creado_at').order('creado_at',{ascending:false}).limit(100);
    if(error){cont.textContent='No se pudieron cargar los reclamos. Aplicá la migración del panel administrativo.';return;}
    crearTablaAdmin(cont,['Usuario','Asunto / descripción','Estado','Fecha','Acciones'],(data||[]).map(x=>{const a=document.createElement('div');a.append(botonAdmin('En revisión','#b45309',()=>resolverReclamoAdmin(x.id,'en_revision')),botonAdmin('Resolver','#15803d',()=>resolverReclamoAdmin(x.id,'resuelto')),botonAdmin('Rechazar','#b91c1c',()=>resolverReclamoAdmin(x.id,'rechazado')));return[x.usuario_id,x.asunto+' — '+x.descripcion,x.estado,new Date(x.creado_at).toLocaleString('es-AR'),a];}));
}
async function resolverReclamoAdmin(id,estado){
    const respuesta=prompt('Respuesta para el usuario (opcional):','');if(respuesta===null)return;
    const {error}=await supabaseClient.rpc('admin_resolver_reclamo',{p_reclamo_id:id,p_estado:estado,p_respuesta:respuesta});
    if(error){alert('No se pudo actualizar el reclamo: '+error.message);return;}await cargarReclamosAdmin();await cargarMetricas();
}
