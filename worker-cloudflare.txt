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
async function sellerId(env) {
  if (sellerCache?.token === env.MP_ACCESS_TOKEN && sellerCache.mode === env.MP_ENV) return sellerCache.id;
  const account = await mpRequest(env,'/users/me');
  if (!account.id) fail(503,'La cuenta de cobro no está configurada.');
  const testAccount = Array.isArray(account.tags) && account.tags.includes('test_user');
  if (!isProduction(env) && !testAccount)
    fail(503,'El Access Token no corresponde a una cuenta vendedora de prueba. Copiá las credenciales de prueba de tu aplicación Checkout Pro.');
  if (isProduction(env) && (testAccount || /^TEST-/i.test(env.MP_ACCESS_TOKEN)))
    fail(503,'Para cobrar en producción necesitás las credenciales de tu cuenta real de Mercado Pago.');
  if (account.site_id && account.site_id !== 'MLA') fail(503,'La cuenta vendedora debe ser de Argentina.');
  sellerCache = {token:env.MP_ACCESS_TOKEN,mode:env.MP_ENV,id:String(account.id)};
  return sellerCache.id;
}

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
  if (product.priceArs === 0) return 0;
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
    amountCents:order.amountCents,totalCents:order.totalCents || order.amountCents,balanceCents:0,
    currency:order.currency,status:order.status,createdAt:order.createdAt,mode:order.mode,live:order.mode === 'production',
    expiresAt:order.expiresAt || 0};
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
  const body = await readJson(request),kind = body.kind || body.productType,id = String(body.productId),requestId = body.requestId;
  checkProduct(kind,body.productId);
  if (!validOrder(requestId || '')) fail(400,'Referencia de compra no válida.');
  const old = await dbGet(env,'orders/'+requestId);
  if (old) {
    if (old.data.uid !== user.uid || (old.data.kind || old.data.productType) !== kind || old.data.productId !== id)
      fail(403,'La compra pertenece a otra cuenta o producto.');
    if (old.data.mode !== env.MP_ENV) fail(409,'La referencia pertenece a otro ambiente. Elegí nuevamente el producto.');
    if (old.data.status === 'approved') fail(409,'Esta compra ya está confirmada. Ingresá desde tu portal.');
    if (old.data.checkoutUrl && old.data.expiresAt > Date.now())
      return {id:requestId,orderId:requestId,checkoutUrl:checkoutUrl(old.data.checkoutUrl)};
    fail(409,'Esta referencia ya se utilizó. Revisá Mis compras y elegí nuevamente el producto si el pago no se inició.');
  }
  const q = await quoteFor(env,user,kind,id);
  if (body.acceptedAmountCents !== q.amountCents || body.acceptedTotalCents !== q.totalCents)
    fail(409,'El precio cambió. Volvé a abrir esta compra para confirmar el importe actual.');
  const collector = await sellerId(env),now = Date.now();
  const order = {...q,id:requestId,uid:user.uid,email:user.email,productType:kind,status:'created',
    createdAt:now,expiresAt:now+30*60*1000,mode:env.MP_ENV,live:isProduction(env),collectorId:collector};
  const saved = await commit(env,[writeDoc(env,'orders/'+requestId,order,null)]);
  if (!saved.response.ok) fail(409,'La compra ya se está preparando. Revisá Mis compras.');
  const returnUrl = new URL('/pagos.html',env.SITE_ORIGIN);returnUrl.searchParams.set('order',requestId);
  let preference;
  try {
    preference = await mpRequest(env,'/checkout/preferences',{method:'POST',body:JSON.stringify({
      items:[{id:keyOf(kind,id),title:order.title,quantity:1,currency_id:'ARS',unit_price:q.amountCents/100}],
      payer:isProduction(env) ? {email:user.email} : undefined,
      external_reference:requestId,metadata:{mira_order_id:requestId,mira_uid:user.uid,product_type:kind,product_id:id},
      back_urls:{success:returnUrl.href,pending:returnUrl.href,failure:returnUrl.href},auto_return:'approved',
      notification_url:new URL('/webhooks/mercadopago',env.WORKER_ORIGIN).href,
      expires:true,expiration_date_from:new Date(now).toISOString(),expiration_date_to:new Date(order.expiresAt).toISOString(),
      statement_descriptor:'MIRA ESTUDIO'
    })});
  } catch (error) {
    const patch = writeDoc(env,'orders/'+requestId,{status:'error',issue:'No se pudo preparar el checkout. No se confirmó ningún pago.'});
    patch.updateMask = {fieldPaths:['status','issue']};await commit(env,[patch]);throw error;
  }
  const target = checkoutUrl(preference.init_point);
  const patch = writeDoc(env,'orders/'+requestId,{preferenceId:preference.id,checkoutUrl:target});
  patch.updateMask = {fieldPaths:['preferenceId','checkoutUrl']};
  if (!(await commit(env,[patch])).response.ok) fail(503,'Se creó el checkout, pero no se pudo guardar. Revisá Mis compras.');
  return {id:requestId,orderId:requestId,checkoutUrl:target};
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

