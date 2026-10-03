const CACHE="daily-health-tracker-v3-push";
const ASSETS=["./","./index.html","./style.css","./app.js","./push-config.js","./manifest.json"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>caches.match("./index.html"))));
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "Monster needs med" }; }
  const body = data.body || "Monster needs med";
  const reminderId = data.reminderId || "";
  const date = data.date || "";
  const target = `${self.registration.scope}?reminder=${encodeURIComponent(reminderId)}&date=${encodeURIComponent(date)}`;
  event.waitUntil(self.registration.showNotification(data.title || "Daily Health Tracker", {
    body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: reminderId || "daily-health-tracker-reminder",
    renotify: true,
    data: { target }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.target || self.registration.scope;
  event.waitUntil((async()=>{
    const windows = await clients.matchAll({type:"window", includeUncontrolled:true});
    for(const client of windows){
      if("focus" in client){
        try { await client.navigate(target); } catch {}
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
