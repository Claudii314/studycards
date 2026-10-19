window.App = window.App || {};

App.utils = function() {
  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [ a[j], a[i] ];
    }
    return a;
  }
  function plural(n, forms) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }
  function countText(n, forms) {
    return n + " " + plural(n, forms);
  }
  const FORMS = {
    card: [ "карточка", "карточки", "карточек" ],
    group: [ "группа", "группы", "групп" ],
    subject: [ "предмет", "предмета", "предметов" ],
    question: [ "вопрос", "вопроса", "вопросов" ]
  };
  function sameName(a, b) {
    return normalizeText(a).toLocaleLowerCase("ru") === normalizeText(b).toLocaleLowerCase("ru");
  }
  function normalizeText(s) {
    return String(s == null ? "" : s).trim();
  }
  function byCreated(a, b) {
    return (a.createdAt || 0) - (b.createdAt || 0);
  }
  function todayStamp() {
    const d = new Date;
    const p = x => String(x).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  return {
    uid: uid,
    shuffle: shuffle,
    plural: plural,
    countText: countText,
    FORMS: FORMS,
    sameName: sameName,
    normalizeText: normalizeText,
    byCreated: byCreated,
    todayStamp: todayStamp
  };
}();
