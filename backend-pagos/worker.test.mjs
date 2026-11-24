import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const {default:worker,catalogPrice,encodeValue,decodeValue,validatePayment,verifyWebhookSignature,checkoutUrl,publicItem}=await import(
  'data:text/javascript;base64,'+Buffer.from(source+'\nexport {catalogPrice,encodeValue,decodeValue,validatePayment,verifyWebhookSignature,checkoutUrl,publicItem};').toString('base64'));
const base='https://mira-pagos.example.workers.dev',site='https://mirastudiotb.com';
const orderId='a25c7ecf-27ae-4658-813b-2c3eac277b82';
const user={uid:'alumna-1',email:'alumna@example.test'},admin={uid:'duena-1',email:'estudiosmira@gmail.com'};
let env,docs,version,payments,preferenceBody,accountVerified,conflictOnce,failCommit,unknownFetches,preferenceCount,accountIsTest,tokenSeq=0,mailRequests,mailMode,acceptedMail,mailFinalizeFailure,mailGate;
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

    if(url.hostname==='api.resend.com'&&url.pathname==='/emails'){
      const key=options.headers['Idempotency-Key'];mailRequests.push({key,body:structuredClone(body)});
      if(mailGate)await mailGate;
      if(mailMode==='503')return json({message:'temporary'},503);
      if(mailMode==='403')return json({message:'not verified'},403);
      if(!acceptedMail.has(key))acceptedMail.set(key,{id:'mail-'+(acceptedMail.size+1),body:structuredClone(body)});
      else if(JSON.stringify(acceptedMail.get(key).body)!==JSON.stringify(body))return json({message:'payload changed'},409);
      if(mailMode==='timeoutAfterAccept')throw Error('Timeout simulado');
      return json({id:acceptedMail.get(key).id});
    }

    if(url.hostname==='firestore.googleapis.com'){
      const suffix=decodeURIComponent(url.pathname).split('/documents')[1];
      if(suffix.endsWith(':runQuery')){
        const parent=suffix.slice(0,-9).replace(/^\//,''),q=body.structuredQuery;
        const collection=(parent?parent+'/':'')+q.from[0].collectionId+'/';
        let rows=[...docs.entries()].filter(([path])=>path.startsWith(collection)&&!path.slice(collection.length).includes('/'));
        if(q.where){const f=q.where.fieldFilter;rows=rows.filter(([,doc])=>f.op==='LESS_THAN_OR_EQUAL'?typeof doc.data[f.field.fieldPath]==='number'&&doc.data[f.field.fieldPath]<=decodeValue(f.value):doc.data[f.field.fieldPath]===decodeValue(f.value));}
        if(q.orderBy){const f=q.orderBy[0].field.fieldPath;rows.sort((a,b)=>(b[1].data[f]||0)-(a[1].data[f]||0));}
        return json(rows.slice(0,q.limit||500).map(([path,doc])=>({document:{name:name(path),fields:fields(doc.data),updateTime:doc.updateTime}})));
      }
      if(suffix===':commit'){
        if(mailFinalizeFailure&&body.writes.length===1&&body.writes[0].update?.name.includes('/saleEmailOutbox_')&&plain(body.writes[0].update.fields).status==='sent'){mailFinalizeFailure=false;return json({error:{status:'UNAVAILABLE'}},503);}
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
  mailRequests=[];mailMode='ok';acceptedMail=new Map();mailFinalizeFailure=false;mailGate=null;delete env.RESEND_API_KEY;delete env.SALE_EMAIL_FROM;
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
test('agenda conserva la ficha de atención anterior y exige habilitar las señas',async()=>{
  env.MP_ENV='production';
  put('turnos/123',{nombre:'Clienta',fecha:'2026-11-20',atencion:'Antes'});
  assert.equal((await call('/admin-bookings',undefined,'admin-token')).data.items.length,1);
  assert.equal((await call('/booking-note',{orderId:'123',note:'Después'},'admin-token')).status,200);
  assert.equal(docs.get('turnos/123').data.atencion,'Después');
  assert.equal((await call('/availability',{date:'2026-11-20',services:['x']})).status,409);
  assert.equal((await call('/quote',{kind:'booking',productId:'x'})).status,409);
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


test('un pago rechazado por validación indica todas las diferencias sin exponer identidades',()=>{
  assert.throws(()=>validatePayment(payment({
    transaction_amount:1,currency_id:'USD',live_mode:true,collector_id:9999,
    metadata:{mira_uid:'cuenta-privada-ajena',mira_order_id:orderId,product_type:'course',product_id:'1'}
  }),order(),env,'1234'),error=>{
    assert.equal(error.status,422);
    for(const label of ['importe','moneda','cuenta vendedora actual','asociación de la cuenta','live_mode=true; esperado=false'])
      assert.ok(error.message.includes(label),label);
    assert.equal(error.message.includes('cuenta-privada-ajena'),false);
    assert.equal(error.message.includes('fake-test-secret'),false);
    return true;
  });
});

test('una cuenta real no acredita una compra de prueba aunque el navegador diga que es de prueba',async()=>{
  accountIsTest=false;
  put('orders/'+orderId,order());payments.set('9876',payment({live_mode:true}));
  const result=await call('/verify-order',{orderId,paymentId:'9876',testAccount:true,seller:{testAccount:true,id:'1234'}});
  assert.equal(result.status,503);
  assert.equal(docs.has(entPath()),false);
  assert.equal(docs.get('orders/'+orderId).data.status,'created');
});
test('recupera el pago con saldo de cuenta de prueba y live_mode true sin crear otro checkout',async()=>{
  put('orders/'+orderId,order());
  payments.set('9876',payment({live_mode:true,payment_method_id:'account_money',payment_type_id:'account_money'}));
  const result=await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(result.status,200);assert.equal(result.data.order.status,'approved');assert.equal(result.data.hasAccess,true);
  assert.equal(preferenceCount,0);
  const entitlement=docs.get(entPath()).data;
  assert.equal(entitlement.active,true);assert.equal(entitlement.live,false);
  assert.equal(entitlement.providerLiveMode,true);assert.equal(entitlement.sellerTestAccount,true);
  assert.equal(docs.get('payments/9876').data.live,false);
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
  assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
  assert.equal([...docs.keys()].filter(k=>k.startsWith('entitlements/')).length,1);
  env.MP_ENV='production';
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,403);
  assert.deepEqual((await call('/my-access')).data,[]);
});
test('live_mode true sin evidencia de cuenta de prueba no flexibiliza la validación',()=>{
  const p=payment({live_mode:true});
  for(const seller of [undefined,{id:'1234',mode:'test',testAccount:false},{id:'9999',mode:'test',testAccount:true},
    {id:'1234',mode:'production',testAccount:true}])
    assert.throws(()=>validatePayment(p,order(),env,'1234',seller));
  assert.equal(validatePayment(p,order(),env,'1234',{id:'1234',mode:'test',testAccount:true}),true);
});
test('una cuenta de prueba verificada sigue requiriendo importe, moneda, vendedor e identidad correctos',async()=>{
  put('orders/'+orderId,order());
  for(const patch of [{transaction_amount:1},{currency_id:'USD'},{collector_id:9999},{metadata:{}},{live_mode:'true'}]){
    payments.set('9876',payment({live_mode:true,...patch}));
    assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,422);
    assert.equal(docs.has(entPath()),false);
  }
});
test('devolver un pago de cuenta de prueba con live_mode true revoca el acceso y no lo reactiva un evento viejo',async()=>{
  put('orders/'+orderId,order());payments.set('9876',payment({live_mode:true}));
  await call('/verify-order',{orderId,paymentId:'9876'});
  payments.set('9876',payment({live_mode:true,status:'refunded',transaction_amount_refunded:19900,date_last_updated:'2026-11-16T18:00:00Z'}));
  assert.equal((await worker.fetch(await signedWebhook(payment()),env)).status,200);
  assert.equal(docs.get(entPath()).data.active,false);assert.equal(docs.get(entPath()).data.live,false);
  payments.set('9876',payment({live_mode:true}));
  await worker.fetch(await signedWebhook(payment()),env);
  assert.equal(docs.get(entPath()).data.active,false);
});
test('producción no acepta un indicador de sandbox ni una cuenta vendedora de prueba',async()=>{
  env.MP_ENV='production';accountIsTest=false;
  put('orders/'+orderId,order({mode:'production'}));payments.set('9876',payment({live_mode:false}));
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,422);
  accountIsTest=true;env.MP_ACCESS_TOKEN='APP_USR_otra_cuenta_de_prueba';
  payments.set('9876',payment({live_mode:true}));
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,503);
  assert.equal(docs.has(entPath()),false);
});


function configureSaleEmails(mode='test',includeTests=true){
  env.MP_ENV=mode;accountIsTest=mode==='test';
  env.RESEND_API_KEY='re_fake_mail_key';
  env.SALE_EMAIL_FROM='Mira Estudio <ventas@avisos.example.test>';
  put('paymentConfig/saleEmails_'+mode,{enabled:true,includeTests});
}
const noticePath=()=> 'saleEmailOutbox_'+env.MP_ENV+'/sale_'+orderId;

test('un pago confirmado crea un solo aviso para la dueña, con precio e identidad del servidor',async()=>{
  configureSaleEmails();put('orders/'+orderId,order());payments.set('9876',payment());
  const verified=await call('/verify-order',{orderId,paymentId:'9876',to:'ajena@example.test'});
  assert.equal(verified.status,200);assert.equal(verified.data.hasAccess,true);
  assert.equal(mailRequests.length,1);
  const message=mailRequests[0];
  assert.deepEqual(message.body.to,[admin.email]);
  assert.match(message.body.text,/Curso de prueba/);assert.match(message.body.text,/19\.900/);
  assert.match(message.body.text,/alumna@example\.test/);assert.match(message.body.subject,/\[PRUEBA\]/);
  assert.equal(message.body.cc,undefined);assert.equal(message.body.bcc,undefined);
  assert.equal(docs.get(noticePath()).data.status,'sent');
  await worker.fetch(await signedWebhook(payment()),env);
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(mailRequests.length,1);
});
test('producción envía el aviso sin etiqueta de prueba y no mezcla las colas',async()=>{
  configureSaleEmails('production',false);
  put('orders/'+orderId,order({mode:'production'}));payments.set('9876',payment({live_mode:true}));
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,200);
  assert.equal(mailRequests.length,1);assert.doesNotMatch(mailRequests[0].body.subject,/\[PRUEBA\]/);
  assert.equal(docs.has('saleEmailOutbox_test/sale_'+orderId),false);
  const listed=await call('/sale-email/notices',undefined,'admin-token');
  assert.equal(listed.data.length,1);assert.equal(listed.data[0].status,'sent');
  assert.equal(JSON.stringify(listed.data).includes('re_fake_mail_key'),false);
  assert.equal(JSON.stringify(listed.data).includes('payload'),false);
});
test('no avisa pagos pendientes, rechazados ni pagos que no coinciden',async()=>{
  configureSaleEmails();
  for(const patch of [{status:'pending'},{status:'rejected'},{transaction_amount:1}]){
    put('orders/'+orderId,order());payments.set('9876',payment(patch));
    await call('/verify-order',{orderId,paymentId:'9876'});
  }
  assert.equal(mailRequests.length,0);
});
test('avisos apagados o compras de prueba excluidas no envían correos',async()=>{
  configureSaleEmails('test',false);put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(mailRequests.length,0);
  assert.equal(docs.has(noticePath()),false);
  put('paymentConfig/saleEmails_test',{enabled:true,includeTests:true});
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(mailRequests.length,0); // No manda avisos retroactivos al habilitar.
});
test('una falla de Resend deja el aviso pendiente y conserva el acceso de la compradora',async()=>{
  configureSaleEmails();mailMode='503';put('orders/'+orderId,order());payments.set('9876',payment());
  const result=await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(result.status,200);assert.equal(result.data.hasAccess,true);
  assert.equal(docs.get(noticePath()).data.status,'failed');
  assert.equal((await call('/access',{kind:'course',productId:'1'})).status,200);
  mailMode='ok';
  const retried=await call('/sale-email/retry',{id:'sale_'+orderId},'admin-token');
  assert.equal(retried.data.status,'sent');assert.equal(mailRequests.length,2);
  assert.equal(mailRequests[0].key,mailRequests[1].key);
  assert.deepEqual(mailRequests[0].body,mailRequests[1].body);
});
test('timeout después de aceptar no duplica el correo y conserva su contenido al reintentar',async()=>{
  configureSaleEmails();mailMode='timeoutAfterAccept';put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(acceptedMail.size,1);assert.equal(docs.get(noticePath()).data.status,'failed');
  mailMode='ok';env.SALE_EMAIL_FROM='Otro nombre <otro@avisos.example.test>';
  await call('/sale-email/retry',{id:'sale_'+orderId},'admin-token');
  assert.equal(acceptedMail.size,1);assert.deepEqual(mailRequests[0].body,mailRequests[1].body);
  assert.equal(docs.get(noticePath()).data.status,'sent');
});
test('un envío aceptado cuyo guardado falló se recupera sin repetir el correo',async()=>{
  configureSaleEmails();mailFinalizeFailure=true;put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(docs.get(noticePath()).data.status,'sending');assert.equal(acceptedMail.size,1);
  const pending=docs.get(noticePath()).data;
  put(noticePath(),{...pending,leaseUntil:Date.now()-1,nextAttemptAt:Date.now()-1});
  await call('/sale-email/retry',{id:'sale_'+orderId},'admin-token');
  assert.equal(acceptedMail.size,1);assert.equal(docs.get(noticePath()).data.status,'sent');
});
test('no reenvía automáticamente fuera de la ventana de idempotencia',async()=>{
  configureSaleEmails();mailMode='timeoutAfterAccept';put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  put(noticePath(),{...docs.get(noticePath()).data,firstAttemptAt:Date.now()-24*60*60*1000,nextAttemptAt:Date.now()-1});
  mailMode='ok';const result=await call('/sale-email/retry',{id:'sale_'+orderId},'admin-token');
  assert.equal(result.data.status,'review');assert.equal(mailRequests.length,1);
  await worker.scheduled({},env);
  assert.equal(mailRequests.length,1);
});
test('una devolución antes del reintento cancela el aviso pendiente',async()=>{
  configureSaleEmails();mailMode='503';put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  mailMode='ok';payments.set('9876',payment({status:'refunded',transaction_amount_refunded:19900,date_last_updated:'2026-11-16T20:00:00Z'}));
  await call('/verify-order',{orderId,paymentId:'9876'});
  const result=await call('/sale-email/retry',{id:'sale_'+orderId},'admin-token');
  assert.equal(result.data.status,'cancelled');assert.equal(mailRequests.length,1);
  assert.equal(docs.get(entPath()).data.active,false);
});
test('el evento programado recupera avisos vencidos y no procesa la cola de otro ambiente',async()=>{
  configureSaleEmails();mailMode='503';put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  const queued=docs.get(noticePath()).data;
  put(noticePath(),{...queued,nextAttemptAt:Date.now()-1});
  put('saleEmailOutbox_production/sale_'+orderId,{...queued,mode:'production',nextAttemptAt:Date.now()-1});
  mailMode='ok';await worker.scheduled({},env);
  assert.equal(docs.get(noticePath()).data.status,'sent');
  assert.equal(docs.get('saleEmailOutbox_production/sale_'+orderId).data.status,'failed');
  assert.equal(mailRequests.length,2);
});
test('los reintentos concurrentes usan una sola reserva de envío',async()=>{
  configureSaleEmails();mailMode='503';put('orders/'+orderId,order());payments.set('9876',payment());
  await call('/verify-order',{orderId,paymentId:'9876'});
  mailMode='ok';const before=mailRequests.length;
  await Promise.all([call('/sale-email/retry',{id:'sale_'+orderId},'admin-token'),call('/sale-email/retry',{id:'sale_'+orderId},'admin-token')]);
  assert.equal(mailRequests.length,before+1);
  assert.equal(docs.get(noticePath()).data.status,'sent');
});
test('solo la administradora verificada configura, prueba o reintenta avisos',async()=>{
  configureSaleEmails();
  for(const [path,body] of [['/sale-email/settings',undefined],['/sale-email/settings',{enabled:true,includeTests:true}],
    ['/sale-email/notices',undefined],['/sale-email/test',{requestId:orderId}],['/sale-email/retry',{}]])
    assert.equal((await call(path,body)).status,403);
  assert.equal(mailRequests.length,0);
  accountVerified=false;
  assert.equal((await call('/sale-email/test',{requestId:orderId},'admin-token')).status,403);
});
test('el correo de prueba usa un destino fijo y puede probarse sin habilitar ventas',async()=>{
  env.MP_ENV='production';env.RESEND_API_KEY='re_fake_mail_key';
  const a=await call('/sale-email/test',{requestId:orderId,to:'ajena@example.test',from:'otra@example.test'},'admin-token');
  const b=await call('/sale-email/test',{requestId:orderId},'admin-token');
  assert.equal(a.data.status,'sent');assert.equal(b.data.status,'sent');assert.equal(mailRequests.length,1);
  assert.deepEqual(mailRequests[0].body.to,[admin.email]);
  assert.match(mailRequests[0].body.from,/@resend\.dev>/);assert.match(mailRequests[0].body.text,/No representa una compra/);
  assert.equal(docs.has('orders/'+orderId),false);
  assert.equal((await call('/sale-email/settings',{enabled:true,includeTests:false},'admin-token')).status,422);
});
test('la configuración no revela la clave y exige remitente válido para activar ventas reales',async()=>{
  env.MP_ENV='production';
  assert.equal((await call('/sale-email/settings',{enabled:true,includeTests:false},'admin-token')).status,422);
  env.RESEND_API_KEY='re_fake_mail_key';env.SALE_EMAIL_FROM='Mira <ventas@avisos.example.test>';
  const result=await call('/sale-email/settings',{enabled:true,includeTests:false},'admin-token');
  assert.equal(result.data.enabled,true);assert.equal(JSON.stringify(result.data).includes('re_fake_mail_key'),false);
  env.SALE_EMAIL_FROM='Mira\r\nBcc: otra@example.test';
  assert.equal((await call('/sale-email/settings',undefined,'admin-token')).status,422);
});
test('la confirmación de pago responde aunque el envío de correo siga en segundo plano',async()=>{
  configureSaleEmails();put('orders/'+orderId,order());payments.set('9876',payment());
  let release;mailGate=new Promise(resolve=>{release=resolve;});
  const pending=[];
  try{
    const response=await worker.fetch(request('/verify-order',{orderId,paymentId:'9876'}),env,{waitUntil:task=>pending.push(task)});
    assert.equal(response.status,200);assert.equal(docs.get(entPath()).data.active,true);
    assert.equal(pending.length,1);
  }finally{release();}
  await Promise.all(pending);
  assert.equal(docs.get(noticePath()).data.status,'sent');
});

