const CACHE_VERSION = "freshwax-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/manifest.webmanifest"];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableRequest(request) {
  const url = new URL(request.url);

  if (request.method !== "GET" || !isSameOrigin(url)) {
    return false;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/calendar/")) {
    return false;
  }

  return true;
}

async function putInCache(cacheName, request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());

  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    const offline = await caches.match(OFFLINE_URL);
    return cached ?? offline ?? Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const freshResponse = fetch(request)
    .then((response) => putInCache(RUNTIME_CACHE, request, response))
    .catch(() => undefined);

  if (cached) {
    return cached;
  }

  return (await freshResponse) ?? Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isCacheableRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["font", "image", "script", "style", "worker"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : undefined;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      badge: "/icon",
      icon: "/icon",
      image: imageUrl,
      tag: payload.tag,
      data: payload.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
