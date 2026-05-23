// ════════════════════════════════════════════════════════
// shared.js — Código compartido entre todas las páginas
// Mira Estudio
// ════════════════════════════════════════════════════════


// ═══ STORAGE KEYS ═══
const KU='ms_users',KS='ms_session',KC='ms_courses',KT='ms_turnos',KF='ms_faq',KI='ms_info',KFT='ms_features',KR='ms_recursos',KEB='ms_ebooks',KCF='ms_config',KES='ms_estetics',KBG='ms_herobg',KSL='ms_slots';

// ════════════ CLOUDINARY ════════════
const CLOUDINARY={cloudName:'da0xdmu7k',uploadPreset:'mira-estudio',uploadUrl:'https://api.cloudinary.com/v1_1/da0xdmu7k/image/upload'};
function uploadToCloudinary(file,folder='general',onProgress=null){
  return new Promise((resolve,reject)=>{
    if(!file)return reject(new Error('No se seleccionó archivo'));
    if(!file.type.startsWith('image/'))return reject(new Error('Solo se permiten imágenes'));
    if(file.size>10*1024*1024)return reject(new Error('La imagen es muy grande (máx 10MB)'));
    const fd=new FormData();fd.append('file',file);fd.append('upload_preset',CLOUDINARY.uploadPreset);fd.append('folder','mira-estudio/'+folder);
    const xhr=new XMLHttpRequest();xhr.open('POST',CLOUDINARY.uploadUrl,true);
    if(onProgress)xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{try{const r=JSON.parse(xhr.responseText);if(r.secure_url)resolve(r.secure_url);else reject(new Error(r.error?.message||'Error al subir'));}catch(e){reject(e);}};
    xhr.onerror=()=>reject(new Error('Error de red'));xhr.send(fd);
  });
}

// ════════════ FIREBASE ════════════
const FIREBASE_CONFIG={apiKey:'AIzaSyC-8ZrZjzooLkBFt-thbzRVbKpPd1nMj1E',authDomain:'mira-estudio.firebaseapp.com',projectId:'mira-estudio',storageBucket:'mira-estudio.firebasestorage.app',messagingSenderId:'1022892060353',appId:'1:1022892060353:web:a63091853b9a5921ae2e40'};
let _db=null,_auth=null,_fbReady=false,_fbUid=null;
function initFirebase(){
  if(typeof firebase==='undefined'){console.warn('Firebase SDK not loaded');return;}
  try{
    if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    _db=firebase.firestore();_auth=firebase.auth();_fbReady=true;
    const badge=document.getElementById('fb-status-badge');
    if(badge){badge.textContent='☁ online';badge.style.background='rgba(34,197,94,.2)';badge.style.color='#4ade80';}
    // Always sync site config (public read)
    _syncSiteFromCloud();
    _auth.onAuthStateChanged(user=>{
      if(user){_fbUid=user.uid;_syncSiteFromCloud();}
      else{_fbUid=null;}
    });
  }catch(e){console.warn('Firebase error:',e.message);}
}
async function _fsGet(key){if(!_fbReady||!_db)return null;try{const d=await _db.collection('site').doc(key).get();return d.exists?(d.data().v??null):null;}catch(e){return null;}}
async function _fsSet(key,value){if(!_fbReady||!_db)return;try{const s=JSON.stringify(value);if(s.length>900000)return;await _db.collection('site').doc(key).set({v:value,t:Date.now()});}catch(e){}}
async function _syncSiteFromCloud(){
  if(!_fbReady||!_db)return;
  const KEYS=[{ls:KC,fs:'courses'},{ls:KF,fs:'faq'},{ls:KI,fs:'info'},{ls:KFT,fs:'features'},{ls:KR,fs:'recursos'},{ls:KEB,fs:'ebooks'},{ls:KCF,fs:'config'},{ls:KES,fs:'estetics'},{ls:'ms_banner',fs:'banner'},{ls:'ms_social',fs:'social'},{ls:KSL,fs:'slots'},{ls:'ms_reviews',fs:'reviews_list'}];
  for(const {ls,fs} of KEYS){try{const v=await _fsGet(fs);if(v!==null){const lc=localStorage.getItem(ls);if(lc!==JSON.stringify(v)){localStorage.setItem(ls,JSON.stringify(v));}}}catch(e){}}
}
async function _saveUserProfile(uid,data){if(!_fbReady||!_db)return;try{await _db.collection('users').doc(uid).set(data,{merge:true});}catch(e){}}
async function _loadUserProfile(uid){if(!_fbReady||!_db)return null;try{const d=await _db.collection('users').doc(uid).get();return d.exists?d.data():null;}catch(e){return null;}}

