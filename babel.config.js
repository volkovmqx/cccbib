module.exports = {
  compact: false,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // webOS 3.0+ uses Chrome 53
          chrome: '53',
        },
        useBuiltIns: 'entry',
        corejs: '3.0',
      },
    ],
    '@babel/preset-react',
  ],
};
