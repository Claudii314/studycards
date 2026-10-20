App.exam = function() {
  const KEY_PROGRESS = "studycards.exam";
  const KEY_RU = "studycards.examRu";
  const GOOD = .8;
  function lines(text) {
    return String(text || "").split(/\r?\n/).map(s => s.trim().replace(/^[-•–]\s+/, "")).filter(Boolean);
  }
  function points(card) {
    return lines(card.answer);
  }
  function pointsRu(card) {
    const ru = lines(card.answerRu);
    return ru.length === points(card).length ? ru : null;
  }
  function isExamCard(card) {
    return App.repo.isExamCard(card);
  }
  function split(point) {
    const i = point.indexOf(":");
    if (i > 0 && i <= 70) return {
      key: point.slice(0, i),
      rest: point.slice(i)
    };
    return {
      key: "",
      rest: point
    };
  }
  function keyword(point) {
    const s = split(point);
    if (s.key) return s.key;
    const words = point.split(/\s+/);
    return words.slice(0, 5).join(" ") + (words.length > 5 ? "…" : "");
  }
  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }
  function progress() {
    return read(KEY_PROGRESS, {});
  }
  function record(cardId, score) {
    const all = progress();
    const prev = all[cardId] || {
      n: 0
    };
    all[cardId] = {
      s: score,
      n: prev.n + 1,
      t: Date.now()
    };
    write(KEY_PROGRESS, all);
  }
  function status(cardId, all) {
    const p = (all || progress())[cardId];
    if (!p) return "new";
    return p.s >= GOOD ? "good" : "weak";
  }
  function showRu() {
    return read(KEY_RU, false) === true;
  }
  function setShowRu(on) {
    write(KEY_RU, !!on);
  }
  return {
    points: points,
    pointsRu: pointsRu,
    isExamCard: isExamCard,
    split: split,
    keyword: keyword,
    progress: progress,
    record: record,
    status: status,
    showRu: showRu,
    setShowRu: setShowRu,
    GOOD: GOOD
  };
}();

