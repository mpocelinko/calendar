import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthDays, dateKey, validateEvent, readEvents, eventOnDate} from './calendar.js';
const event={id:'one',title:'Interview',date:'2026-10-29',start:'09:00',end:'09:30',category:'Work',person:'Mike'};
test('month includes adjacent dates in the right months',()=>{
 const days=monthDays(2026,9);
 assert.equal(dateKey(days[0]),'2026-09-27');
 assert.equal(dateKey(days.at(-1)),'2026-10-31');
 assert.equal(days.filter(d=>d.getMonth()===9).length,31);
 for(let i=1;i<days.length;i++) assert.equal((days[i]-days[i-1])/86400000,1);
});
test('month grid crosses a year boundary',()=>{
 const days=monthDays(2027,0);
 assert.equal(dateKey(days[0]),'2026-12-27');
 assert.equal(days[0].getDay(),0);
 assert.equal(days.at(-1).getDay(),6);
});
test('rejects empty titles and inverted appointment times',()=>{
 assert.equal(validateEvent(event),'');
 assert.ok(validateEvent({...event,title:'   '}));
 assert.ok(validateEvent({...event,end:'08:30'}));
 assert.ok(validateEvent({...event,end:'09:00'}));
});
test('restores saved appointments and rejects corrupt data',()=>{
 assert.deepEqual(readEvents({getItem:()=>JSON.stringify([event])}),[event]);
 assert.deepEqual(readEvents({getItem:()=>null}),[]);
 assert.throws(()=>readEvents({getItem:()=>'{broken'}));
 assert.throws(()=>readEvents({getItem:()=>'{"not":"events"}'}));
 assert.throws(()=>readEvents({getItem:()=>JSON.stringify([{...event,end:'08:00'}])}));
});
test('rejects invalid calendar dates and malformed stored records',()=>{
 assert.ok(validateEvent({...event,date:'2026-02-30'}));
 assert.ok(validateEvent({...event,start:'25:00'}));
 assert.throws(()=>readEvents({getItem:()=>'[null]'}));
});

test('multi-day events appear on each day, respecting exclusive all-day end',()=>{
 const visit={date:'2026-10-29',endDate:'2026-10-31',allDay:true};
 assert.equal(eventOnDate(visit,'2026-10-28'),false);
 assert.equal(eventOnDate(visit,'2026-10-29'),true);
 assert.equal(eventOnDate(visit,'2026-10-30'),true);
 assert.equal(eventOnDate(visit,'2026-10-31'),false);
 assert.equal(eventOnDate({...visit,allDay:false,end:'10:00'},'2026-10-31'),true);
});
