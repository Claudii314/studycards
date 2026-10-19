App.views.author = async function(root) {
  const {h: h, mount: mount, btn: btn, crumbs: crumbs, pageHead: pageHead, confirm: confirm, dialog: dialog, toast: toast, guard: guard} = App.ui;
  const {countText: countText, FORMS: FORMS} = App.utils;
  const editor = App.editor;
  const rerender = () => App.router.render();
  const on = editor.isEnabled();
  const meta = editor.meta();
  const gh = editor.github();
  const shared = await App.repo.exportShared();
  const fmt = iso => iso ? new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "long",
    timeStyle: "short"
  }) : "ещё не загружался";
  const summary = countText(shared.subjects.length, FORMS.subject) + ", " + countText(shared.groups.length, FORMS.group) + ", " + countText(shared.cards.length, FORMS.card);
  async function logout() {
    if (meta.dirty) {
      const ok = await confirm({
        title: "Выйти из режима автора?",
        message: [ "На этом устройстве есть неопубликованные изменения общего набора.", "После выхода они будут отменены и заменены версией с сайта." ],
        confirmText: "Отменить изменения и выйти",
        danger: true
      });
      if (!ok) return;
    }
    editor.setEnabled(false);
    if (meta.dirty) await guard(() => App.sync.pull({
      force: true
    }));
    toast("Вы вышли из режима автора");
    rerender();
  }
  const f = {
    owner: h("input", {
      class: "input",
      name: "owner",
      autocomplete: "off",
      placeholder: "ваш логин на GitHub"
    }),
    repo: h("input", {
      class: "input",
      name: "repo",
      autocomplete: "off",
      placeholder: "studycards"
    }),
    branch: h("input", {
      class: "input",
      name: "branch",
      autocomplete: "off",
      placeholder: "main"
    }),
    token: h("input", {
      class: "input",
      name: "token",
      type: "password",
      autocomplete: "off",
      placeholder: "github_pat_…"
    })
  };
  f.owner.value = gh.owner;
  f.repo.value = gh.repo;
  f.branch.value = gh.branch || "main";
  f.token.value = gh.token;
  const ghStatus = h("div", {
    class: "field__hint",
    role: "status"
  });
  function readForm() {
    return {
      owner: f.owner.value.trim(),
      repo: f.repo.value.trim(),
      branch: f.branch.value.trim() || "main",
      path: "shared.json",
      token: f.token.value.trim()
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
    ghStatus.textContent = "Проверяю токен…";
    try {
      const canWrite = await App.github.checkAccess(cfg);
      if (!canWrite) {
        ghStatus.className = "field__error";
        ghStatus.textContent = "Репозиторий найден, но у токена нет права записи. Нужно разрешение Contents: Read and write.";
        return;
      }
      editor.setGithub(cfg);
      const wasOn = editor.isEnabled();
      editor.setEnabled(true);
      toast(wasOn ? "Подключение сохранено" : "Режим автора включён");
      if (!wasOn) await guard(() => App.sync.pull());
      rerender();
    } catch (e) {
      ghStatus.className = "field__error";
      ghStatus.textContent = e.message;
    }
  }
  async function forgetToken() {
    const ok = await confirm({
      title: "Удалить токен с этого устройства?",
      message: [ "Режим автора на этом устройстве выключится. Чтобы снова войти, токен нужно будет ввести заново.", meta.dirty ? "Неопубликованные изменения будут отменены." : "" ].filter(Boolean),
      confirmText: "Удалить токен",
      danger: true
    });
    if (!ok) return;
    editor.setGithub(Object.assign(editor.github(), {
      token: ""
    }));
    editor.setEnabled(false);
    if (meta.dirty) await guard(() => App.sync.pull({
      force: true
    }));
    toast("Токен удалён");
    rerender();
  }
  async function publish(overwrite) {
    try {
      const payload = await App.sync.publish({
        overwrite: overwrite
      });
      toast("Опубликовано. На сайте обновится в течение пары минут.");
      rerender();
      return payload;
    } catch (e) {
      if (e instanceof App.sync.ConflictError) {
        const choice = await dialog({
          title: "На сайте другая версия",
          body: [ h("p", null, "Пока вы редактировали, с другого устройства опубликовали версию от " + fmt(e.remotePublishedAt) + "."), h("p", null, "Можно загрузить её (ваши правки на этом устройстве пропадут) или перезаписать сайт своей версией (пропадут правки с другого устройства).") ],
          actions: close => [ h("button", {
            type: "button",
            class: "btn btn--ghost",
            onclick: () => close(null)
          }, "Отмена"), h("button", {
            type: "button",
            class: "btn",
            onclick: () => close("pull")
          }, "Загрузить с сайта"), h("button", {
            type: "button",
            class: "btn btn--danger-solid",
            onclick: () => close("overwrite")
          }, "Перезаписать сайт") ]
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
      const ok = await confirm({
        title: "Загрузить версию с сайта?",
        message: "Неопубликованные изменения на этом устройстве будут отменены.",
        confirmText: "Загрузить",
        danger: true
      });
      if (!ok) return;
    }
    await guard(async () => {
      const r = await App.sync.pull({
        force: true
      });
      if (r.status === "updated") toast("Загружена версия от " + fmt(r.publishedAt)); else if (r.status === "empty") toast("В репозитории ещё нет файла общего набора. Опубликуйте его."); else if (r.status === "offline") toast("Не удалось связаться с сайтом.", "error"); else if (r.status === "invalid") toast("Файл на сайте повреждён: " + r.errors[0], "error");
      rerender();
    });
  }
  const field = (label, control, hint) => h("label", {
    class: "field"
  }, h("span", {
    class: "field__label"
  }, label), control, hint ? h("span", {
    class: "field__hint"
  }, hint) : null);
  const statsPanel = on ? h("div", {
    class: "panel"
  }, h("div", {
    class: "panel__title"
  }, "Статистика посещений"), App.analytics.enabled() ? [ h("p", {
    class: "panel__text"
  }, "Статистика смотрится в вашем кабинете GoatCounter: https://" + App.analytics.CODE + ".goatcounter.com. " + (App.analytics.isSelfExcluded() ? "Посещения с этого устройства не учитываются." : "Посещения с этого устройства сейчас учитываются.")), btn(App.analytics.isSelfExcluded() ? "Снова учитывать это устройство" : "Не учитывать мои посещения с этого устройства", () => {
    App.analytics.setSelfExcluded(!App.analytics.isSelfExcluded());
    toast("Сохранено");
    rerender();
  }) ] : h("p", {
    class: "panel__text"
  }, "Выключена. Как включить — в README.md, раздел «Статистика посещений».")) : null;
  const githubForm = [ field("Владелец (логин GitHub)", f.owner), field("Репозиторий", f.repo), field("Ветка", f.branch, "Обычно main."), field("Токен доступа", f.token, "Не передавайте токен другим людям. На чужом компьютере удалите его после работы."), ghStatus ];
  if (!on) {
    mount(root, crumbs([ {
      label: "Предметы",
      href: "#/"
    }, {
      label: "Для автора"
    } ]), pageHead("Для автора", "Вход для автора общих материалов."), h("div", {
      class: "panel"
    }, h("div", {
      class: "panel__title"
    }, "Вход автора"), h("p", {
      class: "panel__text"
    }, "Режим автора включается только с токеном GitHub, у которого есть право записи в репозиторий сайта. Без него редактировать общие материалы нельзя."), githubForm, h("div", {
      class: "page-head__actions",
      style: "margin-top:10px"
    }, btn("Войти как автор", saveGithub, "btn--primary"))));
    return;
  }
  mount(root, crumbs([ {
    label: "Предметы",
    href: "#/"
  }, {
    label: "Для автора"
  } ]), pageHead("Для автора", "Здесь автор редактирует и публикует общие материалы, которые видят все пользователи сайта."), h("div", {
    class: "panel"
  }, h("div", {
    class: "panel__title"
  }, "Режим автора включён"), h("p", {
    class: "panel__text"
  }, "Общие предметы, группы и карточки можно менять. Изменения видны только на этом устройстве, пока вы их не опубликуете."), btn("Выйти из режима автора", logout)), h("div", {
    class: "panel"
  }, h("div", {
    class: "panel__title"
  }, "Общий набор"), h("p", {
    class: "panel__text"
  }, "На устройстве: " + summary + ". Версия с сайта: " + fmt(meta.publishedAt) + ". ", meta.dirty ? h("strong", null, "Есть неопубликованные изменения.") : "Неопубликованных изменений нет."), h("div", {
    class: "page-head__actions"
  }, btn("Опубликовать изменения", () => publish(false), "btn--primary", {
    disabled: !meta.dirty
  }), btn("Загрузить с сайта", pullFromSite))), h("div", {
    class: "panel"
  }, h("div", {
    class: "panel__title"
  }, "Подключение к GitHub"), h("p", {
    class: "panel__text"
  }, "Подключено: " + gh.owner + "/" + gh.repo + " (ветка " + gh.branch + "). Токен хранится только на этом устройстве."), githubForm, h("div", {
    class: "page-head__actions",
    style: "margin-top:10px"
  }, btn("Сохранить и проверить", saveGithub, "btn--primary"), btn("Удалить токен с устройства", forgetToken, "btn--danger"))), statsPanel);
};
