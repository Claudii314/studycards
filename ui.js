/* Построение интерфейса: элементы, диалоги, уведомления. Пользовательский текст вставляется только через textContent. */
App.ui = (function () {
  /** h("button", { class: "btn", onclick: fn }, "Текст", childNode) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    children.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
  }

  function mount(root, ...nodes) {
    root.replaceChildren();
    appendChildren(root, nodes);
  }

  function btn(text, onclick, variant, extra) {
    return h("button", Object.assign({ type: "button", class: "btn" + (variant ? " " + variant : ""), onclick }, extra || {}), text);
  }

  function crumbs(items) {
    const nodes = [];
    items.forEach((it, i) => {
      if (i) nodes.push(h("span", { class: "crumbs__sep", "aria-hidden": "true" }, "/"));
      nodes.push(it.href ? h("a", { href: it.href }, it.label) : h("span", null, it.label));
    });
    return h("nav", { class: "crumbs", "aria-label": "Навигация" }, nodes);
  }

  function pageHead(title, sub, actions) {
    return h("div", { class: "page-head" },
      h("div", null, h("h1", null, title), sub ? h("div", { class: "page-head__sub" }, sub) : null),
      actions && actions.length ? h("div", { class: "page-head__actions" }, actions) : null);
  }

  function empty(title, text, action) {
    return h("div", { class: "empty" },
      h("div", { class: "empty__title" }, title),
      text ? h("p", { class: "empty__text" }, text) : null,
      action || null);
  }

  /* ---------- Диалоги ---------- */

  /**
   * Базовый модальный диалог.
   * onSubmit(close) вызывается при отправке формы; если он вернёт false — диалог не закрывается.
   */
  function dialog({ title, body, actions, onSubmit, initialFocus }) {
    return new Promise((resolve) => {
      const dlg = h("dialog", { class: "modal" });
      let result;
      const close = (value) => { result = value; dlg.close(); };
      const form = h("form", { class: "modal__form", method: "dialog", novalidate: true },
        h("div", { class: "modal__head" }, title),
        h("div", { class: "modal__body" }, body),
        h("div", { class: "modal__foot" }, actions(close)));
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (onSubmit) await onSubmit(close);
      });
      dlg.appendChild(form);
      dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });
      document.body.appendChild(dlg);
      dlg.showModal();
      const focusEl = initialFocus ? dlg.querySelector(initialFocus) : null;
      if (focusEl) { focusEl.focus(); if (focusEl.select) focusEl.select(); }
    });
  }

  /** Подтверждение. Возвращает true/false. */
  function confirm({ title, message, confirmText, danger }) {
    return dialog({
      title: title || "Подтвердите действие",
      body: Array.isArray(message) ? message.map((m) => h("p", null, m)) : h("p", null, message),
      initialFocus: "[data-cancel]",
      actions: (close) => [
        h("button", { type: "button", class: "btn btn--ghost", "data-cancel": true, onclick: () => close(false) }, "Отмена"),
        h("button", { type: "button", class: "btn " + (danger ? "btn--danger-solid" : "btn--primary"), onclick: () => close(true) }, confirmText || "Подтвердить"),
      ],
    }).then((v) => v === true);
  }

  /**
   * Ввод названия. save(value) должен выполнить сохранение и бросить ошибку с текстом при проблеме.
   * Возвращает сохранённый результат или undefined при отмене.
   */
  function nameForm({ title, label, value, placeholder, submitText, save }) {
    const input = h("input", {
      class: "input", type: "text", name: "name", maxlength: String(App.repo.LIMITS.name),
      value: value || "", placeholder: placeholder || "", autocomplete: "off", required: true,
    });
    const error = h("div", { class: "field__error", role: "alert" });
    return dialog({
      title,
      initialFocus: "input",
      body: h("label", { class: "field" }, h("span", { class: "field__label" }, label), input, error),
      actions: (close) => [
        h("button", { type: "button", class: "btn btn--ghost", onclick: () => close(undefined) }, "Отмена"),
        h("button", { type: "submit", class: "btn btn--primary" }, submitText || "Сохранить"),
      ],
      onSubmit: async (close) => {
        error.textContent = "";
        input.classList.remove("input--invalid");
        try {
          const saved = await save(input.value);
          close(saved);
        } catch (e) {
          error.textContent = e.message || "Не удалось сохранить.";
          input.classList.add("input--invalid");
          input.focus();
        }
      },
    });
  }

  /* ---------- Уведомления ---------- */

  function toast(message, type) {
    const root = document.getElementById("toast-root");
    const t = h("div", { class: "toast" + (type === "error" ? " toast--bad" : ""), role: "status" }, message);
    root.appendChild(t);
    setTimeout(() => t.remove(), type === "error" ? 5000 : 2600);
  }

  /** Обёртка для действий: показывает понятную ошибку вместо падения. */
  async function guard(fn) {
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      toast(e && e.message ? e.message : "Произошла ошибка.", "error");
      return undefined;
    }
  }

  return { h, mount, btn, crumbs, pageHead, empty, dialog, confirm, nameForm, toast, guard };
})();
