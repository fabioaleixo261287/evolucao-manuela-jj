const CACHE_NAME = "alliance-mooca-kids-pwa-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./eagle-cutout.png",
  "./avatar.png",
  "./logo.jpg",
  "./graus_coloridos.jpeg",
  "./sistema_graduacao.jpeg",
  "./pwa-icons/icon-192.png",
  "./pwa-icons/icon-512.png",
  "./pwa-icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isAppwriteOrSupabase =
    requestUrl.hostname.includes("appwrite.io") ||
    requestUrl.hostname.includes("cloud.appwrite.io") ||
    requestUrl.hostname.includes("supabase.co");

  if (isAppwriteOrSupabase) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const shouldCache = response && response.ok && response.type !== "opaque";
        if (shouldCache) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