// ═══ DEFAULT DATA ═══
const DEF_COURSES=[
  {id:0,emoji:'✨',title:'Extensiones Clásicas',subtitle:'La base perfecta',description:'Aprende desde cero la técnica 1:1. Colocación, aislamiento, adherencia y postservicio.',level:'principiante',levelLabel:'Principiante',color:'linear-gradient(135deg,#3D2B1F,#8B5E3C)',locked:false,modules:[
    {id:'m0',title:'Fundamentos y Seguridad',lessons:[
      {id:'l0',title:'Bienvenida y presentación',duration:'5 min',done:true,desc:'Conocé el programa completo del curso. Objetivos, materiales y metodología.',resources:[{icon:'📄',name:'Programa del curso',type:'PDF'}]},
      {id:'l1',title:'Anatomía del ojo y tipos de pestaña',duration:'14 min',done:true,desc:'Estructura del ojo y tipos de pestañas naturales para elegir extensiones correctas.',resources:[{icon:'📄',name:'Mapa anatómico',type:'PDF'}]},
      {id:'l2',title:'Higiene y contraindicaciones',duration:'18 min',done:false,desc:'Protocolos de higiene, contraindicaciones y manejo de alergias.',resources:[{icon:'📄',name:'Protocolo de higiene',type:'PDF'}]},
    ]},
    {id:'m1',title:'Materiales y Herramientas',lessons:[
      {id:'l3',title:'Guía de adhesivos',duration:'22 min',done:false,desc:'Cómo elegir el adhesivo correcto según humedad y temperatura.',resources:[{icon:'📄',name:'Tabla de adhesivos',type:'PDF'}]},
      {id:'l4',title:'Curvaturas, largos y grosores',duration:'16 min',done:false,desc:'Todas las curvaturas disponibles y cómo combinarlas.',resources:[{icon:'🖼',name:'Tabla de curvaturas',type:'Imagen'}]},
      {id:'l5',title:'Setup de camilla y ergonomía',duration:'12 min',done:false,desc:'Configura tu espacio de trabajo profesional y ergonómico.',resources:[]},
    ]},
    {id:'m2',title:'Técnica de Aplicación',lessons:[
      {id:'l6',title:'Preparación del cliente',duration:'20 min',done:false,desc:'Protocolo completo: limpieza, parches y posicionamiento.',resources:[{icon:'📄',name:'Checklist',type:'PDF'}]},
      {id:'l7',title:'Aislamiento de pestaña',duration:'25 min',done:false,desc:'Técnica de aislamiento perfecto con pinzas.',resources:[]},
      {id:'l8',title:'Aplicación 1:1 completa',duration:'35 min',done:false,desc:'Secuencia completa de aplicación clásica con cámara cenital.',resources:[{icon:'📄',name:'Guía 1:1',type:'PDF'}]},
    ]},
    {id:'m3',title:'Diseños y Postservicio',lessons:[
      {id:'l9',title:'Mapas de diseño',duration:'28 min',done:false,desc:'Cat eye, doll eye, natural. Cómo adaptar a la forma del ojo.',resources:[{icon:'🖼',name:'Catálogo de diseños',type:'Imagen'}]},
      {id:'l10',title:'Postservicio y retoque',duration:'20 min',done:false,desc:'Cuidados posteriores e instrucción al cliente.',resources:[{icon:'📄',name:'Tarjeta de cuidados',type:'PDF'}]},
    ]},
  ]},
  {id:1,emoji:'🌸',title:'Volumen Ruso',subtitle:'Mega volumen profesional',description:'Técnica de volumen ruso: abanicos 3D-10D, adhesivos de baja viscosidad y diseños de impacto.',level:'intermedio',levelLabel:'Intermedio',color:'linear-gradient(135deg,#3D0015,#8C0026)',locked:false,modules:[
    {id:'m0',title:'Fundamentos del Volumen',lessons:[
      {id:'l0',title:'Diferencias entre clásico y volumen',duration:'10 min',done:true,desc:'Diferencias técnicas y cuándo usar cada técnica.',resources:[]},
      {id:'l1',title:'Adhesivos de baja viscosidad',duration:'18 min',done:false,desc:'Adhesivos especiales: tiempo de trabajo, humedad y secado.',resources:[{icon:'📄',name:'Guía adhesivos volumen',type:'PDF'}]},
    ]},
    {id:'m1',title:'Construcción de Abanicos',lessons:[
      {id:'l2',title:'Abanico 2D y 3D desde la tira',duration:'30 min',done:false,desc:'Técnica de rodar, pellizcar y abrir con velocidad y consistencia.',resources:[]},
      {id:'l3',title:'Abanicos 4D a 6D',duration:'35 min',done:false,desc:'Control de apertura, peso y simetría de abanicos.',resources:[]},
      {id:'l4',title:'Mega volumen 8D y 10D',duration:'28 min',done:false,desc:'Mega abanicos con pestañas 0.05/0.03.',resources:[{icon:'📄',name:'Tabla peso-diámetro',type:'PDF'}]},
    ]},
  ]},
  {id:2,emoji:'💎',title:'Mega Volumen & Color',subtitle:'El servicio más premium',description:'Combina mega volumen con pestañas de colores. Rainbow lashes, ombre y efectos especiales.',level:'avanzado',levelLabel:'Avanzado',color:'linear-gradient(135deg,#2B1A0A,#9A7A2A)',locked:true,modules:[]},
  {id:3,emoji:'🌙',title:'Lifting & Laminado',subtitle:'El tratamiento más popular',description:'Lifting y laminado de pestañas propias. Rizado, nutrición y teñido profesional.',level:'principiante',levelLabel:'Principiante',color:'linear-gradient(135deg,#1B3D2D,#2E9E6E)',locked:true,modules:[]},
  {id:4,emoji:'✂️',title:'Remoción Segura',subtitle:'Protege la pestaña natural',description:'Técnicas de remoción completa y por zonas con mínimo daño.',level:'principiante',levelLabel:'Principiante',color:'linear-gradient(135deg,#3D1B1B,#9E2E2E)',locked:true,modules:[]},
  {id:5,emoji:'💼',title:'Negocio de Pestañas',subtitle:'Construye tu marca',description:'Monetiza tu servicio, fija precios, atrae clientes y llena tu agenda.',level:'intermedio',levelLabel:'Intermedio',color:'linear-gradient(135deg,#2B1A0A,#7A5A2A)',locked:true,modules:[]},
];
const DEF_FEATS=[
  {icon:'🎬',title:'Video HD paso a paso',desc:'Clases grabadas en alta resolución con cámara cenital para ver cada detalle.'},
  {icon:'📋',title:'Material descargable',desc:'Guías en PDF, tablas de referencia y listas de materiales recomendados.'},
  {icon:'💬',title:'Comunidad privada',desc:'Accedé al grupo exclusivo de alumnas para compartir trabajos y dudas.'},
  {icon:'🏆',title:'Certificado oficial',desc:'Al completar cada curso recibís tu certificado digital para tu portfolio.'},
  {icon:'📱',title:'Aprende a tu ritmo',desc:'Acceso ilimitado desde cualquier dispositivo, sin fecha de vencimiento.'},
  {icon:'🎯',title:'Actualizaciones incluidas',desc:'El curso se actualiza constantemente. Pagás una vez y tenés lo último.'},
];
const DEF_EBOOKS=[
  {id:0,emoji:'💅',title:'Guía de Adhesivos',desc:'Todo lo que necesitás saber sobre pegamentos, viscosidades y técnicas de curado.',price:'Gratis',paid:false,color:'#8C0026'},
  {id:1,emoji:'👁',title:'Diseño de Miradas',desc:'Mapas de diseño completos: cat eye, doll, fox eye y cómo adaptarlos a cada cliente.',price:'$4.990',paid:true,color:'#C9A84C'},
  {id:2,emoji:'📋',title:'Ficha de Cliente Pro',desc:'Kit completo de formularios: anamnesis, consentimiento, hoja de seguimiento y retoque.',price:'$2.990',paid:true,color:'#620018'},
  {id:3,emoji:'💼',title:'Pricing & Negocio',desc:'Cómo fijar precios, calcular costos y armar tu paquete de servicios rentable.',price:'$6.990',paid:true,color:'#3B000F'},
];
const DEF_RECURSOS=[
  {icon:'📄',name:'Guía de productos recomendados',type:'PDF · 2.4 MB'},
  {icon:'📄',name:'Tabla de diluciones de adhesivos',type:'PDF · 1.1 MB'},
  {icon:'🖼',name:'Catálogo de curvaturas y largos',type:'Imagen · 3.8 MB'},
  {icon:'📄',name:'Consentimiento informado cliente',type:'PDF editable · 0.8 MB'},
];
const DEF_FAQ=[
  {q:'¿Cuánto dura el acceso?',a:'El acceso es de por vida. Podés verlo cuantas veces quieras sin fecha de vencimiento.'},
  {q:'¿Necesito experiencia previa?',a:'No. Los cursos van desde cero y avanzan progresivamente.'},
  {q:'¿Incluye materiales físicos?',a:'Son 100% digitales. Recibirás guías PDF y recomendaciones de dónde comprar materiales.'},
  {q:'¿Hay certificado?',a:'Sí. Al completar cada curso recibirás un certificado digital con tu nombre.'},
  {q:'¿Puedo verlo desde el celular?',a:'Sí, la plataforma es 100% responsive. Celular, tablet o computadora.'},
];
const DEF_INFO='Mira Estudio es una academia de extensión de pestañas profesional.\n\nNuestras instructoras son certificadas con más de 5 años de experiencia. Trabajamos con las mejores técnicas del mercado.\n\n📍 Clases virtuales y presenciales disponibles\n📱 @miraestudio en Instagram\n✉️ hola@miraestudio.com';
const ADMIN_PASS_DEFAULT='Mira2025';

