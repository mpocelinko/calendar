export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1-first.getDay());
  const count = Math.ceil((first.getDay()+new Date(year,month+1,0).getDate())/7)*7;
  return Array.from({length:count},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
}
export function validateEvent(event) {
  if (!event || typeof event.title !== 'string' || !event.title.trim()) return 'Give your appointment a title.';
  if (typeof event.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(event.date) || Number.isNaN(Date.parse(`${event.date}T12:00:00Z`)) || new Date(`${event.date}T12:00:00Z`).toISOString().slice(0,10)!==event.date) return 'Choose a valid date between 2000 and 2099.';
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(event.start) || !validTime(event.end) || event.end <= event.start) return 'End time must be after start time on the same day.';
  if (!['Work','Personal','Family','Health'].includes(event.category)) return 'Choose a category.';
  if (!['Mike','Elena','Both'].includes(event.person)) return 'Choose who is attending.';
  return '';
}
export function readEvents(storage) {
  const raw = storage.getItem('mikes-calendar-v1');
  if (!raw) return [];
  const events = JSON.parse(raw);
  if (!Array.isArray(events) || events.some(e=> !e || typeof e.id!=='string' || !e.id || validateEvent(e))) throw new Error('Invalid saved calendar');
  return events;
}

export function eventOnDate(event, date) {
  if(date<event.date)return false;
  const end=event.endDate||event.date;
  return event.allDay || (event.end==='00:00' && end!==event.date) ? date<end : date<=end;
}
