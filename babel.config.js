// The app code gets the polyfills it uses. React and the carousel run on Chrome 68 as they are, and the replacements for native push, unshift, JSON and setImmediate would only slow the TV down
module.exports = {
  compact: false,
  sourceType: 'unambiguous',
  targets: { chrome: '68' },
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic', development: false }],
  ],
  overrides: [{
    exclude: /node_modules/,
    plugins: [
      ['babel-plugin-polyfill-corejs3', {
        method: 'usage-global',
        version: '3.50',
        proposals: false,
        exclude: [/^esn?e?x?t?\.(iterator|set)\./, /get-or-insert/, /^es(next)?\.json\./, 'es.array.push', 'es.array.unshift', 'es.array.reduce', 'web.immediate', 'es.error.cause', /^web\.url/],
      }],
    ],
  }],
};