// ═══ GETTERS ═══
const gc=()=>{const d=localStorage.getItem(KC);return d?JSON.parse(d):DEF_COURSES.map(c=>({...c,modules:(c.modules||[]).map(m=>({...m,lessons:[...m.lessons]}))}))}
const sc=v=>{
  localStorage.setItem(KC,JSON.stringify(v));
  _fsSet('courses',v);
};
const gT=()=>JSON.parse(localStorage.getItem(KT)||'[]');
const sT=v=>{localStorage.setItem(KT,JSON.stringify(v));_fsSet('turnos_list',v);};
const gF=()=>{const d=localStorage.getItem(KF);return d?JSON.parse(d):[...DEF_FAQ];}
const sF=v=>{localStorage.setItem(KF,JSON.stringify(v));_fsSet('faq',v);};
const gFt=()=>{const d=localStorage.getItem(KFT);return d?JSON.parse(d):[...DEF_FEATS];}
const sFt=v=>{localStorage.setItem(KFT,JSON.stringify(v));_fsSet('features',v);};
const gR=()=>{const d=localStorage.getItem(KR);return d?JSON.parse(d):[...DEF_RECURSOS];}
const sR=v=>{localStorage.setItem(KR,JSON.stringify(v));_fsSet('recursos',v);};
const gEB=()=>{const d=localStorage.getItem(KEB);return d?JSON.parse(d):[...DEF_EBOOKS];}
const sEB=v=>{
  localStorage.setItem(KEB,JSON.stringify(v));
  _fsSet('ebooks',v);
};
const gU=()=>JSON.parse(localStorage.getItem(KU)||'[]');
const sU=v=>localStorage.setItem(KU,JSON.stringify(v));
const gCfg=()=>JSON.parse(localStorage.getItem(KCF)||'{}');
const sCfg=v=>{localStorage.setItem(KCF,JSON.stringify(v));_fsSet('config',v);};
const gBG=()=>JSON.parse(localStorage.getItem(KBG)||'{}');
const sBG=v=>localStorage.setItem(KBG,JSON.stringify(v));

