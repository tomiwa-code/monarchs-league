self. addEventListener("install", (event) =>{
  event.waitUntil(
    caches.open('pwa-cache').then((cache)=>{
      return caches.addall([
        '/',
        '/index.html'
      ]);
    })
  );
});

self. addEventListener("fetch", (event) =>{
  event. respondwith(
    caches. match(event. request). then ((response)=>{
      return response || fetch(event. request);
    })
  );
});