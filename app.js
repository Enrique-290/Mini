
// --- Storage ---
const DB = {
  get(k, fb){ try{return JSON.parse(localStorage.getItem(k)) ?? fb}catch{return fb} },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
};

// --- State ---
const state = {
  productos: DB.get('productos', []),
  servicios: DB.get('servicios', []),
  clientes: DB.get('clientes', []),
  ventas: DB.get('ventas', []),
  compras: DB.get('compras', []),
  config: DB.get('config', {negocio:'Dinamita Gym', direccion:'', telefono:'', pie:'Gracias por su compra en Dinamita Gym 💥', iva_pct: 0}),
  carrito: []
};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn=>btn.onclick = ()=>{
  document.querySelectorAll('.tab').forEach(s=>s.classList.remove('active'));
  document.getElementById(btn.dataset.tab).classList.add('active');
  if(btn.dataset.tab==='productos') renderProductos();
  if(btn.dataset.tab==='servicios') renderServicios();
  if(btn.dataset.tab==='clientes') renderClientes();
  if(btn.dataset.tab==='reportes') renderVentas();
});

// Ventas
const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');
const barcode = document.getElementById('barcode');
const carritoBody = document.querySelector('#carritoTabla tbody');
const ivaPctLabel = document.getElementById('ivaPctLabel');

