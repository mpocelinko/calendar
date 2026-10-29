import './style.css';
import {SharedCalendar} from './sync.js';
import {dateKey, monthDays, validateEvent, readEvents, eventOnDate} from './calendar.js';
const app = document.querySelector('#app');
const shared = new SharedCalendar();
let mode='checking', signedIn=false, syncBusy=false, syncMessage='', calendarZone=Intl.DateTimeFormat().resolvedOptions().timeZone, requestSequence=0;
let localEvents=[];
const today = dateKey(new Date());
let cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selected = today, view = 'month', category = 'All', person = 'Everyone', query = '', events = [], storageError = '';
try { events = readEvents(localStorage); localEvents=events; } catch { storageError = 'Saved appointments could not be read. Your stored data has been left untouched. Reload after checking browser storage.'; }
const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const longDate = key => new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
const time = value => new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
const filtered = () => events.filter(e=>(category==='All'||e.category===category)&&(person==='Everyone'||e.person===person||e.person==='Both')&&`${e.title} ${e.location} ${e.notes}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
function card(e, small=false) { return `<button class="event ${e.category.toLowerCase()} ${small?'small':''}" data-event="${escape(e.id)}"><span class="event-title">${escape(e.title)}</span><span>${e.allDay?'All day':`${time(e.start)}${small?'':` – ${time(e.end)}`}`}</span>${small?'':`<span class="muted">${escape(e.location || e.category)}</span><span class="person">${escape(e.person)}</span>`}</button>`; }
function render() {
 const list = filtered(), upcoming = list.filter(e=>e.date>=today||eventOnDate(e,today)).slice(0,3), dayEvents=list.filter(e=>eventOnDate(e,selected));
 app.innerHTML = `<aside><a class="brand" href="./">▦ <span>Mike’s Calendar<small>A little more in sync.</small></span></a><div class="workspace">M + E <span>Our space</span></div><p class="label">YOUR CALENDAR</p><nav><button data-view="month" class="${view==='month'?'active':''}">▦ &nbsp; Calendar</button><button data-view="agenda" class="${view==='agenda'?'active':''}">☷ &nbsp; Agenda</button></nav><p class="label">CATEGORIES</p><div class="categories">${['All','Work','Personal','Family','Health'].map(c=>`<button data-category="${c}" class="${category===c?'active':''}"><i class="dot ${c.toLowerCase()}"></i>${c==='All'?'All appointments':c}<span>${events.filter(e=>c==='All'||e.category===c).length}</span></button>`).join('')}</div><div class="connection"><span class="dot"></span><strong>${mode==='icloud'?'iCloud calendar':'On this device'}</strong><p>${mode==='icloud'?'Sign in to sync your shared Apple calendar. Gmail is not connected.':'Browser-only preview. Open your hosted shared calendar to sync devices.'}</p></div></aside><main><header><div><p class="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h1>Our calendar</h1><p class="subtitle">Your plans. Our time. All in one place.</p></div><button class="primary" id="add">＋ <span>Add appointment</span></button></header>${storageError?`<p role="alert" class="warning">${escape(storageError)}</p>`:''}<section class="sync-panel" aria-label="Calendar connection"><div><strong>${mode==='icloud'?(signedIn?'Shared iCloud calendar':'Shared calendar sign-in'):mode==='local'?'Browser-only preview':mode==='unavailable'?'Calendar unavailable':'Connecting…'}</strong><p role="status">${escape(syncMessage||(mode==='local'?'Appointments here stay in this browser. Shared syncing needs the hosted backend.':signedIn?'Changes are saved directly to iCloud.':'Sign in to view your family’s appointments.'))}</p></div><div class="sync-actions">${mode==='icloud'?(signedIn?`<button id="refresh-sync" ${syncBusy?'disabled':''}>Refresh</button>${localEvents.length?`<button id="import-local" ${syncBusy?'disabled':''}>Import ${localEvents.length} local appointment${localEvents.length===1?'':'s'}</button>`:''}<button id="import-file" ${syncBusy?'disabled':''}>Import file</button><button id="sign-out">Sign out</button>`:'<button id="sign-in" class="primary">Sign in</button>'):`<button id="export-local">Export appointments</button><button id="sync-setup">Set up shared calendar</button>`}</div></section><div class="toolbar"><label class="search">⌕ <input id="search" type="search" placeholder="Search appointments" value="${escape(query)}" aria-label="Search appointments"></label><label class="people">Show <select id="person" aria-label="Filter by person">${['Everyone','Mike','Elena'].map(p=>`<option ${person===p?'selected':''}>${p}</option>`).join('')}</select></label></div><section class="upcoming"><div class="section-heading"><h2>Coming up</h2><span>TIME TOGETHER, TIME FOR YOU</span></div><div class="cards">${upcoming.length?upcoming.map(e=>`<article><div class="card-date">${escape(longDate(e.date))}</div>${card(e)}</article>`).join(''):`<div class="empty upcoming-empty"><span>☀</span><h3>A little space in your schedule</h3><p>Add your first appointment to see what’s coming up.</p><button class="text-button" id="first-add">＋ Add an appointment</button></div>`}</div></section><section class="calendar-panel"><div class="calendar-heading"><div class="month-title"><h2>${cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button id="prev" aria-label="Previous month">‹</button><button id="next" aria-label="Next month">›</button><button id="today">Today</button></div><div class="switch" aria-label="Calendar view"><button data-view="month" class="${view==='month'?'active':''}">Month</button><button data-view="agenda" class="${view==='agenda'?'active':''}">Agenda</button></div></div>${view==='month'?`<div class="weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span>${d}</span>`).join('')}</div><div class="month-grid">${monthDays(cursor.getFullYear(),cursor.getMonth()).map(d=>{const key=dateKey(d), daily=list.filter(e=>eventOnDate(e,key));return `<div class="day ${d.getMonth()!==cursor.getMonth()?'outside':''} ${key===selected?'selected':''}"><button class="day-number ${key===today?'is-today':''}" data-day="${key}" aria-label="${escape(longDate(key))}, ${daily.length} appointments" ${key===selected?'aria-pressed="true"':''}>${d.getDate()}</button><div class="day-events">${daily.slice(0,2).map(e=>card(e,true)).join('')}${daily.length>2?`<button class="more" data-day="${key}">+${daily.length-2} more</button>`:''}</div>${daily.length?'<span class="mobile-dot"></span>':''}</div>`;}).join('')}</div>`:`<div class="agenda">${list.filter(e=>e.date.startsWith(dateKey(cursor).slice(0,7))).map(e=>`<div class="agenda-row"><p>${escape(longDate(e.date))}</p>${card(e)}</div>`).join('')||'<div class="empty"><h3>No appointments this month</h3><p>Make some plans, or browse another month.</p></div>'}</div>`}<footer><span>${mode==='icloud'?(signedIn?'● iCloud calendar':'Sign in to load iCloud'):'● Saved on this device'}</span><span>Times shown in ${escape(calendarZone)}</span></footer></section>${view==='month'?`<section class="selected-day"><div class="section-heading"><h2>${escape(longDate(selected))}</h2><button class="text-button" id="day-add">＋ Add</button></div><div class="day-list">${dayEvents.map(e=>card(e)).join('')||'<p class="muted">Nothing scheduled. A little breathing room.</p>'}</div></section>`:''}<p class="bottom-note">Made for Mike & Elena <span>•</span> One day at a time.</p></main><dialog id="editor"></dialog><input type="file" id="import-picker" accept="application/json,.json" hidden>`;
 document.getElementById('sign-in')?.addEventListener('click',showLogin);
 document.getElementById('sync-setup')?.addEventListener('click',showSetup);
 document.getElementById('refresh-sync')?.addEventListener('click',()=>refreshShared());
 document.getElementById('import-local')?.addEventListener('click',importLocal);
 document.getElementById('sign-out')?.addEventListener('click',async()=>{++requestSequence;try{await shared.logout();signedIn=false;events=[];syncBusy=false;syncMessage='Signed out.';render();}catch(e){syncMessage=e.message;render();}});
 document.getElementById('export-local')?.addEventListener('click',exportLocal);
 document.getElementById('import-file')?.addEventListener('click',()=>document.getElementById('import-picker').click());
 document.getElementById('import-picker').onchange=async event=>{
   const file=event.target.files[0];if(!file)return;
   try{if(file.size>2_000_000)throw new Error('Choose a calendar export smaller than 2 MB.');const text=await file.text();const incoming=readEvents({getItem:()=>text});await importAppointments(incoming);}catch(e){syncMessage='Could not import that file. '+e.message;render();}
 };
 app.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
 app.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;render();});
 app.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>edit(events.find(e=>e.id===b.dataset.event)));
 app.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selected=b.dataset.day;render();});
 ['add','first-add','day-add'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>edit();});
 document.getElementById('prev').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render();refreshShared();};
 document.getElementById('next').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render();refreshShared();};
 document.getElementById('today').onclick=()=>{cursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);selected=today;render();refreshShared();};
 document.getElementById('person').onchange=e=>{person=e.target.value;render();};
 document.getElementById('search').oninput=e=>{const position=e.target.selectionStart;query=e.target.value;render();const input=document.getElementById('search');input.focus();try{input.setSelectionRange(position,position);}catch{}};
}
function persist(next) {
 if(storageError) throw new Error('Saving is paused to protect unreadable calendar data.');
 localStorage.setItem('mikes-calendar-v1',JSON.stringify(next)); events=next;localEvents=next;
}
function edit(existing) {
 if(mode!=='local'&&(!signedIn||mode!=='icloud')) {showLogin();return;}
 if(existing?.readOnly) {showReadOnly(existing);return;}

 const draftId=existing?.id||crypto.randomUUID();
 const dialog=document.getElementById('editor'), e=existing||{date:selected,start:'09:00',end:'09:30',category:'Personal',person:'Mike'};
 dialog.innerHTML=`<form id="event-form"><div class="dialog-heading"><div><p class="eyebrow">MAKE A LITTLE PLAN</p><h2>${existing?'Edit appointment':'New appointment'}</h2></div><button type="button" id="close" aria-label="Close">×</button></div><label>Title<input name="title" required maxlength="200" placeholder="Coffee, an interview, a family dinner…" value="${escape(e.title)}"></label><label>Date<input name="date" type="date" required value="${escape(e.date)}"></label><div class="form-row"><label>Starts<input name="start" type="time" required value="${escape(e.start)}"></label><label>Ends<input name="end" type="time" required value="${escape(e.end)}"></label></div><div class="form-row"><label>Category<select name="category">${['Personal','Work','Family','Health'].map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Who’s going?<select name="person">${['Mike','Elena','Both'].map(p=>`<option ${e.person===p?'selected':''}>${p}</option>`).join('')}</select></label></div><label>Location or meeting link<input name="location" maxlength="1000" value="${escape(e.location)}" placeholder="Where are we meeting?"></label><label>Notes<textarea name="notes" rows="3" maxlength="5000" placeholder="Anything to remember">${escape(e.notes)}</textarea></label><p class="muted form-note">Use your iPhone keyboard’s microphone to dictate. Automatic voice interpretation is coming later.</p><p id="form-error" role="alert"></p><div class="form-actions">${existing?'<button type="button" class="danger" id="delete">Delete</button>':''}<button type="button" id="cancel">Cancel</button><button class="primary" type="submit">Save appointment</button></div><div id="delete-confirm" hidden><p>Delete this appointment ${mode==='icloud'?'from iCloud and all shared devices':'from this device'}?</p><button type="button" class="danger" id="confirm-delete">Yes, delete appointment</button></div></form>`;
 dialog.querySelector('#close').onclick=dialog.querySelector('#cancel').onclick=()=>dialog.close();
 const error=message=>{dialog.querySelector('#form-error').textContent=message;};
 if(existing){dialog.querySelector('#delete').onclick=()=>{dialog.querySelector('#delete-confirm').hidden=false;};dialog.querySelector('#confirm-delete').onclick=async()=>{const button=dialog.querySelector('#confirm-delete');button.disabled=true;try{if(mode==='icloud')await shared.remove(existing);else persist(events.filter(x=>x.id!==existing.id));dialog.close();if(mode==='icloud')await refreshShared();else render();}catch(e){error(e.message||'Could not save changes.');}finally{button.disabled=false;}};}
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));data.title=data.title.trim();const message=validateEvent(data);if(message){error(message);return;}const submit=dialog.querySelector('[type=submit]');submit.disabled=true;try{data.id=draftId;if(mode==='icloud')await shared.save(data,existing);else persist([...events.filter(x=>x.id!==data.id),data]);selected=data.date;cursor=new Date(`${data.date.slice(0,7)}-01T12:00:00`);dialog.close();if(mode==='icloud')await refreshShared();else render();}catch(e){error(e.message||'Could not save.');}finally{submit.disabled=false;}};
 dialog.showModal();
}
render();
async function initialize() {
 try {
   const status=await shared.status(); mode=status.mode;
   if(mode==='icloud') {events=[];signedIn=status.authenticated;calendarZone=status.timeZone;if(signedIn){await shared.resume();await refreshShared();return;}}
   render();
 }catch(e){mode='unavailable';events=[];syncMessage=e.message;render();}
}
async function refreshShared(message='') {
 if(mode!=='icloud'||!signedIn||document.querySelector('dialog[open]'))return;
 const sequence=++requestSequence;
 syncBusy=true;
 try {
   const data=await shared.list(dateKey(cursor).slice(0,7));
   if(sequence!==requestSequence)return;
   events=data.events;calendarZone=data.timeZone;
   syncMessage=message||`Updated ${new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}. Showing this month and nearby dates.`;
 }catch(e){
   if(sequence!==requestSequence)return;
   syncMessage=e.message;
   if(e.status===401){signedIn=false;events=[];}
 }finally{if(sequence===requestSequence){syncBusy=false;if(!document.querySelector('dialog[open]'))render();}}
}
function showLogin() {
 if(mode!=='icloud'){showSetup();return;}
 const dialog=document.getElementById('editor');
 dialog.innerHTML=`<form><h2>Our shared calendar</h2><p class="muted">Use the calendar passphrase you set in Render, not your Apple password.</p><label>Calendar passphrase<input type="password" name="passphrase" autocomplete="current-password" required></label><p role="alert" id="login-error"></p><div class="form-actions"><button type="button" id="cancel-login">Cancel</button><button type="submit" class="primary">Sign in</button></div></form>`;
 dialog.querySelector('#cancel-login').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const submit=dialog.querySelector('[type=submit]');submit.disabled=true;try{await shared.login(new FormData(event.target).get('passphrase'));signedIn=true;dialog.close();await refreshShared();}catch(e){dialog.querySelector('#login-error').textContent=e.message;}finally{submit.disabled=false;}};
 dialog.showModal();
}
function showSetup() {
 const dialog=document.getElementById('editor');
 dialog.innerHTML=`<h2>One calendar, across your devices</h2><p class="muted">This GitHub Pages preview saves appointments only in this browser. The shared version needs a hosted backend connected to your iCloud calendar.</p><p class="muted">Once it’s deployed, open the same backend address on your iPhone and Mac and sign in with your calendar passphrase. Your Apple password never belongs in this website.</p><p><a href="https://github.com/mpocelinko/calendar/blob/main/docs/hosting.md" target="_blank" rel="noopener">Shared calendar setup instructions ↗</a></p><button id="close-setup">Close</button>`;
 dialog.querySelector('#close-setup').onclick=()=>dialog.close();dialog.showModal();
}
function showReadOnly(event) {
 const dialog=document.getElementById('editor');
 dialog.innerHTML=`<h2>${escape(event.title)}</h2><p class="muted">${escape(longDate(event.date))}${event.endDate&&event.endDate!==event.date?' · ends '+escape(longDate(event.allDay?dateKey(new Date(new Date(`${event.endDate}T12:00:00`).setDate(new Date(`${event.endDate}T12:00:00`).getDate()-1))):event.endDate)):''} · ${event.allDay?'All day':time(event.start)+' – '+time(event.end)}</p><p>${escape(event.location)}</p><p class="event-notes">${escape(event.notes)}</p><p class="muted">This appointment is shown from iCloud. Edit existing Apple events, invitations, recurring events, and all-day events in Apple Calendar. Simple appointments created here can be edited here.</p><button id="close-readonly">Close</button>`;
 dialog.querySelector('#close-readonly').onclick=()=>dialog.close();dialog.showModal();
}
async function importLocal() {return importAppointments(localEvents);}
async function importAppointments(incoming) {
 if(!confirm(`Copy ${incoming.length} browser appointment(s) to the shared iCloud calendar? Your browser copies will be kept. Existing iCloud appointments will not be overwritten.`))return;
 syncBusy=true;render();let saved=0,failed=0;
 for(const event of incoming){try{if(events.some(e=>e.id===event.id))continue;await shared.save(event);saved++;}catch{failed++;}}
 syncBusy=false;
 await refreshShared(`Imported ${saved} appointment(s). ${failed?`${failed} could not be imported (possibly already present). Browser copies were kept.`:'Browser copies were kept.'}`);
}
initialize();
window.addEventListener('focus',()=>refreshShared());
setInterval(()=>{if(document.visibilityState==='visible'&&!syncBusy)refreshShared();},60000);

function exportLocal() {
 const blob=new Blob([JSON.stringify(localEvents,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='mikes-calendar-appointments.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 syncMessage='Export downloaded. Keep it private. In the hosted shared calendar, sign in and choose Import file.';render();
}
