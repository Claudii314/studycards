/* Предмет: список групп с количеством карточек. */
App.views.subject = async function (root, params) {
  const { h, mount, btn, crumbs, pageHead, empty, nameForm, confirm, toast, guard } = App.ui;
  const { countText, FORMS } = App.utils;
  const repo = App.repo;

  const subject = await repo.getSubject(params.id);
  if (!subject) return App.views.notFound(root, "Предмет не найден. Возможно, он был удалён.");
  const groups = await repo.listGroups(subject.id);
  const rerender = () => App.router.render();
  const editable = App.editor.canModify(subject);

  async function addGroup() {
    const created = await nameForm({
      title: "Новая группа", label: "Название группы", placeholder: "Например, Skratky",
      submitText: "Создать", save: (v) => repo.createGroup(subject.id, v),
    });
    if (created) { toast("Группа создана"); rerender(); }
  }

  async function renameSubject() {
    const saved = await nameForm({
      title: "Переименовать предмет", label: "Название предмета", value: subject.name,
      save: (v) => repo.renameSubject(subject.id, v),
    });
    if (saved) { toast("Предмет переименован"); rerender(); }
  }

  async function rename(group) {
    const saved = await nameForm({
      title: "Переименовать группу", label: "Название группы", value: group.name,
      save: (v) => repo.renameGroup(group.id, v),
    });
    if (saved) { toast("Группа переименована"); rerender(); }
  }

  async function remove(group) {
    const ok = await confirm({
      title: "Удалить группу?",
      message: [
        "«" + group.name + "» будет удалена вместе с " + countText(group.cardCount, ["карточкой", "карточками", "карточками"]) + ".",
        group.shared ? "У однокурсников она исчезнет после публикации изменений." : "Это действие нельзя отменить.",
      ],
      confirmText: "Удалить", danger: true,
    });
    if (!ok) return;
    await guard(async () => { await repo.deleteGroup(group.id); toast("Группа удалена"); rerender(); });
  }

  const total = groups.reduce((s, g) => s + g.cardCount, 0);
  const nodes = [
    crumbs([{ label: "Предметы", href: "#/" }, { label: subject.name }]),
    pageHead(subject.name,
      countText(groups.length, FORMS.group) + ", " + countText(total, FORMS.card),
      editable ? [btn("Добавить группу", addGroup, "btn--primary"), btn("Переименовать", renameSubject)] : null),
  ];
  const quizTotal = groups.reduce((s, g) => s + g.quizCount, 0);
  if (groups.length > 1 && total > 0) {
    const sid = encodeURIComponent(subject.id);
    nodes.push(h("div", { class: "modes modes--spaced" },
      h("div", { class: "mode" },
        h("div", { class: "mode__title" }, "Учить весь предмет"),
        h("div", { class: "mode__text" }, "Флеш-карточки из всех групп сразу: " + countText(total, FORMS.card) + "."),
        btn("Учить все карточки", () => App.router.go("#/subject/" + sid + "/flashcards"), "btn--primary")),
      h("div", { class: "mode" },
        h("div", { class: "mode__title" }, "Тест по всему предмету"),
        h("div", { class: "mode__text" }, quizTotal
          ? "Вопросы из всех групп вперемешку: " + countText(quizTotal, FORMS.question) + "."
          : "Нужна хотя бы одна карточка с тремя неправильными вариантами."),
        btn("Пройти тест", () => App.router.go("#/subject/" + sid + "/quiz"), "btn--primary", { disabled: !quizTotal }))));
  }
  if (subject.shared && !editable) {
    nodes.push(h("p", { class: "notice notice--spaced" }, "Это общий предмет с сайта. Его группы и карточки обновляются автоматически, когда автор публикует изменения."));
  }

  if (!groups.length) {
    nodes.push(empty("В этом предмете нет групп",
      editable ? "Группы помогают разделить материал по темам, например «Mapy», «Skratky», «Výpočty»." : "Автор ещё не добавил группы.",
      editable ? btn("Добавить группу", addGroup, "btn--primary") : null));
  } else {
    nodes.push(h("div", { class: "list" }, groups.map((g) =>
      h("div", { class: "row" },
        h("a", { class: "row__main", href: "#/group/" + encodeURIComponent(g.id) },
          h("div", { class: "row__title" }, g.name),
          h("div", { class: "row__meta" },
            countText(g.cardCount, FORMS.card) + (g.quizCount ? ", для теста: " + g.quizCount : ""))),
        h("span", { class: "count", title: "Карточек в группе" }, String(g.cardCount)),
        editable ? h("div", { class: "row__actions" },
          btn("Переименовать", () => rename(g), "btn--sm btn--ghost"),
          btn("Удалить", () => remove(g), "btn--sm btn--ghost btn--danger")) : null))));
  }

  mount(root, nodes);
};
