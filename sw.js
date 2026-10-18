/*
 * Service worker: приложение открывается без интернета и устанавливается на телефон.
 * Файлы приложения: отдаём из кэша и обновляем в фоне.
 * Общий набор (data/shared.json): сначала сеть, без сети — последняя сохранённая версия.
 * При изменении файлов приложения увеличьте номер VERSION, чтобы у всех обновился кэш.
 */
const VERSION = "v2";
const CACHE = "studycards-" + VERSION;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "js/utils.js", "js/db.js", "js/editor.js", "js/repo.js", "js/backup.js", "js/github.js", "js/sync.js",
  "js/ui.js", "js/router.js", "js/app.js",
  "js/views/subjects.js", "js/views/subject.js", "js/views/group.js", "js/views/flashcards.js",
  "js/views/quiz.js", "js/views/backup.js", "js/views/author.js",
  "data/shared.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("studycards-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // GitHub API и прочее — напрямую

  if (url.pathname.endsWith("/data/shared.json")) {
    event.respondWith(networkFirst(req, new URL("data/shared.json", self.registration.scope).href));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, new URL("index.html", self.registration.scope).href));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(cacheKey, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { network.catch(() => {}); return cached; }
  const res = await network;
  return res || new Response("Нет подключения к интернету", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