// ═══ TOAST ═══
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ═══ MODAL ═══
function hovClick(e,id){if(e.target===document.getElementById(id))closeOv(id);}
function closeOv(id){document.getElementById(id).classList.remove('open');}
function openOv(id){document.getElementById(id).classList.add('open');}

// ═══ LOGO CLICK → ADMIN ═══
let lcc=0,lct=null;
function handleLogoClick(){
  lcc++;
  if(lct)clearTimeout(lct);
  lct=setTimeout(()=>{lcc=0;},3000); // 3 seconds window
  if(lcc>=5){
    lcc=0;
    document.getElementById('admin-key').value='';
    document.getElementById('admin-key-err').style.display='none';
    openOv('admin-ov');
    setTimeout(()=>{const i=document.getElementById('admin-key');if(i)i.focus();},150);
  }
}
function checkKey(){
  const cfg=gCfg();const pw=cfg.adminPass||ADMIN_PASS_DEFAULT;
  if(document.getElementById('admin-key').value===pw){
    closeOv('admin-ov');
    currentUser={name:'Administrador',email:'admin@mirastudio.com',role:'admin'};
    localStorage.setItem(KS,JSON.stringify(currentUser));
    showView('admin');window.loadAdminData&&loadAdminData();
  }else{document.getElementById('admin-key-err').style.display='';}
}

