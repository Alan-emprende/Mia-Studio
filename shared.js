// ════════════════════════════════════════════════════════
// shared.js — Todo el JavaScript de Mira Estudio
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
function setupDash(u){
  const ini=u.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  ['uav','pav'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ini;});
  document.getElementById('uname').textContent=u.name;
  document.getElementById('wname').textContent=u.name.split(' ')[0];
  ['pname','pname'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=u.name;});
  const pe=document.getElementById('pemail');if(pe)pe.textContent=u.email;
  document.getElementById('sb-badge').textContent=gc().filter(c=>!c.locked).length;
  renderCarouselCourses();renderEbooks();renderResources();
  updateDashStats();
}

function showPage(p){
  ['home','explorar','progreso','comunidad','recursos','perfil'].forEach(pg=>{
    const el=document.getElementById('page-'+pg);if(el)el.style.display=pg===p?'':'none';
  });
  document.querySelectorAll('.sb-item').forEach(n=>n.classList.remove('active'));
  const ni=document.getElementById('nav-'+p);if(ni)ni.classList.add('active');
  const titles={home:'Inicio',explorar:'Explorar',progreso:'Mi Progreso',comunidad:'Comunidad',recursos:'Recursos',perfil:'Mi Perfil'};
  document.getElementById('tb-title').textContent=titles[p]||p;
  if(p==='progreso'||p==='home')updateDashStats();
  if(window.innerWidth<=768)document.getElementById('main-sidebar').classList.remove('open');
  if(window.innerWidth<=768&&typeof closeSidebar==='function')closeSidebar();
}
function toggleSidebar(){
  const sb=document.getElementById('main-sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(!sb)return;
  sb.classList.toggle('open');
  if(ov) ov.classList.toggle('active', sb.classList.contains('open'));
  document.body.style.overflow=sb.classList.contains('open')&&window.innerWidth<=768?'hidden':'';
}
function closeSidebar(){
  const sb=document.getElementById('main-sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb)sb.classList.remove('open');
  if(ov)ov.classList.remove('active');
  document.body.style.overflow='';
}
function switchExplorer(tab){
  ['cursos','ebooks','turnos'].forEach(t=>{
    const btn=document.getElementById('etab-'+t);if(btn)btn.className='car-tab'+(t===tab?' active':'');
    const panel=document.getElementById('explorer-'+t);if(panel)panel.style.display=t===tab?'':'none';
  });
}

// ═══ COURSE RENDERS ═══
function buildCourseThumb(c){
  if(c.coverImg) return `<img class="cct-img" src="${c.coverImg}" alt="${c.title}"><div class="cct-overlay"></div><span class="cct-emoji-over">${c.emoji}</span>`;
  return `<div class="cctbg" style="background:${c.color||'linear-gradient(135deg,#3D0015,#8C0026)'}"></div><span class="ccte">${c.emoji}</span>`;
}
function buildPriceBadge(c){
  if(!c.price||c.price==='0'||c.price===''||c.price==='Gratis') return '<span class="cct-price-badge cct-free-badge">Gratis</span>';
  return `<span class="cct-price-badge">${c.price}</span>`;
}
function buildBuyBtn(c){
  const isFree=!c.price||c.price==='0'||c.price===''||c.price==='Gratis';
  if(isFree) return `<button class="btn-buy btn-buy-free" onclick="event.stopPropagation();openViewer(${c.id})">▶ Comenzar gratis</button>`;
  if(c.payLink) return `<button class="btn-buy" onclick="event.stopPropagation();buyCourse(${c.id})">🛒 Comprar ${c.price}</button>`;
  return `<button class="btn-buy" onclick="event.stopPropagation();openViewer(${c.id})">🛒 Comprar ${c.price}</button>`;
}
function renderCarouselCourses(filt='todos', q=''){
  const all=gc();let list=filt==='todos'?all:all.filter(c=>c.level===filt);
  if(q){const ql=q.toLowerCase();list=list.filter(c=>(c.title+' '+(c.description||'')).toLowerCase().includes(ql));}
  const lvlC={principiante:'lvl-b',intermedio:'lvl-i',avanzado:'lvl-a'};
  const html=list.map(c=>{
    const tot=(c.modules||[]).reduce((a,m)=>a+m.lessons.length,0);
    const thumb=buildCourseThumb(c);
    const priceBadge=buildPriceBadge(c);
    if(c.locked)return`<div class="course-card clocked"><div class="cct">${thumb}${priceBadge}</div><div class="ccc"><div class="cch"><div class="ccn">${c.title}</div><span class="clvl ${lvlC[c.level]||'lvl-b'}">${c.levelLabel}</span></div><p class="ccd">${c.description}</p><div class="ccf"><div class="cmi">📹 ${tot||'?'} clases</div><div class="lckbdg">🔒 Próximamente</div></div></div></div>`;
    const buyBtn=buildBuyBtn(c);
    return`<div class="course-card" onclick="openViewer(${c.id})"><div class="cct">${thumb}${priceBadge}</div><div class="ccc"><div class="cch"><div class="ccn">${c.title}</div><span class="clvl ${lvlC[c.level]||'lvl-b'}">${c.levelLabel}</span></div><p class="ccd">${c.description}</p><div class="ccf"><div class="cmi">📹 ${tot} clases &nbsp;📋 ${(c.modules||[]).length} módulos</div>${buyBtn}</div></div></div>`;
  }).join('');
  const el1=document.getElementById('carousel-courses-list');if(el1)el1.innerHTML=html;
  const el2=document.getElementById('explorer-courses-list');if(el2)el2.innerHTML=html;
}
function filterCar(lv,btn){renderCarouselCourses(lv);}

// ═══ EBOOKS ═══
function renderEbooks(){
  const ebs=gEB();
  const cards=ebs.map(e=>{
    const cover=e.cover?`<img src="${e.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`:`<span>${e.emoji||'📕'}</span>`;
    const price=e.paid?(e.price||'De pago'):'Gratis';
    const isPurchased=!e.paid||hasEbook(e.id);
    let btn;
    const dlLink = e.downloadLink || e.link || '';
    const pyLink = e.payLink || e.link || '';
    if(!e.paid){
      // Free ebook → show download link
      btn=dlLink
        ?`<a href="${dlLink}" target="_blank" rel="noopener" class="btn-crimson" style="margin-top:10px;width:100%;padding:9px;font-size:13px;display:block;text-align:center;text-decoration:none;border-radius:50px;">⬇ Descargar gratis</a>`
        :`<button class="btn-g" style="margin-top:10px;width:100%;padding:9px;font-size:13px;opacity:.5;cursor:default;" disabled>Próximamente</button>`;
    } else if(isPurchased){
      // Paid + already purchased → show download link
      btn=dlLink
        ?`<a href="${dlLink}" target="_blank" rel="noopener" class="btn-crimson" style="margin-top:10px;width:100%;padding:9px;font-size:13px;display:block;text-align:center;text-decoration:none;border-radius:50px;">✅ Ver / Descargar</a>`
        :`<button class="btn-g" style="margin-top:10px;width:100%;padding:9px;font-size:13px;opacity:.5;cursor:default;" disabled>Sin link de descarga</button>`;
    } else {
      // Paid + not yet purchased → show payment link
      btn=pyLink
        ?`<button onclick="buyEbook('${e.id}')" style="margin-top:10px;width:100%;padding:9px;font-size:13px;display:block;text-align:center;border:none;border-radius:50px;background:linear-gradient(135deg,#B8860B,#DAA520);color:#fff;cursor:pointer;font-family:var(--fb);">🛒 Comprar ${price}</button>`
        :`<button class="btn-g" style="margin-top:10px;width:100%;padding:9px;font-size:13px;opacity:.5;cursor:default;" disabled>Próximamente</button>`;
    }
    const lockBadge=e.paid&&!isPurchased?`<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);border-radius:50px;padding:3px 8px;font-size:11px;color:#fff;">🔒 Pago</div>`:'';
    return`<div class="ebook-card" style="position:relative;"><div class="ebook-cover" style="background:${e.color||'#8C0026'};">${cover}</div>${lockBadge}<div class="ebook-title">${e.title}</div><p class="ebook-desc">${e.desc}</p><div class="ebook-price ${e.paid&&!isPurchased?'':'ebook-free'}">${price}</div>${btn}</div>`;
  }).join('');
  const el1=document.getElementById('ebook-grid');if(el1)el1.innerHTML=cards;
  const el2=document.getElementById('explorer-ebook-grid');if(el2)el2.innerHTML=cards;
}

// ═══ RECURSOS ═══
function renderResources(){
  const recs=gR();
  const html=recs.map(r=>`<div class="ritem"><div class="rico">${r.icon}</div><div><div class="rname">${r.name}</div><div class="rtype">${r.type}</div></div></div>`).join('');
  const el=document.getElementById('rlist');if(el)el.innerHTML=html;
}

// ═══ TURNO ═══
function setTurnoService(s){document.getElementById('t-serv').value=s;}
function setTurnoService2(s){document.getElementById('t2-serv').value=s;}
function saveTurnoForm(nameId,telId,servId,dateId,msgId){
  const name=document.getElementById(nameId).value.trim(),tel=document.getElementById(telId).value.trim();
  if(!name||!tel){toast('⚠️ Nombre y teléfono son requeridos');return false;}
  const t=gT();
  t.push({id:Date.now(),name,tel,serv:document.getElementById(servId).value,date:document.getElementById(dateId).value,msg:document.getElementById(msgId).value.trim(),ts:new Date().toLocaleDateString('es-AR')});
  sT(t);
  [nameId,telId,dateId,msgId].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast('✅ Solicitud enviada. Te contactamos pronto!');return true;
}
function saveTurno(){saveTurnoForm('t-name','t-tel','t-serv','t-date','t-msg');}
function saveTurno2(){saveTurnoForm('t2-name','t2-tel','t2-serv','t2-date','t2-msg');}

// ═══ FAB ═══
function toggleFab(){fabOpen=!fabOpen;document.getElementById('fab-menu').classList.toggle('open',fabOpen);}
function fabGo(a){
  fabOpen=false;document.getElementById('fab-menu').classList.remove('open');
  if(a==='cursos'){showPage('explorar');switchExplorer('cursos');}
  else if(a==='turno'){showPage('explorar');switchExplorer('turnos');}
  else if(a==='info'){document.getElementById('info-modal-cnt').textContent=localStorage.getItem(KI)||DEF_INFO;openOv('info-modal');}
  else if(a==='faq'){renderFAQModal();openOv('faq-modal');}
}
document.addEventListener('click',e=>{if(fabOpen&&!e.target.closest('.fab-wrap')){fabOpen=false;document.getElementById('fab-menu').classList.remove('open');}});
function renderFAQModal(){const faqs=gF();document.getElementById('faq-modal-list').innerHTML=faqs.map(f=>`<div style="padding:13px 0;border-bottom:1px solid var(--crd);"><div style="font-weight:500;color:var(--dark);margin-bottom:4px;">${f.q}</div><div style="font-size:14px;color:var(--muted);">${f.a}</div></div>`).join('');}

// ═══ VIEWER ═══
function openViewer(id){
  const courses=gc();const c=courses.find(x=>x.id===id);if(!c||c.locked)return;
  currentCourseId=id;lessonFlat=[];
  (c.modules||[]).forEach((m,mi)=>m.lessons.forEach((l,li)=>lessonFlat.push({mi,li,mid:m.id,lid:l.id})));
  document.getElementById('vcname').textContent=c.title;
  document.getElementById('vsh-tit').textContent=c.title;
  const tot=lessonFlat.length;const prog=getProgress(id);const done=(c.modules||[]).reduce((a,m)=>a+m.lessons.filter(l=>l.done||!!prog[l.id]).length,0);
  const pct=tot>0?Math.round(done/tot*100):0;
  document.getElementById('vpf').style.width=pct+'%';document.getElementById('vpt').textContent=pct+'% completado';
  document.getElementById('vsh-meta').textContent=`${(c.modules||[]).length} módulos · ${tot} clases`;
  renderVModules(c);showView('course-viewer');
  applyCourseThumbToViewer(c);
  const fm=document.querySelector('.mod-hdr');if(fm)openMod(fm);
  if(lessonFlat.length)selLesson(lessonFlat[0]);
  // vs-panel mobile handled by vsCheckMobile()
}
function renderVModules(c){
  document.getElementById('vmodules').innerHTML=(c.modules||[]).map((m,mi)=>{
    const prog=getProgress(currentCourseId);const dc=m.lessons.filter(l=>l.done||!!prog[l.id]).length;
    return`<div class="mod-sec"><div class="mod-hdr" onclick="toggleMod(this)"><div><div class="mod-num">Módulo ${mi+1} · ${dc}/${m.lessons.length}</div><div class="mod-name">${m.title}</div></div><span class="mod-chev">▾</span></div><div class="mod-lessons">${m.lessons.map((l,li)=>{const isDoneL=l.done||!!prog[l.id];const sc=isDoneL?'done':(li===0&&dc===0&&!isDoneL?'current':'locked');const si=isDoneL?'✓':(sc==='current'?'▶':li+1);return`<div class="les-item" id="li-${m.id}-${l.id}" onclick="selById('${m.id}','${l.id}')"><div class="les-st ${sc}">${si}</div><div><div class="les-name">${l.title}</div><div class="les-dur">⏱ ${l.duration}</div></div></div>`;}).join('')}</div></div>`;
  }).join('');
}
function toggleMod(h){const l=h.nextElementSibling,c=h.querySelector('.mod-chev'),o=l.classList.contains('open');if(o){l.classList.remove('open');c.classList.remove('open');h.classList.remove('open');}else openMod(h);}
function openMod(h){h.nextElementSibling.classList.add('open');h.querySelector('.mod-chev').classList.add('open');h.classList.add('open');}
function selById(mid,lid){const idx=lessonFlat.findIndex(f=>f.mid===mid&&f.lid===lid);if(idx>=0)selLesson(lessonFlat[idx]);}
// ── VIDEO URL PARSER ────────────────────────────────
function parseVideoUrl(raw){
  if(!raw||!raw.trim())return null;
  const url=raw.trim();
  // YouTube
  let m=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(m)return{type:'yt',embed:`https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&color=white`};
  // Vimeo
  m=url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m)return{type:'vi',embed:`https://player.vimeo.com/video/${m[1]}?color=C9A84C&title=0&byline=0`};
  // Google Drive
  m=url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(m)return{type:'gd',embed:`https://drive.google.com/file/d/${m[1]}/preview`};
  // Direct mp4/webm/ogg
  if(url.match(/\.(mp4|webm|ogv|ogg)(\?.*)?$/i))return{type:'mp4',embed:url};
  // Fallback — try as embed
  if(url.startsWith('http'))return{type:'iframe',embed:url};
  return null;
}

function renderVideoArea(l){
  const area=document.getElementById('vid-area');if(!area)return;
  // remove old embed
  area.querySelectorAll('.vid-embed,.vid-no-url,.vid-type-badge,video.vid-direct').forEach(el=>el.remove());
  const ph=document.getElementById('vid-ph');
  const bar=document.getElementById('vid-complete-bar');
  if(bar)bar.style.display='';
  const parsed=parseVideoUrl(l.videoUrl);
  if(!parsed){
    // Show styled placeholder
    if(ph)ph.style.display='';
    document.getElementById('vlt').textContent=l.title;
    document.getElementById('vls').textContent='Sin video asignado · '+l.duration;
    // add "no url" overlay
    const noUrl=document.createElement('div');
    noUrl.className='vid-no-url';
    noUrl.innerHTML=`<div class="vid-no-url-icon">🎬</div><div class="vid-no-url-txt">${l.title}</div><div class="vid-no-url-sub">El administrador aún no asignó un video a esta clase</div>`;
    area.appendChild(noUrl);
    return;
  }
  if(ph)ph.style.display='none';
  // badge
  const labels={yt:'YouTube',vi:'Vimeo',gd:'Google Drive',mp4:'Video',iframe:'Video'};
  const badge=document.createElement('div');badge.className='vid-type-badge';badge.textContent=labels[parsed.type]||'Video';area.appendChild(badge);
  if(parsed.type==='mp4'){
    const vid=document.createElement('video');
    vid.className='vid-embed vid-direct';vid.controls=true;vid.autoplay=false;
    vid.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;';
    vid.src=parsed.embed;area.appendChild(vid);
  }else{
    const ifr=document.createElement('iframe');
    ifr.className='vid-embed';ifr.src=parsed.embed;
    ifr.setAttribute('allowfullscreen','');ifr.setAttribute('allow','autoplay; fullscreen; picture-in-picture');
    area.appendChild(ifr);
  }
}

function updateDoneUI(isDone){
  const st=document.getElementById('vcb-status');
  const lbl=document.getElementById('vcb-label');
  const btn=document.getElementById('btn-mark-done');
  if(!st)return;
  if(isDone){
    st.className='vcb-status done';st.textContent='✓';
    if(lbl){lbl.className='vcb-label done';lbl.textContent='Clase completada';}
    if(btn){btn.className='btn-mark-done done';btn.textContent='✓ Completada';btn.disabled=true;}
  }else{
    st.className='vcb-status';st.textContent='';
    if(lbl){lbl.className='vcb-label';lbl.textContent='Marcar como completada al terminar';}
    if(btn){btn.className='btn-mark-done';btn.textContent='✓ Marcar como completada';btn.disabled=false;}
  }
}

function updateViewerProgress(){
  const courses=gc();const c=courses.find(x=>x.id===currentCourseId);if(!c)return;
  const prog=getProgress(currentCourseId);
  const total=lessonFlat.length;
  const done=lessonFlat.filter(f=>{
    const m=c.modules[f.mi];const l=m&&m.lessons[f.li];
    return l&&(l.done||prog[l.id]);
  }).length;
  const pct=total>0?Math.round(done/total*100):0;
  const fill=document.getElementById('vs-prog-fill');const txt=document.getElementById('vs-prog-txt');
  const vfill=document.getElementById('vpf');const vpt=document.getElementById('vpt');
  if(fill)fill.style.width=pct+'%';if(txt)txt.textContent=pct+'%';
  if(vfill)vfill.style.width=pct+'%';if(vpt)vpt.textContent=pct+'% completado';
  // refresh sidebar icons
  renderVModules(c);
}

// ── PROGRESS STORAGE ─────────────────────────────────
function getProgress(courseId){
  try{return JSON.parse(localStorage.getItem('prog_'+courseId)||'{}');}catch(e){return {};}
}
function setProgress(courseId,lessonId,done){
  const p=getProgress(courseId);
  if(done)p[lessonId]=true;else delete p[lessonId];
  localStorage.setItem('prog_'+courseId,JSON.stringify(p));
}

function markLessonDone(){
  const c=gc().find(x=>x.id===currentCourseId);if(!c)return;
  const flat=lessonFlat[lessonIdx];if(!flat)return;
  const m=c.modules[flat.mi];const l=m&&m.lessons[flat.li];if(!l)return;
  setProgress(currentCourseId,l.id,true);
  updateDoneUI(true);
  // highlight lesson as done in sidebar
  const li=document.getElementById(`li-${m.id}-${l.id}`);
  if(li){const st=li.querySelector('.les-st');if(st){st.className='les-st done';st.textContent='✓';}}
  updateViewerProgress();
  // auto-advance after short delay
  setTimeout(()=>{
    if(lessonIdx<lessonFlat.length-1){navL(1);}
    else{toast('🏆 ¡Módulo completado! Podés avanzar al siguiente.');}
  },900);
}

// ── selLesson (updated) ──────────────────────────────
function selLesson(flat){
  lessonIdx=lessonFlat.indexOf(flat);
  const c=gc().find(x=>x.id===currentCourseId);const m=c.modules[flat.mi];const l=m.lessons[flat.li];
  document.querySelectorAll('.les-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById(`li-${m.id}-${l.id}`);if(el){el.classList.add('active');el.scrollIntoView({behavior:'smooth',block:'nearest'});}
  // video
  renderVideoArea(l);
  loadNote(currentCourseId, l.id);
  document.getElementById('vlt').textContent=l.title;document.getElementById('vls').textContent=`${m.title} · ${l.duration}`;
  document.getElementById('lctit').textContent=l.title;document.getElementById('lcmod').textContent=`📹 ${m.title}`;document.getElementById('lcdur').textContent=`⏱ ${l.duration}`;
  document.getElementById('lcdesc').textContent=l.desc;
  // done state
  const prog=getProgress(currentCourseId);
  const isDone=l.done||!!prog[l.id];
  updateDoneUI(isDone);
  updateViewerProgress();
  const rl=document.getElementById('lcres-list');
  const hasRes=(l.resources&&l.resources.length)||(l.attachments&&l.attachments.length);
  if(hasRes){
    const resHtml=(l.resources||[]).map(r=>`<div class="ritem"><div class="rico">${r.icon}</div><div><div class="rname">${r.name}</div><div class="rtype">${r.type}</div></div></div>`).join('');
    const attHtml=(l.attachments||[]).map(a=>`<div class="attach-item" onclick="downloadAttachment('${a.name}','${a.data||''}')"><div class="attach-icon">${fileIcon(a.type)}</div><div><div class="attach-name">${a.name}</div><div class="attach-size">${a.size||''}</div></div><div class="attach-dl">⬇ Descargar</div></div>`).join('');
    rl.innerHTML=resHtml+attHtml;rl.closest('.lcres').style.display='';
  }else{rl.innerHTML='';rl.closest('.lcres').style.display='none';}
  document.getElementById('btn-prev').style.display=lessonIdx>0?'':'none';
  document.getElementById('btn-next').textContent=lessonIdx<lessonFlat.length-1?'Siguiente →':'✓ Completar curso';
}
function navL(d){const ni=lessonIdx+d;if(ni>=0&&ni<lessonFlat.length)selLesson(lessonFlat[ni]);}
function backDash(){showView('dashboard');showPage('explorar');switchExplorer('cursos');updateDashStats();}

// ═══ ESTETICS ═══
function loadSavedEstetics(){
  const saved=localStorage.getItem(KES);
  if(saved){try{const v=JSON.parse(saved);Object.entries(v).forEach(([k,val])=>document.documentElement.style.setProperty(k,val));}catch(e){}}
  const cfg=gCfg();if(cfg.siteName){const nm=cfg.siteName;['site-name-nav','site-name-footer','sb-brand'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=nm;});document.getElementById('site-title').textContent=nm;}
}
function applyText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

// ═══ MISC ═══
function scrollTo2(id){const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth'});}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded',()=>{
  initFirebase();
  loadSavedEstetics();
  loadSavedTexts();
  applyHeroBg();
  checkSession();
  renderLanding();
  setTimeout(()=>checkUrlAdmin(), 300);
});

// ═══════════════════════════════════════════════════════
// ADMIN PANEL — PART 2
// ═══════════════════════════════════════════════════════

function loadAdminData(){
  // Pull latest data from Firestore before showing admin
  if(_fbReady&&_db){
    toast('☁ Sincronizando datos...');
    _syncSiteFromCloud().then(()=>{
      admPage('estetica');
      toast('✅ Datos actualizados');
    }).catch(()=>admPage('estetica'));
  } else {
    admPage('estetica');
  }
}

function admLogout(){
  currentUser=null;localStorage.removeItem(KS);
  showView('landing');
}

function admPage(name){
  document.querySelectorAll('.adm-ni').forEach(el=>el.classList.remove('active'));
  const btn=document.querySelector('.adm-ni[data-adm="'+name+'"]');
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.adm-pg').forEach(el=>el.classList.remove('active'));
  const pg=document.getElementById('adm-'+name);
  if(pg)pg.classList.add('active');
  const renders={estetica:admRenderEstetica,textos:admRenderTextos,cursos:admRenderCursosList,
    ebooks:admRenderEbooksList,features:admRenderFeatsList,faq:admRenderFAQList,
    info:admRenderInfoPage,recursos:admRenderRecsList,analytics:renderAnalytics,turnos:function(){admRenderTurnosList();admRenderSlots();},
    usuarios:admRenderUsersList,config:admRenderConfig};
  if(renders[name])renders[name]();
}

// ── ESTÉTICA ──────────────────────────────────────────

function rgbToHex(c){
  if(!c)return null;c=c.trim();
  if(c.startsWith('#'))return c;
  const m=c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if(!m)return c;
  return'#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
}

function admPreviewColor(cssVar,val){
  document.documentElement.style.setProperty(cssVar,val);
}

function admRenderEstetica(){
  const saved=JSON.parse(localStorage.getItem(KES)||'{}');
  const st=getComputedStyle(document.documentElement);
  const get=v=>saved[v]||rgbToHex(st.getPropertyValue(v).trim())||'';
  const map={'col-c1':'--c1','col-c1d':'--c1d','col-c1l':'--c1l','col-gold':'--gold','col-dark':'--dark','col-cr':'--cr'};
  Object.entries(map).forEach(([elId,cssVar])=>{const el=document.getElementById(elId);if(el)el.value=get(cssVar)||el.value;});
  const cfg=gCfg();
  const sn=document.getElementById('est-sitename');if(sn)sn.value=cfg.siteName||'';
  admUpdateBgPreview();admUpdateLogoPreview();
}

function admSaveColors(){
  const map={'col-c1':'--c1','col-c1d':'--c1d','col-c1l':'--c1l','col-gold':'--gold','col-dark':'--dark','col-cr':'--cr'};
  const saved=JSON.parse(localStorage.getItem(KES)||'{}');
  Object.entries(map).forEach(([elId,cssVar])=>{
    const el=document.getElementById(elId);
    if(el){saved[cssVar]=el.value;document.documentElement.style.setProperty(cssVar,el.value);}
  });
  localStorage.setItem(KES,JSON.stringify(saved));
  toast('✅ Colores guardados');
}

function admResetColors(){
  if(!confirm('¿Resetear todos los colores a los valores originales?'))return;
  localStorage.removeItem(KES);
  const defaults={'--c1':'#8C0026','--c1d':'#620018','--c1l':'#B0003A','--gold':'#C9A84C','--dark':'#1A0008','--cr':'#FFF8F0'};
  Object.entries(defaults).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  admRenderEstetica();toast('✅ Colores reseteados');
}

function admUploadHeroBg(input,type){
  const file=input.files[0];if(!file)return;
  if(file.size>4*1024*1024){toast('⚠️ Archivo muy grande (máx 4MB). Comprimilo primero.');input.value='';return;}
  const reader=new FileReader();
  reader.onload=function(e){
    try{sBG({type,data:e.target.result});applyHeroBg();admUpdateBgPreview();toast('✅ Fondo actualizado');}
    catch(err){toast('⚠️ Error al guardar. El archivo puede ser muy grande.');}
  };
  reader.readAsDataURL(file);input.value='';
}

function admClearHeroBg(){sBG({});applyHeroBg();admUpdateBgPreview();toast('✅ Fondo removido');}

function admUpdateBgPreview(){
  const bg=gBG();const prev=document.getElementById('adm-bg-prev');if(!prev)return;
  prev.innerHTML='';
  if(bg.type==='image'&&bg.data){
    const img=document.createElement('img');img.src=bg.data;img.style.cssText='width:100%;height:100%;object-fit:cover;';prev.appendChild(img);
  }else if(bg.type==='video'&&bg.data){
    const vid=document.createElement('video');vid.src=bg.data;vid.autoplay=true;vid.loop=true;vid.muted=true;
    vid.style.cssText='width:100%;height:100%;object-fit:cover;';prev.appendChild(vid);
  }else{
    prev.style.background='linear-gradient(135deg,#1A0008,#620018)';prev.style.display='flex';prev.style.alignItems='center';prev.style.justifyContent='center';
    prev.innerHTML='<span style="color:rgba(255,255,255,.35);font-size:13px;">Degradé por defecto</span>';
  }
}

function admUploadLogo(input){
  const file=input.files[0];if(!file)return;
  if(file.size>1*1024*1024){toast('⚠️ Logo muy grande (máx 1MB).');input.value='';return;}
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const cfg=gCfg();cfg.logoData=e.target.result;sCfg(cfg);
      document.querySelectorAll('.logo-nav,.logo-hero,.logo-sb').forEach(img=>img.src=e.target.result);
      admUpdateLogoPreview();toast('✅ Logo actualizado');
    }catch(err){toast('⚠️ Error al guardar logo.');}
  };
  reader.readAsDataURL(file);input.value='';
}

