import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../payments.js',import.meta.url),'utf8');
const orderId='a25c7ecf-27ae-4658-813b-2c3eac277b82';
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function setup(responder){
  const nodes=new Map(),calls=[],events=[],viewerCalls=[],toasts=[];
  class Element{
    constructor(id){this.id=id;this.children=[];this.style={};this.dataset={};this.classList={contains:()=>false};this.checked=false;this.value='';this._html='';}
    set innerHTML(value){this._html=value;for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));}
    get innerHTML(){return this._html;}
    setAttribute(k,v){this[k]=v;}
    prepend(el){this.children.unshift(el);if(el.id)nodes.set(el.id,el);}
    append(el){this.children.push(el);if(el.id)nodes.set(el.id,el);}
    before(){}
    querySelector(){return new Element();}
    querySelectorAll(){return [];}
    remove(){nodes.delete(this.id);}
  }
  for(const id of ['payment-content','payments-editor'])nodes.set(id,new Element(id));
  const body=new Element('body'),main=new Element('main');
  const document={body,getElementById:id=>nodes.get(id)||null,querySelector:s=>s==='main'?main:null,querySelectorAll:()=>[],
    createElement:()=>new Element(),addEventListener:(event,fn)=>events.push({event,fn})};
  let person={uid:'alumna-1',email:'alumna@example.test',emailVerified:true,getIdToken:async()=> 'firebase-id-token'};
  const auth={get currentUser(){return person;},onAuthStateChanged:fn=>{queueMicrotask(()=>fn(person));return ()=>{};}};
  const ctx={MIRA_PAYMENTS_API:'https://mira-pagos.example.workers.dev',console,document,location:{href:'',search:'',pathname:'/pagos.html'},URL,URLSearchParams,AbortController,
    setTimeout,clearTimeout,crypto,Intl,Blob,queueMicrotask,localStorage:storage(),sessionStorage:storage(),
    firebase:{auth:()=>auth},gc:()=>[],gEB:()=>[],toast:s=>toasts.push(s),openViewer:id=>viewerCalls.push(id),
    fetch:async(input,options={})=>{
      const url=new URL(input),call={path:url.pathname,method:options.method||'GET',headers:options.headers,
        body:options.body?JSON.parse(options.body):undefined};calls.push(call);
      if(url.pathname==='/health')return new Response(JSON.stringify({ready:true,mode:'test',apiVersion:'digital-v2'}));
      return responder(call);
    }};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(source.replace('  async function accessProduct(kind,id,box){','  window.__paymentPage=paymentPage;\n  async function accessProduct(kind,id,box){'),ctx);
  return {ctx,nodes,calls,toasts,viewerCalls,setUser:u=>{person=u;}};
}
const ok=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('reserva muestra seña y saldo del servidor y no consulta acceso a un curso',async()=>{
  const t=setup(c=>{
    if(c.path==='/quote')return ok({kind:'booking',title:'Clásicas',totalCents:6000000,amountCents:1800000,balanceCents:4200000,depositPercent:30,booking:{date:'2026-12-01',time:'09:00'}});
    if(c.path==='/checkout')return ok({checkoutUrl:'https://www.mercadopago.com.ar/checkout'});
    throw Error('No se esperaba '+c.path);
  });
  t.ctx.sessionStorage.setItem('mira_checkout',JSON.stringify({kind:'booking',services:['Clásicas'],date:'2026-12-01',time:'09:00',name:'Alumna',tel:'1122334455'}));
  await t.ctx.__paymentPage();
  assert.match(t.nodes.get('payment-content').innerHTML,/Seña: 30%/);assert.match(t.nodes.get('payment-content').innerHTML,/42\.000/);
  await t.nodes.get('pay-now').onclick({target:t.nodes.get('pay-now')});
  assert.equal(t.calls.some(c=>c.path==='/access'),false);
  assert.equal(t.calls.find(c=>c.path==='/checkout').body.acceptedAmountCents,1800000);
});
test('cliente usa la API compatible y adjunta el token de Firebase',async()=>{
  const t=setup(()=>ok([]));await t.ctx.miraPayments.api('/orders');
  assert.equal(t.calls[0].path,'/health');assert.equal(t.calls[0].headers,undefined);
  assert.equal(t.calls[1].headers.Authorization,'Bearer firebase-id-token');
  assert.equal(t.nodes.get('payments-test-banner').textContent.includes('Modo de prueba'),true);
});
test('el cliente rechaza un Worker antiguo antes de enviarle una compra',async()=>{
  const t=setup(()=>ok([]));
  t.ctx.fetch=async(input)=>ok(new URL(input).pathname==='/health'?{ready:true,mode:'test'}:{});
  await assert.rejects(t.ctx.miraPayments.api('/checkout',{}),/Falta actualizar/);
});
test('no hace solicitudes con email sin verificar',async()=>{
  const t=setup(()=>ok({}));t.setUser({uid:'a',emailVerified:false});
  await assert.rejects(t.ctx.miraPayments.api('/orders'),/Verificá/);assert.equal(t.calls.length,0);
});
test('elegir un ebook conserva solo su selección y abre la página de compra',()=>{
  const t=setup(()=>ok({}));t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';t.ctx.buyEbook('eb1');
  assert.deepEqual(JSON.parse(t.ctx.sessionStorage.getItem('mira_checkout')),{kind:'ebook',productId:'eb1'});
  assert.equal(t.ctx.location.href,'pagos.html');
});
test('checkout envía la cotización del servidor y conserva una referencia al reintentar',async()=>{
  let attempts=0;
  const t=setup(c=>{
    if(c.path==='/access')return ok({error:'Requiere compra'},403);
    if(c.path==='/quote')return ok({kind:'course',productId:'1',title:'Curso',totalCents:1990000,amountCents:1990000});
    if(c.path==='/checkout'){attempts++;return attempts===1?ok({error:'No respondió el servicio'},503):ok({checkoutUrl:'https://www.mercadopago.com.ar/checkout'});}
    throw Error('Ruta inesperada');
  });
  t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';
  t.ctx.sessionStorage.setItem('mira_checkout',JSON.stringify({kind:'course',productId:'1',amountCents:1}));
  await t.ctx.__paymentPage();
  assert.match(t.nodes.get('payment-content').innerHTML,/19\.900/);
  await t.nodes.get('pay-now').onclick({target:t.nodes.get('pay-now')});
  const first=t.calls.find(c=>c.path==='/checkout').body;
  await t.nodes.get('pay-now').onclick({target:t.nodes.get('pay-now')});
  const body=t.calls.filter(c=>c.path==='/checkout')[1].body;
  assert.equal(first.requestId,body.requestId);
  assert.equal(body.acceptedAmountCents,1990000);assert.equal(body.acceptedTotalCents,1990000);
  assert.match(body.requestId,/^[0-9a-f-]{36}$/);assert.equal(t.ctx.location.href,'https://www.mercadopago.com.ar/checkout');
});
test('status aprobado en la URL no muestra acceso sin confirmación del servidor',async()=>{
  const t=setup(c=>{
    if(c.path==='/order')return ok({id:orderId,kind:'course',productId:'1',title:'Curso',amountCents:1990000,status:'pending',live:false});
    if(c.path==='/verify-order')return ok({order:{id:orderId,kind:'course',productId:'1',title:'Curso',amountCents:1990000,status:'approved',live:false}});
    throw Error('Ruta inesperada');
  });
  t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';
  t.ctx.location.search='?order='+orderId+'&status=approved';
  await t.ctx.__paymentPage();
  assert.doesNotMatch(t.nodes.get('payment-content').innerHTML,/Acceder al producto/);
  assert.match(t.nodes.get('payment-content').innerHTML,/Pago pendiente/);
  await t.nodes.get('pay-refresh').onclick({target:t.nodes.get('pay-refresh')});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(t.calls.some(c=>c.path==='/verify-order'),true);
  assert.equal(t.nodes.get('payment-content').children.some(c=>c.textContent==='Acceder al producto'),true);
});
test('un identificador del retorno se envía a verificar, sin confiar en su estado',async()=>{
  const t=setup(c=>{
    assert.equal(c.path,'/verify-order');assert.equal(c.body.paymentId,'9876');
    return ok({order:{id:orderId,kind:'course',title:'Curso',status:'rejected',amountCents:1990000}});
  });
  t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';
  t.ctx.location.search='?order='+orderId+'&payment_id=9876&status=approved';
  await t.ctx.__paymentPage();assert.match(t.nodes.get('payment-content').innerHTML,/Pago rechazado/);
  assert.equal(t.nodes.get('payment-content').children.length,0);
});
test('un cambio de sesión mientras carga una clase no conserva el contenido recibido',async()=>{
  const t=setup(()=>{t.setUser({uid:'otra',emailVerified:true});return ok({id:1,title:'Privado',modules:[]});});
  t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';
  await t.ctx.openViewer(1);assert.equal(t.viewerCalls.length,0);assert.equal(t.ctx.miraCourseAuthorized(1),false);
  assert.equal(t.toasts.some(s=>s.includes('sesión cambió')),true);
});
test('panel de pagos guarda solo la habilitación digital y permite comprobar las conexiones',async()=>{
  const t=setup(c=>{
    if(c.path==='/settings')return ok({settings:{enabled:false},environment:'test'});
    if(c.path==='/admin-orders')return ok([]);
    if(c.path==='/diagnostics')return ok({firestore:true,mercadopago:true,catalogReady:true});
    throw Error('Ruta inesperada');
  });
  t.ctx.MIRA_PAYMENTS_API='https://mira-pagos.example.workers.dev';
  await t.ctx.admRenderPayments();
  t.nodes.get('pay-enabled').checked=true;
  await t.nodes.get('payment-settings-form').onsubmit({preventDefault(){},target:t.nodes.get('payment-settings-form')});
  assert.deepEqual(t.calls.find(c=>c.path==='/settings'&&c.method==='POST').body,{enabled:true});
  await t.nodes.get('pay-check-connection').onclick({target:t.nodes.get('pay-check-connection')});
  assert.match(t.nodes.get('pay-connection-status').textContent,/Conexión correcta/);
});
test('los seis HTML activos cargan los scripts actualizados y su JavaScript inline compila',async()=>{
  for(const file of ['index.html','admin.html','cursos.html','dashboard.html','servicios.html','pagos.html']){
    const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.match(html,/payment-config\.js\?v=20261113mp2/);assert.match(html,/payments\.js\?v=20261124fix1/);
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
      if(!/\bsrc\s*=|\btype\s*=\s*["'](?:application\/ld\+json|text\/plain)/i.test(match[1]))
        assert.doesNotThrow(()=>new vm.Script(match[2],{filename:file}));
  }
});


const saleUi=await readFile(new URL('../avisos.js',import.meta.url),'utf8');
function mailPanelResponder(call){
  if(call.path==='/settings')return ok({settings:{enabled:false},environment:'live'});
  if(call.path==='/admin-orders')return ok([]);
  if(call.path==='/sale-email/settings')return ok({enabled:false,includeTests:false,configured:true,
    from:'Mira <ventas@example.test>',recipient:'estudiosmira@gmail.com',environment:'production',testDomain:false});
  if(call.path==='/sale-email/notices')return ok([]);
  throw Error('Ruta no esperada: '+call.path);
}
test('el panel de avisos guarda solo preferencias y mantiene el destino como información',async()=>{
  const t=setup(mailPanelResponder);vm.runInContext(saleUi,t.ctx);await t.ctx.admRenderPayments();
  assert.match(t.nodes.get('sale-email-panel').innerHTML,/estudiosmira@gmail\.com/);
  t.nodes.get('sale-email-enabled').checked=true;
  await t.nodes.get('sale-email-form').onsubmit({preventDefault(){},target:t.nodes.get('sale-email-form')});
  const save=t.calls.find(c=>c.path==='/sale-email/settings'&&c.method==='POST');
  assert.deepEqual(save.body,{enabled:true,includeTests:false});
  assert.equal(JSON.stringify(save.body).includes('RESEND'),false);
});
test('reintentar el correo de prueba conserva la misma referencia hasta su aceptación',async()=>{
  let attempts=0;
  const t=setup(c=>c.path==='/sale-email/test'?ok({status:++attempts===1?'failed':'sent',errorCode:attempts===1?'transport':''}):mailPanelResponder(c));
  vm.runInContext(saleUi,t.ctx);await t.ctx.admRenderPayments();
  const click=()=>t.nodes.get('sale-email-test').onclick({target:t.nodes.get('sale-email-test')});
  await click();await click();
  const sent=t.calls.filter(c=>c.path==='/sale-email/test');
  assert.equal(sent[0].body.requestId,sent[1].body.requestId);
  assert.match(t.nodes.get('sale-email-message').textContent,/aceptado por Resend/);
  await click();
  assert.notEqual(t.calls.filter(c=>c.path==='/sale-email/test')[2].body.requestId,sent[0].body.requestId);
});
test('el historial de avisos escapa contenido del catálogo antes de mostrarlo',async()=>{
  const t=setup(c=>c.path==='/sale-email/notices'?ok([{id:'sale_'+orderId,title:'<img src=x onerror=alert(1)>',
    status:'failed',category:'sale',mode:'production',errorCode:'transport'}]):mailPanelResponder(c));
  vm.runInContext(saleUi,t.ctx);await t.ctx.admRenderPayments();
  const html=t.nodes.get('sale-email-history').innerHTML;
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
test('admin carga la extensión de avisos después de la API de pagos',async()=>{
  const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('avisos.js?v=20261116mail1')>html.indexOf('payments.js?v=20261113mp2'));
  assert.doesNotThrow(()=>new vm.Script(saleUi));
});
