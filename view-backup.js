/* Резервная копия: экспорт в JSON и импорт с проверкой. */
App.views.backup = async function (root) {
  const { h, mount, btn, crumbs, pageHead, confirm, toast, guard } = App.ui;
  const { countText, FORMS } = App.utils;

  const current = await App.repo.exportPersonal();
  const summary = (d) => countText(d.subjects.length, FORMS.subject) + ", " +
    countText(d.groups.length, FORMS.group) + ", " + countText(d.cards.length, FORMS.card);

  async function doExport() {
    await guard(async () => {
      const payload = await App.backup.download();
      toast("Файл сохранён: " + summary(payload));
    });
  }

  const fileInput = h("input", { type: "file", accept: ".json,application/json", class: "hidden" });
  const importStatus = h("div");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    importStatus.replaceChildren();

    const result = await App.backup.parseFile(file);
    if (!result.ok) {
      importStatus.appendChild(h("div", { class: "notice notice--bad", role: "alert" },
        h("strong", null, "Файл не загружен: найдены ошибки в структуре."),
        h("ul", { class: "errors" }, result.errors.slice(0, 10).map((e) => h("li", null, e))),
        result.errors.length > 10 ? h("div", null, "…и ещё " + (result.errors.length - 10)) : null,
        h("div", null, "Текущие данные не изменены.")));
      return;
    }

    const ok = await confirm({
      title: "Заменить все данные?",
      message: [
        "В файле «" + file.name + "»: " + summary(result.data) + ".",
        "Сейчас ваших личных данных: " + summary(current) + ". Они будут удалены и заменены содержимым файла. Общие материалы с сайта не затрагиваются.",
        "Совет: сначала сделайте экспорт текущих данных.",
      ],
      confirmText: "Заменить данные", danger: true,
    });
    if (!ok) return;

    await guard(async () => {
      await App.repo.replacePersonal(result.data);
      toast("Данные загружены: " + summary(result.data));
      App.router.go("#/");
    });
  });

  mount(root,
    crumbs([{ label: "Предметы", href: "#/" }, { label: "Резервная копия" }]),
    pageHead("Резервная копия", "Ваши личные предметы хранятся только в этом браузере. Регулярно сохраняйте копию в файл. Общие материалы с сайта сюда не входят: они загружаются автоматически."),
    h("div", { class: "panel" },
      h("div", { class: "panel__title" }, "Экспорт"),
      h("p", { class: "panel__text" }, "Сохранить личные предметы, группы и карточки в JSON-файл. Сейчас: " + summary(current) + "."),
      btn("Скачать резервную копию", doExport, "btn--primary")),
    h("div", { class: "panel" },
      h("div", { class: "panel__title" }, "Импорт"),
      h("p", { class: "panel__text" }, "Загрузить данные из файла резервной копии. Перед заменой файл проверяется, и вы увидите, что будет загружено."),
      btn("Выбрать файл…", () => fileInput.click()),
      fileInput,
      h("div", { style: "margin-top:14px" }, importStatus)),
    h("p", { class: "muted small-link" }, "Вы автор общих материалов? ", h("a", { href: "#/author" }, "Для автора")));
};

App.views.notFound = function (root, message) {
  const { h, mount, empty } = App.ui;
  mount(root, empty("Страница не найдена", message || "Такой страницы нет.",
    h("a", { class: "btn btn--primary", href: "#/" }, "К предметам")));
};
