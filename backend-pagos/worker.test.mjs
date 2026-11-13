import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const {default:worker,catalogPrice,encodeValue,decodeValue,validatePayment,verifyWebhookSignature,checkoutUrl,publicItem}=await import(
  'data:text/javascript;base64,'+Buffer.from(source+'\nexport {catalogPrice,encodeValue,decodeValue,validatePayment,verifyWebhookSignature,checkoutUrl,publicItem};').toString('base64'));
const base='https://mira-pagos.example.workers.dev',site='https://mirastudiotb.com';
const orderId='a25c7ecf-27ae-4658-813b-2c3eac277b82';
const user={uid:'alumna-1',email:'alumna@example.test'},admin={uid:'duena-1',email:'estudiosmira@gmail.com'};
let env,docs,version,payments,preferenceBody,accountVerified,conflictOnce,failCommit,unknownFetches,preferenceCount,accountIsTest,tokenSeq=0;
const realFetch=globalThis.fetch;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const fields=o=>encodeValue(o).mapValue.fields;
const plain=f=>decodeValue({mapValue:{fields:f||{}}});
const name=path=>'projects/mira-estudio/databases/(default)/documents/'+path;
function put(path,data){docs.set(path,{data:structuredClone(data),updateTime:'version-'+(++version)});}
function entPath(paymentId='9876'){return 'entitlements/'+orderId+'_'+paymentId;}
function order(overrides={}){return {id:orderId,uid:user.uid,email:user.email,kind:'course',productType:'course',productId:'1',title:'Curso de prueba',
  amountCents:1990000,totalCents:1990000,currency:'ARS',status:'created',createdAt:1,expiresAt:Date.now()+100000,mode:'test',collectorId:'1234',...overrides};}
function payment(overrides={}){return {id:9876,collector_id:1234,external_reference:orderId,currency_id:'ARS',transaction_amount:19900,
  transaction_amount_refunded:0,live_mode:false,status:'approved',date_last_updated:'2026-11-13T15:00:00Z',
  metadata:{mira_uid:user.uid,mira_order_id:orderId,product_type:'course',product_id:'1'},...overrides};}
