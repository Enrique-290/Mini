
// --- Storage helpers ---
const DB = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
  },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)) }
};

// --- Models ---
const state = {
  productos: DB.get('productos', []),
  clientes: DB.get('clientes', []),
  ventas: DB.get('ventas', []),
  compras: DB.get('compras', []),
  config: DB.get('config', {negocio:'Dinamita Gym', direccion:'', telefono:'', pie:'Gracias por su compra en Dinamita Gym 💥'}),
  carrito: []
};

// --- UI Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(s=>s.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='productos') renderProductos();
    if(btn.dataset.tab==='clientes') renderClientes();
    if(btn.dataset.tab==='reportes') renderVentas();
  });
});

// --- Ventas ---
const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');
const barcode = document.getElementById('barcode');
const carritoBody = document.querySelector('#carritoTabla tbody');

function filtrarProductos(q){
  q = q.toLowerCase();
  return state.productos.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
}
function renderResultados(list){
  resultados.innerHTML = '';
  list.forEach(p=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `<h4>${p.nombre}</h4>
      <div>SKU: ${p.sku}</div>
      <div>$${Number(p.precio).toFixed(2)}</div>
      <button>Agregar</button>`;
    card.querySelector('button').onclick = ()=> addCarrito(p.sku, 1);
    resultados.appendChild(card);
  });
}
function addCarrito(sku, cant){
  const prod = state.productos.find(p=>p.sku===sku);
  if(!prod) return alert('SKU no encontrado');
  let item = state.carrito.find(i=>i.sku===sku);
  if(!item){ item = {sku, nombre: prod.nombre, precio: Number(prod.precio), cant: 0}; state.carrito.push(item); }
  item.cant += Number(cant||1);
  renderCarrito();
}
function renderCarrito(){
  carritoBody.innerHTML = '';
  state.carrito.forEach((i, idx)=>{
    const tr = document.createElement('tr');
    const sub = i.cant * i.precio;
    tr.innerHTML = `<td>${i.sku}</td><td>${i.nombre}</td>
      <td><input type="number" min="1" value="${i.cant}" data-idx="${idx}" class="cant"/></td>
      <td>$${i.precio.toFixed(2)}</td><td>$${sub.toFixed(2)}</td>
      <td><button data-del="${idx}">✖</button></td>`;
    carritoBody.appendChild(tr);
  });
  carritoBody.querySelectorAll('.cant').forEach(inp=>{
    inp.onchange = (e)=>{ const i=state.carrito[inp.dataset.idx]; i.cant = Number(inp.value); renderCarrito(); };
  });
  carritoBody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.onclick = ()=>{ state.carrito.splice(Number(btn.dataset.del),1); renderCarrito(); };
  });
  calcularTotales();
}
function calcularTotales(){
  const subtotal = state.carrito.reduce((a,i)=>a+i.cant*i.precio,0);
  const iva = 0; // simple
  const total = subtotal + iva;
  document.getElementById('subtotal').textContent=subtotal.toFixed(2);
  document.getElementById('iva').textContent=iva.toFixed(2);
  document.getElementById('total').textContent=total.toFixed(2);
  return {subtotal, iva, total};
}

// buscador
buscador.addEventListener('input', ()=> renderResultados(filtrarProductos(buscador.value)));
renderResultados(state.productos);
// barcode input: enter triggers add
barcode.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    addCarrito(barcode.value.trim(), 1);
    barcode.value='';
  }
});
// Cobrar
document.getElementById('btnCobrar').onclick = cobrar;
document.getElementById('btnCancelar').onclick = ()=>{ state.carrito=[]; renderCarrito(); };

function cobrar(){
  if(state.carrito.length===0) return alert('Carrito vacío');
  const {total, subtotal, iva} = calcularTotales();
  const metodo = document.getElementById('metodoPago').value;
  // Descontar stock
  state.carrito.forEach(i=>{
    const p = state.productos.find(p=>p.sku===i.sku);
    if(p) p.stock = Number(p.stock) - Number(i.cant);
  });
  const folio = 'V' + Date.now();
  const venta = {
    folio, fecha: new Date().toISOString(), metodo, total, subtotal, iva,
    items: state.carrito.map(i=>({sku:i.sku,nombre:i.nombre,cant:i.cant,precio:i.precio}))
  };
  state.ventas.push(venta);
  DB.set('ventas', state.ventas);
  DB.set('productos', state.productos);
  state.carrito = [];
  renderCarrito();
  renderVentas();
  imprimirTicket(venta);
}

// Ticket
function imprimirTicket(v){
  // header
  document.getElementById('t-negocio').textContent = state.config.negocio || 'Dinamita Gym';
  document.getElementById('t-direccion').textContent = state.config.direccion || '';
  document.getElementById('t-telefono').textContent = state.config.telefono || '';
  document.getElementById('t-pie').textContent = state.config.pie || 'Gracias por su compra 💥';
  document.getElementById('t-folio').textContent = 'Folio: ' + v.folio;
  document.getElementById('t-fecha').textContent = new Date(v.fecha).toLocaleString();
  // items
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
  // print
  window.print();
}

// --- Productos CRUD ---
const formProducto = document.getElementById('formProducto');
const tablaProductosBody = document.querySelector('#tablaProductos tbody');
document.getElementById('exportProductos').onclick = ()=> exportCSV('productos.csv', state.productos);

