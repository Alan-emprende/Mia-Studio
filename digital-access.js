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
  function repaint(){for(const name of ['renderCarouselCourses','renderEbooks','updateDashStats']){try{window[name]?.();}catch{}}}
  async function ensureProfile(u){
    if(isAdmin(u))return;
    const profile=ref('users',u.uid),snap=await profile.get(server);same(u.uid);
    if(!snap.exists){await profile.set({uid:u.uid,name:u.displayName||'Alumna',email:u.email,role:'student'});same(u.uid);}
  }
  window.miraHasDigitalAccess=(kind,id)=>{const u=auth().currentUser;return !!u&&(isAdmin(u)||(rights.uid===u.uid&&rights.items.some(x=>x.kind===kind&&String(x.productId)===String(id))));};
  async function refresh(){
    const u=auth().currentUser;rights={uid:u?.uid||null,items:[]};if(!u?.emailVerified)return;
    try{
      await ensureProfile(u);
      if(!isAdmin(u)){
        const catalogs=await Promise.all(['courses','ebooks'].map(async type=>{
          const snap=await ref('site',type).get(server);
          if(!snap.exists||snap.data().accessVersion!==2)throw Error('El catálogo todavía no está disponible. Contactá al estudio.');
          return {type,items:snap.data().v.map(p=>publicItem(p,type))};
        }));
        same(u.uid);for(const {type,items} of catalogs)window.miraCacheCatalog(type,items);
        repaint();
      }
      const items=window.MIRA_PAYMENTS_API?await window.miraPayments.api('/my-access'):(await db().collection('manualAccess/'+u.uid+'/products').get(server)).docs.map(d=>d.data()).filter(d=>d.active===true);
      same(u.uid);rights={uid:u.uid,items};
      repaint();document.getElementById('digital-load-status')?.remove();
    }catch(e){
      if(auth().currentUser?.uid!==u.uid)return;
      const host=document.getElementById('view-dashboard');if(host){let status=document.getElementById('digital-load-status');if(!status){status=document.createElement('div');status.id='digital-load-status';status.className='acard';status.setAttribute('role','status');host.prepend(status);}status.replaceChildren();const text=document.createElement('p');text.textContent='No pudimos cargar tus productos: '+e.message;const retry=document.createElement('button');retry.className='btn-g';retry.textContent='Volver a cargar';retry.onclick=()=>refresh();status.append(text,retry);}
    }
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
    box.innerHTML='<div class="acard"><h3>Alumnas y accesos</h3><p>Buscá una alumna y seleccioná los cursos o ebooks que querés habilitar.</p><div class="access-toolbar"><label for="access-search">Buscar por nombre o email<input type="search" id="access-search" placeholder="Escribí un nombre o email" autocomplete="off"></label><button class="abtn" id="access-refresh">Actualizar lista</button></div><p id="access-admin-status" role="status"></p><details><summary>Mantenimiento del catálogo</summary><p>Solo usá esta opción para separar un catálogo antiguo. No hace falta repetirla para dar accesos.</p><button class="abtn" id="protect-catalog">Proteger / actualizar catálogo existente</button></details></div><div class="access-layout"><section class="acard"><h3>Alumnas registradas</h3><p id="access-count" role="status"></p><div id="access-user-list">Cargando alumnas…</div><div class="access-pagination"><button class="abtn" id="access-prev">Anterior</button><span id="access-page"></span><button class="abtn" id="access-next">Siguiente</button></div></section><section class="acard" id="access-detail"><h3>Seleccioná una alumna</h3><p>Acá vas a ver sus accesos, separados en cursos y ebooks.</p></section></div>';
    const status=box.querySelector('#access-admin-status');
    let users=[],page=0,selected=null,revision=0;
    const search=box.querySelector('#access-search'),holder=box.querySelector('#access-user-list'),detail=box.querySelector('#access-detail');
    const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function renderList(){
      const q=normalized(search.value.trim()),filtered=users.filter(u=>normalized(u.name+' '+u.email).includes(q));
      page=Math.min(page,Math.max(0,Math.ceil(filtered.length/10)-1));holder.replaceChildren();
      for(const person of filtered.slice(page*10,page*10+10)){
        const button=document.createElement('button');button.type='button';button.className='access-person';button.dataset.uid=person.uid;button.setAttribute('aria-pressed',String(selected===person.uid));
        button.innerHTML='<strong>'+esc(person.name||'Alumna')+'</strong><span>'+esc(person.email||person.uid)+'</span>';
        button.onclick=()=>selectPerson(person);holder.appendChild(button);
      }
      if(!filtered.length)holder.textContent=q?'No hay alumnas que coincidan con la búsqueda.':'Todavía no hay perfiles registrados. Si la cuenta se creó antes de esta corrección, pedile que vuelva a iniciar sesión.';
      box.querySelector('#access-count').textContent=filtered.length+' de '+users.length+' alumnas';
      box.querySelector('#access-page').textContent='Página '+(page+1)+' de '+Math.max(1,Math.ceil(filtered.length/10));
      box.querySelector('#access-prev').disabled=page===0;box.querySelector('#access-next').disabled=(page+1)*10>=filtered.length;
    }
    search.oninput=()=>{page=0;renderList();};
    box.querySelector('#access-prev').onclick=()=>{page--;renderList();};box.querySelector('#access-next').onclick=()=>{page++;renderList();};
    box.querySelector('#access-refresh').onclick=async()=>{try{await renderUsers();status.textContent='Lista actualizada.';}catch(e){status.textContent='No se pudo actualizar: '+e.message;}};
    box.querySelector('#protect-catalog').onclick=async e=>{
      if(!confirm('Se conservarán las clases y archivos en el catálogo privado. Las fichas públicas quedarán sin enlaces de contenido. No se dará acceso automático a ninguna alumna. ¿Continuar?'))return;
      e.target.disabled=true;try{await migrate();status.textContent='Catálogo protegido. Ya podés dar accesos por alumna.';await renderUsers();}catch(err){status.textContent='No se completó: '+err.message;}finally{e.target.disabled=false;}
    };
    async function renderUsers(){
      const u=session(true),snap=await db().collection('users').get(server);same(u.uid);
      users=snap.docs.map(d=>({...d.data(),uid:d.id})).sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email),'es'));
      renderList();if(selected){const person=users.find(p=>p.uid===selected);if(person)await selectPerson(person);}
    }
    async function selectPerson(person){
      const version=++revision;selected=person.uid;renderList();detail.textContent='Cargando accesos…';
      try{const u=session(true),manual=await db().collection('manualAccess/'+person.uid+'/products').get(server);same(u.uid);if(version!==revision||!box.contains(detail))return;
        const enabled=new Set(manual.docs.filter(d=>d.data().active===true).map(d=>d.id));
        detail.innerHTML='<h3>'+esc(person.name||'Alumna')+'</h3><p>'+esc(person.email||person.uid)+'</p><p>Quitar un permiso manual no cancela una compra confirmada independiente.</p>';
        for(const [kind,title,products] of [['course','Cursos',gc()],['ebook','Ebooks',gEB()]]){
          const group=document.createElement('section');group.className='access-products';const heading=document.createElement('h4');heading.textContent=title;group.appendChild(heading);
          if(!products.length){const empty=document.createElement('p');empty.textContent='No hay productos cargados.';group.appendChild(empty);}
          for(const p of products){
          const k=key(kind,p.id),button=document.createElement('button');button.className='abtn';button.style.margin='4px';
          const label=()=>{button.textContent=(enabled.has(k)?'Quitar acceso manual · ':'Dar acceso · ')+(kind==='course'?'Curso: ':'Ebook: ')+(p.title||p.id);button.setAttribute('aria-pressed',String(enabled.has(k)));};label();
          button.onclick=async()=>{const active=!enabled.has(k);if(!active&&!confirm('¿Quitar esta autorización manual?'))return;button.disabled=true;
            try{await grant(person.uid,kind,p.id,active);if(active)enabled.add(k);else enabled.delete(k);label();status.textContent=active?'Acceso manual guardado.':'Autorización manual retirada.';}catch(e){status.textContent='No se guardó: '+e.message;}finally{button.disabled=false;}};
          group.appendChild(button);
        }detail.appendChild(group);}
      }catch(e){if(version===revision)detail.textContent='No se pudieron cargar los accesos: '+e.message;}
    }
    try{await renderUsers();}catch(e){box.querySelector('#access-user-list').textContent='No se pudo cargar: '+e.message;}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    // Auth se inicializa en cada página; no usar datos de ms_session como permisos.
    setTimeout(()=>{try{let uid=auth().currentUser?.uid;auth().onAuthStateChanged(u=>{if(u?.uid!==uid){lessonRequest++;window.miraClearPrivateContent?.();uid=u?.uid;}refresh();});}catch{}},0);
  });
})();
