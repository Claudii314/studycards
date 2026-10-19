App.editor = function() {
  const KEY_MODE = "studycards.editor";
  const KEY_META = "studycards.sharedMeta";
  const KEY_GH = "studycards.github";
  const listeners = new Set;
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
      if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }
  function isEnabled() {
    return read(KEY_MODE, false) === true && hasGithub();
  }
  function setEnabled(on) {
    write(KEY_MODE, !!on);
    emit();
  }
  function canModify(record) {
    return !record || !record.shared || isEnabled();
  }
  function meta() {
    return read(KEY_META, {
      publishedAt: null,
      dirty: false
    });
  }
  function setMeta(patch) {
    write(KEY_META, Object.assign(meta(), patch));
    emit();
  }
  function markDirty() {
    if (!meta().dirty) setMeta({
      dirty: true
    });
  }
  function github() {
    return Object.assign({
      owner: "",
      repo: "",
      branch: "main",
      token: ""
    }, read(KEY_GH, {}), {
      path: "shared.json"
    });
  }
  function setGithub(cfg) {
    write(KEY_GH, cfg);
    emit();
  }
  function hasGithub() {
    const g = github();
    return !!(g.owner && g.repo && g.token);
  }
  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function emit() {
    listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }
  return {
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    canModify: canModify,
    meta: meta,
    setMeta: setMeta,
    markDirty: markDirty,
    github: github,
    setGithub: setGithub,
    hasGithub: hasGithub,
    onChange: onChange
  };
}();