function request(path,body,token='valid-token',origin=site){return new Request(base+path,{
  method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function call(path,body,token,origin){const response=await worker.fetch(request(path,body,token,origin),env);return {status:response.status,data:await response.json(),response};}
const checkoutBody=(patch={})=>({kind:'course',productId:'1',requestId:orderId,acceptedAmountCents:1990000,acceptedTotalCents:1990000,...patch});
async function signedWebhook(p,secret=env.MP_WEBHOOK_SECRET){
  const id=String(p.id),rid='request-123',ts='1704908010';
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('id:'+id+';request-id:'+rid+';ts:'+ts+';'));
  return new Request(base+'/webhooks/mercadopago?data.id='+id,{method:'POST',headers:{'Content-Type':'application/json','x-request-id':rid,
    'x-signature':'ts='+ts+',v1='+Buffer.from(bytes).toString('hex')},body:JSON.stringify({type:'payment',data:{id}})});
}
before(async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const key=await crypto.subtle.exportKey('pkcs8',pair.privateKey);
  env={SITE_ORIGIN:site,WORKER_ORIGIN:base,FIREBASE_PROJECT_ID:'mira-estudio',FIREBASE_API_KEY:'public-test-key',
    FIREBASE_CLIENT_EMAIL:'test-account@example.test',FIREBASE_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(key).toString('base64')+'\n-----END PRIVATE KEY-----',
    MP_ACCESS_TOKEN:'fake-test-token',MP_WEBHOOK_SECRET:'fake-test-secret',MP_ENV:'test'};
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(input),body=options.body?JSON.parse(String(options.body).startsWith('{')?options.body:'{}'):{};
    if(url.hostname==='oauth2.googleapis.com')return json({access_token:'test-oauth-token'});
    if(url.hostname==='identitytoolkit.googleapis.com'){
      const person=body.idToken==='admin-token'?admin:body.idToken==='valid-token'?user:null;
      return person?json({users:[{localId:person.uid,email:person.email,emailVerified:accountVerified}]}):json({error:{}},400);
    }
    if(url.hostname==='api.mercadopago.com'){
      if(url.pathname==='/users/me')return json({id:1234,site_id:'MLA',tags:accountIsTest?['test_user']:[]});
      if(url.pathname==='/checkout/preferences'){
        preferenceBody=body;preferenceCount++;
        return json({id:'pref-1',init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1',
          sandbox_init_point:'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1'});
      }
      if(url.pathname==='/v1/payments/search')return json({results:[...payments.values()].filter(p=>p.external_reference===url.searchParams.get('external_reference'))});
      const id=url.pathname.match(/^\/v1\/payments\/(\d+)$/)?.[1];
      if(id)return payments.has(id)?json(payments.get(id)):json({error:'not found'},404);
    }
    if(url.hostname==='firestore.googleapis.com'){
      const suffix=decodeURIComponent(url.pathname).split('/documents')[1];
      if(suffix.endsWith(':runQuery')){
        const parent=suffix.slice(0,-9).replace(/^\//,''),q=body.structuredQuery;
        const collection=(parent?parent+'/':'')+q.from[0].collectionId+'/';
        let rows=[...docs.entries()].filter(([path])=>path.startsWith(collection)&&!path.slice(collection.length).includes('/'));
        if(q.where){const f=q.where.fieldFilter;rows=rows.filter(([,doc])=>doc.data[f.field.fieldPath]===decodeValue(f.value));}
        return json(rows.slice(0,q.limit||500).map(([path,doc])=>({document:{name:name(path),fields:fields(doc.data),updateTime:doc.updateTime}})));
      }
      if(suffix===':commit'){
        if(failCommit)return json({error:{status:'UNAVAILABLE'}},503);
        if(conflictOnce){conflictOnce=false;return json({error:{status:'FAILED_PRECONDITION'}},400);}
        for(const w of body.writes){
          const path=(w.update?.name||w.delete).split('/documents/')[1],old=docs.get(path);
          if(w.currentDocument?.exists===false&&old)return json({error:{status:'ALREADY_EXISTS'}},409);
          if(w.currentDocument?.updateTime&&w.currentDocument.updateTime!==old?.updateTime)return json({error:{status:'FAILED_PRECONDITION'}},400);
        }
        for(const w of body.writes){
          const path=(w.update?.name||w.delete).split('/documents/')[1];
          if(w.delete){docs.delete(path);continue;}
          const old=docs.get(path)?.data||{},incoming=plain(w.update.fields);
          put(path,w.updateMask?{...old,...incoming}:incoming);
        }
        return json({writeResults:[]});
      }
      const doc=docs.get(suffix.replace(/^\//,''));
      return doc?json({name:name(suffix.slice(1)),fields:fields(doc.data),updateTime:doc.updateTime}):json({error:{status:'NOT_FOUND'}},404);
    }
    unknownFetches.push(String(input));throw Error('Unexpected outbound request');
  };
});
after(()=>{globalThis.fetch=realFetch;});
beforeEach(()=>{
  docs=new Map();payments=new Map();version=0;preferenceBody=null;preferenceCount=0;accountVerified=true;conflictOnce=false;failCommit=false;unknownFetches=[];env.MP_ENV='test';accountIsTest=true;env.MP_ACCESS_TOKEN='APP_USR_fake_'+(++tokenSeq);
  const course={id:1,title:'Curso de prueba',price:'$19.900',locked:false,modules:[{id:1,title:'Módulo',lessons:[{id:1,title:'Clase',videoUrl:'https://private.test/video'}]}]};
  const ebook={id:'eb1',title:'Ebook',price:'$9.900',paid:true,downloadLink:'https://private.test/ebook.pdf'};
  put('privateCatalog/courses',{v:[course]});put('privateCatalog/ebooks',{v:[ebook]});
  put('digitalContent/course_1',{kind:'course',productId:'1',product:course});
  put('digitalContent/ebook_eb1',{kind:'ebook',productId:'eb1',product:ebook});
  put('site/courses',{accessVersion:2,v:[publicItem(course,'courses')]});put('site/ebooks',{accessVersion:2,v:[publicItem(ebook,'ebooks')]});
  put('paymentConfig/digital_test',{enabled:true});put('users/'+user.uid,{name:'Alumna',email:user.email,role:'student'});
});

test('precios argentinos del catálogo: acepta miles y decimales, rechaza monedas y formatos ambiguos',()=>{
  for(const [price,cents] of [['$19.900',1990000],['ARS 19.900,50',1990050],['19900',1990000],['19900,5',1990050],['Gratis',0]])
    assert.equal(catalogPrice({price},'course'),cents);
  for(const price of ['USD 29','US$ 29','$9.99','Consultar','','$19.900 a $29.900','19,900.50','-$10','0'])
    assert.throws(()=>catalogPrice({price},'course'));
  assert.equal(catalogPrice({priceArs:19900.50},'course'),1990050);
  assert.throws(()=>catalogPrice({priceArs:'19900'},'course'));
});
test('Firestore conserva mapas, arrays, booleanos y números',()=>{
  const data={v:[{n:'curso',paid:true,price:9.5,empty:null}],count:10,off:false};
  assert.deepEqual(decodeValue(encodeValue(data)),data);
});
test('cotiza desde digitalContent ignorando importe e identidad enviados por la alumna',async()=>{
  const r=await call('/quote',{kind:'course',productId:'1',amountCents:1,uid:'otra'});
  assert.equal(r.status,200);assert.equal(r.data.amountCents,1990000);
  assert.equal(r.data.kind,'course');assert.equal(JSON.stringify(r.data).includes('private.test'),false);
});
test('crea checkout compatible con pagos.html y no habilita contenido antes del pago',async()=>{
  const r=await call('/checkout',checkoutBody({uid:'otra',priceArs:1}));
  assert.equal(r.status,200);assert.match(r.data.checkoutUrl,/www\.mercadopago/);
  assert.equal(preferenceBody.items[0].unit_price,19900);
  assert.equal(preferenceBody.metadata.mira_uid,user.uid);
  assert.equal(preferenceBody.back_urls.success,site+'/pagos.html?order='+orderId);
  assert.equal(preferenceBody.notification_url,base+'/webhooks/mercadopago');
  assert.equal(preferenceBody.expires,true);assert.equal(preferenceBody.payer,undefined);
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  assert.deepEqual(await call('/my-access').then(r=>r.data),[]);assert.deepEqual(unknownFetches,[]);
});
test('rechaza precios aceptados obsoletos y catálogos sin proteger',async()=>{
  assert.equal((await call('/checkout',checkoutBody({acceptedAmountCents:1}))).status,409);
  assert.equal(preferenceBody,null);
  put('site/courses',{v:[]});
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,422);
});
test('doble clic con la misma referencia reutiliza un solo checkout',async()=>{
  const a=await call('/checkout',checkoutBody()),b=await call('/checkout',checkoutBody());
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.data.checkoutUrl,b.data.checkoutUrl);assert.equal(preferenceCount,1);
});
test('una referencia expirada no se reutiliza y una compra confirmada no se vuelve a cobrar',async()=>{
  put('orders/'+orderId,order({status:'approved'}));
  assert.equal((await call('/checkout',checkoutBody())).status,409);
  put('orders/'+orderId,order({checkoutUrl:'https://www.mercadopago.com.ar/pay',expiresAt:1}));
  assert.equal((await call('/checkout',checkoutBody())).status,409);assert.equal(preferenceCount,0);
});
test('rechaza sesiones inválidas y emails sin verificar',async()=>{
  assert.equal((await call('/quote',{kind:'course',productId:'1'},'invalid')).status,401);
  accountVerified=false;assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,403);
});
test('compras apagadas, contenido bloqueado y precio faltante impiden cobrar',async()=>{
  put('paymentConfig/digital_test',{enabled:false});
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,409);
  put('paymentConfig/digital_test',{enabled:true});
  put('digitalContent/course_1',{kind:'course',productId:'1',product:{id:1,locked:true,price:'$19.900'}});
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,404);
  put('digitalContent/course_1',{kind:'course',productId:'1',product:{id:1,price:'Consultar'}});
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,422);
});
test('mantiene accesos manuales y no confía en compras ni roles del perfil',async()=>{
  put('users/'+user.uid,{role:'admin',purchasedCourses:[1],purchasedEbooks:['eb1']});
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  put('manualAccess/'+user.uid+'/products/course_1',{kind:'course',productId:'1',active:true});
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,409);
});
test('ebooks y cursos explícitamente gratuitos no requieren un pago',async()=>{
  const ebook={id:'eb1',title:'Gratis',paid:false,downloadLink:'https://private.test/free.pdf'};
  put('digitalContent/ebook_eb1',{kind:'ebook',productId:'eb1',product:ebook});
  put('privateCatalog/ebooks',{v:[ebook]});
  assert.equal((await call('/access',{kind:'ebook',productId:'eb1'})).status,200);
  assert.deepEqual((await call('/my-access')).data,[{kind:'ebook',productId:'eb1'}]);
});
test('contenido de otra cuenta sigue denegado aunque exista su permiso',async()=>{
  put('entitlements/other',{uid:'otra',kind:'course',productId:'1',active:true,live:false});
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
});
test('firma del webhook válida y firma adulterada',async()=>{
  assert.equal(await verifyWebhookSignature(await signedWebhook(payment()),env.MP_WEBHOOK_SECRET),true);
  assert.equal((await worker.fetch(await signedWebhook(payment(),'otra'),env)).status,401);
});
test('notificación aprobada acredita una vez en el esquema que usa la web y las reseñas',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment());
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
  const ent=docs.get(entPath()).data;
  assert.deepEqual({uid:ent.uid,kind:ent.kind,productId:ent.productId,active:ent.active,live:ent.live,paymentId:ent.paymentId},
    {uid:user.uid,kind:'course',productId:'1',active:true,live:false,paymentId:'9876'}); 
});
test('el contenido comprado está disponible solo tras verificar Mercado Pago',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment());
  await worker.fetch(await signedWebhook(payment()),env);
  const p=await call('/access',{kind:'course',productId:'1'});
  assert.equal(p.status,200);assert.equal(p.data.modules[0].lessons[0].videoUrl,'https://private.test/video');
  assert.deepEqual((await call('/my-access')).data,[{kind:'course',productId:'1'}]);
});
test('pendiente y rechazado no habilitan contenido',async()=>{
  for(const status of ['pending','in_process','rejected','cancelled']){
    put('orders/'+orderId,order());payments.set('9876',payment({status,date_last_updated:new Date(Date.parse('2026-11-13T15:00:00Z')+['pending','in_process','rejected','cancelled'].indexOf(status)*1000).toISOString()}));
    assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
    assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  }
});
test('devolución total o parcial revoca solo ese pago y un evento antiguo no reactiva',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment());await worker.fetch(await signedWebhook(payment()),env);
  payments.set('9876',payment({transaction_amount_refunded:100,date_last_updated:'2026-11-13T16:00:00Z'}));
  await worker.fetch(await signedWebhook(payment()),env);assert.equal(docs.get(entPath()).data.active,false);
  payments.set('9876',payment());await worker.fetch(await signedWebhook(payment()),env);
  assert.equal(docs.get(entPath()).data.active,false);
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
});
test('una devolución conserva un permiso manual o un segundo pago válido',async()=>{
  put('orders/'+orderId,order());put('manualAccess/'+user.uid+'/products/course_1',{kind:'course',productId:'1',active:true});
  put('entitlements/other',{uid:user.uid,kind:'course',productId:'1',active:true,live:false,paymentId:'9999'});
  payments.set('9876',payment({status:'refunded',transaction_amount_refunded:19900}));
  await worker.fetch(await signedWebhook(payment()),env);
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
  assert.equal(docs.get('manualAccess/'+user.uid+'/products/course_1').data.active,true);
  assert.equal(docs.get('entitlements/other').data.active,true);
});
test('un intento rechazado posterior no oculta otro pago aprobado de la misma compra',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment());await worker.fetch(await signedWebhook(payment()),env);
  payments.set('9877',payment({id:9877,status:'rejected',date_last_updated:'2026-11-13T16:00:00Z'}));
  await worker.fetch(await signedWebhook(payment({id:9877})),env);
  assert.equal(docs.get('orders/'+orderId).data.status,'approved');
});
test('un permiso de prueba no habilita contenido en producción',async()=>{
  put('entitlements/test',{uid:user.uid,kind:'course',productId:'1',active:true,live:false});
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
  env.MP_ENV='production';
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  assert.deepEqual((await call('/my-access')).data,[]);
});
test('valida monto, moneda, vendedor, ambiente, identidad y metadatos',()=>{
  for(const patch of [{transaction_amount:1},{currency_id:'USD'},{collector_id:99},{live_mode:true},{external_reference:'otra'},
    {metadata:{}},{date_last_updated:'no-fecha'}])assert.throws(()=>validatePayment(payment(patch),order(),env,'1234'));
});
test('reintenta conflictos de Firestore sin duplicar la acreditación y no confirma si falla el guardado',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment());conflictOnce=true;
  assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
  assert.equal(docs.get(entPath()).data.active,true);
  payments.set('9876',payment({status:'refunded',date_last_updated:'2026-11-13T16:00:00Z'}));failCommit=true;
  assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,503);
});
test('el retorno success no concede acceso; la verificación manual consulta el pago real',async()=>{
  put('orders/'+orderId,order());
  assert.equal((await call('/order?id='+orderId+'&status=approved')).data.status,'created');
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  payments.set('9876',payment());const verified=await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(verified.data.hasAccess,true);assert.equal(verified.data.order.status,'approved');
});
test('no muestra órdenes ajenas ni verifica un pago de otra referencia',async()=>{
  put('orders/'+orderId,order({uid:'otra'}));
  assert.equal((await call('/order?id='+orderId)).status,404);
  assert.equal((await call('/checkout',checkoutBody())).status,403);
  put('orders/'+orderId,order());payments.set('9876',payment({external_reference:'bb5c7ecf-27ae-4658-813b-2c3eac277b82'}));
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,403);
});
test('historial por usuaria separa ambientes y no expone email',async()=>{
  put('orders/'+orderId,order());put('orders/otra',order({id:'otra',uid:'otra'}));put('orders/live',order({id:'live',mode:'production'}));
  const list=await call('/orders');assert.equal(list.data.length,1);assert.equal(list.data[0].id,orderId);
  assert.equal(list.data[0].email,undefined);
});
test('administración exige la cuenta verificada y no confía en role del perfil',async()=>{
  put('users/'+user.uid,{role:'admin'});
  for(const path of ['/settings','/catalog?type=courses','/admin-orders','/diagnostics'])
    assert.equal((await call(path)).status,403);
  assert.equal((await call('/diagnostics',undefined,'admin-token')).data.firestore,true);
});
test('configuración permite habilitar compras y comprueba dependencias sin crear pagos',async()=>{
  assert.equal((await call('/settings',{enabled:false},'admin-token')).data.settings.enabled,false);
  assert.equal((await call('/quote',{kind:'course',productId:'1'})).status,409);
  assert.equal((await call('/settings',{enabled:true},'admin-token')).status,200);
  assert.equal((await call('/diagnostics',undefined,'admin-token')).data.apiVersion,'digital-v2');
  assert.equal(preferenceCount,0);
});
test('guardar catálogo publica solo fichas seguras y mantiene las clases privadas',async()=>{
  const product={id:2,title:'Nuevo',price:'$1.000',payLink:'https://secret.test/pay',downloadLink:'https://secret.test/pdf',
    modules:[{id:1,title:'Módulo',lessons:[{id:2,title:'Lección',videoUrl:'https://secret.test/video',desc:'Privado'}]}]};
  const r=await call('/catalog',{type:'courses',items:[product]},'admin-token');
  assert.equal(r.status,200);assert.equal(docs.has('digitalContent/course_1'),false);
  assert.equal(docs.get('privateCatalog/courses').data.v[0].downloadLink,product.downloadLink);
  const pub=docs.get('site/courses').data;
  assert.equal(pub.accessVersion,2);assert.equal(JSON.stringify(pub).includes('secret.test'),false);
  assert.equal((await call('/access',{kind:'course',productId:'2'})).status,403);
});
test('guardado concurrente o incompleto no publica un catálogo distinto del privado',async()=>{
  conflictOnce=true;
  assert.equal((await call('/catalog',{type:'courses',items:[{id:2,title:'Otra'}]},'admin-token')).status,409);
  assert.equal(docs.get('privateCatalog/courses').data.v[0].id,1);
  assert.equal(docs.get('site/courses').data.v[0].id,1);
  assert.equal((await call('/catalog',{type:'courses',items:[{id:1,_public:true}]},'admin-token')).status,400);
});
test('agenda conserva la ficha de atención y no acepta cobrar señas',async()=>{
  put('turnos/123',{nombre:'Clienta',fecha:'2026-11-20',atencion:'Antes'});
  assert.equal((await call('/admin-bookings',undefined,'admin-token')).data.items.length,1);
  assert.equal((await call('/booking-note',{orderId:'123',note:'Después'},'admin-token')).status,200);
  assert.equal(docs.get('turnos/123').data.atencion,'Después');
  assert.equal((await call('/availability',{date:'2026-11-20',services:['x']})).status,422);
  assert.equal((await call('/quote',{kind:'booking',productId:'x'})).status,400);
});
test('solo acepta dominios oficiales de checkout y el origen configurado',async()=>{
  for(const host of ['www.mercadopago.com.ar','sandbox.mercadopago.com.ar','www.mercadopago.com','sandbox.mercadopago.com'])
    assert.equal(new URL(checkoutUrl('https://'+host+'/checkout')).hostname,host);
  for(const u of ['https://mercadopago.com.evil.test','javascript:alert(1)','http://www.mercadopago.com.ar',
    'https://u:p@www.mercadopago.com.ar','https://www.mercadopago.com.ar:9999'])assert.throws(()=>checkoutUrl(u));
  assert.equal((await call('/health',undefined,'valid-token','https://ajeno.test')).status,403);
  assert.equal((await call('/health')).response.headers.get('Access-Control-Allow-Origin'),site);
});
test('sin configuración no cobra ni expone secretos; health distingue la versión nueva',async()=>{
  const h=await worker.fetch(request('/health'),{...env,MP_ACCESS_TOKEN:''}),data=await h.json();
  assert.equal(data.ready,false);assert.equal(data.apiVersion,'digital-v2');
  assert.equal(JSON.stringify(data).includes('fake-test-secret'),false);
  assert.equal((await worker.fetch(request('/checkout',checkoutBody()),{...env,MP_ACCESS_TOKEN:''})).status,503);
});

