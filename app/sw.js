/* Ranitas · service worker — Ricardo López Reyero (RLR) · build eye · rev 181218
   Estrategia: la app abre al instante desde caché y se actualiza sola por detrás.
   - Navegación (HTML): red primero con tope de 3 s; si no hay red, la copia guardada.
   - Estáticos propios (íconos, manifiestos, manual): caché primero, refresco silencioso.
   - Externos (fuentes, Firebase SDK, cdnjs): caché primero, refresco silencioso.
   - Firebase Realtime (websocket / long-poll) nunca pasa por aquí.
   - Nueva versión: se instala, avisa a la página y ella decide cuándo recargar. */
const VERSION="20260905-2115";
const SHELL="ranitas-shell-"+VERSION, EXT="ranitas-ext-v1";
const PRECACHE=["/","/index.html","/admin","/admin.html","/manual","/manual.html","/mesa","/mesa.html","/manifest.json","/admin.json","/favicon.png","/icon-192.png","/icon-512.png","/icon-192-maskable.png","/icon-512-maskable.png","/admin-icon-192.png","/admin-icon-512.png","/admin-icon-192-maskable.png","/admin-icon-512-maskable.png","/apple-touch-icon.png","/admin-apple-touch-icon.png"];
const EXT_OK=["fonts.googleapis.com","fonts.gstatic.com","www.gstatic.com","cdnjs.cloudflare.com"];
self.addEventListener("install",e=>{ self.skipWaiting(); e.waitUntil(caches.open(SHELL).then(c=>Promise.allSettled(PRECACHE.map(u=>c.add(new Request(u,{cache:"reload"})))))); });
self.addEventListener("activate",e=>{ e.waitUntil((async()=>{ const ks=await caches.keys(); await Promise.all(ks.filter(k=>k.startsWith("ranitas-shell-")&&k!==SHELL).map(k=>caches.delete(k))); await self.clients.claim(); const cs=await self.clients.matchAll({type:"window"}); cs.forEach(c=>c.postMessage({tipo:"activo",version:VERSION})); })()); });
self.addEventListener("message",e=>{ if(e.data&&e.data.tipo==="saltar") self.skipWaiting(); });
const conTope=(req,ms)=>new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error("tope")),ms); fetch(req).then(r=>{ clearTimeout(t); res(r); },err=>{ clearTimeout(t); rej(err); }); });
async function navegar(req){ const url=new URL(req.url); const c=await caches.open(SHELL);
  try{ const r=await conTope(req,3000); if(r&&r.ok){ c.put(req,r.clone()).catch(()=>{}); } return r; }
  catch(e){ const p=url.pathname; const alt=p.startsWith("/admin")?"/admin.html":p.startsWith("/manual")?"/manual.html":p.startsWith("/mesa")?"/mesa.html":"/index.html";
    return (await c.match(req))||(await c.match(alt))||(await c.match("/index.html"))||Response.error(); } }
async function cachePrimero(req,nombre){ const c=await caches.open(nombre); const hit=await c.match(req,{ignoreVary:true}); const red=fetch(req).then(r=>{ if(r&&(r.ok||r.type==="opaque")) c.put(req,r.clone()).catch(()=>{}); return r; }).catch(()=>null); if(hit){ red.catch(()=>{}); return hit; } const r=await red; return r||Response.error(); }
self.addEventListener("fetch",e=>{ const req=e.request; if(req.method!=="GET") return; const url=new URL(req.url);
  if(url.hostname.endsWith("firebaseio.com")||url.hostname.endsWith("firebasedatabase.app")||url.hostname.endsWith("workers.dev")||url.pathname.startsWith("/api")) return;
  if(req.mode==="navigate"){ e.respondWith(navegar(req)); return; }
  if(url.origin===location.origin){ if(url.pathname==="/sw"||url.pathname==="/sw.js") return; e.respondWith(cachePrimero(req,SHELL)); return; }
  if(EXT_OK.includes(url.hostname)){ e.respondWith(cachePrimero(req,EXT)); } });
/* RLR · eye/181218 */