function admClearLogo(){
  const cfg=gCfg();delete cfg.logoData;sCfg(cfg);admUpdateLogoPreview();toast('Logo removido');
}

function admUpdateLogoPreview(){
  const cfg=gCfg();const wrap=document.getElementById('logo-prev-wrap');const prev=document.getElementById('logo-prev');
  if(!wrap||!prev)return;
  if(cfg.logoData){prev.src=cfg.logoData;wrap.style.display='flex';}
  else wrap.style.display='none';
}

function admSaveSiteName(inputId){
  const val=document.getElementById(inputId).value.trim();if(!val)return;
  const cfg=gCfg();cfg.siteName=val;sCfg(cfg);
  ['site-name-nav','site-name-footer','sb-brand'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=val;});
  document.getElementById('site-title').textContent=val;
  ['est-sitename','cfg-sitename'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=val;});
  toast('✅ Nombre guardado');
}

// ── TEXTOS LANDING ─────────────────────────────────────

const TXT_MAP={
  hero:[['txt-hero-tag','hero-tag'],['txt-hero-h1','hero-h1'],['txt-hero-sub','hero-sub'],['txt-hero-btn1','hero-btn1'],['txt-hero-btn2','hero-btn2']],
  stats:[['txt-s1v','s1v'],['txt-s1l','s1l'],['txt-s2v','s2v'],['txt-s2l','s2l'],['txt-s3v','s3v'],['txt-s3l','s3l'],['txt-s4v','s4v'],['txt-s4l','s4l']],
  feat:[['txt-feat-lbl','feat-lbl'],['txt-feat-tit','feat-tit']],
  cta:[['txt-cta-lbl','cta-lbl'],['txt-cta-tit','cta-tit'],['txt-cta-txt','cta-txt'],['txt-cta-btn','cta-btn']],
  footer:[['txt-footer-txt','footer-txt'],['txt-footer-sub','footer-sub']],
  turno:[['txt-turno-tit','turno-sec-tit'],['txt-turno-desc','turno-sec-desc']],
  com:[['txt-com-tit','com-tit'],['txt-com-txt','com-txt']],
};

function admRenderTextos(){
  const cfg=gCfg();const saved=cfg.texts||{};
  Object.entries(TXT_MAP).forEach(([,fields])=>{
    fields.forEach(([inpId,domId])=>{
      const inp=document.getElementById(inpId);const dom=document.getElementById(domId);
      if(inp){
        if(saved[domId]!==undefined)inp.value=saved[domId];
        else if(dom)inp.value=dom.textContent||dom.innerText||'';
      }
    });
  });
}

function admSaveTextos(section){
  const fields=TXT_MAP[section];if(!fields)return;
  const cfg=gCfg();if(!cfg.texts)cfg.texts={};
  fields.forEach(([inpId,domId])=>{
    const inp=document.getElementById(inpId);const dom=document.getElementById(domId);
    if(inp&&dom){cfg.texts[domId]=inp.value;dom.textContent=inp.value;}
  });
  sCfg(cfg);toast('✅ Textos guardados');
}

function loadSavedTexts(){
  const cfg=gCfg();const saved=cfg.texts||{};
  Object.entries(saved).forEach(([domId,val])=>{const el=document.getElementById(domId);if(el)el.textContent=val;});
  if(cfg.wsub){const el=document.getElementById('wsub');if(el)el.textContent=cfg.wsub;}
  if(cfg.logoData)document.querySelectorAll('.logo-nav,.logo-hero,.logo-sb').forEach(img=>img.src=cfg.logoData);
}

// ── CURSOS ─────────────────────────────────────────────

let admCurEditId=null;

function admRenderCursosList(){
  const courses=gc();
  const el=document.getElementById('adm-cursos-list');
  if(!el) return;
  const lvlC={principiante:'#2E7D32',intermedio:'#E65100',avanzado:'#6A1B9A'};
  el.innerHTML=`
    <div style="display:flex;align-items:center;margin-bottom:10px;">
      <span style="font-size:12.5px;color:var(--muted);">
        ${courses.length} curso${courses.length!==1?'s':''} en total
      </span>
      <span class="dnd-hint">⠿ Arrastrá para reordenar</span>
    </div>
    <div id="dnd-course-container">
      ${courses.map(c=>{
        const tot=(c.modules||[]).reduce((a,m)=>a+m.lessons.length,0);
        const lvlColor=lvlC[c.level]||'#999';
        return`<div class="acard dnd-course-card" style="padding:0;margin-bottom:10px;" data-cid="${c.id}" draggable="true">
          <div style="display:flex;align-items:center;gap:10px;padding:13px 14px;">
            <div class="dnd-handle" title="Arrastrá para reordenar">⠿</div>
            <div style="width:42px;height:42px;border-radius:var(--r1);background:${c.color||'#8C0026'};
                        display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
              ${c.emoji}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:var(--fd);font-size:16px;color:var(--dark);">${c.title}</div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">
                <span style="background:${lvlColor};color:#fff;border-radius:50px;padding:1px 8px;font-size:10px;font-weight:700;">
                  ${c.levelLabel}
                </span>
                &nbsp;${(c.modules||[]).length} módulos · ${tot} clases · ${c.locked?'🔒 Bloqueado':'🔓 Disponible'}
              </div>
            </div>
            <div style="display:flex;gap:7px;">
              <button class="abtn-gold" onclick="admEditCurso(${c.id})">✏ Editar</button>
              <button class="abtn-del"  onclick="admDeleteCurso(${c.id})">✕</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  initDragCourses();
}

function admNewCurso(){
  admCurEditId=null;
  window._editorIsNew=true;
  document.getElementById('editor-pg-title').textContent='Nuevo curso';
  document.getElementById('cmod-body').innerHTML=admCursoForm({id:null,emoji:'📚',title:'',subtitle:'',description:'',level:'principiante',levelLabel:'Principiante',color:'#8C0026',locked:false,modules:[]},true);
  admOpenEditor();
}

function admEditCurso(id){
  admCurEditId=id;
  window._editorIsNew=false;
  const c=gc().find(x=>x.id===id);if(!c)return;
  document.getElementById('editor-pg-title').textContent=c.title||'Editar curso';
  document.getElementById('cmod-body').innerHTML=admCursoForm(c,false);
  admOpenEditor();
}

function admCursoForm(c,isNew){
  const coverHtml=c.coverImg
    ?`<div class="cover-upload-area has-img" id="cover-drop" onclick="document.getElementById('ce-cover-inp').click()"><img class="cover-preview" src="${c.coverImg}" id="cover-preview-img"><button class="cover-clear-btn" onclick="event.stopPropagation();clearCoverImg()">✕</button><input type="file" class="cover-upload-input" id="ce-cover-inp" accept="image/*" onchange="onCoverImgChange(event)"></div>`
    :`<div class="cover-upload-area" id="cover-drop" onclick="document.getElementById('ce-cover-inp').click()"><div style="font-size:32px;">🖼</div><div class="cover-upload-lbl">Subir imagen de portada</div><div class="cover-upload-hint">JPG, PNG o WebP · Recomendado 800×450px</div><input type="file" class="cover-upload-input" id="ce-cover-inp" accept="image/*" onchange="onCoverImgChange(event)"></div>`;
  const mods=isNew?'':`
    <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px;">
      <div style="font-family:var(--fd);font-size:16px;color:var(--dark);">Módulos y clases (${(c.modules||[]).length} módulos)</div>
      <button class="abtn-add" style="font-size:12px;padding:6px 14px;" onclick="admAddModule()">+ Módulo</button>
    </div>
    <div id="ce-modules">${admRenderModsInline(c)}</div>`;
  return`
    <div style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Portada del curso</div>
    ${coverHtml}
    <input type="hidden" id="ce-cover-data" value="${c.coverImg||''}">
    <div class="adm-grid2" style="margin-top:14px;">
      <div class="fg"><label>Emoji/Ícono</label><input type="text" id="ce-emoji" value="${c.emoji||'📚'}" placeholder="✨"></div>
      <div class="fg"><label>Color de fondo (si no hay portada)</label><input type="color" id="ce-color" value="${c.color||'#8C0026'}"></div>
    </div>
    <div class="fg"><label>Título del curso</label><input type="text" id="ce-title" value="${c.title}" placeholder="Nombre del curso"></div>
    <div class="fg"><label>Subtítulo corto</label><input type="text" id="ce-subtitle" value="${c.subtitle||''}" placeholder="Frase breve de impacto"></div>
    <div class="fg"><label>Descripción completa</label><textarea id="ce-desc" rows="3">${c.description||''}</textarea></div>
    <div class="price-section">
      <h4>💰 Precio & Pago</h4>
      <div class="adm-grid2">
        <div class="fg" style="margin:0;"><label>Precio</label><input type="text" id="ce-price" value="${c.price||''}" placeholder="Gratis · $9.990 · USD 29"></div>
        <div class="fg" style="margin:0;"><label>Link de pago (MercadoPago, Stripe, etc.)</label><input type="text" id="ce-paylink" value="${c.payLink||''}" placeholder="https://mpago.la/..."></div>
      </div>
    </div>
    <div class="adm-grid2" style="margin-top:10px;">
      <div class="fg"><label>Nivel</label>
        <select id="ce-level">
          <option value="principiante"${c.level==='principiante'?' selected':''}>Principiante</option>
          <option value="intermedio"${c.level==='intermedio'?' selected':''}>Intermedio</option>
          <option value="avanzado"${c.level==='avanzado'?' selected':''}>Avanzado</option>
        </select>
      </div>
      <div class="fg"><label>Etiqueta del nivel</label><input type="text" id="ce-levlbl" value="${c.levelLabel||'Principiante'}"></div>
    </div>
    <div class="fg"><label>Estado</label>
      <select id="ce-locked">
        <option value="0"${!c.locked?' selected':''}>🔓 Disponible para alumnas</option>
        <option value="1"${c.locked?' selected':''}>🔒 Bloqueado / Próximamente</option>
      </select>
    </div>
    ${mods}
    <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
      <button class="abtn" onclick="admSaveCurso(${isNew})">${isNew?'Crear curso':'Guardar cambios'}</button>
      <button class="abtn-g" onclick="closeOv('curso-modal')">Cancelar</button>
    </div>`;
}

