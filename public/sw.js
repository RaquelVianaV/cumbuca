const CACHE_NAME = "cumbuca-v192";
const APP_SHELL = [
  "/",
  "/index.html",
  "/login",
  "/login.html",
  "/styles.css?v=20260814-01",
  "/partner-accounts.js?v=20260814-01",
  "/account-transfers.js?v=20260809-02",
  "/app.js?v=20260814-08",
  "/login.js",
  "/logo-cumbuca-original.png",
  "/mapa-cumbuca.png",
  "/manifest.json",
  "/hoje",
  "/fluxo-de-caixa",
  "/menu-semanal",
  "/financeiro"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(response => response || caches.match("/") || caches.match("/index.html")))
  );
});