function filtrarCatalogo(q){
  q = (q||'').toLowerCase();
  const p = state.productos
    .filter(x => (x.nombre+x.sku).toLowerCase().includes(q))
    .map(x => ({clave:x.sku, nombre:x.nombre, precio:Number(x.precio), type:'producto'}));
  const s = state.servicios
    .filter(x => (x.nombre+x.clave).toLowerCase().includes(q))
    .map(x => ({clave:x.clave, nombre:x.nombre, precio:Number(x.precio), type:'servicio'}));
  return [...s, ...p]; // servicios primero
}
function renderResultados(list){
  resultados.innerHTML = '';
  list.forEach(it=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `<h4>${it.nombre}</h4>
      <div>${it.type==='producto'?'SKU':'Clave'}: ${it.clave}</div>
      <div>$${it.precio.toFixed(2)} • ${it.type}</div>
      <button>Agregar</button>`;
    card.querySelector('button').onclick = ()=> addCarrito(it.clave, 1, it.type);
    resultados.appendChild(card);
  });
}
function addCarrito(clave, cant, type){
  if(type==='producto'){
    const prod = state.productos.find(p=>p.sku===clave);
    if(!prod) return alert('Producto no encontrado');
    let item = state.carrito.find(i=>i.clave===clave && i.type==='producto');
    if(!item){ item = {clave, nombre: prod.nombre, precio: Number(prod.precio), cant:0, type:'producto'}; state.carrito.push(item); }
    item.cant += Number(cant||1);
  }else{
    const srv = state.servicios.find(s=>s.clave===clave);
    if(!srv) return alert('Servicio no encontrado');
    let item = state.carrito.find(i=>i.clave===clave && i.type==='servicio');
    if(!item){ item = {clave, nombre: srv.nombre, precio: Number(srv.precio), cant:0, type:'servicio'}; state.carrito.push(item); }
    item.cant += Number(cant||1);
  }
  renderCarrito();
}
function renderCarrito(){
  carritoBody.innerHTML='';
  state.carrito.forEach((i, idx)=>{
    const sub = i.cant*i.precio;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i.clave}</td><td>${i.nombre} ${i.type==='servicio'?'(servicio)':''}</td>
    <td><input type="number" min="1" value="${i.cant}" data-idx="${idx}" class="cant"/></td>
    <td>$${i.precio.toFixed(2)}</td><td>$${sub.toFixed(2)}</td>
    <td><button data-del="${idx}">✖</button></td>`;
    carritoBody.appendChild(tr);
  });
  carritoBody.querySelectorAll('.cant').forEach(inp=>{
    inp.onchange = ()=>{ const i=state.carrito[inp.dataset.idx]; i.cant = Number(inp.value); renderCarrito(); };
  });
  carritoBody.querySelectorAll('button[data-del]').forEach(btn=> btn.onclick = ()=>{ state.carrito.splice(Number(btn.dataset.del),1); renderCarrito(); });
  calcularTotales();
}
function calcularTotales(){
  ivaPctLabel.textContent = Number(state.config.iva_pct||0);
  const subtotal = state.carrito.reduce((a,i)=>a+i.cant*i.precio,0);
  const iva = subtotal * (Number(state.config.iva_pct||0)/100);
  const total = subtotal + iva;
  document.getElementById('subtotal').textContent=subtotal.toFixed(2);
  document.getElementById('iva').textContent=iva.toFixed(2);
  document.getElementById('total').textContent=total.toFixed(2);
  return {subtotal, iva, total};
}
buscador.addEventListener('input', ()=> renderResultados(filtrarCatalogo(buscador.value)));
renderResultados(filtrarCatalogo(''));
barcode.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){ addCarrito(barcode.value.trim(), 1, 'producto'); barcode.value=''; }
});

document.getElementById('btnCobrar').onclick = cobrar;
document.getElementById('btnCancelar').onclick = ()=>{ state.carrito=[]; renderCarrito(); };

function cobrar(){
  if(state.carrito.length===0) return alert('Carrito vacío');
  const {total, subtotal, iva} = calcularTotales();
  const metodo = document.getElementById('metodoPago').value;
  // afectar stock solo productos
  state.carrito.forEach(i=>{
    if(i.type==='producto'){
      const p = state.productos.find(p=>p.sku===i.clave);
      if(p) p.stock = Number(p.stock) - Number(i.cant);
    }
  });
  const folio = 'V' + Date.now();
  const venta = {
    folio, fecha: new Date().toISOString(), metodo, total, subtotal, iva,
    items: state.carrito.map(i=>({clave:i.clave,nombre:i.nombre,cant:i.cant,precio:i.precio,type:i.type}))
  };
  state.ventas.push(venta);
  DB.set('ventas', state.ventas);
  DB.set('productos', state.productos);
  state.carrito = [];
  renderCarrito();
  renderVentas();
  renderResultados(filtrarCatalogo(buscador.value));
  imprimirTicket(venta);
}

// Ticket toggle
const ticketToggle = document.getElementById('ticketToggle');
const ticketSec = document.getElementById('ticket');
ticketToggle.onclick = ()=> ticketSec.classList.toggle('hidden');

function imprimirTicket(v){
  document.getElementById('t-negocio').textContent = state.config.negocio || 'Dinamita Gym';
  document.getElementById('t-direccion').textContent = state.config.direccion || '';
  document.getElementById('t-telefono').textContent = state.config.telefono || '';
  document.getElementById('t-pie').textContent = state.config.pie || 'Gracias por su compra 💥';
  document.getElementById('t-folio').textContent = 'Folio: ' + v.folio;
  document.getElementById('t-fecha').textContent = new Date(v.fecha).toLocaleString();
  const tbody = document.querySelector('#t-items tbody');
  tbody.innerHTML='';
  v.items.forEach(it=>{
    const tr = document.createElement('tr');
    const sub = it.cant * it.precio;
    tr.innerHTML = `<td>${it.cant}</td><td>${it.nombre}</td><td>$${it.precio.toFixed(2)}</td><td>$${sub.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('t-subtotal').textContent = v.subtotal.toFixed(2);
  document.getElementById('t-iva').textContent = v.iva.toFixed(2);
  document.getElementById('t-total').textContent = v.total.toFixed(2);
  document.getElementById('t-metodo').textContent = v.metodo;
  // Mostrar ticket pero no estorbar: abre panel y lanza print
  ticketSec.classList.remove('hidden');
  window.print();
}

// Productos
const formProducto = document.getElementById('formProducto');
const tablaProductosBody = document.querySelector('#tablaProductos tbody');
document.getElementById('exportProductos').onclick = ()=> exportCSV('productos.csv', state.productos);

formProducto.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formProducto);
  const data = Object.fromEntries(fd.entries());
  data.costo = Number(data.costo); data.precio = Number(data.precio); data.stock = Number(data.stock);
  const ix = state.productos.findIndex(p=>p.sku===data.sku);
  if(ix>=0) state.productos[ix] = {...state.productos[ix], ...data};
  else state.productos.push(data);
  DB.set('productos', state.productos);
  formProducto.reset(); renderProductos(); renderResultados(filtrarCatalogo(buscador.value));
});
function renderProductos(){
  const q = (document.getElementById('buscarProductos').value||'').toLowerCase();
  const list = state.productos.filter(p=> (p.nombre+p.sku).toLowerCase().includes(q));
  tablaProductosBody.innerHTML='';
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.sku}</td><td>${p.nombre}</td><td>$${Number(p.costo).toFixed(2)}</td><td>$${Number(p.precio).toFixed(2)}</td><td>${Number(p.stock)}</td>
    <td><button data-editar="${p.sku}">Editar</button> <button data-borrar="${p.sku}">Borrar</button></td>`;
    tablaProductosBody.appendChild(tr);
  });
  tablaProductosBody.querySelectorAll('button[data-editar]').forEach(btn=> btn.onclick = ()=>{
    const p = state.productos.find(x=>x.sku===btn.dataset.editar);
    for(const k of ['sku','nombre','costo','precio','stock']) formProducto.elements[k].value = p[k];
  });
  tablaProductosBody.querySelectorAll('button[data-borrar]').forEach(btn=> btn.onclick = ()=>{
    const i = state.productos.findIndex(x=>x.sku===btn.dataset.borrar);
    if(i>=0){ state.productos.splice(i,1); DB.set('productos', state.productos); renderProductos(); renderResultados(filtrarCatalogo(buscador.value)); }
  });
}
document.getElementById('buscarProductos').addEventListener('input', renderProductos);

// Servicios
const formServicio = document.getElementById('formServicio');
const tablaServiciosBody = document.querySelector('#tablaServicios tbody');
document.getElementById('exportServicios').onclick = ()=> exportCSV('servicios.csv', state.servicios);

formServicio.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formServicio);
  const data = Object.fromEntries(fd.entries());
  data.duracion_dias = data.duracion_dias? Number(data.duracion_dias): null;
  data.precio = Number(data.precio);
  const ix = state.servicios.findIndex(s=>s.clave===data.clave);
  if(ix>=0) state.servicios[ix] = {...state.servicios[ix], ...data};
  else state.servicios.push(data);
  DB.set('servicios', state.servicios);
  formServicio.reset(); renderServicios(); renderResultados(filtrarCatalogo(buscador.value));
});
function renderServicios(){
  const q = (document.getElementById('buscarServicios').value||'').toLowerCase();
  const list = state.servicios.filter(s=> (s.nombre+s.clave+s.tipo).toLowerCase().includes(q));
  tablaServiciosBody.innerHTML='';
  list.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.clave}</td><td>${s.nombre}</td><td>${s.tipo}</td><td>${s.duracion_dias ?? ''}</td><td>$${Number(s.precio).toFixed(2)}</td>
    <td><button data-editar="${s.clave}">Editar</button> <button data-borrar="${s.clave}">Borrar</button></td>`;
    tablaServiciosBody.appendChild(tr);
  });
  tablaServiciosBody.querySelectorAll('button[data-editar]').forEach(btn=> btn.onclick = ()=>{
    const s = state.servicios.find(x=>x.clave===btn.dataset.editar);
    for(const k of ['clave','nombre','tipo','duracion_dias','precio']) formServicio.elements[k].value = s[k] ?? '';
  });
  tablaServiciosBody.querySelectorAll('button[data-borrar]').forEach(btn=> btn.onclick = ()=>{
    const i = state.servicios.findIndex(x=>x.clave===btn.dataset.borrar);
    if(i>=0){ state.servicios.splice(i,1); DB.set('servicios', state.servicios); renderServicios(); renderResultados(filtrarCatalogo(buscador.value)); }
  });
}
document.getElementById('buscarServicios').addEventListener('input', renderServicios);