function admRenderModsInline(c){
  if(!(c.modules&&c.modules.length))
    return '<div style="font-size:13px;color:var(--muted);padding:10px 0;">Sin módulos aún. Hacé clic en + Módulo para empezar.</div>';

  const modsHtml=(c.modules||[]).map((m,mi)=>`
    <div class="mod-acc" id="modacc-${m.id}" data-mid="${m.id}" draggable="true">
      <div class="mod-acc-hdr" onclick="admTogModAcc('${m.id}')">
        <span class="dnd-handle" title="Arrastrá para reordenar módulos" onclick="event.stopPropagation()">⠿</span>
        <span style="font-size:11px;font-weight:700;color:var(--goldd);min-width:54px;">MÓD ${mi+1}</span>
        <span style="font-size:13px;color:var(--dark);flex:1;padding:0 6px;">${m.title}</span>
        <span style="font-size:11px;color:var(--muted);">${m.lessons.length} clase${m.lessons.length!==1?'s':''}</span>
        <button class="abtn-del" style="margin-left:8px;font-size:11px;"
          onclick="event.stopPropagation();admDelModule('${m.id}')">✕</button>
        <span style="margin-left:7px;color:var(--muted);font-size:12px;">▾</span>
      </div>
      <div class="mod-acc-body" id="mab-${m.id}">
        <div class="fg">
          <label>Nombre del módulo</label>
          <input type="text" id="mt-${m.id}" value="${m.title}" placeholder="Ej: Técnicas avanzadas">
        </div>
        <div class="fg">
          <label>Descripción del módulo (opcional)</label>
          <input type="text" id="mdesc-${m.id}" value="${m.desc||''}" placeholder="Breve descripción">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 6px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--muted);">
            CLASES DE ESTE MÓDULO
          </div>
          <span class="dnd-hint">⠿ Arrastrá clases</span>
        </div>
        <div id="llist-${m.id}">
          ${(m.lessons||[]).map((l,li)=>`
            <div class="les-card" id="lcard-${m.id}-${l.id}" data-mid="${m.id}" data-lid="${l.id}" draggable="true">
              <div class="les-card-hdr" onclick="admTogLesCard('${m.id}','${l.id}')">
                <span class="dnd-handle" title="Arrastrá para reordenar clases" onclick="event.stopPropagation()">⠿</span>
                <div class="les-card-num">${li+1}</div>
                <input class="les-card-title-inp" type="text"
                  value="${l.title}" id="lt-${m.id}-${l.id}"
                  placeholder="Título de la clase"
                  onclick="event.stopPropagation()">
                <button class="abtn-del" style="font-size:11px;padding:4px 8px;"
                  onclick="event.stopPropagation();admDelLesson('${m.id}','${l.id}')">✕</button>
                <span style="color:var(--muted);font-size:12px;margin-left:4px;">▾</span>
              </div>
              <div class="les-card-body" id="lcbody-${m.id}-${l.id}">
                <div class="les-fields-row">
                  <div class="fg" style="margin:0;">
                    <label>Descripción de la clase</label>
                    <textarea id="ldesc-${m.id}-${l.id}" rows="2"
                      placeholder="Qué aprende la alumna en esta clase">${l.desc||''}</textarea>
                  </div>
                  <div class="fg" style="margin:0;">
                    <label>Duración</label>
                    <input type="text" id="ld-${m.id}-${l.id}" value="${l.duration||''}" placeholder="15 min">
                  </div>
                </div>
                <div class="fg">
                  <label>🎬 URL del video</label>
                  <input type="text" class="lv-input" value="${l.videoUrl||''}"
                    id="lv-${m.id}-${l.id}"
                    placeholder="YouTube, Vimeo, Google Drive o MP4 directo">
                  <div class="lv-hint">Ej: https://youtu.be/abc123</div>
                </div>
                <div class="fg">
                  <label>📎 Archivos adjuntos</label>
                  <div class="les-attach-list" id="lattach-${m.id}-${l.id}">
                    ${(l.attachments||[]).map((a,ai)=>`
                      <div class="les-attach-item">
                        <span style="font-size:17px;">${fileIcon(a.type)}</span>
                        <span class="les-attach-name" title="${a.name}">${a.name}</span>
                        <span class="les-attach-size">${a.size||''}</span>
                        <button class="les-attach-del"
                          onclick="admDelAttach('${m.id}','${l.id}',${ai})" title="Eliminar">✕</button>
                      </div>`).join('')}
                  </div>
                  <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <label class="abtn-add" style="font-size:12px;padding:5px 12px;cursor:pointer;">
                      📎 Adjuntar archivo
                      <input type="file" style="display:none;" multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.zip"
                        onchange="admAttachFiles(event,'${m.id}','${l.id}')">
                    </label>
                    <span style="font-size:11px;color:var(--muted);">PDF, imágenes, docs, ZIP (máx 5MB c/u)</span>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="abtn-add"  style="font-size:12px;padding:6px 14px;" onclick="admAddLesson('${m.id}')">+ Clase</button>
          <button class="abtn-g"    style="font-size:12px;padding:6px 14px;" onclick="admSaveModuleInputs('${m.id}')">✓ Guardar módulo</button>
        </div>
      </div>
    </div>`).join('');

  return `<div id="dnd-mod-container" data-cid="${c.id}"
            style="display:flex;align-items:center;margin-bottom:8px;">
            <span class="dnd-hint" style="margin-left:0;">⠿ Arrastrá módulos para reordenar</span>
           </div>
           <div id="dnd-mods-wrap">${modsHtml}</div>`;
}

function admTogLesCard(mid,lid){
  const b=document.getElementById('lcbody-'+mid+'-'+lid);if(b)b.classList.toggle('open');
}

function admTogModAcc(modId){
  const b=document.getElementById('mab-'+modId);if(b)b.classList.toggle('open');
}

function admFlushEdits(){
  if(admCurEditId===null)return;
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  (c.modules||[]).forEach(m=>{
    const mt=document.getElementById('mt-'+m.id);if(mt)m.title=mt.value;
    (m.lessons||[]).forEach(l=>{
      const lt=document.getElementById('lt-'+m.id+'-'+l.id);const ld=document.getElementById('ld-'+m.id+'-'+l.id);const ldesc=document.getElementById('ldesc-'+m.id+'-'+l.id);
      const lv=document.getElementById('lv-'+m.id+'-'+l.id);
      if(lt)l.title=lt.value;if(ld)l.duration=ld.value;if(ldesc)l.desc=ldesc.value;if(lv)l.videoUrl=lv.value.trim();
      // attachments are saved directly, no flush needed
    });
  });
  sc(courses);
}

function admSaveModuleInputs(modId){admFlushEdits();toast('✅ Módulo guardado');}

function admSaveCurso(isNew){
  const courses=gc();
  let c=admCurEditId!==null?courses.find(x=>x.id===admCurEditId):null;
  if(!c){c={id:Date.now(),modules:[]};courses.push(c);}
  c.emoji=document.getElementById('ce-emoji').value||'📚';
  c.title=document.getElementById('ce-title').value||'Nuevo curso';
  c.subtitle=document.getElementById('ce-subtitle').value||'';
  c.description=document.getElementById('ce-desc').value||'';
  c.level=document.getElementById('ce-level').value;
  c.levelLabel=document.getElementById('ce-levlbl').value||'';
  c.locked=document.getElementById('ce-locked').value==='1';
  c.color=document.getElementById('ce-color').value;
  const priceEl=document.getElementById('ce-price');if(priceEl)c.price=priceEl.value.trim();
  const payEl=document.getElementById('ce-paylink');if(payEl)c.payLink=payEl.value.trim();
  const covEl=document.getElementById('ce-cover-data');if(covEl)c.coverImg=covEl.value||'';
  admCurEditId=c.id;
  // Also flush any module/lesson edits
  (c.modules||[]).forEach(m=>{
    const mt=document.getElementById('mt-'+m.id);if(mt)m.title=mt.value;
    (m.lessons||[]).forEach(l=>{
      const lt=document.getElementById('lt-'+m.id+'-'+l.id);const ld=document.getElementById('ld-'+m.id+'-'+l.id);const ldesc=document.getElementById('ldesc-'+m.id+'-'+l.id);
      if(lt)l.title=lt.value;if(ld)l.duration=ld.value;if(ldesc)l.desc=ldesc.value;
    });
  });
  sc(courses);
  if(isNew){
    // Keep modal open, show modules section now
    document.getElementById('cmod-title').textContent='Editar: '+c.title;
    document.getElementById('cmod-body').innerHTML=admCursoForm(c,false);
    toast('✅ Curso creado. Ahora podés agregar módulos.');
  }else{
    admCloseEditor();toast('✅ Curso guardado');
  }
  admRenderCursosList();renderLanding();
}

function admDeleteCurso(id){
  if(!confirm('¿Eliminar este curso y todos sus módulos/clases?'))return;
  sc(gc().filter(c=>c.id!==id));admRenderCursosList();renderLanding();toast('Curso eliminado');
}

function admAddModule(){
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c){toast('⚠️ Guardá el curso primero');return;}
  if(!c.modules)c.modules=[];
  c.modules.push({id:'m'+Date.now(),title:'Nuevo módulo',lessons:[]});
  sc(courses);document.getElementById('ce-modules').innerHTML=admRenderModsInline(c);
}

function admDelModule(modId){
  if(!confirm('¿Eliminar este módulo y todas sus clases?'))return;
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  c.modules=(c.modules||[]).filter(m=>m.id!==modId);
  sc(courses);document.getElementById('ce-modules').innerHTML=admRenderModsInline(c);toast('Módulo eliminado');
}

function admAddLesson(modId){
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  const m=(c.modules||[]).find(m=>m.id===modId);if(!m)return;
  if(!m.lessons)m.lessons=[];
  m.lessons.push({id:'l'+Date.now(),title:'Nueva clase',duration:'15 min',done:false,desc:'',videoUrl:'',resources:[],attachments:[]});
  sc(courses);document.getElementById('ce-modules').innerHTML=admRenderModsInline(c);
  const body=document.getElementById('mab-'+modId);if(body)body.classList.add('open');
}

function admDelLesson(modId,lesId){
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  const m=(c.modules||[]).find(m=>m.id===modId);if(!m)return;
  m.lessons=(m.lessons||[]).filter(l=>l.id!==lesId);
  sc(courses);document.getElementById('ce-modules').innerHTML=admRenderModsInline(c);
  const body=document.getElementById('mab-'+modId);if(body)body.classList.add('open');
}

// ── EBOOKS ─────────────────────────────────────────────

function admRenderEbooksList(){
  const ebs=gEB();const el=document.getElementById('adm-ebooks-list');if(!el)return;
  if(!ebs.length){el.innerHTML='<p style="font-size:13px;color:var(--muted);text-align:center;padding:24px 0;">No hay ebooks todavía. Hacé clic en "+ Nuevo ebook" para agregar uno.</p>';return;}
  el.innerHTML=ebs.map((e,idx)=>{
    const coverHtml=e.cover
      ?`<div style="position:relative;width:70px;flex-shrink:0;"><img src="${e.cover}" style="width:70px;height:96px;object-fit:cover;border-radius:6px;display:block;"><button onclick="admClearEbookCover(${idx})" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--c1);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button></div>`
      :`<div style="width:70px;height:96px;border-radius:6px;background:${e.color||'#8C0026'};display:flex;align-items:center;justify-content:center;font-size:30px;cursor:pointer;flex-shrink:0;" onclick="document.getElementById('eb-cover-inp-${idx}').click()">${e.emoji||'📕'}<input type="file" id="eb-cover-inp-${idx}" accept="image/*" style="display:none;" onchange="admUploadEbookCover(event,${idx})"></div>`;
    return`<div class="acard" style="margin-bottom:12px;">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        ${coverHtml}
        <div style="flex:1;min-width:0;">
          <div class="adm-grid2" style="gap:8px;margin-bottom:8px;">
            <div class="fg" style="margin:0;"><label>Emoji</label><input type="text" id="eb-emoji-${idx}" value="${e.emoji||'📕'}" style="text-align:center;font-size:18px;"></div>
            <div class="fg" style="margin:0;"><label>Color de fondo</label><input type="color" id="eb-color-${idx}" value="${e.color||'#8C0026'}" style="width:100%;height:38px;border:none;border-radius:var(--r1);cursor:pointer;"></div>
          </div>
          <div class="fg" style="margin-bottom:6px;"><label>Título</label><input type="text" id="eb-title-${idx}" value="${e.title||''}"></div>
          <div class="fg" style="margin-bottom:6px;"><label>Descripción</label><textarea id="eb-desc-${idx}" rows="2">${e.desc||''}</textarea></div>
          <div class="adm-grid2" style="gap:8px;margin-bottom:6px;">
            <div class="fg" style="margin:0;"><label>Precio</label><input type="text" id="eb-price-${idx}" value="${e.price||''}" placeholder="Gratis · $9.990 · USD 15"></div>
            <div class="fg" style="margin:0;"><label>Tipo</label><select id="eb-paid-${idx}"><option value="0"${!e.paid?' selected':''}>Gratuito</option><option value="1"${e.paid?' selected':''}>De pago</option></select></div>
          </div>
          <div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:var(--r2);padding:12px 14px;margin-bottom:6px;">
            <div style="font-size:11px;font-weight:700;color:var(--goldd);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">💳 Links de acceso</div>
            <div class="fg" style="margin-bottom:8px;">
              <label>🔗 Link de descarga <span style="font-weight:400;color:var(--muted);">· Google Drive, Dropbox, etc.</span></label>
              <input type="text" id="eb-download-${idx}" value="${e.downloadLink||e.link||''}" placeholder="https://drive.google.com/file/d/...">
              <div style="font-size:11px;color:var(--muted);margin-top:3px;">Se muestra cuando la alumna ya pagó o el ebook es gratis</div>
            </div>
            <div class="fg" style="margin:0;">
              <label>🛒 Link de pago <span style="font-weight:400;color:var(--muted);">· MercadoPago, Stripe, Hotmart, etc.</span></label>
              <input type="text" id="eb-paylink-${idx}" value="${e.payLink||''}" placeholder="https://mpago.la/...">
              <div style="font-size:11px;color:var(--muted);margin-top:3px;">Se muestra cuando el ebook es de pago y aún no fue desbloqueado</div>
            </div>
          </div>
          <div class="fg" style="margin-bottom:6px;"><label>📎 Portada (URL o subir imagen)</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="eb-cover-url-${idx}" value="${e.cover&&!e.cover.startsWith('data:')?e.cover:''}" placeholder="https://... o subir abajo" style="flex:1;">
              <label style="cursor:pointer;" title="Subir imagen">
                <span style="display:inline-flex;align-items:center;gap:5px;padding:8px 12px;background:var(--goldp);border:1px solid rgba(201,168,76,.3);border-radius:var(--r1);font-size:12.5px;color:var(--goldd);cursor:pointer;white-space:nowrap;">🖼 Subir</span>
                <input type="file" accept="image/*" style="display:none;" onchange="admUploadEbookCover(event,${idx})">
              </label>
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="abtn" onclick="admSaveEbook(${idx})" style="font-size:12.5px;">✓ Guardar</button>
        <button class="abtn-del" onclick="admDeleteEbook(${idx})" style="font-size:12.5px;">✕ Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function admSaveEbook(idx){
  const ebs=gEB();if(!ebs[idx])return;
  ebs[idx].emoji=document.getElementById('eb-emoji-'+idx).value;
  ebs[idx].color=document.getElementById('eb-color-'+idx).value;
  ebs[idx].title=document.getElementById('eb-title-'+idx).value;
  ebs[idx].desc=document.getElementById('eb-desc-'+idx).value;
  ebs[idx].price=document.getElementById('eb-price-'+idx).value;
  ebs[idx].paid=document.getElementById('eb-paid-'+idx).value==='1';
  ebs[idx].downloadLink=document.getElementById('eb-download-'+idx)?.value.trim()||'';
  ebs[idx].payLink=document.getElementById('eb-paylink-'+idx)?.value.trim()||'';
  ebs[idx].link=ebs[idx].downloadLink; // backward compat
  // cover from URL field if filled, otherwise keep existing
  const coverUrlEl=document.getElementById('eb-cover-url-'+idx);
  if(coverUrlEl&&coverUrlEl.value.trim()) ebs[idx].cover=coverUrlEl.value.trim();
  sEB(ebs);admRenderEbooksList();renderEbooks();toast('✅ Ebook guardado');
}

async function admUploadEbookCover(e,idx){
  const file=e.target.files[0];if(!file)return;
  toast('☁ Subiendo portada...');
  try{
    const url=await uploadToCloudinary(file,'ebooks');
    const ebs=gEB();if(!ebs[idx])return;
    ebs[idx].cover=url;
    sEB(ebs);admRenderEbooksList();renderEbooks();toast('✅ Portada subida');
  }catch(err){toast('❌ '+err.message);}
}

function admClearEbookCover(idx){
  const ebs=gEB();if(!ebs[idx])return;
  ebs[idx].cover='';
  sEB(ebs);admRenderEbooksList();renderEbooks();
}
function admDeleteEbook(idx){
  if(!confirm('¿Eliminar este ebook?'))return;
  sEB(gEB().filter((_,i)=>i!==idx));admRenderEbooksList();renderEbooks();toast('Ebook eliminado');
}
function admNewEbook(){
  const ebs=gEB();ebs.push({id:Date.now(),emoji:'📕',title:'Nuevo ebook',desc:'Descripción breve del ebook.',price:'',paid:false,color:'#8C0026',link:'',cover:''});
  sEB(ebs);admRenderEbooksList();toast('Ebook creado — completá los datos y guardá');
}

// ── FEATURES ───────────────────────────────────────────

function admRenderFeatsList(){
  const feats=gFt();const el=document.getElementById('adm-feat-list');if(!el)return;
  el.innerHTML=feats.map((f,idx)=>`
    <div class="arow">
      <div style="font-size:26px;width:40px;text-align:center;flex-shrink:0;">${f.icon}</div>
      <div class="arow-main">
        <div class="adm-grid2" style="gap:8px;margin-bottom:7px;">
          <div class="fg" style="margin:0;"><label>Ícono (emoji)</label><input type="text" id="ft-icon-${idx}" value="${f.icon}"></div>
          <div class="fg" style="margin:0;"><label>Título</label><input type="text" id="ft-title-${idx}" value="${f.title}"></div>
        </div>
        <div class="fg" style="margin:0;"><label>Descripción</label><textarea id="ft-desc-${idx}" rows="2">${f.desc}</textarea></div>
      </div>
      <div class="arow-acts"><button class="abtn-del" onclick="admDeleteFeat(${idx})">✕</button></div>
    </div>`).join('');
}
function admSaveFeats(){
  const feats=gFt();
  feats.forEach((_,idx)=>{
    feats[idx].icon=document.getElementById('ft-icon-'+idx).value;
    feats[idx].title=document.getElementById('ft-title-'+idx).value;
    feats[idx].desc=document.getElementById('ft-desc-'+idx).value;
  });
  sFt(feats);renderLanding();toast('✅ Beneficios guardados');
}
function admNewFeat(){const feats=gFt();feats.push({icon:'⭐',title:'Nuevo beneficio',desc:'Descripción del beneficio.'});sFt(feats);admRenderFeatsList();}
function admDeleteFeat(idx){const feats=gFt().filter((_,i)=>i!==idx);sFt(feats);admRenderFeatsList();renderLanding();}

// ── FAQ ────────────────────────────────────────────────

function admRenderFAQList(){
  const faqs=gF();const el=document.getElementById('adm-faq-list');if(!el)return;
  el.innerHTML=faqs.map((f,idx)=>`
    <div class="arow">
      <div class="arow-main">
        <div class="fg" style="margin-bottom:7px;"><label>Pregunta</label><input type="text" id="faq-q-${idx}" value="${f.q.replace(/"/g,'&quot;')}"></div>
        <div class="fg" style="margin:0;"><label>Respuesta</label><textarea id="faq-a-${idx}" rows="2">${f.a}</textarea></div>
      </div>
      <div class="arow-acts"><button class="abtn-del" onclick="admDeleteFAQItem(${idx})">✕</button></div>
    </div>`).join('');
}
function admSaveFAQAll(){
  const faqs=gF();
  faqs.forEach((_,idx)=>{faqs[idx].q=document.getElementById('faq-q-'+idx).value;faqs[idx].a=document.getElementById('faq-a-'+idx).value;});
  sF(faqs);toast('✅ FAQ guardado');
}
function admNewFAQ(){const faqs=gF();faqs.push({q:'¿Nueva pregunta?',a:'Respuesta.'});sF(faqs);admRenderFAQList();}
function admDeleteFAQItem(idx){const faqs=gF().filter((_,i)=>i!==idx);sF(faqs);admRenderFAQList();}

// ── INFO ───────────────────────────────────────────────

function admRenderInfoPage(){const el=document.getElementById('adm-info-txt');if(el)el.value=localStorage.getItem(KI)||DEF_INFO;}
function admSaveInfoTxt(){localStorage.setItem(KI,document.getElementById('adm-info-txt').value);toast('✅ Información guardada');}

// ── RECURSOS ───────────────────────────────────────────

function admRenderRecsList(){
  const recs=gR();const el=document.getElementById('adm-rec-list');if(!el)return;
  el.innerHTML=recs.map((r,idx)=>`
    <div class="arow">
      <div style="font-size:22px;width:32px;text-align:center;flex-shrink:0;">${r.icon}</div>
      <div class="arow-main">
        <div class="adm-grid3" style="gap:8px;">
          <div class="fg" style="margin:0;"><label>Ícono</label><input type="text" id="rec-icon-${idx}" value="${r.icon}"></div>
          <div class="fg" style="margin:0;"><label>Nombre</label><input type="text" id="rec-name-${idx}" value="${r.name}"></div>
          <div class="fg" style="margin:0;"><label>Tipo/Tamaño</label><input type="text" id="rec-type-${idx}" value="${r.type}"></div>
        </div>
      </div>
      <div class="arow-acts"><button class="abtn-del" onclick="admDeleteRec(${idx})">✕</button></div>
    </div>`).join('');
}
function admSaveRecs(){
  const recs=gR();
  recs.forEach((_,idx)=>{recs[idx].icon=document.getElementById('rec-icon-'+idx).value;recs[idx].name=document.getElementById('rec-name-'+idx).value;recs[idx].type=document.getElementById('rec-type-'+idx).value;});
  sR(recs);renderResources();toast('✅ Recursos guardados');
}
function admNewRec(){const recs=gR();recs.push({icon:'📄',name:'Nuevo recurso',type:'PDF · 0 MB'});sR(recs);admRenderRecsList();}
function admDeleteRec(idx){const recs=gR().filter((_,i)=>i!==idx);sR(recs);admRenderRecsList();renderResources();}

// ── TURNOS ─────────────────────────────────────────────

// admRenderTurnosList: ver función mejorada más abajo

// ── USUARIOS ───────────────────────────────────────────

function admRenderUsersList(){
  const users=gU();const ebs=gEB().filter(e=>e.paid);
  const el=document.getElementById('adm-users-content');if(!el)return;
  if(!users.length){el.innerHTML='<div class="acard" style="text-align:center;padding:40px;"><div style="font-size:40px;margin-bottom:12px;">👥</div><p style="color:var(--muted);">Aún no hay alumnas registradas.</p></div>';return;}
  el.innerHTML=users.map((u,idx)=>{
    const purchased=(u.purchasedEbooks||[]).map(String);
    const ebooksHtml=ebs.length?`<div style="margin-top:10px;border-top:1px solid var(--crd);padding-top:10px;">
      <div style="font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase;">📖 Acceso a ebooks</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${ebs.map(e=>{
          const has=purchased.includes(String(e.id));
          return`<button onclick="admToggleEbook('${u.email}','${e.id}',${has})" style="padding:5px 12px;border-radius:50px;font-size:12px;font-family:var(--fb);cursor:pointer;border:1.5px solid ${has?'#22c55e':'var(--crd)'};background:${has?'rgba(34,197,94,.1)':'var(--cr)'};color:${has?'#15803d':'var(--muted)'};" title="${has?'Revocar acceso':'Dar acceso'}">${has?'✅':'🔒'} ${e.title.slice(0,18)}${e.title.length>18?'…':''}</button>`;
        }).join('')}
      </div>
    </div>`:'';
    return`<div class="acard" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;color:var(--dark);">${u.name}</div>
          <div style="font-size:13px;color:var(--muted);">${u.email}</div>
        </div>
        <button class="abtn-del" onclick="admDeleteUser(${idx})" style="flex-shrink:0;">✕ Eliminar</button>
      </div>
      ${ebooksHtml}
    </div>`;
  }).join('');
}

async function admToggleEbook(email, ebookId, currentlyHas){
  if(currentlyHas){
    if(!confirm('¿Revocar acceso al ebook?')) return;
    await admRevokeEbook(email, ebookId);
    toast('🔒 Acceso revocado');
  } else {
    await admGrantEbook(email, ebookId);
    toast('✅ Acceso concedido — la alumna puede descargar el ebook');
  }
  admRenderUsersList();
}

function admDeleteUser(idx){if(!confirm('¿Eliminar esta usuaria? No se puede deshacer.'))return;sU(gU().filter((_,i)=>i!==idx));admRenderUsersList();toast('Usuaria eliminada');}

// ── CONFIG ─────────────────────────────────────────────

function admRenderConfig(){
  const cfg=gCfg();
  const sn=document.getElementById('cfg-sitename');if(sn)sn.value=cfg.siteName||'';
  const ws=document.getElementById('cfg-wsub');if(ws)ws.value=cfg.wsub||'Continuá donde lo dejaste y seguí avanzando.';
}
function admSavePassword(){
  const np=document.getElementById('cfg-newpass').value;const cp=document.getElementById('cfg-confpass').value;
  if(!np||np.length<6){toast('⚠️ Mínimo 6 caracteres');return;}
  if(np!==cp){toast('⚠️ Las claves no coinciden');return;}
  const cfg=gCfg();cfg.adminPass=np;sCfg(cfg);
  document.getElementById('cfg-newpass').value='';document.getElementById('cfg-confpass').value='';
  toast('✅ Contraseña cambiada. Nueva clave: '+np);
}
function admSaveCfgDash(){
  const ws=document.getElementById('cfg-wsub').value;const cfg=gCfg();cfg.wsub=ws;sCfg(cfg);
  const el=document.getElementById('wsub');if(el)el.textContent=ws;toast('✅ Guardado');
}



// ═══ INSTAGRAM CAROUSEL ═══

// ── SLOT HELPERS (GLOBAL) ─────────────────────────
const DEFAULT_SLOTS=[
  {day:'Lunes',times:['09:00','10:30','12:00','15:00','16:30']},
  {day:'Martes',times:['09:00','10:30','14:00','15:30']},
  {day:'Miércoles',times:['09:00','11:00','14:00','16:00']},
  {day:'Jueves',times:['10:00','11:30','15:00','16:30']},
  {day:'Viernes',times:['09:00','10:30','12:00','14:00']},
  {day:'Sábado',times:['09:00','10:30','12:00']},
];
function gSlotsLoc(){try{return JSON.parse(localStorage.getItem('ms_slots')||'[]');}catch(e){return[];}}
function getSlotsForDate(dateStr){
  if(!dateStr)return[];
  const d=new Date(dateStr+'T00:00:00');
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dayName=days[d.getDay()];
  const cfg=gSlotsLoc();
  const src=cfg.length?cfg:DEFAULT_SLOTS;
  const row=src.find(s=>s.day===dayName);
  return row?row.times:[];
}
function getTakenSlots(dateStr){
  return gT().filter(t=>t.date===dateStr&&t.status!=='cancelled').map(t=>t.time);
}

(function(){
  const ORDER = ['ebooks','cursos','turnos'];
  let centerIdx = 1; // cursos starts center

  function posOf(cardId){
    const ci = ORDER.indexOf(cardId);
    let diff = ci - centerIdx;
    // wrap: only 3 cards, positions -1,0,1
    if(diff > 1) diff -= ORDER.length;
    if(diff < -1) diff += ORDER.length;
    return diff;
  }

  function updatePositions(animate){
    const cards = document.querySelectorAll('.icar-card');
    cards.forEach(c => {
      const pos = posOf(c.dataset.id);
      c.setAttribute('data-pos', pos < -1 ? -2 : pos > 1 ? 2 : pos);
    });
    // dots
    document.querySelectorAll('.icar-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.id === ORDER[centerIdx]);
    });
  }

  window.icarRotate = function(dir){
    // dir=1 → rotate right (next card comes to center)
    centerIdx = (centerIdx + dir + ORDER.length) % ORDER.length;
    updatePositions();
    // open the now-center panel without showing content yet
    openPanel(ORDER[centerIdx], false);
  };

  window.icarClick = function(card){
    const id = card.dataset.id;
    const pos = parseInt(card.getAttribute('data-pos'));
    if(pos !== 0){
      // bring to center
      centerIdx = ORDER.indexOf(id);
      updatePositions();
    }
    // toggle content
    openPanel(id, true);
  };

  function openPanel(id, toggle){
    const panels = document.querySelectorAll('.icar-panel');
    const target = document.getElementById('icp-'+id);
    if(!target) return;
    const isOpen = target.classList.contains('open');
    panels.forEach(p => p.classList.remove('open'));
    if(!isOpen || !toggle){ target.classList.add('open'); }
  }

  // ── SLOT HELPERS (delegated to global scope) ──
  // getSlotsForDate / getTakenSlots / DEFAULT_SLOTS are global (see below)

  window.icarLoadSlots=function(){
    const dateStr=document.getElementById('ict-date').value;
    const grid=document.getElementById('ict-slots-grid');
    if(!grid)return;
    if(!dateStr){grid.innerHTML='<div class="ict-no-slots">Seleccioná una fecha primero</div>';return;}
    const slots=getSlotsForDate(dateStr);
    const taken=getTakenSlots(dateStr);
    if(!slots.length){grid.innerHTML='<div class="ict-no-slots">No hay horarios para ese día</div>';return;}
    grid.innerHTML='';
    slots.forEach(function(t){
      const isTaken=taken.includes(t);
      const div=document.createElement('div');
      div.className='ict-slot'+(isTaken?' taken':'');
      div.textContent=t+(isTaken?' 🚫':'');
      if(!isTaken)div.onclick=function(){icarSelSlot(div,t);};
      grid.appendChild(div);
    });
    window._selSlot='';
    const selDiv=document.getElementById('ict-slot-selected');if(selDiv)selDiv.style.display='none';
  };
  window._selSlot='';window._selServ='';window._ictStep=0;

  window.icarSelSlot=function(el,time){
    document.querySelectorAll('.ict-slot').forEach(e=>e.classList.remove('sel'));
    el.classList.add('sel');
    window._selSlot=time;
    const selDiv=document.getElementById('ict-slot-selected');
    if(selDiv){selDiv.style.display='';selDiv.textContent='⏰ Seleccionaste: '+time;}
  };

  window.icarSetServ=function(el,serv){
    document.querySelectorAll('.icp-tserv').forEach(e=>e.classList.remove('sel'));
    el.classList.add('sel');
    window._selServ=serv;
  };

  window.icarNextStep=function(step){
    if(step===1){
      const date=document.getElementById('ict-date').value;
      if(!date){toast('⚠️ Elegí una fecha');return;}
      if(!window._selSlot){toast('⚠️ Elegí un horario disponible');return;}
      const resumen=document.getElementById('ict-resumen');
      if(resumen){
        const serv=window._selServ||'Sin especificar';
        resumen.innerHTML='<strong>📋 Resumen de tu reserva:</strong><br>📌 Servicio: '+serv+'<br>📅 Fecha: '+date+'<br>⏰ Horario: '+window._selSlot;
      }
    }
    window._ictStep=step;
    [0,1,2].forEach(i=>{
      const s=document.getElementById('ict-step-'+i);if(s)s.classList.toggle('active',i===step);
      const d=document.getElementById('sdot-'+i);if(d)d.classList.toggle('active',i===step);
    });
  };

  window.icarResetForm=function(){
    window._selSlot='';window._selServ='';window._ictStep=0;
    ['ict-name','ict-tel','ict-date','ict-msg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.querySelectorAll('.icp-tserv').forEach(e=>e.classList.remove('sel'));
    const grid=document.getElementById('ict-slots-grid');
    if(grid)grid.innerHTML='<div class="ict-no-slots">Seleccioná una fecha primero</div>';
    const selDiv=document.getElementById('ict-slot-selected');if(selDiv)selDiv.style.display='none';
  };

  window.icarSaveTurno=function(){
    const name=document.getElementById('ict-name').value.trim();
    const tel=document.getElementById('ict-tel').value.trim();
    const date=document.getElementById('ict-date').value;
    if(!name||!tel){toast('⚠️ Nombre y teléfono son requeridos');return;}
    if(!date||!window._selSlot){toast('⚠️ Falta fecha u horario');return;}
    const serv=window._selServ||'Consulta';
    const turno={id:Date.now(),name,tel,serv,date,time:window._selSlot,msg:document.getElementById('ict-msg').value.trim(),status:'pending',ts:new Date().toLocaleDateString('es-AR')};
    const t=gT();t.push(turno);sT(t);
    if(typeof pushNotif==='function')pushNotif('📅','Turno solicitado correctamente');
    const confirmTxt=document.getElementById('ict-confirm-txt');
    if(confirmTxt)confirmTxt.innerHTML='<strong>'+serv+'</strong><br>📅 '+date+' a las <strong>'+window._selSlot+'</strong><br>📱 Te contactamos al '+tel;
    icarNextStep(2);
  };

  // touch / drag support
  let dragStartX = 0;
  document.addEventListener('DOMContentLoaded', ()=>{
    updatePositions();
    renderIcarousel();
    const stage = document.querySelector('.icar-stage');
    if(!stage) return;
    stage.addEventListener('touchstart', e=>{ dragStartX = e.touches[0].clientX; }, {passive:true});
    stage.addEventListener('touchend', e=>{
      const dx = e.changedTouches[0].clientX - dragStartX;
      if(Math.abs(dx) > 40) icarRotate(dx < 0 ? 1 : -1);
    }, {passive:true});
  });
})();

function renderIcarousel(){
  // courses
  const courses = gc();
  const lvlC = {principiante:'lvl-b',intermedio:'lvl-i',avanzado:'lvl-a'};
  const cg = document.getElementById('icp-courses-grid');
  if(cg) cg.innerHTML = courses.map(c=>{
    const tot = (c.modules||[]).reduce((a,m)=>a+m.lessons.length, 0);
    const isFree=!c.price||c.price===''||c.price==='Gratis'||c.price==='0';
    const priceLbl=isFree?'Gratis':c.price;
    const thumbContent=c.coverImg?`<img src="${c.coverImg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(26,0,8,.5),transparent);"></div><span style="position:relative;z-index:1;font-size:38px;">${c.emoji}</span>`:c.emoji;
    const priceTag=`<span style="position:absolute;top:7px;right:7px;background:${isFree?'linear-gradient(135deg,#1a7a3a,#25a85a)':'linear-gradient(135deg,#B8860B,#DAA520)'};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:50px;z-index:2;">${priceLbl}</span>`;
    if(c.locked) return `<div class="icp-ccard" style="opacity:.55;cursor:default;"><div class="icp-thumb" style="background:${c.color};position:relative;">${thumbContent}${priceTag}</div><div class="icp-body"><span class="icp-tag">${c.levelLabel}</span><div class="icp-name">${c.title}</div><div class="icp-meta">🔒 Próximamente</div></div></div>`;
    return `<div class="icp-ccard" onclick="openAuth('r')"><div class="icp-thumb" style="background:${c.coverImg?'#0a0005':c.color};position:relative;">${thumbContent}${priceTag}</div><div class="icp-body"><span class="icp-tag">${c.levelLabel}</span><div class="icp-name">${c.title}</div><div class="icp-meta">📹 ${tot} clases · ${(c.modules||[]).length} módulos</div></div></div>`;
  }).join('');
  // ebooks
  const ebs = gEB();
  const eg = document.getElementById('icp-ebooks-grid');
  if(eg) eg.innerHTML = ebs.map(e=>`<div class="icp-ebook" onclick="openAuth('r')"><div class="icp-ecov" style="background:${e.color||'#8C0026'};">${e.emoji}</div><div class="icp-etit">${e.title}</div><div class="icp-eprice ${e.paid?'':'icp-efree'}">${e.price}</div><button class="icp-ebtn">${e.paid?'Comprar':'Descargar gratis'}</button></div>`).join('');
}


// ═══ DASHBOARD REAL STATS ═══
function calcAllProgress(){
  const courses = gc().filter(c => !c.locked && c.modules && c.modules.length);
  let totalLessons = 0, totalDone = 0, completedCourses = 0;
  const inProgress = [];
  courses.forEach(c => {
    const prog = getProgress(c.id);
    const lessons = (c.modules||[]).reduce((a,m) => a + m.lessons.length, 0);
    const done = (c.modules||[]).reduce((a,m) => a + m.lessons.filter(l => l.done || !!prog[l.id]).length, 0);
    totalLessons += lessons;
    totalDone += done;
    const pct = lessons > 0 ? Math.round(done / lessons * 100) : 0;
    if(pct === 100) completedCourses++;
    if(pct > 0 && pct < 100) inProgress.push({c, done, lessons, pct});
    if(pct === 0) inProgress.push({c, done:0, lessons, pct:0}); // show 0% too
  });
  return {totalLessons, totalDone, completedCourses, inProgress, courses};
}

function updateDashStats(){
  const {totalLessons, totalDone, completedCourses, inProgress, courses} = calcAllProgress();
  const activeCourses = courses.filter(c => {
    const prog = getProgress(c.id);
    const lessons = (c.modules||[]).reduce((a,m) => a + m.lessons.length, 0);
    const done = (c.modules||[]).reduce((a,m) => a + m.lessons.filter(l => l.done || !!prog[l.id]).length, 0);
    return done > 0;
  }).length;
  const pct = totalLessons > 0 ? Math.round(totalDone / totalLessons * 100) : 0;
  const sv = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  sv('stat-active', activeCourses);
  sv('stat-active-sub', `de ${courses.length} disponibles`);
  sv('stat-done', totalDone);
  sv('stat-done-sub', `de ${totalLessons} clases`);
  sv('stat-pct', pct + '%');
  sv('stat-pct-sub', 'en todos los cursos');
  sv('stat-certs', completedCourses);
  sv('stat-certs-sub', completedCourses === 1 ? 'curso completado' : 'cursos completados');
  // continue cards
  renderContinueCards(inProgress);
  // progress page
  renderProgressPage(pct, totalDone, totalLessons);
}

function renderContinueCards(inProgress){
  const wrap = document.getElementById('cc-wrap-dynamic');
  const hdg = document.getElementById('cc-heading');
  if(!wrap) return;
  const showing = inProgress.filter(x => x.pct > 0).sort((a,b) => b.pct - a.pct).slice(0, 4);
  if(!showing.length){
    if(hdg) hdg.style.display = 'none';
    wrap.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:12px 0;">Aún no comenzaste ningún curso. ¡Explorá los disponibles arriba!</div>';
    return;
  }
  if(hdg) hdg.style.display = '';
  wrap.innerHTML = showing.map(({c, done, lessons, pct}) => {
    const nextLesson = findNextLesson(c);
    const nextTxt = nextLesson ? nextLesson.title : 'Continuar';
    return `<div class="cc" onclick="openViewer(${c.id})">
      <div class="cc-thumb">${c.emoji}</div>
      <div style="flex:1;min-width:0;">
        <div class="cc-title">${c.title}</div>
        <div class="cc-meta">${nextTxt}</div>
        <div class="pb"><div class="pf" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;">
          <div class="pl">${pct}% completado</div>
          ${pct===100 ? '<button class="cert-badge" onclick="event.stopPropagation();showCert('+c.id+')">🏆 Certificado</button>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function findNextLesson(c){
  const prog = getProgress(c.id);
  for(const m of (c.modules||[])){
    for(const l of (m.lessons||[])){
      if(!l.done && !prog[l.id]) return l;
    }
  }
  return null;
}

function renderProgressPage(totalPct, totalDone, totalLessons){
  const tb = document.getElementById('prog-total-bar');
  const tp = document.getElementById('prog-total-pct');
  const ts = document.getElementById('prog-total-sub');
  if(tb) tb.style.width = totalPct + '%';
  if(tp) tp.textContent = totalPct + '%';
  if(ts) ts.textContent = totalDone + ' de ' + totalLessons + ' clases completadas';
  const list = document.getElementById('prog-courses-list');
  if(!list) return;
  const courses = gc().filter(c => !c.locked && c.modules && c.modules.length);
  list.innerHTML = courses.map(c => {
    const prog = getProgress(c.id);
    const lessons = (c.modules||[]).reduce((a,m) => a + m.lessons.length, 0);
    const done = (c.modules||[]).reduce((a,m) => a + m.lessons.filter(l => l.done || !!prog[l.id]).length, 0);
    const pct = lessons > 0 ? Math.round(done / lessons * 100) : 0;
    return `<div class="prog-course-row">
      <div class="pcr-emoji">${c.emoji}</div>
      <div class="pcr-info">
        <div class="pcr-title">${c.title}</div>
        <div class="pcr-bar"><div class="pcr-fill" style="width:${pct}%"></div></div>
        <div class="pcr-meta">${done} de ${lessons} clases · ${(c.modules||[]).length} módulos</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="pcr-pct">${pct}%</div>
        ${pct===100 ? '<button class="cert-badge" onclick="showCert('+c.id+')">🏆 Ver certificado</button>' : '<button class="btn-crimson" style="font-size:12px;padding:6px 14px;" onclick="openViewer('+c.id+')">Continuar →</button>'}
      </div>
    </div>`;
  }).join('');
}

// ═══ SEARCH ═══
function filterCoursesSearch(q){
  const btn = document.getElementById('search-clear');
  if(btn) btn.style.display = q ? '' : 'none';
  renderCarouselCourses('todos', q);
}
function clearSearch(){
  const inp = document.getElementById('course-search');
  if(inp){inp.value='';inp.dispatchEvent(new Event('input'));}
}

// ═══ CERTIFICADO ═══
let certCourseId = null;
function showCert(courseId){
  certCourseId = courseId;
  const c = gc().find(x => x.id === courseId);
  if(!c) return;
  drawCertificate(c, currentUser);
  document.getElementById('cert-wrap').classList.add('open');
}
function closeCert(){
  document.getElementById('cert-wrap').classList.remove('open');
}
function drawCertificate(course, user){
  const canvas = document.getElementById('cert-canvas');
  const ctx = canvas.getContext('2d');
  const W = 700, H = 495;
  // Background
  ctx.fillStyle = '#FFF8F0';
  ctx.fillRect(0, 0, W, H);
  // Crimson border
  ctx.strokeStyle = '#8C0026';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W-14, H-14);
  // Gold inner border
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W-40, H-40);
  // Corner ornaments
  const corners = [[30,30],[W-30,30],[30,H-30],[W-30,H-30]];
  ctx.fillStyle = '#C9A84C';
  corners.forEach(([x,y]) => {
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
  });
  // Top decorative line
  ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 75); ctx.lineTo(W-60, 75); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(60, 78); ctx.lineTo(W-60, 78); ctx.stroke();
  // MIRA ESTUDIO
  ctx.fillStyle = '#8C0026';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('MIRA  ESTUDIO', W/2, 62);
  // Emoji
  ctx.font = '44px serif';
  ctx.fillText(course.emoji, W/2, 140);
  // CERTIFICADO
  ctx.fillStyle = '#3B000F';
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillText('Certificado de finalización', W/2, 185);
  // Bottom line
  ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 198); ctx.lineTo(W-60, 198); ctx.stroke();
  // OTORGADO A
  ctx.fillStyle = '#7A4A52';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('OTORGADO A', W/2, 225);
  // NAME
  ctx.fillStyle = '#1A0008';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(user ? user.name : 'Alumna', W/2, 272);
  // underline
  const nm = user ? user.name : 'Alumna';
  const nw = ctx.measureText(nm).width;
  ctx.strokeStyle = '#8C0026'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W/2 - nw/2, 278); ctx.lineTo(W/2 + nw/2, 278); ctx.stroke();
  // por haber completado
  ctx.fillStyle = '#7A4A52';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('por haber completado satisfactoriamente el curso', W/2, 308);
  // COURSE NAME
  ctx.fillStyle = '#8C0026';
  ctx.font = 'bold italic 24px Georgia, serif';
  ctx.fillText(course.title, W/2, 348);
  // bottom line
  ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 368); ctx.lineTo(W-60, 368); ctx.stroke();
  // Date + level
  const date = new Date().toLocaleDateString('es-AR',{year:'numeric',month:'long',day:'numeric'});
  ctx.fillStyle = '#7A4A52'; ctx.font = '12px Arial, sans-serif';
  ctx.fillText(date, W/2, 395);
  ctx.fillStyle = '#9A7A2A'; ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillText('NIVEL: ' + (course.levelLabel||'').toUpperCase(), W/2, 415);
  // signature line left
  ctx.strokeStyle = '#8C0026'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(90, 455); ctx.lineTo(250, 455); ctx.stroke();
  ctx.fillStyle = '#7A4A52'; ctx.font = '10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Instructora', 170, 470);
  // signature line right
  ctx.beginPath(); ctx.moveTo(450, 455); ctx.lineTo(610, 455); ctx.stroke();
  ctx.fillText('Directora Académica', 530, 470);
  // Gold seal
  const cx2 = W/2, cy2 = 458, r = 22;
  const grad = ctx.createRadialGradient(cx2-5, cy2-5, 2, cx2, cy2, r);
  grad.addColorStop(0,'#EDD872'); grad.addColorStop(1,'#9A7A2A');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#8C0026'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx2, cy2, r+2, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillText('✓', cx2, cy2+4);
}
function downloadCert(){
  const canvas = document.getElementById('cert-canvas');
  const c = gc().find(x => x.id === certCourseId);
  const link = document.createElement('a');
  link.download = 'certificado-' + (c ? c.title.replace(/\s+/g,'-').toLowerCase() : 'curso') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}


// ═══ NOTAS POR CLASE ═══
let noteSaveTimer = null;

function getNoteKey(courseId, lessonId){ return 'note_' + courseId + '_' + lessonId; }

function loadNote(courseId, lessonId){
  const ta = document.getElementById('notes-textarea');
  const sec = document.getElementById('notes-section');
  if(!ta || !sec) return;
  sec.style.display = '';
  ta.value = localStorage.getItem(getNoteKey(courseId, lessonId)) || '';
  const saved = document.getElementById('notes-saved');
  if(saved) saved.classList.remove('show');
}

function saveNote(){
  const flat = lessonFlat[lessonIdx];
  if(!flat) return;
  const c = gc().find(x => x.id === currentCourseId);
  const m = c && c.modules[flat.mi];
  const l = m && m.lessons[flat.li];
  if(!l) return;
  const ta = document.getElementById('notes-textarea');
  if(!ta) return;
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => {
    localStorage.setItem(getNoteKey(currentCourseId, l.id), ta.value);
    const saved = document.getElementById('notes-saved');
    if(saved){ saved.classList.add('show'); setTimeout(()=>saved.classList.remove('show'), 2000); }
  }, 600);
}

// ═══ ANALÍTICAS ═══
function renderAnalytics(){
  const courses = gc().filter(c => !c.locked && c.modules && c.modules.length);
  const users = gU();
  const turnos = gT();

  // calc progress per course
  const courseStats = courses.map(c => {
    const total = (c.modules||[]).reduce((a,m) => a + m.lessons.length, 0);
    const prog = getProgress(c.id);
    const done = (c.modules||[]).reduce((a,m) => a + m.lessons.filter(l => l.done || !!prog[l.id]).length, 0);
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const started = done > 0 ? 1 : 0; // simplified (single user localStorage)
    return { c, total, done, pct, started };
  });

  const totalDone = courseStats.reduce((a,x) => a + x.done, 0);
  const totalLessons = courseStats.reduce((a,x) => a + x.total, 0);
  const completedCourses = courseStats.filter(x => x.pct === 100).length;
  const pendingTurnos = turnos.filter(t => !t.status || t.status === 'pending').length;

  // stats grid
  const sg = document.getElementById('an-stats-grid');
  if(sg) sg.innerHTML = [
    {num: users.length, lbl:'Alumnas registradas', icon:'👥'},
    {num: courses.length, lbl:'Cursos activos', icon:'📚'},
    {num: turnos.length, lbl:'Turnos recibidos', icon:'📅'},
    {num: totalDone, lbl:'Clases completadas', icon:'✅'},
    {num: pendingTurnos, lbl:'Turnos pendientes', icon:'⏳'},
    {num: completedCourses, lbl:'Cursos terminados', icon:'🏆'},
  ].map(s => `<div class="an-stat"><div style="font-size:26px;margin-bottom:8px;">${s.icon}</div><div class="an-stat-num">${s.num}</div><div class="an-stat-lbl">${s.lbl}</div></div>`).join('');

  // courses progress chart
  const cc = document.getElementById('an-courses-chart');
  if(cc){
    if(!courseStats.length){ cc.innerHTML = '<div class="an-empty">No hay cursos disponibles aún.</div>'; }
    else {
      cc.innerHTML = courseStats.map(({c,done,total,pct}) => {
        const color = pct===100 ? '#C9A84C' : pct>=50 ? '#8C0026' : '#B0003A';
        return `<div class="an-bar-row">
          <div class="an-bar-label" title="${c.title}">${c.emoji} ${c.title}</div>
          <div class="an-bar-track">
            <div class="an-bar-fill" style="width:${pct}%;background:${color};"></div>
          </div>
          <div class="an-bar-val">${pct}%</div>
        </div>`;
      }).join('') + `<div class="an-legend">
        <div class="an-leg-item"><div class="an-leg-dot" style="background:#C9A84C;"></div>Completado (100%)</div>
        <div class="an-leg-item"><div class="an-leg-dot" style="background:#8C0026;"></div>En progreso (≥50%)</div>
        <div class="an-leg-item"><div class="an-leg-dot" style="background:#B0003A;"></div>Iniciado (&lt;50%)</div>
      </div>`;
    }
  }

  // popular chart (by total lessons = depth indicator)
  const pc = document.getElementById('an-popular-chart');
  if(pc){
    const sorted = [...courseStats].sort((a,b) => b.total - a.total);
    const max = sorted[0]?.total || 1;
    pc.innerHTML = sorted.map(({c,total}) => `<div class="an-bar-row">
      <div class="an-bar-label" title="${c.title}">${c.emoji} ${c.title}</div>
      <div class="an-bar-track">
        <div class="an-bar-fill" style="width:${Math.round(total/max*100)}%;background:linear-gradient(90deg,#8C0026,#C9A84C);"></div>
      </div>
      <div class="an-bar-val">${total} cls</div>
    </div>`).join('');
  }

  // turnos chart
  const tc = document.getElementById('an-turnos-chart');
  if(tc){
    if(!turnos.length){ tc.innerHTML='<div class="an-empty">No hay turnos recibidos aún.</div>'; }
    else {
      const byStatus = {pending:0, confirmed:0, cancelled:0};
      turnos.forEach(t => { const s = t.status||'pending'; byStatus[s] = (byStatus[s]||0)+1; });
      const byServ = {};
      turnos.forEach(t => { byServ[t.serv] = (byServ[t.serv]||0)+1; });
      const maxS = Math.max(...Object.values(byServ)) || 1;
      tc.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <div class="turno-status ts-pending" style="cursor:default;">⏳ Pendientes: ${byStatus.pending}</div>
          <div class="turno-status ts-confirmed" style="cursor:default;">✅ Confirmados: ${byStatus.confirmed}</div>
          <div class="turno-status ts-cancelled" style="cursor:default;">❌ Cancelados: ${byStatus.cancelled}</div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px;">Por servicio</div>
        ${Object.entries(byServ).sort((a,b)=>b[1]-a[1]).map(([serv,cnt])=>`<div class="an-bar-row">
          <div class="an-bar-label">${serv}</div>
          <div class="an-bar-track"><div class="an-bar-fill" style="width:${Math.round(cnt/maxS*100)}%;background:#25D366;"></div></div>
          <div class="an-bar-val">${cnt}</div>
        </div>`).join('')}`;
    }
  }
}

// ═══ TURNOS CON ESTADOS Y WHATSAPP ═══
function admRenderTurnosList(){
  const turnos = gT();
  const el = document.getElementById('adm-turnos-content');
  if(!el) return;
  if(!turnos.length){
    el.innerHTML = '<div class="acard" style="text-align:center;padding:40px;"><div style="font-size:40px;margin-bottom:12px;">📅</div><p style="color:var(--muted);">Aún no hay solicitudes de turno.</p></div>';
    return;
  }

  const statusLabel = { pending:'⏳ Pendiente', confirmed:'✅ Confirmado', cancelled:'❌ Cancelado' };
  const statusClass = { pending:'ts-pending', confirmed:'ts-confirmed', cancelled:'ts-cancelled' };

  el.innerHTML = `<div class="acard" style="overflow-x:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="font-size:13px;color:var(--muted);">${turnos.length} solicitud${turnos.length!==1?'es':''} recibida${turnos.length!==1?'s':''}</div>
      <button class="abtn" onclick="exportTurnosCSV()" style="font-size:12px;padding:6px 14px;">⬇ Exportar CSV</button>
    </div>
    <table class="atbl">
      <thead><tr><th>Alumna</th><th>WhatsApp</th><th>Servicio</th><th>Fecha</th><th>Mensaje</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>${turnos.map(t => {
        const st = t.status || 'pending';
        return `<tr id="trow-${t.id}">
          <td><strong>${t.name}</strong><br><span style="font-size:11px;color:var(--muted);">${t.ts||''}</span></td>
          <td>
            <div style="font-size:13px;">${t.tel}</div>
            <button class="wa-btn" style="margin-top:4px;" onclick="openWhatsApp('${t.tel}','${(t.name||'').replace(/'/g,'')}','${(t.serv||'').replace(/'/g,'')}','${t.date||''}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.09.537 4.054 1.474 5.762L0 24l6.39-1.446A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6c-1.969 0-3.81-.528-5.39-1.443l-.386-.228-4.002.906.924-3.893-.253-.4A9.56 9.56 0 012.4 12C2.4 6.698 6.698 2.4 12 2.4S21.6 6.698 21.6 12 17.302 21.6 12 21.6z"/></svg>
              WhatsApp
            </button>
          </td>
          <td><span class="adm-badge">${t.serv}</span></td>
          <td style="font-size:13px;">${t.date||'—'}</td>
          <td style="max-width:160px;font-size:12px;color:var(--muted);">${t.msg||'—'}</td>
          <td>
            <select class="turno-status ${statusClass[st]}" onchange="changeTurnoStatus(${t.id},this.value,this)" style="border:none;outline:none;cursor:pointer;font-size:11px;font-weight:600;padding:4px 8px;border-radius:50px;font-family:var(--fb);">
              <option value="pending" ${st==='pending'?'selected':''}>⏳ Pendiente</option>
              <option value="confirmed" ${st==='confirmed'?'selected':''}>✅ Confirmado</option>
              <option value="cancelled" ${st==='cancelled'?'selected':''}>❌ Cancelado</option>
            </select>
          </td>
          <td><button class="abtn-del" onclick="admDeleteTurno(${t.id})">✕</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
}

function admDeleteTurno(id){
  if(!confirm('¿Eliminar este turno?'))return;
  const t=gT().filter(x=>x.id!==id);sT(t);admRenderTurnosList();toast('Turno eliminado');
}
function changeTurnoStatus(id, newStatus, selectEl){
  const turnos = gT();
  const t = turnos.find(x => x.id === id);
  if(!t) return;
  t.status = newStatus;
  sT(turnos);
  const classMap = {pending:'ts-pending',confirmed:'ts-confirmed',cancelled:'ts-cancelled'};
  selectEl.className = 'turno-status ' + (classMap[newStatus]||'ts-pending');
  toast(newStatus==='confirmed'?'✅ Turno confirmado':newStatus==='cancelled'?'❌ Turno cancelado':'⏳ Marcado como pendiente');
}

function openWhatsApp(tel, name, serv, date){
  const clean = tel.replace(/[^0-9+]/g,'');
  const msg = encodeURIComponent('Hola ' + name + '! Te confirmamos tu turno de ' + serv + (date?' para el '+date:'') + '. Mira Estudio ✨');
  window.open('https://wa.me/' + clean.replace('+','') + '?text=' + msg, '_blank');
}

function exportTurnosCSV(){
  const turnos = gT();
  if(!turnos.length){ toast('No hay turnos para exportar'); return; }
  const rows = [['Nombre','Teléfono','Servicio','Fecha','Estado','Mensaje','Recibido']];
  turnos.forEach(t => rows.push([t.name||'',t.tel||'',t.serv||'',t.date||'',t.status||'pending',t.msg||'',t.ts||'']));
  const csv = rows.map(r => r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'turnos-mira-estudio.csv';
  a.click();
  toast('✅ CSV exportado');
}


// ═══ COVER IMAGE UPLOAD (Cloudinary) ═══
async function onCoverImgChange(e){
  const file=e.target.files[0];if(!file)return;
  const dropEl=document.getElementById('cover-drop');
  if(dropEl) dropEl.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;">☁ Subiendo...<br><span id="cov-pct" style="font-size:22px;font-weight:700;color:var(--gold);">0%</span></div>';
  try{
    const url=await uploadToCloudinary(file,'cursos',pct=>{
      const el=document.getElementById('cov-pct');if(el)el.textContent=pct+'%';
    });
    const dataEl=document.getElementById('ce-cover-data');if(dataEl)dataEl.value=url;
    if(dropEl){
      dropEl.classList.add('has-img');
      dropEl.innerHTML=`<img class="cover-preview" src="${url}" id="cover-preview-img"><button class="cover-clear-btn" onclick="event.stopPropagation();clearCoverImg()">✕</button><input type="file" class="cover-upload-input" id="ce-cover-inp" accept="image/*" onchange="onCoverImgChange(event)">`;
    }
    toast('✅ Portada subida a la nube');
  }catch(err){
    toast('❌ '+err.message);
    if(dropEl){dropEl.classList.remove('has-img');dropEl.innerHTML='<div style="font-size:32px;">🖼</div><div class="cover-upload-lbl">Subir imagen de portada</div><div style="font-size:11px;color:var(--muted);">JPG, PNG o WebP · hasta 10MB</div><input type="file" class="cover-upload-input" id="ce-cover-inp" accept="image/*" onchange="onCoverImgChange(event)">';}
  }
}

function clearCoverImg(){
  const dataEl=document.getElementById('ce-cover-data');if(dataEl)dataEl.value='';
  const dropEl=document.getElementById('cover-drop');
  if(dropEl){
    dropEl.className='cover-upload-area';
    dropEl.innerHTML=`<div style="font-size:32px;">🖼</div><div class="cover-upload-lbl">Subir imagen de portada</div><div class="cover-upload-hint">JPG, PNG o WebP · Recomendado 800×450px</div><input type="file" class="cover-upload-input" id="ce-cover-inp" accept="image/*" onchange="onCoverImgChange(event)">`;
  }
}

// ═══ ATTACHMENTS ═══
function fileIcon(type){
  if(!type)return '📄';
  const t=type.toLowerCase();
  if(t.match(/pdf/))return '📄';
  if(t.match(/word|doc/))return '📝';
  if(t.match(/excel|xls/))return '📊';
  if(t.match(/ppt|powerpoint/))return '📑';
  if(t.match(/jpg|jpeg|png|gif|webp|image/))return '🖼';
  if(t.match(/mp4|video/))return '🎬';
  if(t.match(/zip|rar/))return '🗜';
  return '📎';
}
function formatFileSize(bytes){
  if(bytes<1024)return bytes+'B';
  if(bytes<1024*1024)return Math.round(bytes/1024)+'KB';
  return (bytes/1024/1024).toFixed(1)+'MB';
}
function admAttachFiles(e,modId,lesId){
  const files=Array.from(e.target.files);if(!files.length)return;
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  const m=(c.modules||[]).find(x=>x.id===modId);if(!m)return;
  const l=(m.lessons||[]).find(x=>x.id===lesId);if(!l)return;
  if(!l.attachments)l.attachments=[];
  let pending=files.length;
  files.forEach(file=>{
    if(file.size>5*1024*1024){toast('⚠️ '+file.name+' supera 5MB');pending--;if(!pending)afterAttach(c,m,l,courses);return;}
    const reader=new FileReader();
    reader.onload=ev=>{
      l.attachments.push({name:file.name,type:file.type,size:formatFileSize(file.size),data:ev.target.result});
      pending--;if(!pending)afterAttach(c,m,l,courses);
    };
    reader.readAsDataURL(file);
  });
}
function afterAttach(c,m,l,courses){
  sc(courses);
  const listEl=document.getElementById('lattach-'+m.id+'-'+l.id);
  if(listEl)listEl.innerHTML=(l.attachments||[]).map((a,ai)=>`<div class="les-attach-item"><span style="font-size:17px;">${fileIcon(a.type)}</span><span class="les-attach-name" title="${a.name}">${a.name}</span><span class="les-attach-size">${a.size||''}</span><button class="les-attach-del" onclick="admDelAttach('${m.id}','${l.id}',${ai})" title="Eliminar">✕</button></div>`).join('');
  toast('✅ '+l.attachments.length+' archivo'+(l.attachments.length!==1?'s':'')+' adjunto'+(l.attachments.length!==1?'s':''));
}
function admDelAttach(modId,lesId,idx){
  admFlushEdits();
  const courses=gc();const c=courses.find(x=>x.id===admCurEditId);if(!c)return;
  const m=(c.modules||[]).find(x=>x.id===modId);if(!m)return;
  const l=(m.lessons||[]).find(x=>x.id===lesId);if(!l||!l.attachments)return;
  l.attachments.splice(idx,1);sc(courses);
  const listEl=document.getElementById('lattach-'+modId+'-'+lesId);
  if(listEl)listEl.innerHTML=(l.attachments||[]).map((a,ai)=>`<div class="les-attach-item"><span style="font-size:17px;">${fileIcon(a.type)}</span><span class="les-attach-name" title="${a.name}">${a.name}</span><span class="les-attach-size">${a.size||''}</span><button class="les-attach-del" onclick="admDelAttach('${modId}','${lesId}',${ai})" title="Eliminar">✕</button></div>`).join('');
  toast('Archivo eliminado');
}
function downloadAttachment(name,data){
  if(!data){toast('Sin archivo disponible');return;}
  const a=document.createElement('a');a.href=data;a.download=name;a.click();
}

// ═══ COURSE COVER in openViewer ═══
function applyCourseThumbToViewer(c){
  const vtop = document.getElementById('vtop-cover');
  if(!vtop) return;
  if(c.coverImg){
    vtop.style.backgroundImage=`url('${c.coverImg}')`;
    vtop.style.backgroundSize='cover';
    vtop.style.backgroundPosition='center';
    vtop.style.opacity='0.18';
    vtop.style.display='';
  } else {
    vtop.style.display='none';
  }
}


// ═══════════════════════════════════════════════════════
// DRAG & DROP — cursos / módulos / clases
// ═══════════════════════════════════════════════════════

/* ── Utilidades generales ── */
let _dndGhost = null;

function dndCreateGhost(text) {
  _dndGhost = document.createElement('div');
  _dndGhost.className = 'dnd-ghost';
  _dndGhost.textContent = text;
  document.body.appendChild(_dndGhost);
}
function dndMoveGhost(e) {
  if (!_dndGhost) return;
  _dndGhost.style.left = (e.clientX + 16) + 'px';
  _dndGhost.style.top  = (e.clientY - 10) + 'px';
}
function dndRemoveGhost() {
  if (_dndGhost) { _dndGhost.remove(); _dndGhost = null; }
}

/* Limpia todas las clases de estado */
function dndClearStates(container, className) {
  container.querySelectorAll('.' + className).forEach(el => {
    el.classList.remove('is-dragging','drag-over-top','drag-over-bottom');
  });
}

/* Devuelve 'top' o 'bottom' según posición del puntero */
function dndHalf(e, el) {
  const r = el.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
}

/* Reordena array moviendo elemento de fromIdx a toIdx */
function dndReorder(arr, fromIdx, toIdx) {
  if (fromIdx === toIdx) return arr;
  const next = [...arr];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

/* ─────────────────────────────────────────────────────── */
/* 1. CURSOS                                               */
/* ─────────────────────────────────────────────────────── */
function initDragCourses() {
  const container = document.getElementById('dnd-course-container');
  if (!container) return;

  let dragSrcId = null;

  container.querySelectorAll('.dnd-course-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragSrcId = card.dataset.cid;
      card.classList.add('is-dragging');
      const titleEl = card.querySelector('[style*="font-family:var(--fd)"]');
      const title   = titleEl ? titleEl.textContent.trim() : 'Curso';
      dndCreateGhost('📚 ' + title);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(new Image(), 0, 0);  // invisible default ghost
    });

    card.addEventListener('drag', dndMoveGhost);

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      dndClearStates(container, 'dnd-course-card');
      dndRemoveGhost();
      dragSrcId = null;
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card.dataset.cid === dragSrcId) return;
      dndClearStates(container, 'dnd-course-card');
      const half = dndHalf(e, card);
      card.classList.add(half === 'top' ? 'drag-over-top' : 'drag-over-bottom');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top','drag-over-bottom');
    });

    card.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrcId || card.dataset.cid === dragSrcId) return;

      const half     = dndHalf(e, card);
      const courses  = gc();
      const fromIdx  = courses.findIndex(c => String(c.id) === String(dragSrcId));
      let   toIdx    = courses.findIndex(c => String(c.id) === String(card.dataset.cid));
      if (fromIdx < 0 || toIdx < 0) return;

      // Ajustar índice destino según mitad
      if (half === 'bottom' && toIdx < fromIdx) toIdx++;
      if (half === 'top'    && toIdx > fromIdx) toIdx--;

      const reordered = dndReorder(courses, fromIdx, toIdx);
      sc(reordered);
      admRenderCursosList();
      toast('✅ Cursos reordenados');
    });
  });
}

