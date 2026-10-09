const CACHE='zainnet-article-v2.1-20261009';
const CORE=['./','./index.html','./app.js','./styles.css','./utils.js','./article-ai.js','./local-ai.js','./document-reader.js','./pdf-cmaps.js','./docx-engine.js','./ai-worker.js','./jszip.min.js','./favicon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zainnet-article-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 if(event.request.mode!=='navigate'&&!/\.(?:js|mjs|css|svg|wasm|bcmap|ttf|pfb)$/.test(url.pathname)&&!url.pathname.endsWith('/vendor/pdfjs/cmaps.zip'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||event.request.mode==='navigate'&&caches.match('./index.html')||Response.error())));
});
