
// ----- Storage & State -----
const DB = { get:(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
const state = {
  productos: DB.get('productos', []),
  servicios: DB.get('servicios', [
    {clave:'VIS', nombre:'Visita', tipo:'visita', duracion_dias:1, precio:50},
    {clave:'SEM', nombre:'Semana', tipo:'semana', duracion_dias:7, precio:150},
    {clave:'MES', nombre:'Mensualidad', tipo:'mes', duracion_dias:30, precio:300},
    {clave:'S6M', nombre:'6 Meses', tipo:'6m', duracion_dias:180, precio:1500},
    {clave:'ANU', nombre:'Anualidad', tipo:'12m', duracion_dias:365, precio:2500},
    {clave:'VIP', nombre:'VIP', tipo:'otro', duracion_dias:90, precio:900}
  ]),
  clientes: DB.get('clientes', []),
  ventas: DB.get('ventas', []),
  compras: DB.get('compras', []),
  caja: DB.get('caja', {abierta:false, apertura:0, movimientos:[], acumuladoZ:0}),
  config: DB.get('config', {negocio:'Dinamita Gym', sucursal_id:'', direccion:'', telefono:'', whatsapp:'', iva_pct:0, folio_prefix:'DG-2025-', logo_url:'', ticket_ancho_mm:58, pie:'Gracias por su compra 💥', pin_admin:'1234', pin_cajero:'0000'}),
  carrito: [],
  pagos: [],
  rol: DB.get('rol','cajero')
};

// ----- Login simple (rol/PIN) -----
const overlay = document.getElementById('loginOverlay');
document.getElementById('rolBadge').textContent = 'Rol: '+state.rol;
if(!DB.get('auth_ok', false)){ overlay.classList.add('show'); }
document.getElementById('btnLogin').onclick = ()=>{
  const rol = document.getElementById('loginRol').value;
  const pin = document.getElementById('loginPin').value;
  if(!state.config.pin_admin) state.config.pin_admin = '1234';
  if(!state.config.pin_cajero) state.config.pin_cajero = '0000';
  if((rol==='admin' && pin===state.config.pin_admin) || (rol==='cajero' && pin===state.config.pin_cajero)){
    state.rol = rol; DB.set('rol', rol); DB.set('auth_ok', true); overlay.classList.remove('show');
    document.getElementById('rolBadge').textContent = 'Rol: '+state.rol;
  }else alert('PIN incorrecto');
};
document.getElementById('btnResetPin').onclick = ()=>{
  state.config.pin_admin = '1234';
  state.config.pin_cajero = '0000';
  DB.set('config', state.config);
  DB.set('auth_ok', false);
  alert('PIN restablecido. Usa Admin 1234 o Cajero 0000.');
};

// ----- Sidebar -----
const sidebar = document.getElementById('sidebar');
const collapseBtn = document.getElementById('collapseBtn');
const btnSidebar = document.getElementById('btnSidebar');
function applySidebar(){
  const collapsed = DB.get('sidebar_collapsed', false);
  if(collapsed) sidebar.classList.add('collapsed'); else sidebar.classList.remove('collapsed');
}
applySidebar();
collapseBtn.onclick = ()=>{ const c = !sidebar.classList.contains('collapsed'); DB.set('sidebar_collapsed', c); applySidebar(); };
btnSidebar.onclick = ()=>{ sidebar.classList.toggle('show'); };

// ----- Tabs -----
document.querySelectorAll('.nav-btn').forEach(b=> b.onclick = ()=>{
  document.querySelectorAll('.tab').forEach(s=>s.classList.remove('active'));
  document.getElementById(b.dataset.tab).classList.add('active');
  sidebar.classList.remove('show');
  if(b.dataset.tab==='productos') renderProductos();
  if(b.dataset.tab==='servicios') renderServicios();
  if(b.dataset.tab==='clientes') renderClientes();
  if(b.dataset.tab==='reportes'){ renderVentas(); renderCaja(); }
  if(b.dataset.tab==='config') loadConfigForm();
});

// ----- Ventas -----
const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');
const barcode = document.getElementById('barcode');
const carritoBody = document.querySelector('#carritoTabla tbody');
const ivaPctLabel = document.getElementById('ivaPctLabel');
const listaPagos = document.getElementById('listaPagos');
const clienteVentaSel = document.getElementById('clienteVenta');
document.getElementById('nuevoClienteVenta').onclick = ()=>{ document.querySelector('.nav-btn[data-tab=\"clientes\"]').click(); };

function refreshClienteSelect(){
  clienteVentaSel.innerHTML = '<option value=\"\">Sin cliente</option>' + state.clientes.map(c=>`<option value=\"${c.id}\">${c.nombre}</option>`).join('');
}
refreshClienteSelect();

function filtrarCatalogo(q){
  q = (q||'').toLowerCase();
  const p = state.productos.filter(x=>(x.nombre+x.sku).toLowerCase().includes(q)).map(x=>({clave:x.sku,nombre:x.nombre,precio:+x.precio,type:'producto'}));
  const s = state.servicios.filter(x=>(x.nombre+x.clave).toLowerCase().includes(q)).map(x=>({clave:x.clave,nombre:x.nombre,precio:+x.precio,type:'servicio'}));
  return [...s,...p];
}
function renderResultados(list){
  resultados.innerHTML='';
  list.forEach(it=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<h4>${it.nombre}</h4><div>${it.type==='producto'?'SKU':'Clave'}: ${it.clave}</div><div>$${it.precio.toFixed(2)} • ${it.type}</div><button>Agregar</button>`;
    d.querySelector('button').onclick=()=>addCarrito(it.clave,1,it.type);
    resultados.appendChild(d);
  });
}
function addCarrito(clave,cant,type){
  let item = state.carrito.find(i=>i.clave===clave && i.type===type);
  if(!item){
    if(type==='producto'){
      const p = state.productos.find(x=>x.sku===clave); if(!p) return alert('SKU no encontrado');
      item = {clave,nombre:p.nombre,precio:+p.precio,cant:0,type:'producto'}; state.carrito.push(item);
    }else{
      const s = state.servicios.find(x=>x.clave===clave); if(!s) return alert('Servicio no encontrado');
      item = {clave,nombre:s.nombre,precio:+s.precio,cant:0,type:'servicio',duracion_dias:s.duracion_dias||null}; state.carrito.push(item);
    }
  }
  item.cant += +cant||1; renderCarrito();
}
function renderCarrito(){
  carritoBody.innerHTML='';
  state.carrito.forEach((i,idx)=>{
    const sub=i.cant*i.precio; const tr=document.createElement('tr');
    tr.innerHTML = `<td>${i.clave}</td><td>${i.nombre} ${i.type==='servicio'?'(servicio)':''}</td>
    <td><input type=\"number\" min=\"1\" value=\"${i.cant}\" data-idx=\"${idx}\" class=\"cant\"/></td>
    <td>$${i.precio.toFixed(2)}</td><td>$${sub.toFixed(2)}</td>
    <td><button data-del=\"${idx}\">✖</button></td>`;
    carritoBody.appendChild(tr);
  });
  carritoBody.querySelectorAll('.cant').forEach(inp=> inp.onchange=()=>{ state.carrito[inp.dataset.idx].cant=+inp.value; renderCarrito(); });
  carritoBody.querySelectorAll('button[data-del]').forEach(b=> b.onclick=()=>{ state.carrito.splice(+b.dataset.del,1); renderCarrito(); });
  calcTotales();
}
function calcTotales(){
  ivaPctLabel.textContent = +(state.config.iva_pct||0);
  const subtotal = state.carrito.reduce((a,i)=>a+i.cant*i.precio,0);
  const iva = subtotal * (+(state.config.iva_pct||0)/100);
  const total = subtotal + iva;
  const pagado = state.pagos.reduce((a,p)=>a+ (+p.monto||0), 0);
  const cambio = Math.max(0, pagado - total);
  document.getElementById('subtotal').textContent=subtotal.toFixed(2);
  document.getElementById('iva').textContent=iva.toFixed(2);
  document.getElementById('total').textContent=total.toFixed(2);
  document.getElementById('pagado').textContent=pagado.toFixed(2);
  document.getElementById('cambio').textContent=cambio.toFixed(2);
  return {subtotal,iva,total,pagado,cambio};
}
buscador.oninput = ()=> renderResultados(filtrarCatalogo(buscador.value));
barcode.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addCarrito(barcode.value.trim(),1,'producto'); barcode.value=''; } });

