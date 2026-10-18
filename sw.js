/*
 * Service worker: приложение открывается без интернета и устанавливается на телефон.
 * Все файлы: сначала сеть (обновления видны сразу), без сети — последняя сохранённая копия.
 * При изменении файлов приложения увеличьте номер VERSION, чтобы у всех обновился кэш.
 */
const VERSION = "v5";
const CACHE = "studycards-" + VERSION;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "styles.css",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "utils.js", "db.js", "editor.js", "repo.js", "backup.js", "github.js", "sync.js",
  "study.js", "ui.js", "router.js", "app.js",
  "view-subjects.js", "view-subject.js", "view-group.js", "view-flashcards.js",
  "view-quiz.js", "view-backup.js", "view-author.js",
  "shared.json",
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

  // Всегда сначала сеть: обновления сайта видны сразу. Без интернета — сохранённая копия.
  let key = url.origin + url.pathname;
  if (req.mode === "navigate") key = new URL("index.html", self.registration.scope).href;
  event.respondWith(networkFirst(req, key));
});

async function networkFirst(req, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(cacheKey, res.clone());
    return res;
  } catch (e) {
    const cached = (await cache.match(cacheKey)) || (await cache.match(req, { ignoreSearch: true }));
    if (cached) return cached;
    return new Response("Нет подключения к интернету", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
