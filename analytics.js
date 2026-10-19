/*
 * Обезличенная статистика посещений через GoatCounter (бесплатно, без cookies).
 * Статистику видит только владелец кабинета на goatcounter.com.
 * Чтобы включить, впишите свой код из GoatCounter в CODE (например "studycards-lp").
 * Пустой CODE — статистика выключена.
 */
App.analytics = (function () {
  const CODE = "";

  const SKIP_KEY = "skipgc"; // этот же ключ проверяет сам GoatCounter
  let loaded = false;
  let lastHash = null;

  function enabled() {
    return !!CODE && location.protocol.startsWith("http");
  }

  function isSelfExcluded() {
    try { return localStorage.getItem(SKIP_KEY) === "t"; } catch (e) { return false; }
  }

  /** Не считать посещения с этого устройства (для автора). */
  function setSelfExcluded(on) {
    try {
      if (on) localStorage.setItem(SKIP_KEY, "t");
      else localStorage.removeItem(SKIP_KEY);
    } catch (e) { /* хранилище недоступно */ }
  }

  /** Понятный путь без внутренних идентификаторов. */
  function pathFor(hash) {
    const h = hash || "#/";
    if (/^#?\/?$/.test(h)) return "/";
    if (/^#\/subject\/[^/]+\/flashcards$/.test(h)) return "/predmet/karticky";
    if (/^#\/subject\/[^/]+\/quiz$/.test(h)) return "/predmet/test";
    if (/^#\/subject\/[^/]+$/.test(h)) return "/predmet";
    if (/^#\/group\/[^/]+\/flashcards$/.test(h)) return "/skupina/karticky";
    if (/^#\/group\/[^/]+\/quiz$/.test(h)) return "/skupina/test";
    if (/^#\/group\/[^/]+$/.test(h)) return "/skupina";
    if (h === "#/backup") return "/kopia";
    if (h === "#/author") return "/autor";
    return "/ine";
  }

  function load() {
    if (!enabled() || loaded) return;
    loaded = true;
    window.goatcounter = { no_onload: true }; // считаем сами: у сайта переходы внутри одной страницы
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + CODE + ".goatcounter.com/count");
    s.onload = () => track(true);
    document.head.appendChild(s);
  }

  /** Отмечает просмотр текущего экрана (один раз на каждый переход). */
  function track(force) {
    if (!enabled() || isSelfExcluded()) return;
    const gc = window.goatcounter;
    if (!gc || typeof gc.count !== "function") return;
    if (!force && location.hash === lastHash) return;
    lastHash = location.hash;
    const heading = document.querySelector("#app h1, #app .study__title");
    const path = pathFor(location.hash);
    gc.count({ path, title: heading ? heading.textContent.trim() : path });
  }

  return { enabled, load, track, isSelfExcluded, setSelfExcluded, pathFor, CODE };
})();
