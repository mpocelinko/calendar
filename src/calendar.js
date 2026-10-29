export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1-first.getDay());
  const count = Math.ceil((first.getDay()+new Date(year,month+1,0).getDate())/7)*7;
  return Array.from({length:count},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
}
export function validateEvent(event) {
  if (!event.title?.trim()) return 'Give your appointment a title.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return 'Choose a date.';
  if (!event.start || !event.end || event.end <= event.start) return 'End time must be after start time.';
  if (!['Work','Personal','Family','Health'].includes(event.category)) return 'Choose a category.';
  if (!['Mike','Elena','Both'].includes(event.person)) return 'Choose who is attending.';
  return '';
}
export function readEvents(storage) {
  const raw = storage.getItem('mikes-calendar-v1');
  if (!raw) return [];
  const events = JSON.parse(raw);
  if (!Array.isArray(events) || events.some(e=> !e.id || validateEvent(e))) throw new Error('Invalid saved calendar');
  return events;
}
