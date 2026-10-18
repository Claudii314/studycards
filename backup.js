/* Экспорт и импорт резервной копии в формате JSON. */
App.backup = (function () {
  const FORMAT = "studycards-backup";        // личная резервная копия
  const SHARED_FORMAT = "studycards-shared"; // общий набор на сайте
  const VERSION = 1;
  const { normalizeText } = App.utils;

  async function buildExport() {
    const data = await App.repo.exportPersonal();
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      subjects: data.subjects,
      groups: data.groups,
      cards: data.cards,
    };
  }

  /** Скачивает файл резервной копии. Возвращает объект со статистикой. */
  async function download() {
    const payload = await buildExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studycards-" + App.utils.todayStamp() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return payload;
  }

  /**
   * Проверяет структуру файла. Возвращает { ok, errors, data }.
   * data — нормализованные записи, готовые к записи в базу.
   */
  function validate(raw, expectedFormat) {
    const format = expectedFormat || FORMAT;
    const errors = [];
    const add = (msg) => { if (errors.length < 50) errors.push(msg); };

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, errors: ["Файл не содержит объект резервной копии."] };
    }
    if (raw.format !== format) {
      add(format === FORMAT
        ? (raw.format === SHARED_FORMAT
            ? "Это файл общего набора с сайта, а не личная резервная копия. Общий набор загружается автоматически."
            : "Это не резервная копия StudyCards (нет отметки формата).")
        : "Файл общего набора повреждён (нет отметки формата).");
    }
    if (raw.version !== VERSION) add("Неподдерживаемая версия файла: " + String(raw.version) + ".");
    ["subjects", "groups", "cards"].forEach((k) => {
      if (!Array.isArray(raw[k])) add("Отсутствует список «" + k + "».");
    });
    if (errors.length) return { ok: false, errors };

    const ids = new Set();
    const isStr = (v) => typeof v === "string" && normalizeText(v) !== "";
    const ts = (v) => (typeof v === "number" && isFinite(v) ? v : Date.now());

    const subjects = [];
    raw.subjects.forEach((x, i) => {
      const where = "Предмет №" + (i + 1);
      if (!x || typeof x !== "object") return add(where + ": неверная запись.");
      if (!isStr(x.id)) return add(where + ": нет идентификатора.");
      if (ids.has(x.id)) return add(where + ": повторяющийся идентификатор.");
      if (!isStr(x.name)) return add(where + ": нет названия.");
      ids.add(x.id);
      subjects.push({ id: x.id, name: normalizeText(x.name), createdAt: ts(x.createdAt), updatedAt: ts(x.updatedAt) });
    });
    const subjectIds = new Set(subjects.map((x) => x.id));

    const groups = [];
    raw.groups.forEach((x, i) => {
      const where = "Группа №" + (i + 1);
      if (!x || typeof x !== "object") return add(where + ": неверная запись.");
      if (!isStr(x.id)) return add(where + ": нет идентификатора.");
      if (ids.has(x.id)) return add(where + ": повторяющийся идентификатор.");
      if (!isStr(x.name)) return add(where + ": нет названия.");
      if (!subjectIds.has(x.subjectId)) return add(where + " («" + x.name + "»): ссылается на несуществующий предмет.");
      ids.add(x.id);
      groups.push({ id: x.id, subjectId: x.subjectId, name: normalizeText(x.name), createdAt: ts(x.createdAt), updatedAt: ts(x.updatedAt) });
    });
    const groupIds = new Set(groups.map((x) => x.id));

    const cards = [];
    raw.cards.forEach((x, i) => {
      const where = "Карточка №" + (i + 1);
      if (!x || typeof x !== "object") return add(where + ": неверная запись.");
      if (!isStr(x.id)) return add(where + ": нет идентификатора.");
      if (ids.has(x.id)) return add(where + ": повторяющийся идентификатор.");
      if (!groupIds.has(x.groupId)) return add(where + ": ссылается на несуществующую группу.");
      if (!isStr(x.question)) return add(where + ": пустой вопрос.");
      if (!isStr(x.answer)) return add(where + ": пустой ответ.");
      let wrong = x.wrongAnswers == null ? [] : x.wrongAnswers;
      if (!Array.isArray(wrong) || !(wrong.length === 0 || (wrong.length === 3 && wrong.every(isStr)))) {
        return add(where + ": неправильных вариантов должно быть 0 или 3, все непустые.");
      }
      ids.add(x.id);
      cards.push({
        id: x.id, groupId: x.groupId,
        question: normalizeText(x.question), answer: normalizeText(x.answer),
        wrongAnswers: wrong.map(normalizeText),
        createdAt: ts(x.createdAt), updatedAt: ts(x.updatedAt),
      });
    });

    if (errors.length) return { ok: false, errors };
    return { ok: true, errors: [], data: { subjects, groups, cards } };
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Не удалось прочитать файл."));
      r.readAsText(file, "utf-8");
    });
  }

  /** Читает и проверяет файл. Ничего не записывает. */
  async function parseFile(file) {
    if (!file) return { ok: false, errors: ["Файл не выбран."] };
    let text;
    try { text = await readFile(file); } catch (e) { return { ok: false, errors: [e.message] }; }
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, errors: ["Файл не является корректным JSON."] }; }
    return validate(raw);
  }

  /** Общий набор для публикации на сайт. */
  async function buildShared() {
    const data = await App.repo.exportShared();
    return {
      format: SHARED_FORMAT,
      version: VERSION,
      publishedAt: new Date().toISOString(),
      subjects: data.subjects,
      groups: data.groups,
      cards: data.cards,
    };
  }

  return { buildExport, buildShared, download, validate, parseFile, FORMAT, SHARED_FORMAT, VERSION };
})();
