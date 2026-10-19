module.exports = {
  compact: false,
  sourceType: 'unambiguous',
  targets: { chrome: '68' },
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic', development: false }],
  ],
  plugins: [
    ['babel-plugin-polyfill-corejs3', { method: 'usage-global', version: '3.50', proposals: false }],
  ],
};
