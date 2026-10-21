const APP_VERSION = "__APP_VERSION__";
const CORE_CACHE = `brutal-blood-core-${APP_VERSION}`;
const ASSET_CACHE = `brutal-blood-assets-${APP_VERSION}`;
const CACHE_PREFIX = "brutal-blood-";

const scoped = (path = "") => new URL(path, self.registration.scope).href;

async function readManifest() {
  try {
    const response = await fetch(scoped("offline-manifest.json"), { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } catch {
    return { core: ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"], initial: [], optional: [] };
  }
}

async function cacheList(cacheName, items) {
  const cache = await caches.open(cacheName);
  for (const item of items) {
    const url = scoped(item.replace(/^\.\//, ""));
    try {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response.clone());
    } catch {
      // Installation stays resilient: one optional file never blocks offline support.
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const manifest = await readManifest();
    await cacheList(CORE_CACHE, [...new Set([...(manifest.core || []), ...(manifest.initial || [])])]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && ![CORE_CACHE, ASSET_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CORE_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || (await cache.match(scoped("index.html"))) || Response.error();
  }
}

async function cacheFirst(request) {
  const core = await caches.open(CORE_CACHE);
  const hit = await core.match(request);
  if (hit) return hit;
  const assets = await caches.open(ASSET_CACHE);
  const assetHit = await assets.match(request);
  if (assetHit) return assetHit;
  const fresh = await fetch(request);
  if (fresh.ok) await assets.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CACHE_ALL") {
    event.waitUntil((async () => {
      const manifest = await readManifest();
      await cacheList(ASSET_CACHE, manifest.optional || []);
    })());
  }
});
