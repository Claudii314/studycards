App.study = function() {
  async function load(params) {
    const repo = App.repo;
    if (params.scope === "subject") {
      const subject = await repo.getSubject(params.id);
      if (!subject) return null;
      const groups = await repo.listGroups(subject.id);
      const cards = [];
      for (const g of groups) cards.push(...await repo.listCards(g.id));
      const backHref = "#/subject/" + encodeURIComponent(subject.id);
      return {
        title: subject.name + ": все группы",
        scope: "subject",
        subjectId: subject.id,
        options: subject.options || {},
        cards: cards,
        backHref: backHref,
        backLabel: "К предмету",
        where: "В этом предмете",
        trail: [ {
          label: "Предметы",
          href: "#/"
        }, {
          label: subject.name,
          href: backHref
        } ]
      };
    }
    const group = await repo.getGroup(params.id);
    if (!group) return null;
    const subject = await repo.getSubject(group.subjectId);
    const backHref = "#/group/" + encodeURIComponent(group.id);
    return {
      title: group.name,
      scope: "group",
      subjectId: group.subjectId,
      options: subject && subject.options || {},
      cards: await repo.listCards(group.id),
      backHref: backHref,
      backLabel: "К группе",
      where: "В группе",
      trail: [ {
        label: "Предметы",
        href: "#/"
      }, {
        label: subject ? subject.name : "Предмет",
        href: subject ? "#/subject/" + encodeURIComponent(subject.id) : "#/"
      }, {
        label: group.name,
        href: backHref
      } ]
    };
  }
  function stripNumber(text) {
    const stripped = String(text).replace(/^\s*(\d+(\.\d+)+\.?|\d+\.)\s+/, "");
    return stripped || text;
  }
  const POOL_KEY = "studycards.randomPool";
  function readPool() {
    try {
      return JSON.parse(localStorage.getItem(POOL_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function nextRandom(subjectId, cards, n) {
    const shuffle = App.utils.shuffle;
    if (cards.length <= n) return {
      cards: shuffle(cards),
      seen: cards.length,
      total: cards.length
    };
    const all = readPool();
    const ids = new Set(cards.map(c => c.id));
    const used = new Set((all[subjectId] || []).filter(id => ids.has(id)));
    const fresh = cards.filter(c => !used.has(c.id));
    let pick;
    let nextUsed;
    if (fresh.length >= n) {
      pick = shuffle(fresh).slice(0, n);
      nextUsed = Array.from(used).concat(pick.map(c => c.id));
    } else {
      const taken = new Set(fresh.map(c => c.id));
      const extra = shuffle(cards.filter(c => !taken.has(c.id))).slice(0, n - fresh.length);
      pick = fresh.concat(extra);
      nextUsed = extra.map(c => c.id);
    }
    all[subjectId] = nextUsed.length >= cards.length ? [] : nextUsed;
    try {
      localStorage.setItem(POOL_KEY, JSON.stringify(all));
    } catch (e) {}
    return {
      cards: shuffle(pick),
      seen: nextUsed.length,
      total: cards.length
    };
  }
  return {
    load: load,
    stripNumber: stripNumber,
    nextRandom: nextRandom
  };
}();