/* ─────────────────────────────────────────────────────── */
/* 2. MÓDULOS (dentro del editor de curso)                 */
/* ─────────────────────────────────────────────────────── */
function initDragModules() {
  const wrap = document.getElementById('dnd-mods-wrap');
  if (!wrap) return;

  const cid = (() => {
    const hint = document.getElementById('dnd-mod-container');
    return hint ? hint.dataset.cid : null;
  })();

  let dragSrcMid = null;

  wrap.querySelectorAll('.mod-acc').forEach(modEl => {
    modEl.addEventListener('dragstart', e => {
      // Don't start drag if clicking inside inputs / buttons
      if (e.target.closest('input,textarea,button,select,a')) { e.preventDefault(); return; }
      dragSrcMid = modEl.dataset.mid;
      modEl.classList.add('is-dragging');
      const nameEl = modEl.querySelector('.mod-acc-hdr span:nth-child(3)');
      const name   = nameEl ? nameEl.textContent.trim() : 'Módulo';
      dndCreateGhost('📂 ' + name);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(new Image(), 0, 0);
      e.stopPropagation();
    });

    modEl.addEventListener('drag', dndMoveGhost);

    modEl.addEventListener('dragend', () => {
      modEl.classList.remove('is-dragging');
      wrap.querySelectorAll('.mod-acc').forEach(m =>
        m.classList.remove('drag-over-top','drag-over-bottom'));
      dndRemoveGhost();
      dragSrcMid = null;
    });

    modEl.addEventListener('dragover', e => {
      if (!dragSrcMid) return;
      e.preventDefault();
      e.stopPropagation();
      if (modEl.dataset.mid === dragSrcMid) return;
      wrap.querySelectorAll('.mod-acc').forEach(m =>
        m.classList.remove('drag-over-top','drag-over-bottom'));
      modEl.classList.add(dndHalf(e, modEl) === 'top' ? 'drag-over-top' : 'drag-over-bottom');
    });

    modEl.addEventListener('dragleave', e => {
      if (!e.relatedTarget || !modEl.contains(e.relatedTarget))
        modEl.classList.remove('drag-over-top','drag-over-bottom');
    });

    modEl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragSrcMid || modEl.dataset.mid === dragSrcMid) return;

      admFlushEdits();           // guardar textos antes de reordenar
      const courses  = gc();
      const course   = courses.find(c => String(c.id) === String(admCurEditId));
      if (!course) return;

      const half    = dndHalf(e, modEl);
      const mods    = course.modules || [];
      const fromIdx = mods.findIndex(m => m.id === dragSrcMid);
      let   toIdx   = mods.findIndex(m => m.id === modEl.dataset.mid);
      if (fromIdx < 0 || toIdx < 0) return;

      if (half === 'bottom' && toIdx < fromIdx) toIdx++;
      if (half === 'top'    && toIdx > fromIdx) toIdx--;

      course.modules = dndReorder(mods, fromIdx, toIdx);
      sc(courses);

      // Re-render only modules section
      const ceModules = document.getElementById('ce-modules');
      if (ceModules) {
        ceModules.innerHTML = admRenderModsInline(course);
        initDragModules();
        // Re-open all previously open module bodies
        course.modules.forEach(m => {
          const b = document.getElementById('mab-' + m.id);
          if (b) b.classList.add('open');
        });
      }
      toast('✅ Módulos reordenados');
    });
  });
}