// pagos múltiples
document.getElementById('agregarPago').onclick = ()=>{
  const metodo = document.getElementById('metodoPago').value;
  const monto = +document.getElementById('montoPago').value;
  if(!monto) return;
  state.pagos.push({metodo,monto});
  renderPagos(); calcTotales();
  document.getElementById('montoPago').value='';
};
function renderPagos(){
  listaPagos.innerHTML = state.pagos.map((p,i)=>`<span class=\"badge\">${p.metodo}: $${(+p.monto).toFixed(2)} <a data-rm=\"${i}\" href=\"#\">x</a></span>`).join(' ');
  listaPagos.querySelectorAll('a[data-rm]').forEach(a=> a.onclick=(e)=>{ e.preventDefault(); state.pagos.splice(+a.dataset.rm,1); renderPagos(); calcTotales(); });
}
renderPagos();

document.getElementById('btnCobrar').onclick = cobrar;
document.getElementById('btnCancelar').onclick = ()=>{ state.carrito=[]; state.pagos=[]; renderCarrito(); renderPagos(); };

function cobrar(){
  if(state.carrito.length===0) return alert('Carrito vacío');
  const totals = calcTotales();
  if(totals.pagado + 0.0001 < totals.total) return alert('Pagos insuficientes');
  // stock
  state.carrito.forEach(i=>{ if(i.type==='producto'){ const p=state.productos.find(x=>x.sku===i.clave); if(p) p.stock -= i.cant; }});
  DB.set('productos', state.productos);
  // folio
  const folio = (state.config.folio_prefix||'V') + Date.now();
  const venta = {
    folio, fecha:new Date().toISOString(), sucursal: state.config.sucursal_id||'', cliente: clienteVentaSel.value||'',
    pagos:state.pagos, total: totals.total, subtotal: totals.subtotal, iva: totals.iva,
    items: state.carrito.map(i=>({clave:i.clave,nombre:i.nombre,cant:i.cant,precio:i.precio,type:i.type,dias:i.duracion_dias||null}))
  };
  state.ventas.push(venta); DB.set('ventas', state.ventas);
  // membresía: si hay cliente y servicio, registrar vigencia
  if(venta.cliente){
    const cli = state.clientes.find(c=>c.id===venta.cliente);
    if(cli){
      const hoy = new Date();
      venta.items.filter(it=>it.type==='servicio' && it.dias).forEach(it=>{
        const ini = new Date(hoy);
        const fin = new Date(hoy); fin.setDate(fin.getDate() + (it.dias * it.cant));
        cli.membresia = {nombre: it.nombre, inicio: ini.toISOString(), fin: fin.toISOString()};
      });
      DB.set('clientes', state.clientes);
    }
  }
  // caja
  if(state.caja.abierta){
    venta.pagos.forEach(p=>{
      state.caja.movimientos.push({tipo:'Venta '+p.metodo, monto:+p.monto, fecha:new Date().toISOString(), nota:venta.folio});
    });
    DB.set('caja', state.caja);
  }
  // limpiar y ticket
  state._ultimo_venta = venta; DB.set('_ultimo_venta', venta);
  state.carrito=[]; state.pagos=[]; renderCarrito(); renderPagos(); renderVentas(); renderResultados(filtrarCatalogo(buscador.value));
  imprimirTicket(venta, true);
}

