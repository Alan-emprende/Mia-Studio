/* Avisos de compras para la dueña. Las credenciales se guardan únicamente en Cloudflare. */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=(path,body)=>window.miraPayments.api(path,body);
  const labels={queued:'Pendiente',sending:'En proceso',sent:'Aceptado por Resend',failed:'Pendiente de reintento',
    review:'Requiere revisión',cancelled:'Cancelado'};
  const oldRender=window.admRenderPayments;
  let testRequestId;
  window.admRenderPayments=async function(){
    await oldRender?.();
    const host=document.getElementById('payments-editor');if(!host)return;
    document.getElementById('sale-email-panel')?.remove();
    const section=document.createElement('section');section.id='sale-email-panel';section.className='acard';
    section.style.marginTop='24px';host.append(section);
    section.textContent='Cargando avisos por correo…';
    try{
      const s=await api('/sale-email/settings');
      section.innerHTML='<h3>Avisos por correo</h3><p>Destino: <strong>'+esc(s.recipient)+'</strong></p><p>Remitente: '+esc(s.from)+'</p><p>Clave de correo: '+(s.configured?'cargada':'falta cargar en Cloudflare')+'.</p>'+(s.testDomain?'<p>El remitente resend.dev permite probar con el email de tu cuenta de Resend. Para activar avisos de ventas reales, configurá un remitente de tu dominio verificado.</p>':'')+'<form id="sale-email-form"><label><input id="sale-email-enabled" type="checkbox" '+(s.enabled?'checked':'')+'> Recibir un correo por cada compra confirmada</label>'+(s.environment==='test'?'<p><label><input id="sale-email-include-tests" type="checkbox" '+(s.includeTests?'checked':'')+'> Incluir compras de prueba</label></p>':'')+'<p><button class="abtn" type="submit">Guardar avisos</button></p></form><div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" class="abtn" id="sale-email-test">Enviar correo de prueba</button><button type="button" class="abtn" id="sale-email-refresh">Actualizar avisos</button><button type="button" class="abtn" id="sale-email-retry">Reintentar pendientes</button></div><p id="sale-email-message" role="status"></p><p>Un aviso aceptado por Resend todavía puede demorar o llegar a Spam. Un error de correo no impide el acceso a una compra confirmada.</p><div id="sale-email-history"></div>';
      const message=document.getElementById('sale-email-message');
      async function history(){
        const rows=await api('/sale-email/notices'),box=document.getElementById('sale-email-history');
        box.innerHTML='<h4>Últimos avisos</h4>'+(rows.length?rows.map(r=>'<article class="pay-order"><strong>'+esc(r.title)+'</strong><p>'+esc(labels[r.status]||r.status)+(r.category==='test'?' · Correo de prueba':'')+' · '+esc(r.mode==='production'?'Producción':'Pruebas')+'</p>'+(r.errorCode?'<p>'+esc(r.errorCode==='retry_window'?'Revisá el historial de Resend antes de decidir si corresponde enviar otro aviso.':r.errorCode==='transport'?'El servicio no respondió. El reintento conserva la misma referencia.':'Código: '+r.errorCode)+'</p>':'')+(['queued','failed'].includes(r.status)?'<button class="abtn" type="button" data-email-retry="'+esc(r.id)+'">Reintentar este aviso</button>':'')+'</article>').join(''):'<p>Todavía no hay avisos en este ambiente. La habilitación se aplica a las próximas compras.</p>');
        box.querySelectorAll('[data-email-retry]').forEach(button=>{button.onclick=()=>action(button,async()=>{
          const result=await api('/sale-email/retry',{id:button.dataset.emailRetry});message.textContent=labels[result.status]||result.status;await history();
        });});
      }
      async function action(button,fn){
        button.disabled=true;message.textContent='Procesando…';
        try{await fn();}catch(e){message.textContent=e.message;}finally{button.disabled=false;}
      }
      document.getElementById('sale-email-form').onsubmit=async e=>{
        e.preventDefault();
        await action(e.target.querySelector('button[type=submit]'),async()=>{
          await api('/sale-email/settings',{enabled:document.getElementById('sale-email-enabled').checked,
            includeTests:document.getElementById('sale-email-include-tests')?.checked===true});
          message.textContent='Configuración de avisos guardada. Se aplica a las próximas compras.';
        });
      };
      document.getElementById('sale-email-test').onclick=e=>action(e.target,async()=>{
        testRequestId=testRequestId||crypto.randomUUID();
        const result=await api('/sale-email/test',{requestId:testRequestId});
        if(result.status==='sent'){testRequestId=null;message.textContent='Correo de prueba aceptado por Resend. Revisá la bandeja de entrada y Spam.';}
        else message.textContent=(labels[result.status]||result.status)+(result.errorCode?' · '+result.errorCode:'');
        await history();
      });
      document.getElementById('sale-email-refresh').onclick=e=>action(e.target,async()=>{await history();message.textContent='Historial actualizado.';});
      document.getElementById('sale-email-retry').onclick=e=>action(e.target,async()=>{await api('/sale-email/retry',{});await history();message.textContent='Se revisaron hasta tres avisos pendientes.';});
      await history();
    }catch(e){section.textContent='Avisos por correo: '+(/Ruta no encontrada/.test(e.message)?'Falta actualizar el Worker de pagos con la versión de avisos.':e.message);}
  };
})();
