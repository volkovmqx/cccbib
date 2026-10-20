const { registerHooks } = require('node:module');

// The app uses extensionless imports, which Node does not resolve by default.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
      return nextResolve(`${specifier}.js`, context);
    }
  },
});

function mockBrowser() {
  const storage = new Map();
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  global.window = new EventTarget();
}

module.exports = { mockBrowser };
