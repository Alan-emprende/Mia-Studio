import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../shared.js',import.meta.url),'utf8');
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+1));}
test('la vista del chat trata el nombre y el texto de otras cuentas como texto',()=>{
 const nodes={'chat-messages':{},'chat-rooms-list':{}};
 const message={uid:'otra',user:'Nombre <alias>',text:'Un mensaje con <etiqueta>',date:'día',time:'hora'};
 const ctx={document:{getElementById:x=>nodes[x]},currentUser:{name:message.user,uid:'yo'},activeChatRoom:'general',getChat:()=>({general:[message]}),getChatRooms:()=>[{id:'general',name:'General',emoji:'•'}]};
 vm.createContext(ctx);
 vm.runInContext(extract('function _escHtml(', '// ═══ STORAGE KEYS')+extract('function renderChatRooms()', 'function openChatRoom(')+extract('function renderChatMessages(', 'function chatSend(')+extract('function escapeHtml(', '// ═'),ctx);
 ctx.renderChatRooms();ctx.renderChatMessages('general');
 assert.match(nodes['chat-rooms-list'].innerHTML,/&lt;etiqueta&gt;/);
 assert.match(nodes['chat-messages'].innerHTML,/Nombre &lt;alias&gt;/);
 assert.doesNotMatch(nodes['chat-messages'].innerHTML,/chat-msg mine/);
});
test('cambiar contraseña confirma el guardado solo después de que Firebase responde',async()=>{
 const input={value:'clave-de-prueba-larga'},notifications=[],button={disabled:false};let finish;
 const promise=new Promise(resolve=>{finish=resolve;});
 const ctx={document:{getElementById:()=>input},_auth:{currentUser:{uid:'yo',emailVerified:true,updatePassword:()=>promise}},currentUser:{uid:'yo'},toast:x=>notifications.push(x)};
 vm.createContext(ctx);vm.runInContext(extract('async function profileChangePass(', '// Patch showPage for profile load'),ctx);
 const result=ctx.profileChangePass(button);
 assert.equal(button.disabled,true);assert.deepEqual(notifications,[]);
 finish();await result;assert.equal(input.value,'');assert.equal(button.disabled,false);
 assert.match(notifications[0],/Contraseña actualizada/);
});
test('una sesión antigua no muestra éxito al cambiar la contraseña',async()=>{
 const input={value:'clave-de-prueba-larga'},notifications=[];
 const ctx={document:{getElementById:()=>input},_auth:{currentUser:{uid:'yo',emailVerified:true,updatePassword:async()=>{throw {code:'auth/requires-recent-login'};}}},currentUser:{uid:'yo'},toast:x=>notifications.push(x)};
 vm.createContext(ctx);vm.runInContext(extract('async function profileChangePass(', '// Patch showPage for profile load'),ctx);
 await ctx.profileChangePass({});
 assert.match(notifications[0],/volvé a entrar/);
 assert.doesNotMatch(notifications[0],/actualizada/);
});
