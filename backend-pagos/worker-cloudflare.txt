// Mira Estudio — Checkout Pro, ejecutado en Cloudflare Workers (sin Firebase Functions).
// No incluir este archivo ni las credenciales privadas en pagina/.
const encoder = new TextEncoder();
const MP_API = 'https://api.mercadopago.com';
let oauthCache, oauthFlight, sellerCache;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const keyOf = (type, id) => `${type}_${id}`;
const validId = id => /^[A-Za-z0-9_-]{1,100}$/.test(String(id));
const validOrder = id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const isProduction = env => env.MP_ENV === 'production';

function amountCents(value) {
  // El importe debe ser numérico: nunca se interpreta el texto de presentación ($9.990, etc.).
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10000000)
    fail(422, 'El producto todavía no tiene un importe de cobro válido en pesos.');
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 0.00001) fail(422, 'El importe admite hasta dos decimales.');
  return cents;
}

function encodeValue(v) {
  if (v === null) return {nullValue: null};
  if (Array.isArray(v)) return {arrayValue: {values: v.map(encodeValue)}};
  if (typeof v === 'object') return {mapValue: {fields: encodeFields(v)}};
  if (typeof v === 'boolean') return {booleanValue: v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  return {stringValue: String(v)};
}
const encodeFields = o => Object.fromEntries(Object.entries(o).map(([k,v]) => [k,encodeValue(v)]));
function decodeValue(v) {
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  return v.stringValue ?? v.timestampValue;
}
const decodeFields = f => Object.fromEntries(Object.entries(f).map(([k,v]) => [k,decodeValue(v)]));
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
const b64json = obj => b64url(encoder.encode(JSON.stringify(obj)));

async function jsonFetch(url, options = {}) {
  let response;
  try { response = await fetch(url, {...options, signal: AbortSignal.timeout(8000)}); }
  catch { fail(503, 'El servicio de pagos no respondió. Intentá nuevamente en unos momentos.'); }
  const body = await response.json().catch(() => ({}));
  return {response, body};
}

async function googleToken(env) {
  if (oauthCache?.email === env.FIREBASE_CLIENT_EMAIL && oauthCache.expires > Date.now()) return oauthCache.token;
  if (oauthFlight) return oauthFlight;
  oauthFlight = (async () => {
    const now = Math.floor(Date.now()/1000);
    const content = `${b64json({alg:'RS256',typ:'JWT'})}.${b64json({
      iss:env.FIREBASE_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/datastore',
      aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600
    })}`;
    const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
    const der = Uint8Array.from(atob(pem), c=>c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(content));
    const {response,body} = await jsonFetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${content}.${b64url(signature)}`})
    });
    if (!response.ok || !body.access_token) fail(503,'No se pudo conectar con la base de datos.');
    oauthCache = {email:env.FIREBASE_CLIENT_EMAIL,token:body.access_token,expires:Date.now()+3300000};
    return body.access_token;
  })();
  try { return await oauthFlight; } finally { oauthFlight = null; }
}

function dbBase(env) { return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`; }
async function dbRequest(env, suffix, options = {}) {
  const token = await googleToken(env);
  const r = await jsonFetch(`https://firestore.googleapis.com/v1/${dbBase(env)}${suffix}`,{
    ...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}
  });
  return r;
}
async function dbGet(env, path) {
  const {response,body} = await dbRequest(env,`/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) fail(503,'No se pudo consultar la compra.');
  return {data:decodeFields(body.fields || {}),updateTime:body.updateTime};
}
function writeDoc(env,path,data,previous) {
  const write = {update:{name:`${dbBase(env)}/${path}`,fields:encodeFields(data)}};
  if (previous === null) write.currentDocument = {exists:false};
  else if (previous) write.currentDocument = {updateTime:previous.updateTime};
  return write;
}
async function commit(env,writes) {
  const r = await dbRequest(env,':commit',{method:'POST',body:JSON.stringify({writes})});
  return r;
}
async function saveDoc(env,path,data) {
  const r = await commit(env,[writeDoc(env,path,data)]);
  if (!r.response.ok) fail(503,'No se pudo guardar la compra.');
}

async function signedUser(request,env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token || token.length > 6000) fail(401,'Iniciá sesión para comprar.');
  const {response,body} = await jsonFetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})
  });
  const u = body.users?.[0];
  if (!response.ok || !u || u.disabled) fail(401,'Tu sesión venció. Volvé a iniciar sesión.');
  if (!u.emailVerified) fail(403,'Verificá tu email antes de comprar.');
  return {uid:u.localId,email:u.email};
}
async function mpRequest(env,path,options = {}) {
  const result = await jsonFetch(MP_API+path,{
    ...options,headers:{Authorization:`Bearer ${env.MP_ACCESS_TOKEN}`,'Content-Type':'application/json',...options.headers}
  });
  if (!result.response.ok) fail(503,'No se pudo consultar Mercado Pago. Intentá nuevamente.');
  return result.body;
}
async function verifiedSeller(env) {
  if (sellerCache?.token === env.MP_ACCESS_TOKEN && sellerCache.mode === env.MP_ENV) return sellerCache;
  const account = await mpRequest(env,'/users/me');
  if (!account.id) fail(503,'La cuenta de cobro no está configurada.');
  const testAccount = Array.isArray(account.tags) && account.tags.includes('test_user');
  if (!isProduction(env) && !testAccount)
    fail(503,'El Access Token no corresponde a una cuenta vendedora de prueba. Copiá las credenciales de prueba de tu aplicación Checkout Pro.');
  if (isProduction(env) && (testAccount || /^TEST-/i.test(env.MP_ACCESS_TOKEN)))
    fail(503,'Para cobrar en producción necesitás las credenciales de tu cuenta real de Mercado Pago.');
  if (account.site_id && account.site_id !== 'MLA') fail(503,'La cuenta vendedora debe ser de Argentina.');
  sellerCache = {token:env.MP_ACCESS_TOKEN,mode:env.MP_ENV,id:String(account.id),testAccount};
  return sellerCache;
}
async function sellerId(env) { return (await verifiedSeller(env)).id; }

function checkoutUrl(value) {
  let u; try { u = new URL(value); } catch { fail(503,'Mercado Pago no devolvió un enlace de pago válido.'); }
  const hosts = ['mercadopago.com.ar','www.mercadopago.com.ar','sandbox.mercadopago.com.ar',
    'mercadopago.com','www.mercadopago.com','sandbox.mercadopago.com'];
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !hosts.includes(u.hostname))
    fail(503,'Mercado Pago no devolvió un enlace de pago válido.');
  return u.href;
}

// Contrato de la web publicada: privateCatalog, digitalContent y permisos por pago.
const ADMIN_EMAIL = 'estudiosmira@gmail.com';
const API_VERSION = 'digital-v2';
const adminUser = user => user.email === ADMIN_EMAIL;
const checkProduct = (kind,id) => {
  if (!['course','ebook'].includes(kind) || !['string','number'].includes(typeof id) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(id)))
    fail(400,'Producto no válido.');
};
async function requireAdmin(request,env) {
  const user = await signedUser(request,env);
  if (!adminUser(user)) fail(403,'Acceso exclusivo de administración.');
  return user;
}
async function queryDocs(env,collection,field,value,limit=500,parent='') {
  const query = {from:[{collectionId:collection}],limit};
  if (field) query.where = {fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encodeValue(value)}};
  const r = await dbRequest(env,parent+':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:query})});
  if (!r.response.ok || !Array.isArray(r.body)) fail(503,'No se pudieron consultar los datos.');
  return r.body.filter(x=>x.document).map(x=>({
    id:x.document.name.split('/').pop(),data:decodeFields(x.document.fields || {}),updateTime:x.document.updateTime
  }));
}
function catalogPrice(product,kind) {
  if (kind === 'ebook' && product.paid === false) return 0;
  // Un precio visible positivo no se vuelve gratuito por un cero numérico residual.
  const visible=String(product.price||'').trim();
  if(product.priceArs===0&&visible&&!/^gratis$/i.test(visible)){
    const paid=visible.match(/^(?:(?:ARS|\$)\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+))(?:,(\d{1,2}))?\s*(?:ARS)?$/i);
    if(!paid)fail(422,'Revisá el precio del producto: sus valores guardados no coinciden.');
    return amountCents(Number(paid[1].replace(/\./g,''))+Number((paid[2]||'').padEnd(2,'0'))/100);
  }
  if(product.priceArs===0)return 0;
  if (product.priceArs !== undefined && product.priceArs !== null && product.priceArs !== '')
    return amountCents(product.priceArs);
  // Compatibilidad con precios argentinos ya guardados por la administradora.
  // Solo el catálogo privado es autoridad; nunca se lee un precio del pedido del navegador.
  const text = String(product.price || '').trim();
  if (/^gratis$/i.test(text)) return 0;
  const match = text.match(/^(?:(?:ARS|\$)\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+))(?:,(\d{1,2}))?\s*(?:ARS)?$/i);
  if (!match) fail(422,'Completá el precio en pesos del producto desde el panel del estudio.');
  return amountCents(Number(match[1].replace(/\./g,'')) + Number((match[2] || '').padEnd(2,'0'))/100);
}
async function productDoc(env,kind,id) {
  checkProduct(kind,id);
  const doc = await dbGet(env,'digitalContent/'+keyOf(kind,id));
  if (!doc || doc.data.kind !== kind || String(doc.data.productId) !== String(id) ||
      !doc.data.product || doc.data.product.locked === true)
    fail(404,'Este producto no está disponible.');
  return doc.data.product;
}
async function myRights(env,user) {
  const [manual,paid] = await Promise.all([
    queryDocs(env,'products',null,null,500,'/manualAccess/'+user.uid),
    queryDocs(env,'entitlements','uid',user.uid)
  ]);
  const rights = new Map();
  for (const item of [...manual.map(x=>({...x.data,manual:true})),...paid.map(x=>x.data)]) {
    if (item.active !== true || (!item.manual && item.live !== isProduction(env))) continue;
    if (!['course','ebook'].includes(item.kind) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(item.productId))) continue;
    rights.set(keyOf(item.kind,item.productId),{kind:item.kind,productId:String(item.productId)});
  }
  return [...rights.values()];
}
async function hasAccess(env,user,kind,id) {
  if (adminUser(user)) return true;
  const rights = await myRights(env,user);
  return rights.some(x=>x.kind === kind && x.productId === String(id));
}
async function accessProduct(request,env) {
  const user = await signedUser(request,env),body = await readJson(request);
  checkProduct(body.kind,body.productId);
  const product = await productDoc(env,body.kind,String(body.productId));
  let free = false;
  try { free = catalogPrice(product,body.kind) === 0; } catch {}
  if (!free && !await hasAccess(env,user,body.kind,String(body.productId)))
    fail(403,'Este producto requiere una compra confirmada o autorización del estudio.');
  return product;
}
const defaultSettings = () => ({
  enabled:false,deposit:{mode:'percent',fixedCents:1000000,percent:30,holdMinutes:20},serviceMinutes:{}
});
const settingsPath = env => 'paymentConfig/digital_'+env.MP_ENV;
async function settings(env) {
  const data = (await dbGet(env,settingsPath(env)))?.data;
  return {...defaultSettings(),enabled:data?.enabled === true};
}
async function quoteFor(env,user,kind,id) {
  checkProduct(kind,id);
  if (!(await settings(env)).enabled) fail(409,'Las compras todavía no están habilitadas. Contactá al estudio.');
  const catalog = await dbGet(env,'site/'+(kind === 'course' ? 'courses':'ebooks'));
  if (catalog?.data.accessVersion !== 2) fail(422,'Primero protegé el catálogo desde Alumnas → Accesos.');
  const product = await productDoc(env,kind,String(id));
  const cents = catalogPrice(product,kind);
  if (!cents) fail(409,'Este producto es gratuito. Ingresá desde tu portal.');
  if (await hasAccess(env,user,kind,String(id))) fail(409,'Ya tenés acceso a este producto. Ingresá desde tu portal.');
  return {kind,productId:String(id),title:String(product.title || 'Mira Estudio').slice(0,200),
    amountCents:cents,totalCents:cents,balanceCents:0,currency:'ARS'};
}
function publicOrder(order,admin=false) {
  const kind = order.kind || order.productType;
  const result = {id:order.id,kind,productType:kind,productId:order.productId,title:order.title,
    amountCents:order.amountCents,totalCents:order.totalCents || order.amountCents,balanceCents:order.balanceCents || 0,
    currency:order.currency,status:order.status,createdAt:order.createdAt,mode:order.mode,live:order.mode === 'production',
    expiresAt:order.expiresAt || 0};
  if(kind==='booking'){result.booking=order.booking;result.depositPercent=order.depositPercent;result.bookingStatus=order.bookingStatus||'pending';result.bookingCancelledAt=order.bookingCancelledAt||0;}
  if (order.checkoutUrl && ['created','pending'].includes(order.status) && order.expiresAt > Date.now())
    result.checkoutUrl = checkoutUrl(order.checkoutUrl);
  if (admin) { result.email = order.email;result.issue = order.issue || ''; }
  return result;
}
async function readJson(request,maxBytes=12000) {
  if (Number(request.headers.get('content-length')) > maxBytes) fail(413,'Solicitud demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) fail(400,'La solicitud no es válida.');
  const parts = [];let size = 0;
  for (;;) {
    const {value,done} = await reader.read();if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel();fail(413,'Solicitud demasiado grande.'); }
    parts.push(value);
  }
  const all = new Uint8Array(size);let offset = 0;
  for (const part of parts) { all.set(part,offset);offset += part.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(all));
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400,'La solicitud no es válida.');
    return data;
  } catch { fail(400,'La solicitud no es válida.'); }
}
async function createCheckout(request,env) {
  const user = await signedUser(request,env);
  const body = await readJson(request),kind = body.kind || body.productType,id = kind==='booking'?'appointment':String(body.productId),requestId = body.requestId;
  if(kind!=='booking')checkProduct(kind,body.productId);
  if (!validOrder(requestId || '')) fail(400,'Referencia de compra no válida.');
  const old = await dbGet(env,'orders/'+requestId);
  if (old) {
    if (old.data.uid !== user.uid || (old.data.kind || old.data.productType) !== kind || old.data.productId !== id)
      fail(403,'La compra pertenece a otra cuenta o producto.');
    if(kind==='booking'&&!sameBooking(old.data.booking,{...body,name:String(body.name||'').trim(),tel:String(body.tel||'').trim(),msg:String(body.msg||'').trim()}))fail(409,'La selección cambió. Elegí nuevamente el turno.');
    if (old.data.mode !== env.MP_ENV) fail(409,'La referencia pertenece a otro ambiente. Elegí nuevamente el producto.');
    if (old.data.status === 'approved') fail(409,'Esta compra ya está confirmada. Ingresá desde tu portal.');
    if (old.data.checkoutUrl && ['created','pending'].includes(old.data.status) && old.data.expiresAt > Date.now())
      return {id:requestId,orderId:requestId,checkoutUrl:checkoutUrl(old.data.checkoutUrl)};
    fail(409,'Esta referencia ya se utilizó. Revisá Mis compras y elegí nuevamente el producto si el pago no se inició.');
  }
  const q=kind==='booking'?await bookingQuote(env,user,body):await quoteFor(env,user,kind,id);
  if(kind==='booking'){
    for(const [field,max] of [['name',100],['tel',40],['msg',1000]]){
      const value=body[field]===undefined?'':body[field];
      if(typeof value!=='string'||value.trim().length>max||(field!=='msg'&&!value.trim()))fail(400,'Completá nombre y teléfono para reservar.');
      q.booking[field]=value.trim();
    }
    delete q.times;delete q.durationMinutes;
  }
  if (body.acceptedAmountCents !== q.amountCents || body.acceptedTotalCents !== q.totalCents)
    fail(409,'El precio cambió. Volvé a abrir esta compra para confirmar el importe actual.');
  const collector = await sellerId(env),now = Date.now();
  const order = {...q,id:requestId,uid:user.uid,email:user.email,productType:kind,status:'created',
    createdAt:now,expiresAt:now+(kind==='booking'?q.holdMinutes:30)*60*1000,mode:env.MP_ENV,live:isProduction(env),collectorId:collector};
  if(kind==='booking')await reserveBooking(env,order);
  else await reserveDigitalCheckout(env,order);
  const returnUrl = new URL('/pagos.html',env.SITE_ORIGIN);returnUrl.searchParams.set('order',requestId);
  let preference,target;
  try {
    preference = await mpRequest(env,'/checkout/preferences',{method:'POST',body:JSON.stringify({
      items:[{id:keyOf(kind,id),title:order.title,quantity:1,currency_id:'ARS',unit_price:q.amountCents/100}],
      payer:isProduction(env) ? {email:user.email} : undefined,
      external_reference:requestId,metadata:{mira_order_id:requestId,mira_uid:user.uid,product_type:kind,product_id:id},
      back_urls:{success:returnUrl.href,pending:returnUrl.href,failure:returnUrl.href},auto_return:'approved',
      notification_url:new URL('/webhooks/mercadopago',env.WORKER_ORIGIN).href,
      expires:true,expiration_date_from:new Date(now).toISOString(),expiration_date_to:new Date(order.expiresAt).toISOString(),
      ...(kind==='booking'?{payment_methods:{excluded_payment_types:[{id:'ticket'},{id:'atm'}]}}:{}),
      statement_descriptor:'MIRA ESTUDIO'
    })});
    target=checkoutUrl(preference.init_point);
  } catch (error) {
    try{await abandonCheckout(env,order);}catch(cleanupError){console.error('mira-pagos: no se pudo liberar el checkout',cleanupError.name);}
    throw error;
  }
  const patch = writeDoc(env,'orders/'+requestId,{preferenceId:preference.id,checkoutUrl:target});
  patch.updateMask = {fieldPaths:['preferenceId','checkoutUrl']};
  if (!(await commit(env,[patch])).response.ok){
    try{await abandonCheckout(env,order);}catch(cleanupError){console.error('mira-pagos: no se pudo liberar el checkout',cleanupError.name);}
    fail(503,'No se pudo preparar el enlace. Revisá Mis compras antes de volver a intentar.');
  }
  return {id:requestId,orderId:requestId,checkoutUrl:target};
}
const purchaseLockPath=order=>'purchaseLocks/'+order.mode+'_'+order.uid+'_'+keyOf(order.kind,order.productId);
const bookingLimitPath=order=>'bookingLimits/'+order.mode+'_'+order.uid;
const writeConflict=r=>[409,412].includes(r.response.status)||['ABORTED','ALREADY_EXISTS','FAILED_PRECONDITION'].includes(r.body.error?.status);
async function reserveDigitalCheckout(env,order){
  const path=purchaseLockPath(order);
  for(let attempt=0;attempt<4;attempt++){
    const lock=await dbGet(env,path);
    if(lock){
      const before=await dbGet(env,'orders/'+lock.data.orderId);
      if(before&&(['pending','in_process','authorized','in_mediation'].includes(before.data.status)||
        (before.data.status==='created'&&before.data.expiresAt>Date.now())))
        fail(409,'Ya tenés una compra en curso. Revisá Mis compras antes de pagar de nuevo.');
      // Cubre una aprobación que llegue entre la cotización y la reserva de la nueva orden.
      if(before?.data.status==='approved'&&await hasAccess(env,{uid:order.uid,email:order.email},order.kind,order.productId))
        fail(409,'Ya tenés acceso a este producto. Ingresá desde tu portal.');
    }
    const result=await commit(env,[writeDoc(env,'orders/'+order.id,order,null),writeDoc(env,path,{orderId:order.id},lock)]);
    if(result.response.ok)return;
    if(!writeConflict(result))fail(503,'No se pudo preparar la compra. Volvé a intentar.');
  }
  fail(409,'La compra ya se está preparando. Revisá Mis compras.');
}
async function abandonCheckout(env,order){
  // Solo se usa al fallar antes de entregar el enlace al navegador.
  for(let attempt=0;attempt<4;attempt++){
    const doc=await dbGet(env,'orders/'+order.id);
    if(!doc||doc.data.status!=='created'||doc.data.checkoutUrl)return;
    const writes=[writeDoc(env,'orders/'+order.id,{...doc.data,status:'error',issue:'No se pudo preparar el checkout.'},doc)];
    if(order.kind==='booking'){
      const path=bookingDayPath(env,order.booking.date),limitPath=bookingLimitPath(order);
      const [day,limit]=await Promise.all([dbGet(env,path),dbGet(env,limitPath)]);
      if(day)writes.push(writeDoc(env,path,{reservations:activeReservations(day).filter(x=>x.orderId!==order.id)},day));
      if(limit?.data.holdId===order.id)writes.push(writeDoc(env,limitPath,{recent:limit.data.recent||[]},limit));
    }
    const result=await commit(env,writes);
    if(result.response.ok)return;
    if(!writeConflict(result))throw Error('No se pudo guardar la liberación.');
  }
}
async function verifyWebhookSignature(request,secret) {
  const url = new URL(request.url);
  const id = url.searchParams.get('data.id');
  const rid = request.headers.get('x-request-id');
  const signature = request.headers.get('x-signature') || '';
  const ts = signature.match(/(?:^|,)\s*ts=(\d+)/)?.[1];
  const hashes = [...signature.matchAll(/(?:^|,)\s*v1=([a-f\d]{64})/gi)].map(m=>m[1]);
  if (!id || !rid || !ts || !hashes.length || !secret) return false;
  // No se descartan reintentos tardíos: la idempotencia y fecha del recurso evitan regresiones.
  const manifest = `id:${id.toLowerCase()};request-id:${rid};ts:${ts};`;
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for (const hash of hashes) {
    const bytes = Uint8Array.from(hash.match(/../g),h=>parseInt(h,16));
    if (await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(manifest))) return true;
  }
  return false;
}

// PAYMENT_VALIDATION_DIAGNOSTICS: no cambia las condiciones de acreditación.
function validatePayment(payment,order,env,collector,seller) {
  const expectedLive = isProduction(env);
  // La identidad del vendedor se consulta a Mercado Pago, nunca al navegador.
  // Algunas compras entre cuentas de prueba llegan con live_mode=true.
  const verifiedTestAccount = env.MP_ENV === 'test' && order.mode === 'test' &&
    seller?.testAccount === true && seller.mode === 'test' && seller.id === String(collector);
  const environmentMatches = payment.live_mode === expectedLive ||
    (verifiedTestAccount && payment.live_mode === true);
  const flag = typeof payment.live_mode === 'boolean' ? String(payment.live_mode) : 'ausente o inválido';
  const checks = [
    ['referencia de compra',String(payment.external_reference) === order.id],
    ['cuenta vendedora actual',String(payment.collector_id) === String(collector)],
    ['cuenta vendedora guardada en la orden',String(payment.collector_id) === order.collectorId],
    ['moneda',payment.currency_id === order.currency],
    ['importe',Number.isFinite(Number(payment.transaction_amount)) && Math.round(Number(payment.transaction_amount)*100) === order.amountCents],
    ['ambiente de Mercado Pago (live_mode=' + flag + '; esperado=' + expectedLive + ')',environmentMatches],
    ['ambiente guardado en la orden',order.mode === env.MP_ENV],
    ['asociación de la cuenta',payment.metadata?.mira_uid === order.uid],
    ['asociación de la orden',payment.metadata?.mira_order_id === order.id],
    ['tipo de producto',payment.metadata?.product_type === order.productType],
    ['identificador del producto',String(payment.metadata?.product_id) === order.productId],
    ['fecha del pago',Number.isFinite(Date.parse(payment.date_last_updated))]
  ];
  const differences = checks.filter(([,valid])=>!valid).map(([label])=>label);
  if (differences.length)
    fail(422,'El pago no coincide con esta compra. Diferencias: ' + differences.join('; ') + '.');
  return payment.status === 'approved' && Number(payment.transaction_amount_refunded || 0) === 0;
}


// Avisos de ventas: cola persistente, envío independiente del acceso y destino fijo.
const SALE_EMAIL_WINDOW = 23*60*60*1000;
const SALE_EMAIL_LEASE = 2*60*1000;
const saleEmailCollection = env => 'saleEmailOutbox_'+env.MP_ENV;
const saleEmailSettingsPath = env => 'paymentConfig/saleEmails_'+env.MP_ENV;
function saleEmailSender(env) {
  const from = String(env.SALE_EMAIL_FROM || 'Mira Estudio <onboarding@resend.dev>').trim();
  const match = from.match(/^(?:[^<>\r\n]{1,80}<([^<>\r\n]+)>|([^<>\r\n]+))$/);
  const address = (match?.[1] || match?.[2] || '').trim();
  if (from.length>200 || !/^[^\s@<>,;:]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(address))
    fail(422,'El remitente de los avisos no tiene un formato válido.');
  return {from,address,testDomain:address.toLowerCase().endsWith('@resend.dev')};
}
async function saleEmailSettings(env) {
  const doc = await dbGet(env,saleEmailSettingsPath(env));
  return {enabled:doc?.data.enabled === true,includeTests:doc?.data.includeTests === true};
}
async function saleEmailSettingsApi(request,env) {
  await requireAdmin(request,env);
  const sender = saleEmailSender(env);
  if (request.method === 'POST') {
    const body = await readJson(request);
    if (typeof body.enabled !== 'boolean' || typeof body.includeTests !== 'boolean')
      fail(400,'La configuración de avisos no es válida.');
    if (body.enabled && !env.RESEND_API_KEY) fail(422,'Primero cargá RESEND_API_KEY como secreto en Cloudflare.');
    if (body.enabled && isProduction(env) && sender.testDomain)
      fail(422,'Para avisos de ventas reales, verificá tu dominio en Resend y completá SALE_EMAIL_FROM.');
    await saveDoc(env,saleEmailSettingsPath(env),{enabled:body.enabled,includeTests:body.includeTests,updatedAt:Date.now()});
  }
  return {...await saleEmailSettings(env),configured:!!env.RESEND_API_KEY,from:sender.from,recipient:ADMIN_EMAIL,
    testDomain:sender.testDomain,environment:env.MP_ENV};
}
function saleMailPayload(env,order,paymentId) {
  const clean = value => String(value || '').replace(/[\r\n]+/g,' ').trim();
  const title = clean(order.title).slice(0,180);
  const test = !isProduction(env);
  const amount = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(order.amountCents/100);
  return {from:saleEmailSender(env).from,to:[ADMIN_EMAIL],
    subject:(test?'[PRUEBA] ':'')+'Nueva compra: '+title,
    text:[
      test?'COMPRA DE PRUEBA — no representa una venta real.':'Se confirmó una nueva compra en Mira Estudio.',
      '', 'Producto: '+title,'Tipo: '+(order.productType==='course'?'Curso':order.productType==='booking'?'Seña de turno':'Ebook'),
      'Importe: '+amount,'Email de la compradora: '+clean(order.email),
      'Orden: '+order.id,'Pago de Mercado Pago: '+paymentId,
      '', order.productType==='booking'?'Turno confirmado: '+order.booking.date+' a las '+order.booking.time+'. Saldo en el estudio: '+new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(order.balanceCents/100):'El acceso al producto quedó habilitado al confirmarse el pago.',
      'Panel de ventas: '+new URL('/admin',env.SITE_ORIGIN).href
    ].join('\n')};
}
async function planSaleEmail(env,order,paymentId) {
  if (!env.RESEND_API_KEY) return null;
  const settings = await saleEmailSettings(env);
  if (!settings.enabled || (!isProduction(env) && !settings.includeTests)) return null;
  const sender = saleEmailSender(env);
  if (isProduction(env) && sender.testDomain) return null;
  const now = Date.now(),id = 'sale_'+order.id;
  return {id,data:{category:'sale',orderId:order.id,paymentId:String(paymentId),mode:env.MP_ENV,
    title:order.title,amountCents:order.amountCents,email:order.email,createdAt:now,
    status:'queued',attempts:0,firstAttemptAt:0,nextAttemptAt:now,payload:saleMailPayload(env,order,paymentId)}};
}
function publicSaleEmail(id,data) {
  return {id,category:data.category,orderId:data.orderId || '',title:data.title || '',amountCents:data.amountCents || 0,
    status:data.status,attempts:data.attempts || 0,createdAt:data.createdAt,acceptedAt:data.acceptedAt || 0,
    errorCode:data.errorCode || '',mode:data.mode};
}
async function updateSaleEmail(env,id,previous,changes,lease) {
  const path = saleEmailCollection(env)+'/'+id;
  const current = lease ? await dbGet(env,path) : previous;
  if (!current || (lease && current.data.lease !== lease)) return null;
  const data = {...current.data,...changes};
  if (['sent','review','cancelled'].includes(data.status)) delete data.nextAttemptAt;
  delete data.lease;delete data.leaseUntil;
  const r = await commit(env,[writeDoc(env,path,data,current)]);
  if (!r.response.ok) return null;
  return data;
}
async function sendSaleEmail(env,id,force=false) {
  if (!/^(?:sale|test)_[0-9a-f-]{36}$/i.test(id)) fail(400,'Aviso no válido.');
  const path = saleEmailCollection(env)+'/'+id,doc = await dbGet(env,path);
  if (!doc) fail(404,'No encontramos ese aviso.');
  const data = doc.data,now = Date.now();
  if (data.mode !== env.MP_ENV) fail(409,'El aviso pertenece a otro ambiente.');
  if (['sent','review','cancelled'].includes(data.status)) return publicSaleEmail(id,data);
  if (data.leaseUntil>now || (!force && data.nextAttemptAt>now)) return publicSaleEmail(id,data);
  if (!env.RESEND_API_KEY) return publicSaleEmail(id,data);
  if (!data.payload || data.payload.to?.length !== 1 || data.payload.to[0] !== ADMIN_EMAIL)
    fail(422,'El destino del aviso no es válido.');
  if (data.category === 'sale') {
    const settings = await saleEmailSettings(env);
    if (!settings.enabled || (!isProduction(env) && !settings.includeTests)) {
      const paused = await updateSaleEmail(env,id,doc,{nextAttemptAt:now+60*60*1000});
      return publicSaleEmail(id,paused || data);
    }
    if (isProduction(env) && /@resend\.dev>?$/i.test(data.payload.from))
      fail(422,'El aviso de venta necesita un remitente del dominio verificado.');
    const order = await dbGet(env,'orders/'+data.orderId);
    if (!order || order.data.status !== 'approved' || order.data.bookingCancelledAt) {
      const cancelled = await updateSaleEmail(env,id,doc,{status:'cancelled',errorCode:'purchase_not_approved'});
      return publicSaleEmail(id,cancelled || data);
    }
  }
  if ((data.firstAttemptAt && now-data.firstAttemptAt >= SALE_EMAIL_WINDOW) || data.attempts>=10) {
    const review = await updateSaleEmail(env,id,doc,{status:'review',errorCode:'retry_window'});
    return publicSaleEmail(id,review || data);
  }
  const lease = crypto.randomUUID(),firstAttemptAt = data.firstAttemptAt || now;
  const sending = {...data,status:'sending',attempts:(data.attempts || 0)+1,firstAttemptAt,lastAttemptAt:now,
    lease,leaseUntil:now+SALE_EMAIL_LEASE,nextAttemptAt:now+SALE_EMAIL_LEASE};
  const claimed = await commit(env,[writeDoc(env,path,sending,doc)]);
  if (!claimed.response.ok) return publicSaleEmail(id,data);
  let provider;
  try {
    provider = await jsonFetch('https://api.resend.com/emails',{method:'POST',
      headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
        'Idempotency-Key':'mira-sale-email/'+env.MP_ENV+'/'+id},body:JSON.stringify(sending.payload)});
  } catch {
    provider = {response:{ok:false,status:0},body:{}};
  }
  const accepted = provider.response.ok && typeof provider.body.id === 'string' && provider.body.id.length>0;
  const changes = accepted ? {status:'sent',providerId:provider.body.id,acceptedAt:Date.now(),errorCode:''} :
    {status:'failed',errorCode:provider.response.status?'resend_'+provider.response.status:'transport',
      nextAttemptAt:Date.now()+Math.min(60*60*1000,60000*2**Math.min(sending.attempts,6))};
  const result = await updateSaleEmail(env,id,doc,changes,lease);
  return publicSaleEmail(id,result || sending);
}
async function dispatchSaleEmail(env,order,ctx) {
  if (!order?.saleNotificationId) return;
  const task = sendSaleEmail(env,order.saleNotificationId).catch(error=>{
    console.error('mira-pagos: aviso pendiente',error.name);
  });
  if (ctx?.waitUntil) ctx.waitUntil(task);else await task;
}
async function processSaleEmails(env) {
  if (!env.RESEND_API_KEY) return [];
  const result = await dbRequest(env,':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{
    from:[{collectionId:saleEmailCollection(env)}],
    where:{fieldFilter:{field:{fieldPath:'nextAttemptAt'},op:'LESS_THAN_OR_EQUAL',value:encodeValue(Date.now())}},limit:3
  }})});
  if (!result.response.ok || !Array.isArray(result.body)) fail(503,'No se pudieron consultar los avisos pendientes.');
  const processed = [];
  for (const row of result.body.filter(x=>x.document)) {
    const id = row.document.name.split('/').pop();
    try { processed.push(await sendSaleEmail(env,id)); }
    catch(error) { console.error('mira-pagos: reintento de aviso pendiente',error.name); }
  }
  return processed;
}
async function listSaleEmails(request,env) {
  await requireAdmin(request,env);
  const result = await dbRequest(env,':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{
    from:[{collectionId:saleEmailCollection(env)}],orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:25
  }})});
  if (!result.response.ok || !Array.isArray(result.body)) fail(503,'No se pudo cargar el historial de avisos.');
  return result.body.filter(x=>x.document).map(x=>publicSaleEmail(x.document.name.split('/').pop(),decodeFields(x.document.fields || {})));
}
async function testSaleEmail(request,env) {
  await requireAdmin(request,env);
  if (!env.RESEND_API_KEY) fail(422,'Primero cargá RESEND_API_KEY como secreto en Cloudflare.');
  const sender = saleEmailSender(env),body = await readJson(request);
  if (!validOrder(body.requestId || '')) fail(400,'Referencia de prueba no válida.');
  const id = 'test_'+body.requestId,path = saleEmailCollection(env)+'/'+id;
  const previous = await dbGet(env,path);
  if (!previous) {
    const data = {category:'test',title:'Prueba del correo de avisos',mode:env.MP_ENV,createdAt:Date.now(),status:'queued',
      attempts:0,firstAttemptAt:0,nextAttemptAt:Date.now(),payload:{from:sender.from,to:[ADMIN_EMAIL],
        subject:'Mira Estudio — prueba del correo de avisos',
        text:'Este es un correo de prueba de Mira Estudio. No representa una compra ni un cobro.\n\nLos próximos avisos de ventas incluirán el producto, el importe y el email de la compradora.\n\nPanel: '+new URL('/admin',env.SITE_ORIGIN).href}};
    const r = await commit(env,[writeDoc(env,path,data,null)]);
    if (!r.response.ok && !['ALREADY_EXISTS','FAILED_PRECONDITION'].includes(r.body.error?.status))
      fail(503,'No se pudo preparar el correo de prueba.');
  }
  return sendSaleEmail(env,id,true);
}

async function reconcilePayment(env,paymentId,expectedOrder,ctx) {
  if (!/^\d{1,30}$/.test(String(paymentId))) fail(400,'Identificador de pago no válido.');
  const payment = await mpRequest(env,'/v1/payments/'+paymentId);
  const orderId = String(payment.external_reference || '');
  if (!validOrder(orderId)) return null;
  if (expectedOrder && expectedOrder !== orderId) fail(403,'El pago pertenece a otra compra.');
  const seller = await verifiedSeller(env),collector = seller.id;
  for (let attempt=0;attempt<4;attempt++) {
    const [orderDoc,previous] = await Promise.all([dbGet(env,'orders/'+orderId),dbGet(env,'payments/'+paymentId)]);
    if (!orderDoc) return null;
    const order = orderDoc.data,grant = validatePayment(payment,order,env,collector,seller);
    const updated = Date.parse(payment.date_last_updated);
    if (previous && previous.data.updated >= updated) { await dispatchSaleEmail(env,order,ctx);return order; }
    const kind = order.kind || order.productType;
    const record = {id:String(paymentId),orderId,uid:order.uid,kind,productType:kind,
      productId:order.productId,status:payment.status,grant,updated,mode:env.MP_ENV,
      live:isProduction(env),providerLiveMode:payment.live_mode,sellerTestAccount:seller.testAccount};
    const entitlement = {uid:order.uid,kind,productId:order.productId,title:order.title,active:grant,
      source:'mercadopago',live:isProduction(env),providerLiveMode:payment.live_mode,
      sellerTestAccount:seller.testAccount,paymentId:String(paymentId),orderId,updatedAt:Date.now()};
    const next = {...order};
    const approved = new Set(order.approvedPaymentIds || []);
    if (grant) approved.add(String(paymentId));else approved.delete(String(paymentId));
    next.approvedPaymentIds = [...approved];
    if (!order.paymentUpdated || updated >= order.paymentUpdated || (!approved.size && previous?.data.grant === true)) {
      next.status = Number(payment.transaction_amount_refunded || 0)>0 ? 'refunded':payment.status;
      next.paymentId = String(paymentId);next.paymentUpdated = Math.max(order.paymentUpdated||0,updated);
    }
    if (approved.size) next.status = 'approved';
    next.updatedAt = Date.now();
    let emailPlan = null;
    const bookingWrites=kind==='booking'?await bookingPaymentWrites(env,order,next,approved.size>0,(order.approvedPaymentIds||[]).length>0):[];
    if(grant&&!order.firstApprovedAt&&order.status!=='approved'&&(kind!=='booking'||next.bookingStatus==='confirmed')){
      next.firstApprovedAt = updated;
      try {
        emailPlan = await planSaleEmail(env,order,paymentId);
        if (emailPlan) next.saleNotificationId = emailPlan.id;
      } catch(error) {
        next.saleEmailPreparationError = 'config_unavailable';
        console.error('mira-pagos: aviso sin preparar',error.name);
      }
    }
    const r = await commit(env,[writeDoc(env,'payments/'+paymentId,record,previous),
      ...(kind==='booking'?bookingWrites:[writeDoc(env,'entitlements/'+orderId+'_'+paymentId,entitlement)]),
      writeDoc(env,'orders/'+orderId,next,orderDoc),
      ...(emailPlan ? [writeDoc(env,saleEmailCollection(env)+'/'+emailPlan.id,emailPlan.data,null)]:[])]);
    if (r.response.ok) { await dispatchSaleEmail(env,next,ctx);return next; }
    if (![409,412].includes(r.response.status) && !['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(r.body.error?.status))
      fail(503,'No se pudo confirmar la compra. Se reintentará.');
  }
  fail(503,'La compra está siendo actualizada. Intentá nuevamente.');
}
async function webhook(request,env,ctx) {
  if (!await verifyWebhookSignature(request,env.MP_WEBHOOK_SECRET)) fail(401,'Firma de notificación no válida.');
  const body = await readJson(request),url = new URL(request.url);
  if (body.type !== 'payment') return {received:true};
  const id = url.searchParams.get('data.id');
  if (String(body.data?.id) !== id) fail(400,'La notificación no coincide con su firma.');
  await reconcilePayment(env,id,undefined,ctx);return {received:true};
}
async function userOrder(request,env,id,verify=false,paymentId,ctx) {
  if (!validOrder(id || '')) fail(400,'Referencia de compra no válida.');
  const user = await signedUser(request,env),doc = await dbGet(env,'orders/'+id);
  if (!doc || doc.data.uid !== user.uid) fail(404,'No encontramos esta compra en tu cuenta.');
  if (doc.data.mode !== env.MP_ENV) fail(409,'Esta compra pertenece a otro ambiente.');
  if (verify) {
    if (paymentId) await reconcilePayment(env,String(paymentId),id,ctx);
    else {
      const found = await mpRequest(env,'/v1/payments/search?external_reference='+id+'&sort=date_created&criteria=desc&limit=3');
      for (const p of (found.results || []).slice(0,3)) await reconcilePayment(env,String(p.id),id,ctx);
    }
  }
  const latest = verify ? await dbGet(env,'orders/'+id) : doc;
  return {order:publicOrder(latest.data),hasAccess:latest.data.kind==='booking'?false:await hasAccess(env,user,latest.data.kind || latest.data.productType,latest.data.productId)};
}
function publicItem(p,type) {
  const out = {_public:true};
  for (const k of ['id','title','subtitle','description','desc','level','levelLabel','locked','color','coverImg','cover','emoji','price','paid'])
    if (p[k] !== undefined) out[k] = p[k];
  if (!String(p.price||'').trim() && typeof p.priceArs === 'number' && Number.isFinite(p.priceArs) && p.priceArs >= 0)
    out.price = p.priceArs === 0 ? 'Gratis':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(p.priceArs);
  if (type === 'courses') out.modules = (p.modules || []).map(m=>({id:m.id,title:m.title,
    lessons:(m.lessons || []).map(l=>({id:l.id,title:l.title,duration:l.duration}))}));
  return JSON.parse(JSON.stringify(out));
}
async function catalogApi(request,env,url) {
  await requireAdmin(request,env);
  if (request.method === 'GET') {
    const type = url.searchParams.get('type');
    if (!['courses','ebooks'].includes(type)) fail(400,'Catálogo no válido.');
    const doc = await dbGet(env,'privateCatalog/'+type);
    if (!Array.isArray(doc?.data.v)) fail(422,'Primero protegé el catálogo desde Alumnas → Accesos.');
    return doc.data.v;
  }
  const {type,items} = await readJson(request,850000);
  if (!['courses','ebooks'].includes(type) || !Array.isArray(items) || items.length>150 ||
      encoder.encode(JSON.stringify(items)).length>=800000) fail(400,'Catálogo demasiado grande o inválido.');
  const kind = type === 'courses' ? 'course':'ebook',ids = new Set();
  for (const p of items) {
    checkProduct(kind,p?.id);
    if (p._public || ids.has(String(p.id))) fail(400,'El catálogo privado no terminó de cargar o tiene IDs repetidos.');
    ids.add(String(p.id));
  }
  const previous = await dbGet(env,'privateCatalog/'+type);
  if (!Array.isArray(previous?.data.v)) fail(422,'Primero protegé el catálogo desde Alumnas → Accesos.');
  const writes = [
    writeDoc(env,'privateCatalog/'+type,{v:items,t:Date.now()},previous),
    writeDoc(env,'site/'+type,{accessVersion:2,v:items.map(p=>publicItem(p,type)),t:Date.now()}),
    ...items.map(p=>writeDoc(env,'digitalContent/'+keyOf(kind,p.id),{kind,productId:String(p.id),product:p}))
  ];
  for (const p of previous.data.v) if (!ids.has(String(p.id)))
    writes.push({delete:dbBase(env)+'/digitalContent/'+keyOf(kind,p.id)});
  const r = await commit(env,writes);
  if (!r.response.ok) {
    if (['FAILED_PRECONDITION','ABORTED'].includes(r.body.error?.status))
      fail(409,'El catálogo cambió en otra ventana. Volvé a cargarlo antes de guardar.');
    fail(503,'No se pudo publicar el catálogo.');
  }
  return {saved:true};
}
async function settingsApi(request,env) {
  await requireAdmin(request,env);
  if (request.method === 'POST') {
    const body = await readJson(request);
    if (typeof body.enabled !== 'boolean') fail(400,'Configuración no válida.');
    await saveDoc(env,settingsPath(env),{enabled:body.enabled,updatedAt:Date.now()});
  }
  return {settings:await settings(env),environment:isProduction(env) ? 'live':'test',scope:'digital'};
}
async function accessList(request,env) {
  const user = await signedUser(request,env),rights = await myRights(env,user);
  const catalogs = await Promise.all(['courses','ebooks'].map(type=>dbGet(env,'privateCatalog/'+type)));
  for (const [i,catalog] of catalogs.entries()) {
    const kind = i === 0 ? 'course':'ebook';
    for (const p of catalog?.data.v || []) {
      if (p.locked === true) continue;
      let free = false;try { free = catalogPrice(p,kind) === 0; } catch {}
      if (adminUser(user) || free) rights.push({kind,productId:String(p.id)});
    }
  }
  return [...new Map(rights.map(x=>[keyOf(x.kind,x.productId),x])).values()];
}
async function listOrders(request,env,admin=false) {
  const user = admin ? await requireAdmin(request,env) : await signedUser(request,env);
  const rows = await queryDocs(env,'orders',admin ? null:'uid',user.uid,500);
  return rows.filter(x=>x.data.mode === env.MP_ENV).sort((a,b)=>(b.data.createdAt || 0)-(a.data.createdAt || 0))
    .slice(0,100).map(x=>publicOrder({...x.data,id:x.id},admin));
}
async function diagnostics(request,env) {
  await requireAdmin(request,env);
  const [catalog,collector] = await Promise.allSettled([dbGet(env,'site/courses'),sellerId(env)]);
  return {apiVersion:API_VERSION,firestore:catalog.status === 'fulfilled',mercadopago:collector.status === 'fulfilled',
    catalogReady:catalog.status === 'fulfilled' && catalog.value?.data.accessVersion === 2,
    firebaseError:catalog.status === 'rejected' ? 'Revisá los secretos de Firebase y el permiso Usuario de Cloud Datastore de la cuenta de servicio.':'',
    mercadopagoError:collector.status === 'rejected' ? (collector.reason instanceof ApiError ? collector.reason.message:'No se pudo verificar Mercado Pago.'):'',
    mode:env.MP_ENV,scope:'digital'};
}
async function adminBookings(request,env) {
  await requireAdmin(request,env);
  const rows=await queryDocs(env,'turnos',null,null,500);
  return {items:rows.filter(x=>x.data.mode?x.data.mode===env.MP_ENV:isProduction(env)).map(x=>({...x.data,id:x.id})),environment:env.MP_ENV,paymentsEnabled:(await bookingSettings(env)).enabled===true};
}
async function bookingNote(request,env) {
  await requireAdmin(request,env);
  const {orderId,note} = await readJson(request);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(orderId)) || typeof note !== 'string' || note.length>5000)
    fail(400,'Nota de atención no válida.');
  const doc = await dbGet(env,'turnos/'+orderId);
  if (!doc) fail(404,'No encontramos ese turno.');
  const patch = writeDoc(env,'turnos/'+orderId,{atencion:note},doc);
  patch.updateMask = {fieldPaths:['atencion']};
  if (!(await commit(env,[patch])).response.ok) fail(409,'El turno cambió. Volvé a cargarlo.');
  return {saved:true};
}
// Reservas con seña: precios del catálogo, agenda privada y escrituras condicionales.
const bookingSettingsPath = env => 'paymentConfig/bookings_'+env.MP_ENV;
const bookingDayPath = (env,date) => 'bookingDays/'+env.MP_ENV+'_'+date;
const bookingDefaults = () => ({enabled:false,percent:30,holdMinutes:20,serviceMinutes:{}});
const clockMinutes = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0,2))*60+Number(time.slice(3)) : -1;
const overlaps = (a,b) => a.start < b.end && b.start < a.end;
async function bookingSettings(env) {
  return {...bookingDefaults(),...(await dbGet(env,bookingSettingsPath(env)))?.data};
}
function durationMinutes(value) {
  if (Number.isInteger(value) && value>=15 && value<=480) return value;
  const s=String(value||'').trim().toLowerCase().replace(',','.');
  const h=s.match(/^(\d+(?:\.\d+)?)\s*(?:h|hs|horas?)(?:\s*(\d+)\s*(?:min|m))?$/);
  const m=s.match(/^(\d+)\s*(?:min|minutos?|m)$/);
  const n=h?Number(h[1])*60+Number(h[2]||0):m?Number(m[1]):0;
  return Number.isInteger(n)&&n>=15&&n<=480?n:0;
}
async function bookingServices(env,config) {
  const [home,full]=await Promise.all([dbGet(env,'site/services'),dbGet(env,'site/services_page')]);
  const services=new Map();
  const add=(name,price,duration,aliases=[])=>{
    if(typeof name!=='string'||!name.trim()||name.length>160)return;
    let cents=0;try{cents=catalogPrice({price},'service');}catch{}
    const existing=services.get(name);
    const row={name,priceCents:cents,durationMinutes:durationMinutes(config.serviceMinutes?.[name])||durationMinutes(duration)||existing?.durationMinutes||0,aliases};
    if(existing&&existing.priceCents!==cents)row.ambiguous=true;
    services.set(name,{...existing,...row});
  };
  for(const s of home?.data.v||[])add(s.name,s.price,s.dur);
  for(const c of full?.data.v?.cats||[])for(const s of c.items||[]) {
    // El nombre actual es el que envían los chips. bookingKey solo conserva la duración al renombrar.
    const duration=config.serviceMinutes?.[s.bookingKey]||s.durationMinutes||s.dur;
    add(s.n,s.p,duration,s.bookingKey?[s.bookingKey]:[]);
  }
  return [...services.values()];
}
async function bookingSettingsApi(request,env) {
  await requireAdmin(request,env);
  let config=await bookingSettings(env);
  if(request.method==='POST'){
    const b=await readJson(request,30000);
    if(typeof b.enabled!=='boolean'||!Number.isInteger(b.percent)||b.percent<1||b.percent>100||
       !b.serviceMinutes||typeof b.serviceMinutes!=='object'||Array.isArray(b.serviceMinutes))
      fail(400,'Elegí un porcentaje entre 1 y 100 y las duraciones de los servicios.');
    const minutes={};
    for(const [name,value] of Object.entries(b.serviceMinutes)){
      if(name.length>160||!durationMinutes(value))fail(400,'Cada duración debe estar entre 15 y 480 minutos.');
      minutes[name]=value;
    }
    config={...config,enabled:b.enabled,percent:b.percent,serviceMinutes:minutes,updatedAt:Date.now()};
    const services=await bookingServices(env,config);
    if(config.enabled&&!services.some(s=>s.priceCents>0&&s.durationMinutes&&!s.ambiguous))
      fail(422,'Completá el precio y la duración de al menos un servicio antes de habilitar las señas.');
    await saveDoc(env,bookingSettingsPath(env),config);
  }
  return {settings:config,services:await bookingServices(env,config),environment:env.MP_ENV};
}
const bookingScheduleDefaults=[
  {day:'Lunes',times:['09:00','10:30','12:00','15:00','16:30']},
  {day:'Martes',times:['09:00','10:30','14:00','15:30']},
  {day:'Miércoles',times:['09:00','11:00','14:00','16:00']},
  {day:'Jueves',times:['10:00','11:30','15:00','16:30']},
  {day:'Viernes',times:['09:00','10:30','12:00','14:00']},
  {day:'Sábado',times:['09:00','10:30','12:00']}
];
function bookingDate(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'Elegí una fecha válida.');
  const stamp=Date.parse(date+'T00:00:00-03:00');
  if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||
     stamp<Date.now()-86400000||stamp>Date.now()+180*86400000)fail(422,'Elegí una fecha próxima, dentro de los próximos seis meses.');
  return stamp;
}
async function bookingQuote(env,user,body,requireTime=true) {
  const config=await bookingSettings(env);
  if(config.enabled!==true)fail(409,'Las reservas con seña todavía no están habilitadas. Contactá al estudio.');
  const names=body.services;
  if(!Array.isArray(names)||!names.length||names.length>8||names.some(x=>typeof x!=='string')||new Set(names).size!==names.length)
    fail(400,'Elegí entre uno y ocho servicios diferentes.');
  const catalog=await bookingServices(env,config);
  let total=0,duration=0;
  for(const name of names){
    const service=catalog.find(s=>s.name===name);
    if(!service||!service.priceCents||!service.durationMinutes||service.ambiguous)
      fail(422,'El servicio '+String(name).slice(0,160)+' necesita un precio y una duración confirmados. Contactá al estudio.');
    total+=service.priceCents;duration+=service.durationMinutes;
  }
  if(duration>480||total>1000000000)fail(422,'Esta combinación requiere coordinar el turno con el estudio.');
  const date=body.date,stamp=bookingDate(date);
  const scheduleDoc=await dbGet(env,'site/slots');
  const schedule=scheduleDoc? (Array.isArray(scheduleDoc.data.v)?scheduleDoc.data.v:[]) : bookingScheduleDefaults;
  const day=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(stamp).getUTCDay()];
  const times=[...new Set(schedule.find(s=>s.day===day)?.times||[])].filter(t=>clockMinutes(t)>=0);
  const start=clockMinutes(body.time||'');
  if(requireTime&&(!times.includes(body.time)||stamp+start*60000<=Date.now()||start+duration>1440))
    fail(422,'Ese horario no está disponible. Volvé a consultar la agenda.');
  const deposit=Math.max(1,Math.round(total*config.percent/100));
  return {kind:'booking',productId:'appointment',title:names.join(' + ').slice(0,200),
    amountCents:deposit,totalCents:total,balanceCents:total-deposit,currency:'ARS',depositPercent:config.percent,
    holdMinutes:config.holdMinutes,times,durationMinutes:duration,
    booking:{date,time:body.time||'',services:names,start,end:start+duration,durationMinutes:duration}};
}
const activeReservations=(doc,now=Date.now())=>(doc?.data.reservations||[]).filter(r=>r.status==='confirmed'||r.expiresAt>now);
async function legacyReservations(env,date) {
  const [rows,taken,config]=await Promise.all([
    queryDocs(env,'turnos','date',date),
    isProduction(env)?dbGet(env,'site/taken'):null,bookingSettings(env)
  ]);
  const catalog=await bookingServices(env,config);
  return [
    ...rows.filter(x=>x.data.status!=='cancelled'&&(x.data.mode?x.data.mode===env.MP_ENV:isProduction(env)))
      .map(x=>{const start=clockMinutes(x.data.time||'');const names=String(x.data.serv||'').split(' + ');
        const inferred=names.every(n=>catalog.find(s=>s.name===n)?.durationMinutes)?names.reduce((sum,n)=>sum+catalog.find(s=>s.name===n).durationMinutes,0):0;
        return {orderId:x.data.orderId||x.id,start,end:start+(durationMinutes(x.data.durationMinutes)||inferred||1440)};}),
    ...(taken?.data.v?.[date]||[]).map(t=>({start:clockMinutes(t),end:clockMinutes(t)+1}))
  ].filter(x=>x.start>=0);
}
async function availability(request,env) {
  const user=await signedUser(request,env),body=await readJson(request);
  const q=await bookingQuote(env,user,body,false),[day,legacy]=await Promise.all([
    dbGet(env,bookingDayPath(env,q.booking.date)),legacyReservations(env,q.booking.date)]);
  const busy=[...activeReservations(day),...legacy],stamp=bookingDate(q.booking.date);
  return {times:q.times.filter(time=>{
    const start=clockMinutes(time);return start+q.durationMinutes<=1440&&stamp+start*60000>Date.now()&&
      !busy.some(r=>overlaps({start,end:start+q.durationMinutes},r));
  }),durationMinutes:q.durationMinutes,depositPercent:q.depositPercent};
}
function sameBooking(a,b) {
  return a.date===b.date&&a.time===b.time&&JSON.stringify(a.services)===JSON.stringify(b.services)&&
    a.name===b.name&&a.tel===b.tel&&a.msg===b.msg;
}
async function reserveBooking(env,order) {
  for(let attempt=0;attempt<4;attempt++){
    const path=bookingDayPath(env,order.booking.date),limitPath=bookingLimitPath(order);
    const [day,limit,legacy]=await Promise.all([dbGet(env,path),dbGet(env,limitPath),legacyReservations(env,order.booking.date)]);
    const holds=activeReservations(day),recent=(limit?.data.recent||[]).filter(t=>t>Date.now()-60000);
    if(recent.length>=3)fail(429,'Esperá un minuto antes de iniciar otra reserva.');
    if(holds.length>=150||[...holds,...legacy].some(r=>r.orderId!==order.id&&overlaps(order.booking,r)))
      fail(409,'Ese horario ya no está disponible. Elegí otro antes de pagar.');
    if(limit?.data.holdUntil>Date.now()){
      const other=await dbGet(env,'orders/'+limit.data.holdId);
      if(other&&['created','pending','in_process','authorized','in_mediation'].includes(other.data.status))
        fail(409,'Ya tenés una reserva en curso. Revisá Mis compras antes de iniciar otra.');
    }
    holds.push({orderId:order.id,start:order.booking.start,end:order.booking.end,status:'held',expiresAt:order.expiresAt});
    const result=await commit(env,[
      writeDoc(env,'orders/'+order.id,order,null),
      writeDoc(env,path,{reservations:holds},day),
      writeDoc(env,limitPath,{recent:[...recent,Date.now()],holdId:order.id,holdUntil:order.expiresAt},limit)
    ]);
    if(result.response.ok)return;
    if(!['ABORTED','ALREADY_EXISTS','FAILED_PRECONDITION'].includes(result.body.error?.status))fail(503,'No se pudo reservar el horario. Volvé a intentar.');
  }
  fail(409,'La agenda está cambiando. Consultá nuevamente los horarios.');
}
async function bookingPaymentWrites(env,order,next,approved,previouslyApproved) {
  const path=bookingDayPath(env,order.booking.date),[day,turno,legacy]=await Promise.all([
    dbGet(env,path),dbGet(env,'turnos/'+order.id),legacyReservations(env,order.booking.date)]);
  const holds=activeReservations(day).filter(r=>r.orderId!==order.id);
  if(approved){
    // Una actualización del proveedor no deshace un turno ya confirmado o atendido.
    if(previouslyApproved&&!order.bookingCancelledAt&&['confirmed','done'].includes(turno?.data.status)){
      next.bookingStatus=turno.data.status;
      return [];
    }
    const conflict=[...holds,...legacy].some(r=>r.orderId!==order.id&&overlaps(order.booking,r));
    const late=Date.parse(order.booking.date+'T00:00:00-03:00')+order.booking.start*60000<=Date.now();
    if(order.bookingCancelledAt||order.bookingStatus==='review'||conflict||late){
      next.status='review';next.bookingStatus='review';next.issue='Pago recibido; el horario requiere revisión del estudio. No vuelvas a pagar.';
      return [writeDoc(env,path,{reservations:holds},day)];
    }
    next.bookingStatus=turno?.data.status==='done'?'done':'confirmed';
    holds.push({orderId:order.id,start:order.booking.start,end:order.booking.end,status:'confirmed',expiresAt:order.expiresAt});
    const b=order.booking;
    return [writeDoc(env,path,{reservations:holds},day),writeDoc(env,'turnos/'+order.id,{
      ...(turno?.data||{}),id:order.id,orderId:order.id,uid:order.uid,email:order.email,name:b.name,tel:b.tel,msg:b.msg,
      serv:b.services.join(' + '),date:b.date,time:b.time,durationMinutes:b.durationMinutes,
      status:turno?.data.status==='done'?'done':'confirmed',paymentStatus:'approved',amountCents:order.amountCents,
      totalCents:order.totalCents,balanceCents:order.balanceCents,mode:env.MP_ENV,
      createdAt:turno?.data.createdAt||Date.now(),ts:new Date().toISOString(),updatedAt:Date.now()
    },turno)];
  }
  if(previouslyApproved){
    next.bookingStatus='cancelled';
    return [writeDoc(env,path,{reservations:holds},day),...(turno?[writeDoc(env,'turnos/'+order.id,{
      ...turno.data,status:turno.data.status==='done'?'done':'cancelled',paymentStatus:next.status,updatedAt:Date.now()
    },turno)]:[])];
  }
  if(['rejected','cancelled','refunded','charged_back'].includes(next.status)){
    return day?[writeDoc(env,path,{reservations:holds},day)]:[];
  }
  return [];
}
async function bookingStatus(request,env) {
  await requireAdmin(request,env);
  const {orderId,status}=await readJson(request);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(String(orderId))||!['confirmed','done','cancelled'].includes(status))
    fail(400,'Estado de turno no válido.');
  for(let i=0;i<4;i++){
    const doc=await dbGet(env,'turnos/'+orderId);
    if(!doc|| (doc.data.mode&&doc.data.mode!==env.MP_ENV))fail(404,'No encontramos ese turno en este ambiente.');
    if(doc.data.orderId){
      const order=await dbGet(env,'orders/'+doc.data.orderId);
      if(!order||order.data.mode!==env.MP_ENV)fail(404,'No encontramos la reserva.');
      if(status!=='cancelled'&&(doc.data.status==='cancelled'||order.data.status!=='approved'||!order.data.approvedPaymentIds?.length))
        fail(409,'Solo se puede confirmar o atender un turno con seña aprobada. Una cancelación no se reactiva automáticamente.');
      const path=bookingDayPath(env,doc.data.date),day=await dbGet(env,path);
      const nextOrder={...order.data,bookingStatus:status,...(status==='cancelled'?{bookingCancelledAt:Date.now()}: {})};
      const reservations=status==='cancelled'?activeReservations(day).filter(r=>r.orderId!==order.data.id):activeReservations(day);
      const result=await commit(env,[writeDoc(env,'turnos/'+orderId,{...doc.data,status,updatedAt:Date.now()},doc),
        writeDoc(env,'orders/'+order.data.id,nextOrder,order),writeDoc(env,path,{reservations},day)]);
      if(result.response.ok)return {saved:true};
    }else{
      const result=await commit(env,[writeDoc(env,'turnos/'+orderId,{...doc.data,status},doc)]);
      if(result.response.ok)return {saved:true};
    }
  }
  fail(409,'El turno cambió. Volvé a cargarlo.');
}



async function accessAudit(request,env){
  await requireAdmin(request,env);
  const {email}=await readJson(request);
  if(typeof email!=='string'||email.length>254||!email.includes('@'))fail(400,'Ingresá el email de la alumna.');
  const users=await queryDocs(env,'users','email',email.trim()),accounts=[];
  for(const u of users.slice(0,5)){
    const [manual,paid,catalog]=await Promise.all([queryDocs(env,'products',null,null,500,'/manualAccess/'+u.id),queryDocs(env,'entitlements','uid',u.id),dbGet(env,'privateCatalog/courses')]);
    accounts.push({email:u.data.email,courses:await Promise.all((catalog?.data.v||[]).map(async p=>{
      const content=await dbGet(env,'digitalContent/'+keyOf('course',p.id));
      const product=content?.data.product;
      let cents=null;try{cents=catalogPrice(product||p,'course');}catch{}
      const granted=manual.some(m=>m.data.active===true&&m.data.kind==='course'&&String(m.data.productId)===String(p.id));
      const purchases=paid.filter(x=>x.data.active===true&&x.data.kind==='course'&&String(x.data.productId)===String(p.id));
      return {id:String(p.id),title:p.title,priceCents:cents,reason:!product||product.locked?'locked':granted?'manual':purchases.some(x=>x.data.live===isProduction(env))?'purchase':cents===0?'free':'denied',testPurchases:purchases.filter(x=>x.data.live===false).length};
    }))});
  }
  return {accounts,environment:env.MP_ENV};
}

function configurationReady(env) {
  return ['FIREBASE_PROJECT_ID','FIREBASE_API_KEY','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY',
    'MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','SITE_ORIGIN','WORKER_ORIGIN'].every(k=>!!env[k]) &&
    ['test','production'].includes(env.MP_ENV);
}
export default {
  async scheduled(_event,env,ctx) {
    if (!configurationReady(env)) return;
    const task = processSaleEmails(env).catch(error=>console.error('mira-pagos: revisión de avisos pendiente',error.name));
    if (ctx?.waitUntil) ctx.waitUntil(task);else await task;
  },
  async fetch(request,env,ctx) {
    const url = new URL(request.url),origin = request.headers.get('Origin');
    const allowed = [env.SITE_ORIGIN,env.EXTRA_ORIGIN,env.DEV_ORIGIN].filter(Boolean);
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
      'X-Content-Type-Options':'nosniff'};
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
    try {
      if (origin && !allowed.includes(origin)) fail(403,'Origen no autorizado.');
      if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
      if (url.pathname === '/health' && request.method === 'GET')
        return json({service:'mira-pagos',ready:configurationReady(env),mode:env.MP_ENV || 'unconfigured',
          apiVersion:API_VERSION,scope:'digital-bookings',revision:'20261124-defensive-hardening',bookings:true});
      if (!configurationReady(env)) fail(503,'Los pagos todavía no están configurados.');
      if (url.pathname === '/webhooks/mercadopago' && request.method === 'POST') return json(await webhook(request,env,ctx));
      if (url.pathname === '/sale-email/settings' && ['GET','POST'].includes(request.method)) return json(await saleEmailSettingsApi(request,env));
      if (url.pathname === '/sale-email/notices' && request.method === 'GET') return json(await listSaleEmails(request,env));
      if (url.pathname === '/sale-email/test' && request.method === 'POST') return json(await testSaleEmail(request,env));
      if (url.pathname === '/sale-email/retry' && request.method === 'POST') {
        await requireAdmin(request,env);
        const body = await readJson(request);
        return json(body.id ? await sendSaleEmail(env,String(body.id),true) : await processSaleEmails(env));
      }
      if (url.pathname === '/diagnostics' && request.method === 'GET') return json(await diagnostics(request,env));
      if (url.pathname === '/settings' && ['GET','POST'].includes(request.method)) return json(await settingsApi(request,env));
      if (url.pathname === '/catalog' && ['GET','POST'].includes(request.method)) return json(await catalogApi(request,env,url));
      if (url.pathname === '/checkout' && request.method === 'POST') return json(await createCheckout(request,env));
      if (url.pathname === '/quote' && request.method === 'POST') {
        const user = await signedUser(request,env),body = await readJson(request);
        return json(body.kind==='booking'?await bookingQuote(env,user,body):await quoteFor(env,user,body.kind,body.productId));
      }
      if (url.pathname === '/access' && request.method === 'POST') return json(await accessProduct(request,env));
      if (url.pathname === '/my-access' && request.method === 'GET') return json(await accessList(request,env));
      if (url.pathname === '/orders' && request.method === 'GET') return json(await listOrders(request,env));
      if (url.pathname === '/admin-orders' && request.method === 'GET') return json(await listOrders(request,env,true));
      if (url.pathname === '/admin-bookings' && request.method === 'GET') return json(await adminBookings(request,env));
      if (url.pathname === '/booking-note' && request.method === 'POST') return json(await bookingNote(request,env));
      if (url.pathname === '/order' && request.method === 'GET')
        return json((await userOrder(request,env,url.searchParams.get('id'))).order);
      if (url.pathname === '/verify-order' && request.method === 'POST') {
        const body = await readJson(request);
        return json(await userOrder(request,env,body.orderId,true,body.paymentId,ctx));
      }
      const match = url.pathname.match(/^\/orders\/([0-9a-f-]+)(\/verify)?$/i);
      if (match && validOrder(match[1]) && request.method === (match[2] ? 'POST':'GET')) {
        const body = match[2] ? await readJson(request) : {};
        return json(await userOrder(request,env,match[1],!!match[2],body.paymentId,ctx));
      }
      if(url.pathname==='/booking-settings'&&['GET','POST'].includes(request.method))return json(await bookingSettingsApi(request,env));
      if(url.pathname==='/availability'&&request.method==='POST')return json(await availability(request,env));
      if(url.pathname==='/booking-status'&&request.method==='POST')return json(await bookingStatus(request,env));
      if(url.pathname==='/access-audit'&&request.method==='POST')return json(await accessAudit(request,env));
      if (['/grant'].includes(url.pathname)) {
        await signedUser(request,env);
        fail(422,url.pathname === '/grant' ? 'Asigná el acceso desde Alumnas → Accesos.':'Las reservas con seña todavía no están habilitadas. Contactá al estudio.');
      }
      return json({error:'Ruta no encontrada.'},404);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('mira-pagos: error interno',error.name);
      return json({error:error instanceof ApiError ? error.message:'No se pudo completar la operación. Intentá nuevamente.'},
        error instanceof ApiError ? error.status:503);
    }
  }
};
