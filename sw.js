const CACHE_PREFIX='guernsey-property-finder-';
const CACHE=CACHE_PREFIX+'hosted-v12';
const CORE=['./','./index.html','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];
const absolute=p=>new URL(p,self.registration.scope).href;
const CORE_URLS=new Set(CORE.map(absolute));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(CORE);
 try{const r=await fetch(absolute('./properties.json'));if(r.ok){const d=await r.clone().json();if(d.schemaVersion===1&&Array.isArray(d.properties)&&d.properties.length)await cache.put(absolute('./properties.json'),r)}}catch{}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(url.href===absolute('./properties.json')){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const r=await fetch(event.request);if(!r.ok)throw Error('Feed unavailable');const d=await r.clone().json();if(d.schemaVersion!==1||!Array.isArray(d.properties)||!d.properties.length)throw Error('Invalid feed');await cache.put(absolute('./properties.json'),r.clone());return r}catch{return await cache.match(absolute('./properties.json'))||new Response(JSON.stringify({error:'No offline feed'}),{status:503,headers:{'Content-Type':'application/json'}})}})());return;
 }
 if(event.request.mode==='navigate'&&url.href.startsWith(self.registration.scope)){
  event.respondWith(caches.match(absolute('./index.html'),{cacheName:CACHE}).then(r=>r||fetch(event.request)));return;
 }
 if(CORE_URLS.has(url.href))event.respondWith(caches.match(event.request,{cacheName:CACHE}).then(r=>r||fetch(event.request)));
});