// Ticket
const ticketToggle = document.getElementById('ticketToggle');
const ticketSec = document.getElementById('ticket');
ticketToggle.onclick = ()=> ticketSec.classList.toggle('hidden');

function drawQR(canvas, text){
  const ctx = canvas.getContext('2d');
  ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff'; for(let y=0;y<canvas.height;y+=6){ for(let x=0;x<canvas.width;x+=6){ if(((x*y)+text.length)%11<5) ctx.fillRect(x,y,4,4);}}
}

function imprimirTicket(v, doPrint=false){
  const ancho = +state.config.ticket_ancho_mm||58;
  document.querySelector('.ticket-paper').style.width = Math.round(ancho*3.78) + 'px';
  const logo = document.getElementById('t-logo');
  if(state.config.logo_url){ logo.src = state.config.logo_url; logo.style.display='block'; } else { logo.style.display='none'; }
  document.getElementById('t-negocio').textContent = state.config.negocio||'Dinamita Gym';
  document.getElementById('t-sucursal').textContent = state.config.sucursal_id?('Suc: '+state.config.sucursal_id):'';
  document.getElementById('t-direccion').textContent = state.config.direccion||'';
  document.getElementById('t-telefono').textContent = state.config.telefono||'';
  document.getElementById('t-whatsapp').textContent = state.config.whatsapp?('WhatsApp: +52 '+state.config.whatsapp):'';
  document.getElementById('t-pie').textContent = state.config.pie||'Gracias por su compra 💥';
  document.getElementById('t-folio').textContent = 'Folio: ' + v.folio;
  document.getElementById('t-fecha').textContent = new Date(v.fecha).toLocaleString();
  const tbody = document.querySelector('#t-items tbody'); tbody.innerHTML='';
  v.items.forEach(it=>{
    const sub = it.cant*it.precio;
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${it.cant}</td><td>${it.nombre}</td><td>$${it.precio.toFixed(2)}</td><td>$${sub.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('t-subtotal').textContent = v.subtotal.toFixed(2);
  document.getElementById('t-iva').textContent = v.iva.toFixed(2);
  document.getElementById('t-total').textContent = v.total.toFixed(2);
  document.getElementById('t-metodo').textContent = v.pagos.map(p=>p.metodo+': $'+(+p.monto).toFixed(2)).join(' | ');
  const qr = document.getElementById('qr');
  const wa = state.config.whatsapp;
  if(wa){ drawQR(qr, 'https://wa.me/52'+wa); } else { const ctx=qr.getContext('2d'); ctx.clearRect(0,0,qr.width,qr.height); }
  ticketSec.classList.remove('hidden');
  if(doPrint) window.print();
}
document.getElementById('reimprimirUltimo').onclick = ()=>{
  const v = DB.get('_ultimo_venta', null);
  if(!v) return alert('No hay venta reciente');
  imprimirTicket(v, true);
};

// Productos
const formProducto = document.getElementById('formProducto');
const tablaProductosBody = document.querySelector('#tablaProductos tbody');
document.getElementById('exportProductos').onclick = ()=> exportCSV('productos.csv', state.productos);
document.getElementById('importProductos').onchange = e=> importCSV(e.target.files[0], 'productos');

formProducto.onsubmit = (e)=>{
  e.preventDefault();
  const fd = new FormData(formProducto); const data = Object.fromEntries(fd.entries());
  data.costo=+data.costo; data.precio=+data.precio; data.stock=+data.stock;
  const ix = state.productos.findIndex(p=>p.sku===data.sku);
  if(ix>=0) state.productos[ix] = {...state.productos[ix], ...data}; else state.productos.push(data);
  DB.set('productos', state.productos); formProducto.reset(); renderProductos(); renderResultados(filtrarCatalogo(buscador.value));
};
function renderProductos(){
  const q=(document.getElementById('buscarProductos').value||'').toLowerCase();
  const list = state.productos.filter(p=>(p.nombre+p.sku).toLowerCase().includes(q));
  tablaProductosBody.innerHTML=''; list.forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.sku}</td><td>${p.nombre}</td><td>$${(+p.costo).toFixed(2)}</td><td>$${(+p.precio).toFixed(2)}</td><td>${(+p.stock)}</td>
    <td><button data-editar=\"${p.sku}\">Editar</button> <button data-borrar=\"${p.sku}\">Borrar</button></td>`;
    tablaProductosBody.appendChild(tr);
  });
  tablaProductosBody.querySelectorAll('button[data-editar]').forEach(btn=> btn.onclick=()=>{
    const p = state.productos.find(x=>x.sku===btn.dataset.editar);
    ['sku','nombre','costo','precio','stock'].forEach(k=> formProducto.elements[k].value = p[k]);
  });
  tablaProductosBody.querySelectorAll('button[data-borrar]').forEach(btn=> btn.onclick=()=>{
    const i = state.productos.findIndex(x=>x.sku===btn.dataset.borrar);
    if(i>=0){ state.productos.splice(i,1); DB.set('productos', state.productos); renderProductos(); renderResultados(filtrarCatalogo(buscador.value)); }
  });
}
document.getElementById('buscarProductos').oninput = renderProductos;

