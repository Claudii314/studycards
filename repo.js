App.repo = function() {
  const {uid: uid, byCreated: byCreated, normalizeText: normalizeText, sameName: sameName} = App.utils;
  const db = App.db;
  const p = db.reqToPromise;
  const LIMITS = {
    name: 100,
    text: 2e3
  };
  class ValidationError extends Error {}
  function assertCanModify(record) {
    if (!App.editor.canModify(record)) {
      throw new ValidationError("Это общий материал с сайта. Изменить его может только автор в режиме автора.");
    }
  }
  function touched(record) {
    if (record && record.shared) App.editor.markDirty();
  }
  const sharedFirst = (a, b) => (b.shared ? 1 : 0) - (a.shared ? 1 : 0) || byCreated(a, b);
  function cleanName(name, what) {
    const v = normalizeText(name);
    if (!v) throw new ValidationError("Введите название " + what + ".");
    if (v.length > LIMITS.name) throw new ValidationError("Название слишком длинное (максимум " + LIMITS.name + " символов).");
    return v;
  }
  async function listSubjects() {
    return db.tx([ "subjects", "groups", "cards" ], "readonly", async s => {
      const [subjects, groups, cards] = await Promise.all([ p(s.subjects.getAll()), p(s.groups.getAll()), p(s.cards.getAll()) ]);
      const cardsPerGroup = countBy(cards, "groupId");
      return subjects.sort(sharedFirst).map(subj => {
        const own = groups.filter(g => g.subjectId === subj.id);
        const cardCount = own.reduce((sum, g) => sum + (cardsPerGroup[g.id] || 0), 0);
        return Object.assign({}, subj, {
          groupCount: own.length,
          cardCount: cardCount
        });
      });
    });
  }
  function getSubject(id) {
    return db.get("subjects", id);
  }
  async function createSubject(name, options) {
    const clean = cleanName(name, "предмета");
    const shared = !!(options && options.shared);
    if (shared) assertCanModify({
      shared: true
    });
    return db.tx([ "subjects" ], "readwrite", async s => {
      const all = await p(s.subjects.getAll());
      if (all.some(x => sameName(x.name, clean))) throw new ValidationError("Предмет с таким названием уже есть.");
      const now = Date.now();
      const subject = {
        id: uid(),
        name: clean,
        createdAt: now,
        updatedAt: now
      };
      if (shared) subject.shared = true;
      await p(s.subjects.add(subject));
      touched(subject);
      return subject;
    });
  }
  async function renameSubject(id, name) {
    const clean = cleanName(name, "предмета");
    return db.tx([ "subjects" ], "readwrite", async s => {
      const subject = await p(s.subjects.get(id));
      if (!subject) throw new ValidationError("Предмет не найден.");
      assertCanModify(subject);
      const all = await p(s.subjects.getAll());
      if (all.some(x => x.id !== id && sameName(x.name, clean))) throw new ValidationError("Предмет с таким названием уже есть.");
      subject.name = clean;
      subject.updatedAt = Date.now();
      await p(s.subjects.put(subject));
      touched(subject);
      return subject;
    });
  }
  async function deleteSubject(id) {
    return db.tx([ "subjects", "groups", "cards" ], "readwrite", async s => {
      const subject = await p(s.subjects.get(id));
      assertCanModify(subject);
      const groups = await p(s.groups.index("bySubject").getAll(id));
      for (const g of groups) {
        const cardKeys = await p(s.cards.index("byGroup").getAllKeys(g.id));
        for (const key of cardKeys) await p(s.cards.delete(key));
        await p(s.groups.delete(g.id));
      }
      await p(s.subjects.delete(id));
      touched(subject);
    });
  }
  async function listGroups(subjectId) {
    return db.tx([ "groups", "cards" ], "readonly", async s => {
      const groups = await p(s.groups.index("bySubject").getAll(subjectId));
      const result = [];
      for (const g of groups.sort(byCreated)) {
        const cards = await p(s.cards.index("byGroup").getAll(g.id));
        result.push(Object.assign({}, g, {
          cardCount: cards.length,
          quizCount: cards.filter(isQuizCard).length
        }));
      }
      return result;
    });
  }
  function getGroup(id) {
    return db.get("groups", id);
  }
  async function createGroup(subjectId, name) {
    const clean = cleanName(name, "группы");
    return db.tx([ "subjects", "groups" ], "readwrite", async s => {
      const subject = await p(s.subjects.get(subjectId));
      if (!subject) throw new ValidationError("Предмет не найден.");
      assertCanModify(subject);
      const siblings = await p(s.groups.index("bySubject").getAll(subjectId));
      if (siblings.some(x => sameName(x.name, clean))) throw new ValidationError("Группа с таким названием уже есть в этом предмете.");
      const now = Date.now();
      const group = {
        id: uid(),
        subjectId: subjectId,
        name: clean,
        createdAt: now,
        updatedAt: now
      };
      if (subject.shared) group.shared = true;
      await p(s.groups.add(group));
      touched(group);
      return group;
    });
  }
  async function renameGroup(id, name) {
    const clean = cleanName(name, "группы");
    return db.tx([ "groups" ], "readwrite", async s => {
      const group = await p(s.groups.get(id));
      if (!group) throw new ValidationError("Группа не найдена.");
      assertCanModify(group);
      const siblings = await p(s.groups.index("bySubject").getAll(group.subjectId));
      if (siblings.some(x => x.id !== id && sameName(x.name, clean))) throw new ValidationError("Группа с таким названием уже есть в этом предмете.");
      group.name = clean;
      group.updatedAt = Date.now();
      await p(s.groups.put(group));
      touched(group);
      return group;
    });
  }
  async function deleteGroup(id) {
    return db.tx([ "groups", "cards" ], "readwrite", async s => {
      const group = await p(s.groups.get(id));
      assertCanModify(group);
      const cardKeys = await p(s.cards.index("byGroup").getAllKeys(id));
      for (const key of cardKeys) await p(s.cards.delete(key));
      await p(s.groups.delete(id));
      touched(group);
    });
  }
  function isQuizCard(card) {
    return Array.isArray(card.wrongAnswers) && card.wrongAnswers.length === 3 && card.wrongAnswers.every(w => normalizeText(w) !== "");
  }
  function validateCard(input) {
    const errors = {};
    const question = normalizeText(input.question);
    const answer = normalizeText(input.answer);
    const wrong = (input.wrongAnswers || [ "", "", "" ]).slice(0, 3).map(normalizeText);
    while (wrong.length < 3) wrong.push("");
    if (!question) errors.question = "Введите вопрос."; else if (question.length > LIMITS.text) errors.question = "Вопрос слишком длинный (максимум " + LIMITS.text + " символов).";
    if (!answer) errors.answer = "Введите ответ."; else if (answer.length > LIMITS.text) errors.answer = "Ответ слишком длинный (максимум " + LIMITS.text + " символов).";
    const filled = wrong.filter(w => w !== "").length;
    if (filled > 0 && filled < 3) {
      wrong.forEach((w, i) => {
        if (!w) errors["wrong" + i] = "Заполните все три варианта или оставьте их пустыми.";
      });
    }
    if (filled === 3) {
      const lower = x => x.toLocaleLowerCase("ru");
      wrong.forEach((w, i) => {
        if (w.length > LIMITS.text) errors["wrong" + i] = "Вариант слишком длинный."; else if (answer && lower(w) === lower(answer)) errors["wrong" + i] = "Неправильный вариант совпадает с правильным ответом."; else if (wrong.findIndex(x => lower(x) === lower(w)) !== i) errors["wrong" + i] = "Варианты не должны повторяться.";
      });
    }
    return {
      errors: errors,
      data: {
        question: question,
        answer: answer,
        wrongAnswers: filled === 3 ? wrong : []
      }
    };
  }
  async function listCards(groupId) {
    const cards = await db.getByIndex("cards", "byGroup", groupId);
    return cards.sort(byCreated);
  }
  async function createCard(groupId, input) {
    const {data: data, errors: errors} = validateCard(input);
    if (Object.keys(errors).length) throw Object.assign(new ValidationError("Проверьте поля карточки."), {
      fields: errors
    });
    return db.tx([ "groups", "cards" ], "readwrite", async s => {
      const group = await p(s.groups.get(groupId));
      if (!group) throw new ValidationError("Группа не найдена.");
      assertCanModify(group);
      const now = Date.now();
      const card = Object.assign({
        id: uid(),
        groupId: groupId,
        createdAt: now,
        updatedAt: now
      }, data);
      if (group.shared) card.shared = true;
      await p(s.cards.add(card));
      touched(card);
      return card;
    });
  }
  async function updateCard(id, input) {
    const {data: data, errors: errors} = validateCard(input);
    if (Object.keys(errors).length) throw Object.assign(new ValidationError("Проверьте поля карточки."), {
      fields: errors
    });
    return db.tx([ "cards" ], "readwrite", async s => {
      const card = await p(s.cards.get(id));
      if (!card) throw new ValidationError("Карточка не найдена.");
      assertCanModify(card);
      Object.assign(card, data, {
        updatedAt: Date.now()
      });
      await p(s.cards.put(card));
      touched(card);
      return card;
    });
  }
  function deleteCard(id) {
    return db.tx([ "cards" ], "readwrite", async s => {
      const card = await p(s.cards.get(id));
      assertCanModify(card);
      await p(s.cards.delete(id));
      touched(card);
    });
  }
  const strip = x => {
    const c = Object.assign({}, x);
    delete c.shared;
    return c;
  };
  async function exportPart(shared) {
    return db.tx([ "subjects", "groups", "cards" ], "readonly", async s => {
      const [subjects, groups, cards] = await Promise.all([ p(s.subjects.getAll()), p(s.groups.getAll()), p(s.cards.getAll()) ]);
      const pick = list => list.filter(x => !!x.shared === shared).sort(byCreated).map(strip);
      return {
        subjects: pick(subjects),
        groups: pick(groups),
        cards: pick(cards)
      };
    });
  }
  function exportPersonal() {
    return exportPart(false);
  }
  function exportShared() {
    return exportPart(true);
  }
  async function replacePart(shared, data) {
    return db.tx([ "subjects", "groups", "cards" ], "readwrite", async s => {
      for (const store of [ "cards", "groups", "subjects" ]) {
        const all = await p(s[store].getAll());
        for (const x of all) if (!!x.shared === shared) await p(s[store].delete(x.id));
      }
      if (!shared) {
        for (const store of [ "subjects", "groups", "cards" ]) {
          for (const x of data[store]) {
            const existing = await p(s[store].get(x.id));
            if (existing && existing.shared) {
              throw new ValidationError("В файле есть запись, совпадающая с общим материалом с сайта («" + (x.name || x.question) + "»). Общие материалы импортировать не нужно — они загружаются автоматически.");
            }
          }
        }
      }
      const mark = x => shared ? Object.assign({}, x, {
        shared: true
      }) : strip(x);
      for (const x of data.subjects) await p(s.subjects.put(mark(x)));
      for (const x of data.groups) await p(s.groups.put(mark(x)));
      for (const x of data.cards) await p(s.cards.put(mark(x)));
    });
  }
  function replacePersonal(data) {
    return replacePart(false, data);
  }
  function replaceShared(data) {
    return replacePart(true, data);
  }
  function countBy(list, key) {
    const out = {};
    list.forEach(x => {
      out[x[key]] = (out[x[key]] || 0) + 1;
    });
    return out;
  }
  return {
    ValidationError: ValidationError,
    LIMITS: LIMITS,
    listSubjects: listSubjects,
    getSubject: getSubject,
    createSubject: createSubject,
    renameSubject: renameSubject,
    deleteSubject: deleteSubject,
    listGroups: listGroups,
    getGroup: getGroup,
    createGroup: createGroup,
    renameGroup: renameGroup,
    deleteGroup: deleteGroup,
    isQuizCard: isQuizCard,
    validateCard: validateCard,
    listCards: listCards,
    createCard: createCard,
    updateCard: updateCard,
    deleteCard: deleteCard,
    exportPersonal: exportPersonal,
    exportShared: exportShared,
    replacePersonal: replacePersonal,
    replaceShared: replaceShared
  };
}();