/* ─────────────────────────────────────────────────────── */
/* 3. CLASES (dentro de cada módulo)                       */
/* ─────────────────────────────────────────────────────── */
function initDragLessons(modId) {
  const listEl = document.getElementById('llist-' + modId);
  if (!listEl) return;

  let dragSrcLid = null;

  listEl.querySelectorAll('.les-card').forEach(lesEl => {
    lesEl.addEventListener('dragstart', e => {
      if (e.target.closest('input,textarea,button,select,a,label')) { e.preventDefault(); return; }
      dragSrcLid = lesEl.dataset.lid;
      lesEl.classList.add('is-dragging');
      const inp = lesEl.querySelector('.les-card-title-inp');
      dndCreateGhost('🎬 ' + (inp ? inp.value.trim() : 'Clase'));
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(new Image(), 0, 0);
      e.stopPropagation();
    });

    lesEl.addEventListener('drag', dndMoveGhost);

    lesEl.addEventListener('dragend', () => {
      lesEl.classList.remove('is-dragging');
      listEl.querySelectorAll('.les-card').forEach(l =>
        l.classList.remove('drag-over-top','drag-over-bottom'));
      dndRemoveGhost();
      dragSrcLid = null;
    });

    lesEl.addEventListener('dragover', e => {
      if (!dragSrcLid) return;
      e.preventDefault();
      e.stopPropagation();
      if (lesEl.dataset.lid === dragSrcLid) return;
      listEl.querySelectorAll('.les-card').forEach(l =>
        l.classList.remove('drag-over-top','drag-over-bottom'));
      lesEl.classList.add(dndHalf(e, lesEl) === 'top' ? 'drag-over-top' : 'drag-over-bottom');
    });

    lesEl.addEventListener('dragleave', e => {
      if (!e.relatedTarget || !lesEl.contains(e.relatedTarget))
        lesEl.classList.remove('drag-over-top','drag-over-bottom');
    });

    lesEl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragSrcLid || lesEl.dataset.lid === dragSrcLid) return;

      admFlushEdits();
      const courses = gc();
      const course  = courses.find(c => String(c.id) === String(admCurEditId));
      if (!course) return;
      const mod = (course.modules || []).find(m => m.id === modId);
      if (!mod) return;

      const half    = dndHalf(e, lesEl);
      const lsns    = mod.lessons || [];
      const fromIdx = lsns.findIndex(l => l.id === dragSrcLid);
      let   toIdx   = lsns.findIndex(l => l.id === lesEl.dataset.lid);
      if (fromIdx < 0 || toIdx < 0) return;

      if (half === 'bottom' && toIdx < fromIdx) toIdx++;
      if (half === 'top'    && toIdx > fromIdx) toIdx--;

      mod.lessons = dndReorder(lsns, fromIdx, toIdx);
      sc(courses);

      // Re-render only this lesson list
      const wasOpen = lesEl.closest('.mod-acc-body') &&
                      lesEl.closest('.mod-acc-body').classList.contains('open');
      listEl.innerHTML = admRenderModsInline(course)
        .replace(/^[\s\S]*?(<div class="les-card")/,'$1');   // fallback

      // Simpler: just re-render whole module accordion
      const modWrap = document.getElementById('dnd-mods-wrap');
      if (modWrap) {
        modWrap.innerHTML = admRenderModsInline(course)
          .replace(/^[\s\S]*<div id="dnd-mods-wrap">/, '')
          .replace(/<\/div>$/, '');
      }
      // Full re-render of modules section
      const ceModules = document.getElementById('ce-modules');
      if (ceModules) {
        ceModules.innerHTML = admRenderModsInline(course);
        initDragModules();
        // Re-open the module we were editing
        const body = document.getElementById('mab-' + modId);
        if (body) body.classList.add('open');
        // Re-init drag lessons for all modules
        (course.modules||[]).forEach(m => initDragLessons(m.id));
      }
      toast('✅ Clases reordenadas');
    });
  });
}