// Servicios
const formServicio = document.getElementById('formServicio');
const tablaServiciosBody = document.querySelector('#tablaServicios tbody');
document.getElementById('exportServicios').onclick = ()=> exportCSV('servicios.csv', state.servicios);
document.getElementById('importServicios').onchange = e=> importCSV(e.target.files[0], 'servicios');

formServicio.onsubmit=(e)=>{
  e.preventDefault();
  const fd=new FormData(formServicio); const data=Object.fromEntries(fd.entries());
  data.precio=+data.precio; data.duracion_dias = data.duracion_dias? +data.duracion_dias : null;
  const ix = state.servicios.findIndex(s=>s.clave===data.clave);
  if(ix>=0) state.servicios[ix] = {...state.servicios[ix], ...data}; else state.servicios.push(data);
  DB.set('servicios', state.servicios); formServicio.reset(); renderServicios(); renderResultados(filtrarCatalogo(buscador.value));
};
function renderServicios(){
  const q=(document.getElementById('buscarServicios').value||'').toLowerCase();
  const list = state.servicios.filter(s=>(s.nombre+s.clave+s.tipo).toLowerCase().includes(q));
  tablaServiciosBody.innerHTML=''; list.forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${s.clave}</td><td>${s.nombre}</td><td>${s.tipo}</td><td>${s.duracion_dias??''}</td><td>$${(+s.precio).toFixed(2)}</td>
    <td><button data-editar=\"${s.clave}\">Editar</button> <button data-borrar=\"${s.clave}\">Borrar</button></td>`;
    tablaServiciosBody.appendChild(tr);
  });
  tablaServiciosBody.querySelectorAll('button[data-editar]').forEach(btn=> btn.onclick=()=>{
    const s = state.servicios.find(x=>x.clave===btn.dataset.editar);
    ['clave','nombre','tipo','duracion_dias','precio'].forEach(k=> formServicio.elements[k].value = s[k] ?? '');
  });
  tablaServiciosBody.querySelectorAll('button[data-borrar]').forEach(btn=> btn.onclick=()=>{
    const i = state.servicios.findIndex(x=>x.clave===btn.dataset.borrar);
    if(i>=0){ state.servicios.splice(i,1); DB.set('servicios', state.servicios); renderServicios(); renderResultados(filtrarCatalogo(buscador.value)); }
  });
}
document.getElementById('buscarServicios').oninput = renderServicios;

