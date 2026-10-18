/* Режим флеш-карточек. */
App.views.flashcards = async function (root, params) {
  const { h, mount, btn, crumbs, empty } = App.ui;
  const { shuffle } = App.utils;
  const repo = App.repo;

  const group = await repo.getGroup(params.id);
  if (!group) return App.views.notFound(root, "Группа не найдена. Возможно, она была удалена.");
  const subject = await repo.getSubject(group.subjectId);
  const cards = await repo.listCards(group.id);
  const groupHref = "#/group/" + encodeURIComponent(group.id);

  const nav = crumbs([
    { label: "Предметы", href: "#/" },
    { label: subject ? subject.name : "Предмет", href: subject ? "#/subject/" + encodeURIComponent(subject.id) : "#/" },
    { label: group.name, href: groupHref },
    { label: "Флеш-карточки" },
  ]);

  if (!cards.length) {
    mount(root, nav, empty("В группе нет карточек",
      "Добавьте карточки, чтобы начать обучение.",
      h("a", { class: "btn btn--primary", href: groupHref }, "К группе")));
    return;
  }

  /* Состояние сессии */
  const state = { order: [], index: 0, revealed: false, marks: new Map(), shuffled: false, finished: false };

  function start(shuffled) {
    state.shuffled = shuffled;
    state.order = shuffled ? shuffle(cards) : cards.slice();
    state.index = 0;
    state.revealed = false;
    state.marks = new Map();
    state.finished = false;
    render();
  }

  function go(delta) {
    const next = state.index + delta;
    if (next < 0) return;
    if (next >= state.order.length) { state.finished = true; render(); return; }
    state.index = next;
    state.revealed = false;
    render();
  }

  function mark(value) {
    state.marks.set(state.order[state.index].id, value);
    go(1);
  }

  function render() {
    if (state.finished) return renderResult();
    const card = state.order[state.index];
    const total = state.order.length;
    const m = state.marks.get(card.id);
    const isLast = state.index === total - 1;

    const bar = h("div", { class: "study__bar" },
      h("div", { class: "study__title" }, group.name + (state.shuffled ? " (вперемешку)" : "")),
      h("div", null,
        btn("Перемешать", () => start(true), "btn--sm btn--ghost"),
        btn("Сначала", () => start(false), "btn--sm btn--ghost")));

    const progress = h("div", { class: "progress", "aria-hidden": "true" },
      h("div", { class: "progress__fill", style: "width:" + ((state.index + 1) / total * 100) + "%" }));

    const flash = h("div", { class: "flash" },
      h("div", { class: "flash__head" },
        h("span", { class: "flash__label" }, h("span", { class: "flash__dot" }), "Вопрос"),
        m ? h("span", { class: "flash__mark flash__mark--" + m }, m === "known" ? "Знал" : "Не знал") : null),
      h("div", { class: "flash__q" }, card.question),
      state.revealed
        ? h("div", { class: "flash__answer" },
            h("div", { class: "flash__answer-label" }, "Ответ"),
            h("div", null, card.answer))
        : null);

    const actions = state.revealed
      ? h("div", { class: "study__actions" },
          btn("Не знал", () => mark("unknown"), "btn--lg btn--danger-solid"),
          btn("Знал", () => mark("known"), "btn--lg btn--ok"))
      : h("div", { class: "study__actions" },
          btn("Показать ответ", () => { state.revealed = true; render(); }, "btn--lg btn--primary"));

    const navRow = h("div", { class: "study__nav" },
      btn("Назад", () => go(-1), "btn--ghost", { disabled: state.index === 0 }),
      h("span", { class: "study__counter" }, "Карточка " + (state.index + 1) + " из " + total),
      btn(isLast ? "Завершить" : "Далее", () => go(1), "btn--ghost"));

    mount(root, nav, h("div", { class: "study" }, bar, progress, flash, actions, navRow));
    const focusBtn = root.querySelector(".study__actions .btn:last-child");
    if (focusBtn) focusBtn.focus({ preventScroll: true });
  }

  function renderResult() {
    const total = state.order.length;
    let known = 0, unknown = 0;
    state.marks.forEach((v) => { if (v === "known") known++; else unknown++; });
    const skipped = total - known - unknown;

    mount(root, nav, h("div", { class: "study" },
      h("div", { class: "result" },
        h("div", { class: "result__big" }, known + " из " + total),
        h("div", { class: "result__text" }, "Группа пройдена. Отмечено «Знал»"),
        h("div", { class: "result__stats" },
          h("div", { class: "stat stat--ok" }, h("div", { class: "stat__value" }, String(known)), h("div", { class: "stat__label" }, "Знал")),
          h("div", { class: "stat stat--bad" }, h("div", { class: "stat__value" }, String(unknown)), h("div", { class: "stat__label" }, "Не знал")),
          h("div", { class: "stat" }, h("div", { class: "stat__value" }, String(skipped)), h("div", { class: "stat__label" }, "Без отметки"))),
        h("div", { class: "study__actions" },
          btn("Повторить группу", () => start(state.shuffled), "btn--primary"),
          btn("Повторить вперемешку", () => start(true)),
          h("a", { class: "btn", href: groupHref }, "К группе")))));
  }

  start(false);
};
