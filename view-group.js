/* Группа: режимы обучения, список карточек, добавление / редактирование / удаление. */
App.views.group = async function (root, params) {
  const { h, mount, btn, crumbs, pageHead, empty, nameForm, confirm, toast, guard } = App.ui;
  const { countText, FORMS } = App.utils;
  const repo = App.repo;

  const group = await repo.getGroup(params.id);
  if (!group) return App.views.notFound(root, "Группа не найдена. Возможно, она была удалена.");
  const subject = await repo.getSubject(group.subjectId);
  const cards = await repo.listCards(group.id);
  const quizCount = cards.filter(repo.isQuizCard).length;
  const rerender = () => App.router.render();
  const gid = encodeURIComponent(group.id);
  const editable = App.editor.canModify(group);

  async function renameGroup() {
    const saved = await nameForm({
      title: "Переименовать группу", label: "Название группы", value: group.name,
      save: (v) => repo.renameGroup(group.id, v),
    });
    if (saved) { toast("Группа переименована"); rerender(); }
  }

  async function addCard() {
    const saved = await App.views.cardForm({ title: "Новая карточка", submitText: "Добавить",
      save: (data) => repo.createCard(group.id, data) });
    if (saved) { toast("Карточка добавлена"); rerender(); }
  }

  async function editCard(card) {
    const saved = await App.views.cardForm({ title: "Редактировать карточку", card,
      save: (data) => repo.updateCard(card.id, data) });
    if (saved) { toast("Карточка сохранена"); rerender(); }
  }

  async function removeCard(card) {
    const ok = await confirm({
      title: "Удалить карточку?",
      message: ["«" + truncate(card.question, 120) + "»", "Это действие нельзя отменить."],
      confirmText: "Удалить", danger: true,
    });
    if (!ok) return;
    await guard(async () => { await repo.deleteCard(card.id); toast("Карточка удалена"); rerender(); });
  }

  const modes = h("div", { class: "modes" },
    h("div", { class: "mode" },
      h("div", { class: "mode__title" }, "Флеш-карточки"),
      h("div", { class: "mode__text" }, cards.length
        ? "Вопрос → ответ, отметка «Знал» или «Не знал». " + countText(cards.length, FORMS.card) + "."
        : "Добавьте хотя бы одну карточку."),
      btn("Учить карточки", () => App.router.go("#/group/" + gid + "/flashcards"), "btn--primary", { disabled: !cards.length })),
    h("div", { class: "mode" },
      h("div", { class: "mode__title" }, "Тест"),
      h("div", { class: "mode__text" }, quizCount
        ? "Четыре варианта ответа. Подходит " + countText(quizCount, FORMS.card) + " из " + cards.length + "."
        : "Нужна хотя бы одна карточка с тремя неправильными вариантами."),
      btn("Пройти тест", () => App.router.go("#/group/" + gid + "/quiz"), "btn--primary", { disabled: !quizCount })));

  const nodes = [
    crumbs([
      { label: "Предметы", href: "#/" },
      { label: subject ? subject.name : "Предмет", href: subject ? "#/subject/" + encodeURIComponent(subject.id) : "#/" },
      { label: group.name },
    ]),
    pageHead(group.name, countText(cards.length, FORMS.card),
      editable ? [btn("Добавить карточку", addCard, "btn--primary"), btn("Переименовать", renameGroup)] : null),
    group.shared && !editable
      ? h("p", { class: "notice notice--spaced" }, "Общая группа с сайта: карточки обновляются автоматически, когда автор публикует изменения.")
      : null,
    modes,
    h("div", { class: "section" }, h("h2", { class: "section__title" }, "Карточки")),
  ];

  if (!cards.length) {
    nodes.push(empty("Карточек пока нет",
      editable ? "Введите вопрос и ответ. Чтобы карточка участвовала в тесте, добавьте три неправильных варианта." : "Автор ещё не добавил карточки.",
      editable ? btn("Добавить карточку", addCard, "btn--primary") : null));
  } else {
    nodes.push(h("div", { class: "cards" }, cards.map((c) =>
      h("div", { class: "card-item" },
        h("div", { class: "card-item__q" }, c.question),
        h("div", { class: "card-item__a" }, c.answer),
        repo.isQuizCard(c) ? h("span", { class: "badge" }, "Есть варианты для теста") : null,
        editable ? h("div", { class: "card-item__actions" },
          btn("Изменить", () => editCard(c), "btn--sm btn--ghost"),
          btn("Удалить", () => removeCard(c), "btn--sm btn--ghost btn--danger")) : null))));
  }

  mount(root, nodes);
};

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Форма карточки в диалоге. save(data) сохраняет; ошибки валидации показываются у полей.
 * Возвращает сохранённую карточку или undefined при отмене.
 */
App.views.cardForm = function ({ title, card, submitText, save }) {
  const { h, dialog } = App.ui;
  const max = String(App.repo.LIMITS.text);
  const wrong = (card && card.wrongAnswers && card.wrongAnswers.length === 3) ? card.wrongAnswers : ["", "", ""];

  function field(name, label, value, opts) {
    const control = opts.multiline
      ? h("textarea", { class: "textarea", name, maxlength: max, rows: opts.rows || 3 })
      : h("input", { class: "input", type: "text", name, maxlength: max, autocomplete: "off" });
    control.value = value || "";
    const err = h("div", { class: "field__error", "data-error-for": name });
    return {
      control, err,
      node: h("label", { class: "field" },
        h("span", { class: "field__label" }, label), control, err),
    };
  }

  const q = field("question", "Вопрос *", card && card.question, { multiline: true, rows: 3 });
  const a = field("answer", "Правильный ответ *", card && card.answer, { multiline: true, rows: 2 });
  const w = [0, 1, 2].map((i) => field("wrong" + i, "Неправильный вариант " + (i + 1), wrong[i], {}));
  const all = [q, a].concat(w);
  const formError = h("div", { class: "field__error", role: "alert" });

  const body = [
    q.node, a.node,
    h("fieldset", { class: "fieldset" },
      h("legend", { class: "fieldset__legend" }, "Варианты для теста"),
      h("p", { class: "fieldset__hint" }, "Необязательно. Заполните все три, чтобы карточка появилась в тесте."),
      w.map((x) => x.node)),
    formError,
  ];

  return dialog({
    title, body, initialFocus: "textarea",
    actions: (close) => [
      h("button", { type: "button", class: "btn btn--ghost", onclick: () => close(undefined) }, "Отмена"),
      h("button", { type: "submit", class: "btn btn--primary" }, submitText || "Сохранить"),
    ],
    onSubmit: async (close) => {
      all.forEach((f) => { f.err.textContent = ""; f.control.classList.remove("input--invalid", "textarea--invalid"); });
      formError.textContent = "";
      const data = {
        question: q.control.value,
        answer: a.control.value,
        wrongAnswers: w.map((x) => x.control.value),
      };
      try {
        close(await save(data));
      } catch (e) {
        if (e.fields) {
          let first = null;
          all.forEach((f) => {
            const msg = e.fields[f.control.name];
            if (msg) {
              f.err.textContent = msg;
              f.control.classList.add(f.control.tagName === "TEXTAREA" ? "textarea--invalid" : "input--invalid");
              if (!first) first = f.control;
            }
          });
          if (first) first.focus();
        } else {
          formError.textContent = e.message || "Не удалось сохранить карточку.";
        }
      }
    },
  });
};