// Compras
const formCompra = document.getElementById('formCompra');
const logCompras = document.getElementById('logCompras');
formCompra.onsubmit=(e)=>{
  e.preventDefault();
  const fd=new FormData(formCompra); const data=Object.fromEntries(fd.entries());
  data.cantidad=+data.cantidad; data.costo = data.costo? +data.costo : null;
  const p=state.productos.find(p=>p.sku===data.sku);
  if(!p) return alert('SKU no existe');
  p.stock += data.cantidad; if(data.costo!=null) p.costo=data.costo;
  DB.set('productos', state.productos);
  const entrada = {...data, fecha:new Date().toISOString()};
  state.compras.push(entrada); DB.set('compras', state.compras);
  formCompra.reset(); renderProductos(); logComprasPrepend(entrada);
};
function logComprasPrepend(e){
  const div=document.createElement('div'); div.className='card';
  div.textContent = `${new Date(e.fecha).toLocaleString()} • ${e.sku} +${e.cantidad} ${e.costo?(' $'+(+e.costo).toFixed(2)) : ''}`;
  logCompras.prepend(div);
}
state.compras.slice(-10).forEach(logComprasPrepend);

// Clientes + membresía
const formCliente = document.getElementById('formCliente');
const tablaClientesBody = document.querySelector('#tablaClientes tbody');
document.getElementById('exportClientes').onclick = ()=> exportCSV('clientes.csv', state.clientes);
document.getElementById('importClientes').onchange = e=> importCSV(e.target.files[0], 'clientes');
document.getElementById('buscarClientes').oninput = renderClientes;

