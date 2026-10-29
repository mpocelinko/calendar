import {test} from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {encodeEvent,decodeObject,wallToUTC,createICloudStore} from './icloud.js';
const event={id:'6a9ea61c-c566-4096-bc43-b536d032de88',title:'Family appointment',date:'2026-10-29',start:'09:00',end:'09:30',category:'Family',person:'Both',notes:'Notes, commas; and\nnew lines',location:'Home'};
test('iCalendar roundtrip preserves time, notes, and attendee labels',()=>{
 const data=encodeEvent(event,'America/New_York');
 const result=decodeObject({data,etag:'"1"'},'America/New_York')[0];
 for(const key of ['id','title','date','start','end','category','person','notes','location']) assert.equal(result[key],event[key]);
 assert.equal(result.readOnly,false);
 assert.match(data,/DTSTART:20261029T130000Z/);
 assert.match(data,/DTEND:20261029T133000Z/);
});
test('timezone conversion handles seasonal offsets and rejects DST gaps',()=>{
 assert.equal(wallToUTC('2026-01-15','09:00','America/New_York').toISOString(),'2026-01-15T14:00:00.000Z');
 assert.equal(wallToUTC('2026-07-15','09:00','America/New_York').toISOString(),'2026-07-15T13:00:00.000Z');
 assert.throws(()=>wallToUTC('2026-03-08','02:30','America/New_York'),/does not exist/);
});
test('updating preserves Apple metadata and alarms',()=>{
 const original=new ICAL.Component(ICAL.parse(encodeEvent(event,'America/New_York')));
 const c=original.getFirstSubcomponent('vevent');c.updatePropertyWithValue('url','https://example.com/meeting');
 const alarm=new ICAL.Component('valarm');alarm.updatePropertyWithValue('action','DISPLAY');alarm.updatePropertyWithValue('description','Reminder');c.addSubcomponent(alarm);
 const updated=new ICAL.Component(ICAL.parse(encodeEvent({...event,title:'Changed'},'America/New_York',original.toString()))).getFirstSubcomponent('vevent');
 assert.equal(updated.getFirstPropertyValue('url'),'https://example.com/meeting');
 assert.equal(updated.getFirstSubcomponent('valarm').getFirstPropertyValue('description'),'Reminder');
});
test('native invitations, all-day dates and recurring instances stay read-only',()=>{
 const data='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:apple-event\r\nDTSTART;VALUE=DATE:20261029\r\nDTEND;VALUE=DATE:20261031\r\nSUMMARY:Family visit\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const e=decodeObject({data},'America/New_York')[0];assert.equal(e.allDay,true);assert.equal(e.endDate,'2026-10-31');assert.equal(e.readOnly,true);
 const c=new ICAL.Component(ICAL.parse(encodeEvent(event,'America/New_York')));c.getFirstSubcomponent('vevent').updatePropertyWithValue('organizer','mailto:someone@example.com');
 assert.equal(decodeObject({data:c.toString()},'America/New_York')[0].readOnly,true);
 assert.throws(()=>encodeEvent(event,'America/New_York',c.toString()),/Apple Calendar/);
 const recurring=new ICAL.Component(ICAL.parse(encodeEvent(event,'America/New_York')));recurring.getFirstSubcomponent('vevent').updatePropertyWithValue('recurrence-id',ICAL.Time.fromString('2026-10-29T13:00:00Z'));
 assert.equal(decodeObject({data:recurring.toString()},'America/New_York')[0].readOnly,true);
});
test('CalDAV requests expand recurrence and prevent overwrites using entity tags',async()=>{
 const calendar={url:'https://caldav.example.test/shared/',displayName:'Family'};
 let remote={url:calendar.url+event.id+'.ics',data:encodeEvent(event,'America/New_York'),etag:'"2"'},updated=false;
 const client={fetchCalendars:async()=>[calendar],fetchCalendarObjects:async options=>{if(options.timeRange){assert.equal(options.expand,true);assert.match(options.timeRange.start,/2026-09-01/);}return [remote];},updateCalendarObject:async options=>{assert.equal(options.headers['If-Match'],'"2"');updated=true;return new Response(null,{status:204});}};
 const store=createICloudStore({calendarName:'Family',clientFactory:async()=>client});
 assert.equal((await store.list('2026-10')).length,1);
 await assert.rejects(store.save(event,'"1"',true),/changed on another device/);
 assert.equal(updated,false);
 await store.save({...event,title:'New title'},'"2"',true);assert.equal(updated,true);
 client.updateCalendarObject=async()=>new Response(null,{status:412});
 await assert.rejects(store.save(event,'"2"',true),/changed on another device/);
});
test('ambiguous calendar names do not cause writes to an arbitrary calendar',async()=>{
 const store=createICloudStore({calendarName:'Family',clientFactory:async()=>({fetchCalendars:async()=>[{displayName:'Family'},{displayName:'Family'}]})});
 await assert.rejects(store.list('2026-10'),/exactly one/);
});

test('native timezone parameters are honored without a VTIMEZONE component',()=>{
 const data='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:tz-test\r\nDTSTART;TZID=America/Los_Angeles:20261029T090000\r\nDTEND;TZID=America/Los_Angeles:20261029T100000\r\nSUMMARY:West coast interview\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const decoded=decodeObject({data},'America/New_York')[0];
 assert.equal(decoded.start,'12:00');assert.equal(decoded.end,'13:00');
});
