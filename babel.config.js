module.exports = {
  compact: false,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // webOS 2.0+ uses Chrome 38
          chrome: '38',
        },
        useBuiltIns: 'entry',
        corejs: '3.0',
      },
    ],
    '@babel/preset-react',
  ],
};