formCliente.onsubmit=(e)=>{
  e.preventDefault();
  const fd=new FormData(formCliente); const data=Object.fromEntries(fd.entries());
  if(!data.id) data.id = 'C'+Date.now();
  const ix = state.clientes.findIndex(c=>c.id===data.id);
  if(ix>=0) state.clientes[ix] = {...state.clientes[ix], ...data}; else state.clientes.push(data);
  DB.set('clientes', state.clientes); formCliente.reset(); renderClientes(); refreshClienteSelect();
};
function estadoMembresia(cli){
  if(!cli.membresia || !cli.membresia.fin) return {txt:'Sin membresía', cls:'badge-bad'};
  const fin = new Date(cli.membresia.fin);
  const ok = fin >= new Date();
  return {txt: ok?'Activa':'Vencida', cls: ok?'badge-ok':'badge-bad', fin};
}
function renderClientes(){
  const q=(document.getElementById('buscarClientes').value||'').toLowerCase();
  const list = state.clientes.filter(c=> (c.nombre+(c.telefono||'')+(c.email||'')).toLowerCase().includes(q));
  tablaClientesBody.innerHTML=''; list.forEach(c=>{
    const est=estadoMembresia(c);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${c.id}</td><td>${c.nombre}</td><td>${c.telefono||''}</td><td>${c.email||''}</td>
    <td><span class=\"${est.cls}\">${est.txt}</span></td><td>${est.fin? new Date(est.fin).toLocaleDateString() : ''}</td>
    <td><button data-edit=\"${c.id}\">Editar</button> <button data-del=\"${c.id}\">Borrar</button></td>`;
    tablaClientesBody.appendChild(tr);
  });
  tablaClientesBody.querySelectorAll('button[data-edit]').forEach(btn=> btn.onclick=()=>{
    const c = state.clientes.find(x=>x.id===btn.dataset.edit);
    ['id','nombre','telefono','email'].forEach(k=> formCliente.elements[k].value = c[k]||'');
  });
  tablaClientesBody.querySelectorAll('button[data-del]').forEach(btn=> btn.onclick=()=>{
    const i = state.clientes.findIndex(x=>x.id===btn.dataset.del);
    if(i>=0){ state.clientes.splice(i,1); DB.set('clientes', state.clientes); renderClientes(); refreshClienteSelect(); }
  });
}
renderClientes();

