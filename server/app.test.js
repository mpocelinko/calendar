import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './app.js';
import {CalendarError} from './icloud.js';
const passphrase='test-only-calendar-passphrase';
const event={id:'6a9ea61c-c566-4096-bc43-b536d032de88',title:'Interview',date:'2026-10-29',start:'09:00',end:'09:30',category:'Work',person:'Mike'};
async function serve(t,store,options={}) {
 const server=createApp({store,passphrase,secure:false,...options}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 return (path,options)=>fetch(base+path,options);
}
async function login(request) {
 const response=await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passphrase})});
 assert.equal(response.status,200);
 const csrf=(await response.json()).csrf,cookie=response.headers.get('set-cookie').split(';')[0];
 return {'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf};
}
test('two authenticated clients see shared writes, updates, and deletes',async t=>{
 const values=new Map();
 const store={zone:'America/New_York',list:async()=>[...values.values()],save:async(e,tag,update)=>{if(update&&values.get(e.id)?.etag!==tag)throw new CalendarError('Conflict',409);values.set(e.id,{...e,etag:'"next"'});},remove:async id=>values.delete(id)};
 const request=await serve(t,store);
 assert.equal((await request('/api/events?month=2026-10')).status,401);
 const first=await login(request),second=await login(request);
 assert.equal((await request('/api/events',{method:'POST',headers:first,body:JSON.stringify(event)})).status,201);
 let data=await (await request('/api/events?month=2026-10',{headers:second})).json();assert.equal(data.events[0].title,'Interview');
 assert.equal((await request('/api/events/'+event.id,{method:'PUT',headers:{...second,'If-Match':'"wrong"'},body:JSON.stringify({...event,title:'Rescheduled'})})).status,409);
 assert.equal((await request('/api/events/'+event.id,{method:'PUT',headers:{...second,'If-Match':'"next"'},body:JSON.stringify({...event,title:'Rescheduled'})})).status,200);
 data=await (await request('/api/events?month=2026-10',{headers:first})).json();assert.equal(data.events[0].title,'Rescheduled');
 assert.equal((await request('/api/events/'+event.id,{method:'DELETE',headers:{...first,'If-Match':'"next"'}})).status,200);
 assert.deepEqual((await (await request('/api/events?month=2026-10',{headers:second})).json()).events,[]);
});
test('rejects invalid credentials, CSRF, dates, and malformed event fields',async t=>{
 let writes=0;
 const request=await serve(t,{zone:'America/New_York',save:async()=>writes++});
 assert.equal((await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"passphrase":"wrong"}'})).status,401);
 const headers=await login(request);
 assert.equal((await request('/api/events',{method:'POST',headers:{...headers,'X-CSRF-Token':'wrong'},body:JSON.stringify(event)})).status,403);
 for(const bad of [{...event,date:'2026-02-30'},{...event,start:'99:99'},{...event,title:5},{...event,location:{secret:'value'}}]) assert.equal((await request('/api/events',{method:'POST',headers,body:JSON.stringify(bad)})).status,400);
 assert.equal(writes,0);
 assert.equal((await request('/api/events?month=invalid',{headers})).status,400);
});
test('secure cookies, logout, missing configuration and sanitized provider errors',async t=>{
 const request=await serve(t,null,{secure:true});
 const response=await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passphrase})});
 assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
 const headers=await login(request);
 assert.equal((await request('/api/events?month=2026-10',{headers})).status,503);
 assert.equal((await request('/api/logout',{method:'POST',headers})).status,200);
 assert.equal((await request('/api/session',{headers})).status,401);
 const broken=await serve(t,{list:async()=>{throw new Error('Secret provider account info');}});
 const auth=await login(broken);
 const failed=await broken('/api/events?month=2026-10',{headers:auth});
 assert.equal(failed.status,502);assert.doesNotMatch(await failed.text(),/Secret provider account info/);
});