/* ─────────────────────────────────────────────────────── */
/* Patch admTogModAcc → también inicia drag en clases      */
/* ─────────────────────────────────────────────────────── */
const _origAdmTogModAcc = admTogModAcc;
admTogModAcc = function(modId) {
  _origAdmTogModAcc(modId);
  // After toggling open, init lessons drag
  const body = document.getElementById('mab-' + modId);
  if (body && body.classList.contains('open')) {
    setTimeout(() => initDragLessons(modId), 50);
  }
};

/* ─────────────────────────────────────────────────────── */
/* Patch admCursoForm → llama initDragModules tras render  */
/* ─────────────────────────────────────────────────────── */
// override removed

/* Patch admAddModule / admAddLesson to re-init drag */
const _origAdmAddModule = admAddModule;
admAddModule = function() {
  _origAdmAddModule();
  setTimeout(initDragModules, 80);
};

const _origAdmAddLesson = admAddLesson;
admAddLesson = function(modId) {
  _origAdmAddLesson(modId);
  setTimeout(() => initDragLessons(modId), 80);
};


// ═══ NOTIFICATIONS ═══
const KN = 'ms_notifs';
function getNotifs(){ try{return JSON.parse(localStorage.getItem(KN)||'[]');}catch(e){return[];} }
function saveNotifs(n){ localStorage.setItem(KN, JSON.stringify(n)); }
function pushNotif(icon, title){
  const n = getNotifs();
  n.unshift({id:Date.now(), icon, title, time:new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}), read:false});
  if(n.length>30) n.length=30;
  saveNotifs(n);
  renderNotifPanel();
}
function renderNotifPanel(){
  const n = getNotifs();
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');
  const unread = n.filter(x=>!x.read).length;
  if(badge){ badge.textContent=unread; badge.className='notif-badge'+(unread?' show':''); }
  if(!list) return;
  if(!n.length){ list.innerHTML='<div class="notif-empty">No hay notificaciones</div>'; return; }
  list.innerHTML = n.map(x=>`<div class="notif-item${x.read?'':' unread'}" onclick="markNotifRead(${x.id})">
    <div class="notif-icon">${x.icon}</div>
    <div class="notif-text"><div class="notif-title">${x.title}</div><div class="notif-time">${x.time}</div></div>
  </div>`).join('');
}
function markNotifRead(id){
  const n = getNotifs();
  const item = n.find(x=>x.id===id);
  if(item) item.read=true;
  saveNotifs(n); renderNotifPanel();
}
function clearNotifs(){ saveNotifs([]); renderNotifPanel(); }
function toggleNotifPanel(){
  const p = document.getElementById('notif-panel');
  if(!p) return;
  const isOpen = p.classList.toggle('open');
  if(isOpen){
    // mark all read when opened
    const n = getNotifs();
    n.forEach(x=>x.read=true);
    saveNotifs(n); renderNotifPanel();
  }
}
document.addEventListener('click', e=>{
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-btn');
  if(panel&&panel.classList.contains('open')&&!btn.contains(e.target)&&!panel.contains(e.target)){
    panel.classList.remove('open');
  }
});

// ═══ DARK MODE ═══
function toggleDarkMode(){
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('ms_darkmode', isDark?'1':'0');
  const btn = document.getElementById('dark-toggle');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}
function loadDarkMode(){
  if(localStorage.getItem('ms_darkmode')==='1'){
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('dark-toggle');
    if(btn) btn.textContent='☀️';
  }
}

// ═══ ONBOARDING ═══
let obStep = 0;
const OB_STEPS = 3;
function showOnboard(){
  if(localStorage.getItem('ms_onboard_done')) return;
  setTimeout(()=>{ document.getElementById('onboard-overlay').classList.add('open'); }, 800);
}
function onboardNext(){
  obStep++;
  if(obStep >= OB_STEPS){ closeOnboard(); return; }
  for(let i=0;i<OB_STEPS;i++){
    const s=document.getElementById('ob-step-'+i);
    const d=document.getElementById('ob-dot-'+i);
    if(s) s.className='onboard-step'+(i===obStep?' active':'');
    if(d) d.className='onboard-dot'+(i===obStep?' active':'');
  }
  const btn=document.getElementById('ob-next-btn');
  if(btn) btn.textContent = obStep===OB_STEPS-1 ? '¡Empezar! 🚀' : 'Siguiente →';
}
function closeOnboard(){
  document.getElementById('onboard-overlay').classList.remove('open');
  localStorage.setItem('ms_onboard_done','1');
}

