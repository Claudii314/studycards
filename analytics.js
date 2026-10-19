App.analytics = function() {
  const CODE = "";
  const SKIP_KEY = "skipgc";
  let loaded = false;
  let lastHash = null;
  function enabled() {
    return !!CODE && location.protocol.startsWith("http");
  }
  function isSelfExcluded() {
    try {
      return localStorage.getItem(SKIP_KEY) === "t";
    } catch (e) {
      return false;
    }
  }
  function setSelfExcluded(on) {
    try {
      if (on) localStorage.setItem(SKIP_KEY, "t"); else localStorage.removeItem(SKIP_KEY);
    } catch (e) {}
  }
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
    window.goatcounter = {
      no_onload: true
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + CODE + ".goatcounter.com/count");
    s.onload = () => track(true);
    document.head.appendChild(s);
  }
  function track(force) {
    if (!enabled() || isSelfExcluded()) return;
    const gc = window.goatcounter;
    if (!gc || typeof gc.count !== "function") return;
    if (!force && location.hash === lastHash) return;
    lastHash = location.hash;
    const heading = document.querySelector("#app h1, #app .study__title");
    const path = pathFor(location.hash);
    gc.count({
      path: path,
      title: heading ? heading.textContent.trim() : path
    });
  }
  return {
    enabled: enabled,
    load: load,
    track: track,
    isSelfExcluded: isSelfExcluded,
    setSelfExcluded: setSelfExcluded,
    pathFor: pathFor,
    CODE: CODE
  };
}();
