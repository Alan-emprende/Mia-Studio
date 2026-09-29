/* Cobros: toda autorización y todo importe se verifican en el servidor. */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);
  const statuses={created:'Preparando pago',pending:'Pago pendiente',approved:'Pago confirmado',rejected:'Pago rechazado',refunded:'Pago devuelto',charged_back:'Pago en disputa',cancelled:'Cancelado',review:'Revisión de la dueña'};
  async function user(){
    if(typeof firebase==='undefined')throw new Error('No se pudo cargar el inicio de sesión');
    const auth=firebase.auth();
    const u=await new Promise(resolve=>{let off=auth.onAuthStateChanged(x=>{off();resolve(x);});});
    if(!u)throw new Error('Iniciá sesión para continuar');if(!u.emailVerified)throw new Error('Verificá tu email para continuar');return u;
  }
  async function api(path,body){
    if(path==='/access'&&!window.MIRA_PAYMENTS_API&&window.miraDigitalAccess)return window.miraDigitalAccess.read(body.kind,body.productId);
    const base=window.MIRA_PAYMENTS_API;if(!base)throw new Error('Los cobros todavía están en preparación. Contactá al estudio.');
    const u=await user(),token=await u.getIdToken();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      let response,data;
      try{response=await fetch(base+path,{signal:controller.signal,method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});data=await response.json();}
      catch{throw new Error('No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar. Tu selección se conserva.');}
      if(!response.ok)throw new Error(data.error||'No se pudo completar la operación');return data;
    }finally{clearTimeout(timer);}
  }
  window.miraPayments={api,money};
  window.miraPostLoginDestination=role=>{
    if(role==='admin')return 'admin.html';
    const target=sessionStorage.getItem('mira_checkout_return');
    sessionStorage.removeItem('mira_checkout_return');
    if(target&&/^pagos\.html(?:\?order=[A-Za-z0-9_%.-]+|\?historial=1)?$/.test(target))return target;
    try{const draft=JSON.parse(sessionStorage.getItem('mira_checkout')||'null');if(['course','ebook','booking'].includes(draft?.kind))return 'pagos.html';}catch{}
    return 'dashboard.html';
  };
  function begin(draft){sessionStorage.setItem('mira_checkout',JSON.stringify(draft));location.href='pagos.html';}
  window.buyCourse=id=>window.MIRA_PAYMENTS_API?begin({kind:'course',productId:String(id)}):window.openViewer(Number(id));
  window.buyEbook=id=>window.MIRA_PAYMENTS_API?begin({kind:'ebook',productId:String(id)}):accessProduct('ebook',id);
  // Los enlaces de pago anteriores dejan de ser autoridad sobre las compras.
  window.mpCheckout=()=>toast('Elegí el producto para generar una orden segura.');
  let privateCatalog={uid:null,courses:null,ebooks:null};
  window.miraCourseAuthorized=id=>!!firebase.auth().currentUser?.uid&&privateCatalog.uid===firebase.auth().currentUser.uid&&!!privateCatalog.courses?.some(p=>String(p.id)===String(id)&&!p._public);
  window.miraClearPrivateContent=()=>{privateCatalog={uid:null,courses:null,ebooks:null};const area=document.getElementById('vid-area');area?.querySelectorAll('iframe,video').forEach(el=>el.remove());const viewer=document.getElementById('view-course-viewer');if(viewer?.classList.contains('active')&&typeof showView==='function')showView('dashboard');};
  function publicItem(p,type){const out={_public:true};for(const k of ['id','title','subtitle','description','desc','level','levelLabel','locked','color','coverImg','cover','emoji','price','paid'])if(p[k]!==undefined)out[k]=p[k];if(type==='courses')out.modules=(p.modules||[]).map(m=>({id:m.id,title:m.title,lessons:(m.lessons||[]).map(l=>({id:l.id,title:l.title,duration:l.duration}))}));return out;}
  window.miraCacheCatalog=(type,items)=>{const uid=firebase.auth().currentUser?.uid||null;if(uid!==privateCatalog.uid)privateCatalog={uid,courses:null,ebooks:null};privateCatalog[type]=items.map(p=>p._public?(privateCatalog[type]?.find(old=>String(old.id)===String(p.id)&&!old._public)||p):p);localStorage.setItem(type==='courses'?'ms_courses':'ms_ebooks',JSON.stringify(items.map(p=>publicItem(p,type))));};
  window.miraResolveCatalog=(type,items)=>{const uid=firebase.auth().currentUser?.uid||null;return JSON.parse(JSON.stringify(uid&&uid===privateCatalog.uid&&privateCatalog[type]?privateCatalog[type]:items));};
  for(const [type,key] of [['courses','ms_courses'],['ebooks','ms_ebooks']]){try{const cached=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(cached))localStorage.setItem(key,JSON.stringify(cached.map(p=>publicItem(p,type))));}catch{localStorage.removeItem(key);}}
  const originalViewer=window.openViewer;
  window.openViewer=async function(id){
    try{
      const u=await user();
      const product=await api('/access',{kind:'course',productId:String(id)});
      if(firebase.auth().currentUser?.uid!==u.uid)throw Error('La sesión cambió. Volvé a intentar.');
      const list=[...gc()];const i=list.findIndex(p=>String(p.id)===String(id));
      // El reproductor legado lee esta caché. El servidor vuelve a validar cada apertura.
      if(i<0)list.push(product);else list[i]=product;window.miraCacheCatalog('courses',list);if(document.getElementById('vcname')){originalViewer(id);sessionStorage.removeItem('mira_open_course');}else{sessionStorage.setItem('mira_open_course',String(id));location.href='dashboard.html';}
    }catch(e){window.miraClearPrivateContent();toast(e.message);if(window.MIRA_PAYMENTS_API&&/requiere una compra|Iniciá sesión/.test(e.message))begin({kind:'course',productId:String(id)});}
  };
  window.buildBuyBtn=c=>'<button class="btn-buy" onclick="event.stopPropagation();openViewer('+Number(c.id)+')">Ver acceso al curso</button>';
  window.renderEbooks=function(){
    const html=gEB().map(e=>'<article class="ebook-card"><div class="ebook-cover">'+(e.cover?'<img src="'+esc(e.cover)+'" alt="'+esc(e.title)+'" style="width:100%;height:100%;object-fit:contain">':'')+'</div><h3 class="ebook-title">'+esc(e.title)+'</h3><p class="ebook-desc">'+esc(e.desc)+'</p><p>'+esc(e.paid?e.price:'Gratis')+'</p><button class="btn-g" onclick="buyEbook(\''+esc(e.id)+'\')">'+(e.paid?'Ver compra / acceder':'Acceder')+'</button></article>').join('');
    ['ebook-grid','explorer-ebook-grid'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});
  };

  const slotRequests={};
  async function loadAvailableSlots(prefix){
    const grid=document.getElementById(prefix+'-slots-grid');if(!grid)return;
    const revision=(slotRequests[prefix]||0)+1;slotRequests[prefix]=revision;
    const date=document.getElementById(prefix+'-date')?.value;
    const services=[...(prefix==='ict'?(window._selServs||[]):_dashServs[prefix])];
    if(prefix==='ict')window._selSlot='';else _dashSlot[prefix]='';
    const selected=document.getElementById(prefix==='ict'?'ict-slot-selected':prefix+'-slot-sel');if(selected)selected.style.display='none';
    if(!date||!services.length){grid.textContent='Elegí los servicios y la fecha para ver los horarios.';return;}
    grid.textContent='Consultando horarios disponibles…';
    try{const result=await api('/availability',{date,services});if(slotRequests[prefix]!==revision)return;
      grid.replaceChildren();if(!result.times.length){grid.textContent='No hay horarios disponibles para esos servicios en esta fecha.';return;}
      result.times.forEach(time=>{const button=document.createElement('button');button.type='button';button.className='ict-slot';button.dataset.time=time;button.textContent=time;button.setAttribute('aria-pressed','false');
        button.onclick=()=>{if(slotRequests[prefix]!==revision)return;grid.querySelectorAll('button').forEach(b=>{b.classList.remove('sel');b.setAttribute('aria-pressed','false');});button.classList.add('sel');button.setAttribute('aria-pressed','true');if(prefix==='ict')window._selSlot=time;else _dashSlot[prefix]=time;if(selected){selected.style.display='';selected.textContent='Seleccionaste: '+time;}};
        grid.appendChild(button);
      });
    }catch(e){if(slotRequests[prefix]!==revision)return;grid.textContent=e.message;if(/Iniciá sesión/.test(e.message)){const login=document.createElement('a');login.className='btn-g';login.href='index.html?comprar=1';login.textContent='Iniciar sesión para reservar';grid.appendChild(login);}const retry=document.createElement('button');retry.type='button';retry.className='btn-g';retry.textContent='Consultar de nuevo';retry.onclick=()=>loadAvailableSlots(prefix);grid.appendChild(retry);}
  }
  window.icarLoadSlots=()=>loadAvailableSlots('ict');
  window.dashLoadSlots=prefix=>loadAvailableSlots(prefix);

  function draftBooking(prefix){
    const val=s=>document.getElementById(prefix+'-'+s)?.value.trim()||'';
    const services=prefix==='ict'?(window._selServs||[]):_dashServs[prefix];
    const time=prefix==='ict'?window._selSlot:_dashSlot[prefix];
    if(!services?.length||!val('name')||!val('tel')||!val('date')||!time){toast('Completá servicios, nombre, teléfono, fecha y horario');return;}
    begin({kind:'booking',services:[...services],date:val('date'),time,name:val('name'),tel:val('tel'),msg:val('msg')});
  }
  window.icarSaveTurno=()=>draftBooking('ict');window.saveTurno=()=>draftBooking('t');window.saveTurno2=()=>draftBooking('t2');
  window.loadTurnosCloud=async function(){
    try{const result=await api('/admin-bookings');localStorage.setItem('ms_turnos',JSON.stringify(result.items));
      let notice=document.getElementById('payments-agenda-environment');
      if(!notice){notice=document.createElement('p');notice.id='payments-agenda-environment';notice.setAttribute('role','status');const pane=document.getElementById('adm-turnos');pane?.prepend(notice);}
      notice.textContent=result.environment==='test'?'Agenda de prueba · Estas reservas no ocupan la agenda real.':'Agenda de producción';return true;
    }catch(e){localStorage.removeItem('ms_turnos');toast('No se pudo cargar la agenda: '+e.message);return false;}
  };
  window.changeTurnoStatus=async function(id,status,select){select.disabled=true;try{await api('/booking-status',{orderId:String(id),status});await loadTurnosCloud();admRenderTurnosList();toast(status==='cancelled'?'Turno cancelado. Revisá si corresponde devolver la seña.':'Estado guardado');}catch(e){toast(e.message);admRenderTurnosList();}finally{select.disabled=false;}};
  window.admDeleteTurno=async id=>{const t=gT().find(x=>String(x.id)===String(id));if(!t)return;toast('Para conservar el historial de pagos, cancelá el turno desde su estado.');};
  window.saveTurnoForm=()=>toast('Usá el formulario de reserva con selección de horario.');
  window.admSaveAtencion=async function(id){const field=document.getElementById('tnota-txt-'+id);if(!field)return;field.disabled=true;
    try{await api('/booking-note',{orderId:String(id),note:field.value.trim()});await loadTurnosCloud();toast('Nota de atención guardada');}
    catch(e){toast('No se guardó la nota: '+e.message);}finally{field.disabled=false;}
  };
  // Una reserva nunca se confirma desde el navegador ni antes del pago.
  window._turnoCloudSave=async()=>{throw new Error('Las reservas se confirman desde el servidor de cobros');};
  window.admGrantEbook=async(email,id)=>{await api('/grant',{email,kind:'ebook',productId:String(id),active:true});toast('Acceso autorizado en el servidor');};
  window.admRevokeEbook=async(email,id)=>{await api('/grant',{email,kind:'ebook',productId:String(id),active:false});toast('Acceso revocado en el servidor');};
  window.setPurchasedEbooks=()=>toast('Los accesos se acreditan desde el servidor.');
  const origGet=window._fsGet,origSet=window._fsSet;
  window._fsGet=async function(key){
    if(['courses','ebooks'].includes(key)&&firebase.auth().currentUser?.email==='estudiosmira@gmail.com'){
      try{return !window.MIRA_PAYMENTS_API&&window.miraDigitalAccess?await window.miraDigitalAccess.catalog(key):await api('/catalog?type='+key);}catch(e){toast('No se pudo cargar el catálogo privado: '+e.message);return null;}
    }return origGet(key);
  };
  let saves=Promise.resolve();
  window._fsSet=function(key,value){
    if(!['courses','ebooks'].includes(key))return origSet(key,value);
    const snapshot=JSON.parse(JSON.stringify(value));
    saves=saves.catch(()=>{}).then(()=>!window.MIRA_PAYMENTS_API&&window.miraDigitalAccess?window.miraDigitalAccess.save(key,snapshot):api('/catalog',{type:key,items:snapshot}));
    saves.then(()=>setSaveStatus('Contenido publicado',false),e=>setSaveStatus('No publicado: '+e.message,true));return saves;
  };
  window.miraSaveCatalog=async function(type,items){
    if(!['courses','ebooks'].includes(type))throw new Error('Catálogo inválido');
    const uid=firebase.auth().currentUser?.uid;
    if(!uid)throw new Error('Iniciá sesión para guardar');
    const snapshot=JSON.parse(JSON.stringify(items));
    await window._fsSet(type,snapshot);
    if(firebase.auth().currentUser?.uid!==uid)throw new Error('La sesión cambió. Volvé a abrir el editor.');
    window.miraCacheCatalog(type,snapshot);
  };
  function setSaveStatus(message,bad){let el=document.getElementById('payment-save-state');if(!el){el=document.createElement('p');el.id='payment-save-state';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:12px;left:12px;z-index:99999;padding:12px;background:#fff;color:#65001b;border:2px solid #65001b;max-width:90vw';document.body.append(el);}el.textContent=message;el.dataset.error=String(bad);}
  const origClear=window.clearUserLocalData;
  window.clearUserLocalData=function(){privateCatalog={uid:null,courses:null,ebooks:null};origClear?.();localStorage.removeItem('ms_courses');localStorage.removeItem('ms_ebooks');sessionStorage.removeItem('mira_checkout');};
  window.admRenderPayments=async function(){
    const box=document.getElementById('payments-editor');box.textContent='Cargando configuración…';
    try{
      const {settings,environment}=await api('/settings');const s=settings||{enabled:false,deposit:{mode:'percent',fixedCents:1000000,percent:30,holdMinutes:20},serviceMinutes:{}};
      const names=gSvcPage().cats.flatMap(c=>(c.items||[]).map(x=>({name:x.n,key:x.bookingKey||x.n}))); 
      box.innerHTML='<p>Ambiente: <strong>'+esc(environment==='live'?'Producción':'Pruebas')+'</strong>. Las claves privadas se administran en Firebase.</p><form id="payment-settings-form"><label><input id="pay-enabled" type="checkbox" '+(s.enabled?'checked':'')+'> Habilitar compras</label><div class="pay-fields"><label>Método de seña<select id="pay-mode"><option value="fixed" '+(s.deposit.mode==='fixed'?'selected':'')+'>Monto fijo por turno</option><option value="percent" '+(s.deposit.mode==='percent'?'selected':'')+'>Porcentaje del total</option></select></label><label>Monto fijo en pesos<input id="pay-fixed" type="number" min="0.01" step="0.01" required value="'+s.deposit.fixedCents/100+'"></label><label>Porcentaje<input id="pay-percent" type="number" min="0.01" max="100" step="0.01" required value="'+s.deposit.percent+'"></label><label>Tiempo para pagar (minutos)<input id="pay-hold" type="number" min="10" max="60" required value="'+s.deposit.holdMinutes+'"></label></div><p>Se guardan ambos valores. Se aplica el método seleccionado y nunca se cobra más que el total del turno.</p><label>Total de ejemplo en pesos<input id="pay-example" type="number" min="1" value="30000"></label><p id="pay-preview" role="status"></p><h3>Duración de cada servicio</h3><p>Incluí el tiempo de preparación. Sin duración, ese servicio no se puede reservar con seña.</p><div class="pay-fields">'+names.map(n=>'<label>'+esc(n.name)+'<input class="pay-duration" data-name="'+esc(n.key)+'" type="number" min="15" max="480" step="15" placeholder="Minutos" value="'+esc(s.serviceMinutes?.[n.key]??s.serviceMinutes?.[n.name]??'')+'"></label>').join('')+'</div><button class="abtn" type="submit">Guardar configuración</button><p id="pay-settings-status" role="status"></p></form><h3>Últimas compras y señas</h3><div id="pay-orders"></div>';
      const preview=()=>{const total=Math.round(Number(document.getElementById('pay-example').value)*100),fixed=Math.round(Number(document.getElementById('pay-fixed').value)*100),pct=Number(document.getElementById('pay-percent').value);const due=Math.min(total,document.getElementById('pay-mode').value==='fixed'?fixed:Math.max(1,Math.round(total*pct/100)));document.getElementById('pay-preview').textContent=Number.isFinite(due)&&due>0?'Seña: '+money(due)+' · Saldo: '+money(total-due):'Completá valores válidos.';};
      document.getElementById('payment-settings-form').addEventListener('input',preview);preview();
      document.getElementById('payment-settings-form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]'),msg=document.getElementById('pay-settings-status');btn.disabled=true;msg.textContent='Guardando…';try{const durations={};document.querySelectorAll('.pay-duration').forEach(x=>{if(x.value)durations[x.dataset.name]=Number(x.value);});await api('/settings',{enabled:document.getElementById('pay-enabled').checked,deposit:{mode:document.getElementById('pay-mode').value,fixedCents:Math.round(Number(document.getElementById('pay-fixed').value)*100),percent:Number(document.getElementById('pay-percent').value),holdMinutes:Number(document.getElementById('pay-hold').value)},serviceMinutes:durations});msg.textContent='Configuración guardada en el servidor.';}catch(err){msg.textContent=err.message;}finally{btn.disabled=false;}};
      const orders=await api('/admin-orders');document.getElementById('pay-orders').innerHTML=orderCards(orders,true);
      const notices=await api('/admin-notifications');
      const summary=document.createElement('section');summary.id='pay-notifications';
      const mailStatuses={queued:'Pendiente de envío',sending:'En proceso',sent:'Aceptado por Gmail',failed:'No enviado',review:'Requiere revisión'};
      summary.innerHTML='<h3>Avisos de reservas</h3><p>Los avisos pendientes requieren que el envío esté activado. Aceptado por Gmail no confirma que el mensaje haya llegado a la bandeja de entrada. Los casos en revisión deben comprobarse antes de reenviarlos.</p>'+(Array.isArray(notices)&&notices.length?notices.map(n=>'<article class="pay-order"><strong>'+esc(n.subject)+'</strong><p>'+esc(n.to)+' · '+esc(mailStatuses[n.status]||n.status)+'</p><p>'+esc(n.live?'Producción':'Prueba')+(n.deliveredTo?' · Destino del envío: '+esc(n.deliveredTo):'')+'</p></article>').join(''):'<p>Todavía no hay avisos.</p>');box.appendChild(summary);
    }catch(e){box.textContent=e.message;}
  };
  function orderCards(orders,admin=false){return orders.length?orders.map(o=>'<article class="pay-order"><strong>'+esc(o.title)+'</strong><p>'+esc(statuses[o.status]||o.status)+' · '+money(o.amountCents)+'</p>'+(o.kind==='booking'?'<p>Saldo: '+money(o.balanceCents)+' · '+esc(o.booking.date)+' '+esc(o.booking.time)+'</p>':'')+(admin?'<p><strong>'+esc(o.live===true?'Producción':o.live===false?'Prueba':'Ambiente sin identificar')+'</strong></p><p>'+esc(o.email)+' · '+esc(o.issue||'')+'</p>':'<a href="pagos.html?order='+encodeURIComponent(o.id)+'">Ver detalle</a>')+'</article>').join(''):'<p>Todavía no hay compras.</p>';}
  async function paymentPage(){
    const box=document.getElementById('payment-content');if(!box)return;
    let u;try{u=await user();}catch(e){const params=new URLSearchParams(location.search),order=params.get('order');sessionStorage.setItem('mira_checkout_return','pagos.html'+(order?'?order='+encodeURIComponent(order):params.has('historial')?'?historial=1':''));box.innerHTML='<p>'+esc(e.message)+'</p><a class="btn-g" href="index.html?comprar=1">Iniciar sesión o crear cuenta</a><p>Al iniciar sesión vas a volver a esta compra.</p>';return;}
    try{
      const orderId=new URLSearchParams(location.search).get('order');
      if(orderId){
        const o=await api('/order?id='+encodeURIComponent(orderId));
        box.innerHTML='<h2>'+esc(o.title)+'</h2><p role="status">'+esc(statuses[o.status]||o.status)+'</p><p>Importe: '+money(o.amountCents)+'</p>'+(o.kind==='booking'?'<p>Saldo en el estudio: '+money(o.balanceCents)+'</p>':'')+(o.status==='review'?'<p>El estudio debe revisar esta operación antes de confirmar el acceso o el horario. No vuelvas a pagar.</p>':'')+(o.checkoutUrl&&['created','pending'].includes(o.status)&&o.expiresAt>Date.now()?'<a class="btn-g" href="'+esc(o.checkoutUrl)+'">Continuar pago</a>':'')+'<button id="pay-refresh" class="btn-g">Actualizar estado</button><p><a href="pagos.html?historial=1">Mis compras</a> · <a href="dashboard.html">Ir al portal</a></p>';
        document.getElementById('pay-refresh').onclick=paymentPage;
        if(o.status==='approved'&&o.kind!=='booking'){const btn=document.createElement('button');btn.className='btn-g';btn.textContent='Acceder al producto';btn.onclick=()=>accessProduct(o.kind,o.productId,box);box.append(btn);}return;
      }
      let draft;try{draft=JSON.parse(sessionStorage.getItem('mira_checkout')||'null');}catch{}
      if(new URLSearchParams(location.search).has('historial')||!draft){const orders=await api('/orders');box.innerHTML='<h2>Mis compras y señas</h2>'+orderCards(orders)+(draft?'<a class="btn-g" href="pagos.html">Continuar selección</a>':'');return;}
      if(draft.kind!=='booking'){
        try{const product=await api('/access',{kind:draft.kind,productId:draft.productId});box.innerHTML='<h2>'+esc(product.title)+'</h2><p>Ya tenés acceso a este producto.</p><button class="btn-g" id="pay-access">Acceder</button>';document.getElementById('pay-access').onclick=()=>accessProduct(draft.kind,draft.productId,box);return;}catch{}
      }
      const q=await api('/quote',draft);box.innerHTML='<h2>'+esc(q.title)+'</h2><p>Total: '+money(q.totalCents)+'</p><p><strong>A pagar ahora: '+money(q.amountCents)+'</strong></p>'+(q.kind==='booking'?'<p>Saldo en el estudio: '+money(q.balanceCents)+'</p><p>'+esc(draft.date)+' · '+esc(draft.time)+'</p><p>El horario se reserva temporalmente al continuar. Se confirma cuando recibimos la aprobación del pago dentro de ese plazo.</p>':'')+'<button class="btn-g" id="pay-now">Pagar con Mercado Pago</button><p id="pay-message" role="status"></p>';
      document.getElementById('pay-now').onclick=async e=>{e.target.disabled=true;try{draft.requestId=draft.requestId||crypto.randomUUID();sessionStorage.setItem('mira_checkout',JSON.stringify(draft));const order=await api('/checkout',{...draft,acceptedAmountCents:q.amountCents,acceptedTotalCents:q.totalCents});location.href=order.checkoutUrl;}catch(err){document.getElementById('pay-message').textContent=err.message;e.target.disabled=false;}};
    }catch(e){box.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="btn-g" data-pay-retry>Volver a intentar</button>';box.querySelector('[data-pay-retry]').onclick=paymentPage;}
  }
  async function accessProduct(kind,id,box){try{const u=await user();const p=await api('/access',{kind,productId:String(id)});if(firebase.auth().currentUser?.uid!==u.uid)throw Error('La sesión cambió. Volvé a intentar.');if(kind==='course'){sessionStorage.setItem('mira_open_course',String(id));location.href='dashboard.html';return;}const url=p.downloadLink||p.link;const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error('Enlace de descarga no disponible');location.href=parsed.href;}catch(e){toast(e.message);}}
  document.addEventListener('DOMContentLoaded',()=>{
    const oldPage=window.admPage;if(oldPage)window.admPage=function(name){oldPage(name);if(name==='pagos')admRenderPayments();};
    if(document.getElementById('nav-salir')){const a=document.createElement('a');a.className='sb-item';a.href='pagos.html?historial=1';a.textContent='Mis compras y señas';document.getElementById('nav-salir').before(a);}
    if(new URLSearchParams(location.search).has('comprar')&&typeof openAuth==='function')openAuth('l');
    paymentPage();
    if(location.pathname.includes('dashboard')){const id=sessionStorage.getItem('mira_open_course');if(id)openViewer(Number(id));}
  });
})();
