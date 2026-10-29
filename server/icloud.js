import ICAL from 'ical.js';
import { createDAVClient } from 'tsdav';
import { createHash } from 'node:crypto';
import { validateEvent } from '../src/calendar.js';

export class CalendarError extends Error {
  constructor(message, status=502) { super(message); this.status=status; }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const parts = (date, zone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
export function wallToUTC(date, time, zone) {
  const target=Date.parse(`${date}T${time}:00Z`);
  let candidate=target;
  for(let i=0;i<4;i++) {
    const p=parts(new Date(candidate),zone);
    const wall=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const difference=target-wall;
    if(!difference) return new Date(candidate);
    candidate+=difference;
  }
  throw new CalendarError('That local time does not exist because of a daylight-saving change.',400);
}
function instant(value, zone, tzid) {
  if(value.zone.tzid==='UTC' || value.zone.tzid!=='floating') return value.toJSDate();
  return wallToUTC(value.toString().slice(0,10),value.toString().slice(11,16),tzid||zone);
}
export function decodeObject(object, zone) {
  const component=new ICAL.Component(ICAL.parse(object.data));
  for(const tz of component.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  return component.getAllSubcomponents('vevent').filter(c=>c.getFirstPropertyValue('status')!=='CANCELLED').map(c=>{
    const event=new ICAL.Event(c), start=event.startDate, end=event.endDate;
    if(!start || !end) throw new CalendarError('An iCloud appointment has no usable date. No appointments were changed.');
    const startParts=start.isDate?null:parts(instant(start,zone,c.getFirstProperty('dtstart')?.getParameter('tzid')),zone);
    const endParts=end.isDate?null:parts(instant(end,zone,c.getFirstProperty('dtend')?.getParameter('tzid')),zone);
    const date=start.isDate?start.toString():`${startParts.year}-${startParts.month}-${startParts.day}`;
    const endDate=end.isDate?end.toString():`${endParts.year}-${endParts.month}-${endParts.day}`;
    const own=c.getFirstPropertyValue('x-mikes-id');
    const complex=Boolean(c.hasProperty('recurrence-id')||c.hasProperty('rrule')||c.hasProperty('rdate')||c.hasProperty('organizer')||c.hasProperty('attendee')||start.isDate||endDate!==date);
    return {id:own&&uuid.test(own)&&!complex?own:createHash('sha256').update(`${event.uid}/${start.toString()}`).digest('hex'),title:event.summary||'Untitled appointment',date,endDate,start:start.isDate?'00:00':`${startParts.hour}:${startParts.minute}`,end:end.isDate?'23:59':`${endParts.hour}:${endParts.minute}`,allDay:start.isDate,location:event.location||'',notes:event.description||'',category:['Work','Personal','Family','Health'].includes(c.getFirstPropertyValue('x-mikes-category'))?c.getFirstPropertyValue('x-mikes-category'):'Family',person:['Mike','Elena','Both'].includes(c.getFirstPropertyValue('x-mikes-person'))?c.getFirstPropertyValue('x-mikes-person'):'Both',etag:object.etag,readOnly:!own||complex,source:'iCloud'};
  });
}
export function encodeEvent(event, zone, original) {
  const error=validateEvent(event);
  if(error || !uuid.test(event.id)) throw new CalendarError(error||'Invalid appointment identifier.',400);
  const calendar=original?new ICAL.Component(ICAL.parse(original)):new ICAL.Component(['vcalendar',[],[]]);
  if(!original) {calendar.updatePropertyWithValue('version','2.0');calendar.updatePropertyWithValue('prodid','-//Mike and Elena//Calendar//EN');}
  const c=calendar.getFirstSubcomponent('vevent')||new ICAL.Component('vevent');
  if(!calendar.getFirstSubcomponent('vevent')) calendar.addSubcomponent(c);
  if(original&&(calendar.getAllSubcomponents('vevent').length!==1||['rrule','rdate','recurrence-id','organizer','attendee'].some(p=>c.hasProperty(p))||c.getFirstPropertyValue('x-mikes-id')!==event.id)) throw new CalendarError('Edit this appointment in Apple Calendar.',409);
  c.updatePropertyWithValue('uid',c.getFirstPropertyValue('uid')||`${event.id}@mikes-calendar`);
  c.updatePropertyWithValue('summary',event.title.trim());
  c.updatePropertyWithValue('description',event.notes||'');
  c.updatePropertyWithValue('location',event.location||'');
  c.removeAllProperties('dtstart');
  c.removeAllProperties('dtend');
  c.updatePropertyWithValue('dtstart',ICAL.Time.fromJSDate(wallToUTC(event.date,event.start,zone),true));
  c.removeAllProperties('duration');
  c.updatePropertyWithValue('dtend',ICAL.Time.fromJSDate(wallToUTC(event.date,event.end,zone),true));
  c.updatePropertyWithValue('dtstamp',ICAL.Time.fromJSDate(new Date(),true));
  c.updatePropertyWithValue('sequence',Number(c.getFirstPropertyValue('sequence')||0)+1);
  c.updatePropertyWithValue('x-mikes-id',event.id);
  c.updatePropertyWithValue('x-mikes-category',event.category);
  c.updatePropertyWithValue('x-mikes-person',event.person);
  return calendar.toString();
}
export function createICloudStore({username,password,calendarName,zone='America/New_York',clientFactory=createDAVClient}) {
  let clientPromise;
  async function connect() {
    if(!clientPromise) clientPromise=clientFactory({serverUrl:'https://caldav.icloud.com',credentials:{username,password},authMethod:'Basic',defaultAccountType:'caldav',fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(25000)})}).catch(e=>{clientPromise=null;throw e;});
    const client=await clientPromise;
    const calendars=await client.fetchCalendars();
    const matches=calendars.filter(c=>c.displayName===calendarName);
    if(matches.length!==1) throw new CalendarError('The configured iCloud calendar name must match exactly one accessible calendar. Check ICLOUD_CALENDAR_NAME in the hosting settings.',503);
    return {client,calendar:matches[0]};
  }
  async function original(client,calendar,id,etag) {
    if(!uuid.test(id)) throw new CalendarError('This appointment can only be edited in Apple Calendar.',400);
    const url=new URL(`${id}.ics`,calendar.url.endsWith('/')?calendar.url:`${calendar.url}/`).href;
    const objects=await client.fetchCalendarObjects({calendar,objectUrls:[url]});
    const object=objects.find(o=>o.url===url);
    if(!object) throw new CalendarError('This appointment was removed. Refresh the calendar.',404);
    if(!etag || object.etag!==etag) throw new CalendarError('This appointment changed on another device. Refresh before editing.',409);
    const decoded=decodeObject(object,zone);
    if(decoded.length!==1 || decoded[0].readOnly || decoded[0].id!==id) throw new CalendarError('Edit this appointment in Apple Calendar.',409);
    return object;
  }
  function check(response) {
    if(response.status===412) throw new CalendarError('This appointment changed on another device. Refresh before editing.',409);
    if(!response.ok) throw new CalendarError('iCloud could not save the change. Check calendar write access and try again.');
  }
  return {
    zone,
    async list(month) {
      const {client,calendar}=await connect();
      const year=Number(month.slice(0,4)), m=Number(month.slice(5,7))-1;
      const start=new Date(Date.UTC(year,m-1,1)).toISOString(),end=new Date(Date.UTC(year,m+3,1)).toISOString();
      const objects=await client.fetchCalendarObjects({calendar,timeRange:{start,end},expand:true});
      return objects.flatMap(o=>decodeObject(o,zone));
    },
    async save(event,etag,update=false) {
      const {client,calendar}=await connect();
      if(update) {
        const object=await original(client,calendar,event.id,etag);
        check(await client.updateCalendarObject({calendarObject:{...object,data:encodeEvent(event,zone,object.data)},headers:{'If-Match':etag}}));
      } else {
        check(await client.createCalendarObject({calendar,iCalString:encodeEvent(event,zone),filename:`${event.id}.ics`,headers:{'If-None-Match':'*'}}));
      }
    },
    async remove(id,etag) {
      const {client,calendar}=await connect();
      const object=await original(client,calendar,id,etag);
      check(await client.deleteCalendarObject({calendarObject:object,headers:{'If-Match':etag}}));
    }
  };
}
