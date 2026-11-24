/* Configuración de señas y comprobación de accesos para la administradora. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={manual:'Autorización manual del estudio',purchase:'Compra confirmada',free:'Curso configurado como gratuito',denied:'Sin acceso: requiere compra',locked:'Curso no disponible'};
const api=(path,body)=>window.miraPayments.api(path,body);
async function render(){
 const host=document.getElementById('payments-editor');if(!host)return;
 document.getElementById('booking-settings-card')?.remove();
 const box=document.createElement('section');box.id='booking-settings-card';box.className='acard';box.style.marginTop='24px';host.append(box);
 try{
  const result=await api('/booking-settings'),config=result.settings;
  box.innerHTML='<h3>Reservas con seña</h3><p>Configurá el porcentaje y la duración real de cada servicio. El turno se confirma al aprobarse el pago.</p><form id="booking-settings-form"><label><input type="checkbox" id="booking-enabled" '+(config.enabled?'checked':'')+'> Habilitar reservas con seña</label><div class="fg"><label for="booking-percent">Seña (% del precio total)</label><input id="booking-percent" type="number" min="1" max="100" step="1" required value="'+esc(config.percent)+'"></div><p>Podés cambiar este porcentaje cuando quieras. Se aplica a las próximas reservas; las ya iniciadas mantienen el importe acordado.</p><details><summary>Duraciones de los servicios</summary><p>Los servicios sin precio concreto o sin duración requieren coordinar con el estudio. Completá la duración para cada servicio que quieras habilitar.</p><div id="booking-service-minutes"></div></details><button class="abtn" type="submit">Guardar señas</button><p id="booking-save-status" role="status"></p></form><hr><h3>Comprobar acceso de una alumna</h3><form id="access-audit-form"><label for="access-audit-email">Email de la alumna</label><input id="access-audit-email" type="email" autocomplete="off" required placeholder="Email"><button class="abtn" type="submit">Comprobar acceso</button></form><div id="access-audit-result" role="status"></div>';
  const list=box.querySelector('#booking-service-minutes'),fields=[];
  for(const service of result.services){
    const row=document.createElement('div');row.className='fg';const label=document.createElement('label');label.textContent=service.name+(service.priceCents?' · '+window.miraPayments.money(service.priceCents):' · Precio a consultar')+(service.ambiguous?' · Revisá los precios duplicados':'');
    const input=document.createElement('input');input.type='number';input.min='15';input.max='480';input.step='1';input.placeholder='Duración en minutos';input.value=service.durationMinutes||'';input.setAttribute('aria-label','Minutos de '+service.name);
    row.append(label,input);list.append(row);fields.push({name:service.name,input});
  }
  box.querySelector('#booking-settings-form').onsubmit=async e=>{
    e.preventDefault();const button=e.target.querySelector('button[type=submit]'),status=box.querySelector('#booking-save-status');button.disabled=true;status.textContent='Guardando…';
    try{const serviceMinutes={};for(const field of fields)if(field.input.value.trim())serviceMinutes[field.name]=Number(field.input.value);
      const saved=await api('/booking-settings',{enabled:box.querySelector('#booking-enabled').checked,percent:Number(box.querySelector('#booking-percent').value),serviceMinutes});
      status.textContent='Seña guardada: '+saved.settings.percent+'%. '+(saved.settings.enabled?'Reservas habilitadas.':'Reservas deshabilitadas.');
    }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  };
  box.querySelector('#access-audit-form').onsubmit=async e=>{
    e.preventDefault();const output=box.querySelector('#access-audit-result'),button=e.target.querySelector('button');button.disabled=true;output.textContent='Comprobando…';
    try{const r=await api('/access-audit',{email:box.querySelector('#access-audit-email').value.trim()});
      output.replaceChildren();
      if(!r.accounts.length)output.textContent='No encontramos un perfil registrado con ese email.';
      for(const account of r.accounts){const heading=document.createElement('p');heading.textContent=account.email;output.append(heading);
        for(const course of account.courses){const line=document.createElement('p');line.textContent=course.title+' · '+(course.priceCents===null?'Precio a revisar':window.miraPayments.money(course.priceCents))+' · '+labels[course.reason]+(course.testPurchases?' · Tiene '+course.testPurchases+' compra(s) de prueba':'');output.append(line);}
      }
    }catch(error){output.textContent=error.message;}finally{button.disabled=false;}
  };
 }catch(error){box.textContent='No se pudo cargar la configuración de señas: '+error.message+' Comprobá que el Worker muestre la revisión 20261124-access-bookings.';}
}
const previous=window.admRenderPayments;
window.admRenderPayments=async function(){if(previous)await previous();await render();};
})();
