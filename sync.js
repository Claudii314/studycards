/*
 * Синхронизация общего набора.
 * Студенты: при открытии сайта загружается shared.json и заменяет общие карточки на устройстве.
 * Автор (режим автора + GitHub): читает свежий файл прямо из репозитория и публикует изменения обратно.
 */
App.sync = (function () {
  const SHARED_URL = "shared.json";
  const editor = App.editor;

  async function fetchFromSite() {
    if (location.protocol === "file:") return null; // при открытии файла с диска сайта нет
    let res;
    try {
      res = await fetch(SHARED_URL + "?t=" + Date.now(), { cache: "no-cache" });
    } catch (e) {
      return null;
    }
    if (!res.ok) return null;
    return res.text();
  }

  async function fetchRaw() {
    if (editor.isEnabled() && editor.hasGithub()) {
      const f = await App.github.getFile(editor.github());
      return { text: f.exists ? f.text : null, sha: f.sha, source: "github" };
    }
    return { text: await fetchFromSite(), sha: null, source: "site" };
  }

  function parse(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, errors: ["Файл общего набора не является корректным JSON."] }; }
    const v = App.backup.validate(raw, App.backup.SHARED_FORMAT);
    v.publishedAt = raw && typeof raw.publishedAt === "string" ? raw.publishedAt : null;
    return v;
  }

  /**
   * Загружает общий набор.
   * Статусы: updated | same | dirty (есть неопубликованные правки) | offline | empty | invalid.
   */
  async function pull(options) {
    const force = !!(options && options.force);
    const meta = editor.meta();
    if (meta.dirty && !force) return { status: "dirty" };

    const remote = await fetchRaw();
    if (remote.text == null) return { status: remote.source === "github" ? "empty" : "offline" };
    const parsed = parse(remote.text);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

    if (!force && parsed.publishedAt && parsed.publishedAt === meta.publishedAt) {
      const local = await App.repo.exportShared();
      if (local.cards.length === parsed.data.cards.length && local.groups.length === parsed.data.groups.length &&
          local.subjects.length === parsed.data.subjects.length) {
        return { status: "same" };
      }
    }
    await App.repo.replaceShared(parsed.data);
    editor.setMeta({ publishedAt: parsed.publishedAt, dirty: false });
    return { status: "updated", publishedAt: parsed.publishedAt };
  }

  class ConflictError extends Error {}

  /**
   * Публикует общий набор в репозиторий. Если с другого устройства уже опубликована
   * другая версия, бросает ConflictError (если не передан overwrite).
   */
  async function publish(options) {
    const overwrite = !!(options && options.overwrite);
    if (!editor.hasGithub()) throw new Error("Сначала укажите репозиторий и токен GitHub на странице «Для автора».");
    const cfg = editor.github();
    const remote = await App.github.getFile(cfg);
    if (remote.exists && !overwrite) {
      const parsed = parse(remote.text);
      const base = editor.meta().publishedAt;
      if (parsed.publishedAt && parsed.publishedAt !== base) {
        throw Object.assign(new ConflictError("На сайте уже есть другая версия общего набора."), { remotePublishedAt: parsed.publishedAt });
      }
    }
    const payload = await App.backup.buildShared();
    const text = JSON.stringify(payload, null, 2) + "\n";
    await App.github.putFile(cfg, text, remote.sha, "Обновление карточек " + payload.publishedAt.slice(0, 16).replace("T", " "));
    editor.setMeta({ publishedAt: payload.publishedAt, dirty: false });
    return payload;
  }

  return { pull, publish, ConflictError, SHARED_URL };
})();
