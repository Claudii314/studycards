(async function() {
  try {
    await App.db.open();
  } catch (e) {
    App.ui.mount(document.getElementById("app"), App.ui.empty("Хранилище недоступно", (e && e.message ? e.message + " " : "") + "Откройте приложение в обычном (не приватном) окне Chrome, Edge, Safari или Firefox."));
    return;
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  const bar = document.getElementById("editor-bar");
  function updateBar() {
    const {h: h, mount: mount} = App.ui;
    if (!App.editor.isEnabled()) {
      bar.classList.add("hidden");
      bar.replaceChildren();
      return;
    }
    const dirty = App.editor.meta().dirty;
    bar.classList.remove("hidden");
    mount(bar, h("div", {
      class: "editor-bar__inner"
    }, h("span", null, dirty ? "Режим автора: есть неопубликованные изменения общего набора." : "Режим автора: можно редактировать общие материалы."), location.hash === "#/author" ? null : h("a", {
      href: "#/author"
    }, dirty ? "Опубликовать" : "Для автора")));
  }
  App.editor.onChange(updateBar);
  App.onRendered = () => {
    updateBar();
    App.analytics.track();
  };
  App.analytics.load();
  await App.router.init();
  try {
    const r = await App.sync.pull();
    if (r.status === "updated") {
      const busy = /\/(flashcards|quiz|exam)$/.test(location.hash) || location.hash === "#/author" || location.hash === "#/backup" || document.querySelector("dialog[open]");
      if (!busy) App.router.render();
      App.ui.toast("Общие карточки обновлены");
    } else if (r.status === "invalid") {
      console.warn("Общий набор на сайте повреждён", r.errors);
    }
  } catch (e) {
    console.warn("Не удалось загрузить общий набор:", e);
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(e => console.warn("Service worker:", e));
  }
})();