// ═══ HOOK: notify on turno save ═══
const _origSaveTurnoForm = saveTurnoForm;
saveTurnoForm = function(nameId, telId, servId, dateId, msgId){
  const res = _origSaveTurnoForm(nameId, telId, servId, dateId, msgId);
  if(res !== false) pushNotif('📅','Solicitud de turno enviada correctamente');
  return res;
};
// Hook: notify on lesson complete
const _origMarkLessonDone = markLessonDone;
markLessonDone = function(){
  _origMarkLessonDone();
  const c = gc().find(x=>x.id===currentCourseId);
  if(c){
    const prog = getProgress(currentCourseId);
    const tot = lessonFlat.length;
    const done = lessonFlat.filter(f=>{ const m=c.modules[f.mi];const l=m&&m.lessons[f.li];return l&&(l.done||!!prog[l.id]); }).length;
    if(done===tot) pushNotif('🏆','¡Completaste el curso "'+c.title+'"! Ya podés descargar tu certificado.');
    else pushNotif('✅','Clase completada en "'+c.title+'"');
  }
};
// Hook: notify on register
const _origDoRegister = doRegister;
doRegister = function(){
  _origDoRegister();
};
const _origLoginOk = loginOk;
loginOk = function(u){
  _origLoginOk(u);
  renderNotifPanel();
  showOnboard();
};

// ═══ PATCH INIT ═══
const _origDOMLoaded = document.addEventListener;
document.addEventListener('DOMContentLoaded', ()=>{
  loadDarkMode();
  renderNotifPanel();
  // push a welcome notif on first visit ever
  if(!localStorage.getItem('ms_first_visit')){
    localStorage.setItem('ms_first_visit','1');
    pushNotif('👋','¡Bienvenida a Mira Estudio! Explorá los cursos disponibles.');
  }
});


// ═══════════════════════════════════════════════════════
// MÓDULO CHAT COMUNIDAD
// ═══════════════════════════════════════════════════════
const KC_CHAT = 'ms_chat';
const getChat = () => JSON.parse(localStorage.getItem(KC_CHAT) || '{}');
const saveChat = v => localStorage.setItem(KC_CHAT, JSON.stringify(v));

let activeChatRoom = null;

// Genera las salas: una general + una por cada curso desbloqueado
function getChatRooms() {
  const courses = gc();
  const rooms = [
    { id: 'general', name: 'General', emoji: '💬', desc: 'Para todas las alumnas' },
    { id: 'recursos', name: 'Recursos', emoji: '📎', desc: 'Comparte materiales' },
    { id: 'trabajos', name: 'Mis Trabajos', emoji: '📸', desc: 'Muestra tus resultados' },
  ];
  courses.filter(c => !c.locked).forEach(c => {
    rooms.push({ id: 'curso-' + c.id, name: c.title, emoji: c.emoji, desc: 'Alumnos de este curso' });
  });
  return rooms;
}

function renderChatRooms() {
  const el = document.getElementById('chat-rooms-list');
  if (!el) return;
  const rooms = getChatRooms();
  const chat = getChat();
  el.innerHTML = rooms.map(r => {
    const msgs = chat[r.id] || [];
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    const unread = msgs.filter(m => !m.read && m.user !== (currentUser && currentUser.name)).length;
    return `<div class="chat-room-item${activeChatRoom === r.id ? ' active' : ''}"
        onclick="openChatRoom('${r.id}')">
      <span class="chat-room-emoji">${r.emoji}</span>
      <div style="flex:1;min-width:0;">
        <div class="chat-room-name">${r.name}</div>
        <div class="chat-room-last">${last ? last.text.substring(0, 35) + (last.text.length > 35 ? '…' : '') : r.desc}</div>
      </div>
      ${unread > 0 ? `<span class="chat-room-badge">${unread}</span>` : ''}
    </div>`;
  }).join('');
}

function openChatRoom(roomId) {
  activeChatRoom = roomId;
  const rooms = getChatRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  // Mark messages read
  const chat = getChat();
  if (chat[roomId]) {
    chat[roomId].forEach(m => { if (m.user !== (currentUser && currentUser.name)) m.read = true; });
    saveChat(chat);
  }

  // Update topbar
  document.getElementById('chat-room-emoji').textContent = room.emoji;
  document.getElementById('chat-room-name').textContent = room.name;
  const msgs = (chat[roomId] || []);
  document.getElementById('chat-room-meta').textContent = msgs.length + ' mensaje' + (msgs.length !== 1 ? 's' : '');

  // Show input
  const ia = document.getElementById('chat-input-area');
  if (ia) ia.style.display = 'flex';

  // Render messages
  renderChatMessages(roomId);
  renderChatRooms(); // refresh unread badges
}