formProducto.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formProducto);
  const data = Object.fromEntries(fd.entries());
  data.costo = Number(data.costo);
  data.precio = Number(data.precio);
  data.stock = Number(data.stock);
  const ix = state.productos.findIndex(p=>p.sku===data.sku);
  if(ix>=0){ state.productos[ix] = {...state.productos[ix], ...data}; }
  else { state.productos.push(data); }
  DB.set('productos', state.productos);
  formProducto.reset();
  renderProductos();
  renderResultados(state.productos);
});

function renderProductos(){
  const q = (document.getElementById('buscarProductos').value||'').toLowerCase();
  const list = state.productos.filter(p=> (p.nombre+p.sku).toLowerCase().includes(q));
  tablaProductosBody.innerHTML='';
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.sku}</td><td>${p.nombre}</td>
    <td>$${Number(p.costo).toFixed(2)}</td><td>$${Number(p.precio).toFixed(2)}</td>
    <td>${Number(p.stock)}</td>
    <td>
      <button data-editar="${p.sku}">Editar</button>
      <button data-borrar="${p.sku}">Borrar</button>
    </td>`;
    tablaProductosBody.appendChild(tr);
  });
  tablaProductosBody.querySelectorAll('button[data-editar]').forEach(btn=>{
    btn.onclick = ()=>{
      const p = state.productos.find(x=>x.sku===btn.dataset.editar);
      for(const k of ['sku','nombre','costo','precio','stock']) formProducto.elements[k].value = p[k];
      document.querySelector('.tab-btn[data-tab="productos"]').click();
    };
  });
  tablaProductosBody.querySelectorAll('button[data-borrar]').forEach(btn=>{
    btn.onclick = ()=>{
      const i = state.productos.findIndex(x=>x.sku===btn.dataset.borrar);
      if(i>=0){ state.productos.splice(i,1); DB.set('productos', state.productos); renderProductos(); renderResultados(state.productos); }
    };
  });
}
document.getElementById('buscarProductos').addEventListener('input', renderProductos);

// --- Compras ---
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
  state.compras.push(entrada);
  DB.set('compras', state.compras);
  formCompra.reset();
  renderProductos();
  logComprasPrepend(entrada);
});
function logComprasPrepend(e){
  const div = document.createElement('div');
  div.className='card';
  div.textContent = `${new Date(e.fecha).toLocaleString()} • SKU ${e.sku} +${e.cantidad} ${(e.costo?(' $'+e.costo.toFixed(2)):'')}`;
  logCompras.prepend(div);
}
state.compras.slice(-10).forEach(logComprasPrepend);

// --- Clientes CRUD ---
const formCliente = document.getElementById('formCliente');
const tablaClientesBody = document.querySelector('#tablaClientes tbody');
document.getElementById('buscarClientes').addEventListener('input', renderClientes);

formCliente.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formCliente);
  const data = Object.fromEntries(fd.entries());
  if(!data.id) data.id = 'C' + Date.now();
  const ix = state.clientes.findIndex(c=>c.id===data.id);
  if(ix>=0) state.clientes[ix] = data;
  else state.clientes.push(data);
  DB.set('clientes', state.clientes);
  formCliente.reset();
  renderClientes();
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
  tablaClientesBody.querySelectorAll('button[data-edit]').forEach(btn=>{
    btn.onclick = ()=>{
      const c = state.clientes.find(x=>x.id===btn.dataset.edit);
      for(const k of ['id','nombre','telefono','email']) formCliente.elements[k].value = c[k]||'';
      document.querySelector('.tab-btn[data-tab="clientes"]').click();
    };
  });
  tablaClientesBody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.onclick = ()=>{
      const i = state.clientes.findIndex(x=>x.id===btn.dataset.del);
      if(i>=0){ state.clientes.splice(i,1); DB.set('clientes', state.clientes); renderClientes(); }
    };
  });
}

// --- Reportes Ventas ---
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

// --- Config ---
const formConfig = document.getElementById('formConfig');
formConfig.elements['negocio'].value = state.config.negocio||'';
formConfig.elements['direccion'].value = state.config.direccion||'';
formConfig.elements['telefono'].value = state.config.telefono||'';
formConfig.elements['pie'].value = state.config.pie||'';
formConfig.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(formConfig);
  state.config = Object.fromEntries(fd.entries());
  DB.set('config', state.config);
  alert('Configuración guardada');
});

// --- CSV helper ---
function exportCSV(filename, data){
  const text = 'data:text/csv;charset=utf-8,' + toCSV(data);
  const a = document.createElement('a');
  a.href = encodeURI(text);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function toCSV(arr){
  if(!arr||!arr.length) return '';
  const cols = Object.keys(arr[0]);
  const rows = arr.map(o=> cols.map(c=> JSON.stringify(o[c] ?? '')).join(','));
  return cols.join(',') + '\n' + rows.join('\n');
}

// --- Accesos rápidos ---
document.addEventListener('keydown', (e)=>{
  if(e.key === 'F2'){ cobrar(); }
});

// seed demo
if(state.productos.length===0){
  state.productos = [
    {sku:'PROT01', nombre:'Proteína Fresa 2lb', costo:200, precio:350, stock:10},
    {sku:'FAJA01', nombre:'Faja Neopreno', costo:80, precio:150, stock:15},
    {sku:'GUAN01', nombre:'Guantes Gym', costo:90, precio:180, stock:20}
  ];
  DB.set('productos', state.productos);
  renderResultados(state.productos);
}
renderResultados(state.productos);
renderProductos();
renderClientes();
renderVentas();