// Alternative: open admin panel from URL ?admin=1
function checkUrlAdmin(){
  const params=new URLSearchParams(window.location.search);
  if(params.has('admin')){
    // Remove ?admin=1 from URL without reload
    const clean=window.location.pathname;
    history.replaceState(null,'',clean);
    // Open immediately
    document.getElementById('admin-key').value='';
    document.getElementById('admin-key-err').style.display='none';
    openOv('admin-ov');
    setTimeout(()=>{
      const inp=document.getElementById('admin-key');
      if(inp) inp.focus();
    },200);
    return true;
  }
  return false;
}

// ═══ AUTH ═══
let currentUser=null,currentCourseId=0,lessonFlat=[],lessonIdx=0,fabOpen=false;

function openAuth(t){openOv('auth-ov');switchTab(t);hideErr();}
function switchTab(t){
  document.getElementById('form-l').style.display=t==='l'?'':'none';
  document.getElementById('form-r').style.display=t==='r'?'':'none';
  document.getElementById('tab-l').className='auth-tab'+(t==='l'?' active':'');
  document.getElementById('tab-r').className='auth-tab'+(t==='r'?' active':'');
  hideErr();
}
function showErr(m){const e=document.getElementById('auth-err');e.textContent=m;e.style.display='';}
function hideErr(){document.getElementById('auth-err').style.display='none';}
function showFieldErr(fid,msg){const fg=document.getElementById(fid);if(!fg)return;fg.classList.add('fg-error');const s=fg.querySelector('.field-err-msg');if(s){s.textContent=msg;s.style.display='block';}}
function clearFieldErr(fid){const fg=document.getElementById(fid);if(!fg)return;fg.classList.remove('fg-error');const s=fg.querySelector('.field-err-msg');if(s){s.textContent='';s.style.display='none';}hideErr();}
function clearAllFieldErrs(){document.querySelectorAll('.fg-error').forEach(el=>{el.classList.remove('fg-error');const s=el.querySelector('.field-err-msg');if(s){s.textContent='';s.style.display='none';}});hideErr();}