function validatePayment(payment,order,env,collector) {
  if (String(payment.external_reference) !== order.id || String(payment.collector_id) !== String(collector) ||
      String(payment.collector_id) !== order.collectorId || payment.currency_id !== order.currency ||
      Math.round(Number(payment.transaction_amount)*100) !== order.amountCents ||
      !Number.isFinite(Number(payment.transaction_amount)) || payment.live_mode !== isProduction(env) || order.mode !== env.MP_ENV)
    fail(422,'El pago no coincide con esta compra.');
  if (payment.metadata?.mira_uid !== order.uid || payment.metadata?.mira_order_id !== order.id ||
      payment.metadata?.product_type !== order.productType || String(payment.metadata?.product_id) !== order.productId)
    fail(422,'El pago no está asociado correctamente a la compra.');
  if (!Number.isFinite(Date.parse(payment.date_last_updated))) fail(422,'El pago no tiene una fecha válida.');
  return payment.status === 'approved' && Number(payment.transaction_amount_refunded || 0) === 0;
}


async function reconcilePayment(env,paymentId,expectedOrder) {
  if (!/^\d{1,30}$/.test(String(paymentId))) fail(400,'Identificador de pago no válido.');
  const payment = await mpRequest(env,'/v1/payments/'+paymentId);
  const orderId = String(payment.external_reference || '');
  if (!validOrder(orderId)) return null;
  if (expectedOrder && expectedOrder !== orderId) fail(403,'El pago pertenece a otra compra.');
  const collector = await sellerId(env);
  for (let attempt=0;attempt<4;attempt++) {
    const [orderDoc,previous] = await Promise.all([dbGet(env,'orders/'+orderId),dbGet(env,'payments/'+paymentId)]);
    if (!orderDoc) return null;
    const order = orderDoc.data,grant = validatePayment(payment,order,env,collector);
    const updated = Date.parse(payment.date_last_updated);
    if (previous && previous.data.updated >= updated) return order;
    const kind = order.kind || order.productType;
    const record = {id:String(paymentId),orderId,uid:order.uid,kind,productType:kind,
      productId:order.productId,status:payment.status,grant,updated,mode:env.MP_ENV};
    const entitlement = {uid:order.uid,kind,productId:order.productId,title:order.title,active:grant,
      source:'mercadopago',live:payment.live_mode,paymentId:String(paymentId),orderId,updatedAt:Date.now()};
    const next = {...order};
    const approved = new Set(order.approvedPaymentIds || []);
    if (grant) approved.add(String(paymentId));else approved.delete(String(paymentId));
    next.approvedPaymentIds = [...approved];
    if (!order.paymentUpdated || updated >= order.paymentUpdated) {
      next.status = Number(payment.transaction_amount_refunded || 0)>0 ? 'refunded':payment.status;
      next.paymentId = String(paymentId);next.paymentUpdated = updated;
    }
    if (approved.size) next.status = 'approved';
    next.updatedAt = Date.now();
    const r = await commit(env,[writeDoc(env,'payments/'+paymentId,record,previous),
      writeDoc(env,'entitlements/'+orderId+'_'+paymentId,entitlement),
      writeDoc(env,'orders/'+orderId,next,orderDoc)]);
    if (r.response.ok) return next;
    if (![409,412].includes(r.response.status) && !['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(r.body.error?.status))
      fail(503,'No se pudo confirmar la compra. Se reintentará.');
  }
  fail(503,'La compra está siendo actualizada. Intentá nuevamente.');
}
async function webhook(request,env) {
  if (!await verifyWebhookSignature(request,env.MP_WEBHOOK_SECRET)) fail(401,'Firma de notificación no válida.');
  const body = await readJson(request),url = new URL(request.url);
  if (body.type !== 'payment') return {received:true};
  const id = url.searchParams.get('data.id');
  if (String(body.data?.id) !== id) fail(400,'La notificación no coincide con su firma.');
  await reconcilePayment(env,id);return {received:true};
}
async function userOrder(request,env,id,verify=false,paymentId) {
  if (!validOrder(id || '')) fail(400,'Referencia de compra no válida.');
  const user = await signedUser(request,env),doc = await dbGet(env,'orders/'+id);
  if (!doc || doc.data.uid !== user.uid) fail(404,'No encontramos esta compra en tu cuenta.');
  if (doc.data.mode !== env.MP_ENV) fail(409,'Esta compra pertenece a otro ambiente.');
  if (verify) {
    if (paymentId) await reconcilePayment(env,String(paymentId),id);
    else {
      const found = await mpRequest(env,'/v1/payments/search?external_reference='+id+'&sort=date_created&criteria=desc&limit=3');
      for (const p of (found.results || []).slice(0,3)) await reconcilePayment(env,String(p.id),id);
    }
  }
  const latest = verify ? await dbGet(env,'orders/'+id) : doc;
  return {order:publicOrder(latest.data),hasAccess:await hasAccess(env,user,latest.data.kind || latest.data.productType,latest.data.productId)};
}
function publicItem(p,type) {
  const out = {_public:true};
  for (const k of ['id','title','subtitle','description','desc','level','levelLabel','locked','color','coverImg','cover','emoji','price','paid'])
    if (p[k] !== undefined) out[k] = p[k];
  if (typeof p.priceArs === 'number' && Number.isFinite(p.priceArs) && p.priceArs >= 0)
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
  // La agenda existente sigue visible. Este Worker no crea ni cobra reservas.
  const rows = await queryDocs(env,'turnos',null,null,500);
  return {items:rows.map(x=>({...x.data,id:x.id})),environment:'existing',paymentsEnabled:false};
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
function configurationReady(env) {
  return ['FIREBASE_PROJECT_ID','FIREBASE_API_KEY','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY',
    'MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','SITE_ORIGIN','WORKER_ORIGIN'].every(k=>!!env[k]) &&
    ['test','production'].includes(env.MP_ENV);
}
export default {
  async fetch(request,env) {
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
          apiVersion:API_VERSION,scope:'digital'});
      if (!configurationReady(env)) fail(503,'Los pagos todavía no están configurados.');
      if (url.pathname === '/webhooks/mercadopago' && request.method === 'POST') return json(await webhook(request,env));
      if (url.pathname === '/diagnostics' && request.method === 'GET') return json(await diagnostics(request,env));
      if (url.pathname === '/settings' && ['GET','POST'].includes(request.method)) return json(await settingsApi(request,env));
      if (url.pathname === '/catalog' && ['GET','POST'].includes(request.method)) return json(await catalogApi(request,env,url));
      if (url.pathname === '/checkout' && request.method === 'POST') return json(await createCheckout(request,env));
      if (url.pathname === '/quote' && request.method === 'POST') {
        const user = await signedUser(request,env),body = await readJson(request);
        return json(await quoteFor(env,user,body.kind,body.productId));
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
        return json(await userOrder(request,env,body.orderId,true,body.paymentId));
      }
      const match = url.pathname.match(/^\/orders\/([0-9a-f-]+)(\/verify)?$/i);
      if (match && validOrder(match[1]) && request.method === (match[2] ? 'POST':'GET')) {
        const body = match[2] ? await readJson(request) : {};
        return json(await userOrder(request,env,match[1],!!match[2],body.paymentId));
      }
      if (['/availability','/booking-status','/grant'].includes(url.pathname)) {
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