// Compras
const formCompra = document.getElementById('formCompra');
const logCompras = document.getElementById('logCompras');
formCompra.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formCompra);
  const data = Object.fromEntries(fd.entries());
  data.cantidad = Number(data.cantidad);
  data.costo = data.costo ? Number(data.costo): null;
  const p = state.productos.find(p=>p.sku===data.sku);
  if(!p) return alert('SKU no existe en catálogo');
  p.stock = Number(p.stock) + data.cantidad;
  if(data.costo != null) p.costo = data.costo;
  DB.set('productos', state.productos);
  const entrada = { ...data, fecha:new Date().toISOString() };
  state.compras.push(entrada); DB.set('compras', state.compras);
  formCompra.reset(); renderProductos(); logComprasPrepend(entrada);
});
function logComprasPrepend(e){
  const div = document.createElement('div');
  div.className='card';
  div.textContent = `${new Date(e.fecha).toLocaleString()} • SKU ${e.sku} +${e.cantidad} ${(e.costo?(' $'+e.costo.toFixed(2)):'')}`;
  logCompras.prepend(div);
}
state.compras.slice(-10).forEach(logComprasPrepend);

// Clientes
const formCliente = document.getElementById('formCliente');
const tablaClientesBody = document.querySelector('#tablaClientes tbody');
document.getElementById('buscarClientes').addEventListener('input', renderClientes);
formCliente.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formCliente);
  const data = Object.fromEntries(fd.entries());
  if(!data.id) data.id = 'C' + Date.now();
  const ix = state.clientes.findIndex(c=>c.id===data.id);
  if(ix>=0) state.clientes[ix] = data; else state.clientes.push(data);
  DB.set('clientes', state.clientes);
  formCliente.reset(); renderClientes();
});
function renderClientes(){
  const q = (document.getElementById('buscarClientes').value||'').toLowerCase();
  const list = state.clientes.filter(c=> (c.nombre+c.telefono+c.email).toLowerCase().includes(q));
  tablaClientesBody.innerHTML='';
  list.forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.id}</td><td>${c.nombre}</td><td>${c.telefono||''}</td><td>${c.email||''}</td>
    <td><button data-edit="${c.id}">Editar</button> <button data-del="${c.id}">Borrar</button></td>`;
    tablaClientesBody.appendChild(tr);
  });
  tablaClientesBody.querySelectorAll('button[data-edit]').forEach(btn=> btn.onclick = ()=>{
    const c = state.clientes.find(x=>x.id===btn.dataset.edit);
    for(const k of ['id','nombre','telefono','email']) formCliente.elements[k].value = c[k]||'';
  });
  tablaClientesBody.querySelectorAll('button[data-del]').forEach(btn=> btn.onclick = ()=>{
    const i = state.clientes.findIndex(x=>x.id===btn.dataset.del);
    if(i>=0){ state.clientes.splice(i,1); DB.set('clientes', state.clientes); renderClientes(); }
  });
}

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
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${v.folio}</td><td>${new Date(v.fecha).toLocaleString()}</td><td>${v.metodo}</td><td>$${v.total.toFixed(2)}</td><td>${v.items.length}</td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById('filtrarVentas').onclick = renderVentas;
document.getElementById('exportVentas').onclick = ()=> exportCSV('ventas.csv', state.ventas);

// Config
const formConfig = document.getElementById('formConfig');
for(const k of ['negocio','direccion','telefono','iva_pct','pie']) formConfig.elements[k].value = state.config[k] ?? '';
formConfig.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formConfig);
  state.config = Object.fromEntries(fd.entries());
  DB.set('config', state.config);
  alert('Configuración guardada');
  calcularTotales();
});

// Helpers
function exportCSV(filename, data){
  const text = 'data:text/csv;charset=utf-8,' + toCSV(data);
  const a = document.createElement('a'); a.href = encodeURI(text); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
function toCSV(arr){
  if(!arr||!arr.length) return '';
  const cols = Object.keys(arr[0]);
  const rows = arr.map(o=> cols.map(c=> JSON.stringify(o[c] ?? '')).join(','));
  return cols.join(',') + '\n' + rows.join('\n');
}

// Accesos
document.addEventListener('keydown', (e)=>{ if(e.key==='F2'){ cobrar(); } });

// Seeds
if(state.productos.length===0){
  state.productos = [
    {sku:'PROT01', nombre:'Proteína Fresa 2lb', costo:200, precio:350, stock:10},
    {sku:'FAJA01', nombre:'Faja Neopreno', costo:80, precio:150, stock:15},
    {sku:'GUAN01', nombre:'Guantes Gym', costo:90, precio:180, stock:20}
  ];
  DB.set('productos', state.productos);
}
if(state.servicios.length===0){
  state.servicios = [
    {clave:'VIS', nombre:'Visita', tipo:'visita', duracion_dias:1, precio:30},
    {clave:'SEM', nombre:'Semana', tipo:'semana', duracion_dias:7, precio:120},
    {clave:'MES', nombre:'Mensualidad', tipo:'mes', duracion_dias:30, precio:250},
    {clave:'6M', nombre:'6 meses', tipo:'6m', duracion_dias:180, precio:1200},
    {clave:'12M', nombre:'Anualidad', tipo:'12m', duracion_dias:365, precio:2000}
  ];
  DB.set('servicios', state.servicios);
}
renderResultados(filtrarCatalogo(''));
renderProductos(); renderServicios(); renderClientes(); renderVentas(); calcularTotales();
