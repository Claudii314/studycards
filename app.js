/* Точка входа: база данных, отрисовка, загрузка общего набора с сайта, офлайн-режим. */
(async function () {
  try {
    await App.db.open();
  } catch (e) {
    App.ui.mount(document.getElementById("app"), App.ui.empty("Хранилище недоступно",
      (e && e.message ? e.message + " " : "") +
      "Откройте приложение в обычном (не приватном) окне Chrome, Edge, Safari или Firefox."));
    return;
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  /* Полоса «Режим автора» под шапкой */
  const bar = document.getElementById("editor-bar");
  function updateBar() {
    const { h, mount } = App.ui;
    if (!App.editor.isEnabled()) { bar.classList.add("hidden"); bar.replaceChildren(); return; }
    const dirty = App.editor.meta().dirty;
    bar.classList.remove("hidden");
    mount(bar, h("div", { class: "editor-bar__inner" },
      h("span", null, dirty ? "Режим автора: есть неопубликованные изменения общего набора." : "Режим автора: можно редактировать общие материалы."),
      location.hash === "#/author" ? null : h("a", { href: "#/author" }, dirty ? "Опубликовать" : "Для автора")));
  }
  App.editor.onChange(updateBar);
  App.onRendered = () => { updateBar(); App.analytics.track(); };
  App.analytics.load();

  await App.router.init();

  /* Общий набор: после первой отрисовки, чтобы приложение открывалось сразу и без интернета */
  try {
    const r = await App.sync.pull();
    if (r.status === "updated") {
      // Не прерываем начатое обучение: в режимах карточек и теста изменения появятся при следующем запуске
      if (!/\/(flashcards|quiz)$/.test(location.hash)) App.router.render();
      App.ui.toast("Общие карточки обновлены");
    } else if (r.status === "invalid") {
      console.warn("Общий набор на сайте повреждён", r.errors);
    }
  } catch (e) {
    console.warn("Не удалось загрузить общий набор:", e);
  }

  /* Офлайн-режим и установка как приложения (работает только на сайте, не при открытии файла) */
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e));
  }
})();
