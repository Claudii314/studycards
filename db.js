App.db = function() {
  const DB_NAME = "studycards";
  const DB_VERSION = 1;
  const STORES = [ "subjects", "groups", "cards" ];
  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Этот браузер не поддерживает IndexedDB."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("subjects")) {
          db.createObjectStore("subjects", {
            keyPath: "id"
          });
        }
        if (!db.objectStoreNames.contains("groups")) {
          const g = db.createObjectStore("groups", {
            keyPath: "id"
          });
          g.createIndex("bySubject", "subjectId", {
            unique: false
          });
        }
        if (!db.objectStoreNames.contains("cards")) {
          const c = db.createObjectStore("cards", {
            keyPath: "id"
          });
          c.createIndex("byGroup", "groupId", {
            unique: false
          });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error("Не удалось открыть базу данных."));
      req.onblocked = () => reject(new Error("База данных занята другой вкладкой. Закройте её и обновите страницу."));
    });
    return dbPromise;
  }
  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function tx(storeNames, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach(n => {
        stores[n] = t.objectStore(n);
      });
      let result;
      Promise.resolve().then(() => fn(stores, t)).then(r => {
        result = r;
      }).catch(err => {
        try {
          t.abort();
        } catch (e) {}
        reject(err);
      });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || new Error("Ошибка записи в базу данных."));
      t.onabort = () => reject(t.error || new Error("Операция с базой данных отменена."));
    });
  }
  function getAll(store) {
    return tx([ store ], "readonly", s => reqToPromise(s[store].getAll()));
  }
  function get(store, id) {
    return tx([ store ], "readonly", s => reqToPromise(s[store].get(id)));
  }
  function getByIndex(store, index, value) {
    return tx([ store ], "readonly", s => reqToPromise(s[store].index(index).getAll(value)));
  }
  function put(store, value) {
    return tx([ store ], "readwrite", s => reqToPromise(s[store].put(value)));
  }
  return {
    open: open,
    tx: tx,
    reqToPromise: reqToPromise,
    getAll: getAll,
    get: get,
    getByIndex: getByIndex,
    put: put,
    STORES: STORES
  };
}();
