/* Acceso manual sin Cloud Functions. La autoridad son las reglas de Firestore. */
(function(){
  'use strict';
  const adminEmail='estudiosmira@gmail.com',server={source:'server'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const auth=()=>firebase.auth(),db=()=>firebase.firestore();
  const isAdmin=u=>u?.email===adminEmail&&u.emailVerified===true;
  function session(admin=false){const u=auth().currentUser;if(!u)throw Error('Iniciá sesión para continuar');if(!u.emailVerified)throw Error('Verificá tu email para continuar');if(admin&&!isAdmin(u))throw Error('Acceso exclusivo de administración');return u;}
  function same(uid){if(auth().currentUser?.uid!==uid)throw Error('La sesión cambió. Volvé a intentar.');}
  function key(kind,id){if(!['course','ebook'].includes(kind)||!/^[a-zA-Z0-9_-]{1,128}$/.test(String(id)))throw Error('Producto inválido');return kind+'_'+id;}
  const ref=(collection,id)=>db().collection(collection).doc(id);
  function publicItem(p,type){const out={_public:true};for(const k of ['id','title','subtitle','description','desc','level','levelLabel','locked','color','coverImg','cover','emoji','price','paid'])if(p[k]!==undefined)out[k]=p[k];if(type==='courses')out.modules=(p.modules||[]).map(m=>({id:m.id,title:m.title,lessons:(m.lessons||[]).map(l=>({id:l.id,title:l.title,duration:l.duration}))}));return JSON.parse(JSON.stringify(out));}
  async function read(kind,id){
    const u=session();key(kind,id);
    let product;
    if(window.MIRA_PAYMENTS_API)product=await window.miraPayments.api('/access',{kind,productId:String(id)});
    else {
      let snap;
      try{snap=await ref('digitalContent',key(kind,id)).get(server);}catch(e){if(e.code==='permission-denied')throw Error('Este producto requiere una compra confirmada o autorización del estudio');throw Error('No se pudo verificar el acceso. Revisá tu conexión y volvé a intentar.');}
      if(!snap.exists)throw Error('Contenido todavía no disponible. Contactá al estudio.');
      product=snap.data().product;
    }
    same(u.uid);if(!product||product.locked)throw Error('Producto no disponible');return product;
  }
  async function catalog(type){
    if(!['courses','ebooks'].includes(type))throw Error('Catálogo inválido');
    const u=session(true),snap=await ref('privateCatalog',type).get(server);same(u.uid);
    if(!snap.exists)throw Error('Primero protegé el catálogo desde Alumnas → Accesos.');return snap.data().v;
  }
  function validate(items,kind){
    if(!Array.isArray(items)||items.length>150||new Blob([JSON.stringify(items)]).size>=800000)throw Error('Catálogo demasiado grande o inválido');
    const ids=new Set();for(const p of items){key(kind,p.id);if(p._public||ids.has(String(p.id)))throw Error('El catálogo privado no terminó de cargar o tiene IDs repetidos.');ids.add(String(p.id));}return ids;
  }
  function stage(batch,type,items,previous){
    const kind=type==='courses'?'course':'ebook',ids=validate(items,kind);
    batch.set(ref('privateCatalog',type),{v:items,t:Date.now()});
    batch.set(ref('site',type),{accessVersion:2,v:items.map(p=>publicItem(p,type)),t:Date.now()});
    for(const p of items)batch.set(ref('digitalContent',key(kind,p.id)),{kind,productId:String(p.id),product:p});
    for(const p of previous)if(!ids.has(String(p.id)))batch.delete(ref('digitalContent',key(kind,p.id)));
  }
  async function save(type,items){
    if(!['courses','ebooks'].includes(type))throw Error('Catálogo inválido');
    const u=session(true),old=await ref('privateCatalog',type).get(server);same(u.uid);
    if(!old.exists)throw Error('Primero protegé el catálogo desde Usuarios → Accesos.');
    const batch=db().batch();stage(batch,type,items,old.exists?old.data().v:[]);await batch.commit();same(u.uid);return {saved:true};
  }
  async function migrate(){
    const u=session(true),sources=[];
    // Leemos ambos antes de escribir; ninguna ficha pública sustituye clases privadas.
    for(const type of ['courses','ebooks']){
      const privateDoc=await ref('privateCatalog',type).get(server);
      const old=privateDoc.exists?privateDoc:await ref('site',type).get(server);
      const items=old.exists?old.data().v:[];
      validate(items,type==='courses'?'course':'ebook');sources.push({type,items});
    }
    same(u.uid);
    const batch=db().batch();for(const {type,items} of sources)stage(batch,type,items,items);
    await batch.commit();same(u.uid);for(const {type,items} of sources)window.miraCacheCatalog(type,items);return {saved:true};
  }
  async function grant(uid,kind,id,active){
    const u=session(true);if(typeof uid!=='string'||!uid||uid.includes('/')||typeof active!=='boolean')throw Error('Datos inválidos');
    const productKey=key(kind,id);
    if(active){const p=await ref('digitalContent',productKey).get(server);if(!p.exists)throw Error('Primero protegé el catálogo.');}
    same(u.uid);await ref('manualAccess/'+uid+'/products',productKey).set({kind,productId:String(id),active,source:'admin',grantedBy:u.uid,updatedAt:Date.now()});same(u.uid);
  }
  let rights={uid:null,items:[]};
  window.miraHasDigitalAccess=(kind,id)=>{const u=auth().currentUser;return !!u&&(isAdmin(u)||(rights.uid===u.uid&&rights.items.some(x=>x.kind===kind&&String(x.productId)===String(id))));};
  async function refresh(){
    const u=auth().currentUser;rights={uid:u?.uid||null,items:[]};if(!u?.emailVerified)return;
    try{
      const items=window.MIRA_PAYMENTS_API?await window.miraPayments.api('/my-access'):(await db().collection('manualAccess/'+u.uid+'/products').get(server)).docs.map(d=>d.data()).filter(d=>d.active===true);
      same(u.uid);rights={uid:u.uid,items};
      for(const name of ['updateDashStats','renderProgreso','renderEbooks'])if(typeof window[name]==='function')window[name]();
    }catch{ /* Fallo cerrado: ningún permiso se deduce de la caché. */ }
  }
  window.miraDigitalAccess={read,catalog,save,migrate,grant,refresh};
  const oldLesson=window.selLesson;
  let lessonRequest=0;
  if(oldLesson)window.selLesson=async function(flat){
    const request=++lessonRequest,id=currentCourseId;
    try{await read('course',String(id));if(request!==lessonRequest)return;oldLesson(flat);}
    catch(e){window.miraClearPrivateContent?.();toast(e.message);}
  };
  window.admRenderUsersList=async function(){
    const box=document.getElementById('adm-users-content');if(!box)return;
    box.innerHTML='<div class="acard"><h3>Accesos a cursos y ebooks</h3><p>El registro no habilita contenido. Autorizá cada producto después de confirmar el pago por tu cuenta, o cuando quieras otorgarlo.</p><p>Quitar una autorización manual no cancela una compra confirmada independiente.</p><button class="abtn" id="protect-catalog">Proteger / actualizar catálogo existente</button><p id="access-admin-status" role="status"></p></div><div id="access-user-list">Cargando alumnas…</div>';
    const status=box.querySelector('#access-admin-status');
    box.querySelector('#protect-catalog').onclick=async e=>{
      if(!confirm('Se conservarán las clases y archivos en el catálogo privado. Las fichas públicas quedarán sin enlaces de contenido. No se dará acceso automático a ninguna alumna. ¿Continuar?'))return;
      e.target.disabled=true;try{await migrate();status.textContent='Catálogo protegido. Ya podés dar accesos por alumna.';await renderUsers();}catch(err){status.textContent='No se completó: '+err.message;}finally{e.target.disabled=false;}
    };
    async function renderUsers(){
      const u=session(true),snap=await db().collection('users').get(server);same(u.uid);
      const holder=box.querySelector('#access-user-list');holder.replaceChildren();
      const products=[...gc().map(p=>({p,kind:'course'})),...gEB().map(p=>({p,kind:'ebook'}))];
      for(const doc of snap.docs){
        const person=doc.data(),manual=await db().collection('manualAccess/'+doc.id+'/products').get(server);same(u.uid);
        const enabled=new Set(manual.docs.filter(d=>d.data().active===true).map(d=>d.id));
        const card=document.createElement('section');card.className='acard';card.style.marginBottom='12px';
        card.innerHTML='<h3>'+esc(person.name||'Alumna')+'</h3><p>'+esc(person.email||doc.id)+'</p>';
        for(const {p,kind} of products){
          const k=key(kind,p.id),button=document.createElement('button');button.className='abtn';button.style.margin='4px';
          const label=()=>{button.textContent=(enabled.has(k)?'Quitar acceso manual · ':'Dar acceso · ')+(kind==='course'?'Curso: ':'Ebook: ')+(p.title||p.id);button.setAttribute('aria-pressed',String(enabled.has(k)));};label();
          button.onclick=async()=>{const active=!enabled.has(k);if(!active&&!confirm('¿Quitar esta autorización manual?'))return;button.disabled=true;
            try{await grant(doc.id,kind,p.id,active);if(active)enabled.add(k);else enabled.delete(k);label();status.textContent=active?'Acceso manual guardado.':'Autorización manual retirada.';}catch(e){status.textContent='No se guardó: '+e.message;}finally{button.disabled=false;}};
          card.appendChild(button);
        }holder.appendChild(card);
      }if(!snap.docs.length)holder.textContent='Todavía no hay alumnas registradas.';
    }
    try{await renderUsers();}catch(e){box.querySelector('#access-user-list').textContent='No se pudo cargar: '+e.message;}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    // Auth se inicializa en cada página; no usar datos de ms_session como permisos.
    setTimeout(()=>{try{let uid=auth().currentUser?.uid;auth().onAuthStateChanged(u=>{if(u?.uid!==uid){lessonRequest++;window.miraClearPrivateContent?.();uid=u?.uid;}refresh();});}catch{}},0);
  });
})();
