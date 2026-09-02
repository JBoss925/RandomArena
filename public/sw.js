// Random Arena does not use offline caching. This worker replaces and retires
// service workers left on localhost by older projects, including workers that
// attempt to cache unsupported 206 audio responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(key=>caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