test('modo prueba rechaza credenciales de una cuenta real antes de crear el checkout',async()=>{
  accountIsTest=false;
  assert.equal((await call('/checkout',checkoutBody())).status,503);
  assert.equal(preferenceCount,0);assert.equal(docs.has('orders/'+orderId),false);
});
test('modo producción rechaza credenciales de una cuenta de prueba',async()=>{
  env.MP_ENV='production';put('paymentConfig/digital_production',{enabled:true});
  assert.equal((await call('/checkout',checkoutBody())).status,503);assert.equal(preferenceCount,0);
});
test('pago real correcto produce un permiso con live y paymentId utilizables por las reseñas',async()=>{
  env.MP_ENV='production';accountIsTest=false;put('paymentConfig/digital_production',{enabled:true});
  const result=await call('/checkout',checkoutBody());assert.equal(result.status,200);
  assert.equal(preferenceBody.payer.email,user.email);
  payments.set('9876',payment({live_mode:true}));
  assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
  assert.equal(docs.get(entPath()).data.live,true);assert.equal(docs.get(entPath()).data.paymentId,'9876');
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
});
test('rechaza identificadores faltantes y rutas ajenas',async()=>{
  for(const productId of [null,{},'../otro','a/b',''])
    assert.equal((await call('/quote',{kind:'course',productId})).status,400);
  assert.equal((await call('/quote',{kind:'course'})).status,400);
  assert.equal((await call('/catalog',{type:'courses',items:[null]},'admin-token')).status,400);
});