function doLogin(){
  clearAllFieldErrs();
  const em=document.getElementById('li-email').value.trim();
  const pw=document.getElementById('li-pass').value;
  if(!em){showFieldErr('fg-li-email','Ingresá tu email');return;}
  if(!pw){showFieldErr('fg-li-pass','Ingresá tu contraseña');return;}
  if(_fbReady&&_auth){
    _auth.signInWithEmailAndPassword(em,pw).then(cred=>{
      const fu=cred.user;
      if(!fu.emailVerified){_auth.signOut();showErr('⚠️ Verificá tu email antes de iniciar sesión.');return;}
      _fbUid=fu.uid;
      _loadUserProfile(fu.uid).then(profile=>{
        const u=profile||{name:fu.displayName||'Alumna',email:fu.email,role:'student'};u.uid=fu.uid;loginOk(u);
      });
    }).catch(err=>{
      const msg=err.code==='auth/wrong-password'||err.code==='auth/user-not-found'||err.code==='auth/invalid-credential'?'Email o contraseña incorrectos.':err.code==='auth/too-many-requests'?'Demasiados intentos. Esperá unos minutos.':'Error al iniciar sesión.';
      showFieldErr('fg-li-email',msg);showFieldErr('fg-li-pass',msg);showErr(msg);
    });
  }else{
    const u=gU().find(x=>x.email===em&&x.pass===pw);
    if(!u){showFieldErr('fg-li-email','Email o contraseña incorrectos');showErr('No encontramos una cuenta con esos datos.');return;}
    loginOk(u);
  }
}
function doRegister(){
  clearAllFieldErrs();
  const nm=document.getElementById('rg-name').value.trim();
  const em=document.getElementById('rg-email').value.trim();
  const pw=document.getElementById('rg-pass').value;
  if(!nm){showFieldErr('fg-rg-name','Ingresá tu nombre');return;}
  if(!em){showFieldErr('fg-rg-email','Ingresá tu email');return;}
  if(!pw||pw.length<6){showFieldErr('fg-rg-pass','Mínimo 6 caracteres');return;}
  if(_fbReady&&_auth){
    _auth.createUserWithEmailAndPassword(em,pw).then(cred=>{
      const fu=cred.user;_fbUid=fu.uid;
      fu.updateProfile({displayName:nm});
      const u={name:nm,email:em,uid:fu.uid,role:'student'};
      _saveUserProfile(fu.uid,u);
      fu.sendEmailVerification().then(()=>{_auth.signOut();_fbUid=null;closeOv('auth-ov');showVerifyBanner(em);}).catch(()=>loginOk(u));
    }).catch(err=>{
      const msg=err.code==='auth/email-already-in-use'?'Ya existe una cuenta con ese email':err.code==='auth/weak-password'?'Contraseña muy débil':'Error al crear la cuenta.';
      showFieldErr('fg-rg-email',msg);showErr(msg);
    });
  }else{
    const users=gU();
    if(users.find(x=>x.email===em)){showFieldErr('fg-rg-email','Ya existe una cuenta con ese email');return;}
    const u={name:nm,email:em,pass:pw};users.push(u);sU(users);loginOk(u);
  }
}
function demoLogin(){loginOk({name:'Valentina López',email:'demo@mirastudio.com',pass:'demo123'});}
function loginOk(u){
  currentUser=u;localStorage.setItem(KS,JSON.stringify(u));
  closeOv('auth-ov');setupDash(u);showView('dashboard');
  document.getElementById('fab-wrap').style.display='';
  // Load purchased ebooks from Firestore
  if(typeof loadUserPurchases==='function') loadUserPurchases();
}
function doLogout(){
  currentUser=null;localStorage.removeItem(KS);
  document.getElementById('fab-wrap').style.display='none';
  showView('landing');
}
function checkSession(){
  const s=localStorage.getItem(KS);
  if(s){
    currentUser=JSON.parse(s);
    if(currentUser.role==='admin'){showView('admin');window.loadAdminData&&loadAdminData();}
    else{setupDash(currentUser);showView('dashboard');document.getElementById('fab-wrap').style.display='';}
  }
}