function renderChatMessages(roomId) {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  const chat = getChat();
  const msgs = chat[roomId] || [];

  if (!msgs.length) {
    el.innerHTML = `<div class="chat-empty">
      <div class="chat-empty-icon">✨</div>
      <div style="font-family:var(--fd);font-size:16px;margin-bottom:6px;">Sé la primera en escribir</div>
      <p style="font-size:13px;">Esta sala está vacía. ¡Arrancá la conversación!</p>
    </div>`;
    return;
  }

  const myName = currentUser ? currentUser.name : '';
  let html = '';
  let lastDate = '';

  msgs.forEach(m => {
    const d = m.date || '';
    if (d && d !== lastDate) {
      html += `<div style="text-align:center;font-size:11px;color:var(--muted);margin:8px 0;">${d}</div>`;
      lastDate = d;
    }
    const isMine = m.user === myName;
    const initials = m.user.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    html += `<div class="chat-msg${isMine ? ' mine' : ''}">
      <div class="chat-msg-av${isMine ? ' mine-av' : ''}">${initials}</div>
      <div>
        ${!isMine ? `<div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:3px;">${m.user}</div>` : ''}
        <div class="chat-msg-bubble">${escapeHtml(m.text)}</div>
        <div class="chat-msg-meta">${m.time}</div>
      </div>
    </div>`;
  });

  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

function chatSend() {
  if (!activeChatRoom || !currentUser) return;
  const inp = document.getElementById('chat-input');
  const text = (inp.value || '').trim();
  if (!text) return;

  const now = new Date();
  const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

  const chat = getChat();
  if (!chat[activeChatRoom]) chat[activeChatRoom] = [];
  chat[activeChatRoom].push({
    id: Date.now(),
    user: currentUser.name,
    text,
    time,
    date,
    read: false
  });
  // Keep max 200 per room
  if (chat[activeChatRoom].length > 200) chat[activeChatRoom] = chat[activeChatRoom].slice(-200);
  saveChat(chat);

  inp.value = '';
  inp.style.height = 'auto';
  renderChatMessages(activeChatRoom);
  renderChatRooms();

  // Update meta
  const msgs = chat[activeChatRoom];
  const metaEl = document.getElementById('chat-room-meta');
  if (metaEl) metaEl.textContent = msgs.length + ' mensaje' + (msgs.length !== 1 ? 's' : '');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g,'<br>');
}

// Initialize chat when entering community page
const _origShowPage = typeof showPage !== 'undefined' ? showPage : null;
showPage = function(p) {
  if (_origShowPage) _origShowPage(p);
  if (p === 'comunidad') {
    renderChatRooms();
    activeChatRoom = null;
    // Show empty state
    const ia = document.getElementById('chat-input-area');
    if (ia) ia.style.display = 'none';
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.innerHTML = `<div class="chat-empty">
      <div class="chat-empty-icon">💬</div>
      <div style="font-family:var(--fd);font-size:18px;margin-bottom:8px;">¡Bienvenida a la Comunidad!</div>
      <p style="font-size:13.5px;max-width:280px;">Seleccioná una sala para chatear con tus compañeras.</p>
    </div>`;
  }
};

// ═══════════════════════════════════════════════════════
// PERFIL MEJORADO
// ═══════════════════════════════════════════════════════
const KP = 'ms_profiles';
const getProfiles = () => JSON.parse(localStorage.getItem(KP) || '{}');
const saveProfiles = v => localStorage.setItem(KP, JSON.stringify(v));

function profileLoad() {
  if (!currentUser) return;
  const profiles = getProfiles();
  const p = profiles[currentUser.email] || {};

  // Bio
  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.value = p.bio || '';

  // Stats
  const courses = gc();
  const allLessons = courses.reduce((a, c) => a + (c.modules || []).reduce((b, m) => b + m.lessons.length, 0), 0);
  const doneLessons = courses.reduce((a, c) => a + (c.modules || []).reduce((b, m) => b + m.lessons.filter(l => l.done).length, 0), 0);
  const completedCourses = courses.filter(c => !c.locked && (c.modules || []).every(m => m.lessons.every(l => l.done))).length;

  const statsEl = document.getElementById('profile-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="profile-stat"><div class="profile-stat-val">${doneLessons}</div><div class="profile-stat-lbl">Clases completadas</div></div>
    <div class="profile-stat"><div class="profile-stat-val">${completedCourses}</div><div class="profile-stat-lbl">Cursos terminados</div></div>
    <div class="profile-stat"><div class="profile-stat-val">${Math.round(doneLessons / Math.max(allLessons, 1) * 100)}%</div><div class="profile-stat-lbl">Progreso total</div></div>
  `;

  // Member since
  const ms = document.getElementById('profile-member-since');
  if (ms) ms.textContent = p.joined || 'Miembro activo';
}

function profileSave() {
  if (!currentUser) return;
  const profiles = getProfiles();
  if (!profiles[currentUser.email]) profiles[currentUser.email] = {};
  profiles[currentUser.email].bio = (document.getElementById('profile-bio') || {}).value || '';
  if (!profiles[currentUser.email].joined) {
    profiles[currentUser.email].joined = 'Desde ' + new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }
  saveProfiles(profiles);
  showSaveInd('✅ Perfil guardado');
  toast('✅ Perfil guardado');
}

function profileChangePass() {
  const np = (document.getElementById('prof-newpass') || {}).value || '';
  if (!np || np.length < 6) { toast('⚠️ Mínimo 6 caracteres'); return; }
  if (!currentUser) return;
  const users = gU();
  const idx = users.findIndex(u => u.email === currentUser.email);
  if (idx >= 0) { users[idx].pass = np; sU(users); }
  document.getElementById('prof-newpass').value = '';
  toast('✅ Contraseña actualizada');
}

// Patch showPage for profile load
const _origShowPage2 = showPage;
showPage = function(p) {
  _origShowPage2(p);
  if (p === 'perfil') profileLoad();
};

// ═══════════════════════════════════════════════════════
// REDES SOCIALES
// ═══════════════════════════════════════════════════════
const KSO = 'ms_social';
const getSocial = () => JSON.parse(localStorage.getItem(KSO) || '{}');
const setSocial = v => localStorage.setItem(KSO, JSON.stringify(v));

function loadSocialLinks() {
  const s = getSocial();
  // WhatsApp FAB
  const waFab = document.getElementById('wa-fab');
  if (waFab) {
    if (s.wa) {
      waFab.href = 'https://wa.me/' + s.wa + '?text=' + encodeURIComponent('Hola! Te contacto desde el sitio web.');
      waFab.style.display = 'flex';
    } else {
      waFab.style.display = 'none';
    }
  }
  // Footer social
  const footerSoc = document.getElementById('footer-social');
  if (footerSoc) {
    const links = [];
    if (s.wa) links.push(`<a href="https://wa.me/${s.wa}" target="_blank" class="social-link">💬 WhatsApp</a>`);
    if (s.ig) links.push(`<a href="https://instagram.com/${s.ig}" target="_blank" class="social-link">📸 @${s.ig}</a>`);
    if (s.fb) links.push(`<a href="${s.fb.startsWith('http') ? s.fb : 'https://facebook.com/'+s.fb}" target="_blank" class="social-link">📘 Facebook</a>`);
    if (s.web) links.push(`<a href="${s.web}" target="_blank" class="social-link">🌐 Sitio</a>`);
    if (s.email) links.push(`<a href="mailto:${s.email}" class="social-link">✉️ ${s.email}</a>`);
    footerSoc.innerHTML = links.join('');
  }
}

function admRenderSocialPage() {
  const s = getSocial();
  const map = { 'soc-wa':'wa','soc-ig':'ig','soc-fb':'fb','soc-web':'web','soc-email':'email' };
  Object.entries(map).forEach(([elId, key]) => { const el = document.getElementById(elId); if (el) el.value = s[key] || ''; });
  updateSocPreview(s);
}

function admSaveSocialPage() {
  const s = {
    wa: (document.getElementById('soc-wa')||{}).value||'',
    ig: (document.getElementById('soc-ig')||{}).value||'',
    fb: (document.getElementById('soc-fb')||{}).value||'',
    web: (document.getElementById('soc-web')||{}).value||'',
    email: (document.getElementById('soc-email')||{}).value||'',
  };
  setSocial(s); loadSocialLinks(); updateSocPreview(s);
  showSaveInd('🌐 Redes guardadas'); toast('✅ Redes guardadas');
}

function updateSocPreview(s) {
  const el = document.getElementById('soc-preview'); if (!el) return;
  const links = [];
  if (s.wa) links.push(`<a class="social-link" href="https://wa.me/${s.wa}" target="_blank">💬 WhatsApp</a>`);
  if (s.ig) links.push(`<a class="social-link" href="https://instagram.com/${s.ig}" target="_blank">📸 @${s.ig}</a>`);
  if (s.fb) links.push(`<a class="social-link" href="${s.fb.startsWith('http')?s.fb:'https://fb.com/'+s.fb}" target="_blank">📘 Facebook</a>`);
  if (s.web) links.push(`<a class="social-link" href="${s.web}" target="_blank">🌐 Sitio</a>`);
  if (s.email) links.push(`<a class="social-link" href="mailto:${s.email}">✉️ ${s.email}</a>`);
  el.innerHTML = links.length ? links.join('') : '<span style="font-size:13px;color:var(--muted);">Sin links configurados aún.</span>';
}

// ═══════════════════════════════════════════════════════
// THEME PRESETS
// ═══════════════════════════════════════════════════════
const THEME_PRESETS = {
  crimson:  { '--c1':'#8C0026','--c1d':'#620018','--c1l':'#B0003A','--gold':'#C9A84C','--dark':'#1A0008','--cr':'#FFF8F0','--goldl':'#E8D5A0','--goldp':'#FDF5DC' },
  midnight: { '--c1':'#1a237e','--c1d':'#0d1357','--c1l':'#283593','--gold':'#C9A84C','--dark':'#0d0d2b','--cr':'#F0F0FF','--goldl':'#E8D5A0','--goldp':'#F5F5FF' },
  forest:   { '--c1':'#1b5e20','--c1d':'#0a3d11','--c1l':'#2e7d32','--gold':'#d4a843','--dark':'#0a1f0c','--cr':'#F0FFF0','--goldl':'#f5d580','--goldp':'#efffef' },
  rose:     { '--c1':'#880e4f','--c1d':'#560027','--c1l':'#ad1457','--gold':'#f8bbd0','--dark':'#1a0010','--cr':'#FFF0F5','--goldl':'#fce4ec','--goldp':'#fff5f8' },
};
function applyThemePreset(name) {
  const preset = THEME_PRESETS[name]; if (!preset) return;
  const saved = JSON.parse(localStorage.getItem(KES) || '{}');
  Object.entries(preset).forEach(([k, val]) => {
    document.documentElement.style.setProperty(k, val);
    saved[k] = val;
    const inputMap = {'--c1':'col-c1','--c1d':'col-c1d','--c1l':'col-c1l','--gold':'col-gold','--dark':'col-dark','--cr':'col-cr'};
    const inputId = inputMap[k]; if (inputId) { const el = document.getElementById(inputId); if (el) el.value = val; }
  });
  localStorage.setItem(KES, JSON.stringify(saved));
  document.querySelectorAll('.tp-card').forEach(el => el.classList.remove('selected'));
  const tgt = event && event.target && event.target.closest('.tp-card');
  if (tgt) tgt.classList.add('selected');
  showSaveInd('🎨 Paleta "' + name + '" aplicada');
  toast('🎨 Paleta aplicada');
}

// ═══════════════════════════════════════════════════════
// SAVE INDICATOR
// ═══════════════════════════════════════════════════════
function showSaveInd(msg) {
  const el = document.getElementById('save-ind'); if (!el) return;
  el.textContent = msg || '✓ Guardado';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ═══════════════════════════════════════════════════════
// PATCH admPage → handle social
// ═══════════════════════════════════════════════════════
const _admPageBase = admPage;
admPage = function(name) {
  _admPageBase(name);
  if (name === 'social') admRenderSocialPage();
};

// ═══════════════════════════════════════════════════════
// PATCH admRenderEstetica → inject theme presets
// ═══════════════════════════════════════════════════════
const _origAdmRenderEstetica = admRenderEstetica;
admRenderEstetica = function() {
  _origAdmRenderEstetica();
  // Inject theme presets card if not already there
  const estPage = document.getElementById('adm-estetica');
  if (estPage && !estPage.querySelector('.theme-preset-grid')) {
    const card = document.createElement('div');
    card.className = 'acard';
    card.innerHTML = `<h3>Paletas predefinidas</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Un click aplica una paleta completa instantáneamente.</p>
      <div class="theme-preset-grid">
        <div class="tp-card" onclick="applyThemePreset('crimson')">
          <div class="tp-swatches"><div class="tp-swatch" style="background:#8C0026"></div><div class="tp-swatch" style="background:#C9A84C"></div><div class="tp-swatch" style="background:#1A0008"></div></div>
          <div class="tp-name">Carmesí</div>
        </div>
        <div class="tp-card" onclick="applyThemePreset('midnight')">
          <div class="tp-swatches"><div class="tp-swatch" style="background:#1a237e"></div><div class="tp-swatch" style="background:#C9A84C"></div><div class="tp-swatch" style="background:#0d0d2b"></div></div>
          <div class="tp-name">Midnight Blue</div>
        </div>
        <div class="tp-card" onclick="applyThemePreset('forest')">
          <div class="tp-swatches"><div class="tp-swatch" style="background:#1b5e20"></div><div class="tp-swatch" style="background:#d4a843"></div><div class="tp-swatch" style="background:#0a1f0c"></div></div>
          <div class="tp-name">Forest Green</div>
        </div>
        <div class="tp-card" onclick="applyThemePreset('rose')">
          <div class="tp-swatches"><div class="tp-swatch" style="background:#880e4f"></div><div class="tp-swatch" style="background:#f8bbd0"></div><div class="tp-swatch" style="background:#1a0010"></div></div>
          <div class="tp-name">Rose Gold</div>
        </div>
      </div>`;
    // Insert after first .acard (colors card)
    const firstCard = estPage.querySelector('.acard');
    if (firstCard) firstCard.after(card);
    else estPage.appendChild(card);
  }
};

// ═══════════════════════════════════════════════════════
// PATCH loginOk / doLogout / checkSession
// ═══════════════════════════════════════════════════════
const _baseLoginOk = loginOk;
loginOk = function(u) {
  _baseLoginOk(u);
  loadSocialLinks();
  // Record join date if first time
  const profiles = getProfiles();
  if (!profiles[u.email]) {
    profiles[u.email] = { joined: 'Desde ' + new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
    saveProfiles(profiles);
  }
};

// ═══════════════════════════════════════════════════════
// PATCH admSaveColors → show indicator
// ═══════════════════════════════════════════════════════
const _baseAdmSaveColors = admSaveColors;
admSaveColors = function() { _baseAdmSaveColors(); showSaveInd('🎨 Colores guardados'); };

// ═══════════════════════════════════════════════════════
// DOMContentLoaded extras
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadSocialLinks();
  // Seed demo chat messages on first load
  const chat = getChat();
  if (!chat['general']) {
    chat['general'] = [
      { id: 1, user: 'Valentina L.', text: '¡Hola a todas! Acabo de terminar el curso de clásicas 🎉', time: '10:30', date: 'hoy', read: false },
      { id: 2, user: 'Sofía M.', text: 'Felicitaciones Vale! Yo estoy en el módulo 2 todavía 😅', time: '10:35', date: 'hoy', read: false },
      { id: 3, user: 'Valentina L.', text: 'No te preocupes, lo mejor está en el módulo 3!', time: '10:37', date: 'hoy', read: false },
    ];
    saveChat(chat);
  }
});


function showVerifyBanner(email){
  const div=document.createElement('div');div.id='verify-banner-ov';div.className='ov open';div.style.cssText='z-index:500;';
  div.innerHTML=`<div class="mcard mcard-sm" style="text-align:center;padding:36px 28px;"><div style="font-size:48px;margin-bottom:12px;">📧</div><div style="font-family:var(--fd);font-size:22px;color:var(--dark);margin-bottom:8px;">Verificá tu email</div><p style="font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:20px;">Te enviamos un email a <strong>${email}</strong>.<br>Hacé clic en el link para activar tu cuenta.</p><div style="background:var(--goldp);border:1px solid rgba(201,168,76,.3);border-radius:var(--r2);padding:12px 16px;font-size:13px;color:var(--goldd);margin-bottom:20px;">💡 Revisá también la carpeta de <strong>spam</strong>.</div><button class="btn-p" onclick="document.getElementById('verify-banner-ov').remove();" style="width:100%;padding:13px;margin-bottom:10px;">Ya verifiqué → Iniciar sesión</button><button onclick="resendVerification('${email}')" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:var(--fb);">↺ Reenviar email</button></div>`;
  document.body.appendChild(div);
}
function resendVerification(email){
  const user=_auth?.currentUser;
  if(user)user.sendEmailVerification().then(()=>toast('✅ Email reenviado')).catch(e=>toast('Error: '+e.message));
  else toast('Iniciá sesión primero');
}
function doResetPass(){
  const em=document.getElementById('reset-email')?.value.trim();
  if(!em){toast('Ingresá tu email');return;}
  if(!_fbReady||!_auth){toast('Firebase no disponible');return;}
  _auth.sendPasswordResetEmail(em).then(()=>{
    const fp=document.getElementById('form-reset');
    if(fp)fp.innerHTML=`<div style="text-align:center;padding:16px 0;"><div style="font-size:48px;">📧</div><div style="font-family:var(--fd);font-size:20px;color:var(--dark);margin:12px 0 8px;">¡Email enviado!</div><p style="font-size:13.5px;color:var(--muted);">Revisá tu bandeja de <strong>${em}</strong>.<br>También revisá spam.</p><button onclick="switchTab('l')" class="btn-auth" style="margin-top:16px;">← Volver al inicio</button></div>`;
  }).catch(err=>{
    const msg=err.code==='auth/user-not-found'?'No existe cuenta con ese email':'Error al enviar el email.';
    toast('❌ '+msg);
  });
}
function showResetPass(){
  ['form-l','form-r'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const fp=document.getElementById('form-reset');if(fp)fp.style.display='';
  const liEmail=document.getElementById('li-email')?.value.trim();
  if(liEmail){const re=document.getElementById('reset-email');if(re)re.value=liEmail;}
}


// ── ADMIN SLOT MANAGEMENT ──────────────────────────
const DEFAULT_SLOTS_ADM=[
  {day:'Lunes',times:['09:00','10:30','12:00','15:00','16:30']},
  {day:'Martes',times:['09:00','10:30','14:00','15:30']},
  {day:'Miércoles',times:['09:00','11:00','14:00','16:00']},
  {day:'Jueves',times:['10:00','11:30','15:00','16:30']},
  {day:'Viernes',times:['09:00','10:30','12:00','14:00']},
  {day:'Sábado',times:['09:00','10:30','12:00']},
];
function gSlotsAdm(){try{return JSON.parse(localStorage.getItem('ms_slots')||'[]');}catch(e){return[];}}
function sSlotsAdm(v){localStorage.setItem('ms_slots',JSON.stringify(v));_fsSet('slots',v);}
function admRenderSlots(){
  const el=document.getElementById('adm-slots-list');if(!el)return;
  const slots=gSlotsAdm();const src=slots.length?slots:DEFAULT_SLOTS_ADM;
  if(!src.length){el.innerHTML='<p style="font-size:13px;color:var(--muted)">No hay horarios configurados.</p>';return;}
  el.innerHTML=src.map(row=>`<div class="adm-slot-row"><div class="adm-slot-day">${row.day}</div><div class="adm-slot-times">${row.times.map(t=>`<div class="adm-slot-pill">${t}<button class="adm-slot-del" onclick="admDelSlot('${row.day}','${t}')">✕</button></div>`).join('')}</div></div>`).join('');
}
function admAddSlot(){
  const day=document.getElementById('adm-slot-day').value;
  const time=document.getElementById('adm-slot-time').value;
  if(!time){toast('⚠️ Elegí un horario');return;}
  let slots=gSlotsAdm();if(!slots.length)slots=JSON.parse(JSON.stringify(DEFAULT_SLOTS_ADM));
  const row=slots.find(s=>s.day===day);
  if(row){if(row.times.includes(time)){toast('Ese horario ya existe');return;}row.times.push(time);row.times.sort();}
  else slots.push({day,times:[time]});
  sSlotsAdm(slots);admRenderSlots();toast('✅ Horario agregado');
}
function admDelSlot(day,time){
  let slots=gSlotsAdm();if(!slots.length)slots=JSON.parse(JSON.stringify(DEFAULT_SLOTS_ADM));
  const row=slots.find(s=>s.day===day);if(!row)return;
  row.times=row.times.filter(t=>t!==time);
  if(!row.times.length)slots=slots.filter(s=>s.day!==day);
  sSlotsAdm(slots);admRenderSlots();toast('Horario eliminado');
}
function admResetSlots(){
  if(!confirm('¿Restaurar los horarios por defecto?'))return;
  localStorage.removeItem('ms_slots');admRenderSlots();toast('↺ Horarios restaurados');
}


// ── EBOOK PURCHASES ─────────────────────────────────
// Stored in Firestore under users/{uid}/purchasedEbooks: [ebId,...]
// Also cached in localStorage for offline use

function getPurchasedEbooks(){
  // Returns array of ebook IDs the current user has purchased
  if(!currentUser) return [];
  const key='ms_purchased_'+currentUser.email;
  try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){ return []; }
}

function setPurchasedEbooks(ids){
  if(!currentUser) return;
  const key='ms_purchased_'+currentUser.email;
  localStorage.setItem(key, JSON.stringify(ids));
  // Sync to Firestore
  if(_fbReady&&_db&&currentUser.uid){
    _db.collection('users').doc(currentUser.uid).set({purchasedEbooks:ids},{merge:true}).catch(()=>{});
  }
}

function hasEbook(ebookId){
  return getPurchasedEbooks().includes(String(ebookId));
}

// Load purchases from Firestore on login
async function loadUserPurchases(){
  if(!_fbReady||!_db||!currentUser?.uid) return;
  try{
    const doc=await _db.collection('users').doc(currentUser.uid).get();
    if(doc.exists){
      const data=doc.data();
      if(data.purchasedEbooks){
        const key='ms_purchased_'+currentUser.email;
        localStorage.setItem(key, JSON.stringify(data.purchasedEbooks));
        renderEbooks(); // refresh ebook cards
      }
    }
  }catch(e){}
}

// Admin: grant ebook access to a user
async function admGrantEbook(userEmail, ebookId){
  // Update Firestore user doc
  if(_fbReady&&_db){
    try{
      // Find user UID in Firestore by email
      const snap=await _db.collection('users').where('email','==',userEmail).get();
      if(!snap.empty){
        const uid=snap.docs[0].id;
        const data=snap.docs[0].data();
        const current=(data.purchasedEbooks||[]).map(String);
        if(!current.includes(String(ebookId))){
          current.push(String(ebookId));
          await _db.collection('users').doc(uid).set({purchasedEbooks:current},{merge:true});
        }
      }
    }catch(e){ console.warn('admGrantEbook Firestore error:',e); }
  }
  // Also update localStorage users array
  const users=gU();
  const u=users.find(x=>x.email===userEmail);
  if(u){
    if(!u.purchasedEbooks) u.purchasedEbooks=[];
    if(!u.purchasedEbooks.includes(String(ebookId))) u.purchasedEbooks.push(String(ebookId));
    sU(users);
  }
}

async function admRevokeEbook(userEmail, ebookId){
  if(_fbReady&&_db){
    try{
      const snap=await _db.collection('users').where('email','==',userEmail).get();
      if(!snap.empty){
        const uid=snap.docs[0].id;
        const data=snap.docs[0].data();
        const current=(data.purchasedEbooks||[]).map(String).filter(id=>id!==String(ebookId));
        await _db.collection('users').doc(uid).set({purchasedEbooks:current},{merge:true});
      }
    }catch(e){}
  }
  const users=gU();
  const u=users.find(x=>x.email===userEmail);
  if(u){
    u.purchasedEbooks=(u.purchasedEbooks||[]).filter(id=>String(id)!==String(ebookId));
    sU(users);
  }
}


// ── COURSE EDITOR PAGE ──────────────────────────────
function admOpenEditor(){
  // Use same classList system as admPage
  document.querySelectorAll('.adm-pg').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.adm-ni').forEach(el=>el.classList.remove('active'));
  const ep=document.getElementById('adm-curso-editor');
  if(ep){
    ep.classList.add('active');
    const body=document.querySelector('.adm-body');
    if(body) body.scrollTop=0;
  }
}
function admCloseEditor(){
  const ep=document.getElementById('adm-curso-editor');
  if(ep) ep.classList.remove('active');
  admPage('cursos');
}


// ── DASHBOARD TURNO SLOT SYSTEM ─────────────────────
// prefix: 't' for form1, 't2' for form2
const _dashSlot={t:'',t2:''};
const _dashServ={t:'',t2:''};
const _dashStep={t:0,t2:0};

function dashLoadSlots(prefix){
  const dateStr=document.getElementById(prefix+'-date').value;
  const grid=document.getElementById(prefix+'-slots-grid');
  if(!grid)return;
  grid.innerHTML='';
  if(!dateStr){grid.innerHTML='<div style="font-size:13px;color:var(--muted);font-style:italic;">Seleccioná una fecha primero</div>';return;}
  const slots=getSlotsForDate(dateStr);
  const taken=getTakenSlots(dateStr);
  if(!slots.length){grid.innerHTML='<div style="font-size:13px;color:var(--muted);font-style:italic;">No hay horarios para ese día</div>';return;}
  slots.forEach(function(t){
    const isTaken=taken.includes(t);
    const btn=document.createElement('button');
    btn.textContent=t+(isTaken?' 🚫':'');
    btn.style.cssText='padding:7px 13px;border-radius:50px;border:1.5px solid '+(isTaken?'var(--crd)':'rgba(201,168,76,.4)')+';background:'+(isTaken?'var(--cr)':'var(--goldp)')+';color:'+(isTaken?'var(--muted)':'var(--goldd)')+';font-size:12.5px;font-family:var(--fb);cursor:'+(isTaken?'not-allowed':'pointer')+';transition:.15s;';
    if(!isTaken){
      btn.onclick=function(){
        grid.querySelectorAll('button').forEach(b=>{b.style.background='var(--goldp)';b.style.borderColor='rgba(201,168,76,.4)';b.style.fontWeight='400';});
        btn.style.background='rgba(201,168,76,.35)';btn.style.borderColor='var(--gold)';btn.style.fontWeight='700';
        _dashSlot[prefix]=t;
        const sel=document.getElementById(prefix+'-slot-sel');
        if(sel){sel.style.display='';sel.textContent='⏰ Seleccionaste: '+t;}
      };
    }
    grid.appendChild(btn);
  });
  _dashSlot[prefix]='';
  const sel=document.getElementById(prefix+'-slot-sel');if(sel)sel.style.display='none';
}

function dashNextStep(prefix,step){
  const formPfx=prefix==='t'?'tf1':'tf2';
  if(step===1){
    const date=document.getElementById(prefix+'-date').value;
    if(!date){toast('⚠️ Elegí una fecha');return;}
    if(!_dashSlot[prefix]){toast('⚠️ Elegí un horario disponible');return;}
    const serv=_dashServ[prefix]||'Consulta';
    const res=document.getElementById(prefix+'-resumen');
    if(res)res.innerHTML='<strong>📋 Resumen:</strong><br>📌 Servicio: '+serv+'<br>📅 Fecha: '+date+'<br>⏰ Horario: '+_dashSlot[prefix];
  }
  _dashStep[prefix]=step;
  [0,1,2].forEach(i=>{
    const el=document.getElementById(formPfx+'-step-'+i);
    if(el)el.style.display=(i===step?'':'none');
  });
}

function dashResetForm(prefix){
  _dashSlot[prefix]='';_dashServ[prefix]='';_dashStep[prefix]=0;
  const dateEl=document.getElementById(prefix+'-date');if(dateEl)dateEl.value='';
  const nameEl=document.getElementById(prefix+'-name');if(nameEl)nameEl.value='';
  const telEl=document.getElementById(prefix+'-tel');if(telEl)telEl.value='';
  const msgEl=document.getElementById(prefix+'-msg');if(msgEl)msgEl.value='';
  const grid=document.getElementById(prefix+'-slots-grid');
  if(grid)grid.innerHTML='<div style="font-size:13px;color:var(--muted);font-style:italic;">Seleccioná una fecha primero</div>';
  const sel=document.getElementById(prefix+'-slot-sel');if(sel)sel.style.display='none';
  // reset services highlight
  document.querySelectorAll('.tsv').forEach(e=>e.classList.remove('sel'));
}

// Override setTurnoService to also store in _dashServ
const _origSetServ=typeof setTurnoService==='function'?setTurnoService:null;
function setTurnoService(serv){
  _dashServ.t=serv;
  document.querySelectorAll('#cpanel-turnos .tsv').forEach(e=>e.classList.remove('sel'));
  event.currentTarget.classList.add('sel');
}
function setTurnoService2(serv){
  _dashServ.t2=serv;
  document.querySelectorAll('#explorer-turnos .tsv').forEach(e=>e.classList.remove('sel'));
  event.currentTarget.classList.add('sel');
}

// Override saveTurno to use slot
const _origSaveTurno=typeof saveTurno==='function'?saveTurno:null;
function saveTurno(){
  const name=document.getElementById('t-name').value.trim();
  const tel=document.getElementById('t-tel').value.trim();
  const date=document.getElementById('t-date').value;
  if(!name||!tel){toast('⚠️ Nombre y teléfono son requeridos');return;}
  if(!date||!_dashSlot.t){toast('⚠️ Falta fecha u horario');return;}
  const serv=_dashServ.t||'Consulta';
  const turno={id:Date.now(),name,tel,serv,date,time:_dashSlot.t,msg:document.getElementById('t-msg')?.value.trim()||'',status:'pending',ts:new Date().toLocaleDateString('es-AR')};
  const arr=gT();arr.push(turno);sT(arr);
  const txt=document.getElementById('t-confirm-txt');
  if(txt)txt.innerHTML='<strong>'+serv+'</strong><br>📅 '+date+' a las <strong>'+_dashSlot.t+'</strong><br>📱 Te contactamos al '+tel;
  dashNextStep('t',2);
  if(typeof pushNotif==='function')pushNotif('📅','Turno solicitado correctamente');
}
function saveTurno2(){
  const name=document.getElementById('t2-name').value.trim();
  const tel=document.getElementById('t2-tel').value.trim();
  const date=document.getElementById('t2-date').value;
  if(!name||!tel){toast('⚠️ Nombre y teléfono son requeridos');return;}
  if(!date||!_dashSlot.t2){toast('⚠️ Falta fecha u horario');return;}
  const serv=_dashServ.t2||'Consulta';
  const turno={id:Date.now(),name,tel,serv,date,time:_dashSlot.t2,msg:document.getElementById('t2-msg')?.value.trim()||'',status:'pending',ts:new Date().toLocaleDateString('es-AR')};
  const arr=gT();arr.push(turno);sT(arr);
  const txt=document.getElementById('t2-confirm-txt');
  if(txt)txt.innerHTML='<strong>'+serv+'</strong><br>📅 '+date+' a las <strong>'+_dashSlot.t2+'</strong><br>📱 Te contactamos al '+tel;
  dashNextStep('t2',2);
  if(typeof pushNotif==='function')pushNotif('📅','Turno solicitado correctamente');
}


// ── ADMIN FORCE SYNC ────────────────────────────────
async function admForcSync(){
  if(!_fbReady||!_db){
    toast('⚠️ Firebase no disponible');
    return;
  }
  toast('☁ Sincronizando con la nube...');
  try{
    await _syncSiteFromCloud();
    // Refresh current admin page
    const active=document.querySelector('.adm-ni.active');
    if(active&&active.dataset.adm) admPage(active.dataset.adm);
    toast('✅ Datos sincronizados correctamente');
  }catch(e){
    toast('❌ Error al sincronizar: '+e.message);
  }
}


// ════════════════════════════════════════════════════════
// MERCADOPAGO — Preparación para integración futura
// Para activar: reemplazá MP_PUBLIC_KEY con tu clave pública
// Conseguila en: mercadopago.com.ar → Credenciales
// ════════════════════════════════════════════════════════
const MP_PUBLIC_KEY = ''; // TODO: pegar tu clave pública de MercadoPago

/**
 * Crear preferencia de pago vía tu backend (futuro)
 * Por ahora redirige al link de pago configurado en cada producto
 * @param {object} item - {title, price, currency, quantity}
 * @param {string} successUrl - URL de retorno después del pago
 */
function mpCheckout(payLink, productTitle, price){
  if(!payLink){
    toast('⚠️ Link de pago no configurado para este producto');
    return;
  }
  // Track intent (analytics)
  console.log('[MP] Checkout iniciado:', productTitle, price);
  // Redirect to payment link
  window.open(payLink, '_blank', 'noopener');
}

/**
 * Verificar si un pago fue completado (futuro - requiere backend)
 * Por ahora el admin desbloquea manualmente
 */
function mpVerifyPayment(orderId){
  // TODO: implementar con backend + MP webhooks
  console.log('[MP] Verificar pago:', orderId);
}

// Hook en botones de compra de ebooks
function buyEbook(ebookId){
  const eb = gEB().find(e=>String(e.id)===String(ebookId));
  if(!eb) return;
  if(!eb.paid || hasEbook(ebookId)){
    // Free or already purchased
    if(eb.downloadLink || eb.link) window.open(eb.downloadLink||eb.link,'_blank','noopener');
    return;
  }
  // Paid and not purchased yet
  mpCheckout(eb.payLink||eb.link, eb.title, eb.price);
}

// Hook en botones de compra de cursos
function buyCourse(courseId){
  const c = gc().find(x=>x.id===courseId);
  if(!c) return;
  if(!c.price || !c.payLink){ openViewer(courseId); return; }
  mpCheckout(c.payLink, c.title, c.price);
}


// ── DASHBOARD CAROUSEL ──────────────────────────────
function switchCarousel(tab){
  // Hide all panels
  ['cursos','ebooks','turnos'].forEach(t=>{
    const panel=document.getElementById('cpanel-'+t);
    const tabEl=document.getElementById('ctab-'+t);
    if(panel) panel.classList.remove('active');
    if(tabEl) tabEl.classList.remove('active');
  });
  // Show selected
  const activePanel=document.getElementById('cpanel-'+tab);
  const activeTab=document.getElementById('ctab-'+tab);
  if(activePanel) activePanel.classList.add('active');
  if(activeTab) activeTab.classList.add('active');
  // Render content
  if(tab==='cursos') renderCarouselCourses();
  if(tab==='ebooks') renderEbooks();
  if(tab==='turnos'){ /* turnos HTML is static */ }
}