function bookingFixture(){
  const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  const day=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(date+'T00:00:00-03:00').getUTCDay()];
  put('site/services',{v:[{name:'Clásicas',price:'$60.000',dur:'2 h'}]});
  put('site/services_page',{v:{cats:[]}});
  put('site/slots',{v:[{day,times:['09:00','10:00','11:00','12:00']}]});
  put('paymentConfig/bookings_test',{enabled:true,percent:30,holdMinutes:20,serviceMinutes:{}});
  return {kind:'booking',services:['Clásicas'],date,time:'09:00',name:'Alumna',tel:'+541122334455',msg:'',
    requestId:orderId,acceptedAmountCents:1800000,acceptedTotalCents:6000000};
}
const bookingPayment=patch=>payment({transaction_amount:18000,metadata:{mira_uid:user.uid,mira_order_id:orderId,product_type:'booking',product_id:'appointment'},...patch});

test('un precio visible de 60.000 no queda gratis por un priceArs cero residual',async()=>{
  const p=docs.get('digitalContent/course_1').data.product;p.price='$60.000';p.priceArs=0;
  assert.equal(catalogPrice(p,'course'),6000000);
  const access=await call('/access',{kind:'course',productId:'1'});assert.equal(access.status,403);
  assert.deepEqual((await call('/my-access')).data,[]);
  assert.equal(publicItem(p,'courses').price,'$60.000');
  put('privateCatalog/courses',{v:[p]});const audit=await call('/access-audit',{email:user.email},'admin-token');
  assert.equal(audit.data.accounts[0].courses[0].reason,'denied');
});
test('auditoría de accesos es exclusiva de administración y distingue pruebas y autorizaciones',async()=>{
  put('entitlements/prueba',{uid:user.uid,kind:'course',productId:'1',active:true,live:false});
  env.MP_ENV='production';
  assert.equal((await call('/access-audit',{email:user.email})).status,403);
  let audit=await call('/access-audit',{email:user.email},'admin-token');
  assert.equal(audit.data.accounts[0].courses[0].reason,'denied');assert.equal(audit.data.accounts[0].courses[0].testPurchases,1);
  put('manualAccess/'+user.uid+'/products/course_1',{kind:'course',productId:'1',active:true});
  audit=await call('/access-audit',{email:user.email},'admin-token');assert.equal(audit.data.accounts[0].courses[0].reason,'manual');
});
test('señas deshabilitadas por defecto y configuración exclusiva de la dueña',async()=>{
  const b=bookingFixture();docs.delete('paymentConfig/bookings_test');
  assert.equal((await call('/quote',b)).status,409);
  assert.equal((await call('/booking-settings')).status,403);
  assert.equal((await call('/booking-settings',{enabled:true,percent:0,serviceMinutes:{}},'admin-token')).status,400);
  const configured=await call('/booking-settings',{enabled:true,percent:30,serviceMinutes:{Clásicas:120}},'admin-token');
  assert.equal(configured.status,200);assert.equal(configured.data.settings.percent,30);
  assert.equal(configured.data.services[0].durationMinutes,120);
});
test('seña 30%, total y saldo salen del catálogo; cambios posteriores no alteran una orden iniciada',async()=>{
  const b=bookingFixture();const q=await call('/quote',{...b,amountCents:1,totalCents:1});
  assert.equal(q.data.amountCents,1800000);assert.equal(q.data.totalCents,6000000);assert.equal(q.data.balanceCents,4200000);
  assert.equal((await call('/checkout',{...b,acceptedAmountCents:1})).status,409);
  assert.equal((await call('/checkout',b)).status,200);
  await call('/booking-settings',{enabled:true,percent:50,serviceMinutes:{Clásicas:120}},'admin-token');
  assert.equal(docs.get('orders/'+orderId).data.amountCents,1800000);
  assert.equal((await call('/quote',b)).data.amountCents,3000000);
  assert.equal(preferenceBody.items[0].unit_price,18000);
  assert.ok(preferenceBody.payment_methods.excluded_payment_types.some(x=>x.id==='ticket'));
});
test('checkout de seña retiene el horario sin crear turno ni acceso y reutiliza su referencia',async()=>{
  const b=bookingFixture();assert.equal((await call('/checkout',b)).status,200);assert.equal((await call('/checkout',b)).status,200);
  assert.equal(preferenceCount,1);assert.equal([...docs.keys()].some(x=>x.startsWith('turnos/')),false);
  assert.equal([...docs.keys()].some(x=>x.startsWith('entitlements/')),false);
  assert.equal((await call('/checkout',{...b,time:'11:00'})).status,409);
  const available=await call('/availability',b);assert.deepEqual(available.data.times,['11:00','12:00']);
});
test('dos reservas concurrentes o superpuestas no pueden tomar la misma franja',async()=>{
  const b=bookingFixture(),second=crypto.randomUUID();
  const results=await Promise.all([call('/checkout',b),call('/checkout',{...b,requestId:second,time:'10:00'})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(preferenceCount,1);
  const holds=docs.get('bookingDays/test_'+b.date).data.reservations;assert.equal(holds.length,1);
});
test('reserva aprobada crea el turno una vez sin otorgar un curso y conserva saldo y correo',async()=>{
  const b=bookingFixture();configureSaleEmails();await call('/checkout',b);payments.set('9876',bookingPayment());
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,200);
  assert.equal((await call('/verify-order',{orderId,paymentId:'9876'})).status,200);
  const turno=docs.get('turnos/'+orderId).data;assert.equal(turno.status,'confirmed');assert.equal(turno.balanceCents,4200000);
  assert.equal([...docs.keys()].filter(x=>x.startsWith('turnos/')).length,1);
  assert.equal([...docs.keys()].some(x=>x.startsWith('entitlements/')),false);
  assert.equal(mailRequests.length,1);assert.match(mailRequests[0].body.text,/Seña de turno/);assert.match(mailRequests[0].body.text,/42.000/);
});
test('pagos pendientes o rechazados no confirman una reserva',async()=>{
  const b=bookingFixture();await call('/checkout',b);payments.set('9876',bookingPayment({status:'pending'}));
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(docs.has('turnos/'+orderId),false);
  payments.set('9876',bookingPayment({status:'rejected',date_last_updated:'2026-11-14T15:00:00Z'}));
  await call('/verify-order',{orderId,paymentId:'9876'});assert.equal(docs.has('turnos/'+orderId),false);
});
test('un pago tardío de un horario tomado queda para revisión y no duplica el turno',async()=>{
  const b=bookingFixture();await call('/checkout',b);
  const key='bookingDays/test_'+b.date;const hold=docs.get(key).data.reservations[0];hold.expiresAt=Date.now()-1;
  const second=crypto.randomUUID();assert.equal((await call('/checkout',{...b,requestId:second})).status,200);
  payments.set('9876',bookingPayment());const verify=await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(verify.data.order.status,'review');assert.equal(docs.has('turnos/'+orderId),false);
  assert.equal(docs.get(key).data.reservations.some(r=>r.orderId===second),true);
});
test('la devolución de la seña libera la franja sin reactivarla por un evento viejo',async()=>{
  const b=bookingFixture();await call('/checkout',b);payments.set('9876',bookingPayment());await call('/verify-order',{orderId,paymentId:'9876'});
  payments.set('9876',bookingPayment({status:'refunded',transaction_amount_refunded:18000,date_last_updated:'2026-11-15T15:00:00Z'}));
  await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(docs.get('turnos/'+orderId).data.status,'cancelled');
  assert.ok((await call('/availability',b)).data.times.includes('09:00'));
  payments.set('9876',bookingPayment());await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal(docs.get('turnos/'+orderId).data.status,'cancelled');
});
test('solo la dueña cancela o registra atención y la cancelación no se reactiva',async()=>{
  const b=bookingFixture();await call('/checkout',b);payments.set('9876',bookingPayment());await call('/verify-order',{orderId,paymentId:'9876'});
  assert.equal((await call('/booking-status',{orderId,status:'done'})).status,403);
  assert.equal((await call('/booking-status',{orderId,status:'done'},'admin-token')).status,200);
  assert.equal((await call('/booking-status',{orderId,status:'cancelled'},'admin-token')).status,200);
  assert.equal((await call('/booking-status',{orderId,status:'confirmed'},'admin-token')).status,409);
  assert.ok((await call('/availability',b)).data.times.includes('09:00'));
});
test('agenda valida fechas, servicios, duraciones y horarios antes de cobrar',async()=>{
  const b=bookingFixture();
  for(const patch of [{services:['Inexistente']},{services:['Clásicas','Clásicas']},{date:'2026-99-99'},{time:'25:00'},{time:'08:00'}])
    assert.ok((await call('/quote',{...b,...patch})).status>=400);
  put('site/services',{v:[{name:'Clásicas',price:'Consultar',dur:'2 h'}]});assert.equal((await call('/quote',b)).status,422);
  put('site/services',{v:[{name:'Clásicas',price:'$60.000',dur:''}]});assert.equal((await call('/quote',b)).status,422);
  assert.equal(preferenceCount,0);
});
test('agenda cerrada explícitamente no recupera horarios de fábrica y respeta turnos anteriores',async()=>{
  const b=bookingFixture();put('turnos/anterior',{mode:'test',date:b.date,time:'09:00',durationMinutes:120,status:'confirmed'});
  assert.deepEqual((await call('/availability',b)).data.times,['11:00','12:00']);
  put('site/slots',{v:[]});assert.deepEqual((await call('/availability',b)).data.times,[]);
});

