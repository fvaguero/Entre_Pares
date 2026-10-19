const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let reservasFinanzasCache = [];
const PAGADOS = ['pagado','pagada','completada','completado'];
const LIQUIDADOS = ['liquidado','liquidada','transferido','transferida'];
const PENDIENTES = ['pendiente','pendiente de pago','a pagar'];
function tipoLiquidacion(r){const s=normalizar(r.estado_liquidacion);if(['liquidado','liquidada','transferido','transferida'].includes(s))return 'liquidado';if(tipoPago(r.estado_pago)==='liquidado')return 'liquidado';return 'pendiente';}
function tipoPagoSolo(r){return tipoPago(r.estado_pago)==='liquidado'?'pagado':tipoPago(r.estado_pago);}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const {data:{user},error:userError} = await supabaseClient.auth.getUser();
    if (userError || !user) { window.location.href='login.html'; return; }
    const correoAdmin='valentinaseco2004@gmail.com';
    const {data:perfil,error:perfilError}=await supabaseClient.from('perfiles').select('rol').eq('id',user.id).maybeSingle();
    if (user.email!==correoAdmin && (perfilError || !perfil || perfil.rol!=='Administrador')) {
      alert('Acceso denegado. No tienes permisos de administrador.'); window.location.href='index.html'; return;
    }
    conectarFiltrosPagos();
    await Promise.all([cargarDatosAdminFinanzas(),cargarDatosAdminUsuarios(),cargarDatosAdminReservas(),cargarHistorialPagosAdmin()]);
    const salir=document.getElementById('btnCerrarSesionAdmin');
    if(salir) salir.addEventListener('click',async()=>{await supabaseClient.auth.signOut();window.location.href='login.html';});
  } catch(e) { console.error('Error al iniciar el panel:',e); alert('No se pudo cargar el panel administrativo.'); }
});
function normalizar(v){return String(v||'').trim().toLocaleLowerCase('es-AR');}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ars(v){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(v)||0);}
function fecha(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(d);}
function iso(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function tipoPago(v){const s=normalizar(v);if(LIQUIDADOS.includes(s))return 'liquidado';if(PAGADOS.includes(s))return 'pagado';if(PENDIENTES.includes(s)||!s)return 'pendiente';return 'otro';}
function conectarFiltrosPagos(){
 ['buscarPagoAdmin','filtroEstadoPagoAdmin','filtroLiquidacionAdmin','fechaDesdePagoAdmin','fechaHastaPagoAdmin'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',renderizarFinanzas);e.addEventListener('change',renderizarFinanzas);}});
 const limpiar=document.getElementById('limpiarFiltrosPagoAdmin');
 if(limpiar)limpiar.addEventListener('click',()=>{['buscarPagoAdmin','fechaDesdePagoAdmin','fechaHastaPagoAdmin'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const s=document.getElementById('filtroEstadoPagoAdmin');if(s)s.value='todos';const l=document.getElementById('filtroLiquidacionAdmin');if(l)l.value='todos';renderizarFinanzas();});
 const csv=document.getElementById('exportarPagosCSVAdmin');if(csv)csv.addEventListener('click',exportarCSV);
}
async function cargarDatosAdminFinanzas(){
 const tbody=document.getElementById('tablaAdminFinanzas');if(!tbody)return;
 tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:2rem;">Cargando finanzas...</td></tr>';
 try{
  const consulta='id,materia,precio,estado_pago,estado_liquidacion,estado,fecha_hora,creado_at,fecha_pago,fecha_liquidacion,estudiante:estudiante_id(nombre_completo,email),tutor:tutor_id(nombre_completo,cvu_alias)';
  const {data,error}=await supabaseClient.from('reservas').select(consulta).order('creado_at',{ascending:false});
  if(error){if(String(error.message||'').includes('fecha_pago')||String(error.message||'').includes('fecha_liquidacion'))throw new Error('Faltan fecha_pago y fecha_liquidacion. Aplicá la migración SQL 20261020_control_financiero_admin.sql en Supabase.');throw error;}
  reservasFinanzasCache=data||[];renderizarFinanzas();renderizarAlertas();
 }catch(e){console.error('Error al cargar finanzas:',e);tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:#b91c1c;">'+esc(e.message||'No se pudieron cargar las finanzas.')+'</td></tr>';const a=document.getElementById('alertasPagosAdmin');if(a)a.innerHTML='<p style="margin:0;color:#92400e;">Para activar fechas reales e historial, aplicá primero la migración SQL de control financiero.</p>';}
}
function filtradas(){
 const q=normalizar((document.getElementById('buscarPagoAdmin')||{}).value),estado=(document.getElementById('filtroEstadoPagoAdmin')||{}).value||'todos';
 const liquidacion=(document.getElementById('filtroLiquidacionAdmin')||{}).value||'todos';
 const desde=(document.getElementById('fechaDesdePagoAdmin')||{}).value||'',hasta=(document.getElementById('fechaHastaPagoAdmin')||{}).value||'';
 return reservasFinanzasCache.filter(r=>{
  const texto=[r.estudiante&&r.estudiante.nombre_completo,r.estudiante&&r.estudiante.email,r.tutor&&r.tutor.nombre_completo,r.tutor&&r.tutor.cvu_alias,r.materia].map(normalizar).join(' ');
  if(q&&!texto.includes(q))return false;const tipo=tipoPagoSolo(r);if(estado!=='todos'&&tipo!==estado)return false;const tipoLiq=tipoLiquidacion(r);if(liquidacion!=='todos'&&tipoLiq!==liquidacion)return false;
  const f=iso(r.fecha_liquidacion||r.fecha_pago||r.fecha_hora||r.creado_at);if(desde&&(!f||f<desde))return false;if(hasta&&(!f||f>hasta))return false;return true;
 });
}
function renderizarFinanzas(){
 const totalPagado=reservasFinanzasCache.filter(r=>tipoPagoSolo(r)==='pagado'||tipoLiquidacion(r)==='liquidado').reduce((s,r)=>s+(Number(r.precio)||0),0);
 const pendientes=reservasFinanzasCache.filter(r=>tipoPagoSolo(r)==='pagado'&&tipoLiquidacion(r)!=='liquidado').length;
 const liquidadas=reservasFinanzasCache.filter(r=>tipoLiquidacion(r)==='liquidado').length;
 const k1=document.getElementById('kpiRecaudado'),k2=document.getElementById('kpiPendientes'),k3=document.getElementById('kpiLiquidadas');
 if(k1)k1.textContent=ars(totalPagado);if(k2)k2.textContent=String(pendientes);if(k3)k3.textContent=String(liquidadas);
 const tbody=document.getElementById('tablaAdminFinanzas');if(!tbody)return;const rows=filtradas();tbody.innerHTML='';
 const contador=document.getElementById('contadorPagosAdmin');if(contador)contador.textContent=rows.length+' de '+reservasFinanzasCache.length+' registros mostrados.';
 if(!rows.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:#64748b;">No hay pagos que coincidan con los filtros.</td></tr>';return;}
 rows.forEach(r=>{
  const tipo=tipoPagoSolo(r),estado=r.estado_pago||'Pendiente',tipoLiq=tipoLiquidacion(r),estadoLiq=r.estado_liquidacion||(tipoPago(r.estado_pago)==='liquidado'?'Liquidado':'Pendiente'),monto=Number(r.precio)||0;
  const colores=tipo==='pagado'?['#fef3c7','#92400e']:tipo==='pendiente'?['#fee2e2','#991b1b']:['#e2e8f0','#334155'];
  const accion=tipoLiq==='liquidado'?'<span style="color:#16a34a;font-size:.8rem;font-weight:600;">✓ Transferido</span>':tipo==='pagado'?'<button type="button" onclick="liquidarPago(\''+esc(r.id)+'\',\''+esc(r.tutor&&r.tutor.cvu_alias||'')+'\')" class="btn" style="background:#16a34a;color:white;border:0;padding:.4rem .8rem;border-radius:6px;cursor:pointer;">💸 Liquidar</button>':'<span style="color:#94a3b8;font-size:.8rem;">Esperando pago</span>';
  const tr=document.createElement('tr');tr.style.borderBottom='1px solid #e2e8f0';
  tr.innerHTML='<td style="padding:1rem;color:#1e293b;font-weight:500;">'+esc(r.estudiante&&r.estudiante.nombre_completo||'Estudiante')+'<div style="font-size:.75rem;color:#64748b;">'+esc(r.estudiante&&r.estudiante.email||'')+'</div></td>'+
   '<td style="padding:1rem;color:#475569;"><strong>'+esc(r.tutor&&r.tutor.nombre_completo||'Tutor')+'</strong><div style="font-size:.75rem;color:#2563eb;font-weight:600;">CVU/Alias: '+esc(r.tutor&&r.tutor.cvu_alias||'No configurado')+'</div></td>'+
   '<td style="padding:1rem;">'+esc(r.materia||'—')+'</td><td style="padding:1rem;">'+fecha(r.fecha_hora)+'</td><td style="padding:1rem;">'+fecha(r.fecha_pago)+'</td><td style="padding:1rem;">'+fecha(r.fecha_liquidacion)+'</td>'+
   '<td style="padding:1rem;font-weight:600;">'+ars(monto)+'</td><td style="padding:1rem;"><span style="background:'+colores[0]+';color:'+colores[1]+';padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:600;">'+esc(estado)+'</span></td><td style="padding:1rem;"><span style="background:'+(tipoLiq==='liquidado'?'#dcfce7':'#f1f5f9')+';color:'+(tipoLiq==='liquidado'?'#166534':'#475569')+';padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:600;">'+esc(estadoLiq)+'</span></td><td style="padding:1rem;text-align:center;">'+accion+'</td>';
  tbody.appendChild(tr);
 });
}
function renderizarAlertas(){
 const cont=document.getElementById('alertasPagosAdmin');if(!cont)return;const now=Date.now(),alerts=[];
 reservasFinanzasCache.forEach(r=>{
  const pago=tipoPagoSolo(r),liquidacion=tipoLiquidacion(r),clase=normalizar(r.estado),dias=r.creado_at?(now-new Date(r.creado_at).getTime())/86400000:0;
  const alumno=r.estudiante&&r.estudiante.nombre_completo||'Estudiante',materia=r.materia||'Sin materia';
  if(clase==='finalizada'&&pago==='pendiente')alerts.push(['error','Tutoría finalizada sin pago registrado: '+materia+' — '+alumno]);
  if(pago==='pendiente'&&dias>=7)alerts.push(['warning','Pago pendiente hace '+Math.floor(dias)+' días: '+materia+' — '+alumno]);
  if(pago==='pagado'&&liquidacion!=='liquidado'){const base=r.fecha_pago?new Date(r.fecha_pago).getTime():new Date(r.creado_at||0).getTime();if(base&&now-base>=7*86400000)alerts.push(['warning','Pago recibido sin liquidar hace al menos 7 días: '+materia+' — tutor '+(r.tutor&&r.tutor.nombre_completo||'sin nombre')]);}
 });
 if(!alerts.length){cont.style.background='#f0fdf4';cont.innerHTML='<p style="margin:0;color:#166534;">✓ No se detectaron inconsistencias con las reglas actuales.</p>';return;}
 cont.style.background='#fffbeb';cont.innerHTML='<strong style="color:#92400e;">Alertas de control ('+alerts.length+')</strong>'+alerts.slice(0,30).map(a=>'<p style="margin:.2rem 0;color:'+(a[0]==='error'?'#b91c1c':'#92400e')+';">• '+esc(a[1])+'</p>').join('')+(alerts.length>30?'<p>Se muestran las primeras 30 alertas.</p>':'');
}
function exportarCSV(){
 const headers=['Reserva ID','Estudiante','Correo estudiante','Tutor','CVU/Alias tutor','Materia','Fecha tutoria','Fecha pago','Fecha liquidacion','Importe ARS','Estado tutoria','Estado pago','Estado liquidacion'];
 const rows=filtradas().map(r=>[r.id,r.estudiante&&r.estudiante.nombre_completo,r.estudiante&&r.estudiante.email,r.tutor&&r.tutor.nombre_completo,r.tutor&&r.tutor.cvu_alias,r.materia,r.fecha_hora,r.fecha_pago,r.fecha_liquidacion,Number(r.precio)||0,r.estado,r.estado_pago,r.estado_liquidacion]);
 const csv=[headers].concat(rows).map(row=>row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
 a.href=url;a.download='reporte_pagos_entre_pares_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function cargarDatosAdminUsuarios(){
 const tbody=document.getElementById('tablaAdminUsuarios');if(!tbody)return;
 try{const {data,error}=await supabaseClient.from('perfiles').select('*').order('nombre_completo',{ascending:true});if(error)throw error;tbody.innerHTML='';
  if(!data||!data.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2rem;">No hay usuarios registrados.</td></tr>';return;}
  data.forEach(p=>{const tr=document.createElement('tr');tr.style.borderBottom='1px solid #e2e8f0';tr.innerHTML='<td style="padding:1rem;font-weight:500;">'+esc(p.nombre_completo||'Sin nombre')+'</td><td style="padding:1rem;">'+esc(p.email||'Sin correo')+'</td><td style="padding:1rem;">'+esc(p.rol||'Estudiante')+'</td><td style="padding:1rem;">'+esc(p.sede_universitaria||'No especificada')+'</td><td style="padding:1rem;color:#d97706;font-weight:bold;">⭐ '+(Number(p.puntos_gamificacion)||0)+' pts</td>';tbody.appendChild(tr);});
 }catch(e){console.error('Error al cargar usuarios:',e);}
}
async function cargarDatosAdminReservas(){
 const tbody=document.getElementById('tablaAdminTodasReservas');if(!tbody)return;
 try{const consulta='id,materia,estado,comentarios,fecha_hora,creado_at,estudiante:estudiante_id(nombre_completo),tutor:tutor_id(nombre_completo)';
  const {data,error}=await supabaseClient.from('reservas').select(consulta).order('creado_at',{ascending:false});if(error)throw error;tbody.innerHTML='';
  if(!data||!data.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2rem;">No hay reservas registradas.</td></tr>';return;}
  data.forEach(r=>{const tr=document.createElement('tr');tr.style.borderBottom='1px solid #e2e8f0';tr.innerHTML='<td style="padding:1rem;font-weight:500;">'+esc(r.materia)+'<div style="font-size:.75rem;color:#64748b;">'+fecha(r.fecha_hora)+'</div></td><td style="padding:1rem;">'+esc(r.estudiante&&r.estudiante.nombre_completo||'Estudiante')+'</td><td style="padding:1rem;">'+esc(r.tutor&&r.tutor.nombre_completo||'Tutor')+'</td><td style="padding:1rem;">'+esc(r.estado||'Pendiente')+'</td><td style="padding:1rem;color:#64748b;font-size:.85rem;">'+esc(r.comentarios||'Sin notas')+'</td>';tbody.appendChild(tr);});
 }catch(e){console.error('Error al cargar reservas:',e);}
}
async function cargarHistorialPagosAdmin(){
 const tbody=document.getElementById('tablaHistorialPagosAdmin');if(!tbody)return;
 try{
  const {data,error}=await supabaseClient.from('historial_pagos_admin')
   .select('id,reserva_id,estado_anterior,estado_nuevo,fecha_cambio,cambiado_por')
   .order('fecha_cambio',{ascending:false}).limit(100);
  if(error)throw error;
  tbody.innerHTML='';
  if(!data||!data.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#64748b;">Todavía no hay cambios registrados. Los cambios futuros quedarán auditados.</td></tr>';return;}
  const ids=[...new Set(data.map(x=>x.cambiado_por).filter(Boolean))];
  let nombres={};
  if(ids.length){const {data:perfiles,error:errPerfiles}=await supabaseClient.from('perfiles').select('id,nombre_completo,email').in('id',ids);if(!errPerfiles)(perfiles||[]).forEach(p=>{nombres[p.id]=p.nombre_completo||p.email||p.id;});}
  data.forEach(x=>{const tr=document.createElement('tr');tr.style.borderBottom='1px solid #e2e8f0';tr.innerHTML='<td style="padding:1rem;">'+esc(fecha(x.fecha_cambio))+' '+esc(x.fecha_cambio?new Date(x.fecha_cambio).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'')+'</td><td style="padding:1rem;font-family:monospace;">'+esc(x.reserva_id)+'</td><td style="padding:1rem;">'+esc(x.cambiado_por?(nombres[x.cambiado_por]||'Usuario '+x.cambiado_por):'Sistema / no identificado')+'</td><td style="padding:1rem;">'+esc(x.estado_anterior||'Sin estado')+'</td><td style="padding:1rem;font-weight:600;">'+esc(x.estado_nuevo)+'</td>';tbody.appendChild(tr);});
 }catch(e){console.error('Error al cargar historial de pagos:',e);tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#92400e;">No se pudo cargar el historial. Aplicá la migración SQL de control financiero y verificá los permisos de lectura para administradores.</td></tr>';}
}
window.liquidarPago=async function(id,cvu){
 const reserva=reservasFinanzasCache.find(r=>r.id===id);
 if(!reserva||tipoPagoSolo(reserva)!=='pagado'||tipoLiquidacion(reserva)==='liquidado'){alert('Solo se pueden liquidar pagos que ya figuren como recibidos. Verificá el pago del estudiante primero.');return;}
 if(!cvu){alert('No se puede liquidar: el tutor no tiene CVU/Alias registrado.');return;}
 if(!confirm('Verificá que la transferencia real se haya realizado a '+cvu+'. ¿Confirmás que la transferencia fue completada?'))return;
 try{const {error}=await supabaseClient.from('reservas').update({estado_liquidacion:'Liquidado'}).eq('id',id);if(error)throw error;alert('Estado actualizado a Liquidado.');await cargarDatosAdminFinanzas();}
 catch(e){console.error('Error al liquidar:',e);alert('No se pudo actualizar. Revisá permisos y que la migración de control financiero esté aplicada.');}
};
