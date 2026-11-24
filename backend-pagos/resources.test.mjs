import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../shared.js',import.meta.url),'utf8');
const snippet=source.slice(source.indexOf('function resourceTarget('),source.indexOf('\n}',source.indexOf('function downloadAttachment(name,data){'))+2);
function setup(){
 const opened=[],downloads=[],toasts=[],elements=[];let authorized=true,reads=0;
 class Element{constructor(){this.style={};this.children=[];}append(...x){this.children.push(...x);}replaceChildren(){this.children=[];}closest(){return {style:{}};}click(){downloads.push({url:this.href,name:this.download});}remove(){}}
 const context={URL,Blob,Uint8Array,atob,currentCourseId:1,console,setTimeout:fn=>fn(),
  document:{body:new Element(),createElement:()=>{const el=new Element();elements.push(el);return el;}},
  toast:x=>toasts.push(x),fileIcon:()=>'',open:()=>{const tab={opener:undefined,closed:false,location:{replace:url=>opened.push(url)},close(){this.closed=true;}};context.tab=tab;return tab;},
  miraDigitalAccess:{read:async()=>{reads++;if(!authorized)throw Error('Sin acceso al curso');return {id:1};}}};
 context.window=context;vm.createContext(context);vm.runInContext(snippet,context);
 return {context,elements,toasts,downloads,opened,setAuthorized:x=>authorized=x,get reads(){return reads;}};
}
test('recursos aceptan enlaces HTTPS y adjuntos de archivo y rechazan esquemas ejecutables',()=>{
 const t=setup(),target=t.context.resourceTarget;
 assert.equal(target({link:'https://drive.google.com/file/d/id/view'}).inline,false);
 assert.equal(target({data:'data:application/pdf;base64,JVBERg=='}).inline,true);
 for(const value of ['', 'javascript:alert(1)','data:text/html;base64,PGgxPg==','https://u:p@example.com/a','//example.com/a','http://example.com/a'])
   assert.equal(target({url:value}),null);
});
test('un archivo sin enlace informa qué falta sin abrir una pestaña',async()=>{
 const t=setup();await t.context.openLessonResource({name:'Programa'});assert.equal(t.reads,0);assert.equal(t.opened.length,0);assert.match(t.toasts[0],/enlace cargado/);
});
test('el enlace de archivo se abre luego de validar nuevamente el acceso',async()=>{
 const t=setup();await t.context.openLessonResource({name:"Guía d'extensiones",url:'https://example.com/a.pdf'});
 assert.equal(t.reads,1);assert.deepEqual(t.opened,['https://example.com/a.pdf']);assert.equal(t.context.tab.opener,null);
});
test('al perder autorización cierra la pestaña y conserva privado el enlace',async()=>{
 const t=setup();t.setAuthorized(false);await t.context.openLessonResource({url:'https://example.com/a.pdf'});
 assert.equal(t.opened.length,0);assert.equal(t.context.tab.closed,true);assert.match(t.toasts[0],/Sin acceso/);
});
test('los adjuntos PDF generan una descarga real y admiten comillas en el nombre',async()=>{
 const t=setup();await t.context.openLessonResource({name:"Guía d'extensiones.pdf",data:'data:application/pdf;base64,JVBERg=='});
 assert.equal(t.reads,1);assert.equal(t.downloads.length,1);assert.match(t.downloads[0].url,/^blob:/);assert.equal(t.downloads[0].name,"Guía d'extensiones.pdf");
});
test('el render de recursos utiliza texto y callbacks, sin interpolar nombres en onclick',()=>{
 const t=setup(),host={children:[],replaceChildren(){this.children=[];},append(x){this.children.push(x);},closest(){return {style:{}};}};
 t.context.renderLessonResources(host,{resources:[{name:"<img src=x onerror=alert('1')>",url:'https://example.com/a.pdf'},{name:'Pendiente'}]});
 assert.equal(host.children.length,2);assert.equal(typeof host.children[0].onclick,'function');
 assert.equal(host.children[0].children[1].children[0].textContent,"<img src=x onerror=alert('1')>");
 assert.equal(host.children[1].children[1].children[1].textContent,'Archivo pendiente de carga');
});

