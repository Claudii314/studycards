App.github = function() {
  const API = "https://api.github.com";
  function toBase64(text) {
    const bytes = (new TextEncoder).encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  function headers(cfg) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + cfg.token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  function encPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }
  function fileUrl(cfg) {
    return API + "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) + "/contents/" + encPath(cfg.path);
  }
  async function explain(res) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j && j.message ? " (" + j.message + ")" : "";
    } catch (e) {}
    if (res.status === 401) return new Error("GitHub не принял токен: он неверный или истёк." + detail);
    if (res.status === 403) return new Error("У токена нет права записи в этот репозиторий. Нужно разрешение Contents: Read and write." + detail);
    if (res.status === 404) return new Error("Репозиторий, ветка или файл не найдены. Проверьте владельца, название репозитория и ветку." + detail);
    if (res.status === 409 || res.status === 422) return new Error("На GitHub уже есть более новая версия файла." + detail);
    return new Error("GitHub ответил ошибкой " + res.status + "." + detail);
  }
  async function request(url, options) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (e) {
      throw new Error("Нет связи с GitHub. Проверьте интернет.");
    }
    return res;
  }
  async function checkAccess(cfg) {
    const res = await request(API + "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo), {
      headers: headers(cfg)
    });
    if (!res.ok) throw await explain(res);
    const repo = await res.json();
    return !!(repo.permissions && repo.permissions.push);
  }
  async function getFile(cfg) {
    const res = await request(fileUrl(cfg) + "?ref=" + encodeURIComponent(cfg.branch) + "&t=" + Date.now(), {
      headers: headers(cfg),
      cache: "no-store"
    });
    if (res.status === 404) return {
      exists: false,
      sha: null,
      text: null
    };
    if (!res.ok) throw await explain(res);
    const j = await res.json();
    return {
      exists: true,
      sha: j.sha,
      text: fromBase64(j.content || "")
    };
  }
  async function putFile(cfg, text, sha, message) {
    const body = {
      message: message,
      content: toBase64(text),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    const res = await request(fileUrl(cfg), {
      method: "PUT",
      headers: Object.assign({
        "Content-Type": "application/json"
      }, headers(cfg)),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await explain(res);
    const j = await res.json();
    return {
      sha: j.content && j.content.sha
    };
  }
  return {
    checkAccess: checkAccess,
    getFile: getFile,
    putFile: putFile,
    toBase64: toBase64,
    fromBase64: fromBase64
  };
}();
