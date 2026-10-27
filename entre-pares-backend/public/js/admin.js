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
    const {data:perfil,error:perfilError}=await supabaseClient
      .from('perfiles')
      .select('rol')
      .eq('id',user.id)
      .maybeSingle();

    if (perfilError || !perfil || perfil.rol !== 'Administrador') {
      alert('Acceso denegado. Esta cuenta no tiene permisos de administrador.');
      await supabaseClient.auth.signOut();
      window.location.href='login.html';
      return;
    }
    conectarFiltrosPagos();
    conectarFiltrosUsuariosAdmin();
    conectarFiltrosTutorias();
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
 ['buscarPagoAdmin','filtroEstadoPagoAdmin','filtroLiquidacionAdmin','fechaDesdePagoAdmin','fechaHastaPagoAdmin','fechaDesdeLiquidacionAdmin','fechaHastaLiquidacionAdmin'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',renderizarFinanzas);e.addEventListener('change',renderizarFinanzas);}});
 const limpiar=document.getElementById('limpiarFiltrosPagoAdmin');
 if(limpiar)limpiar.addEventListener('click',()=>{['buscarPagoAdmin','fechaDesdePagoAdmin','fechaHastaPagoAdmin','fechaDesdeLiquidacionAdmin','fechaHastaLiquidacionAdmin'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const s=document.getElementById('filtroEstadoPagoAdmin');if(s)s.value='todos';const l=document.getElementById('filtroLiquidacionAdmin');if(l)l.value='todos';renderizarFinanzas();});
 const csv=document.getElementById('exportarPagosCSVAdmin');if(csv)csv.addEventListener('click',exportarCSV);
}
async function cargarDatosAdminFinanzas(){
 const tbody=document.getElementById('tablaAdminFinanzas');if(!tbody)return;
 tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:2rem;">Cargando finanzas...</td></tr>';
 try{
  const consulta='id,materia,precio,estado_pago,estado_liquidacion,estado,fecha_hora,creado_at,fecha_pago,fecha_liquidacion,estudiante:estudiante_id(nombre_completo,email),tutor:tutor_id(nombre_completo,cvu_alias)';
  const {data,error}=await supabaseClient.from('reservas').select(consulta).order('creado_at',{ascending:false});
  if(error){if(String(error.message||'').includes('fecha_pago')||String(error.message||'').includes('fecha_liquidacion')||String(error.message||'').includes('estado_liquidacion'))throw new Error('Faltan columnas del control financiero. Aplicá la migración SQL 20261020_control_financiero_admin.sql en Supabase.');throw error;}
  reservasFinanzasCache=data||[];renderizarFinanzas();renderizarAlertas();
 }catch(e){console.error('Error al cargar finanzas:',e);tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:2rem;color:#b91c1c;">'+esc(e.message||'No se pudieron cargar las finanzas.')+'</td></tr>';const a=document.getElementById('alertasPagosAdmin');if(a)a.innerHTML='<p style="margin:0;color:#92400e;">Para activar fechas reales e historial, aplicá primero la migración SQL de control financiero.</p>';}
}
function filtradas(){
 const q=normalizar((document.getElementById('buscarPagoAdmin')||{}).value),estado=(document.getElementById('filtroEstadoPagoAdmin')||{}).value||'todos';
 const liquidacion=(document.getElementById('filtroLiquidacionAdmin')||{}).value||'todos';
 const desdePago=(document.getElementById('fechaDesdePagoAdmin')||{}).value||'',hastaPago=(document.getElementById('fechaHastaPagoAdmin')||{}).value||'';
 const desdeLiq=(document.getElementById('fechaDesdeLiquidacionAdmin')||{}).value||'',hastaLiq=(document.getElementById('fechaHastaLiquidacionAdmin')||{}).value||'';
 return reservasFinanzasCache.filter(r=>{
  const texto=[r.estudiante&&r.estudiante.nombre_completo,r.estudiante&&r.estudiante.email,r.tutor&&r.tutor.nombre_completo,r.tutor&&r.tutor.cvu_alias,r.materia].map(normalizar).join(' ');
  if(q&&!texto.includes(q))return false;const tipo=tipoPagoSolo(r);if(estado!=='todos'&&tipo!==estado)return false;const tipoLiq=tipoLiquidacion(r);if(liquidacion!=='todos'&&tipoLiq!==liquidacion)return false;
  const fp=iso(r.fecha_pago),fl=iso(r.fecha_liquidacion);
  if(desdePago&&(!fp||fp<desdePago))return false;if(hastaPago&&(!fp||fp>hastaPago))return false;
  if(desdeLiq&&(!fl||fl<desdeLiq))return false;if(hastaLiq&&(!fl||fl>hastaLiq))return false;
  return true;
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
 if(!rows.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:2rem;color:#64748b;">No hay pagos que coincidan con los filtros.</td></tr>';return;}
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
 const cont=document.getElementById('alertasPagosAdmin');if(!cont)return;
 const now=Date.now(),porTipo={sinPago:[],pendientes:[],sinLiquidar:[]};
 const vistos=new Set();
 reservasFinanzasCache.forEach(r=>{
  const pago=tipoPagoSolo(r),liquidacion=tipoLiquidacion(r),clase=normalizar(r.estado);
  const alumno=r.estudiante&&r.estudiante.nombre_completo||'Estudiante',materia=r.materia||'Sin materia';
  const fechaBase=r.creado_at||r.fecha_hora;
  const timestamp=fechaBase?new Date(fechaBase).getTime():NaN;
  const dias=Number.isFinite(timestamp)?Math.max(0,Math.floor((now-timestamp)/86400000)):0;
  const key=r.id||[materia,alumno,r.fecha_hora||''].join('|');
  const agregar=(tipo,mensaje)=>{const id=tipo+'|'+key;if(vistos.has(id))return;vistos.add(id);porTipo[tipo].push({mensaje,id});};
  if(['finalizada','completada','completado'].includes(clase)&&pago==='pendiente')agregar('sinPago',materia+' — '+alumno);
  if(pago==='pendiente'&&dias>=7)agregar('pendientes','Hace '+dias+' días · '+materia+' — '+alumno);
  if(pago==='pagado'&&liquidacion!=='liquidado'){
   const base=r.fecha_pago?new Date(r.fecha_pago).getTime():timestamp;
   if(Number.isFinite(base)&&base>0&&now-base>=7*86400000)agregar('sinLiquidar','Pago recibido hace '+Math.floor((now-base)/86400000)+' días · '+materia+' — tutor '+(r.tutor&&r.tutor.nombre_completo||'Sin nombre'));
  }
 });
 const grupos=[
  {id:'sinPago',titulo:'Tutorías finalizadas sin pago',color:'#b91c1c',fondo:'#fef2f2',items:porTipo.sinPago},
  {id:'pendientes',titulo:'Pagos pendientes hace 7 días o más',color:'#92400e',fondo:'#fffbeb',items:porTipo.pendientes},
  {id:'sinLiquidar',titulo:'Pagos recibidos sin liquidar hace 7 días o más',color:'#1d4ed8',fondo:'#eff6ff',items:porTipo.sinLiquidar}
 ];
 const total=grupos.reduce((n,g)=>n+g.items.length,0);
 if(!total){cont.style.background='#f0fdf4';cont.style.padding='1rem 1.5rem';cont.innerHTML='<div style="display:flex;gap:.7rem;align-items:center;color:#166534;"><span style="font-size:1.35rem;">✓</span><div><strong>Todo en orden</strong><p style="margin:.2rem 0 0;font-size:.9rem;">No se detectaron alertas con las reglas actuales.</p></div></div>';return;}
 cont.style.background='#fff';cont.style.padding='1rem 1.25rem';
 cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;"><div><strong style="font-size:1rem;color:#0f172a;">Alertas de control</strong><p style="margin:.2rem 0 0;font-size:.85rem;color:#64748b;">Hay '+total+' situaciones que requieren revisión.</p></div><span style="background:#fee2e2;color:#b91c1c;padding:.35rem .7rem;border-radius:999px;font-weight:700;font-size:.85rem;">'+total+' pendientes</span></div>'+
 grupos.filter(g=>g.items.length).map(g=>'<details style="border:1px solid #e2e8f0;border-radius:10px;margin:.65rem 0;overflow:hidden;"><summary style="cursor:pointer;list-style-position:inside;padding:.85rem 1rem;background:'+g.fondo+';color:'+g.color+';font-weight:600;display:flex;justify-content:space-between;gap:.7rem;"><span>'+g.titulo+'</span><span style="background:white;border:1px solid #e2e8f0;border-radius:999px;padding:.1rem .55rem;font-size:.8rem;">'+g.items.length+'</span></summary><ul style="margin:0;padding:.5rem 1rem .8rem 2.5rem;color:#334155;">'+g.items.map(x=>'<li style="padding:.35rem 0;border-bottom:1px solid #f1f5f9;">'+esc(x.mensaje)+'</li>').join('')+'</ul></details>').join('');
}
function exportarCSV(){
 const headers=['Reserva ID','Estudiante','Correo estudiante','Tutor','CVU/Alias tutor','Materia','Fecha tutoria','Fecha pago','Fecha liquidacion','Importe ARS','Estado tutoria','Estado pago','Estado liquidacion'];
 const rows=filtradas().map(r=>[r.id,r.estudiante&&r.estudiante.nombre_completo,r.estudiante&&r.estudiante.email,r.tutor&&r.tutor.nombre_completo,r.tutor&&r.tutor.cvu_alias,r.materia,r.fecha_hora,r.fecha_pago,r.fecha_liquidacion,Number(r.precio)||0,r.estado,r.estado_pago,r.estado_liquidacion]);
 const csv=[headers].concat(rows).map(row=>row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
 a.href=url;a.download='reporte_pagos_entre_pares_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
let usuariosAdminCache = [];
function rolUsuarioAdmin(v){return normalizar(v)||'estudiante';}
function conectarFiltrosUsuariosAdmin(){
 ['buscarUsuariosAdmin','filtroRolUsuariosAdmin'].forEach(id=>{
  const el=document.getElementById(id);
  if(el){el.addEventListener('input',renderizarUsuariosAdmin);el.addEventListener('change',renderizarUsuariosAdmin);}
 });
 const limpiar=document.getElementById('limpiarFiltrosUsuariosAdmin');
 if(limpiar)limpiar.addEventListener('click',()=>{
  const buscar=document.getElementById('buscarUsuariosAdmin');
  const rol=document.getElementById('filtroRolUsuariosAdmin');
  if(buscar)buscar.value='';
  if(rol)rol.value='todos';
  renderizarUsuariosAdmin();
 });
}
async function cargarDatosAdminUsuarios(){
 const tbody=document.getElementById('tablaAdminUsuarios');if(!tbody)return;
 try{
  const {data,error}=await supabaseClient.from('perfiles').select('*').order('nombre_completo',{ascending:true});
  if(error)throw error;
  usuariosAdminCache=data||[];
  renderizarUsuariosAdmin();
 }catch(e){
  console.error('Error al cargar usuarios:',e);
  tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2rem;color:#b91c1c;">No se pudieron cargar los usuarios. Revisá la conexión y los permisos.</td></tr>';
 }
}
function renderizarUsuariosAdmin(){
 const tbody=document.getElementById('tablaAdminUsuarios');if(!tbody)return;
 const q=normalizar((document.getElementById('buscarUsuariosAdmin')||{}).value);
 const filtro=(document.getElementById('filtroRolUsuariosAdmin')||{}).value||'todos';
 const total=usuariosAdminCache.length;
 const contar=rol=>usuariosAdminCache.filter(p=>rolUsuarioAdmin(p.rol)===rol).length;
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};
 set('kpiTotalUsuariosAdmin',total);
 set('kpiEstudiantesAdmin',contar('estudiante'));
 set('kpiTutoresAdmin',contar('tutor'));
 set('kpiAdminsAdmin',contar('administrador'));
 const filas=usuariosAdminCache.filter(p=>{
  const rol=rolUsuarioAdmin(p.rol);
  const texto=[p.nombre_completo,p.email,p.sede_universitaria,p.rol].map(normalizar).join(' ');
  return (!q||texto.includes(q))&&(filtro==='todos'||rol===filtro);
 });
 const contador=document.getElementById('contadorUsuariosAdmin');
 if(contador)contador.textContent=filas.length+' de '+total+' usuarios mostrados';
 tbody.innerHTML='';
 if(!filas.length){
  tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2.5rem;color:#64748b;"><div style="font-size:1.5rem;margin-bottom:.4rem;">⌕</div><strong>No se encontraron usuarios</strong><div style="font-size:.85rem;margin-top:.25rem;">Probá otra búsqueda o limpiá los filtros.</div></td></tr>';
  return;
 }
 filas.forEach(p=>{
  const rol=rolUsuarioAdmin(p.rol);
  const estilo=rol==='administrador'?['#ede9fe','#6d28d9']:rol==='tutor'?['#dcfce7','#166534']:rol==='ambos'?['#dbeafe','#1d4ed8']:['#f1f5f9','#475569'];
  const etiqueta=rol==='administrador'?'Administrador':rol==='tutor'?'Tutor':rol==='ambos'?'Ambos':(p.rol||'Estudiante');
  const nombre=p.nombre_completo||'Sin nombre';
  const tr=document.createElement('tr');tr.style.borderBottom='1px solid #f1f5f9';
  tr.innerHTML=
   '<td style="padding:1rem;min-width:165px;"><strong style="color:#0f172a;">'+esc(nombre)+'</strong></td>'+
   '<td style="padding:1rem;min-width:210px;color:#475569;overflow-wrap:anywhere;">'+esc(p.email||'Sin correo')+'</td>'+
   '<td style="padding:1rem;white-space:nowrap;"><span style="display:inline-flex;background:'+estilo[0]+';color:'+estilo[1]+';padding:.35rem .65rem;border-radius:999px;font-size:.76rem;font-weight:700;">'+esc(etiqueta)+'</span></td>'+
   '<td style="padding:1rem;min-width:190px;max-width:340px;color:#64748b;font-size:.84rem;line-height:1.45;overflow-wrap:anywhere;">'+esc(p.sede_universitaria||'No especificada')+'</td>'+
   '<td style="padding:1rem;white-space:nowrap;color:#b45309;font-weight:700;">⭐ '+(Number(p.puntos_gamificacion)||0)+' <span style="font-size:.78rem;font-weight:500;">pts</span></td>';
  tbody.appendChild(tr);
 });
}
let reservasTutoriasAdminCache = [];

function estadoTutoriasAdmin(v){
 const s=normalizar(v);
 if(['finalizada','finalizado','completada','completado'].includes(s))return 'finalizada';
 if(['cancelada','cancelado','rechazada','rechazado'].includes(s))return 'cancelada';
 if(['en curso','encurso','iniciada','iniciado'].includes(s))return 'en curso';
 if(['aceptada','aceptado','confirmada','confirmado'].includes(s))return 'aceptada';
 if(['pendiente','solicitada','solicitado',''].includes(s))return 'pendiente';
 return s;
}
function conectarFiltrosTutorias(){
 ['buscarTutoriasAdmin','filtroEstadoTutoriasAdmin'].forEach(id=>{
  const el=document.getElementById(id);
  if(el){el.addEventListener('input',renderizarTutoriasAdmin);el.addEventListener('change',renderizarTutoriasAdmin);}
 });
 const limpiar=document.getElementById('limpiarFiltrosTutoriasAdmin');
 if(limpiar)limpiar.addEventListener('click',()=>{
  const buscar=document.getElementById('buscarTutoriasAdmin');
  const estado=document.getElementById('filtroEstadoTutoriasAdmin');
  if(buscar)buscar.value='';
  if(estado)estado.value='todos';
  renderizarTutoriasAdmin();
 });
}
async function cargarDatosAdminReservas(){
 const tbody=document.getElementById('tablaAdminTodasReservas');if(!tbody)return;
 try{
  const consulta='id,materia,estado,comentarios,fecha_hora,creado_at,estudiante:estudiante_id(nombre_completo,email),tutor:tutor_id(nombre_completo,email)';
  const {data,error}=await supabaseClient.from('reservas').select(consulta).order('creado_at',{ascending:false});
  if(error)throw error;
  reservasTutoriasAdminCache=data||[];
  renderizarTutoriasAdmin();
 }catch(e){
  console.error('Error al cargar tutorías:',e);
  tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2rem;color:#b91c1c;">No se pudieron cargar las tutorías. Revisá la conexión y los permisos.</td></tr>';
 }
}
function renderizarTutoriasAdmin(){
 const tbody=document.getElementById('tablaAdminTodasReservas');if(!tbody)return;
 const q=normalizar((document.getElementById('buscarTutoriasAdmin')||{}).value);
 const filtro=(document.getElementById('filtroEstadoTutoriasAdmin')||{}).value||'todos';
 const total=reservasTutoriasAdminCache.length;
 const finalizadas=reservasTutoriasAdminCache.filter(r=>estadoTutoriasAdmin(r.estado)==='finalizada').length;
 const activas=reservasTutoriasAdminCache.filter(r=>!['finalizada','cancelada'].includes(estadoTutoriasAdmin(r.estado))).length;
 const kTotal=document.getElementById('kpiTotalTutoriasAdmin');
 const kActivas=document.getElementById('kpiPendientesTutoriasAdmin');
 const kFinal=document.getElementById('kpiFinalizadasTutoriasAdmin');
 if(kTotal)kTotal.textContent=String(total);
 if(kActivas)kActivas.textContent=String(activas);
 if(kFinal)kFinal.textContent=String(finalizadas);
 const filas=reservasTutoriasAdminCache.filter(r=>{
  const estado=estadoTutoriasAdmin(r.estado);
  const texto=[r.materia,r.estudiante&&r.estudiante.nombre_completo,r.estudiante&&r.estudiante.email,r.tutor&&r.tutor.nombre_completo,r.tutor&&r.tutor.email,r.comentarios].map(normalizar).join(' ');
  return (!q||texto.includes(q))&&(filtro==='todos'||estado===filtro);
 });
 const contador=document.getElementById('contadorTutoriasAdmin');
 if(contador)contador.textContent=filas.length+' de '+total+' tutorías mostradas';
 tbody.innerHTML='';
 if(!filas.length){
  tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:2.5rem;color:#64748b;"><div style="font-size:1.5rem;margin-bottom:.4rem;">⌕</div><strong>No se encontraron tutorías</strong><div style="font-size:.85rem;margin-top:.25rem;">Probá cambiar la búsqueda o limpiar los filtros.</div></td></tr>';
  return;
 }
 filas.forEach(r=>{
  const estado=estadoTutoriasAdmin(r.estado);
  const estilo=estado==='finalizada'?['#dcfce7','#166534']:estado==='cancelada'?['#fee2e2','#991b1b']:estado==='en curso'?['#dbeafe','#1d4ed8']:estado==='aceptada'?['#ede9fe','#6d28d9']:['#fef3c7','#92400e'];
  const etiqueta=estado==='finalizada'?'Finalizada':estado==='cancelada'?'Cancelada':estado==='en curso'?'En curso':estado==='aceptada'?'Aceptada':estado==='pendiente'?'Pendiente':(r.estado||'Sin estado');
  const tr=document.createElement('tr');
  tr.style.borderBottom='1px solid #f1f5f9';
  tr.innerHTML=
   '<td style="padding:1rem;min-width:155px;"><strong style="color:#0f172a;">'+esc(r.materia||'Sin materia')+'</strong><div style="font-size:.78rem;color:#64748b;margin-top:.3rem;">'+fecha(r.fecha_hora)+'</div></td>'+
   '<td style="padding:1rem;min-width:170px;"><span style="font-weight:600;color:#334155;">'+esc(r.estudiante&&r.estudiante.nombre_completo||'Estudiante')+'</span><div style="font-size:.75rem;color:#64748b;margin-top:.25rem;">'+esc(r.estudiante&&r.estudiante.email||'')+'</div></td>'+
   '<td style="padding:1rem;min-width:170px;"><span style="font-weight:600;color:#334155;">'+esc(r.tutor&&r.tutor.nombre_completo||'Tutor')+'</span><div style="font-size:.75rem;color:#64748b;margin-top:.25rem;">'+esc(r.tutor&&r.tutor.email||'')+'</div></td>'+
   '<td style="padding:1rem;white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:.35rem;background:'+estilo[0]+';color:'+estilo[1]+';padding:.35rem .65rem;border-radius:999px;font-size:.76rem;font-weight:700;">'+esc(etiqueta)+'</span></td>'+
   '<td style="padding:1rem;min-width:200px;max-width:330px;color:#64748b;font-size:.84rem;line-height:1.5;overflow-wrap:anywhere;">'+esc(r.comentarios||'Sin comentarios')+'</td>';
  tbody.appendChild(tr);
 });
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
