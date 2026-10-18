/* «Для автора»: режим автора, подключение к GitHub, публикация общего набора. */
App.views.author = async function (root) {
  const { h, mount, btn, crumbs, pageHead, confirm, dialog, toast, guard } = App.ui;
  const { countText, FORMS } = App.utils;
  const editor = App.editor;
  const rerender = () => App.router.render();

  const on = editor.isEnabled();
  const meta = editor.meta();
  const gh = editor.github();
  const shared = await App.repo.exportShared();
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" }) : "ещё не загружался";
  const summary = countText(shared.subjects.length, FORMS.subject) + ", " +
    countText(shared.groups.length, FORMS.group) + ", " + countText(shared.cards.length, FORMS.card);

  /* ---------- Режим автора ---------- */

  async function toggle() {
    if (on) {
      if (meta.dirty) {
        const ok = await confirm({
          title: "Выключить режим автора?",
          message: ["На этом устройстве есть неопубликованные изменения общего набора.",
            "Если выключить режим автора, они будут отменены и заменены версией с сайта."],
          confirmText: "Отменить изменения и выключить", danger: true,
        });
        if (!ok) return;
      }
      editor.setEnabled(false);
      if (meta.dirty) await guard(() => App.sync.pull({ force: true }));
      toast("Режим автора выключен");
    } else {
      editor.setEnabled(true);
      toast("Режим автора включён");
      if (editor.hasGithub()) await guard(() => App.sync.pull());
    }
    rerender();
  }

  /* ---------- GitHub ---------- */

  const f = {
    owner: h("input", { class: "input", name: "owner", autocomplete: "off", placeholder: "ваш логин на GitHub" }),
    repo: h("input", { class: "input", name: "repo", autocomplete: "off", placeholder: "studycards" }),
    branch: h("input", { class: "input", name: "branch", autocomplete: "off", placeholder: "main" }),
    token: h("input", { class: "input", name: "token", type: "password", autocomplete: "off", placeholder: "github_pat_…" }),
  };
  f.owner.value = gh.owner; f.repo.value = gh.repo; f.branch.value = gh.branch || "main"; f.token.value = gh.token;
  const ghStatus = h("div", { class: "field__hint", role: "status" });

  function readForm() {
    return {
      owner: f.owner.value.trim(), repo: f.repo.value.trim(),
      branch: f.branch.value.trim() || "main", path: "shared.json", token: f.token.value.trim(),
    };
  }

  async function saveGithub() {
    const cfg = readForm();
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      ghStatus.textContent = "Заполните владельца, репозиторий и токен.";
      ghStatus.className = "field__error";
      return;
    }
    ghStatus.className = "field__hint";
    ghStatus.textContent = "Проверяю доступ…";
    try {
      const canWrite = await App.github.checkAccess(cfg);
      if (!canWrite) {
        ghStatus.className = "field__error";
        ghStatus.textContent = "Репозиторий найден, но у токена нет права записи. Нужно разрешение Contents: Read and write.";
        return;
      }
      editor.setGithub(cfg);
      toast("Подключение сохранено");
      rerender();
    } catch (e) {
      ghStatus.className = "field__error";
      ghStatus.textContent = e.message;
    }
  }

  async function forgetToken() {
    const ok = await confirm({ title: "Удалить токен с этого устройства?",
      message: "Чтобы снова публиковать с этого устройства, токен нужно будет ввести заново.", confirmText: "Удалить токен", danger: true });
    if (!ok) return;
    editor.setGithub(Object.assign(editor.github(), { token: "" }));
    toast("Токен удалён");
    rerender();
  }

  /* ---------- Публикация ---------- */

  async function publish(overwrite) {
    try {
      const payload = await App.sync.publish({ overwrite });
      toast("Опубликовано. На сайте обновится в течение пары минут.");
      rerender();
      return payload;
    } catch (e) {
      if (e instanceof App.sync.ConflictError) {
        const choice = await dialog({
          title: "На сайте другая версия",
          body: [
            h("p", null, "Пока вы редактировали, с другого устройства опубликовали версию от " + fmt(e.remotePublishedAt) + "."),
            h("p", null, "Можно загрузить её (ваши правки на этом устройстве пропадут) или перезаписать сайт своей версией (пропадут правки с другого устройства)."),
          ],
          actions: (close) => [
            h("button", { type: "button", class: "btn btn--ghost", onclick: () => close(null) }, "Отмена"),
            h("button", { type: "button", class: "btn", onclick: () => close("pull") }, "Загрузить с сайта"),
            h("button", { type: "button", class: "btn btn--danger-solid", onclick: () => close("overwrite") }, "Перезаписать сайт"),
          ],
        });
        if (choice === "overwrite") return publish(true);
        if (choice === "pull") return pullFromSite(true);
        return;
      }
      toast(e.message || "Не удалось опубликовать.", "error");
    }
  }

  async function pullFromSite(skipConfirm) {
    if (editor.meta().dirty && skipConfirm !== true) {
      const ok = await confirm({ title: "Загрузить версию с сайта?",
        message: "Неопубликованные изменения на этом устройстве будут отменены.", confirmText: "Загрузить", danger: true });
      if (!ok) return;
    }
    await guard(async () => {
      const r = await App.sync.pull({ force: true });
      if (r.status === "updated") toast("Загружена версия от " + fmt(r.publishedAt));
      else if (r.status === "empty") toast("В репозитории ещё нет файла общего набора. Опубликуйте его.");
      else if (r.status === "offline") toast("Не удалось связаться с сайтом.", "error");
      else if (r.status === "invalid") toast("Файл на сайте повреждён: " + r.errors[0], "error");
      rerender();
    });
  }

  /* ---------- Разметка ---------- */

  const field = (label, control, hint) => h("label", { class: "field" },
    h("span", { class: "field__label" }, label), control, hint ? h("span", { class: "field__hint" }, hint) : null);

  mount(root,
    crumbs([{ label: "Предметы", href: "#/" }, { label: "Для автора" }]),
    pageHead("Для автора", "Здесь автор редактирует и публикует общие материалы, которые видят все пользователи сайта."),

    h("div", { class: "panel" },
      h("div", { class: "panel__title" }, "Режим автора " + (on ? "включён" : "выключен")),
      h("p", { class: "panel__text" }, on
        ? "Общие предметы, группы и карточки можно менять. Изменения видны только на этом устройстве, пока вы их не опубликуете."
        : "Включите, чтобы редактировать общие материалы. Без подключения к GitHub правки останутся только на этом устройстве."),
      btn(on ? "Выключить режим автора" : "Включить режим автора", toggle, on ? "" : "btn--primary")),

    on ? h("div", { class: "panel" },
      h("div", { class: "panel__title" }, "Общий набор"),
      h("p", { class: "panel__text" },
        "На устройстве: " + summary + ". Версия с сайта: " + fmt(meta.publishedAt) + ". ",
        meta.dirty ? h("strong", null, "Есть неопубликованные изменения.") : "Неопубликованных изменений нет."),
      h("div", { class: "page-head__actions" },
        btn("Опубликовать изменения", () => publish(false), "btn--primary", { disabled: !meta.dirty || !editor.hasGithub() }),
        btn("Загрузить с сайта", pullFromSite)),
      !editor.hasGithub() ? h("p", { class: "field__hint", style: "margin-top:10px" }, "Чтобы публиковать, подключите GitHub ниже.") : null) : null,

    on ? h("div", { class: "panel" },
      h("div", { class: "panel__title" }, "Подключение к GitHub"),
      h("p", { class: "panel__text" }, editor.hasGithub()
        ? "Подключено: " + gh.owner + "/" + gh.repo + " (ветка " + gh.branch + "). Токен хранится только на этом устройстве."
        : "Укажите репозиторий сайта и токен с правом записи. Как получить токен — в README.md, раздел «Публикация сайта»."),
      field("Владелец (логин GitHub)", f.owner),
      field("Репозиторий", f.repo),
      field("Ветка", f.branch, "Обычно main."),
      field("Токен доступа", f.token, "Не передавайте токен другим людям. На чужом компьютере удалите его после работы."),
      ghStatus,
      h("div", { class: "page-head__actions", style: "margin-top:10px" },
        btn("Сохранить и проверить", saveGithub, "btn--primary"),
        editor.hasGithub() ? btn("Удалить токен с устройства", forgetToken, "btn--danger") : null)) : null);
};
