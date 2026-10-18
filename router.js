/* Простой hash-роутер: #/, #/subject/:id, #/group/:id, #/group/:id/flashcards, #/group/:id/quiz, #/backup */
App.router = (function () {
  const routes = [
    { re: /^#?\/?$/, view: "subjects", nav: "subjects" },
    { re: /^#\/subject\/([^/]+)$/, view: "subject", nav: "subjects" },
    { re: /^#\/group\/([^/]+)$/, view: "group", nav: "subjects" },
    { re: /^#\/group\/([^/]+)\/flashcards$/, view: "flashcards", nav: "subjects" },
    { re: /^#\/group\/([^/]+)\/quiz$/, view: "quiz", nav: "subjects" },
    { re: /^#\/backup$/, view: "backup", nav: "backup" },
    { re: /^#\/author$/, view: "author", nav: "backup" },
  ];
  let renderId = 0;

  function match(hash) {
    for (const r of routes) {
      const m = hash.match(r.re);
      if (m) return { route: r, params: { id: m[1] ? decodeURIComponent(m[1]) : undefined } };
    }
    return null;
  }

  function setActiveNav(nav) {
    document.querySelectorAll(".topbar__link").forEach((a) => {
      const target = a.getAttribute("href") === "#/backup" ? "backup" : "subjects";
      a.classList.toggle("is-active", nav === target);
    });
  }

  /**
   * Каждая страница рисуется в собственный контейнер. Он попадает на экран после загрузки данных,
   * поэтому при быстрой навигации устаревшая страница не перекроет новую.
   * Режимы обучения потом перерисовывают этот же контейнер.
   */
  async function render() {
    const root = document.getElementById("app");
    const id = ++renderId;
    const found = match(location.hash || "#/");
    setActiveNav(found ? found.route.nav : null);
    const container = document.createElement("div");
    try {
      if (!found) App.views.notFound(container);
      else await App.views[found.route.view](container, found.params);
    } catch (e) {
      console.error(e);
      App.ui.mount(container, App.ui.empty("Не удалось загрузить данные",
        e && e.message ? e.message : String(e),
        App.ui.btn("Попробовать снова", render, "btn--primary")));
    }
    if (id !== renderId) return;
    root.replaceChildren(container);
    if (App.onRendered) App.onRendered();
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function init() {
    window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
    return render();
  }

  return { render, go, init };
})();
