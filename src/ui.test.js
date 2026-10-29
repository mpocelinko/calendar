import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as helpers from './calendar.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const event={id:'6a9ea61c-c566-4096-bc43-b536d032de88',title:'Family appointment',date:helpers.dateKey(new Date()),start:'09:00',end:'09:30',category:'Family',person:'Both',etag:'"1"'};
async function setup(t,{mode='local',saved=[],remote=[],failSave=false}={}) {
 const dom=new JSDOM('<div id="app"></div>',{url:'https://calendar.example.test/',runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const {window}=dom;
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 window.setInterval=()=>0;
 window.confirm=()=>true;
 let calls=0;
 class SharedCalendar {
   async status(){return {mode,authenticated:mode==='icloud',timeZone:'America/New_York'};}
   async resume(){}
   async list(){return {events:remote,timeZone:'America/New_York'};}
   async save(value){calls++;if(failSave)throw new Error('iCloud is unavailable.');remote.push({...value,etag:'"2"'});}
   async remove(value){remote.splice(remote.findIndex(e=>e.id===value.id),1);}
 }
 Object.assign(window,{SharedCalendar,...helpers});
 window.localStorage.setItem('mikes-calendar-v1',JSON.stringify(saved));
 const code=readFileSync(new URL('./main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 window.eval(code);await tick();
 return {window,document:window.document,calls:()=>calls};
}
function completeForm(window,title) {
 const form=window.document.querySelector('#event-form');
 form.querySelector('[name=title]').value=title;
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
}
test('browser preview still creates and restores local appointments',async t=>{
 const {window,document}=await setup(t);
 document.querySelector('#add').click();completeForm(window,'Test appointment');await tick();
 const saved=JSON.parse(window.localStorage.getItem('mikes-calendar-v1'));
 assert.equal(saved.length,1);assert.equal(saved[0].title,'Test appointment');
 assert.match(document.body.textContent,/Test appointment/);
 assert.ok(document.querySelector('#export-local'));
});
test('shared save goes to backend and leaves local browser appointments untouched',async t=>{
 const {window,document,calls}=await setup(t,{mode:'icloud',saved:[event]});
 assert.ok(document.querySelector('#import-local'));
 document.querySelector('#add').click();completeForm(window,'Shared appointment');await tick();
 assert.equal(calls(),1);
 assert.match(document.body.textContent,/Shared appointment/);
 assert.deepEqual(JSON.parse(window.localStorage.getItem('mikes-calendar-v1')),[event]);
});
test('iCloud write failure keeps editor open without local fallback',async t=>{
 const {window,document,calls}=await setup(t,{mode:'icloud',failSave:true});
 document.querySelector('#add').click();completeForm(window,'Do not silently save');await tick();
 assert.equal(calls(),1);assert.ok(document.querySelector('dialog[open]'));
 assert.match(document.querySelector('#form-error').textContent,/iCloud is unavailable/);
 assert.deepEqual(JSON.parse(window.localStorage.getItem('mikes-calendar-v1')),[]);
});
test('native iCloud appointment opens details rather than an unsafe editor',async t=>{
 const {document}=await setup(t,{mode:'icloud',remote:[{...event,readOnly:true,notes:'<script>unsafe</script>'}]});
 document.querySelector('[data-event]').click();
 assert.ok(document.querySelector('dialog[open]'));assert.equal(document.querySelector('#event-form'),null);
 assert.match(document.querySelector('dialog').textContent,/Apple Calendar/);
 assert.equal(document.querySelector('dialog script'),null);
});