// Reportes
function renderVentas(){
  const tbody = document.querySelector('#tablaVentas tbody');
  const d1 = document.getElementById('desde').value;
  const d2 = document.getElementById('hasta').value;
  let list = state.ventas;
  if(d1) list = list.filter(v=> v.fecha >= new Date(d1).toISOString());
  if(d2) list = list.filter(v=> v.fecha <= new Date(d2+'T23:59:59').toISOString());
  tbody.innerHTML='';
  list.slice().reverse().forEach(v=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${v.folio}</td><td>${new Date(v.fecha).toLocaleString()}</td><td>${v.sucursal||''}</td><td>${v.pagos.map(p=>p.metodo+':$'+(+p.monto).toFixed(0)).join(', ')}</td><td>$${v.total.toFixed(2)}</td><td>${v.items.length}</td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById('filtrarVentas').onclick = renderVentas;
document.getElementById('exportVentas').onclick = ()=> exportCSV('ventas.csv', state.ventas);
document.getElementById('backupJSON').onclick = ()=> downloadJSON('dinamita_backup.json', {
  productos:state.productos, servicios:state.servicios, clientes:state.clientes, ventas:state.ventas, compras:state.compras, caja:state.caja, config:state.config
});
document.getElementById('restoreJSON').onchange = e=> restoreJSON(e.target.files[0]);

// Caja / Corte XZ
function renderCaja(){
  const div=document.getElementById('resumenCaja');
  const ventasHoy = state.ventas.filter(v=> new Date(v.fecha).toDateString() === new Date().toDateString());
  const totalHoy = ventasHoy.reduce((a,v)=>a+v.total,0);
  const movs = state.caja.movimientos||[];
  const saldoMovs = movs.reduce((a,m)=> a + (m.tipo==='Salida'?-m.monto:+m.monto), 0);
  const saldo = (state.caja.apertura||0) + saldoMovs;
  div.innerHTML = `
  <div class=\"card\">Caja: ${state.caja.abierta?'ABIERTA':'CERRADA'} | Apertura: $${(+state.caja.apertura).toFixed(2)} | Saldo Movs: $${saldoMovs.toFixed(2)} | Saldo caja: $${saldo.toFixed(2)}</div>
  <div class=\"card\">Ventas de hoy: $${totalHoy.toFixed(2)} (${ventasHoy.length} tickets)</div>
  `;
}
document.getElementById('btnAbrirCaja').onclick = ()=>{
  state.caja.abierta=true; state.caja.apertura=+(document.getElementById('aperturaCaja').value||0); state.caja.movimientos=[];
  DB.set('caja', state.caja); renderCaja();
};
document.getElementById('btnMov').onclick = ()=>{
  const tipo=document.getElementById('tipoMov').value; const monto=+(document.getElementById('montoMov').value||0); const nota=document.getElementById('notaMov').value||'';
  if(!state.caja.abierta) return alert('Caja cerrada');
  state.caja.movimientos.push({tipo, monto, nota, fecha:new Date().toISOString()});
  DB.set('caja', state.caja); renderCaja();
};
document.getElementById('corteX').onclick = ()=>{ alert('Corte X generado (visual). Exporta ventas y/o respaldo JSON.'); };
document.getElementById('corteZ').onclick = ()=>{
  state.caja.abierta=false; state.caja.apertura=0; state.caja.movimientos=[]; DB.set('caja', state.caja); alert('Corte Z realizado.'); renderCaja();
};

// Config
const formConfig = document.getElementById('formConfig');
function loadConfigForm(){
  ['negocio','sucursal_id','direccion','telefono','whatsapp','iva_pct','folio_prefix','logo_url','ticket_ancho_mm','pie','pin_admin','pin_cajero'].forEach(k=> formConfig.elements[k].value = state.config[k] ?? '');
}
loadConfigForm();
formConfig.onsubmit=(e)=>{
  e.preventDefault();
  const fd=new FormData(formConfig); state.config = Object.fromEntries(fd.entries());
  state.config.iva_pct = +state.config.iva_pct || 0;
  state.config.ticket_ancho_mm = +state.config.ticket_ancho_mm || 58;
  DB.set('config', state.config);
  alert('Configuración guardada');
};

// WebUSB experimental
document.getElementById('btnWebUSB').onclick = async ()=>{
  try{
    const device = await navigator.usb.requestDevice({ filters: [] });
    await device.open(); alert('USB listo (experimental).');
  }catch(e){ alert('No se pudo conectar: '+e); }
};

// CSV utils
function exportCSV(filename, data){ const text='data:text/csv;charset=utf-8,'+toCSV(data); const a=document.createElement('a'); a.href=encodeURI(text); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
function toCSV(arr){ if(!arr||!arr.length) return ''; const cols=Object.keys(arr[0]); const rows=arr.map(o=> cols.map(c=> JSON.stringify(o[c]??'')).join(',')); return cols.join(',')+'\\n'+rows.join('\\n'); }
function importCSV(file, key){
  const reader=new FileReader(); reader.onload=()=>{
    const text=reader.result.trim(); const [head,...lines]=text.split(/\\r?\\n/); const cols=head.split(',');
    const arr = lines.map(line=>{ const vals=line.split(','); const o={}; cols.forEach((c,i)=> o[c]=JSON.parse(vals[i]||'\"\"')); return o; });
    state[key]=arr; DB.set(key, state[key]);
    if(key==='productos'){ renderProductos(); } if(key==='servicios'){ renderServicios(); } if(key==='clientes'){ renderClientes(); refreshClienteSelect(); }
    alert('Importado '+arr.length+' registros en '+key);
  }; reader.readAsText(file);
}
// Backup/Restore
function downloadJSON(filename, obj){ const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(obj)); a.download=filename; a.click(); }
function restoreJSON(file){
  const reader=new FileReader(); reader.onload=()=>{
    const o=JSON.parse(reader.result);
    ['productos','servicios','clientes','ventas','compras','caja','config'].forEach(k=>{ if(o[k]) state[k]=o[k]; });
    ['productos','servicios','clientes','ventas','compras','caja','config'].forEach(k=> DB.set(k, state[k]));
    loadConfigForm(); renderProductos(); renderServicios(); renderClientes(); renderVentas(); renderCaja(); refreshClienteSelect();
    alert('Restaurado');
  }; reader.readAsText(file);
}

// Inicial
renderResultados(filtrarCatalogo(''));
renderProductos(); renderServicios(); renderClientes(); renderVentas(); renderCaja();
document.addEventListener('keydown', e=>{ if(e.key==='F2') cobrar(); });
