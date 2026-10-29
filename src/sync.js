export class SharedCalendar {
  csrf='';
  async request(path,options={}) {
    const response=await fetch(`./api/${path}`,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(this.csrf?{'X-CSRF-Token':this.csrf}:{}),...options.headers}});
    const data=await response.json().catch(()=>({error:'The calendar server returned an unexpected response.'}));
    if(!response.ok) {const error=new Error(data.error||'Could not reach the shared calendar.');error.status=response.status;throw error;}
    return data;
  }
  async status() {
    const response=await fetch('./api/status',{credentials:'same-origin',cache:'no-store'});
    if(response.status===404 || (import.meta.env?.DEV && response.ok && !response.headers.get('content-type')?.includes('application/json'))) return {mode:'local'};
    if(!response.ok) throw new Error('The shared calendar server is unavailable. Reload to try again.');
    return response.json();
  }
  async login(passphrase) {this.csrf=(await this.request('login',{method:'POST',body:JSON.stringify({passphrase})})).csrf;}
  async resume() {this.csrf=(await this.request('session')).csrf;}
  list(month) {return this.request(`events?month=${encodeURIComponent(month)}`);}
  save(event,existing) {return this.request(existing?`events/${encodeURIComponent(event.id)}`:'events',{method:existing?'PUT':'POST',headers:existing?{'If-Match':existing.etag||''}:{},body:JSON.stringify(event)});}
  remove(event) {return this.request(`events/${encodeURIComponent(event.id)}`,{method:'DELETE',headers:{'If-Match':event.etag||''}});}
  async logout() {await this.request('logout',{method:'POST'});this.csrf='';}
}
