import express from 'express';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateEvent} from '../src/calendar.js';

export function createApp({store,passphrase,secure=true,staticDir=fileURLToPath(new URL('../dist',import.meta.url))}) {
  if(!passphrase || passphrase.length<16) throw new Error('APP_PASSPHRASE must contain at least 16 characters.');
  const app=express(),sessions=new Map();
  let failures=0,blockedUntil=0;
  const hash=value=>createHash('sha256').update(value).digest();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});next();});
  app.use('/api',express.json({limit:'32kb'}));
  const sessionFor=req=>{
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('calendar_session='))?.slice(17);
    const session=token&&sessions.get(hash(token).toString('hex'));
    return session&&session.expires>Date.now()?session:null;
  };
  app.get('/api/status',(req,res)=>res.json({mode:'icloud',authenticated:Boolean(sessionFor(req)),configured:Boolean(store),timeZone:store?.zone||'America/New_York'}));
  app.post('/api/login',(req,res)=>{
    if(Date.now()<blockedUntil) return res.status(429).json({error:'Too many sign-in attempts. Wait one minute and try again.'});
    if(typeof req.body?.passphrase!=='string'||!timingSafeEqual(hash(req.body.passphrase),hash(passphrase))) {
      if(++failures>=10){blockedUntil=Date.now()+60_000;failures=0;}
      return res.status(401).json({error:'That calendar passphrase is incorrect.'});
    }
    failures=0;
    for(const [key,value] of sessions) if(value.expires<Date.now()) sessions.delete(key);
    if(sessions.size>1000) sessions.clear();
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    sessions.set(hash(token).toString('hex'),{csrf,expires:Date.now()+7*86400000});
    res.cookie('calendar_session',token,{httpOnly:true,secure,sameSite:'strict',maxAge:7*86400000,path:'/'}).json({csrf});
  });
  app.use('/api',(req,res,next)=>{
    const session=sessionFor(req);
    if(!session) return res.status(401).json({error:'Sign in to the shared calendar.'});
    if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf) return res.status(403).json({error:'Refresh the page before saving changes.'});
    req.session=session;next();
  });
  app.get('/api/session',(req,res)=>res.json({csrf:req.session.csrf}));
  app.post('/api/logout',(req,res)=>{
    for(const [key,value] of sessions) if(value===req.session) sessions.delete(key);
    res.clearCookie('calendar_session',{path:'/',httpOnly:true,secure,sameSite:'strict'}).json({ok:true});
  });
  app.use('/api',(req,res,next)=>store?next():res.status(503).json({error:'The backend is running, but its iCloud settings are not complete. Add the required variables in Render.'}));
  app.get('/api/events',async(req,res,next)=>{
    try {
      const month=req.query.month;
      if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({error:'Choose a valid month.'});
      res.json({events:await store.list(month),timeZone:store.zone});
    }catch(e){next(e);}
  });
  function eventBody(req,res) {
    const b=req.body;
    if(!b||typeof b!=='object'||['id','title','date','start','end','category','person'].some(k=>typeof b[k]!=='string')||b.title.length>200||['location','notes'].some(k=>b[k]!==undefined&&typeof b[k]!=='string')||(b.location||'').length>1000||(b.notes||'').length>5000) {res.status(400).json({error:'Invalid appointment details.'});return;}
    const error=validateEvent(b);
    if(error){res.status(400).json({error});return;}
    return {id:b.id,title:b.title,date:b.date,start:b.start,end:b.end,category:b.category,person:b.person,location:b.location||'',notes:b.notes||''};
  }
  app.post('/api/events',async(req,res,next)=>{try{const event=eventBody(req,res);if(!event)return;await store.save(event,undefined,false);res.status(201).json({ok:true});}catch(e){next(e);}});
  app.put('/api/events/:id',async(req,res,next)=>{try{const event=eventBody(req,res);if(!event)return;if(event.id!==req.params.id)return res.status(400).json({error:'Appointment identifiers do not match.'});await store.save(event,req.headers['if-match'],true);res.json({ok:true});}catch(e){next(e);}});
  app.delete('/api/events/:id',async(req,res,next)=>{try{await store.remove(req.params.id,req.headers['if-match']);res.json({ok:true});}catch(e){next(e);}});
  app.use('/api',(req,res)=>res.status(404).json({error:'Unknown calendar API route.'}));
  app.get('/healthz',(req,res)=>res.json({ok:true}));
  app.use(express.static(staticDir));
  app.use((err,req,res,next)=>{
    // Never return provider errors: they can contain account details or remote URLs.
    res.status(err.status>=400&&err.status<500?err.status:err.status===503?503:502).json({error:err.name==='CalendarError'?err.message:'The calendar service could not complete that request. Check the backend iCloud settings and try again.'});
  });
  return app;
}
