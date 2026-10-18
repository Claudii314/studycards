/* Режим теста: четыре варианта в случайном порядке. */
App.views.quiz = async function (root, params) {
  const { h, mount, btn, crumbs, empty } = App.ui;
  const { shuffle, countText, FORMS } = App.utils;
  const repo = App.repo;

  const set = await App.study.load(params);
  if (!set) return App.views.notFound(root, "Не найдено. Возможно, это было удалено.");
  const cards = set.cards;
  const quizCards = cards.filter(repo.isQuizCard);
  const group = { name: set.title };
  const groupHref = set.backHref;

  const nav = crumbs(set.trail.concat([{ label: "Тест" }]));

  if (!quizCards.length) {
    const text = cards.length
      ? set.where + " " + countText(cards.length, FORMS.card) + (cards.length === 1 ? ", но у неё" : ", но ни у одной") + " нет трёх неправильных вариантов. " +
        "Откройте карточку через «Изменить» и заполните раздел «Варианты для теста»."
      : set.where + " нет карточек. Добавьте карточку с правильным ответом и тремя неправильными вариантами.";
    mount(root, nav, empty("Недостаточно карточек для теста", text,
      h("a", { class: "btn btn--primary", href: groupHref }, set.backLabel)));
    return;
  }

  const KEYS = ["A", "B", "C", "D"];
  const state = { questions: [], index: 0, chosen: null, correct: 0 };

  function start() {
    state.questions = shuffle(quizCards).map((c) => ({
      card: c,
      options: shuffle([
        { text: c.answer, correct: true },
        ...c.wrongAnswers.map((w) => ({ text: w, correct: false })),
      ]),
    }));
    state.index = 0;
    state.chosen = null;
    state.correct = 0;
    render();
  }

  function choose(i) {
    if (state.chosen !== null) return;
    state.chosen = i;
    if (state.questions[state.index].options[i].correct) state.correct++;
    render();
  }

  function next() {
    state.index++;
    state.chosen = null;
    render();
  }

  function render() {
    const total = state.questions.length;
    if (state.index >= total) return renderResult();
    const q = state.questions[state.index];
    const answered = state.chosen !== null;
    const isLast = state.index === total - 1;

    const options = h("div", { class: "options" }, q.options.map((o, i) => {
      let cls = "option";
      if (answered && o.correct) cls += " option--correct";
      else if (answered && i === state.chosen) cls += " option--wrong";
      return h("button", { type: "button", class: cls, disabled: answered, onclick: () => choose(i) },
        h("span", { class: "option__key" }, KEYS[i]), h("span", null, o.text));
    }));

    let feedback = null;
    if (answered) {
      const ok = q.options[state.chosen].correct;
      feedback = h("div", { class: "feedback " + (ok ? "feedback--ok" : "feedback--bad"), role: "status" },
        ok ? "Правильно" : "Неправильно",
        ok ? null : h("div", { class: "feedback__detail" }, "Правильный ответ: " + q.card.answer));
    }

    const navRow = h("div", { class: "study__nav" },
      h("span", { class: "study__counter" }, "Вопрос " + (state.index + 1) + " из " + total),
      answered ? btn(isLast ? "Показать результат" : "Следующий вопрос", next, "btn--primary") : h("span"));

    mount(root, nav, h("div", { class: "study" },
      h("div", { class: "study__bar" },
        h("div", { class: "study__title" }, "Тест: " + group.name),
        btn("Начать заново", start, "btn--sm btn--ghost")),
      h("div", { class: "progress", "aria-hidden": "true" },
        h("div", { class: "progress__fill", style: "width:" + ((state.index + (answered ? 1 : 0)) / total * 100) + "%" })),
      h("div", { class: "flash" },
        h("div", { class: "flash__head" },
          h("span", { class: "flash__label" }, h("span", { class: "flash__dot" }), "Вопрос")),
        h("div", { class: "flash__q" }, q.card.question)),
      options, feedback, navRow));

    const focusEl = answered ? root.querySelector(".study__nav .btn") : null;
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  function renderResult() {
    const total = state.questions.length;
    const pct = Math.round(state.correct / total * 100);
    mount(root, nav, h("div", { class: "study" },
      h("div", { class: "result" },
        h("div", { class: "result__big" }, pct + " %"),
        h("div", { class: "result__text" }, "Правильных ответов: " + state.correct + " из " + total),
        h("div", { class: "result__stats" },
          h("div", { class: "stat stat--ok" }, h("div", { class: "stat__value" }, String(state.correct)), h("div", { class: "stat__label" }, "Правильно")),
          h("div", { class: "stat stat--bad" }, h("div", { class: "stat__value" }, String(total - state.correct)), h("div", { class: "stat__label" }, "Ошибок"))),
        h("div", { class: "study__actions" },
          btn("Пройти ещё раз", start, "btn--primary"),
          h("a", { class: "btn", href: groupHref }, set.backLabel)))));
  }

  start();
};
