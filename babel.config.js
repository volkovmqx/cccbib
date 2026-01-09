module.exports = {
  compact: false,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: '38',
        },
        useBuiltIns: 'entry',
        corejs: '3.0',
      },
    ],
    '@babel/preset-react',
  ],
};
