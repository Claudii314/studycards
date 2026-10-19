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
  return {
    load: load,
    stripNumber: stripNumber
  };
}();
