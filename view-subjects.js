App.views = App.views || {};

App.views.subjects = async function(root) {
  const {h: h, mount: mount, btn: btn, pageHead: pageHead, empty: empty, nameForm: nameForm, confirm: confirm, toast: toast, guard: guard} = App.ui;
  const {countText: countText, FORMS: FORMS} = App.utils;
  const repo = App.repo;
  const subjects = await repo.listSubjects();
  const rerender = () => App.router.render();
  const editorOn = App.editor.isEnabled();
  async function addSubject(shared) {
    const created = await nameForm({
      title: shared ? "Новый общий предмет" : "Новый предмет",
      label: "Название предмета",
      placeholder: "Например, Letecká navigácia",
      submitText: "Создать",
      save: v => repo.createSubject(v, {
        shared: shared === true
      })
    });
    if (created) {
      toast("Предмет создан");
      rerender();
    }
  }
  async function rename(subject) {
    const saved = await nameForm({
      title: "Переименовать предмет",
      label: "Название предмета",
      value: subject.name,
      save: v => repo.renameSubject(subject.id, v)
    });
    if (saved) {
      toast("Предмет переименован");
      rerender();
    }
  }
  async function remove(subject) {
    const ok = await confirm({
      title: "Удалить предмет?",
      message: [ (subject.shared ? "Общий предмет «" : "«") + subject.name + "» будет удалён вместе с " + countText(subject.groupCount, [ "группой", "группами", "группами" ]) + " и " + countText(subject.cardCount, [ "карточкой", "карточками", "карточками" ]) + ".", subject.shared ? "У однокурсников он исчезнет после публикации изменений." : "Это действие нельзя отменить." ],
      confirmText: "Удалить",
      danger: true
    });
    if (!ok) return;
    await guard(async () => {
      await repo.deleteSubject(subject.id);
      toast("Предмет удалён");
      rerender();
    });
  }
  const headActions = [];
  if (subjects.length) headActions.push(btn("Добавить предмет", () => addSubject(false), "btn--primary"));
  if (editorOn) headActions.push(btn("Добавить общий предмет", () => addSubject(true)));
  const head = pageHead("Предметы", subjects.length ? countText(subjects.length, FORMS.subject) : null, headActions);
  if (!subjects.length) {
    mount(root, head, empty("Здесь пока пусто", "Создайте первый предмет, затем добавьте в него группы и карточки.", btn("Добавить предмет", () => addSubject(false), "btn--primary")));
    return;
  }
  const list = h("div", {
    class: "list"
  }, subjects.map(s => h("div", {
    class: "row"
  }, h("a", {
    class: "row__main",
    href: "#/subject/" + encodeURIComponent(s.id)
  }, h("div", {
    class: "row__title"
  }, s.name, s.shared ? h("span", {
    class: "tag",
    title: "Общий материал с сайта"
  }, "Общий") : null), h("div", {
    class: "row__meta"
  }, countText(s.groupCount, FORMS.group) + ", " + countText(s.cardCount, FORMS.card))), App.editor.canModify(s) ? h("div", {
    class: "row__actions"
  }, btn("Переименовать", () => rename(s), "btn--sm btn--ghost"), btn("Удалить", () => remove(s), "btn--sm btn--ghost btn--danger")) : null)));
  mount(root, head, list);
};