// ═══ VIEWS ═══
function showView(n){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('view-'+n).classList.add('active');window.scrollTo(0,0);}

// ═══ HERO BG ═══
function applyHeroBg(){
  const bg=gBG();const media=document.getElementById('hero-media');
  if(!media)return;
  const def=document.getElementById('hero-default-bg');
  // remove old dynamic media
  media.querySelectorAll('img.dyn,video.dyn').forEach(el=>el.remove());
  if(bg.type==='image'&&bg.data){
    if(def)def.style.display='none';
    const img=document.createElement('img');img.src=bg.data;img.className='dyn';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    media.insertBefore(img,media.firstChild);
  }else if(bg.type==='video'&&bg.data){
    if(def)def.style.display='none';
    const vid=document.createElement('video');vid.src=bg.data;vid.className='dyn';vid.autoplay=true;vid.loop=true;vid.muted=true;vid.playsInline=true;
    vid.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    media.insertBefore(vid,media.firstChild);
  }else{if(def)def.style.display='';}
}

// ═══ LANDING RENDER ═══
function renderLanding(){
  if(typeof renderIcarousel==="function")renderIcarousel();
  // features
  const feats=gFt();
  const fg=document.getElementById('feat-grid');
  if(fg)fg.innerHTML=feats.map(f=>`<div class="feat-card"><div class="feat-icon">${f.icon}</div><h3>${f.title}</h3><p>${f.desc}</p></div>`).join('');
  // landing courses
  const lc=document.getElementById('landing-courses-grid');
  if(lc){
    const list=gc().filter(c=>!c.locked).slice(0,3);
    lc.innerHTML=list.map(c=>{
      const tot=(c.modules||[]).reduce((a,m)=>a+m.lessons.length,0);
      const isFree=!c.price||c.price===''||c.price==='Gratis'||c.price==='0';
      const priceLbl=isFree?'Gratis':c.price;
      const thumbInner=c.coverImg?`<img src="${c.coverImg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--r3) var(--r3) 0 0;"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(26,0,8,.6),transparent);"></div><span style="position:relative;z-index:1;font-size:46px;">${c.emoji}</span>`:c.emoji;
      return`<div class="cpc" onclick="openAuth('r')"><div class="cpc-thumb" style="background:${c.coverImg?'transparent':c.color};">${thumbInner}<span style="position:absolute;top:8px;right:8px;background:${isFree?'linear-gradient(135deg,#1a7a3a,#25a85a)':'linear-gradient(135deg,#B8860B,#DAA520)'};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:50px;">${priceLbl}</span></div><div class="cpc-body"><span class="cpc-tag">${c.levelLabel}</span><div class="cpc-title">${c.title}</div><p class="cpc-desc">${c.description}</p><div class="cpc-meta">📹 ${tot} clases</div></div></div>`;
    }).join('');
  }
}

// ═══ DASHBOARD ═══


// ── NAVIGATION HELPERS ──────────────────────────────────
function goTo(page){
  window.location.href = page;
}
