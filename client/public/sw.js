/* global URL, caches, fetch, self */

const CACHE_NAME = "chess-coach-shell-v3";
const scopeUrl = new URL("./", self.registration.scope);
const coreAssets = [
  "./",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./logo.png",
  "./main.png",
  "./initializing.png",
  "./character.png",
  "./camera-sparkles.svg",
  "./candy.png",
  "./Stars.json",
  "./vendor/fonts/fredoka-one.css",
  "./vendor/fonts/fredoka-one.ttf",
  "./vendor/fontawesome/css/fontawesome.min.css",
  "./vendor/fontawesome/css/solid.min.css",
  "./vendor/fontawesome/webfonts/fa-solid-900.woff2",
  "./vendor/lottie/lottie-player.js",
  "./vendor/stockfish/stockfish-18-lite-single.js",
  "./vendor/stockfish/stockfish-18-lite-single.wasm",
].map((path) => new URL(path, scopeUrl).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(coreAssets)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(scopeUrl.href, copy));
          return response;
        })
        .catch(() => caches.match(scopeUrl.href)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