App.views.exam = async function(root, params) {
  const {h: h, mount: mount, btn: btn, crumbs: crumbs, empty: empty} = App.ui;
  const {shuffle: shuffle, countText: countText, FORMS: FORMS} = App.utils;
  const exam = App.exam;
  const set = await App.study.load(params);
  if (!set) return App.views.notFound(root, "Не найдено. Возможно, это было удалено.");
  const cards = set.cards.filter(exam.isExamCard);
  const nav = crumbs(set.trail.concat([ {
    label: "Экзамен"
  } ]));
  if (!cards.length) {
    mount(root, nav, empty("Здесь нет открытых вопросов", "Режим «Экзамен» работает с карточками, у которых ответ состоит из нескольких пунктов — каждый с новой строки.", h("a", {
      class: "btn btn--primary",
      href: set.backHref
    }, set.backLabel)));
    return;
  }
  const state = {
    phase: "setup",
    order: [],
    index: 0,
    numbered: true,
    hint: false,
    written: new Map,
    checked: new Map,
    results: new Map
  };
  const pct = x => Math.round(x * 100) + " %";
  const scoreClass = s => s >= exam.GOOD ? "score--good" : s >= .5 ? "score--mid" : "score--bad";
  const qText = card => state.numbered ? card.question : App.study.stripNumber(card.question);
  function start(list, numbered) {
    state.order = list;
    state.numbered = numbered;
    state.index = 0;
    state.hint = false;
    state.written = new Map;
    state.checked = new Map;
    state.results = new Map;
    state.phase = "question";
    render();
  }
  function finish() {
    if (state.phase === "answer") {
      const card = state.order[state.index];
      if (!state.results.has(card.id)) {
        const score = (state.checked.get(card.id) || new Set).size / App.exam.points(card).length;
        state.results.set(card.id, score);
        App.exam.record(card.id, score);
      }
    }
    state.phase = "result";
    render();
  }
  function render() {
    if (state.phase === "setup") return renderSetup();
    if (state.phase === "result") return renderResult();
    return state.phase === "answer" ? renderAnswer() : renderQuestion();
  }
  function ruToggle() {
    const box = h("input", {
      type: "checkbox"
    });
    box.checked = exam.showRu();
    box.addEventListener("change", () => {
      exam.setShowRu(box.checked);
      render();
    });
    return h("label", {
      class: "toggle"
    }, box, h("span", null, "Показывать перевод на русский"));
  }
  function renderSetup() {
    const all = exam.progress();
    const by = {
      good: [],
      weak: [],
      new: []
    };
    cards.forEach(c => by[exam.status(c.id, all)].push(c));
    const weakAndNew = cards.filter(c => exam.status(c.id, all) !== "good");
    const list = h("div", {
      class: "exam-list"
    }, cards.map(c => {
      const p = all[c.id];
      return h("div", {
        class: "exam-list__row"
      }, h("span", {
        class: "exam-list__q"
      }, c.question), p ? h("span", {
        class: "score " + scoreClass(p.s)
      }, pct(p.s)) : h("span", {
        class: "score score--new"
      }, "новый"));
    }));
    mount(root, nav, h("div", {
      class: "study"
    }, h("div", {
      class: "study__bar"
    }, h("div", {
      class: "study__title"
    }, "Экзамен: " + set.title)), h("div", {
      class: "panel"
    }, h("p", {
      class: "panel__text",
      style: "margin-top:0"
    }, "Вспомни ответ (можно записать), открой эталон и отметь пункты, которые назвал. Результат сохраняется на этом устройстве."), h("div", {
      class: "exam-stats"
    }, h("div", {
      class: "stat stat--ok"
    }, h("div", {
      class: "stat__value"
    }, String(by.good.length)), h("div", {
      class: "stat__label"
    }, "освоено (от 80 %)")), h("div", {
      class: "stat stat--bad"
    }, h("div", {
      class: "stat__value"
    }, String(by.weak.length)), h("div", {
      class: "stat__label"
    }, "нужно повторить")), h("div", {
      class: "stat"
    }, h("div", {
      class: "stat__value"
    }, String(by.new.length)), h("div", {
      class: "stat__label"
    }, "ещё не пройдено"))), h("div", {
      class: "exam-start"
    }, btn("Все по порядку", () => start(cards.slice(), true), "btn--primary"), btn("Все вперемешку", () => start(shuffle(cards), false)), btn("10 случайных", () => start(shuffle(cards).slice(0, 10), false), "", {
      disabled: cards.length < 2
    }), btn("Слабые и новые (" + weakAndNew.length + ")", () => start(shuffle(weakAndNew), false), "", {
      disabled: !weakAndNew.length
    })), ruToggle()), h("h2", {
      class: "section__title",
      style: "margin-top:24px"
    }, countText(cards.length, FORMS.question)), list));
  }
  function header() {
    const total = state.order.length;
    return [ h("div", {
      class: "study__bar"
    }, h("div", {
      class: "study__title"
    }, "Экзамен: " + set.title), btn("Завершить", finish, "btn--sm btn--ghost")), h("div", {
      class: "progress",
      "aria-hidden": "true"
    }, h("div", {
      class: "progress__fill",
      style: "width:" + (state.index + (state.phase === "answer" ? 1 : 0)) / total * 100 + "%"
    })) ];
  }
  function questionBlock(card) {
    const text = qText(card);
    return [ h("div", {
      class: "flash__head"
    }, h("span", {
      class: "flash__label"
    }, h("span", {
      class: "flash__dot"
    }), "Вопрос"), h("span", {
      class: "flash__mark"
    }, state.index + 1 + " / " + state.order.length)), h("div", {
      class: "flash__q flash__q--exam"
    }, text), exam.showRu() && card.questionRu ? h("div", {
      class: "flash__ru"
    }, card.questionRu) : null ];
  }
  function renderQuestion() {
    const card = state.order[state.index];
    const pts = exam.points(card);
    const area = h("textarea", {
      class: "textarea",
      rows: 6,
      placeholder: "Напиши ответ своими словами (необязательно)"
    });
    area.value = state.written.get(card.id) || "";
    area.addEventListener("input", () => state.written.set(card.id, area.value));
    const hint = state.hint ? h("div", {
      class: "chips"
    }, h("span", {
      class: "chips__label"
    }, "Подсказка — ключевые слова:"), pts.map(p => h("span", {
      class: "chip"
    }, exam.keyword(p)))) : null;
    mount(root, nav, h("div", {
      class: "study"
    }, header(), h("div", {
      class: "flash flash--exam"
    }, questionBlock(card), hint), h("label", {
      class: "field exam-written"
    }, h("span", {
      class: "field__label"
    }, "Твой ответ"), area), h("div", {
      class: "study__actions"
    }, btn("Подсказка (" + pts.length + " " + App.utils.plural(pts.length, [ "пункт", "пункта", "пунктов" ]) + ")", () => {
      state.hint = true;
      render();
    }, "btn--lg", {
      disabled: state.hint
    }), btn("Показать ответ", () => {
      state.phase = "answer";
      render();
    }, "btn--lg btn--primary"))));
  }
  function renderAnswer() {
    const card = state.order[state.index];
    const pts = exam.points(card);
    const ru = exam.showRu() ? exam.pointsRu(card) : null;
    const checked = state.checked.get(card.id) || new Set;
    state.checked.set(card.id, checked);
    const counter = h("span", {
      class: "study__counter"
    });
    const updateCounter = () => {
      counter.textContent = "Названо " + checked.size + " из " + pts.length;
    };
    const list = h("div", {
      class: "exam-points"
    }, pts.map((p, i) => {
      const box = h("input", {
        type: "checkbox"
      });
      box.checked = checked.has(i);
      const row = h("label", {
        class: "exam-point" + (box.checked ? " exam-point--checked" : "")
      }, box, h("span", {
        class: "exam-point__body"
      }, (() => {
        const s = exam.split(p);
        return h("span", null, s.key ? h("strong", null, s.key) : null, s.rest);
      })(), ru ? h("span", {
        class: "exam-point__ru"
      }, ru[i]) : null));
      box.addEventListener("change", () => {
        if (box.checked) checked.add(i); else checked.delete(i);
        row.classList.toggle("exam-point--checked", box.checked);
        updateCounter();
      });
      return row;
    }));
    updateCounter();
    const written = (state.written.get(card.id) || "").trim();
    const ruWhole = exam.showRu() && !ru && card.answerRu ? h("div", {
      class: "notice exam-ru-whole"
    }, card.answerRu) : null;
    function done() {
      const score = checked.size / pts.length;
      state.results.set(card.id, score);
      exam.record(card.id, score);
      if (state.index >= state.order.length - 1) return finish();
      state.index++;
      state.phase = "question";
      state.hint = false;
      render();
    }
    mount(root, nav, h("div", {
      class: "study"
    }, header(), h("div", {
      class: "flash flash--exam"
    }, questionBlock(card)), written ? h("div", {
      class: "exam-written-box"
    }, h("div", {
      class: "field__label"
    }, "Твой ответ"), h("div", null, written)) : null, h("h2", {
      class: "section__title",
      style: "margin-top:20px"
    }, "Отметь пункты, которые ты назвал"), list, ruWhole, card.note ? h("div", {
      class: "notice notice--warn"
    }, card.note) : null, h("div", {
      class: "study__nav"
    }, btn("Отметить все", () => {
      pts.forEach((_, i) => checked.add(i));
      render();
    }, "btn--ghost"), counter, btn(state.index >= state.order.length - 1 ? "Показать результат" : "Следующий вопрос", done, "btn--primary"))));
  }
  function renderResult() {
    const done = state.order.filter(c => state.results.has(c.id));
    if (!done.length) {
      state.phase = "setup";
      return render();
    }
    const avg = done.reduce((s, c) => s + state.results.get(c.id), 0) / done.length;
    const weak = done.filter(c => state.results.get(c.id) < exam.GOOD);
    mount(root, nav, h("div", {
      class: "study"
    }, h("div", {
      class: "result"
    }, h("div", {
      class: "result__big"
    }, pct(avg)), h("div", {
      class: "result__text"
    }, "Средний результат · пройдено вопросов: " + done.length), h("div", {
      class: "study__actions"
    }, weak.length ? btn("Повторить слабые (" + weak.length + ")", () => start(shuffle(weak), false), "btn--primary") : null, btn("Новая серия", () => {
      state.phase = "setup";
      render();
    }, weak.length ? "" : "btn--primary"), h("a", {
      class: "btn",
      href: set.backHref
    }, set.backLabel))), h("div", {
      class: "exam-list",
      style: "margin-top:18px"
    }, done.map(c => {
      const s = state.results.get(c.id);
      return h("div", {
        class: "exam-list__row"
      }, h("span", {
        class: "exam-list__q"
      }, qText(c)), h("span", {
        class: "score " + scoreClass(s)
      }, pct(s)));
    }))));
  }
  render();
};
